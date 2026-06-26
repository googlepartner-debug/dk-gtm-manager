# Stratégie Auth — DK GTM Manager

## État actuel

GCP OAuth **non configuré**. Décision explicite : "pas pour le moment". Toutes les features fonctionnent sans token.

## Fallback statique

`src/data/gtm-static.ts` contient les vraies données GTM récupérées via MCP Claude :
- `STATIC_ACCOUNTS` : ~160 comptes
- `STATIC_CONTAINERS` : 47 containers pour le compte PerfectStay (`accountId: '431351581'`)

Le store charge ces données quand `accessToken === null`.

## Pourquoi différé

- Nécessite création d'un projet GCP + activation API GTM + OAuth consent screen + `VITE_GOOGLE_CLIENT_ID`
- Complexité non justifiée pour l'usage solo actuel
- MCP Claude donne accès aux données en session pour les besoins immédiats

## Impact sur les features

| Feature | Sans OAuth | Avec OAuth |
|---------|-----------|------------|
| Voir comptes/containers | ✅ statique | ✅ live |
| Créer/éditer packages | ✅ | ✅ |
| Calculer diffs | ❌ bloqué | ✅ |
| Déployer | ❌ bloqué | ✅ |
| Matrice couverture GA4 | ❌ (besoin diff) | ✅ |

## Roadmap

Quand GCP est configuré :
1. Créer `.env.local` avec `VITE_GOOGLE_CLIENT_ID=...`
2. Décommenter le flow OAuth dans `src/lib/auth.ts`
3. Le store bascule automatiquement sur l'API live

Voir [[deferred-features]] pour le tracker complet.
