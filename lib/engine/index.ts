import { narrate } from "@/lib/ai/narrate";
import type { CheckContext } from "@/lib/checkers/base";
import { checkAnnouncement } from "@/lib/checkers/announcement";
import { checkCalldata, checkTypedData } from "@/lib/checkers/calldata";
import { checkContract } from "@/lib/checkers/contract";
import { checkUrl } from "@/lib/checkers/url";
import { CHAIN_NAMES, config, humanizeDegraded } from "@/lib/config";
import { detectInput } from "./detect";
import { scoreSignals } from "./score";
import type { CheckResult, InputKind, Signal } from "./types";

export interface RunOptions {
  community?: string;
  chainId?: string;
  /** Override auto-detection. */
  kind?: InputKind;
  lang?: "en" | "id";
}

/** The one entry point every surface calls. Detect → check → score → narrate. */
export async function runCheck(rawInput: string, opts: RunOptions = {}): Promise<CheckResult> {
  const detected = opts.kind
    ? { kind: opts.kind, normalized: rawInput.trim(), parsed: undefined as Record<string, unknown> | undefined }
    : detectInput(rawInput);

  const chainId = opts.chainId ?? config.defaultChainId;
  const ctx: CheckContext = { community: opts.community, chainId };

  let signals: Signal[] = [];
  let degraded: string[] = [];

  switch (detected.kind) {
    case "url":
      ({ signals, degraded } = await checkUrl(detected.normalized, ctx));
      break;
    case "address":
      ({ signals, degraded } = await checkContract(detected.normalized, ctx));
      break;
    case "calldata":
      ({ signals, degraded } = await checkCalldata(detected.normalized, ctx));
      break;
    case "typed-data":
      ({ signals, degraded } = await checkTypedData(detected.parsed ?? {}, ctx));
      break;
    case "announcement":
      ({ signals, degraded } = await checkAnnouncement(detected.normalized, ctx));
      break;
    default:
      signals = [
        {
          id: "unknown-input",
          label: "Unrecognised input",
          severity: "info",
          detail:
            "Paste a link, contract address, transaction data, or an announcement to check.",
        },
      ];
  }

  const { verdict, score } = scoreSignals(signals);
  const narration = await narrate({
    input: rawInput,
    kind: detected.kind,
    verdict,
    score,
    signals,
    lang: opts.lang,
  });

  return {
    input: rawInput,
    kind: detected.kind,
    verdict,
    score,
    signals,
    summary: narration.summary,
    explanation: narration.explanation,
    recommendation: narration.recommendation,
    meta: {
      chainId,
      chainName: CHAIN_NAMES[chainId],
      checkedAt: new Date().toISOString(),
      degraded: humanizeDegraded([...new Set(degraded)]),
      aiNarrated: narration.aiNarrated,
    },
  };
}
