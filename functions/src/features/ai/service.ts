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

/**
 * Generates an AI assistant response for a given chat message, history,
 * system prompt, and tools.
 */
export async function askAi(query: AskAiAssistantQuery): Promise<AskAiAssistantResponse> {
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
      tools: [
        {
          functionDeclarations: AI_FUNCTION_DECLARATIONS as unknown as Record<string, unknown>[],
        },
      ],
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
