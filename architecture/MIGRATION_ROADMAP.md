# Feuille de route de migration

## Objectif

Transformer l'existant en ecosysteme coherent sans repliquer les donnees partout ni casser les applications deja en place.

Contrainte structurante:

- les applications doivent rester utilisables individuellement
- la coherence doit venir des contrats de donnees et des synchronisations, pas d'un point d'authentification unique obligatoire

## Phase 0. Cadrage

Livrables:

- architecture cible validee
- matrice de responsabilite des domaines
- liste des identifiants pivots
- inventaire des API existantes par application

Sortie attendue:

- une decision officielle: KCS Orbit API est le noyau central

## Phase 1. Foundation Orbit

Travaux:

- stabiliser les modules `Organization`, `SharedProfile`, `AppAccess`, `ExternalLink`, `SyncEvent`, `AuditLog`
- completer les schemas d'ingestion et leurs validations
- definir les permissions machine-to-machine par application
- conserver la compatibilite avec des logins applicatifs locaux
- documenter les contrats d'integration

Critere de sortie:

- Orbit peut recevoir et tracer des donnees de toutes les applications

## Phase 2. Federation Academique

Priorite haute parce que l'eleve est l'entite pivot de l'ecosysteme.

Travaux:

- connecter SAVANEX a Orbit
- pousser parents, enseignants, classes, eleves, notes et presences
- maintenir les `ExternalLink` pour tous les objets importes
- rendre les eleves consultables comme referentiel central

Critere de sortie:

- un eleve cree dans SAVANEX est visible dans Orbit avec son mapping complet

## Phase 3. Federation Financiere

Travaux:

- connecter EduPay a Orbit
- consommer les eleves et organisations depuis Orbit
- pousser les paiements confirmes dans Orbit
- exposer l'etat financier consolide pour KCS Nexus et EduSync AI

Critere de sortie:

- un paiement EduPay peut etre rattache au bon eleve central sans duplication manuelle

## Phase 4. Federation Communication

Travaux:

- connecter EduSync AI a Orbit
- publier les annonces et statuts de diffusion
- consommer les segments et profils partages depuis Orbit
- declencher des workflows a partir des evenements paiement et academics

Critere de sortie:

- une annonce ou un rappel peut etre cible en utilisant les donnees centrales et non des listes locales divergentes

## Phase 5. Portail unifie

Travaux:

- repositionner KCS Nexus comme portail unifie
- remplacer ses donnees locales par des lectures via Orbit et les services metier proprietaires
- centraliser les dashboards et les vues transverses

Important:

- KCS Nexus peut offrir un parcours unifie
- mais les autres applications ne doivent pas devenir dependantes de KCS Nexus pour se connecter ou fonctionner

Critere de sortie:

- l'utilisateur retrouve une experience unique au-dessus de plusieurs systemes specialises

## Structure de travail recommandee

### Sprint 1

- finaliser les contrats d'integration Orbit
- ajouter un package de types partages
- brancher SAVANEX sur `students` et `classes`

### Sprint 2

- brancher EduPay sur les paiements
- normaliser les correspondances `studentExternalId`
- exposer une vue centralisee des paiements

### Sprint 3

- brancher EduSync AI sur les annonces
- produire les premiers workflows inter-applications
- alimenter KCS Nexus avec la vue centralisee

## Risques a eviter

- deux sources de verite concurrentes pour l'identite
- des identifiants non mappes entre applications
- des payloads differents pour un meme concept
- des integrations synchrones uniquement sans reprise sur erreur
- des frontends branches directement sur des tables locales incompatibles

## Prochaine execution technique recommandee

1. creer `packages/shared-contracts` avec les schemas Zod communs
2. faire consommer ces contrats par KCS Orbit API
3. ajouter un client SDK minimal pour SAVANEX, EduPay et EduSync AI
4. brancher les premiers flux reels sur `students`, `classes` et `payments`