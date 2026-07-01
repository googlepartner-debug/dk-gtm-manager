# PRD — DK GTM Manager

**Version :** 1.0 (brouillon reconstruit depuis description + .env — à valider)
**Date :** 02/07/2026 · **Client :** Interne Digitalkeys · **Statut :** Vivant

## 1. Résumé
Outil de **déploiement en masse (bulk) multi-containers Google Tag Manager** pour Digitalkeys :
appliquer/propager des configurations GTM sur plusieurs containers d'un coup.

## 2. Problème
Configurer plusieurs containers GTM à la main (mêmes tags/triggers/variables sur N comptes) est
long et source d'incohérences. L'outil industrialise le déploiement multi-containers.

## 3. Type & stack
App/outil web (type B). React · TS · Vite. Authentification Google (OAuth `VITE_GOOGLE_CLIENT_ID`)
+ API Google Tag Manager.

## 4. Critères d'acceptation (à confirmer)
- [ ] Connexion Google OAuth et listing des containers accessibles.
- [ ] Déploiement bulk d'une configuration sur plusieurs containers.
- [ ] Journalisation des déploiements.

## 5. Risques
- Quotas API GTM, gestion des permissions par container.
- README = template Vite par défaut : compléter objectifs & critères via l'interview PRD.
