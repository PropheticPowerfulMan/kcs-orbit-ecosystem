# Deploiement production de l'ecosysteme

## Objectif

Mettre l'ecosysteme en ligne sans casser l'autonomie de chaque application.

Le modele cible est le suivant:

- chaque application garde son domaine, ses ecrans, ses logins et ses regles metier
- KCS Orbit API devient le backbone de donnees partagees et d'integration
- KCS Nexus devient le portail unifie de lecture, pas la source de verite
- les synchronisations se font automatiquement via ingestion, projections et evenements

## Reponse courte a la question d'architecture

Oui, ce que vous voulez est faisable, mais seulement si vous appliquez strictement ces 4 regles:

1. une seule source de verite par domaine
2. un identifiant central et un mapping par application
3. des integrations machine-to-machine securisees via Orbit
4. une synchronisation fiable avec reprise sur erreur

Sans cela, vous aurez seulement plusieurs applications connectees de facon fragile.

## Repartition cible des responsabilites

| Domaine | Proprietaire | Systeme consommateur |
|---|---|---|
| Organisations, profils partages, liens inter-apps, audit, sync | KCS Orbit API | Tous |
| Eleves, parents, classes, notes, presences | SAVANEX | Orbit, EduPay, EduSync AI, KCS Nexus |
| Paiements, frais, recus | EduPay | Orbit, KCS Nexus, EduSync AI |
| Communication, annonces, automatisations | EduSync AI | Orbit, KCS Nexus |
| Portail transverse, dashboards, experience unifiee | KCS Nexus | Lecture depuis Orbit et APIs metier |

## Ce que signifie autonomie reelle

Autonomie ne veut pas dire duplication libre des memes donnees partout.

Autonomie veut dire:

- chaque systeme peut tourner seul si le backbone central est temporairement indisponible
- chaque systeme peut conserver son propre login local
- chaque systeme applique ses propres regles metier
- chaque systeme publie automatiquement ses changements de domaine vers Orbit
- les autres systemes lisent la projection centrale au lieu de recopier leurs propres versions divergentes

Exemple attendu:

1. un parent et un ou plusieurs eleves sont enregistres dans SAVANEX si SAVANEX est le proprietaire academique
2. SAVANEX envoie l'evenement et le payload vers Orbit
3. Orbit cree ou met a jour les `ExternalLink`, la projection centrale et le `SyncEvent`
4. KCS Nexus lit immediatement la vue consolidee depuis Orbit
5. EduPay peut rattacher automatiquement l'eleve via `externalStudentId`
6. EduSync AI peut cibler le parent pour les notifications

Si vous creez un parent dans KCS Nexus, alors KCS Nexus ne doit pas en devenir le proprietaire metier sauf si vous lui donnez explicitement ce role. Sinon, KCS Nexus doit appeler le service proprietaire puis lire le resultat via Orbit.

## Decision d'architecture a figer

Pour eviter les conflits, il faut figer une decision simple:

- soit SAVANEX reste proprietaire des eleves et parents
- soit Orbit devient proprietaire des profils pivots et SAVANEX devient un consommateur academique

Vu l'etat actuel du repo, le plus pragmatique est:

- SAVANEX proprietaire des donnees academiques
- EduPay proprietaire des donnees financieres
- EduSync AI proprietaire des annonces et workflows
- Orbit proprietaire des liens centraux, des projections partagees et des synchronisations
- KCS Nexus consommateur et portail transverse

## Synchronisation automatique recommandee

Le minimum viable de production n'est pas du temps reel pur, mais du quasi temps reel fiable.

Flux recommande:

1. ecriture locale dans l'application proprietaire
2. ecriture dans une table outbox locale dans la meme transaction
3. worker d'integration qui pousse le message vers Orbit
4. Orbit valide le contrat, persiste la projection et journalise le `SyncEvent`
5. Orbit expose la donnee centralisee a KCS Nexus et aux autres applications
6. en cas d'echec, le worker rejoue sans perdre l'operation

Pourquoi cette approche:

- elle garde l'autonomie de l'application source
- elle evite qu'un timeout Orbit bloque un paiement ou une creation d'eleve
- elle rend la synchronisation rejouable
- elle permet d'ajouter plus tard RabbitMQ, Redis Streams ou un bus d'evenements sans casser les APIs

## Topologie de deploiement recommandee

## Niveau 1. Point d'entree web

- un domaine principal, par exemple `ecosysteme.votredomaine.com`
- sous-domaines applicatifs:
- `nexus.votredomaine.com`
- `orbit-api.votredomaine.com`
- `edupay.votredomaine.com`
- `edusync.votredomaine.com`
- `savanex.votredomaine.com`

## Niveau 2. Services applicatifs

- KCS Orbit API: service Node.js + PostgreSQL dedie
- KCS Nexus frontend: hebergement statique ou Node selon build final
- KCS Nexus backend: service Node.js + PostgreSQL dedie
- EduPay API: service Node.js + PostgreSQL dedie
- EduPay web: service statique
- EduSync AI backend: service Python
- EduSync AI frontend: service statique
- SAVANEX backend: service Django + PostgreSQL dedie
- SAVANEX frontend: service statique ou servi via Nginx

## Niveau 3. Services transverses obligatoires

- reverse proxy ou ingress: Nginx, Traefik ou plateforme cloud geree
- TLS: certificats HTTPS automatiques
- base de donnees par application proprietaire
- observabilite minimale: logs centralises et health checks
- stockage secret: variables d'environnement securisees

## Niveau 4. Integration fiable

Ajouts a faire pour une vraie production:

- table outbox par application source
- worker de retry par application
- webhook sortant ou polling sortant depuis Orbit si necessaire
- idempotence des endpoints d'ingestion
- tableau de bord de sync en erreur

## Strategie de mise en ligne recommandee

Ne deployez pas tout d'un coup en mode full microservices public si vous voulez aller vite.

Faites plutot ceci.

### Option recommandee pour debuter

- frontends sur Vercel ou Netlify
- APIs Node/Python sur Render ou Railway
- PostgreSQL manages par service ou un cluster avec bases separees
- Nginx ou gateway seulement si vous avez besoin d'un point d'entree unique personnalise

Cette option est la plus rapide pour valider le fonctionnement reel.

### Option recommandee pour production serieuse

- VPS ou cloud VM
- Docker Compose par environnement ou Kubernetes si equipe mature
- Postgres manage ou cluster dedie
- reverse proxy central
- sauvegardes automatiques
- monitoring

Cette option donne plus de controle, mais demande plus d'operations.

## Descripteurs de deploiement disponibles dans le repo

Des fichiers de deploiement Render existent maintenant pour accelerer la mise en ligne sans imposer de login global a l'ecosysteme:

- `kcs-orbit-api/render.yaml`
- `KCS Nexus/render.yaml`
- `EduPay Smart System/render.yaml`
- `EduSync AI/render.yaml`
- `SAVANEX Project/render.yaml`

Ces descripteurs gardent le modele voulu:

- chaque application se deploie separement
- chaque application garde son backend et son frontend
- Orbit reste le backbone de synchronisation et de projection
- aucun login global n'est impose pour ouvrir les applications

## Ordre de deploiement

1. deployer PostgreSQL pour Orbit
2. deployer KCS Orbit API
3. creer l'organisation centrale et les cles d'integration
4. deployer SAVANEX backend puis activer la sync vers Orbit
5. deployer EduPay API puis activer la sync vers Orbit
6. deployer EduSync AI backend puis activer la sync vers Orbit
7. deployer KCS Nexus en lecture sur Orbit
8. brancher les frontends publics sur leurs APIs respectives
9. tester les flux inter-applications de bout en bout

## Variables d'environnement critiques

### KCS Orbit API

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `KCS_NEXUS_INTEGRATION_KEY`
- `EDUPAY_INTEGRATION_KEY`
- `EDUSYNCAI_INTEGRATION_KEY`
- `SAVANEX_INTEGRATION_KEY`

### SAVANEX

- `KCS_ORBIT_API_URL`
- `KCS_ORBIT_API_KEY`
- `KCS_ORBIT_ORGANIZATION_ID`
- `KCS_ORBIT_TIMEOUT_SECONDS`

### EduPay

- `KCS_ORBIT_API_URL`
- `KCS_ORBIT_API_KEY`
- `KCS_ORBIT_ORGANIZATION_ID`
- `externalStudentId` doit etre renseigne dans le modele ou mapping de paiement

### EduSync AI

- `KCS_ORBIT_API_URL`
- `KCS_ORBIT_API_KEY`
- `KCS_ORBIT_ORGANIZATION_ID`

### KCS Nexus

- URL Orbit
- cle d'acces ou JWT selon mode de consommation
- desactivation des ecritures locales sur les entites partagees si Nexus n'est pas proprietaire

## Flux de reference a valider avant ouverture publique

### Flux 1. Academique

1. creer un parent et un eleve dans SAVANEX
2. verifier l'ingestion dans Orbit
3. verifier la presence des `ExternalLink`
4. verifier l'affichage dans KCS Nexus

### Flux 2. Financier

1. creer un paiement dans EduPay
2. verifier le rattachement via `studentExternalId`
3. verifier la projection dans Orbit
4. verifier l'etat consolide dans KCS Nexus

### Flux 3. Communication

1. publier une annonce dans EduSync AI
2. verifier la remontee dans Orbit
3. verifier la visibilite dans KCS Nexus

### Flux 4. Resilience

1. couper Orbit temporairement
2. creer un eleve ou un paiement dans l'application proprietaire
3. verifier que l'ecriture locale reussit quand meme
4. redemarrer Orbit
5. verifier le rejeu automatique

## Ce qui manque encore pour dire que c'est pret production

Au vu des documents actuels, vous avez deja une bonne base d'architecture et des endpoints d'ingestion. En revanche, il manque encore au minimum:

1. une outbox persistante et un mecanisme de retry par application
2. une idempotence stricte des ingestions Orbit
3. une decision definitive sur le proprietaire de `parent`
4. KCS Nexus en lecture prioritaire depuis Orbit pour les vues transverses
5. une documentation d'environnement de production centralisee

## Recommandation finale

Si votre objectif est d'avoir un ecosysteme reellement autonome et synchronise:

- ne cherchez pas un login unique obligatoire
- ne laissez pas plusieurs applications modifier librement la meme entite partagee
- faites d'Orbit le backbone d'integration et de projection
- gardez une base par application proprietaire
- ajoutez une synchronisation fiable par outbox et retry
- faites de KCS Nexus un portail de lecture et d'orchestration

Dans ce modele, oui, l'ecosysteme peut etre mis en ligne proprement et fonctionner comme vous le decrivez.