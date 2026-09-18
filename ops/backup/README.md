# Sauvegarde de production de l'ecosysteme

Ce dispositif sauvegarde les bases PostgreSQL, les bases SQLite de transition et les repertoires persistants. Il cree une archive verifiee par SHA-256, applique une retention quotidienne, hebdomadaire et mensuelle, et peut chiffrer puis copier l'archive hors du VPS.

## Garanties

- `pg_dump` produit une sauvegarde coherente sans arreter PostgreSQL.
- SQLite utilise `.backup`, pas une copie de fichier potentiellement incoherente.
- `flock` interdit deux executions simultanees.
- Une execution incomplete ne publie pas une sauvegarde reussie.
- `restore.sh` n'ecrase rien : il extrait seulement vers un dossier vide et controle les sommes SHA-256.
- Une copie sur le meme VPS ne suffit pas. Configurez `BACKUP_RCLONE_DESTINATION` vers un stockage externe.

## Installation sur le VPS Linux

1. Installer `postgresql-client`, `sqlite3`, `tar`, et facultativement `age` et `rclone`.
2. Placer le depot sous `/opt/kcs-orbit/app`, ou adapter `ExecStart` dans le service systemd.
3. Copier `backup.env.example` vers `/etc/kcs-orbit/backup.env`.
4. Renseigner les URL et chemins reels, puis appliquer `chmod 600 /etc/kcs-orbit/backup.env`.
5. Copier les fichiers de `systemd/` sous `/etc/systemd/system/`.
6. Executer `systemctl daemon-reload` puis `systemctl enable --now kcs-orbit-backup.timer`.
7. Tester avec `systemctl start kcs-orbit-backup.service` et lire `journalctl -u kcs-orbit-backup.service`.

## Test de restauration

Toujours extraire dans un dossier temporaire distinct :

```bash
sudo ./restore.sh --archive /opt/kcs-orbit/backups/daily/ARCHIVE.tar.gz --extract-to /var/tmp/kcs-restore-test
```

Pour une archive chiffree, ajouter `--age-identity /chemin/identity.txt`. Restaurer un dump dans une base de test, jamais directement en production pendant la verification :

```bash
createdb kcs_restore_test
pg_restore --no-owner --dbname=kcs_restore_test /var/tmp/kcs-restore-test/postgresql/orbit.dump
```

## Deploiements et donnees navigateur

Le pipeline doit appeler `pre-deploy-backup.sh`; son echec bloque le deploiement. Les schemas utilisent des migrations versionnees et aucune option acceptant une perte de donnees.

Une sauvegarde serveur ne protege jamais les preferences d'interface conservees dans `localStorage`. Les paiements, allocations, echeanciers, depenses, recus et autres donnees financieres officielles d'EduPay sont persistants dans PostgreSQL; seuls les jetons de session, caches de lecture et preferences d'interface restent dans le navigateur.

## Audit automatique et resilience

`audit.sh` controle chaque jour la fraicheur de la derniere archive, l'espace disque, la lecture du tar, les sommes SHA-256, les catalogues `pg_restore` et la presence de la copie hors site. Installer egalement `kcs-orbit-backup-audit.service` et `.timer` pour rendre ce controle independant du job de creation.

Une archive locale verifiee protege contre une erreur applicative, mais pas contre la perte complete du VPS. Pour cette raison, `BACKUP_RCLONE_DESTINATION` et, de preference, `BACKUP_AGE_RECIPIENT` doivent etre configures avant de considerer le plan de reprise comme complet. Une restauration d'essai dans une base isolee doit etre executee au minimum chaque trimestre.