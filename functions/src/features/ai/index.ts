import { HttpsError, onCall } from "firebase-functions/v2/https";
import { askAi } from "./service";
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

  try {
    return await askAi(parsed.data);
  } catch (err) {
    throw new HttpsError(
      "unavailable",
      `Failed to generate AI response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});
