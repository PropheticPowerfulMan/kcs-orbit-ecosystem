-- Reset base authority passwords without deleting accounts or profiles.
-- Temporary password: KCS-Temp-2026!

create extension if not exists pgcrypto with schema extensions;

update auth.users
set
  encrypted_password = extensions.crypt('KCS-Temp-2026!', extensions.gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where email in (
  'admin.temp@kcs.school',
  'principal.temp@kcs.school',
  'viceprincipal.temp@kcs.school',
  'hod.english.temp@kcs.school'
);
