import { Desk } from "./desk";

/** Public OAuth invite — not a secret. Override with NEXT_PUBLIC_DISCORD_INVITE. */
const DEFAULT_DISCORD_INVITE =
  "https://discord.com/api/oauth2/authorize?client_id=1529493429988491324&permissions=84992&scope=bot%20applications.commands";

const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE || DEFAULT_DISCORD_INVITE;
const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/aricandra3/exsafe";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10 sm:py-14">
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-lg ring-1 ring-emerald-500/30">
            🛡️
          </div>
          <span className="text-xl font-semibold tracking-tight">
            ex<span className="text-emerald-400">Safe</span>
          </span>
          <span className="rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] font-medium text-muted">
            Community Safety Desk
          </span>
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
            Base-first
          </span>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#4752c4]"
          >
            <DiscordGlyph />
            Add to Discord
          </a>
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
              d: "Safe, caution, or danger — in plain language, with exactly what to do next. Share the result with one link.",
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

      <section className="mt-10 rounded-2xl border border-[#5865F2]/35 bg-[#5865F2]/[0.08] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-md">
            <h2 className="text-[15px] font-semibold">Discord-native safety desk</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Auto-scans links and addresses in your server.{" "}
              <code className="rounded bg-panel-2 px-1 py-0.5 text-[12px]">/check</code> on
              demand,{" "}
              <code className="rounded bg-panel-2 px-1 py-0.5 text-[12px]">/report</code> to
              grow the community blocklist. Same brain as the web app — scoped per guild.
            </p>
            <p className="mt-2 text-[12px] text-muted">
              Live bot: <span className="text-foreground">exSafe#1303</span> · points at the
              production API.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-lg shadow-[#5865F2]/25 transition hover:bg-[#4752c4]"
            >
              <DiscordGlyph />
              Add to Discord
            </a>
            <a
              href={`${GITHUB_URL}#discord-setup`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-[12px] text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Setup guide
            </a>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6 text-center">
        <p className="text-[15px] font-medium">
          Crypto-native, Discord-first — built for communities launching on Base and beyond.
        </p>
        <p className="mt-1 text-[13px] text-muted">
          One engine. Web, Discord, and API. Wave 1 founder track — Vibeathon.
        </p>
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#4752c4]"
        >
          <DiscordGlyph />
          Add exSafe to your server
        </a>
      </section>

      <footer className="mt-12 border-t border-border pt-5 text-[12px] leading-relaxed text-muted">
        <p>
          Sources: MetaMask eth-phishing-detect, GoPlus Security, Etherscan, RDAP,
          on-chain calldata decoding, and your community&apos;s own reports. exSafe
          surfaces risk signals — it is not financial advice, and no automated check
          is a guarantee of safety.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Discord bot
          </a>
          <a href="/?demo=judge" className="hover:text-foreground">
            Judge demo
          </a>
          <a href="/api/check" className="hover:text-foreground">
            API
          </a>
        </p>
      </footer>
    </main>
  );
}

function DiscordGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
