#!/bin/bash
# Script pour exporter l'application sous forme de fichier TAR (via Docker)
# pour éviter de passer par Docker Hub.

set -e

BACKEND_IMAGE="extract-io-backend:local"
FRONTEND_IMAGE="extract-io-frontend:local"
TAR_FILE="extract-io-images.tar"

echo "============================================================"
echo "    📦 Export des images Docker (sans passer par Docker Hub) 📦    "
echo "============================================================"
echo ""

echo "🔨 1. Construction de l'image Backend..."
docker build -t "$BACKEND_IMAGE" ./backend

echo ""
echo "🔨 2. Construction de l'image Frontend..."
docker build -t "$FRONTEND_IMAGE" ./frontend

echo ""
echo "💾 3. Sauvegarde des images dans $TAR_FILE..."
docker save -o "$TAR_FILE" "$BACKEND_IMAGE" "$FRONTEND_IMAGE"

echo ""
echo "✅ Terminé !"
echo "Vous pouvez maintenant envoyer le fichier '$TAR_FILE' et le dossier actuel sur votre serveur CasaOS."
echo ""
echo "Sur votre serveur CasaOS, vous devrez lancer:"
echo "  docker load -i $TAR_FILE"
echo "  docker-compose up -d"
echo "============================================================"
