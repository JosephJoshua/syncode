#!/usr/bin/env bash
# First-time setup for the proxy VPS (Caddy reverse proxy).
# Run as root on a fresh Debian/Ubuntu server.

source "$(dirname "$0")/_common.sh"

CADDY_DIR="$REPO_ROOT/infra/caddy"

if [ "$(id -u)" -ne 0 ]; then
  error "This script must be run as root."
  echo "  sudo $0"
  exit 1
fi

info "Starting proxy VPS setup..."

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  info "Docker already installed, skipping."
else
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  info "Docker installed."
fi

if command -v ufw &>/dev/null; then
  info "Configuring firewall (ufw)..."
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 80/tcp    # HTTP (redirects + health)
  ufw allow 443/tcp   # HTTPS
  ufw allow 443/udp   # HTTP/3 QUIC
  ufw --force enable
  info "Firewall configured."
else
  warn "ufw not found. Skipping firewall setup. Configure manually."
fi

if [ -f "$CADDY_DIR/.env" ]; then
  info ".env already exists at $CADDY_DIR/.env, skipping."
else
  echo ""
  info "Configure environment variables:"
  echo ""

  read -rp "  Domain (e.g. syncode.anggita.org): " DOMAIN
  read -rp "  ACME email (e.g. admin@example.com): " ACME_EMAIL
  read -rp "  Origin host IP: " ORIGIN_HOST
  read -rp "  Origin port — production [4443]: " ORIGIN_PORT_PROD
  ORIGIN_PORT_PROD="${ORIGIN_PORT_PROD:-4443}"
  read -rp "  Origin port — staging [4444]: " ORIGIN_PORT_STAGING
  ORIGIN_PORT_STAGING="${ORIGIN_PORT_STAGING:-4444}"

  cat > "$CADDY_DIR/.env" <<EOF
DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL
ORIGIN_HOST=$ORIGIN_HOST
ORIGIN_PORT_PROD=$ORIGIN_PORT_PROD
ORIGIN_PORT_STAGING=$ORIGIN_PORT_STAGING
EOF

  info ".env written to $CADDY_DIR/.env"
fi

SYSCTL_CONF="/etc/sysctl.d/99-syncode-proxy.conf"

info "Applying kernel tuning ($SYSCTL_CONF)..."
cat > "$SYSCTL_CONF" <<'EOF'
# SynCode proxy VPS tuning

# Connection tracking capacity
net.netfilter.nf_conntrack_max = 131072
net.core.somaxconn = 65535

# TCP keep-alive for long-lived WebSocket connections
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 30

# Port exhaustion prevention
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535

# UDP buffers for HTTP/3 QUIC
net.core.rmem_max = 2500000
net.core.wmem_max = 2500000
EOF

if sysctl --system &>/dev/null; then
  info "Kernel parameters applied."
else
  warn "sysctl failed (some VPS providers restrict kernel params). Non-fatal, continuing."
fi

if command -v apt-get &>/dev/null; then
  info "Installing unattended-upgrades..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades > /dev/null
  info "Unattended security upgrades enabled."
else
  warn "apt-get not found — skipping unattended-upgrades. Install manually if not Debian/Ubuntu."
fi

info "Starting Caddy..."
docker compose -f "$CADDY_DIR/docker-compose.yml" --env-file "$CADDY_DIR/.env" up -d
info "Caddy is running."

# ── Summary ──────────────────────────────────────────────────────────
echo ""
info "========================================="
info "  Proxy VPS setup complete"
info "========================================="
echo ""
echo "  Useful commands:"
echo "    docker compose -f $CADDY_DIR/docker-compose.yml logs -f"
echo "    docker compose -f $CADDY_DIR/docker-compose.yml restart"
echo "    docker compose -f $CADDY_DIR/docker-compose.yml down"
echo ""
echo "  Verify TLS:"
echo "    curl -I https://\$(grep DOMAIN $CADDY_DIR/.env | cut -d= -f2)/health"
echo ""
echo "  IMPORTANT: On the origin server, narrow set_real_ip_from in"
echo "  infra/nginx/nginx.conf (line 32) to this VPS's public IP."
echo ""
