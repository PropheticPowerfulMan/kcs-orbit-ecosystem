# Super Administrateur

Ce compte donne le role `ADMIN`. Dans l'application, ce role a un acces global: dashboard administrateur, routes admin, et bypass des restrictions de roles pour les espaces et API proteges.

## Identifiants de test

- Email: `superadmin@kcsnexus.com`
- Mot de passe: `SuperAdmin123!`
- Dashboard: `/admin`

Ces identifiants sont aussi proposes dans la page de login avec le bouton `Super admin`.

## Creer ou mettre a jour le compte

```bash
cd backend
npm run superadmin:upsert
```

Le script cree le compte s'il n'existe pas. S'il existe deja avec le meme email, il met a jour le nom, le mot de passe et force le role `ADMIN`.

## Changer les identifiants plus tard

Modifiez ces variables dans `backend/.env`, puis relancez `npm run superadmin:upsert`:

```env
SUPERADMIN_EMAIL=superadmin@kcsnexus.com
SUPERADMIN_PASSWORD=SuperAdmin123!
SUPERADMIN_FIRSTNAME=Super
SUPERADMIN_LASTNAME=Admin
```

Changez le mot de passe avant un deploiement public.
