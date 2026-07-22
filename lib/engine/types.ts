/**
 * Shared vocabulary for the whole app. Every surface (web, API, Discord bot)
 * speaks in these types so there is exactly one "brain".
 */

/** Severity a single signal contributes. */
export type SignalSeverity = "danger" | "caution" | "safe" | "info";

/** Final verdict shown to the user. */
export type Verdict = "SAFE" | "CAUTION" | "DANGER";

/** What kind of thing the user handed us. */
export type InputKind =
  | "url"
  | "address"
  | "calldata"
  | "typed-data"
  | "announcement"
  | "unknown";

/**
 * One atomic finding. Signals are the transparent, auditable units the verdict
 * is built from — the UI renders them as a checklist so a human can see *why*.
 */
export interface Signal {
  /** Stable id, e.g. "phishing-blocklist". */
  id: string;
  /** Short label for the checklist row. */
  label: string;
  severity: SignalSeverity;
  /** One-sentence human explanation. */
  detail: string;
  /** Where this came from, e.g. "GoPlus", "MetaMask eth-phishing-detect". */
  source?: string;
  /** Raw evidence for the curious / for debugging. */
  evidence?: Record<string, unknown>;
}

export interface CheckResult {
  input: string;
  kind: InputKind;
  verdict: Verdict;
  /** 0–100 risk score; drives the meter in the UI. */
  score: number;
  signals: Signal[];
  /** One-line headline. */
  summary: string;
  /** Plain-language explanation for a non-technical collector (Claude or fallback). */
  explanation: string;
  /** Concrete recommended action. */
  recommendation: string;
  meta: {
    chainId?: string;
    chainName?: string;
    checkedAt: string;
    /** Checks skipped because a key was missing or a source errored. */
    degraded: string[];
    /** Set when Claude narration was used (vs the deterministic fallback). */
    aiNarrated?: boolean;
  };
}
