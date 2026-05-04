# KCS Orbit Ecosystem

Mono-repo local qui regroupe les applications suivantes dans un meme workspace:

- `kcs-orbit-api` : noyau central d'integration et de lecture consolidee
- `KCS Nexus` : portail web + backend scolaire federateur
- `EduPay Smart System` : paiements et suivi financier
- `EduSync AI` : communication, annonces et automatisation
- `SAVANEX Project` : gestion scolaire academique
- `packages/shared-contracts` : contrats partages TypeScript/Zod

Chaque application reste autonome, mais l'ecosysteme peut etre demarre localement avec un seul script racine.

## Prerequis

- Windows PowerShell
- Node.js et npm
- pnpm
- PostgreSQL local accessible sur `localhost:5432`
- Python local pour `EduSync AI` et `SAVANEX`

## Scripts racine

### Demarrer tout l'ecosysteme

Depuis la racine du repo:

```powershell
Set-Location "c:\Users\user\Downloads\Aexams\Ecosystem"
.\start-ecosystem.ps1
```

Pour ouvrir automatiquement les interfaces web dans le navigateur par defaut:

```powershell
.\start-ecosystem.ps1 -OpenBrowser
```

Le script:

- verifie PostgreSQL local
- prepare les bases Orbit, KCS Nexus et EduPay
- recupere l'`organizationId` Orbit
- ouvre une fenetre PowerShell par service avec les bons ports et variables d'integration

### Arreter tout l'ecosysteme

```powershell
Set-Location "c:\Users\user\Downloads\Aexams\Ecosystem"
.\stop-ecosystem.ps1
```

Le script:

- ferme les fenetres PowerShell ouvertes par `start-ecosystem.ps1`
- coupe aussi tout processus restant a l'ecoute sur les ports ecosysteme

Option brutale si un process resiste:

```powershell
.\stop-ecosystem.ps1 -Force
```

## Options du lanceur

```powershell
.\start-ecosystem.ps1 -SkipDatabasePreparation
.\start-ecosystem.ps1 -SkipInstall
.\start-ecosystem.ps1 -NoFrontends
.\start-ecosystem.ps1 -OpenBrowser
```

- `-SkipDatabasePreparation` : relance sans refaire `db push` / migrations
- `-SkipInstall` : saute le check d'installation pour `EduPay` web
- `-NoFrontends` : demarre seulement les backends
- `-OpenBrowser` : ouvre automatiquement les frontends locaux dans le navigateur par defaut

## URLs locales

- Orbit API : `http://localhost:4500`
- KCS Nexus API : `http://localhost:5000`
- KCS Nexus frontend : `http://localhost:5173/`
- EduPay API : `http://localhost:4000`
- EduPay web : `http://localhost:5174/EduPay-Smart-System/`
- EduSync AI API : `http://localhost:8000`
- EduSync AI frontend : `http://localhost:5175/`
- SAVANEX API : `http://localhost:8001/`
- SAVANEX frontend : `http://localhost:3000/Syst-me-de-gestion-scolaire/`

## Notes pratiques

- `kcs-orbit-api` est le point central d'integration.
- `KCS Nexus` consomme Orbit pour les vues consolidees quand les variables d'integration sont presentes.
- `SAVANEX` est lance en local sur SQLite via le script racine pour simplifier le demarrage.
- `EduPay` et `Orbit` utilisent PostgreSQL local dans la procedure racine actuelle.

## Demarrage manuel par service

La procedure d'integration et l'ordre recommande restent documentes dans [architecture/INTEGRATION_SETUP.md](c:\Users\user\Downloads\Aexams\Ecosystem\architecture\INTEGRATION_SETUP.md).

Les documentations de service restent disponibles dans:

- [kcs-orbit-api/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\kcs-orbit-api\README.md)
- [KCS Nexus/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\KCS Nexus\README.md)
- [EduPay Smart System/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\EduPay Smart System\README.md)
- [EduSync AI/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\EduSync AI\README.md)
- [SAVANEX Project/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\SAVANEX Project\README.md)