# exSafe — Demo Script (≈ 3 minutes)

> Goal: make the judges *feel* the before/after. One visceral moment beats five
> features. Rehearse this until it's muscle memory.

## Setup (before you present)
- `npm run dev` running → homepage open at `localhost:3000`.
- (Optional but great) `npm run bot` running, with a test Discord server open
  side-by-side.
- Add `ANTHROPIC_API_KEY` to `.env.local` so the explanations are AI-written
  (the "✨ AI explained" badge shows). Everything still works without it.
- **Record a backup screen-capture of this exact run** in case the venue Wi-Fi
  or an API is down live. The homepage examples are deterministic, so the video
  will match.

## The hook (15s)
> "Wallet drainers steal hundreds of millions a year, and almost all of it comes
> down to one bad signature or one fake link in a Discord. Your wallet shows you
> a wall of hex and asks 'Sign?'. exSafe is the safety desk that reads it for
> your whole community — *before* anyone signs."

## Beat 1 — the drainer, before/after (45s)  ← the money shot
1. (If you can) show a real `setApprovalForAll` in MetaMask first: it says almost
   nothing a normal person understands.
2. On exSafe, click **Drainer approval**.
3. Read the verdict out loud:
   > 🔴 **DANGER — Grants access to ALL your NFTs.** "This gives `0x00…dbad`
   > permission to transfer *every* NFT you own — and that address has been
   > reported as a drainer by the community."
4. Land it: *"MetaMask showed hex. exSafe decoded the transaction **and**
   recognised the attacker's address. That's the difference between losing your
   Apes and closing the tab."*

## Beat 2 — links & look-alikes (30s)
- Click **Official site** (`opensea.io`) → 🟢 SAFE, verified by MetaMask's list +
  the community allowlist.
- Click **Fake mint page** (`opensea-mint.net`) → 🔴 DANGER. Point out it's on
  MetaMask's *real* live phishing blocklist **and** the community's blocklist.
- Click **Look-alike domain** (`0pensea.io`) → flagged as a typosquat of
  opensea.io. *"A member would never spot the zero at 2am. exSafe does."*

## Beat 3 — announcements (25s)
- Click **Scam announcement**.
- 🔴 DANGER — it lists the manipulation tactics (false urgency, "we got hacked,
  use this new link", claim bait) **and** caught the drainer link buried in the
  text. Toggle **ID** to show the same explanation in Bahasa Indonesia.

## Beat 4 — the wedge: the Discord bot (30s)
- In your test Discord, paste `opensea-mint.net`. The bot **auto-replies** with
  the red verdict card — no command needed.
- Run `/report value: scam-xyz.com type: domain`, then paste that link again →
  the bot now warns on it. *"Members protect members. The desk gets smarter every
  day, and it lives where the community already is — nothing to install."*

## Close (15s)
> "One brain, many doors: web, Discord, and an API. It reads real threat feeds —
> MetaMask, GoPlus, Etherscan — decodes the actual transaction, and adds a
> community layer no browser extension has. exSafe: check it before you sign it."

---

## Expected verdicts (sanity check before you present)
| Example | Verdict | Why |
|---|---|---|
| `opensea.io` | 🟢 SAFE | community allowlist + MetaMask allowlist |
| `opensea-mint.net` | 🔴 DANGER | MetaMask blocklist + community blocklist |
| `0pensea.io` | 🔴 DANGER | typosquat of opensea.io |
| Drainer approval | 🔴 DANGER | setApprovalForAll + recipient flagged |
| Scam announcement | 🔴 DANGER | tactics + embedded blocklisted link |

## Judge Q&A prep
- **"How is this different from Blockaid / Wallet Guard?"** Those are individual
  browser extensions. exSafe is community-operated (per-server allow/blocklists,
  the bot in the channel) and decodes signatures with a plain-language,
  bilingual explanation. Distribution is the wedge: we live in Discord.
- **"Is the data real?"** Yes — live MetaMask eth-phishing-detect feed, GoPlus,
  Etherscan, RDAP, on-chain decoding with viem. Only the seed community reports
  are sample data.
- **"What's next?"** Full transaction simulation (asset outflow), a MetaMask
  Snap for in-wallet warnings, and a persistent mod dashboard.
