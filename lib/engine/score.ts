import type { Signal, Verdict } from "./types";

/** Risk points each severity contributes. `safe` is a *negative* (trust) signal. */
const WEIGHT: Record<Signal["severity"], number> = {
  danger: 100,
  caution: 30,
  safe: -20,
  info: 0,
};

export interface Scored {
  verdict: Verdict;
  score: number;
}

/**
 * Transparent, explainable scoring. Rules, in order:
 *  - any single `danger` signal → DANGER (a drainer approval is never "just caution")
 *  - community-verified (allowlist) and otherwise clean → SAFE
 *  - otherwise threshold the accumulated risk score
 */
export function scoreSignals(signals: Signal[]): Scored {
  let raw = 0;
  let hasDanger = false;
  for (const s of signals) {
    raw += WEIGHT[s.severity];
    if (s.severity === "danger") hasDanger = true;
  }
  const score = Math.max(0, Math.min(100, raw));
  const allowlisted = signals.some((s) => s.id === "community-allowlist");

  let verdict: Verdict;
  if (hasDanger) verdict = "DANGER";
  else if (allowlisted && score < 20) verdict = "SAFE";
  else if (score >= 60) verdict = "DANGER";
  else if (score >= 20) verdict = "CAUTION";
  else verdict = "SAFE";

  return { verdict, score };
}
