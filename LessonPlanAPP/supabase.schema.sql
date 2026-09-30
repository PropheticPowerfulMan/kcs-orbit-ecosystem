create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('administrator', 'principal', 'vice-principal', 'head-of-department', 'teacher')),
  department text not null default '',
  subjects text[] not null default '{}',
  grade_classes text[] not null default '{}',
  photo_url text not null default '',
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists photo_url text not null default '';

alter table public.profiles enable row level security;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_status()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select status from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_department()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select department from public.profiles where id = auth.uid()
$$;

drop policy if exists "profiles_select_active_or_self" on public.profiles;
create policy "profiles_select_active_or_self"
on public.profiles for select
using (
  auth.uid() = id
  or (
    public.current_profile_status() = 'active'
    and public.current_profile_role() in ('administrator', 'principal', 'vice-principal', 'head-of-department')
  )
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (
  auth.uid() = id
  and status = 'inactive'
  and role in ('administrator', 'principal', 'vice-principal', 'head-of-department', 'teacher')
);

drop policy if exists "profiles_update_self_or_authority" on public.profiles;
create policy "profiles_update_self_or_authority"
on public.profiles for update
using (
  (
    auth.uid() = id
    and public.current_profile_status() = 'active'
  )
  or (
    public.current_profile_status() = 'active'
    and public.current_profile_role() in ('administrator', 'principal', 'vice-principal')
  )
)
with check (
  (
    auth.uid() = id
    and public.current_profile_status() = 'active'
    and id = auth.uid()
  )
  or (
    public.current_profile_status() = 'active'
    and public.current_profile_role() in ('administrator', 'principal', 'vice-principal')
  )
);

drop policy if exists "profiles_delete_by_authority" on public.profiles;
create policy "profiles_delete_by_authority"
on public.profiles for delete
using (
  public.current_profile_status() = 'active'
  and public.current_profile_role() in ('administrator', 'principal', 'vice-principal')
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_status_idx on public.profiles(status);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    name,
    email,
    role,
    department,
    subjects,
    grade_classes,
    photo_url,
    status
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'teacher'),
    coalesce(nullif(new.raw_user_meta_data->>'department', ''), 'Teaching'),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'subjects', '[]'::jsonb))),
      '{}'
    ),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'grade_classes', '[]'::jsonb))),
      '{}'
    ),
    coalesce(nullif(new.raw_user_meta_data->>'photo_url', ''), ''),
    'inactive'
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    department = excluded.department,
    subjects = excluded.subjects,
    grade_classes = excluded.grade_classes,
    photo_url = excluded.photo_url,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_signup on auth.users;

create trigger create_profile_after_auth_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.confirm_auth_user_when_profile_activated()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    update auth.users
    set
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists confirm_auth_user_after_profile_activation on public.profiles;

create trigger confirm_auth_user_after_profile_activation
after update of status on public.profiles
for each row execute function public.confirm_auth_user_when_profile_activated();

create or replace function public.sync_profile_email_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = lower(new.email), updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_profile_email_after_auth_update on auth.users;

create trigger sync_profile_email_after_auth_update
after update of email on auth.users
for each row execute function public.sync_profile_email_from_auth_user();

create or replace function public.delete_auth_user_by_authority(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role text;
  actor_status text;
begin
  select role, status into actor_role, actor_status
  from public.profiles
  where id = auth.uid();

  if actor_status <> 'active' or actor_role not in ('administrator', 'principal', 'vice-principal') then
    raise exception 'Only active school authorities can delete user accounts.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot delete your own signed-in account.';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.delete_auth_user_by_authority(uuid) to authenticated;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_auth_user_password_by_authority(target_email text, new_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_role text;
  actor_status text;
begin
  select role, status into actor_role, actor_status
  from public.profiles
  where id = auth.uid();

  if actor_status <> 'active' or actor_role not in ('administrator', 'principal', 'vice-principal') then
    raise exception 'Only active school authorities can reset user passwords.';
  end if;

  if length(coalesce(new_password, '')) < 6 then
    raise exception 'Temporary password must contain at least 6 characters.';
  end if;

  update auth.users
  set
    encrypted_password = crypt(new_password, gen_salt('bf', 10)),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    reauthentication_token = '',
    recovery_sent_at = null,
    last_sign_in_at = null,
    updated_at = now()
  where lower(email) = lower(target_email);

  if not found then
    raise exception 'User account was not found.';
  end if;
end;
$$;

grant execute on function public.set_auth_user_password_by_authority(text, text) to authenticated;

create or replace function public.create_public_recovery_password(target_email text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target_user_id uuid;
  temporary_password text;
begin
  select profiles.id into target_user_id
  from public.profiles
  join auth.users on auth.users.id = profiles.id
  where lower(profiles.email) = lower(target_email)
    and profiles.status = 'active'
    and lower(auth.users.email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No active account was found for this email address.';
  end if;

  temporary_password :=
    upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6)) || '-' ||
    upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));

  update auth.users
  set
    encrypted_password = crypt(temporary_password, gen_salt('bf', 10)),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    reauthentication_token = '',
    recovery_sent_at = null,
    last_sign_in_at = null,
    updated_at = now()
  where id = target_user_id;

  return temporary_password;
end;
$$;

grant execute on function public.create_public_recovery_password(text) to anon, authenticated;

create table if not exists public.lesson_plans (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  department text not null default '',
  status text not null default 'draft',
  payload jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lesson_plans enable row level security;

drop policy if exists "lesson_plans_select_by_authority" on public.lesson_plans;
create policy "lesson_plans_select_by_authority"
on public.lesson_plans for select
using (
  owner_id = auth.uid()
  or (
    public.current_profile_status() = 'active'
    and (
      public.current_profile_role() in ('administrator', 'principal', 'vice-principal')
      or (public.current_profile_role() = 'head-of-department' and public.current_profile_department() = lesson_plans.department)
    )
  )
);

drop policy if exists "lesson_plans_insert_own" on public.lesson_plans;
create policy "lesson_plans_insert_own"
on public.lesson_plans for insert
with check (owner_id = auth.uid());

drop policy if exists "lesson_plans_update_by_owner_or_authority" on public.lesson_plans;
create policy "lesson_plans_update_by_owner_or_authority"
on public.lesson_plans for update
using (
  owner_id = auth.uid()
  or (
    public.current_profile_status() = 'active'
    and (
      public.current_profile_role() in ('administrator', 'principal', 'vice-principal')
      or (public.current_profile_role() = 'head-of-department' and public.current_profile_department() = lesson_plans.department)
    )
  )
)
with check (
  owner_id = auth.uid()
  or (
    public.current_profile_status() = 'active'
    and (
      public.current_profile_role() in ('administrator', 'principal', 'vice-principal')
      or (public.current_profile_role() = 'head-of-department' and public.current_profile_department() = lesson_plans.department)
    )
  )
);

create index if not exists lesson_plans_owner_idx on public.lesson_plans(owner_id);
create index if not exists lesson_plans_department_idx on public.lesson_plans(department);
create index if not exists lesson_plans_status_idx on public.lesson_plans(status);

create table if not exists public.app_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  audience text not null check (audience in ('all', 'role', 'department', 'user')),
  target text not null default '',
  subject text not null default '',
  body text not null default '',
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_messages add column if not exists updated_at timestamptz not null default now();

alter table public.app_messages enable row level security;

drop policy if exists "app_messages_select_sender_or_recipient" on public.app_messages;
create policy "app_messages_select_sender_or_recipient"
on public.app_messages for select
using (
  public.current_profile_status() = 'active'
  and (
    sender_id = auth.uid()
    or audience = 'all'
    or (audience = 'user' and target = auth.uid()::text)
    or (audience = 'role' and target = public.current_profile_role())
    or (audience = 'department' and target = public.current_profile_department())
  )
);

drop policy if exists "app_messages_insert_active_sender" on public.app_messages;
create policy "app_messages_insert_active_sender"
on public.app_messages for insert
with check (
  public.current_profile_status() = 'active'
  and sender_id = auth.uid()
);

drop policy if exists "app_messages_update_read_by_recipients" on public.app_messages;
create policy "app_messages_update_read_by_recipients"
on public.app_messages for update
using (
  public.current_profile_status() = 'active'
  and (
    sender_id = auth.uid()
    or audience = 'all'
    or (audience = 'user' and target = auth.uid()::text)
    or (audience = 'role' and target = public.current_profile_role())
    or (audience = 'department' and target = public.current_profile_department())
  )
)
with check (
  public.current_profile_status() = 'active'
  and (
    sender_id = auth.uid()
    or audience = 'all'
    or (audience = 'user' and target = auth.uid()::text)
    or (audience = 'role' and target = public.current_profile_role())
    or (audience = 'department' and target = public.current_profile_department())
  )
);

drop policy if exists "app_messages_delete_by_sender" on public.app_messages;
create policy "app_messages_delete_by_sender"
on public.app_messages for delete
using (
  public.current_profile_status() = 'active'
  and sender_id = auth.uid()
);

create index if not exists app_messages_sender_idx on public.app_messages(sender_id);
create index if not exists app_messages_audience_idx on public.app_messages(audience, target);
create index if not exists app_messages_created_at_idx on public.app_messages(created_at desc);

create table if not exists public.curriculum_items (
  id text primary key,
  payload jsonb not null,
  academic_year text not null default '',
  term text not null default '',
  grade text not null default '',
  subject text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.curriculum_items enable row level security;

drop policy if exists "curriculum_items_select_active_users" on public.curriculum_items;
create policy "curriculum_items_select_active_users"
on public.curriculum_items for select
using (
  public.current_profile_status() = 'active'
);

drop policy if exists "curriculum_items_manage_by_authority" on public.curriculum_items;
create policy "curriculum_items_manage_by_authority"
on public.curriculum_items for all
using (
  public.current_profile_status() = 'active'
  and public.current_profile_role() in ('administrator', 'principal', 'vice-principal', 'head-of-department')
)
with check (
  public.current_profile_status() = 'active'
  and public.current_profile_role() in ('administrator', 'principal', 'vice-principal', 'head-of-department')
);

create index if not exists curriculum_items_academic_year_idx on public.curriculum_items(academic_year);
create index if not exists curriculum_items_term_idx on public.curriculum_items(term);
create index if not exists curriculum_items_grade_idx on public.curriculum_items(grade);
create index if not exists curriculum_items_subject_idx on public.curriculum_items(subject);
