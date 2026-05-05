#!/usr/bin/env bash
# Deploy completo de Poker Coins a Vercel.
#
# Uso:
#   VERCEL_TOKEN=vcp_xxx bash scripts/deploy-vercel.sh
#
# Lee los secretos de apps/web/.env.local (que NO está en git) y los
# sube a Vercel como env vars de Production + Preview + Development.
# Luego hace deploy a producción.

set -euo pipefail

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "✗ Falta VERCEL_TOKEN. Uso: VERCEL_TOKEN=vcp_xxx bash $0"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/web/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ No existe $ENV_FILE — necesito los secretos de Supabase y Firebase."
  exit 1
fi

cd "$REPO_ROOT/apps/web"

V() { npx vercel@latest "$@" --token "$VERCEL_TOKEN"; }

echo "→ Linkeando proyecto en Vercel (poker-coins)"
V link --yes --project poker-coins >/dev/null 2>&1 || \
  V link --yes >/dev/null

echo "→ Subiendo env vars a Production + Preview + Development"

# Leer cada KEY=VALUE del .env.local y subirlo
# Maneja valores entre comillas y multilinea (la private key)
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comentarios y líneas vacías
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue

  key="${line%%=*}"
  value="${line#*=}"
  # Quita comillas envolventes si las hay
  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:-1}"
  fi

  # Skip si la línea no parece KEY=VALUE
  [[ -z "$key" || "$key" == "$line" ]] && continue

  echo "   · $key"
  # Borrar previa (silencioso, ignora errores) y volver a setear
  for env in production preview development; do
    printf '%s' "$value" | V env rm "$key" "$env" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | V env add "$key" "$env" >/dev/null 2>&1 || \
      echo "     ⚠ no se pudo setear en $env"
  done
done < "$ENV_FILE"

echo "→ Deploy a producción"
URL=$(V --prod --yes 2>&1 | tail -1)
echo ""
echo "✓ Deploy listo:"
echo "  $URL"
echo ""
echo "Siguiente paso: añadir el dominio a Firebase Authorized domains:"
echo "  https://console.firebase.google.com/project/pokercoins-7828c/authentication/settings"
