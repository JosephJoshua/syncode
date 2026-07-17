#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/Desktop/syncode-develop}"
SESSION="${SESSION:-syncode-website}"
TUNNEL_NAME="${TUNNEL_NAME:-deltawood}"
CLOUDFLARED_CONFIG="${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"
WEB_BIND_HOST="${WEB_BIND_HOST:-0.0.0.0}"
PREFERRED_INTERFACES="${PREFERRED_INTERFACES:-eth0 wlan0}"
TUNNEL_LOG="$APP_DIR/cloudflared.log"
APP_LOG="$APP_DIR/app.log"
AI_WORKER_LOG="$APP_DIR/ai-worker.log"
STARTUP_LOG="$APP_DIR/startup.log"

detect_default_interface() {
  ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "dev") {print $(i + 1); exit}}'
}

interface_ipv4() {
  local iface="$1"
  [ -n "$iface" ] || return 0
  ip -4 -o addr show dev "$iface" scope global 2>/dev/null | awk '{split($4, a, "/"); print a[1]; exit}'
}

wait_for_network() {
  local attempt iface address candidate

  for attempt in $(seq 1 90); do
    iface="$(detect_default_interface || true)"
    if [ -n "$iface" ]; then
      address="$(interface_ipv4 "$iface")"
      if [ -n "$address" ]; then
        printf '[%s] Network ready on %s (%s) via default route\n' "$(date -Is)" "$iface" "$address"
      else
        printf '[%s] Network ready on %s via default route\n' "$(date -Is)" "$iface"
      fi
      ACTIVE_INTERFACE="$iface"
      ACTIVE_ADDRESS="$address"
      return 0
    fi

    for candidate in $PREFERRED_INTERFACES; do
      if ip -4 -o addr show dev "$candidate" scope global 2>/dev/null | grep -q .; then
        address="$(interface_ipv4 "$candidate")"
        printf '[%s] Network ready on %s (%s) before default route settled\n' "$(date -Is)" "$candidate" "$address"
        ACTIVE_INTERFACE="$candidate"
        ACTIVE_ADDRESS="$address"
        return 0
      fi
    done

    printf '[%s] Waiting for network on one of: %s\n' "$(date -Is)" "$PREFERRED_INTERFACES"
    sleep 2
  done

  printf '[%s] No default network route found after waiting\n' "$(date -Is)"
  return 1
}

ensure_cloudflared_config() {
  mkdir -p "$HOME/.cloudflared"
  cat > "$CLOUDFLARED_CONFIG" <<EOF
 tunnel: a421a60d-edaf-4992-a9b6-71b551191547
 credentials-file: /home/cybercraze/.cloudflared/a421a60d-edaf-4992-a9b6-71b551191547.json
 ingress:
   - hostname: deltawood.my
     service: http://localhost:5173
   - hostname: collab.deltawood.my
     service: http://localhost:3001
   - service: http_status:404
EOF
}

wait_for_container_health() {
  local container="$1"
  local status=""
  for attempt in $(seq 1 90); do
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      printf '[%s] %s is %s\n' "$(date -Is)" "$container" "$status"
      return 0
    fi
    printf '[%s] Waiting for %s, current status: %s\n' "$(date -Is)" "$container" "${status:-missing}"
    sleep 2
  done
  printf '[%s] %s did not become healthy in time\n' "$(date -Is)" "$container"
  docker logs --tail 80 "$container" 2>&1 || true
  return 1
}

ACTIVE_INTERFACE=""
ACTIVE_ADDRESS=""
wait_for_network >> "$STARTUP_LOG" 2>&1
ensure_cloudflared_config

cd "$APP_DIR"
export PATH="$APP_DIR/analysis-tools/bin:$PATH"
export HOST="$WEB_BIND_HOST"
export VITE_HOST="$WEB_BIND_HOST"
export SYNCODE_NETWORK_INTERFACE="$ACTIVE_INTERFACE"
export SYNCODE_NETWORK_ADDRESS="$ACTIVE_ADDRESS"

{
  printf '[%s] Active network interface: %s (%s)\n' "$(date -Is)" "${ACTIVE_INTERFACE:-unknown}" "${ACTIVE_ADDRESS:-no IPv4}"
  printf '[%s] Binding web dev service on %s for wlan0/eth0 compatibility\n' "$(date -Is)" "$WEB_BIND_HOST"
  printf '[%s] Starting Docker backend services\n' "$(date -Is)"
  docker-compose -f docker-compose.yml up -d
  wait_for_container_health syncode-postgres
  wait_for_container_health syncode-redis
  wait_for_container_health syncode-seaweedfs
  wait_for_container_health syncode-livekit
  printf '[%s] Running database migrations\n' "$(date -Is)"
  pnpm db:migrate
} >> "$STARTUP_LOG" 2>&1

tmux has-session -t "$SESSION" 2>/dev/null && tmux kill-session -t "$SESSION"
if pgrep -f 'src/livekit/ai-interviewer.worker.bootstrap.ts dev' >/dev/null 2>&1; then
  pkill -TERM -f 'src/livekit/ai-interviewer.worker.bootstrap.ts dev' || true
  sleep 2
fi
: > "$TUNNEL_LOG"
: > "$APP_LOG"
: > "$AI_WORKER_LOG"
tmux new-session -d -s "$SESSION" -n app "cd '$APP_DIR' && HOST='$WEB_BIND_HOST' VITE_HOST='$WEB_BIND_HOST' SYNCODE_NETWORK_INTERFACE='$ACTIVE_INTERFACE' SYNCODE_NETWORK_ADDRESS='$ACTIVE_ADDRESS' PATH='$APP_DIR/analysis-tools/bin:$PATH' pnpm dev 2>&1 | tee -a '$APP_LOG'"
tmux split-window -t "$SESSION":0 -h "cd '$APP_DIR' && cloudflared tunnel --config '$CLOUDFLARED_CONFIG' --no-autoupdate run '$TUNNEL_NAME' 2>&1 | tee -a '$TUNNEL_LOG'"
tmux split-window -t "$SESSION":0 -v "cd '$APP_DIR' && HOST='$WEB_BIND_HOST' VITE_HOST='$WEB_BIND_HOST' SYNCODE_NETWORK_INTERFACE='$ACTIVE_INTERFACE' SYNCODE_NETWORK_ADDRESS='$ACTIVE_ADDRESS' PATH='$APP_DIR/analysis-tools/bin:$PATH' pnpm --filter @syncode/ai-plane dev:ai-interviewer-worker 2>&1 | tee -a '$AI_WORKER_LOG'"
tmux select-layout -t "$SESSION":0 tiled
printf 'Started tmux session %s with tunnel %s on %s (%s)\n' "$SESSION" "$TUNNEL_NAME" "${ACTIVE_INTERFACE:-unknown}" "${ACTIVE_ADDRESS:-no IPv4}"
