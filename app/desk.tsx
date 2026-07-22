"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckResult, Signal, Verdict } from "@/lib/engine/types";

const DRAINER_APPROVAL =
  "0xa22cb465000000000000000000000000badbadbadbadbadbadbadbadbadbadbadbadbadb0000000000000000000000000000000000000000000000000000000000000001";

const SCAM_ANNOUNCEMENT =
  "🚨 SURPRISE MINT IS LIVE 🚨 Congratulations, you've been selected for our stealth mint! Only 100 spots left — ends in 1 hour. Our main site got hacked so use the new link to claim & verify your wallet: free-mint-claim.xyz";

const EXAMPLES: { label: string; value: string; hint: string }[] = [
  { label: "Official site", value: "opensea.io", hint: "should pass" },
  { label: "Fake mint page", value: "opensea-mint.net", hint: "reported scam" },
  { label: "Look-alike domain", value: "0pensea.io", hint: "typosquat" },
  { label: "Drainer approval", value: DRAINER_APPROVAL, hint: "setApprovalForAll" },
  { label: "Scam announcement", value: SCAM_ANNOUNCEMENT, hint: "social engineering" },
];

/** Ordered path for judges — 60s demo script. */
const JUDGE_PATH = [
  { label: "1 · Official", value: "opensea.io", expect: "SAFE" },
  { label: "2 · Typosquat", value: "0pensea.io", expect: "DANGER" },
  { label: "3 · Drainer tx", value: DRAINER_APPROVAL, expect: "DANGER" },
  { label: "4 · Hijack post", value: SCAM_ANNOUNCEMENT, expect: "DANGER" },
] as const;

// Base first (Vibestarter), then major EVM L2s / L1.
const CHAINS: { id: string; name: string }[] = [
  { id: "8453", name: "Base" },
  { id: "1", name: "Ethereum" },
  { id: "137", name: "Polygon" },
  { id: "42161", name: "Arbitrum" },
  { id: "10", name: "Optimism" },
  { id: "56", name: "BNB Chain" },
];

const VERDICT: Record<Verdict, { label: string; color: string; glyph: string; bar: string }> = {
  SAFE: { label: "SAFE", color: "#22c55e", glyph: "✓", bar: "bg-emerald-500" },
  CAUTION: { label: "CAUTION", color: "#f59e0b", glyph: "!", bar: "bg-amber-500" },
  DANGER: { label: "DANGER", color: "#ef4444", glyph: "✕", bar: "bg-red-500" },
};

const SEV_COLOR: Record<Signal["severity"], string> = {
  danger: "#ef4444",
  caution: "#f59e0b",
  safe: "#22c55e",
  info: "#64748b",
};

const SEV_RANK: Record<Signal["severity"], number> = {
  danger: 0,
  caution: 1,
  safe: 2,
  info: 3,
};

const KIND_LABEL: Record<string, string> = {
  url: "Link",
  address: "Contract / address",
  calldata: "Transaction data",
  "typed-data": "Signature request",
  announcement: "Announcement",
  unknown: "Unknown",
};

function reportTarget(result: CheckResult): { value: string; type: "domain" | "address" } | null {
  if (result.kind === "url") {
    try {
      const withScheme = /^https?:\/\//i.test(result.input)
        ? result.input
        : `https://${result.input}`;
      return { value: new URL(withScheme).hostname.toLowerCase(), type: "domain" };
    } catch {
      return null;
    }
  }
  if (result.kind === "address") {
    return { value: result.input.trim().toLowerCase(), type: "address" };
  }
  return null;
}

function humanizeDegradedClient(items: string[]): string[] {
  return items.map((raw) => {
    const s = raw.toLowerCase();
    if (s.includes("claude") || s.includes("anthropic")) {
      return "AI narration offline — using deterministic explanation";
    }
    if (s.includes("rdap") || s.includes("domain age")) {
      return "Domain age unavailable — other signals still apply";
    }
    if (s.includes("etherscan")) {
      return "Contract age / verified-source skipped";
    }
    if (s.includes("goplus")) {
      return "GoPlus reputation temporarily unavailable";
    }
    if (s.includes("phishing")) {
      return "Phishing feed temporarily unavailable";
    }
    return raw;
  });
}

function buildShareUrl(input: string, chainId: string, lang: string): string {
  if (typeof window === "undefined") return "";
  const u = new URL(window.location.href);
  u.searchParams.set("q", input);
  u.searchParams.set("chain", chainId);
  u.searchParams.set("lang", lang);
  // Drop judge demo param from shared links.
  u.searchParams.delete("demo");
  return u.toString();
}

function readQuery(): { q?: string; chain?: string; lang?: string; demo?: string } {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    q: p.get("q") ?? undefined,
    chain: p.get("chain") ?? undefined,
    lang: p.get("lang") ?? undefined,
    demo: p.get("demo") ?? undefined,
  };
}

export function Desk() {
  const [input, setInput] = useState("");
  const [chainId, setChainId] = useState("8453");
  const [lang, setLang] = useState<"en" | "id">("en");
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [judgeRunning, setJudgeRunning] = useState(false);
  const [judgeStep, setJudgeStep] = useState<number | null>(null);
  const bootstrapped = useRef(false);
  const judgeCancel = useRef(false);

  const check = useCallback(
    async (raw?: string, langOverride?: "en" | "id", chainOverride?: string) => {
      const value = (raw ?? input).trim();
      if (!value) return null;
      if (raw !== undefined) setInput(raw);
      setLoading(true);
      setError(null);
      const started = performance.now();
      const useLang = langOverride ?? lang;
      const useChain = chainOverride ?? chainId;
      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: value, chainId: useChain, lang: useLang }),
        });
        if (!res.ok) throw new Error("Check failed");
        const data = (await res.json()) as CheckResult;
        setResult(data);
        setElapsedMs(Math.round(performance.now() - started));
        // Keep URL shareable without fighting the user mid-type.
        if (typeof window !== "undefined") {
          const u = new URL(window.location.href);
          u.searchParams.set("q", value);
          u.searchParams.set("chain", useChain);
          u.searchParams.set("lang", useLang);
          window.history.replaceState({}, "", u.toString());
        }
        return data;
      } catch {
        setError("Something went wrong running the check. Try again.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [input, lang, chainId],
  );

  // Deep-link / judge auto-start on first mount.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const q = readQuery();
    if (q.chain && CHAINS.some((c) => c.id === q.chain)) setChainId(q.chain);
    if (q.lang === "en" || q.lang === "id") setLang(q.lang);
    if (q.demo === "judge") {
      // Kick judge path after state settles.
      void (async () => {
        await new Promise((r) => setTimeout(r, 50));
        await runJudgePath();
      })();
      return;
    }
    if (q.q) {
      setInput(q.q);
      void check(q.q, q.lang === "id" ? "id" : "en", q.chain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runJudgePath() {
    judgeCancel.current = false;
    setJudgeRunning(true);
    setError(null);
    for (let i = 0; i < JUDGE_PATH.length; i++) {
      if (judgeCancel.current) break;
      setJudgeStep(i);
      await check(JUDGE_PATH[i].value);
      // Brief pause so judges can read the card.
      await new Promise((r) => setTimeout(r, 1400));
    }
    setJudgeRunning(false);
    setJudgeStep(null);
  }

  async function report() {
    if (!result) return;
    const target = reportTarget(result);
    if (!target) return;
    setReporting(true);
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, list: "block", reason: "Reported via exSafe web" }),
      });
      await check(result.input);
    } catch {
      setError("Could not submit the report.");
    } finally {
      setReporting(false);
    }
  }

  async function copyShareLink() {
    if (!result) return;
    const url = buildShareUrl(result.input, chainId, lang);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy link — copy the URL bar instead.");
    }
  }

  const mono = /^0x|^\{/.test(input.trim());
  const canReport = result ? reportTarget(result) !== null : false;
  const alreadyBlocked = result?.signals.some((s) => s.id === "community-blocklist") ?? false;
  const shareUrl = useMemo(
    () => (result ? buildShareUrl(result.input, chainId, lang) : ""),
    [result, chainId, lang],
  );

  return (
    <div>
      {/* Judge path */}
      <div className="mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-emerald-300">
            60s judge path
          </span>
          <span className="text-[12px] text-muted">Official → typosquat → drainer tx → hijack post</span>
          <button
            onClick={() => void runJudgePath()}
            disabled={loading || judgeRunning}
            className="ml-auto rounded-lg bg-emerald-500 px-3 py-1.5 text-[13px] font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {judgeRunning ? "Running…" : "Run demo"}
          </button>
          {judgeRunning && (
            <button
              onClick={() => {
                judgeCancel.current = true;
              }}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted hover:text-foreground"
            >
              Stop
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {JUDGE_PATH.map((step, i) => (
            <span
              key={step.label}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                judgeStep === i
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                  : "border-border text-muted"
              }`}
            >
              {step.label}
              <span className="ml-1 opacity-60">→ {step.expect}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-border bg-panel p-3 shadow-2xl shadow-black/30">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void check();
          }}
          rows={3}
          spellCheck={false}
          placeholder="Paste a link, contract address (0x…), transaction data, or a suspicious announcement…"
          className={`w-full resize-y rounded-xl bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted/70 ${
            mono ? "font-mono text-[13px]" : ""
          }`}
        />
        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <select
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            className="rounded-lg border border-border bg-panel-2 px-2.5 py-2 text-[13px] outline-none"
            aria-label="Chain"
          >
            {CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-lg border border-border text-[13px]">
            {(["en", "id"] as const).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  if (result) void check(result.input, l);
                }}
                className={`px-2.5 py-2 ${
                  lang === l ? "bg-panel-2 text-foreground" : "text-muted"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => void check()}
            disabled={loading || !input.trim()}
            className="ml-auto rounded-lg bg-emerald-500 px-4 py-2 text-[14px] font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Checking…" : "Check"}
          </button>
        </div>
      </div>

      {/* Examples */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-muted">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => void check(ex.value)}
            className="group rounded-full border border-border bg-panel px-2.5 py-1 text-[12px] text-muted transition hover:border-emerald-500/40 hover:text-foreground"
            title={ex.hint}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[14px] text-red-300">
          {error}
        </div>
      )}

      {result && (
        <ResultCard
          result={result}
          elapsedMs={elapsedMs}
          shareUrl={shareUrl}
          copied={copied}
          onCopy={() => void copyShareLink()}
        />
      )}

      {result && canReport && (
        <div className="mt-3 flex items-center gap-3 text-[13px] text-muted">
          {alreadyBlocked ? (
            <span className="text-emerald-400">✓ On the community blocklist</span>
          ) : (
            <>
              <span>Seen this scam?</span>
              <button
                onClick={() => void report()}
                disabled={reporting}
                className="rounded-lg border border-border bg-panel px-3 py-1.5 font-medium text-foreground transition hover:border-red-500/40 disabled:opacity-50"
              >
                {reporting ? "Reporting…" : "Report to community blocklist"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  elapsedMs,
  shareUrl,
  copied,
  onCopy,
}: {
  result: CheckResult;
  elapsedMs: number | null;
  shareUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const v = VERDICT[result.verdict];
  const signals = [...result.signals].sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity],
  );
  const degraded = humanizeDegradedClient(result.meta.degraded);

  return (
    <div
      className="mt-5 overflow-hidden rounded-2xl border bg-panel"
      style={{ borderColor: `${v.color}55` }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-5" style={{ background: `${v.color}12` }}>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold"
          style={{ background: `${v.color}22`, color: v.color }}
        >
          {v.glyph}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tracking-wide" style={{ color: v.color }}>
              {v.label}
            </span>
            <span className="rounded-md border border-border bg-panel px-1.5 py-0.5 text-[11px] text-muted">
              {KIND_LABEL[result.kind] ?? result.kind}
            </span>
            {result.meta.aiNarrated && (
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300">
                ✨ AI explained
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[15px] font-medium">{result.summary}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="text-[11px] text-muted">risk</div>
          <div className="text-xl font-bold" style={{ color: v.color }}>
            {result.score}
          </div>
        </div>
      </div>

      {/* Risk meter */}
      <div className="h-1.5 w-full bg-panel-2">
        <div
          className={`h-full ${v.bar} transition-all`}
          style={{ width: `${Math.max(4, result.score)}%` }}
        />
      </div>

      <div className="p-5">
        <p className="text-[14px] leading-relaxed text-foreground/90">{result.explanation}</p>

        <div
          className="mt-4 rounded-xl border px-4 py-3 text-[14px] font-medium"
          style={{ borderColor: `${v.color}44`, background: `${v.color}0d`, color: v.color }}
        >
          {result.recommendation}
        </div>

        {/* Share */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={onCopy}
            className="rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:border-emerald-500/40"
          >
            {copied ? "Link copied" : "Copy share link"}
          </button>
          {shareUrl && (
            <span className="max-w-full truncate font-mono text-[11px] text-muted" title={shareUrl}>
              {shareUrl.replace(/^https?:\/\//, "")}
            </span>
          )}
        </div>

        {/* Signals */}
        <div className="mt-5">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            What exSafe checked
          </div>
          <ul className="space-y-2">
            {signals.map((s, i) => (
              <li key={`${s.id}-${i}`} className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: SEV_COLOR[s.severity] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-[14px] font-medium">{s.label}</span>
                    {s.source && (
                      <span className="rounded border border-border px-1 py-px text-[10px] text-muted">
                        {s.source}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] leading-snug text-muted">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Meta */}
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-[11px] text-muted">
          {result.meta.chainName && <span>{result.meta.chainName}</span>}
          <span>· checked {new Date(result.meta.checkedAt).toLocaleTimeString()}</span>
          {elapsedMs != null && <span>· {elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`}</span>}
          {degraded.length > 0 && (
            <span className="text-amber-400/90" title={degraded.join(" · ")}>
              · {degraded[0]}
              {degraded.length > 1 ? ` (+${degraded.length - 1} more)` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
