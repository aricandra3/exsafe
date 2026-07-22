"use client";

import { useState } from "react";
import type { CheckResult, Signal, Verdict } from "@/lib/engine/types";

const DRAINER_APPROVAL =
  "0xa22cb4650000000000000000000000000000000000000000000000000000000000badbad0000000000000000000000000000000000000000000000000000000000000001";

const SCAM_ANNOUNCEMENT =
  "🚨 SURPRISE MINT IS LIVE 🚨 Congratulations, you've been selected for our stealth mint! Only 100 spots left — ends in 1 hour. Our main site got hacked so use the new link to claim & verify your wallet: free-mint-claim.xyz";

const EXAMPLES: { label: string; value: string; hint: string }[] = [
  { label: "Official site", value: "opensea.io", hint: "should pass" },
  { label: "Fake mint page", value: "opensea-mint.net", hint: "reported scam" },
  { label: "Look-alike domain", value: "0pensea.io", hint: "typosquat" },
  { label: "Drainer approval", value: DRAINER_APPROVAL, hint: "setApprovalForAll" },
  { label: "Scam announcement", value: SCAM_ANNOUNCEMENT, hint: "social engineering" },
];

const CHAINS: { id: string; name: string }[] = [
  { id: "1", name: "Ethereum" },
  { id: "8453", name: "Base" },
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

export function Desk() {
  const [input, setInput] = useState("");
  const [chainId, setChainId] = useState("1");
  const [lang, setLang] = useState<"en" | "id">("en");
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function check(raw?: string, langOverride?: "en" | "id") {
    const value = (raw ?? input).trim();
    if (!value) return;
    if (raw !== undefined) setInput(raw);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: value, chainId, lang: langOverride ?? lang }),
      });
      if (!res.ok) throw new Error("Check failed");
      setResult((await res.json()) as CheckResult);
    } catch {
      setError("Something went wrong running the check. Try again.");
    } finally {
      setLoading(false);
    }
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

  const mono = /^0x|^\{/.test(input.trim());
  const canReport = result ? reportTarget(result) !== null : false;
  const alreadyBlocked = result?.signals.some((s) => s.id === "community-blocklist") ?? false;

  return (
    <div>
      {/* Input */}
      <div className="rounded-2xl border border-border bg-panel p-3 shadow-2xl shadow-black/30">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") check();
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
                  if (result) check(result.input, l);
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
            onClick={() => check()}
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
            onClick={() => check(ex.value)}
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

      {result && <ResultCard result={result} />}

      {result && canReport && (
        <div className="mt-3 flex items-center gap-3 text-[13px] text-muted">
          {alreadyBlocked ? (
            <span className="text-emerald-400">✓ On your community blocklist</span>
          ) : (
            <>
              <span>Seen this scam?</span>
              <button
                onClick={report}
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

function ResultCard({ result }: { result: CheckResult }) {
  const v = VERDICT[result.verdict];
  const signals = [...result.signals].sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity],
  );

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
          <div className="flex items-center gap-2">
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
          {result.meta.degraded.length > 0 && (
            <span className="text-amber-400/80">
              · limited: {result.meta.degraded.join("; ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
