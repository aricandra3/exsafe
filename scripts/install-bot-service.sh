#!/usr/bin/env bash
# Host exSafe Discord bot as a user systemd service (boot-persistent via linger).
# Usage:
#   1) Put secrets in exsafe/.env.local  (never commit)
#   2) ./scripts/install-bot-service.sh
#   3) systemctl --user status exsafe-bot
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_PATH="$UNIT_DIR/exsafe-bot.service"
ENV_FILE="$ROOT/.env.local"

# Prefer project-local tsx + hermes/local node (systemd has a tiny PATH).
NODE_BIN="$(command -v node || true)"
if [[ -x "$HOME/.local/bin/node" ]]; then NODE_BIN="$HOME/.local/bin/node"; fi
if [[ -x "$HOME/.hermes/node/bin/node" ]]; then NODE_BIN="$HOME/.hermes/node/bin/node"; fi
TSX_BIN="$ROOT/node_modules/tsx/dist/cli.mjs"
if [[ ! -f "$TSX_BIN" ]]; then
  TSX_BIN="$ROOT/node_modules/.bin/tsx"
fi

cd "$ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >&2 <<EOF
Missing $ENV_FILE

Create it with at least:
  DISCORD_BOT_TOKEN=...
  DISCORD_CLIENT_ID=...
  DISCORD_GUILD_ID=...          # optional but recommended
  EXSAFE_API_URL=https://exsafe-mu.vercel.app

Then re-run: $0
EOF
  exit 1
fi

if [[ -z "${NODE_BIN}" || ! -x "${NODE_BIN}" ]]; then
  echo "node not found" >&2
  exit 1
fi
if [[ ! -e "$TSX_BIN" ]]; then
  echo "tsx not found at $TSX_BIN — run npm install first" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import sys
p = Path(".env.local")
vals = {}
for line in p.read_text().splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    vals[k.strip()] = v.strip().strip('"').strip("'")
need = ["DISCORD_BOT_TOKEN", "DISCORD_CLIENT_ID"]
missing = [k for k in need if not vals.get(k)]
if missing:
    print("Missing required keys:", ", ".join(missing), file=sys.stderr)
    sys.exit(1)
api = vals.get("EXSAFE_API_URL") or ""
if not api or "localhost" in api or "127.0.0.1" in api:
    print("WARN: EXSAFE_API_URL should point at production (e.g. https://exsafe-mu.vercel.app)", file=sys.stderr)
print("env ok:")
for k in sorted(vals):
    v = vals[k]
    print(f"  {k}: {'SET' if v else 'EMPTY'} (len={len(v)})")
cid = vals.get("DISCORD_CLIENT_ID", "")
if cid:
    perms = 1024 + 2048 + 16384 + 65536
    invite = (
        "https://discord.com/api/oauth2/authorize"
        f"?client_id={cid}&permissions={perms}&scope=bot%20applications.commands"
    )
    print("invite_url:", invite)
PY

if [[ ! -d node_modules ]]; then
  npm ci
fi

PATH_EXTRA="$(dirname "$NODE_BIN"):$HOME/.local/bin:$HOME/.hermes/node/bin:/usr/bin"

mkdir -p "$UNIT_DIR"
cat > "$UNIT_PATH" <<EOF
[Unit]
Description=exSafe Discord bot (Community Safety Desk)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
Environment=NODE_ENV=production
Environment=PATH=$PATH_EXTRA
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN $TSX_BIN bot/index.ts
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now exsafe-bot.service
sleep 3
systemctl --user --no-pager --full status exsafe-bot.service || true
echo
echo "Logs: journalctl --user -u exsafe-bot -n 50 --no-pager"
echo "Follow: journalctl --user -u exsafe-bot -f"
echo "Stop: systemctl --user stop exsafe-bot"
echo "Boot persistence: linger required (loginctl show-user \$USER -p Linger)"
