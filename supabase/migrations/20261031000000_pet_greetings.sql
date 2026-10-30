-- ============================================
-- 2026/10/31 うちの子への「ひとこと」 (pet_greetings)
--   King「サイト内での会員同士のコミュニケーションをもっと活発にしたい」。
--   うちの子は 29 匹・写真 16 枚まで増えたのに、うちの子に反応する手段が無く、住人同士のやりとりは 0 だった。
--   /pet/<id> で、街の人が「ようこそ」などのひとこと (80 字まで) を残せる。飼い主さんも同じ欄で返事ができる。
--   - 住人あて: 自分の子にひとこと → 飼い主さんにメール。飼い主さんが返事 → 30 日以内に声をかけた人にメール
--     (notify-town-activity。kind = greeting / greeting_reply。1 人 6 時間に 1 通の決まりは今までどおり)
--   - 運営あて: 住民のひとことは support@ の新着にも載る (admin_greeting)。うちの子の登録の通知から /pet/<id> へ行けるように。
--   - 消せるのは 書いた本人・その子の飼い主さん・運営 (role=admin)。書き換えは無し。
--   - 連投よけ: 同じ子へは 10 分に 1 回、1 人 1 日 30 回まで。
-- ============================================

create table if not exists public.pet_greetings (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists pet_greetings_pet_idx on public.pet_greetings (pet_id, created_at);
create index if not exists pet_greetings_user_idx on public.pet_greetings (user_id, created_at desc);

alter table public.pet_greetings enable row level security;

drop policy if exists pet_greetings_select on public.pet_greetings;
create policy pet_greetings_select on public.pet_greetings for select using (true);

drop policy if exists pet_greetings_insert on public.pet_greetings;
create policy pet_greetings_insert on public.pet_greetings for insert to authenticated with check (
  pet_greetings.user_id = auth.uid()
  and exists (select 1 from public.pets p where p.id = pet_greetings.pet_id)
  and not exists (select 1 from public.profiles pr where pr.id = auth.uid() and coalesce(pr.is_suspended, false))
  and not exists (select 1 from public.pet_greetings g
                   where g.user_id = auth.uid() and g.pet_id = pet_greetings.pet_id
                     and g.created_at > now() - interval '10 minutes')
  and (select count(*) from public.pet_greetings g
        where g.user_id = auth.uid() and g.created_at > now() - interval '1 day') < 30
);

drop policy if exists pet_greetings_delete on public.pet_greetings;
create policy pet_greetings_delete on public.pet_greetings for delete to authenticated using (
  pet_greetings.user_id = auth.uid()
  or exists (select 1 from public.pets p where p.id = pet_greetings.pet_id and p.owner_id = auth.uid())
  or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
);

-- 住民あて: 写真への いいね/コメント/返信 に、うちの子へのひとこと と 飼い主さんの返事 を足す
--   post_id / post_image / post_caption は、ひとことの時は うちの子の id / 写真 / 名前 を入れる
--   greeting_reply は 1 つの返事を複数の人に知らせるので、ref_id は (返事の id, 相手) から作る
create or replace function public.town_activity_owner_pending()
returns table (kind text, ref_id uuid, recipient uuid, email text, display_name text, token uuid,
               actor_name text, post_id uuid, post_image text, post_caption text, content text, created_at timestamptz)
language plpgsql security definer set search_path to 'public', 'auth'
as $function$
#variable_conflict use_column
begin
  insert into town_letter_prefs (user_id)
  select u.id from auth.users u where u.email is not null and u.email_confirmed_at is not null
  on conflict (user_id) do nothing;

  return query
  with items as (
    select 'like'::text kind, l.id ref_id, gp.user_id recipient, l.user_id actor, gp.id post_id,
           gp.image_url img, gp.caption cap, null::text content, l.created_at
      from gallery_likes l join gallery_posts gp on gp.id = l.post_id
     where l.created_at > now() - interval '3 days' and l.user_id <> gp.user_id and not coalesce(gp.is_deleted, false)
    union all
    select 'comment', c.id, gp.user_id, c.user_id, gp.id, gp.image_url, gp.caption, c.content, c.created_at
      from gallery_comments c join gallery_posts gp on gp.id = c.gallery_post_id
     where c.created_at > now() - interval '3 days' and c.user_id <> gp.user_id and not coalesce(gp.is_deleted, false)
    union all
    select 'reply', c.id, pc.user_id, c.user_id, gp.id, gp.image_url, gp.caption, c.content, c.created_at
      from gallery_comments c
      join gallery_comments pc on pc.id = c.parent_comment_id
      join gallery_posts gp on gp.id = c.gallery_post_id
     where c.created_at > now() - interval '3 days' and pc.user_id <> c.user_id and pc.user_id <> gp.user_id
       and not coalesce(gp.is_deleted, false)
    union all
    select 'greeting', g.id, pt.owner_id, g.user_id, pt.id, pt.avatar_url, pt.name, g.message, g.created_at
      from pet_greetings g join pets pt on pt.id = g.pet_id
     where g.created_at > now() - interval '3 days' and g.user_id <> pt.owner_id
    union all
    select distinct on (g.id, prev.user_id)
           'greeting_reply', md5(g.id::text || prev.user_id::text)::uuid, prev.user_id, g.user_id, pt.id,
           pt.avatar_url, pt.name, g.message, g.created_at
      from pet_greetings g
      join pets pt on pt.id = g.pet_id and g.user_id = pt.owner_id
      join pet_greetings prev on prev.pet_id = g.pet_id and prev.user_id <> pt.owner_id
                              and prev.created_at < g.created_at and prev.created_at > g.created_at - interval '30 days'
     where g.created_at > now() - interval '3 days'
  )
  select i.kind, i.ref_id, i.recipient, u.email::text, coalesce(rp.display_name, '住民')::text, tp.token,
         coalesce(ap.display_name, '住民')::text, i.post_id, i.img, i.cap, i.content, i.created_at
    from items i
    join auth.users u on u.id = i.recipient
    join town_letter_prefs tp on tp.user_id = i.recipient
    left join profiles rp on rp.id = i.recipient
    left join profiles ap on ap.id = i.actor
   where u.email is not null and u.email_confirmed_at is not null
     and tp.unsubscribed_at is null
     and not coalesce(rp.is_suspended, false)
     and not exists (select 1 from town_activity_notices n where n.kind = i.kind and n.ref_id = i.ref_id)
     and not exists (select 1 from town_activity_emails e where e.user_id = i.recipient and e.kind = 'owner'
                       and e.status = 'sent' and e.created_at > now() - interval '6 hours')
   order by i.recipient, i.created_at;
end;
$function$;

-- 運営あて: 住民のひとことを足す。うちの子の登録は /pet/<id> を開けるように (運営事務局から「ようこそ」を返すため)
create or replace function public.town_activity_admin_pending()
returns table (kind text, ref_id uuid, actor_name text, title text, detail text, image text, link text,
               first_time boolean, created_at timestamptz)
language sql stable security definer set search_path to 'public'
as $function$
  select * from (
    select 'admin_post'::text, gp.id, coalesce(p.display_name, '住民')::text, coalesce(gp.caption, '')::text,
           (case when gp.theme_id is not null then 'お題に参加' else '' end ||
            case when gp.share_ok then '・SNS 紹介 OK' else '' end)::text,
           gp.image_url, 'https://www.qocca.pet/gallery/' || gp.id,
           not exists (select 1 from gallery_posts g2 where g2.user_id = gp.user_id and g2.created_at < gp.created_at
                         and not coalesce(g2.is_deleted, false)),
           gp.created_at
      from gallery_posts gp left join profiles p on p.id = gp.user_id
     where not coalesce(gp.is_official, false) and not coalesce(gp.is_deleted, false)
       and coalesce(p.role, '') <> 'admin'
    union all
    select 'admin_review', r.id, coalesce(p.display_name, '住民'), s.name,
           ('★' || r.rating || coalesce('　' || left(r.comment, 120), '')),
           (r.image_urls ->> 0), 'https://www.qocca.pet/petwalker',
           not exists (select 1 from pet_walker_reviews r2 where r2.user_id = r.user_id and r2.created_at < r.created_at),
           r.created_at
      from pet_walker_reviews r left join profiles p on p.id = r.user_id left join pet_walker_spots s on s.id = r.spot_id
     where coalesce(p.role, '') <> 'admin'
    union all
    select 'admin_listing', l.id, coalesce(p.display_name, '住民'), l.title,
           (l.status || '・' || l.price || ' 円'), l.image_urls[1], 'https://www.qocca.pet/listing/' || l.id,
           not exists (select 1 from listings l2 where l2.seller_id = l.seller_id and l2.created_at < l.created_at),
           l.created_at
      from listings l left join profiles p on p.id = l.seller_id
     where coalesce(p.role, '') <> 'admin'
    union all
    select 'admin_pet', pt.id, coalesce(p.display_name, '住民'), pt.name,
           concat_ws('・', pt.species, pt.breed), pt.avatar_url, 'https://www.qocca.pet/pet/' || pt.id,
           not exists (select 1 from pets p2 where p2.owner_id = pt.owner_id and p2.created_at < pt.created_at),
           pt.created_at
      from pets pt left join profiles p on p.id = pt.owner_id
     where coalesce(p.role, '') <> 'admin'
    union all
    select 'admin_greeting', g.id, coalesce(p.display_name, '住民'), pt.name,
           g.message, pt.avatar_url, 'https://www.qocca.pet/pet/' || pt.id,
           not exists (select 1 from pet_greetings g2 where g2.user_id = g.user_id and g2.created_at < g.created_at),
           g.created_at
      from pet_greetings g join pets pt on pt.id = g.pet_id left join profiles p on p.id = g.user_id
     where coalesce(p.role, '') <> 'admin'
  ) x (kind, ref_id, actor_name, title, detail, image, link, first_time, created_at)
  where x.created_at > now() - interval '3 days'
    and not exists (select 1 from town_activity_notices n where n.kind = x.kind and n.ref_id = x.ref_id)
  order by x.created_at;
$function$;
