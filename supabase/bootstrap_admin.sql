-- Create the FIRST account (Minister + System Administrator). Run once in the Supabase SQL editor.
-- 1) Dashboard → Authentication → Users → "Add user":
--      email    = <username>@macs.internal   (must match VITE_AUTH_EMAIL_DOMAIN)
--      password = strong password, tick "Auto Confirm User"
-- 2) Set the username / name below, then run.
-- Also disable public sign-ups: Authentication → Providers → Email → turn OFF "Allow new users to sign up".

do $$
declare
  v_username text := 'minister';           -- change
  v_name     text := 'اسم الوزير';          -- change
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = v_username || '@macs.internal';
  if v_uid is null then raise exception 'Create the auth user first'; end if;

  insert into public.profiles (id, username, full_name) values (v_uid, v_username, v_name);
  insert into public.personnel (user_id, military_number, rank_id, department_id)
    select v_uid, 'MACS-0001', id, null from public.ranks where code = 'minister';
  insert into public.user_roles (user_id, role_id)
    select v_uid, id from public.roles where code in ('minister','system_administrator');
end $$;
