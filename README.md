# 🛡️ exSafe — NFT Community Safety Desk

**Check it before you sign it.** exSafe gives NFT communities one clear verdict —
🟢 **SAFE** / 🟡 **CAUTION** / 🔴 **DANGER** — on any link, contract address,
transaction, signature request, or suspicious announcement, *before* a member
connects a wallet or signs.

Wallet drainers steal hundreds of millions of dollars a year (see Scam Sniffer's
annual reports for the latest figure). Most of it happens through one bad
signature — a `setApprovalForAll`, a `Permit`, a fake mint link posted in a
Discord that got hijacked. Wallets like MetaMask show you almost nothing useful
at that moment. exSafe does.

---

## What it does

One **verdict engine** ("the brain"), exposed through the places communities
actually are:

| Surface | What it does |
|---|---|
| **Web app** | Paste anything → clear verdict card with a plain-language explanation and a transparent signal checklist. |
| **Discord bot** | Auto-scans every link/address posted in a channel and replies with a verdict. `/check` and `/report` slash commands. |
| **`/api/check`** | The shared brain any surface (or your own tool) can call. |

It understands four kinds of input, auto-detected:

- **Links** — phishing blocklist (MetaMask's live `eth-phishing-detect`),
  typosquat / look-alike detection, domain age, community lists.
- **Contracts / addresses** — GoPlus reputation (phishing, drainer, honeypot,
  hidden owner…), Etherscan verified-source + contract age.
- **Transactions & signatures (the flex)** — decodes `setApprovalForAll`,
  `approve`, `permit`, Permit2 and Seaport signatures into plain English, and
  **cross-checks the address receiving the permission** against reputation feeds.
  "This gives `0x00…dbad` permission to transfer EVERY NFT you own — and that
  address has been reported as a drainer."
- **Announcements** — Claude flags social-engineering tactics (false urgency,
  "we got hacked, use this new link", claim/airdrop bait) and checks every link
  inside.

### The community wedge

Other tools are individual browser extensions. exSafe is a **community safety
desk**: mods verify official links (allowlist), members report scams (blocklist),
and every verdict is scoped to *your* community (Discord guild). The bot lives
where your members already are — no install required.

---

## Architecture — one brain, many doors

```
                 detect → checkers → score → narrate (Claude)
                 ┌───────────────────────────────────────────┐
  web app  ─────▶│  lib/engine/runCheck()                     │
  discord  ─────▶│    ├─ checkers/url        (phishing, RDAP) │
  /api     ─────▶│    ├─ checkers/contract   (GoPlus, scan)   │
                 │    ├─ checkers/calldata   (viem decode)    │
                 │    ├─ checkers/announcement (Claude)       │
                 │    └─ community/store     (allow/blocklist)│
                 └───────────────────────────────────────────┘
```

Everything **degrades gracefully**: with zero API keys the app still runs
(GoPlus, phishing list, RDAP and the community layer need no key; Claude falls
back to deterministic narration; Etherscan signals are simply skipped and noted).

---

## Quickstart

```bash
npm install
cp .env.example .env.local   # optional — the app runs without any keys

# 1) Web app + API
npm run dev                  # http://localhost:3000

# 2) Discord bot (needs a bot token — see .env.example)
npm run bot
```

Try the buttons on the homepage, or:

```bash
curl -s localhost:3000/api/check -H 'content-type: application/json' \
  -d '{"input":"opensea-mint.net"}'
```

### Discord setup

1. Create an app at <https://discord.com/developers/applications>.
2. **Bot** tab → enable **Message Content Intent** (required for auto-scan).
3. Invite with scopes `bot` + `applications.commands` (perms: Send Messages,
   Embed Links).
4. Put the token/client id (and optionally a guild id) in `.env.local`, then
   `npm run bot`.

---

## API

`POST /api/check`

```jsonc
// request
{ "input": "0x...", "chainId": "1", "community": "guild-123", "lang": "en" }
// response
{ "verdict": "DANGER", "score": 100, "kind": "calldata",
  "summary": "...", "explanation": "...", "recommendation": "...",
  "signals": [{ "label": "...", "severity": "danger", "detail": "...", "source": "GoPlus" }],
  "meta": { "chainName": "Ethereum", "checkedAt": "...", "degraded": [], "aiNarrated": true } }
```

`POST /api/report` → `{ "value": "scam.xyz", "type": "domain", "list": "block", "community": "guild-123" }`

---

## Data sources

MetaMask [eth-phishing-detect](https://github.com/MetaMask/eth-phishing-detect) ·
[GoPlus Security](https://gopluslabs.io) · [Etherscan](https://etherscan.io/apis) ·
[RDAP](https://rdap.org) · on-chain calldata decoding via
[viem](https://viem.sh) · your community's own reports.

## Limitations

exSafe surfaces risk signals; it is **not financial advice**, and no automated
check is a guarantee of safety. Absence of a signal is not proof something is
safe. RDAP does not cover every TLD (e.g. `.io`). The community store is a
file-backed MVP — swap it for a database for multi-instance persistence.

## Roadmap

- Full transaction simulation (Tenderly / Alchemy) showing exact asset outflow
- MetaMask Snap for in-wallet insights at signing time
- Persistent DB + mod dashboard for the community desk
- Browser extension companion
