# Stratégie Auth — DK GTM Manager

## État actuel (depuis 2026-07-02)

GCP OAuth **opérationnel**. Projet GCP `gtm-wbncv54-ngq1n` (renommé "LAB - DK GTM Manager"), Tag Manager API v2 activée, écran de consentement externe configuré, Client ID Web avec origine `http://localhost:5173`.

- `.env.local` : `VITE_GOOGLE_CLIENT_ID` renseigné avec le vrai Client ID
- `src/lib/auth.ts` : scopes `tagmanager` + `openid email profile` (le second groupe nécessaire pour `fetchUserInfo`)
- `src/App.tsx` : guards `RequireAuth` — `/dashboard/*` redirige vers `/` si non connecté, `/` redirige vers `/dashboard/containers` si déjà connecté
- Flow : popup Google → scopes GTM → token → userinfo → dashboard. Déconnexion → redirection landing via le guard.

## Fallback statique (toujours actif)

`src/data/gtm-static.ts` contient les données GTM statiques (`STATIC_ACCOUNTS` ~160 comptes, `STATIC_CONTAINERS` 47 containers PerfectStay). Le store bascule dessus quand `accessToken === null` — pattern conservé volontairement pour permettre une démo/consultation sans login. Ne pas casser ce fallback.

## Profils multi-consultants

Le compte Google `googlepartner@digitalkeys.fr` est **partagé** entre plusieurs consultants DK. Sans isolation, les opérations planifiées (suppressions, renommages, containers scannés) se mélangeraient entre utilisateurs.

Solution : `useProfileStore` (`src/store/profile-store.ts`). Chaque profil nommé (Ron, Tim, Juh...) a son propre namespace localStorage `dk_gtm_monitoring_v1_${profileId}`. Page `/profile` pour créer/sélectionner/supprimer, pill colorée cliquable dans le header. Migration one-shot des données pré-profils vers le profil par défaut au premier lancement post-update.

## Impact sur les features (mis à jour)

| Feature | Sans login | Avec login |
|---------|-----------|------------|
| Voir comptes/containers | ✅ statique | ✅ live |
| Créer/éditer packages | ✅ | ✅ |
| Calculer diffs | ❌ bloqué | ✅ |
| Déployer | ❌ bloqué | ✅ (publication réelle) |
| Matrice couverture GA4 / Monitoring | ✅ démo (`monitoring-mock.ts`) | ✅ live (`scanMonitoring`, batch de 40) |
| Nettoyage orphelins (suppression) | ❌ bloqué | ✅ publication réelle |
| Renommage groupé / actions déclencheurs | planification only | planification + exécution |

## Notes

- Photo de profil Google : `lh3.googleusercontent.com` bloque les requêtes avec `Referer` → `referrerPolicy="no-referrer"` + fallback initiale en dégradé violet si l'image casse.
- Erreurs de publication (`createVersion`/`publishVersion`) ne sont plus silencieuses : notification listant les containers en échec + message d'erreur tronqué.

Voir [[deferred-features]] pour ce qui reste à construire (rollback, workspace last-modified, usage tracking) et [[profiles]] pour le détail du système de profils.
