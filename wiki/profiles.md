# Profils — DK GTM Manager

## Contexte

`googlepartner@digitalkeys.fr` est un compte Google partagé entre tous les consultants DK. Sans isolation, les suppressions planifiées, containers scannés et préférences seraient mélangés entre utilisateurs.

## Système de profils

Chaque consultant crée un profil nommé (Ron, Tim, Juh…) à son premier lancement. Un profil = un espace de travail isolé.

- **Store** : `useProfileStore` dans `src/store/profile-store.ts` (Zustand persist)
- **Modèle** : `Profile { id: string (UUID), name: string, colorIndex: number }`
- **Page** : `/profile` — créer, sélectionner, supprimer des profils ; codes couleurs DK
- **Header** : pill colorée affichant le profil actif, cliquable pour changer d'espace

## Isolation localStorage

Tout le state Monitoring est namespaced par profil :

```
dk_gtm_monitoring_v1_${profileId}
```

Les packages et l'historique de déploiement (`dk_gtm_packages`, `dk_gtm_history`) restent globaux — ils sont liés au compte GTM, pas au consultant.

## Migration

Au premier lancement après introduction du système, les données existantes (sans profil) sont migrées one-shot vers un profil par défaut.

## Couleurs profils

Palette PROFILE_COLORS dans `profile-store.ts` — extraite de la charte DK (violets, prune, yellow, slate).
