ALTER TABLE "Parent"
ADD COLUMN "familyContacts" JSONB NOT NULL DEFAULT '[]'::jsonb;
