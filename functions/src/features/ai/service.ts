import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../../common/firebaseAdmin";
import { toolsAllowedBy } from "./access";
import { AI_FUNCTION_DECLARATIONS } from "./tools";
import { AiFunctionCall, AskAiAssistantQuery, AskAiAssistantResponse } from "./types";

/**
 * Returns a configured GoogleGenAI instance.
 * Defaults to Vertex AI on Google Cloud with automatic IAM credentials (zero API key needed).
 * Falls back to Google AI Studio if GEMINI_API_KEY environment variable is present.
 */
export async function getGenAIClient() {
  const { GoogleGenAI } = await import("@google/genai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    return {
      ai: new GoogleGenAI({ apiKey: apiKey.trim() }),
      source: "gemini" as const,
    };
  }

  return {
    ai: new GoogleGenAI({
      vertexai: true,
      project: process.env.GCLOUD_PROJECT || "transfarm-app",
      location: "us-central1",
    }),
    source: "vertexai" as const,
  };
}

/** Members who can use MitrAI; guests can't. */
const MITRA_ROLES = new Set(["owner", "coowner", "manager"]);

/**
 * The lookups [farmId] lets MitrAI use, checked against the farm itself rather
 * than anything the app says. Only farm members may ask.
 */
export async function allowedDeclarations(farmId: string, uid: string | undefined) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const farmRef = db.collection("farms").doc(farmId);
  const [farm, member] = await Promise.all([farmRef.get(), farmRef.collection("members").doc(uid).get()]);
  if (!farm.exists) throw new HttpsError("not-found", "Farm not found");
  const role = farm.get("ownerId") === uid ? "owner" : member.get("role");
  if (!MITRA_ROLES.has(role)) throw new HttpsError("permission-denied", "Not allowed to use MitrAI on this farm");
  return toolsAllowedBy(AI_FUNCTION_DECLARATIONS, farm.get("aiDataAccess"));
}

/**
 * Generates an AI assistant response for a given chat message, history,
 * system prompt, and tools. [declarations] are the lookups to offer; all of
 * them when not given.
 */
export async function askAi(
  query: AskAiAssistantQuery,
  declarations: readonly { name: string }[] = AI_FUNCTION_DECLARATIONS,
): Promise<AskAiAssistantResponse> {
  const { ai, source } = await getGenAIClient();

  // Reconstruct conversation contents for Gemini / Vertex AI
  const contents: Array<{
    role: "user" | "model";
    parts: Array<Record<string, unknown>>;
  }> = [];

  if (query.history && query.history.length > 0) {
    for (const item of query.history) {
      contents.push({
        role: item.role,
        parts: item.parts.map((p) => {
          if (p.text !== undefined) return { text: p.text };
          if (p.inlineData !== undefined) return { inlineData: p.inlineData };
          if (p.functionCall !== undefined) return { functionCall: p.functionCall };
          if (p.functionResponse !== undefined) return { functionResponse: p.functionResponse };
          return p as Record<string, unknown>;
        }),
      });
    }
  }

  // Add the current turn
  if (query.parts && query.parts.length > 0) {
    // If parts are provided (e.g. text + attachments or function responses)
    // Determine the role: if it has functionResponse, the role is "user" in Gemini format
    contents.push({
      role: "user",
      parts: query.parts.map((p) => {
        if (p.text !== undefined) return { text: p.text };
        if (p.inlineData !== undefined) return { inlineData: p.inlineData };
        if (p.functionCall !== undefined) return { functionCall: p.functionCall };
        if (p.functionResponse !== undefined) return { functionResponse: p.functionResponse };
        return p as Record<string, unknown>;
      }),
    });
  } else if (query.message) {
    contents.push({
      role: "user",
      parts: [{ text: query.message }],
    });
  }

  const model = query.model || "gemini-2.5-flash-lite";

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: query.systemInstruction,
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      // No tools at all when the farm allows none: an empty list is an error.
      tools:
        declarations.length > 0
          ? [{ functionDeclarations: declarations as unknown as Record<string, unknown>[] }]
          : undefined,
    },
  });

  // Extract function calls if model requested any tool execution
  const functionCalls: AiFunctionCall[] = [];
  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      const p = part as Record<string, unknown>;
      if (p.functionCall && typeof p.functionCall === "object") {
        const fc = p.functionCall as { name?: string; args?: Record<string, unknown> };
        if (fc.name) {
          functionCalls.push({
            name: fc.name,
            args: fc.args ?? {},
          });
        }
      }
    }
  }

  return {
    text: response.text ?? "",
    functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
    source,
  };
}
