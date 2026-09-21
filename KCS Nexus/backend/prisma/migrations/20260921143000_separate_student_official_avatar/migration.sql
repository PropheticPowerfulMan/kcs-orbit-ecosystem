ALTER TABLE "StudentProfile" ADD COLUMN "officialAvatar" TEXT;

UPDATE "StudentProfile" AS profile
SET "officialAvatar" = account."avatar"
FROM "User" AS account
WHERE profile."userId" = account."id"
  AND account."avatar" IS NOT NULL;
