# Extract.io 🚀

**Extract.io** est un outil professionnel hybride conçu pour extraire les données de contact (Emails, Téléphones, Réseaux Sociaux) des sites e-commerce en quelques secondes. Il combine la puissance d'un crawler HTTP ultra-rapide et d'un navigateur automatisé (Playwright) pour contourner les protections.

---

## ✨ Fonctionnalités

- 🔍 **Scan Hybride** : Utilise d'abord un moteur ultra-léger, puis bascule sur un navigateur réel pour les sites complexes (JavaScript).
- 📧 **Extraction Profonde** : Analyse automatiquement les pages de contact, mentions légales, politiques de confidentialité et d'expédition.
- 📱 **Détection Multi-Plateforme** : Récupère les liens Instagram, Facebook, TikTok, LinkedIn, YouTube, Pinterest et X (Twitter).
- 📂 **Mode Bulk (Vrac)** : Scannez des listes entières de sites en un seul clic.
- 📊 **Export CSV** : Exportez vos leads instantanément pour vos campagnes marketing.
- 🐋 **Docker Ready** : Déploiement en 1 minute sur n'importe quel VPS ou via CasaOS.

---

## 🚀 Installation Rapide (Docker)

La méthode recommandée est d'utiliser Docker pour éviter toute installation complexe de Python ou de navigateurs.

### 1. Cloner le dépôt
```bash
git clone https://github.com/Ilyan-Margueritte/Extract.io.git
cd Extract.io
```

### 2. Lancer l'application
```bash
docker compose -f docker-compose.local.yml up -d --build
```
L'interface sera alors accessible sur : `http://localhost:7842`

---

## 🏠 Déploiement sur CasaOS / VPS Hostinger

Extract.io est optimisé pour être utilisé sur un serveur distant.

1. Connectez-vous à votre VPS.
2. Clonez le projet.
3. Lancez la commande Docker ci-dessus.
4. **CasaOS** détectera automatiquement les containers et les affichera sur votre tableau de bord grâce aux métadonnées `x-casaos`.

> [!IMPORTANT]
> N'oubliez pas d'ouvrir le port `7842` dans le pare-feu de votre VPS.

---

## 🛠 Structure du Projet

- `/backend` : API FastAPI et moteur de scraping hybride (Requests + Playwright).
- `/frontend` : Interface React Moderne avec Vite et Framer Motion pour les animations.
- `docker-compose.local.yml` : Configuration pour la compilation locale simplifiée.

---

## 🏗 Développement Local (Sans Docker)

Si vous souhaitez modifier le code, vous pouvez lancer les services séparément :

**Backend :**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload
```

**Frontend :**
```bash
cd frontend
npm install
npm run dev
```

---

Dévéloppé avec ❤️ par **Ilyan Margueritte**. Extract.io est conçu pour être rapide, sûr et efficace. 🚀
