# KCS Orbit API

Backend central du futur ecosysteme KCS.

Ce depot peut servir de socle technique pour **KCS Nexus**, c'est-a-dire le noyau commun qui relie plusieurs applications deja existantes sans les reecrire d'un seul coup.

## Vision cible

L'idee n'est pas de detruire EduPay, EduSyncAI ou SAVANEX, mais de les faire converger progressivement vers un centre commun.

Applications a federer autour de KCS Nexus:

- EduPay: paiements, frais, recouvrements, suivi financier
- EduSyncAI: communication, automatisation, assistant IA, annonces
- SAVANEX: gestion scolaire, eleves, classes, notes, presences
- KCS Nexus: identite, authentification, annuaire central, orchestration, passerelle d'integration

## Principe directeur

Ne pas refaire tout. Faire une **migration incrementale par integration**.

Cela veut dire:

- on garde les applications existantes vivantes
- on introduit un backend central commun
- on deplace seulement les fonctions transversales vers le centre
- on connecte progressivement chaque application au centre via API et evenements

## Ce que cette API peut devenir

Dans son etat actuel, cette API couvre deja une partie utile du noyau:

- authentification JWT
- gestion des roles
- base scolaire commune: eleves, parents, enseignants, classes
- paiements
- notes et presences
- annonces
- event bus initial

La bonne direction est donc de la faire evoluer de **backend metier unique** vers **plateforme centrale d'ecosysteme**.

## Architecture recommandee

KCS Nexus doit devenir le point central pour les capacites partagees:

- identite unifiee: un seul compte utilisateur pour tout l'ecosysteme
- autorisation unifiee: roles, permissions, scopes par application
- annuaire commun: etablissements, utilisateurs, eleves, parents, enseignants
- integration: evenements, webhooks, synchronisation
- observabilite: logs d'audit, historique, traces de synchronisation

Les applications existantes restent specialisees:

- EduPay garde sa logique de paiement
- SAVANEX garde sa logique de gestion scolaire
- EduSyncAI garde sa logique de communication et d'assistance

Mais elles ne doivent plus chacune posseder leur propre verite sur l'identite, les roles et les entites centrales.

## Strategie pour ne pas casser l'existant

### Phase 1. Garder les frontends existants, centraliser l'identite

Commencer par le plus transversal et le moins destructeur:

- creer un modele commun de tenant ou organisation si plusieurs etablissements sont vises
- faire de cette API la source officielle pour `users`, `roles` et `profiles`
- exposer des endpoints stables pour login, session, profil courant et permissions
- connecter les applications existantes a cette authentification centrale

Effet: les applications restent en place, mais l'entree dans l'ecosysteme devient commune.

### Phase 2. Introduire des identifiants pivots communs

Le point critique pour eviter la casse est la correspondance entre les donnees deja existantes et les futures donnees centrales.

Il faut ajouter une logique de mapping du type:

- `externalApp`: `edupay`, `edusyncai`, `savanex`
- `externalId`: identifiant d'origine dans l'application legacy
- `nexusId`: identifiant central KCS Nexus

Ainsi, tu peux synchroniser l'existant sans reimporter brutalement toutes les bases.

### Phase 3. Definir le proprietaire de chaque domaine

Pour eviter les conflits, il faut decider quelle application est maitresse de quelle donnee:

- identite et roles: KCS Nexus
- eleves, classes, enseignants, presences, notes: SAVANEX ou module Academics centralise
- paiements: EduPay
- annonces, conversation, automation: EduSyncAI

Puis KCS Nexus orchestre au lieu de tout dupliquer.

### Phase 4. Passer d'appels directs a des integrations propres

Deux mecanismes suffisent au debut:

- API REST pour lecture/ecriture synchrone
- evenements pour propagation asynchrone

Exemples:

- `payment.created` depuis EduPay vers Nexus
- `student.created` ou `student.updated` depuis SAVANEX vers Nexus
- `announcement.published` depuis EduSyncAI vers Nexus

L'event bus actuel est un bon debut, mais il devra evoluer vers une vraie couche d'integration persistante.

### Phase 5. Extraire progressivement les modules communs

Au lieu de migrer application par application de facon brutale, extraire en priorite:

- auth
- utilisateurs
- organisations
- eleves et profils partages
- audit et notifications

Une fois ces modules stabilises dans Nexus, les autres applications consomment ces services au lieu de les reimplementer.

## Approche technique recommandee pour ce depot

Sur ce repo, la suite logique serait:

1. Renommer conceptuellement ce service comme backend central de KCS Nexus.
2. Ajouter une notion de `Organization` ou `Tenant` dans Prisma.
3. Ajouter des tables d'integration du type `ExternalLink`, `AppConnection`, `SyncEvent`, `AuditLog`.
4. Separer les routes par domaines clairs: `identity`, `academics`, `payments`, `communications`, `integration`.
5. Ajouter un systeme de permissions plus fin que le role global.
6. Remplacer l'event bus local en memoire par une file ou une table d'events persistants.

## Ce qu'il ne faut pas faire

Pour proteger l'existant, evite ces erreurs:

- recrire les 3 applications en une seule fois
- imposer tout de suite un nouveau schema unique partout
- casser les identifiants existants sans table de correspondance
- deplacer toute la logique metier dans Nexus des le debut
- coupler les frontends existants a des endpoints instables

## Plan realiste en 3 etapes

### Etape 1. Foundation

- stabiliser cette API comme noyau central
- unifier auth, roles et profils
- introduire tenant, mapping legacy et audit

### Etape 2. Federation

- connecter EduPay, EduSyncAI et SAVANEX a Nexus
- synchroniser les entites pivots
- mettre en place des evenements de domaine

### Etape 3. Convergence

- deplacer progressivement les fonctions partagees vers Nexus
- garder chaque application comme module specialise ou facade front
- construire ensuite un portail unifie KCS Nexus si besoin

## Local setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Default admin:

```txt
email: admin@kcs-orbit.local
password: Admin@12345
```

## Environment variables

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="your_secret"
PORT=4000
CORS_ORIGIN="http://localhost:5173,https://propheticpowerfulman.github.io"
```

## Main endpoints

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me

GET  /api/students
POST /api/students

GET  /api/payments
POST /api/payments

GET  /api/grades
POST /api/grades

GET  /api/attendance
POST /api/attendance

GET  /api/announcements
POST /api/announcements
```
