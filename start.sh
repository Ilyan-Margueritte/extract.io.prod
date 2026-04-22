#!/bin/bash

# Kill background processes on exit
trap "kill 0" EXIT

echo "🚀 Démarrage de l'application Extract.io..."

# Start Backend
echo "🌐 Lancement du Backend (FastAPI)..."
cd backend
source venv/bin/activate
uvicorn main:app --port 8000 &
cd ..

# Start Frontend
echo "💻 Lancement du Frontend (Vite)..."
cd frontend
npm run dev &
cd ..

# Wait for both
wait
