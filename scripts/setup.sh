#!/usr/bin/env bash
# One-time setup + deploy, run on your own machine (Forge needs to reach
# atlassian.net with your credentials). Safe to re-run: later runs just
# redeploy and upgrade the install.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE="${FORGE_SITE:-coreyellisdeveloper.atlassian.net}"

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [[ "$node_major" != "22" && "$node_major" != "24" ]]; then
  echo "Forge needs Node 22.x or 24.x (found: $(node -v 2>/dev/null || echo none)). Install one, then re-run." >&2
  exit 1
fi

command -v forge >/dev/null || npm install -g @forge/cli

# Credentials: env vars from .env.forge (gitignored) if present, else `forge login`.
if [[ -f .env.forge ]]; then
  set -a; source .env.forge; set +a
else
  forge whoami >/dev/null 2>&1 || forge login
fi
forge settings set usage-analytics false >/dev/null 2>&1 || true

npm install --no-audit --no-fund

# First run only: registers the app under your account and writes app.id into manifest.yml.
if ! grep -qE '^\s+id:\s' manifest.yml; then
  forge register "Space Admins Macro"
fi

forge lint
forge deploy --environment development --non-interactive

if forge install list 2>/dev/null | grep -q "$SITE"; then
  forge install --upgrade --environment development --site "$SITE" --product confluence --non-interactive
else
  forge install --environment development --site "$SITE" --product confluence --non-interactive
fi

echo
echo "Done. Edit any Confluence page on https://$SITE, type /space admins, insert the macro, and publish."
