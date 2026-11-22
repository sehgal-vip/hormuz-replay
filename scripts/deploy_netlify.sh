#!/usr/bin/env bash
# Deploy the replay to Netlify (free plan), with chat through OpenRouter.
#   First time: npx netlify-cli login   (opens your browser; you sign in)
#   Then:       bash scripts/deploy_netlify.sh
# The OpenRouter key is read from .env (OPENROUTER_API_KEY=...) and stored as a Netlify
# environment variable. It is never written into the site or sent to the browser.
set -euo pipefail
cd "$(dirname "$0")/.."
NL="npx -y netlify-cli@latest"
# Log in with a personal access token from .env if there is one (no browser handshake needed).
TOKEN=$(grep -E '^NETLIFY_AUTH_TOKEN=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
[ -n "$TOKEN" ] && export NETLIFY_AUTH_TOKEN="$TOKEN"

uv run -q scripts/build_netlify.py

# Link this folder to a Netlify site the first time (creates one named what-the-hormuz-<random>).
if [ ! -f .netlify/state.json ]; then
  $NL sites:create --name "what-the-hormuz-$RANDOM" --disable-linking >/tmp/nl_site.txt 2>&1 || true
  SITE_ID=$(grep -Eo '[0-9a-f]{8}-[0-9a-f-]{27}' /tmp/nl_site.txt | head -1)
  [ -n "$SITE_ID" ] || { cat /tmp/nl_site.txt; echo "Could not create the site."; exit 1; }
  $NL link --id "$SITE_ID"
fi

KEY=$(grep -E '^OPENROUTER_API_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
MODEL=$(grep -E '^OPENROUTER_MODEL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
if [ -n "$KEY" ]; then
  $NL env:set OPENROUTER_API_KEY "$KEY" --force >/dev/null && echo "Chat key set on Netlify."
else
  echo "No OPENROUTER_API_KEY in .env: the site deploys, and chat says it is off."
fi
[ -n "$MODEL" ] && $NL env:set OPENROUTER_MODEL "$MODEL" --force >/dev/null

$NL deploy --prod --dir app --functions netlify/functions --skip-functions-cache
