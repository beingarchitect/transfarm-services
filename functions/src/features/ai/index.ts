import { HttpsError, onCall } from "firebase-functions/v2/https";
import { allowedDeclarations, askAi } from "./service";
import { askAiAssistantQuerySchema } from "./types";

/**
 * Callable function used by the Flutter app for MitrAI assistant chat.
 * Runs on Google Cloud Vertex AI using default project credentials
 * (or Gemini API if GEMINI_API_KEY is present).
 *
 * Model can be changed, tuned, or swapped on the server side without any
 * client app updates, and does not require mobile App Check tokens.
 */
export const askAiAssistant = onCall(async (request) => {
  const parsed = askAiAssistantQuerySchema.safeParse(request.data ?? {});

  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid AI assistant query", parsed.error.flatten());
  }

  // Which farm lookups to offer. Older app versions don't send a farm and keep
  // every lookup; newer ones get only what the farm allows its members.
  // Scanners ask for none: they need a JSON answer, never a lookup.
  const declarations = parsed.data.noTools
    ? []
    : parsed.data.farmId
      ? await allowedDeclarations(parsed.data.farmId, request.auth?.uid)
      : undefined;

  try {
    return await askAi(parsed.data, declarations);
  } catch (err) {
    throw new HttpsError(
      "unavailable",
      `Failed to generate AI response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});
