import Anthropic from "@anthropic-ai/sdk";
import { config, has } from "@/lib/config";

let client: Anthropic | null = null;

/** Returns a shared Anthropic client, or null when no API key is configured. */
export function anthropic(): Anthropic | null {
  if (!has.anthropic()) return null;
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

/** Pull the text out of a messages.create response. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Best-effort JSON extraction from a model response (handles stray prose/fences). */
export function extractJson<T = Record<string, unknown>>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
