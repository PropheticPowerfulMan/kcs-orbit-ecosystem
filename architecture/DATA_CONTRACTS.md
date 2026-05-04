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

## Evolution recommandee du contrat

Phase suivante a implementer:

1. factoriser les schemas Zod partages dans un package commun
2. versionner les contrats par domaine
3. ajouter des endpoints sortants ou webhooks cibles
4. introduire une file persistante pour les evenements a retraiter