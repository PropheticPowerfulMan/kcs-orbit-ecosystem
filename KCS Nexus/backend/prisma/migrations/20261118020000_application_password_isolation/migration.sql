CREATE TABLE IF NOT EXISTS "ApplicationCredential" (
 "id" TEXT PRIMARY KEY, "application" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "passwordHash" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
 "loginLockedUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "changedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationCredential_application_userId_key" ON "ApplicationCredential"("application","userId");
CREATE TABLE IF NOT EXISTS "ApplicationPasswordResetToken" (
 "id" TEXT PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE, "credentialId" TEXT NOT NULL REFERENCES "ApplicationCredential"("id") ON DELETE CASCADE,
 "credentialVersion" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ApplicationPasswordResetToken_credentialId_expiresAt_idx" ON "ApplicationPasswordResetToken"("credentialId","expiresAt");
INSERT INTO "ApplicationCredential" ("id","application","userId","passwordHash")
 SELECT 'app-'||a.application||'-'||u.id,a.application,u.id,u."passwordHash"
 FROM "User" u CROSS JOIN (VALUES ('KCS_SENTINEL'),('KCS_ACADEMY'),('KCS_KITCHEN')) a(application)
 WHERE u."passwordHash" IS NOT NULL ON CONFLICT ("application","userId") DO NOTHING;
CREATE OR REPLACE FUNCTION kcs_seed_application_credentials() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."passwordHash" IS NOT NULL THEN
  INSERT INTO "ApplicationCredential" ("id","application","userId","passwordHash")
   SELECT 'app-'||a.application||'-'||NEW.id,a.application,NEW.id,NEW."passwordHash"
   FROM (VALUES ('KCS_SENTINEL'),('KCS_ACADEMY'),('KCS_KITCHEN')) a(application)
   ON CONFLICT ("application","userId") DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS kcs_initial_application_credentials ON "User";
CREATE TRIGGER kcs_initial_application_credentials AFTER INSERT OR UPDATE OF "passwordHash" ON "User"
 FOR EACH ROW EXECUTE FUNCTION kcs_seed_application_credentials();
