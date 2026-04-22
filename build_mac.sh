#!/bin/bash
set -e

echo "========================================="
echo "   🚀 Génération de l'application Mac"
echo "========================================="

# 1. Compiler le backend Python
echo "📦 1. Compilation du moteur backend..."
cd backend
source venv/bin/activate
pip install pyinstaller

# Compilation du script Python en exécutable (embarque Playwright et ses dépendances)
pyinstaller --onefile --name extract-engine \
  --collect-all playwright \
  --collect-all pyee \
  --collect-all greenlet \
  --collect-all uvicorn \
  --collect-all fastapi \
  main.py

cd ..

# 2. Préparer les ressources pour Electron
echo "🚚 2. Déplacement de l'exécutable vers Electron..."
mkdir -p frontend/backend-bin
cp backend/dist/extract-engine frontend/backend-bin/

# 3. Compiler l'application Electron
echo "💻 3. Création du fichier .dmg et de l'app macOS..."
cd frontend
npm install
npm run electron:build:mac

echo "========================================="
echo "✅ TERMINÉ !"
echo "Votre application se trouve dans : frontend/release/"
echo "Vous pouvez glisser Extract.io.app dans vos Applications !"
echo "========================================="
