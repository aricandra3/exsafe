import Anthropic from "@anthropic-ai/sdk";
import { aiBackendLabel, config, has } from "@/lib/config";

export interface ChatParams {
  system: string;
  user: string;
  /** Completion budget. MiMo can spend tokens on reasoning — keep this ≥ 600. */
  maxTokens?: number;
}

/**
 * One call site for every LLM feature (narration, announcement tactics).
 * Returns plain text, or null when no provider is configured / the call fails.
 */
export async function chatComplete(params: ChatParams): Promise<string | null> {
  const maxTokens = params.maxTokens ?? 800;
  if (config.aiProvider === "openai") return chatOpenAI(params, maxTokens);
  if (config.aiProvider === "anthropic") return chatAnthropic(params, maxTokens);
  return null;
}

export function aiSourceLabel(): string {
  return aiBackendLabel();
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

// ---------------------------------------------------------------------------
// OpenAI-compatible (Xiaomi MiMo, OpenRouter, OpenAI, public 9Router, …)
// ---------------------------------------------------------------------------

async function chatOpenAI(params: ChatParams, maxTokens: number): Promise<string | null> {
  if (!has.openai() || !config.openaiApiKey) return null;
  try {
    const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.openaiModel,
        max_tokens: maxTokens,
        temperature: 0.2,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    });
    if (!res.ok) {
      // swallow — caller falls back
      return null;
    }
    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          reasoning_content?: string | null;
        };
      }[];
    };
    const msg = data.choices?.[0]?.message;
    const content = (msg?.content ?? "").trim();
    if (content) return content;
    // Some MiMo responses put intermediate text only in reasoning when budget is tight.
    const reasoning = (msg?.reasoning_content ?? "").trim();
    if (reasoning) {
      // Last resort: try to pull a JSON object out of reasoning text.
      const jsonish = extractJson(reasoning);
      if (jsonish) return JSON.stringify(jsonish);
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Anthropic (Claude)
// ---------------------------------------------------------------------------

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic | null {
  if (!has.anthropic() || !config.anthropicApiKey) return null;
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: config.anthropicApiKey });
  return anthropicClient;
}

async function chatAnthropic(params: ChatParams, maxTokens: number): Promise<string | null> {
  const client = getAnthropic();
  if (!client) return null;
  try {
    const message = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: maxTokens,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

// Back-compat exports used nowhere after rewrite, kept for soft imports.
/** @deprecated use chatComplete */
export function anthropic(): Anthropic | null {
  return getAnthropic();
}

/** @deprecated */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
