#!/bin/bash
# ============================================================
# Extract.io - Docker Hub Build & Push Script
# Usage: ./publish.sh [your_dockerhub_username]
# ============================================================

set -e

DOCKERHUB_USER="${1:-lerapt0r}"
VERSION="${2:-latest}"
BACKEND_IMAGE="$DOCKERHUB_USER/extract-io-backend:$VERSION"
FRONTEND_IMAGE="$DOCKERHUB_USER/extract-io-frontend:$VERSION"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Extract.io - Docker Publisher      ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Dockerhub user : $DOCKERHUB_USER"
echo "  Backend image  : $BACKEND_IMAGE"
echo "  Frontend image : $FRONTEND_IMAGE"
echo ""

# --- Login (direct credential prompt, no browser needed) ---
echo "🔐 Logging in to Docker Hub as $DOCKERHUB_USER..."
echo "   (Entrez votre mot de passe Docker Hub ci-dessous)"
docker login -u "$DOCKERHUB_USER"

# --- Build backend ---
echo ""
echo "🐍 Building backend image..."
docker buildx build \
  --platform linux/amd64 \
  -t "$BACKEND_IMAGE" \
  --push \
  ./backend

# --- Build frontend ---
echo ""
echo "⚛️  Building frontend image..."
docker buildx build \
  --platform linux/amd64 \
  -t "$FRONTEND_IMAGE" \
  --push \
  ./frontend

echo ""
echo "✅ Done! Images pushed to Docker Hub."
echo ""
echo "   $BACKEND_IMAGE"
echo "   $FRONTEND_IMAGE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👉 Update docker-compose.yml image names if"
echo "   you used a different username, then"
echo "   import it into CasaOS > Custom Install."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
