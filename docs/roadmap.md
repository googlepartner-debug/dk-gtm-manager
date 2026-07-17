# Roadmap — DK GTM Manager

> Générée depuis le PRD, tenue à jour automatiquement (comme le PRD).
> Difficulté : 🟢 facile · 🟡 moyen · 🔴 costaud   ·   État : ✅ fait · 🔄 en cours · ⬜ à faire · 🆕 nouveau

**Avancement : 9/13 (69 %)**

---

## Authentification & connexion aux containers GTM
- [x] 🟡 Connexion Google OAuth (`VITE_GOOGLE_CLIENT_ID`)
- [x] 🟢 Listing des containers GTM accessibles
- [ ] 🟡 Gestion fine des permissions et des quotas API par container

## Déploiement bulk multi-containers
- [x] 🔴 Déploiement bulk d'une configuration sur plusieurs containers
- [x] 🟡 Diff visuel + upsert avec sélection granulaire avant déploiement
- [x] 🟡 Packages / templates de configuration réutilisables
- [x] 🟢 Renommage en masse des entités (tags, triggers, variables)

## Journalisation & historique des déploiements
- [x] 🟢 Journalisation des déploiements (log + page Historique)
- [ ] 🟡 Export / rapport de l'historique de déploiement

## Monitoring & qualité du tracking
- [x] 🔴 Monitoring des containers — vues tags/triggers/variables, distribution, matrice de params  🆕
- [x] 🟡 Mapping du dataLayer vers GA4 avec matrice de couverture  🆕
- [ ] 🟡 Plan de tracking éditable et exportable  🆕
- [ ] 🔴 Recommandations de nettoyage / optimisation branchées sur données live  🆕
