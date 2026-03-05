#!/usr/bin/env bash
source "$(dirname "$0")/_common.sh"

parse_flags -- "$@"
require_env
init_compose_args

if [ "$STAGING" = true ]; then
  info "Deploying STAGING stack (port $NGINX_PORT, tag $IMAGE_TAG)"
else
  info "Deploying PRODUCTION stack"
fi

info "Pulling latest images..."
docker compose "${COMPOSE_ARGS[@]}" pull

info "Starting services..."
docker compose "${COMPOSE_ARGS[@]}" up -d --remove-orphans

echo ""
info "Running containers:"
docker compose "${COMPOSE_ARGS[@]}" ps

echo ""
info "Deploy complete. Run migrations if this is a new release:"
echo "  ./infra/scripts/migrate.sh$(staging_suffix)"
