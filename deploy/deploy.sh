#!/bin/bash
set -euo pipefail

# ============================================================
# LogoAI — Deploy Script (Ubuntu/Debian)
# ============================================================
# Usage:
#   git clone https://github.com/grisar/LogoAI-new.git /opt
#   cd /opt
#   bash deploy/deploy.sh
# ============================================================

REPO_DIR="/opt"
BACKEND_DIR="/opt/logoai-backend"
NODE_MAJOR=20

echo "=== LogoAI Deploy ==="

# ---------- 1. System packages ----------
echo "[1/7] Installing system packages..."
apt-get update
apt-get install -y curl gnupg2 ca-certificates lsb-release

# Node.js
if ! command -v node &>/dev/null; then
  echo "  Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v)  npm: $(npm -v)"

# PostgreSQL
if ! command -v psql &>/dev/null; then
  echo "  Installing PostgreSQL 16..."
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update
  apt-get install -y postgresql-16
fi

# Redis
if ! command -v redis-server &>/dev/null; then
  echo "  Installing Redis..."
  apt-get install -y redis-server
fi

# ---------- 2. PostgreSQL setup ----------
echo "[2/7] Setting up PostgreSQL..."
sudo -u postgres psql -lc "SELECT 1" >/dev/null 2>&1 || pg_ctlcluster 16 main start

DB_EXISTS=$(sudo -u postgres psql -lqt 2>/dev/null | grep -c "logoai" || true)
if [ "$DB_EXISTS" -eq 0 ]; then
  sudo -u postgres psql -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE DATABASE logoai OWNER postgres;" 2>/dev/null || true
  echo "  Database 'logoai' created."
else
  echo "  Database 'logoai' already exists."
fi

# ---------- 3. Redis ----------
echo "[3/7] Starting Redis..."
systemctl enable redis-server
systemctl start redis-server || systemctl restart redis-server

# ---------- 4. Backend npm install ----------
echo "[4/7] Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install

# ---------- 5. Prisma ----------
echo "[5/7] Running Prisma migrations..."
npx prisma generate
npx prisma db push

# ---------- 6. .env ----------
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "[6/7] Creating .env from .env.example..."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "  >>> EDIT $BACKEND_DIR/.env with real values (JWT_SECRET, CF_API_TOKEN, etc.)"
else
  echo "[6/7] .env already exists, skipping."
fi

# ---------- 7. Seed + Systemd ----------
echo "[7/7] Seeding DB & installing services..."

# Seed (only if empty)
USER_COUNT=$(sudo -u postgres psql -d logoai -tAc "SELECT COUNT(*) FROM \"User\";" 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ]; then
  npm run seed
  echo "  Database seeded."
else
  echo "  Database already has data, skipping seed."
fi

# Systemd units
cp "$REPO_DIR/deploy/logoai-backend.service" /etc/systemd/system/
cp "$REPO_DIR/deploy/logoai-frontend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable logoai-backend logoai-frontend

# Create uploads dir
mkdir -p "$BACKEND_DIR/uploads"

# Firewall
if command -v ufw &>/dev/null; then
  ufw allow 8080/tcp 2>/dev/null || true
fi

# Start services
systemctl restart logoai-backend
sleep 2
systemctl restart logoai-frontend

echo ""
echo "=== Deploy Complete ==="
echo "  Backend:  http://$(hostname -I | awk '{print $1}'):3000"
echo "  Frontend: http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "Commands:"
echo "  journalctl -u logoai-backend  -f   # backend logs"
echo "  journalctl -u logoai-frontend -f   # frontend logs"
echo "  systemctl restart logoai-backend    # restart backend"
echo "  systemctl restart logoai-frontend   # restart frontend"
