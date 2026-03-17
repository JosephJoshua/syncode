#!/usr/bin/env sh
# Loads ../../.env if it exists, then runs the given command.
# Usage: ./load-env.sh drizzle-kit studio
if [ -f ../../.env ]; then
  set -a
  . ../../.env
  set +a
fi
exec "$@"
