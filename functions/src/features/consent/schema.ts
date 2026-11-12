// No Admin SDK here, so tests can import it.
import { z } from "zod";

/**
 * What the app sends when someone accepts the Terms of Use and Privacy
 * Policy. The server adds the time itself, so a wrong phone clock or a
 * modified app can't change it.
 */
export const recordConsentSchema = z.object({
  /** Versions of the documents the person was shown, e.g. "2026-11-12". */
  termsVersion: z.string().trim().min(1).max(32),
  privacyVersion: z.string().trim().min(1).max(32),
  /** The app language they read them in. */
  language: z.string().trim().min(2).max(8),
  appVersion: z.string().trim().max(32).optional(),
  /** Ticked on the login screen, or accepted again after an update. */
  method: z.enum(["login_checkbox", "reaccept"]),
});

export type RecordConsentRequest = z.infer<typeof recordConsentSchema>;
