-- 2026/10/28 投稿したら返事が届く街に (King「投稿と出品を増やす案」→ A)
--
-- 住民の写真投稿はこれまで 3 件、付いた いいね は合わせて 1・コメント 0。投稿しても何も返ってこないので 2 回目が無い。
--   1. 住民が何かを置いたら (写真・口コミ・出品・うちの子の登録)、運営 (support@qocca.pet → King) に知らせる。
--      King か 運営事務局 が 24 時間以内に いいね と一言を返す運用。
--   2. 自分の写真に いいね / コメント が付いたら、投稿した人にメールで知らせる (コメントへの返信は、元のコメントの人にも)。
--      1 人に 6 時間に 1 通まで (それ以上はまとめて次の便へ)。街だよりを止めている人には送らない。
-- 送るのは Edge Function notify-town-activity (cron 10 分ごと)。ここは「何をまだ知らせていないか」を返すだけ。
--
-- 3. gallery_posts.share_ok: 投稿した人が「Qocca の SNS で紹介してもいい」を選んだもの。
--    金曜の「街のお知らせ」(scripts/town-update-report.mjs) が、この印のある写真だけを「今週の一枚」として紹介する。

alter table public.gallery_posts add column if not exists share_ok boolean not null default false;

-- 知らせ済みの記録 (同じものを 2 度知らせない)
create table if not exists public.town_activity_notices (
  kind text not null,          -- admin_post / admin_review / admin_listing / admin_pet / like / comment / reply
  ref_id uuid not null,
  recipient uuid,              -- 住民あて (like / comment / reply) のときの受け取り手。運営あては null
  created_at timestamptz not null default now(),
  primary key (kind, ref_id)
);
alter table public.town_activity_notices enable row level security;

-- 送ったメールの記録 (6 時間に 1 通の判定にも使う)
create table if not exists public.town_activity_emails (
  id bigserial primary key,
  user_id uuid,                -- 運営あては null
  kind text not null,          -- owner / admin
  items integer not null default 0,
  status text not null,        -- sent / failed
  resend_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists town_activity_emails_user_idx on public.town_activity_emails (user_id, created_at desc);
alter table public.town_activity_emails enable row level security;

-- いまあるものは「知らせ済み」にしておく (始めた瞬間に昔の いいね が届かないように)
insert into public.town_activity_notices (kind, ref_id)
select 'admin_post', id from public.gallery_posts
union all select 'admin_review', id from public.pet_walker_reviews
union all select 'admin_listing', id from public.listings
union all select 'admin_pet', id from public.pets
union all select 'like', id from public.gallery_likes
union all select 'comment', id from public.gallery_comments
union all select 'reply', id from public.gallery_comments
on conflict do nothing;

-- 住民あて: まだ知らせていない いいね / コメント / 返信 (直近 3 日・自分の行いは除く)
create or replace function public.town_activity_owner_pending()
returns table (kind text, ref_id uuid, recipient uuid, email text, display_name text, token uuid,
               actor_name text, post_id uuid, post_image text, post_caption text, content text, created_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  -- 配信停止の token を持っていない人 (街だよりの宛先にまだ入っていない新しい住民) にも作っておく
  insert into town_letter_prefs (user_id)
  select u.id from auth.users u where u.email is not null and u.email_confirmed_at is not null
  on conflict (user_id) do nothing;

  return query
  with items as (
    select 'like'::text kind, l.id ref_id, gp.user_id recipient, l.user_id actor, gp.id post_id, null::text content, l.created_at
      from gallery_likes l join gallery_posts gp on gp.id = l.post_id
     where l.created_at > now() - interval '3 days' and l.user_id <> gp.user_id and not coalesce(gp.is_deleted, false)
    union all
    select 'comment', c.id, gp.user_id, c.user_id, gp.id, c.content, c.created_at
      from gallery_comments c join gallery_posts gp on gp.id = c.gallery_post_id
     where c.created_at > now() - interval '3 days' and c.user_id <> gp.user_id and not coalesce(gp.is_deleted, false)
    union all
    select 'reply', c.id, pc.user_id, c.user_id, gp.id, c.content, c.created_at
      from gallery_comments c
      join gallery_comments pc on pc.id = c.parent_comment_id
      join gallery_posts gp on gp.id = c.gallery_post_id
     where c.created_at > now() - interval '3 days' and pc.user_id <> c.user_id and pc.user_id <> gp.user_id
       and not coalesce(gp.is_deleted, false)
  )
  select i.kind, i.ref_id, i.recipient, u.email::text, coalesce(rp.display_name, '住民')::text, tp.token,
         coalesce(ap.display_name, '住民')::text, i.post_id, gp.image_url, gp.caption, i.content, i.created_at
    from items i
    join auth.users u on u.id = i.recipient
    join town_letter_prefs tp on tp.user_id = i.recipient
    left join profiles rp on rp.id = i.recipient
    left join profiles ap on ap.id = i.actor
    join gallery_posts gp on gp.id = i.post_id
   where u.email is not null and u.email_confirmed_at is not null
     and tp.unsubscribed_at is null
     and not coalesce(rp.is_suspended, false)
     and not exists (select 1 from town_activity_notices n where n.kind = i.kind and n.ref_id = i.ref_id)
     and not exists (select 1 from town_activity_emails e where e.user_id = i.recipient and e.kind = 'owner'
                       and e.status = 'sent' and e.created_at > now() - interval '6 hours')
   order by i.recipient, i.created_at;
end;
$$;

-- 運営あて: 住民が置いたもの (写真・口コミ・出品・うちの子)。運営事務局 (role=admin) の行いは除く
create or replace function public.town_activity_admin_pending()
returns table (kind text, ref_id uuid, actor_name text, title text, detail text, image text, link text,
               first_time boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
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
           concat_ws('・', pt.species, pt.breed), pt.avatar_url, null,
           not exists (select 1 from pets p2 where p2.owner_id = pt.owner_id and p2.created_at < pt.created_at),
           pt.created_at
      from pets pt left join profiles p on p.id = pt.owner_id
     where coalesce(p.role, '') <> 'admin'
  ) x (kind, ref_id, actor_name, title, detail, image, link, first_time, created_at)
  where x.created_at > now() - interval '3 days'
    and not exists (select 1 from town_activity_notices n where n.kind = x.kind and n.ref_id = x.ref_id)
  order by x.created_at;
$$;

revoke all on function public.town_activity_owner_pending() from public, anon, authenticated;
revoke all on function public.town_activity_admin_pending() from public, anon, authenticated;

-- 10 分ごとに送る (合言葉は街だよりと同じ private.internal_secrets の town_letter)
select cron.schedule('town-activity-notify', '*/10 * * * *', $cmd$
  select net.http_post(
    url := 'https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/notify-town-activity',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-town-letter-key', (select value from private.internal_secrets where name = 'town_letter')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$cmd$);
