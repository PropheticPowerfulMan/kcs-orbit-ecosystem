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
.\start-ecosystem.cmd
```

Pour ouvrir automatiquement les interfaces web dans le navigateur par defaut:

```powershell
.\start-ecosystem.cmd -OpenBrowser
```

Pour relancer vite apres une premiere preparation des bases:

```powershell
.\start-ecosystem.cmd -SkipDatabasePreparation
```

Pour repartir proprement et eviter les doublons de processus:

```powershell
.\start-ecosystem.cmd -Restart -SkipDatabasePreparation
```

Le script:

- verifie PostgreSQL local
- prepare les bases Orbit, KCS Nexus, EduPay et SAVANEX
- recupere l'`organizationId` Orbit
- evite de relancer un service si son port est deja en ecoute
- ouvre une fenetre PowerShell par service avec les bons ports et variables d'integration
- attend que les ports locaux soient prets avant d'afficher le recapitulatif
- ecrit les logs dans `var/logs`

### Arreter tout l'ecosysteme

```powershell
Set-Location "c:\Users\user\Downloads\Aexams\Ecosystem"
.\stop-ecosystem.cmd
```

Le script:

- ferme les fenetres PowerShell ouvertes par `start-ecosystem.ps1`
- coupe aussi tout processus restant a l'ecoute sur les ports ecosysteme

Option brutale si un process resiste:

```powershell
.\stop-ecosystem.cmd -Force
```

## Options du lanceur

```powershell
.\start-ecosystem.cmd -SkipDatabasePreparation
.\start-ecosystem.cmd -SkipInstall
.\start-ecosystem.cmd -NoFrontends
.\start-ecosystem.cmd -OpenBrowser
.\start-ecosystem.cmd -Restart
.\start-ecosystem.cmd -NoWait
```

- `-SkipDatabasePreparation` : relance sans refaire `db push` / migrations
- `-SkipInstall` : saute le check d'installation pour `EduPay` web
- `-NoFrontends` : demarre seulement les backends
- `-OpenBrowser` : ouvre automatiquement les frontends locaux dans le navigateur par defaut
- `-Restart` : arrete les services ecosysteme existants avant de relancer
- `-NoWait` : n'attend pas l'ouverture des ports avant le recapitulatif

## URLs locales

- Orbit API : `http://localhost:4500`
- KCS Nexus API : `http://localhost:5000`
- KCS Nexus frontend : `http://localhost:5173/`
- EduPay API : `http://localhost:4000`
- EduPay web : `http://localhost:5174/EduPay-Smart-System/`
- EduSync AI API : `http://localhost:8000` par defaut. Si ce port est bloque par Windows, le lanceur bascule sur `8010`, `8011` ou `8012` et connecte automatiquement le frontend.
- EduSync AI frontend : `http://localhost:5175/`
- SAVANEX API : `http://localhost:8001/`
- SAVANEX frontend : `http://localhost:3000/Syst-me-de-gestion-scolaire/`

## Notes pratiques

- `kcs-orbit-api` est le point central d'integration.
- `KCS Nexus` consomme Orbit pour les vues consolidees quand les variables d'integration sont presentes.
- `SAVANEX` est lance en local sur SQLite via le script racine pour simplifier le demarrage.
- En local, `SAVANEX` garantit un compte admin de test: `admin` / `admin123`.
- `EduPay` et `Orbit` utilisent PostgreSQL local dans la procedure racine actuelle.
- `EduSync AI` utilise `EDUSYNC_AI_API_PORT` si tu veux forcer un port precis.

## Documentation d'architecture

- [architecture/ECOSYSTEM_BLUEPRINT.md](c:\Users\user\Downloads\Aexams\Ecosystem\architecture\ECOSYSTEM_BLUEPRINT.md)
- [architecture/DATA_CONTRACTS.md](c:\Users\user\Downloads\Aexams\Ecosystem\architecture\DATA_CONTRACTS.md)
- [architecture/INTEGRATION_SETUP.md](c:\Users\user\Downloads\Aexams\Ecosystem\architecture\INTEGRATION_SETUP.md)
- [architecture/MIGRATION_ROADMAP.md](c:\Users\user\Downloads\Aexams\Ecosystem\architecture\MIGRATION_ROADMAP.md)
- [architecture/PRODUCTION_DEPLOYMENT.md](c:\Users\user\Downloads\Aexams\Ecosystem\architecture\PRODUCTION_DEPLOYMENT.md)

## Demarrage manuel par service

La procedure d'integration et l'ordre recommande restent documentes dans [architecture/INTEGRATION_SETUP.md](c:\Users\user\Downloads\Aexams\Ecosystem\architecture\INTEGRATION_SETUP.md).

Les documentations de service restent disponibles dans:

- [kcs-orbit-api/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\kcs-orbit-api\README.md)
- [KCS Nexus/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\KCS Nexus\README.md)
- [EduPay Smart System/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\EduPay Smart System\README.md)
- [EduSync AI/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\EduSync AI\README.md)
- [SAVANEX Project/README.md](c:\Users\user\Downloads\Aexams\Ecosystem\SAVANEX Project\README.md)
