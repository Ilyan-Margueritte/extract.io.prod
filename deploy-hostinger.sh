#!/bin/bash

# Extract.io - Automatic VPS Deployment Script for Hostinger
# This script installs Docker and starts the full SaaS stack with SSL.

echo "🚀 Starting Extract.io Deployment on VPS..."

# 1. Update and install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw

# 2. Install Docker if not installed
if ! [ -x "$(command -v docker)" ]; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# 3. Open Firewall Ports
echo "🛡️ Configuring Firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 4. Check for .env file
if [ ! -f .env ]; then
    echo "⚠️ Warning: .env file missing. Creating a template..."
    cat <<EOF > .env
DOMAIN=votre-domaine.com
EMAIL=votre-email@email.com
CLERK_PUBLIC_KEY=pk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
API_KEY_PEPPER=$(openssl rand -hex 16)
DB_USER=extract_admin
DB_PASSWORD=$(openssl rand -hex 12)
DB_NAME=extract_io
EOF
    echo "❌ ERROR: Please edit the .env file with your real keys and run this script again."
    exit 1
fi

# 5. Launch Infrastructure
echo "🚢 Launching Extract.io..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "--------------------------------------------------"
echo "🌍 Website: https://$(grep DOMAIN .env | cut -d '=' -f2)"
echo "--------------------------------------------------"
echo "Note: It might take a few minutes for the SSL certificate to be generated."
