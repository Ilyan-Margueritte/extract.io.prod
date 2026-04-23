#!/bin/bash
set -e

echo "========================================="
echo "   🚀 Génération de l'application Linux"
echo "========================================="

# 1. Compiler le backend Python (pour Linux)
echo "📦 1. Compilation du moteur backend (Linux)..."
cd backend
source venv/bin/activate
pip install pyinstaller

pyinstaller --onefile --name extract-engine \
  --collect-all playwright \
  --collect-all pyee \
  --collect-all greenlet \
  --collect-all uvicorn \
  --collect-all fastapi \
  main.py

cd ..

# 2. Préparer les ressources
echo "🚚 2. Déplacement de l'exécutable..."
mkdir -p frontend/backend-bin
cp backend/dist/extract-engine frontend/backend-bin/

# 3. Compiler l'application Electron (AppImage / Deb)
echo "💻 3. Création du package Linux..."
cd frontend
npm install
npm run electron:build:linux

echo "========================================="
echo "✅ TERMINÉ !"
echo "Votre application se trouve dans : frontend/release/"
echo "Cherchez le fichier .AppImage ou .deb !"
echo "========================================="
