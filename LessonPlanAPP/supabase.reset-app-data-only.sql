-- Final production reset: application data only.
-- This keeps auth.users and public.profiles, including temporary authority accounts.

begin;

delete from public.lesson_plans;
delete from public.curriculum_items;

commit;
