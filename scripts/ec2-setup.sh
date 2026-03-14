#!/usr/bin/env bash
# =============================================================================
# EC2 Instance Setup Script
# Run once on a fresh EC2 instance (Amazon Linux 2023 or Ubuntu 22.04+)
# =============================================================================
set -euo pipefail

echo "=== Documenso EC2 Setup ==="

# --- Node.js 22 (system-wide via NodeSource) ---
echo "[Setup] Installing Node.js 22..."
if command -v apt-get &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs jq curl nginx ruby-full wget
elif command -v dnf &>/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
  sudo dnf install -y nodejs jq curl nginx ruby wget
elif command -v yum &>/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
  sudo yum install -y nodejs jq curl nginx ruby wget
fi

echo "Node: $(node -v), npm: $(npm -v)"

# --- System user ---
echo "[Setup] Creating documenso user..."
sudo useradd --system --shell /bin/bash --home-dir /opt/documenso --create-home documenso || true

# --- App directory ---
sudo mkdir -p /opt/documenso
sudo chown -R documenso:documenso /opt/documenso

# --- CodeDeploy Agent ---
echo "[Setup] Installing CodeDeploy agent..."
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo "eu-central-1")
wget -q "https://aws-codedeploy-${REGION}.s3.${REGION}.amazonaws.com/latest/install" -O /tmp/codedeploy-install
chmod +x /tmp/codedeploy-install
sudo /tmp/codedeploy-install auto
sudo systemctl enable codedeploy-agent
sudo systemctl start codedeploy-agent

# --- Nginx config ---
echo "[Setup] Configuring Nginx..."
sudo tee /etc/nginx/conf.d/documenso.conf > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINX

sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# --- NOTE: systemd service is installed during deploy, not here ---
# The service file lives in the repo at systemd/documenso-remix.service
# and gets copied to /etc/systemd/system/ by scripts/install-systemd-service.sh
# during the CodeDeploy BeforeStart hook.

echo "=== Setup complete ==="
echo "Instance is ready for CodeDeploy deployments."
