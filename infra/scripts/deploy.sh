#!/usr/bin/env bash
source "$(dirname "$0")/_common.sh"

parse_flags -- "$@"
require_env
init_compose_args

if [ "$STAGING" = true ]; then
  info "Deploying STAGING stack"
else
  info "Deploying PRODUCTION stack"
fi

info "Pulling latest images..."
# docker compose "${COMPOSE_ARGS[@]}" pull   # disabled — locally-tagged images preferred during Phase 1 cutover

info "Starting services..."
docker compose "${COMPOSE_ARGS[@]}" up -d --remove-orphans

echo ""
info "Running containers:"
docker compose "${COMPOSE_ARGS[@]}" ps

echo ""
info "Deploy complete. Run migrations if this is a new release:"
echo "  ./infra/scripts/migrate.sh$(staging_suffix)"
