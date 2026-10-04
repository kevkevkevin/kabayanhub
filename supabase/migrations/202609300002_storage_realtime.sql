insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('avatars','avatars',true,2097152,array['image/jpeg']),
 ('market-images','market-images',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy hub_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and name='social/avatars/'||(select auth.uid())::text||'/avatar.jpg');
create policy hub_avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and name='social/avatars/'||(select auth.uid())::text||'/avatar.jpg') with check(bucket_id='avatars' and name='social/avatars/'||(select auth.uid())::text||'/avatar.jpg');
create policy hub_avatar_select on storage.objects for select using(bucket_id='avatars');
create policy hub_avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and name='social/avatars/'||(select auth.uid())::text||'/avatar.jpg');
create policy hub_market_images_read on storage.objects for select using(bucket_id='market-images');
create policy hub_market_images_admin on storage.objects for all to authenticated using(bucket_id='market-images' and hub_private.is_admin()) with check(bucket_id='market-images' and name like 'market/products/%' and hub_private.is_admin());

do $$ declare t text; begin
 foreach t in array array['social_profiles','follows','tambayan_chat','tambayan_stickers','tambayan_config','tambayan_live','moments'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
