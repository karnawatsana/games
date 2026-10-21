-- Buckets: `result-screenshots` (private, per-user folder) and `avatars` (public read, per-user folder).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('result-screenshots', 'result-screenshots', false, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy shots_own_rw on storage.objects for all to authenticated
  using (bucket_id = 'result-screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'result-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_write on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');
