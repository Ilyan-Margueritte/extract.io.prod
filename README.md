# Extract.io 🚀

**Extract.io** est l'outil ultime pour extraire les données de contact (Emails, Téléphones, Réseaux Sociaux) des boutiques e-commerce en quelques secondes.

---

## 🛠 Prérequis

Avant de commencer, assurez-vous d'avoir installé sur votre machine :
- **Python 3.10+**
- **Node.js 18+** & **npm**

---

## 📥 Installation

### 1. Cloner le dépôt
```bash
git clone https://github.com/Ilyan-Margueritte/Extract.io.git
cd Extract.io
```

### 2. Configurer le Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
cd ..
```

### 3. Configurer le Frontend
```bash
cd frontend
npm install
cd ..
```

---

## 🚀 Utilisation (Mode Développement)

Pour lancer l'application en local :

1. **Lancer le serveur backend** :
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --port 8000
   ```

2. **Lancer l'interface bureau (Electron)** :
   ```bash
   cd frontend
   npm run electron:dev
   ```

---

## 🍏 Créer l'application macOS (.app)

Pour générer une application autonome qui lance automatiquement le moteur et l'interface au double-clic :

1. Assurez-vous d'être sur un **ordinateur macOS**.
2. À la racine du projet, rendez le script de build exécutable :
   ```bash
   chmod +x build_mac.sh
   ```
3. Lancez la compilation :
   ```bash
   ./build_mac.sh
   ```

Une fois terminé, vous trouverez votre fichier d'installation dans :
`frontend/release/Extract.io-1.0.0-mac.zip`

---

## 📁 Structure du projet
- `/backend` : API FastAPI et moteur de scraping hybride (Requests + Playwright).
- `/frontend` : Interface React (Vite) avec intégration Electron pour le bureau.
- `build_mac.sh` : Script d'automatisation pour la compilation macOS.

---

Extract.io est conçu pour être rapide, sûr et efficace. 🚀
