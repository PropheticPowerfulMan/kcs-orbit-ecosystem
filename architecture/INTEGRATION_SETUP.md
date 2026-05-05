# Integration Setup

## Objectif

Ce document decrit les variables d'environnement et l'ordre de validation pour faire communiquer les applications avec KCS Orbit API.

## Rappel d'architecture

L'integration mise en place suit cette regle:

- chaque application reste autonome
- Orbit centralise les structures de donnees partagees et les liens
- un login unique n'est pas requis pour utiliser l'ecosysteme

## Services deja branches

- KCS Orbit API valide maintenant les contrats partages pour `students`, `classes`, `payments` et `announcements`
- SAVANEX pousse les eleves et classes vers Orbit apres creation et mise a jour
- EduPay pousse les paiements vers Orbit apres creation
- EduSync AI pousse les annonces vers Orbit apres creation

## Variables a renseigner

### KCS Orbit API

Dans [kcs-orbit-api/.env.example](../kcs-orbit-api/.env.example):

- `KCS_NEXUS_INTEGRATION_KEY`
- `EDUPAY_INTEGRATION_KEY`
- `EDUSYNCAI_INTEGRATION_KEY`
- `SAVANEX_INTEGRATION_KEY`

### SAVANEX

Dans l'environnement du backend Django:

- `KCS_ORBIT_API_URL=http://localhost:4500`
- `KCS_ORBIT_API_KEY=<SAVANEX_INTEGRATION_KEY>`
- `KCS_ORBIT_ORGANIZATION_ID=<organization_id_orbit>`
- `KCS_ORBIT_TIMEOUT_SECONDS=5`

### EduPay

Dans [EduPay Smart System/apps/api/.env.example](../EduPay%20Smart%20System/apps/api/.env.example):

- `KCS_ORBIT_API_URL=http://localhost:4500`
- `KCS_ORBIT_API_KEY=<EDUPAY_INTEGRATION_KEY>`
- `KCS_ORBIT_ORGANIZATION_ID=<organization_id_orbit>`

Important:

- chaque eleve EduPay doit idealement porter `externalStudentId`, qui correspond a l'identifiant externe de l'eleve academique dans SAVANEX

### EduSync AI

Dans [EduSync AI/backend/.env.example](../EduSync%20AI/backend/.env.example):

- `KCS_ORBIT_API_URL=http://localhost:4500`
- `KCS_ORBIT_API_KEY=<EDUSYNCAI_INTEGRATION_KEY>`
- `KCS_ORBIT_ORGANIZATION_ID=<organization_id_orbit>`
- `KCS_ORBIT_TIMEOUT_SECONDS=5`

## Ordre de demarrage recommande

1. demarrer KCS Orbit API
2. verifier la creation ou l'existence de l'organisation centrale
3. configurer les cles d'integration dans les applications
4. demarrer SAVANEX backend
5. demarrer EduPay API
6. demarrer EduSync AI backend

## Verifications fonctionnelles

### Verification 1. Student sync

Action:

- creer ou modifier un eleve dans SAVANEX

Resultat attendu:

- une requete est envoyee vers `POST /api/integration/ingest/savanex/students`
- Orbit cree ou met a jour `Student`
- Orbit met a jour `ExternalLink`
- Orbit cree un `SyncEvent`

### Verification 2. Class sync

Action:

- creer ou modifier une classe dans SAVANEX

Resultat attendu:

- une requete est envoyee vers `POST /api/integration/ingest/savanex/classes`

### Verification 3. Payment sync

Action:

- creer un paiement dans EduPay

Resultat attendu:

- une requete est envoyee vers `POST /api/integration/ingest/edupay/payments`
- le paiement central est cree ou mis a jour dans Orbit

Condition critique:

- au moins un `studentExternalId` valide doit etre disponible depuis EduPay

### Verification 4. Announcement sync

Action:

- publier une annonce dans EduSync AI

Resultat attendu:

- une requete est envoyee vers `POST /api/integration/ingest/edusyncai/announcements`

## Etat actuel et limites connues

- la synchronisation est non bloquante cote applications metier: si Orbit est indisponible, le metier local continue et journalise l'erreur
- EduPay est pret pour les paiements, mais la qualite du rattachement central depend du renseignement de `externalStudentId`
- KCS Nexus n'a pas encore ete bascule comme portail lecteur prioritaire de Orbit dans cette sequence
- aucune des integrations posees ici n'impose un SSO ou un login central obligatoire

## Prochaine etape logique

La prochaine tranche d'integration recommandee est:

1. faire consommer KCS Nexus depuis Orbit pour les vues consolidees
2. ajouter les synchronisations `teachers`, `parents`, `grades` et `attendance` avec contrats partages explicites
3. introduire une file persistante ou une outbox pour rejouer les echecs d'integration