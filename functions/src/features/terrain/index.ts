import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { getPlotTerrain as computePlotTerrain } from "./service";

const plotTerrainQuerySchema = z.object({
  plotId: z.string().min(1).max(128),
});

/**
 * Callable used by the Field Map: elevation, slope and downhill direction
 * for one mapped plot, from the Copernicus GLO-30 elevation model. The
 * result is stored per plot and reused until the boundary changes.
 */
// Called rarely (results are cached per plot), so no always-warm instance:
// a cold start adds a second or two to a one-off computation.
export const getPlotTerrain = onCall({ timeoutSeconds: 60, minInstances: 0 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  const parsed = plotTerrainQuerySchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid plot terrain query", parsed.error.flatten());
  }

  try {
    return await computePlotTerrain(parsed.data.plotId, request.auth.uid);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError(
      "unavailable",
      `Failed to compute plot terrain: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});
