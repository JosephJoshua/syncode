#!/usr/bin/env bash
source "$(dirname "$0")/_common.sh"

parse_flags -- "$@"
require_env
init_compose_args

if [ "$STAGING" = true ]; then
  info "Running migrations against STAGING stack"
else
  info "Running migrations against PRODUCTION stack"
fi

if ! docker compose "${COMPOSE_ARGS[@]}" ps control-plane --format '{{.State}}' 2>/dev/null | grep -qi "running"; then
  error "control-plane container is not running."
  error "Start it first with: ./infra/scripts/deploy.sh$(staging_suffix)"
  exit 1
fi

info "Running database migrations..."
docker compose "${COMPOSE_ARGS[@]}" exec control-plane node migrate.mjs

info "Migrations complete."
