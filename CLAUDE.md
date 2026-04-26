# CLAUDE.md — Extract.io

## Stack
- Backend : FastAPI + SQLAlchemy + SQLite (dev) / PostgreSQL (prod)
- Frontend : React + Vite
- Auth : Clerk (JWT RS256)
- Paiement : Stripe

## Règles générales
- Ne jamais modifier la logique métier sans me le signaler
- Ne jamais commiter de secrets ou de fichiers .env
- Toujours garder le même style de code que le fichier modifié
- Les commentaires sont en français

## Sécurité — à vérifier à chaque modification
- Tous les endpoints API doivent avoir `Depends(get_authenticated_user)`
- Jamais de bypass debug en production
- Toute URL externe doit passer par `validate_url()` avant requête
- Jamais de comparaison de hash avec `==`, utiliser `hmac.compare_digest`
- Les clés API sont réservées aux utilisateurs premium uniquement
- Pas de logique d'autorisation côté frontend (UX only)

## Avant chaque PR / commit important
1. Scanner tous les endpoints pour vérifier l'authentification
2. Vérifier qu'aucun secret n'est hardcodé dans le code
3. Vérifier que `.gitignore` couvre bien : `.env`, `*.db`, `*.sqlite`
4. Tester les routes publiques (sans token) → doivent renvoyer 401
5. Corriger automatiquement ce qui peut l'être, signaler ce qui ne peut pas

## Architecture des dossiers
- `backend/api/` → routes FastAPI
- `backend/models.py` → modèles SQLAlchemy
- `backend/auth.py` → validation JWT Clerk
- `backend/scraper.py` → logique de scraping + validation SSRF
- `frontend/src/pages/` → pages React
- `frontend/src/components/` → composants réutilisables

## Ce qu'il ne faut jamais faire
- Supprimer `require_premium_subscription()` sur les routes api-keys
- Utiliser `jwt.get_unverified_claims()` → toujours valider la signature
- Faire confiance à une URL sans passer par `validate_url()`
- Exposer les stack traces dans les réponses d'erreur API
- Laisser `*.db` être tracké par git