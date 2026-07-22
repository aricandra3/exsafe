# Deploying exSafe

Two pieces: the **web app + API** (deploy to Vercel) and the **Discord bot** (a
long-running process — run locally for the demo, or host it separately).

Steps marked **[you]** need your own accounts/credentials — I can't do those for
you. Everything else is already done in the repo.

---

## 1. Web app + API → Vercel

The app builds clean (`npm run build` passes) and Next.js is auto-detected by
Vercel — no `vercel.json` needed.

### Option A — Vercel CLI (fastest)
```bash
npm i -g vercel
cd exsafe
vercel            # [you] first run: log in + link the project
vercel --prod     # deploy to a production URL
```

### Option B — GitHub import
```bash
cd exsafe
git add -A && git commit -m "exSafe MVP"     # [you]
git remote add origin <your-repo-url>        # [you]
git push -u origin main                      # [you]
```
Then on vercel.com → **New Project** → import the repo → Deploy. **[you]**

### Environment variables (Vercel → Project → Settings → Environment Variables)
All optional — the app runs without them, but they unlock more:
| Var | Effect if set |
|---|---|
| `ANTHROPIC_API_KEY` | AI-written explanations + smarter announcement analysis |
| `ANTHROPIC_MODEL` | defaults to `claude-sonnet-5` |
| `ETHERSCAN_API_KEY` | verified-source + contract-age signals |
| `DEFAULT_CHAIN_ID` | defaults to `1` (Ethereum) |

> **Note on community reports:** the blocklist/allowlist store is file-backed.
> On Vercel (read-only serverless FS) new reports fall back to `/tmp` and won't
> persist across instances — fine for a demo. For production, swap
> `lib/community/store.ts` for a database (e.g. Vercel Postgres / Supabase). The
> seed list in `data/community.json` always works (it's read-only).

---

## 2. Discord bot

The bot is a persistent gateway connection, so it **can't run on Vercel**
(serverless). For the demo, the simplest path is to run it locally pointed at
your deployed API.

### Create the bot **[you]**
1. <https://discord.com/developers/applications> → **New Application**.
2. **Bot** tab → **Reset Token** → copy it → this is `DISCORD_BOT_TOKEN`.
3. **Bot** tab → enable **MESSAGE CONTENT INTENT** (required for auto-scan).
4. **General Information** → copy **Application ID** → this is `DISCORD_CLIENT_ID`.
5. Invite the bot: **OAuth2 → URL Generator** → scopes `bot` +
   `applications.commands`; bot permissions: **Send Messages**, **Embed Links**,
   **Read Message History**. Open the generated URL and add it to your server.
6. (Optional) copy your server id (**Developer Mode** → right-click server →
   Copy Server ID) → `DISCORD_GUILD_ID` (registers slash commands instantly).

### Run it
Put the values in `exsafe/.env.local`:
```
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...            # optional
EXSAFE_API_URL=https://<your-vercel-url>   # or http://localhost:3000 for local
```
Then:
```bash
cd exsafe
npm run bot
```
You should see `exSafe bot online as <name>`. Post `opensea-mint.net` in a
channel — the bot replies with a red verdict. Try `/check` and `/report` too.

### Hosting the bot 24/7 (VPS / systemd — recommended for demo)

Discord bots need a long-lived process (not Vercel serverless). On a Linux VPS
with systemd user linger:

```bash
cd exsafe
# .env.local must include:
#   DISCORD_BOT_TOKEN=...
#   DISCORD_CLIENT_ID=...
#   DISCORD_GUILD_ID=...   # optional
#   EXSAFE_API_URL=https://exsafe-mu.vercel.app
chmod +x scripts/install-bot-service.sh
./scripts/install-bot-service.sh
```

Checks:
```bash
systemctl --user status exsafe-bot
journalctl --user -u exsafe-bot -f
loginctl show-user "$USER" -p Linger   # must be yes
```

Also set on Vercel (web landing CTA):
```
NEXT_PUBLIC_DISCORD_INVITE=<oauth invite url printed by install script>
DEFAULT_CHAIN_ID=8453
```

### Other hosts
Railway / Render (Background Worker) / Fly.io also work. Start command:
`npm run bot`. Same env vars; `EXSAFE_API_URL` → Vercel production.

---

## Demo-day recommendation
Deploy the web app to Vercel (so judges get a live URL), and run the bot locally
against that URL during the presentation. Keep `DEMO.md`'s backup video ready in
case the venue Wi-Fi is flaky.
