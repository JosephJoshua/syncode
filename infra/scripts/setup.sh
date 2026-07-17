#!/usr/bin/env bash
source "$(dirname "$0")/_common.sh"

info "Checking prerequisites..."

missing=()
for cmd in docker git; do
  if ! command -v "$cmd" &>/dev/null; then
    missing+=("$cmd")
  fi
done

if ! docker compose version &>/dev/null; then
  missing+=("docker compose (v2 plugin)")
fi

if [ ${#missing[@]} -gt 0 ]; then
  error "Missing required tools: ${missing[*]}"
  error "Please install them before running setup."
  exit 1
fi

info "All prerequisites found."

echo ""
info "Logging in to GitHub Container Registry (ghcr.io)..."
echo "  You need a GitHub Personal Access Token with read:packages scope."
echo ""

read -rp "GitHub username: " GH_USER
read -rsp "GitHub PAT (read:packages): " GH_PAT
echo ""

echo "$GH_PAT" | docker login ghcr.io -u "$GH_USER" --password-stdin
info "GHCR login successful."

echo ""
if [ ! -f "$REPO_ROOT/.env" ]; then
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
  warn ".env created from .env.example. Edit it with your production values before deploying."
else
  info ".env already exists, skipping."
fi

chmod +x "$REPO_ROOT"/infra/scripts/*.sh
info "Scripts marked executable."

echo ""
info "Setup complete. Next steps:"
echo "  1. Edit .env with production values"
echo "  2. Run: ./infra/scripts/deploy.sh"
echo "  3. Run: ./infra/scripts/migrate.sh"
