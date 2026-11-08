-- MACS 004: storage buckets and policies.
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('insignia', 'insignia', true),
  ('site', 'site', true),
  ('announcements', 'announcements', true),
  ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- public buckets: anyone reads, only permitted staff write
create policy "public read" on storage.objects for select
  using (bucket_id in ('avatars','insignia','site','announcements'));

create policy "own avatar write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff write insignia" on storage.objects for all to authenticated
  using (bucket_id = 'insignia' and public.has_perm('ranks.update'))
  with check (bucket_id = 'insignia' and public.has_perm('ranks.update'));
create policy "staff write site" on storage.objects for all to authenticated
  using (bucket_id = 'site' and public.has_perm('site.update'))
  with check (bucket_id = 'site' and public.has_perm('site.update'));
create policy "staff write announcements" on storage.objects for all to authenticated
  using (bucket_id = 'announcements' and public.has_perm('announcements.create'))
  with check (bucket_id = 'announcements' and public.has_perm('announcements.create'));

create policy "intel evidence read" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.has_perm('investigations.view'));
create policy "intel evidence write" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.has_perm('investigations.create'));
