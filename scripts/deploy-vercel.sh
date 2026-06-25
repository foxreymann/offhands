#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v vercel >/dev/null 2>&1; then
  VERCEL="npx vercel"
else
  VERCEL="vercel"
fi

if [ ! -f .env ]; then
  echo "Missing .env — copy from .env.example"
  exit 1
fi

# Load .env (skip comments)
set -a
source <(grep -v '^#' .env | grep -v '^$' | sed 's/^/export /')
set +a

echo "Deploying OffHands to Vercel..."
echo "Login first if needed: npx vercel login"

ENV_ARGS=()
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  ENV_ARGS+=("-e" "${key}=${value}")
done < <(grep -v '^#' .env | grep -v '^$')

$VERCEL deploy --prod --yes "${ENV_ARGS[@]}"

echo ""
echo "After deploy, update BASE_URL in Vercel dashboard to your production URL, then run:"
echo "  node scripts/setup-wassist.js"
