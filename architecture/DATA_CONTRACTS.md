# Contrats d'echange de donnees

## Objectif

Definir des contrats stables entre KCS Orbit API et les autres applications afin d'eviter les integrations fragiles basees sur des schemas locaux divergents.

## Regles communes

Tous les payloads d'integration doivent contenir:

- `organizationId`
- `externalId`
- `sourceApp`
- `occurredAt`
- `version`

Quand l'entite centrale existe deja, ajouter aussi:

- `orbitId`

## Entete de securite

Pour les appels machine-to-machine:

- `x-api-key`
- `x-app-slug`
- `content-type: application/json`

## Contrat commun d'enveloppe

```json
{
  "organizationId": "org_123",
  "externalId": "student_456",
  "orbitId": "std_789",
  "sourceApp": "SAVANEX",
  "occurredAt": "2026-05-04T10:00:00.000Z",
  "version": "1.0.0",
  "payload": {}
}
```

## Contrats par domaine

### StudentUpsert

Source: SAVANEX  
Destination: KCS Orbit API

```json
{
  "organizationId": "org_123",
  "externalId": "sav_student_001",
  "sourceApp": "SAVANEX",
  "occurredAt": "2026-05-04T10:00:00.000Z",
  "version": "1.0.0",
  "payload": {
    "firstName": "Grace",
    "lastName": "Ilunga",
    "gender": "F",
    "classExternalId": "sav_class_6A",
    "parentExternalId": "sav_parent_033",
    "email": "grace@example.org",
    "phone": "+243000000000",
    "status": "ACTIVE"
  }
}
```

### ClassUpsert

Source: SAVANEX  
Destination: KCS Orbit API

```json
{
  "organizationId": "org_123",
  "externalId": "sav_class_6A",
  "sourceApp": "SAVANEX",
  "occurredAt": "2026-05-04T10:00:00.000Z",
  "version": "1.0.0",
  "payload": {
    "name": "6A",
    "gradeLevel": "6",
    "teacherExternalId": "sav_teacher_011"
  }
}
```

### PaymentCreated

Source: EduPay  
Destination: KCS Orbit API

```json
{
  "organizationId": "org_123",
  "externalId": "pay_2026_001",
  "sourceApp": "EDUPAY",
  "occurredAt": "2026-05-04T10:00:00.000Z",
  "version": "1.0.0",
  "payload": {
    "studentExternalId": "sav_student_001",
    "amount": 250.0,
    "currency": "USD",
    "motif": "Tuition - May",
    "method": "Mobile Money",
    "reference": "MM-REF-7781",
    "status": "CONFIRMED"
  }
}
```

### AnnouncementPublished

Source: EduSync AI  
Destination: KCS Orbit API

```json
{
  "organizationId": "org_123",
  "externalId": "ann_2026_009",
  "sourceApp": "EDUSYNCAI",
  "occurredAt": "2026-05-04T10:00:00.000Z",
  "version": "1.0.0",
  "payload": {
    "title": "Reunion des parents",
    "body": "La reunion aura lieu samedi a 9h.",
    "audience": ["PARENT", "STAFF"],
    "priority": "HIGH",
    "channel": "IN_APP"
  }
}
```

## Evenements de reference

Evenements minimum a standardiser:

- `identity.user.created`
- `identity.user.access_granted`
- `profile.updated`
- `student.created`
- `student.updated`
- `class.created`
- `class.updated`
- `payment.created`
- `payment.confirmed`
- `announcement.published`

## Regles de synchronisation

- toute creation ou mise a jour transverse doit produire un `SyncEvent`
- tout payload entrant doit soit creer, soit mettre a jour un `ExternalLink`
- les erreurs d'integration doivent etre persistantes et rejouables
- aucune application ne doit ecraser une entite hors de son domaine proprietaire

## Politique de visibilite transverse

Dans l'ecosysteme, les donnees metier completes ne doivent pas etre visibles par defaut pour tous les consommateurs.

Regle appliquee:

- les donnees de reference partagees par defaut sont limitees aux `parents`, `students` et `teachers`
- cette vue partagee doit exposer uniquement l'identite minimale et les identifiants centralises ou externes
- les domaines `payments`, `grades`, `attendance`, `classes` et autres details metier restent limites aux roles privilegies ou a l'application proprietaire
- les annonces doivent etre filtrees par audience si le consommateur n'est pas un role privilegie

Projection minimale recommandee pour l'annuaire partage:

- `id`
- `organizationId`
- `fullName` ou `firstName` et `lastName`
- `externalIds[]` avec `appSlug` et `externalId`
- les identifiants relationnels strictement necessaires comme `parentId` ou `classId`

## Endpoints deja presents dans Orbit

Les endpoints d'ingestion deja exposes dans [kcs-orbit-api/src/routes/integration.ingest.routes.ts](../kcs-orbit-api/src/routes/integration.ingest.routes.ts) couvrent deja un premier socle:

- `POST /api/integration/ingest/edupay/payments`
- `POST /api/integration/ingest/savanex/parents`
- `POST /api/integration/ingest/savanex/teachers`
- `POST /api/integration/ingest/savanex/students`
- `POST /api/integration/ingest/savanex/classes`
- `POST /api/integration/ingest/savanex/grades`
- `POST /api/integration/ingest/savanex/attendance`
- `POST /api/integration/ingest/edusyncai/announcements`

Endpoint de lecture partage ajoute pour les applications consommatrices:

- `GET /api/integration/read/shared-directory?organizationId=...`

Endpoints d'ecriture partages ajoutes pour les applications autorisees de l'ecosysteme:

- `POST /api/integration/registry/parent`
- `POST /api/integration/registry/student`
- `POST /api/integration/registry/teacher`
- `DELETE /api/integration/registry/{entityType}/{identifier}?organizationId=...&identifierType=orbitId|externalId`

Regles appliquees:

- `KCS_NEXUS`, `EDUSYNCAI` et `SAVANEX` peuvent creer ou supprimer ces entites via Orbit
- `EDUPAY` est explicitement exclu de ce mecanisme d'ecriture
- l'`externalId` est genere automatiquement par Orbit pour l'application appelante
- si une entite equivalente existe deja dans l'organisation, Orbit rejette la creation avec une reponse de conflit
- si une entite est deja liee a plusieurs applications, Orbit rejette la suppression pour eviter une suppression transverse destructive

Cet endpoint renvoie un annuaire transverse minimal et unifie pour `parents`, `students` et `teachers`, afin d'eviter aux frontends de recoller plusieurs endpoints metier distincts.

## Evolution recommandee du contrat

Phase suivante a implementer:

1. factoriser les schemas Zod partages dans un package commun
2. versionner les contrats par domaine
3. ajouter des endpoints sortants ou webhooks cibles
4. introduire une file persistante pour les evenements a retraiter