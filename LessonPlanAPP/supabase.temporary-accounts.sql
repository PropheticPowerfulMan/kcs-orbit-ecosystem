-- Temporary production accounts for KCS presentation.
-- Run this once in Supabase SQL Editor, then ask each user to change password after first access.
-- Shared temporary password for all accounts: KCS-Temp-2026!

create extension if not exists pgcrypto with schema extensions;

create or replace function public.upsert_temporary_auth_user(
  user_email text,
  user_password text,
  profile_name text,
  profile_role text,
  profile_department text,
  profile_subjects text[] default '{}',
  profile_grade_classes text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing_user_id uuid;
  next_user_id uuid;
begin
  select id into existing_user_id
  from auth.users
  where email = lower(user_email)
  limit 1;

  next_user_id := coalesce(existing_user_id, extensions.gen_random_uuid());

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    next_user_id,
    'authenticated',
    'authenticated',
    lower(user_email),
    extensions.crypt(user_password, extensions.gen_salt('bf')),
    now(),
    null,
    '',
    null,
    '',
    null,
    '',
    '',
    null,
    null,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'name', profile_name,
      'role', profile_role,
      'department', profile_department,
      'subjects', profile_subjects,
      'grade_classes', profile_grade_classes
    ),
    false,
    now(),
    now(),
    null,
    null,
    '',
    '',
    null,
    '',
    0,
    null,
    '',
    null,
    false,
    null
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = now(),
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
  )
  values (
    next_user_id::text,
    next_user_id,
    jsonb_build_object('sub', next_user_id::text, 'email', lower(user_email)),
    'email',
    null,
    now(),
    now(),
    extensions.gen_random_uuid()
  )
  on conflict (provider, provider_id) do update set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

  insert into public.profiles (
    id,
    name,
    email,
    role,
    department,
    subjects,
    grade_classes,
    status
  )
  values (
    next_user_id,
    profile_name,
    lower(user_email),
    profile_role,
    profile_department,
    profile_subjects,
    profile_grade_classes,
    'active'
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    department = excluded.department,
    subjects = excluded.subjects,
    grade_classes = excluded.grade_classes,
    status = 'active',
    updated_at = now();

  return next_user_id;
end;
$$;

select public.upsert_temporary_auth_user(
  'admin.temp@kcs.school',
  'KCS-Temp-2026!',
  'Temporary Administrator',
  'administrator',
  'Administration'
);

select public.upsert_temporary_auth_user(
  'principal.temp@kcs.school',
  'KCS-Temp-2026!',
  'Temporary Principal',
  'principal',
  'Administration'
);

select public.upsert_temporary_auth_user(
  'viceprincipal.temp@kcs.school',
  'KCS-Temp-2026!',
  'Temporary Vice Principal',
  'vice-principal',
  'Administration'
);

select public.upsert_temporary_auth_user(
  'hod.english.temp@kcs.school',
  'KCS-Temp-2026!',
  'Temporary English HOD',
  'head-of-department',
  'English',
  array['English', 'English (Writing and Grammar)'],
  array['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8']
);

select public.upsert_temporary_auth_user(
  'teacher.temp@kcs.school',
  'KCS-Temp-2026!',
  'Temporary Teacher',
  'teacher',
  'Teaching',
  array['English', 'Mathematics', 'Science'],
  array['K3', 'K4', 'K5', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']
);

drop function public.upsert_temporary_auth_user(text, text, text, text, text, text[], text[]);
