#!/usr/bin/env bash
# Diagnóstica y arregla las env vars de Vercel.
# Compara con apps/web/.env.local local y resetea las que falten o difieran.
#
# Uso:
#   VERCEL_TOKEN=vcp_xxx bash scripts/fix-vercel-env.sh

set -euo pipefail

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "✗ Falta VERCEL_TOKEN"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/web/.env.local"
cd "$REPO_ROOT/apps/web"

V() { npx vercel@latest "$@" --token "$VERCEL_TOKEN"; }

echo "→ Vars actuales en Vercel (production):"
V env ls production 2>&1 | grep -v "^Vercel CLI" | grep -v "^>" || true

echo ""
echo "→ Re-subiendo TODAS las vars desde $ENV_FILE (con feedback verbose)"
echo ""

# Lee el .env.local línea por línea
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue

  key="${line%%=*}"
  value="${line#*=}"
  [[ "$value" =~ ^\".*\"$ ]] && value="${value:1:-1}"
  [[ -z "$key" || "$key" == "$line" ]] && continue

  for env in production preview development; do
    # Borrar previa (sin error si no existe)
    V env rm "$key" "$env" --yes >/dev/null 2>&1 || true
    # Añadir con error visible
    if printf '%s' "$value" | V env add "$key" "$env" 2>&1 | grep -q "Added"; then
      echo "  ✓ $key → $env"
    else
      echo "  ✗ $key → $env (FALLÓ)"
    fi
  done
done < "$ENV_FILE"

echo ""
echo "→ Re-deploy a producción"
V --prod --yes 2>&1 | tail -3
