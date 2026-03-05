#!/usr/bin/env bash
source "$(dirname "$0")/_common.sh"

parse_flags --volumes -- "$@"
init_compose_args

if [ "$STAGING" = true ]; then
  info "Tearing down STAGING stack"
else
  info "Tearing down PRODUCTION stack"
fi

if [ "$VOLUMES" = true ]; then
  warn "This will DELETE all data volumes (postgres, redis, seaweedfs)!"
  read -rp "Type 'yes' to confirm: " confirm
  if [ "$confirm" != "yes" ]; then
    info "Aborted."
    exit 0
  fi
  docker compose "${COMPOSE_ARGS[@]}" down -v
  info "Stack stopped and volumes removed."
else
  docker compose "${COMPOSE_ARGS[@]}" down
  info "Stack stopped. Data volumes preserved."
  echo "  To also remove volumes: $0 --volumes$(staging_suffix)"
fi
