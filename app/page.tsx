import { Desk } from "./desk";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10 sm:py-14">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-lg ring-1 ring-emerald-500/30">
            🛡️
          </div>
          <span className="text-xl font-semibold tracking-tight">
            ex<span className="text-emerald-400">Safe</span>
          </span>
          <span className="ml-1 rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] font-medium text-muted">
            Community Safety Desk
          </span>
        </div>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">
          Check it before you sign it.
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
          Paste a link, contract address, transaction data, or a suspicious
          announcement. exSafe gives your NFT community one clear verdict —{" "}
          <span className="text-emerald-400">safe</span>,{" "}
          <span className="text-amber-400">caution</span>, or{" "}
          <span className="text-red-400">danger</span> — before anyone connects a
          wallet.
        </p>
      </header>

      <Desk />

      <section className="mt-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          How it works
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            {
              t: "Paste anything",
              d: "A link, contract address, transaction data, or a suspicious announcement.",
            },
            {
              t: "exSafe checks",
              d: "Live phishing feeds, contract reputation, and on-chain decoding — cross-referenced with your community's own reports.",
            },
            {
              t: "Get one verdict",
              d: "Safe, caution, or danger — in plain language, with exactly what to do next.",
            },
          ].map((s, i) => (
            <div key={s.t} className="rounded-2xl border border-border bg-panel p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-sm font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                {i + 1}
              </div>
              <h3 className="mt-3 text-[15px] font-semibold">{s.t}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Who it&apos;s for
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { t: "Collectors", d: "Just want the mint — not to read hex or spot a fake domain at 2am." },
            { t: "Mods & founders", d: "Can't watch every link in the server 24/7. exSafe can." },
            { t: "The whole community", d: "One bad signature drains wallets and trust. Stop it before it spreads." },
          ].map((p) => (
            <div key={p.t} className="rounded-2xl border border-border bg-panel p-5">
              <h3 className="text-[15px] font-semibold text-emerald-400">{p.t}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6 text-center">
        <p className="text-[15px] font-medium">
          Crypto-native, Discord-first — built for the communities launching the
          next wave of NFTs.
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Also runs as a Discord bot that auto-scans links right in your server.
        </p>
      </section>

      <footer className="mt-12 border-t border-border pt-5 text-[12px] leading-relaxed text-muted">
        Sources: MetaMask eth-phishing-detect, GoPlus Security, Etherscan, RDAP,
        on-chain calldata decoding, and your community&apos;s own reports. exSafe
        surfaces risk signals — it is not financial advice, and no automated check
        is a guarantee of safety.
      </footer>
    </main>
  );
}
