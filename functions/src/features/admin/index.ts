import { logger } from "firebase-functions/v2";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";
import { adminRefusal } from "./access";
import { GRANTABLE_TIERS, parseDay } from "./grants";
import { auditLog, farmDetail, importEvents, listEvents, listFarms, listUsers, seedDefaultLists } from "./explore";
import { usageReport } from "./usage";
import { describeUser, findUser, GrantRefused, latestStats, listGrants, refreshStats, setTier } from "./service";

// Functions for the admin website (transfarm-admin). Every one starts with
// requireAdmin: the website hides itself from non-admins, but only these
// checks protect the data. Used rarely, so no warm instance.
//
// TODO: enforceAppCheck once the admin site has its reCAPTCHA Enterprise key.

const ADMIN = { minInstances: 0 };

/** The admin's email, or throws permission-denied. */
export function requireAdmin(request: CallableRequest): string {
  const refusal = adminRefusal(request.auth?.token);
  if (refusal) {
    logger.warn("Admin call refused", { reason: refusal, uid: request.auth?.uid });
    throw new HttpsError("permission-denied", "This account can't use the admin tools.");
  }
  return request.auth!.token.email as string;
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpsError("invalid-argument", result.error.issues[0]?.message ?? "Invalid request");
  return result.data;
}

/** Lets the website check, after sign-in, that the account may come in. */
export const adminWhoAmI = onCall(ADMIN, (request) => {
  const email = requireAdmin(request);
  return { email, name: request.auth?.token.name ?? email };
});

// --- Overview ----------------------------------------------------------------

/** The Overview numbers: last night's, or worked out now with refresh. */
export const adminStats = onCall({ ...ADMIN, timeoutSeconds: 120 }, async (request) => {
  requireAdmin(request);
  const { refresh } = parse(z.object({ refresh: z.boolean().optional() }), request.data ?? {});
  return refresh ? refreshStats() : latestStats();
});

/** Keeps the Overview fresh without anyone waiting on it. */
export const buildAdminStats = onSchedule(
  { schedule: "0 2 * * *", timeZone: "Asia/Kolkata", minInstances: 0, timeoutSeconds: 300 },
  async () => {
    const stats = await refreshStats();
    logger.info("Admin stats built", { users: stats.users.total, farms: stats.farms.total });
  },
);

// --- Tiers ---------------------------------------------------------------------

/** One person by phone, email or uid, with their plan and farms. */
export const adminFindUser = onCall(ADMIN, async (request) => {
  requireAdmin(request);
  const { query } = parse(z.object({ query: z.string().trim().min(3).max(128) }), request.data);
  const user = await findUser(query);
  return user ? describeUser(user) : null;
});

/** Gives or takes back a tier. Recorded in admin_audit. */
export const adminSetTier = onCall(ADMIN, async (request) => {
  const by = requireAdmin(request);
  const input = parse(
    z.object({
      uid: z.string().min(1).max(128),
      tier: z.enum(GRANTABLE_TIERS),
      until: z.string().nullable().optional(),
      reason: z.string().trim().max(200).default(""),
      force: z.boolean().default(false),
    }),
    request.data,
  );
  const until = input.until ? parseDay(input.until) : null;
  if (input.until && !until) throw new HttpsError("invalid-argument", "End date must be like 2027-03-31.");
  if (until && until.getTime() < Date.now() - 24 * 3600 * 1000) {
    throw new HttpsError("invalid-argument", "End date is in the past.");
  }
  try {
    return await setTier(
      input.uid,
      { tier: input.tier, until, untilText: input.until ?? null, reason: input.reason, force: input.force },
      by,
    );
  } catch (e) {
    if (e instanceof GrantRefused) throw new HttpsError("failed-precondition", e.message);
    throw e;
  }
});

/** Everyone currently on a tier an admin gave them. */
export const adminListGrants = onCall(ADMIN, async (request) => {
  requireAdmin(request);
  return listGrants();
});

// --- Audit Log -------------------------------------------------------------------

/** Admin changes, latest first; pass the last entry's time for the next page. */
export const adminAuditLog = onCall(ADMIN, async (request) => {
  requireAdmin(request);
  const { limit, before } = parse(
    z.object({ limit: z.number().int().min(1).max(200).default(50), before: z.string().nullable().default(null) }),
    request.data ?? {},
  );
  return auditLog(limit, before);
});

// --- Users & Farms -----------------------------------------------------------------

export const adminListFarms = onCall({ ...ADMIN, timeoutSeconds: 120 }, async (request) => {
  requireAdmin(request);
  return listFarms();
});

export const adminListUsers = onCall({ ...ADMIN, timeoutSeconds: 120 }, async (request) => {
  requireAdmin(request);
  return listUsers();
});

export const adminGetFarm = onCall(ADMIN, async (request) => {
  requireAdmin(request);
  const { farmId } = parse(z.object({ farmId: z.string().min(1).max(128) }), request.data);
  return farmDetail(farmId);
});

// --- Data --------------------------------------------------------------------------

/** Checks an events CSV (write: false), or checks and loads it (write: true). */
export const adminImportEvents = onCall({ ...ADMIN, timeoutSeconds: 120 }, async (request) => {
  const by = requireAdmin(request);
  const { csv, write } = parse(
    z.object({ csv: z.string().min(1).max(2_000_000), write: z.boolean().default(false) }),
    request.data,
  );
  return importEvents(csv, write, by);
});

export const adminListEvents = onCall(ADMIN, async (request) => {
  requireAdmin(request);
  return listEvents();
});

export const adminSeedDefaultLists = onCall(ADMIN, async (request) => {
  const by = requireAdmin(request);
  return seedDefaultLists(by);
});

// --- Usage -------------------------------------------------------------------------

/** How the app is used, from Google Analytics, over the last [days] days. */
export const adminUsage = onCall({ ...ADMIN, timeoutSeconds: 60 }, async (request) => {
  requireAdmin(request);
  const { days } = parse(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(7) }), request.data ?? {});
  try {
    return await usageReport(days);
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status;
    logger.error("Analytics report failed", { status, error: (e as Error).message });
    if (status === 403) {
      throw new HttpsError(
        "failed-precondition",
        "The server can't read Google Analytics yet. Check its service account is a Viewer on the property.",
      );
    }
    throw new HttpsError("unavailable", "Couldn't reach Google Analytics. Try again shortly.");
  }
});
