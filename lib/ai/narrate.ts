import { chatComplete, extractJson } from "@/lib/ai/client";
import { config, has } from "@/lib/config";
import type { InputKind, Signal, Verdict } from "@/lib/engine/types";

export interface Narration {
  summary: string;
  explanation: string;
  recommendation: string;
  aiNarrated: boolean;
}

export interface NarrateInput {
  input: string;
  kind: InputKind;
  verdict: Verdict;
  score: number;
  signals: Signal[];
  lang?: "en" | "id";
}

const SYSTEM = (lang: string) =>
  `You are exSafe, a calm and trustworthy safety desk for NFT/crypto community members who are often non-technical. You are given a security verdict and the signals it was built from. Explain the situation in plain ${lang}, concretely and without hype or fear-mongering. Never invent signals that aren't provided. Respond with ONLY minified JSON, no markdown:
{"summary": string (<=120 char headline), "explanation": string (2-4 short plain-language sentences), "recommendation": string (one concrete action such as "Do not connect your wallet.")}`;

export async function narrate(input: NarrateInput): Promise<Narration> {
  if (!has.ai()) return fallback(input);

  try {
    const lang = (input.lang ?? config.narrationLang) === "id" ? "Indonesian" : "English";
    const payload = JSON.stringify({
      verdict: input.verdict,
      score: input.score,
      kind: input.kind,
      input: input.input.slice(0, 400),
      signals: input.signals.map((s) => ({
        label: s.label,
        severity: s.severity,
        detail: s.detail,
        source: s.source,
      })),
    });

    const text = await chatComplete({
      system: SYSTEM(lang),
      user: payload,
      // MiMo may spend budget on reasoning — keep headroom for the JSON answer.
      maxTokens: 1000,
    });
    if (!text) return fallback(input);

    const json = extractJson<Partial<Narration>>(text);
    if (json?.summary && json?.explanation && json?.recommendation) {
      return {
        summary: String(json.summary),
        explanation: String(json.explanation),
        recommendation: String(json.recommendation),
        aiNarrated: true,
      };
    }
  } catch {
    // fall through
  }
  return fallback(input);
}

/** Deterministic narration so the product still works with no LLM key. */
function fallback(input: NarrateInput): Narration {
  const { verdict, signals } = input;
  const dangers = signals.filter((s) => s.severity === "danger");
  const cautions = signals.filter((s) => s.severity === "caution");

  let summary: string;
  let recommendation: string;
  if (verdict === "DANGER") {
    summary = dangers[0]?.label ?? "Dangerous — do not proceed";
    recommendation = "Do not connect your wallet or sign anything. Close the page.";
  } else if (verdict === "CAUTION") {
    summary = cautions[0]?.label ?? "Proceed with caution";
    recommendation = "Verify against an official source before you connect or sign.";
  } else {
    summary = "No red flags found";
    recommendation = "Looks okay — but always confirm links from official channels.";
  }

  const pick = dangers.length ? dangers : cautions.length ? cautions : signals;
  const explanation =
    pick
      .slice(0, 3)
      .map((s) => s.detail)
      .join(" ") || "No notable signals were found.";

  return { summary, explanation, recommendation, aiNarrated: false };
}
