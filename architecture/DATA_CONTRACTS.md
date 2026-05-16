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

## Noyau canonique d'identite

Pour reduire les divergences entre SAVANEX, EduPay, KCS Nexus, EduSync AI et Orbit, le noyau canonique adopte les regles suivantes:

- `student` expose toujours `firstName`, `lastName`, `fullName`, `studentNumber`, `email`, `phone`, `dateOfBirth`, `status`, `mustChangePassword`, `classId|className`, `parentId`, `organizationId`, `externalIds[]`
- `parent` expose toujours `fullName`, `phone`, `email`, `accessCode`, `mustChangePassword`, et idealement aussi `firstName`, `middleName`, `lastName` quand l'application sait les reconstruire
- `teacher` expose toujours `fullName`, `phone`, `email`, `subject`, `mustChangePassword`, et idealement aussi `firstName`, `middleName`, `lastName`, `employeeId`, `employeeType`, `department`, `jobTitle`
- `studentNumber` represente l'identifiant visible par les utilisateurs; Orbit privilegie l'`externalId` de l'application proprietaire quand il existe
- `externalIds[]` reste la source de verite transverse pour les correspondances inter-applications
- `className` peut etre derive localement si seule une reference `classId` existe, mais le contrat partage doit l'exposer quand il est connu
- les classes canoniques vont de `K3` a `K5`, puis de `Grade 1` a `Grade 12`; le suffixe `A`, `B`, `C`, etc. est optionnel et ne doit jamais remplacer le niveau de base
- un mot de passe genere par le systeme reste local a l'application qui le cree; l'ecosysteme partage `accessCode` et `mustChangePassword` pour que chaque application puisse ouvrir l'espace concerne et demander ensuite un changement volontaire du mot de passe

Cette normalisation permet de garder les modeles locaux existants tout en rendant la lecture transverse coherente.

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
    "middleName": "Mbuyi",
    "lastName": "Ilunga",
    "gender": "F",
    "studentNumber": "STU-2026-001",
    "classExternalId": "sav_class_6A",
    "className": "Grade 6 A",
    "parentExternalId": "sav_parent_033",
    "email": "grace@example.org",
    "phone": "+243000000000",
    "dateOfBirth": "2014-01-20",
    "status": "ACTIVE",
    "mustChangePassword": true
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
    "name": "Grade 6 A",
    "gradeLevel": "Grade 6",
    "suffix": "A",
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

### SharedDirectory

Projection canonique recommandee pour `GET /api/integration/read/shared-directory`:

```json
{
  "source": "orbit",
  "visibility": "shared-directory",
  "students": [
    {
      "id": "std_001",
      "fullName": "Grace Mbuyi Ilunga",
      "firstName": "Grace",
      "middleName": "Mbuyi",
      "lastName": "Ilunga",
      "studentNumber": "STU-2026-001",
      "email": "grace@example.org",
      "phone": "+243000000000",
      "dateOfBirth": "2014-01-20T00:00:00.000Z",
      "status": "ACTIVE",
      "mustChangePassword": true,
      "classId": "cls_6a",
      "className": "6A",
      "parentId": "par_033",
      "organizationId": "org_123",
      "externalIds": [
        { "appSlug": "SAVANEX", "externalId": "sav_student_001" }
      ]
    }
  ],
  "parents": [
    {
      "id": "par_033",
      "fullName": "Jean Pierre Ilunga",
      "firstName": "Jean",
      "middleName": "Pierre",
      "lastName": "Ilunga",
      "phone": "+243000000001",
      "email": "jean.ilunga@example.org",
      "mustChangePassword": true,
      "organizationId": "org_123",
      "studentIds": ["std_001"],
      "externalIds": [
        { "appSlug": "SAVANEX", "externalId": "sav_parent_033" }
      ]
    }
  ],
  "teachers": [
    {
      "id": "tea_011",
      "fullName": "Aline Kabeya",
      "firstName": "Aline",
      "middleName": null,
      "lastName": "Kabeya",
      "phone": "+243000000002",
      "email": "aline.kabeya@example.org",
      "subject": "Mathematiques",
      "employeeId": "SAV-EMP-00000001",
      "employeeType": "TEACHER",
      "department": "Academique",
      "jobTitle": "Enseignante",
      "mustChangePassword": true,
      "organizationId": "org_123",
      "externalIds": [
        { "appSlug": "SAVANEX", "externalId": "sav_teacher_011" }
      ]
    }
  ]
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

### NexusAcademicSignal

Source: KCS Nexus / Nexus AI  
Destination: SAVANEX Intelligence

Ce contrat couvre les notes, evaluations, devoirs, competences, observations pedagogiques et recommandations IA. SAVANEX les transforme en evenements d'evolution afin que les rapports de periode incluent aussi la partie science, pedagogie et academique geree dans Nexus.

```json
{
  "organizationId": "org_123",
  "externalId": "nexus_grade_001",
  "sourceApp": "KCS_NEXUS",
  "occurredAt": "2026-05-15T10:00:00.000Z",
  "version": "1.0.0",
  "payload": {
    "eventType": "grade",
    "studentExternalId": "STU-2026-001",
    "studentNumber": "STU-2026-001",
    "studentName": "Grace Mbuyi Ilunga",
    "subject": "Mathematiques",
    "title": "Quiz fractions",
    "score": 12,
    "maxScore": 100,
    "percentage": 60,
    "excellenceScale": {
      "passThreshold": 75,
      "classicalEquivalentAtPass": 50
    },
    "term": "T1",
    "teacherName": "Aline Kabeya",
    "riskLevel": "medium",
    "recommendation": "Prevoir une remediation ciblee sur les fractions."
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
- `nexus.academic.signal`
- `nexus.grade.published`
- `nexus.pedagogy.observed`
- `nexus.ai.recommendation`

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
- `fullName`, et si possible `firstName`, `middleName`, `lastName`
- `studentNumber` pour les eleves
- `className` quand disponible
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

- `KCS_NEXUS`, `EDUSYNCAI`, `SAVANEX` et `EDUPAY` peuvent creer ou supprimer ces entites via Orbit
- quand `EDUPAY` cree une famille, le parent et les eleves sont d'abord inscrits dans Orbit puis synchronises dans le miroir local EduPay avec le code d'acces et l'etat `mustChangePassword`
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
