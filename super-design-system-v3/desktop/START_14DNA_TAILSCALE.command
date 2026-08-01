#!/bin/zsh
set -e
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "Node.js is required"; exit 1; }
command -v tailscale >/dev/null || { echo "Tailscale is required"; exit 1; }
[ -f .env ] || cp .env.example .env

echo "Running 14DNA-ENGINE production readiness check..."
node --env-file=.env scripts/readiness.mjs || {
  echo "Readiness check failed. Complete the actions above, then run this launcher again."
  exit 2
}

export DNA_BIND_HOST=127.0.0.1
PORT=$(node --env-file=.env -e "console.log(process.env.PORT||4314)")
node --env-file=.env server.mjs &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT INT TERM
sleep 2
tailscale serve --bg https / http://127.0.0.1:${PORT}
URL=$(tailscale status --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('https://'+j.Self.DNSName.replace(/\.$/,''))})")
echo "14DNA-ENGINE: $URL"
echo "Operations Console: $URL/admin.html"
echo "Quality Review: $URL/review.html"
wait $PID
