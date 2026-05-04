# Blueprint de l'ecosysteme

## Objectif

Faire de KCS Orbit API le moteur central de l'ecosysteme, sans reecriture brutale des applications existantes.

Le principe est simple:

- KCS Orbit API devient le noyau de reference
- chaque application conserve son domaine metier specialise
- les echanges passent par des contrats stables
- les donnees partagees ont un seul proprietaire

## Principe d'autonomie applicative

L'ecosysteme ne doit pas imposer un point d'entree unique pour etre utilisable.

Cela veut dire:

- chaque application peut continuer a fonctionner seule
- chaque application peut garder son propre mecanisme d'authentification si necessaire
- l'acces a l'ecosysteme ne depend pas d'un login unique obligatoire
- KCS Orbit API sert d'epine dorsale de donnees et d'integration, pas de verrou d'acces

L'identite federée est donc une capacite optionnelle, pas une obligation d'architecture.

## Roles des applications

### KCS Orbit API

Responsabilites centrales:

- federation d'identite optionnelle
- organisations et multi-etablissement
- profils partages
- droits d'acces aux applications
- registre des connexions inter-applications
- liens entre identifiants locaux et identifiants centraux
- journal d'audit
- orchestration des synchronisations

### SAVANEX

Responsable metier de:

- eleves
- parents
- enseignants
- classes
- notes
- presences

### EduPay Smart System

Responsable metier de:

- frais
- paiements
- recus
- relances financieres
- analytics financiers

### EduSync AI

Responsable metier de:

- annonces
- communication interne
- workflows de notification
- assistants IA et automatisation

### KCS Nexus

Responsable de:

- portail unifie de l'ecosysteme
- dashboards transverses
- parcours utilisateur coherent
- consommation des services Orbit et metier

KCS Nexus ne doit pas rester une deuxieme source de verite pour l'identite, les profils ou les entites centrales.

## Strategie d'identite recommandee

Deux modes doivent coexister:

- mode autonome: chaque application gere son login local et partage seulement les donnees pivots avec Orbit
- mode federé: une application peut choisir d'utiliser Orbit pour les profils, droits ou un parcours unifie

Le mode federé ne doit jamais casser le mode autonome.

Le schema actuel de Orbit supporte deja cette logique avec `LoginMode`:

- `LOCAL_CREDENTIALS`
- `EXTERNAL_AUTH`
- `MANAGED_BY_APP`

## Regles de gouvernance des donnees

Chaque donnee partagee doit avoir un seul proprietaire.

| Domaine | Systeme proprietaire | Systeme central de projection |
|---|---|---|
| Identite federée, mapping d'acces, organisations | KCS Orbit API | KCS Orbit API |
| Profils partages | KCS Orbit API | KCS Orbit API |
| Eleves, classes, notes, presences | SAVANEX | KCS Orbit API |
| Paiements, frais, recus | EduPay | KCS Orbit API |
| Annonces et workflows de communication | EduSync AI | KCS Orbit API |
| Vue unifiee utilisateur | KCS Nexus | Lecture depuis KCS Orbit API |

Important:

- les comptes locaux restent autorises dans les applications metier
- Orbit ne remplace pas obligatoirement les tables d'authentification locales
- Orbit doit surtout maintenir les liens, droits, profils partages et correspondances inter-applications

## Identifiants et referentiel commun

Toute entite transverse doit porter deux niveaux d'identifiants:

- un identifiant central Orbit
- un identifiant local par application source

Le mapping passe par la table `ExternalLink` deja presente dans KCS Orbit API.

Convention recommandee:

- `organizationId`: identifiant central obligatoire pour toute donnee federable
- `orbitId`: identifiant central de l'entite quand il existe
- `externalId`: identifiant local dans l'application source
- `appSlug`: application source ou destination

## Capacites centrales a conserver dans Orbit

Les modeles suivants doivent rester la reference commune:

- `Organization`
- `User`
- `SharedProfile`
- `AppAccess`
- `AppConnection`
- `ExternalLink`
- `SyncEvent`
- `AuditLog`

Ces modeles existent deja dans [kcs-orbit-api/prisma/schema.prisma](../kcs-orbit-api/prisma/schema.prisma).

## Architecture logique cible

```text
Portails et UI
|- KCS Nexus frontend
|- EduPay web
|- SAVANEX frontend
|- EduSync AI frontend

Noyau central
|- KCS Orbit API
|  |- identity
|  |- organizations
|  |- profiles
|  |- access
|  |- integration
|  |- audit

Services metier
|- EduPay API
|- SAVANEX backend
|- EduSync AI backend
|- services IA annexes

Couche d'echange
|- REST synchrone
|- evenements asynchrones
|- webhooks securises
|- synchronisation planifiee si necessaire
```

## Flux d'echange cibles

### Flux 1. Identite

1. une application cree ou gere un compte local selon son besoin
2. Orbit peut enregistrer un profil partage, des droits ou un mapping applicatif
3. les applications consomment ou synchronisent cet acces si elles le souhaitent
4. l'utilisateur peut naviguer dans l'ecosysteme soit avec des comptes locaux, soit avec une federation d'identite si activee

### Flux 2. Academique

1. SAVANEX cree ou modifie un eleve
2. SAVANEX pousse la donnee vers Orbit
3. Orbit maintient le lien central et journalise l'evenement
4. EduPay et KCS Nexus lisent ensuite la projection centralisee

### Flux 3. Paiement

1. EduPay enregistre un paiement
2. EduPay pousse l'evenement vers Orbit
3. Orbit projette le paiement dans le referentiel central
4. EduSync AI peut declencher une notification
5. KCS Nexus affiche l'etat consolide

### Flux 4. Communication

1. EduSync AI publie une annonce
2. l'annonce est envoyee a Orbit
3. Orbit journalise et redistribue aux consommateurs concernes
4. KCS Nexus et les autres interfaces affichent l'information pertinente

## Structure workspace recommandee

```text
Ecosystem/
|- architecture/
|- kcs-orbit-api/
|- KCS Nexus/
|- EduPay Smart System/
|- EduSync AI/
|- SAVANEX Project/
|- packages/
|  |- shared-contracts/
|  |- shared-events/
|  |- shared-sdk/
|  |- shared-auth/
|- infra/
|  |- gateway/
|  |- observability/
|  |- compose/
```

## Priorites d'implementation

1. stabiliser Orbit comme source de verite centrale
2. sortir les contrats d'echange dans `packages/shared-contracts`
3. connecter SAVANEX et EduPay sur les identifiants pivots
4. brancher EduSync AI sur les evenements et les segments utilisateurs
5. transformer KCS Nexus en portail unifie consommateur de Orbit sans imposer un login unique aux autres applications