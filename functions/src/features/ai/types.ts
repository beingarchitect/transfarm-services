import { z } from "zod";

export const chatPartSchema = z.object({
  text: z.string().optional(),
  inlineData: z
    .object({
      mimeType: z.string(),
      data: z.string(), // base64 encoded
    })
    .optional(),
  functionCall: z
    .object({
      name: z.string(),
      args: z.record(z.string(), z.unknown()),
    })
    .optional(),
  functionResponse: z
    .object({
      name: z.string(),
      response: z.record(z.string(), z.unknown()),
    })
    .optional(),
});

export type ChatPart = z.infer<typeof chatPartSchema>;

export const chatContentSchema = z.object({
  role: z.enum(["user", "model"]),
  parts: z.array(chatPartSchema),
});

export type ChatContent = z.infer<typeof chatContentSchema>;

export const askAiAssistantQuerySchema = z.object({
  message: z.string().optional(),
  systemInstruction: z.string().optional(),
  history: z.array(chatContentSchema).optional(),
  parts: z.array(chatPartSchema).optional(),
  model: z.string().optional().default("gemini-2.5-flash-lite"),
});

export type AskAiAssistantQuery = z.infer<typeof askAiAssistantQuerySchema>;

export interface AiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AskAiAssistantResponse {
  text?: string;
  functionCalls?: AiFunctionCall[];
  source: "vertexai" | "gemini";
}
