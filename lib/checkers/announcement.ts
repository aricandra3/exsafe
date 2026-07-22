import { aiSourceLabel, chatComplete, extractJson } from "@/lib/ai/client";
import { has } from "@/lib/config";
import type { Signal, SignalSeverity } from "@/lib/engine/types";
import { extractUrls } from "@/lib/util/text";
import type { CheckContext, CheckerOutput } from "./base";
import { checkUrl } from "./url";

const SYSTEM = `You analyse NFT/crypto community announcements (Discord/Twitter/Telegram) for social-engineering and scam tactics. Return ONLY minified JSON, no markdown:
{"tactics":[{"name":string,"severity":"danger"|"caution","detail":string}],"verdictHint":"danger"|"caution"|"safe"}
Watch for: false urgency, "you've been selected/whitelisted", surprise/stealth mint, "we got hacked, use this new link/contract", claim/airdrop bait, impersonating mods/founders, and pressure to connect a wallet or sign to "verify". If the text looks legitimate and benign, return an empty tactics array and "safe".`;

/** Keyword fallback when the LLM is unavailable. */
const PATTERNS: { re: RegExp; name: string; severity: SignalSeverity; detail: string }[] = [
  {
    re: /\b(you'?ve been (selected|chosen|whitelisted)|congratulations)\b/i,
    name: "“You’ve been selected” bait",
    severity: "caution",
    detail: "Plays on excitement to rush you into acting.",
  },
  {
    re: /\b(hurry|last chance|ends? (soon|today)|only \d+ (left|spots)|act now|24\s?h)/i,
    name: "False urgency",
    severity: "caution",
    detail: "Creates time pressure so you don't stop to verify.",
  },
  {
    re: /\b(surprise|stealth)\s?mint\b/i,
    name: "Surprise / stealth mint",
    severity: "caution",
    detail: "Unannounced mints are frequently compromised-account scams.",
  },
  {
    re: /\b(we (got|were) hacked|account (was )?compromised|use (this )?new (link|contract|server|discord))\b/i,
    name: "“We got hacked — use new link”",
    severity: "danger",
    detail: "Classic hijacked-announcement pattern that pushes a malicious link.",
  },
  {
    re: /\b(claim|airdrop|reward|free\s?(mint|nft))\b/i,
    name: "Free claim / airdrop bait",
    severity: "caution",
    detail: "Free-claim framing is a common drainer lure.",
  },
  {
    re: /\b(connect (your )?wallet|verify (your )?wallet|sign (to|in)|validate (your )?assets)\b/i,
    name: "Asks you to connect / sign to “verify”",
    severity: "caution",
    detail: "Legitimate teams never need you to sign to “verify” assets.",
  },
];

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function heuristicTactics(text: string): Signal[] {
  const out: Signal[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      out.push({
        id: `tactic-${slug(p.name)}`,
        label: p.name,
        severity: p.severity,
        detail: p.detail,
        source: "keyword heuristic",
      });
    }
  }
  return out;
}

export async function checkAnnouncement(text: string, ctx: CheckContext): Promise<CheckerOutput> {
  const signals: Signal[] = [];
  const degraded: string[] = [];
  const source = aiSourceLabel();

  // 1. Tactic analysis (LLM, with keyword fallback).
  if (!has.ai()) {
    degraded.push("AI (no API key — using keyword heuristics)");
    signals.push(...heuristicTactics(text));
  } else {
    try {
      const raw = await chatComplete({
        system: SYSTEM,
        user: text.slice(0, 4000),
        maxTokens: 1200,
      });
      const json = raw
        ? extractJson<{
            tactics?: { name: string; severity: string; detail: string }[];
          }>(raw)
        : null;
      const tactics = json?.tactics ?? [];
      if (!raw || !json) {
        degraded.push(`AI (${source} empty/invalid — using keyword heuristics)`);
        signals.push(...heuristicTactics(text));
      } else {
        for (const t of tactics) {
          signals.push({
            id: `tactic-${slug(t.name)}`,
            label: t.name,
            severity: t.severity === "danger" ? "danger" : "caution",
            detail: t.detail,
            source,
          });
        }
        if (tactics.length === 0) {
          signals.push({
            id: "no-tactics",
            label: "No manipulation tactics detected",
            severity: "info",
            detail: "The text shows no obvious social-engineering patterns.",
            source,
          });
        }
      }
    } catch {
      degraded.push(`AI (${source} error — using keyword heuristics)`);
      signals.push(...heuristicTactics(text));
    }
  }

  // 2. Extract and check embedded links (the most actionable part).
  const urls = extractUrls(text).slice(0, 3);
  for (const u of urls) {
    const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    try {
      const r = await checkUrl(withScheme, ctx);
      degraded.push(...r.degraded);
      const worst =
        r.signals.find((s) => s.severity === "danger") ??
        r.signals.find((s) => s.severity === "caution");
      if (worst) {
        signals.push({
          id: `link-${slug(u)}`,
          label: `Link ${u} — ${worst.label}`,
          severity: worst.severity,
          detail: worst.detail,
          source: worst.source,
          evidence: { url: u },
        });
      } else {
        signals.push({
          id: `link-ok-${slug(u)}`,
          label: `Link ${u}`,
          severity: "info",
          detail: "No red flags matched on this link.",
          evidence: { url: u },
        });
      }
    } catch {
      // ignore a single bad link
    }
  }

  if (signals.length === 0) {
    signals.push({
      id: "announcement-empty",
      label: "Nothing to analyse",
      severity: "info",
      detail: "No tactics or links were found in this text.",
    });
  }
  return { signals, degraded };
}
