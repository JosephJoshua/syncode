#!/usr/bin/env bash
# Usage: source "$(dirname "$0")/_common.sh"

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Flag parsing
STAGING=false

# parse_flags [allowed_extra_flags...] -- "$@"
# Example: parse_flags --volumes -- "$@"
parse_flags() {
  local allowed=()
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do
    allowed+=("$1")
    shift
  done
  shift # consume --

  # Initialize extra flags to false to avoid set -u errors
  local varname
  for f in "${allowed[@]}"; do
    varname=$(echo "${f#--}" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
    eval "$varname=false"
  done

  local usage_flags="[--staging]"
  for f in "${allowed[@]}"; do
    usage_flags+=" [$f]"
  done

  for arg in "$@"; do
    case "$arg" in
      --staging) STAGING=true ;;
      *)
        local matched=false
        for f in "${allowed[@]}"; do
          if [ "$arg" = "$f" ]; then
            varname=$(echo "${arg#--}" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
            eval "$varname=true"
            matched=true
            break
          fi
        done
        if [ "$matched" = false ]; then
          error "Unknown flag: $arg"
          echo "Usage: $0 $usage_flags"
          exit 1
        fi
        ;;
    esac
  done
}

# Sets: COMPOSE_ARGS array
# Requires: STAGING to be set (call parse_flags first)
COMPOSE_ARGS=()

init_compose_args() {
  COMPOSE_ARGS=("-f" "$REPO_ROOT/docker-compose.prod.yml")

  local env_file
  if [ "$STAGING" = true ]; then
    env_file="$REPO_ROOT/.env.staging"
    COMPOSE_ARGS+=("-p" "syncode-staging")
  else
    env_file="$REPO_ROOT/.env.production"
  fi

  if [ ! -f "$env_file" ]; then
    error "$env_file not found"
    error "Run setup.sh and populate it with environment-specific secrets."
    exit 1
  fi

  COMPOSE_ARGS+=("--env-file" "$env_file")
}

# Other helpers
require_env() {
  local file
  if [ "$STAGING" = true ]; then
    file="$REPO_ROOT/.env.staging"
  else
    file="$REPO_ROOT/.env.production"
  fi
  if [ ! -f "$file" ]; then
    error "$file not found. Run setup.sh first:"
    echo "  ./infra/scripts/setup.sh"
    exit 1
  fi
}

staging_suffix() {
  [ "$STAGING" = true ] && echo " --staging" || true
}
