-- ============================================
-- 2026/11/4 買う手前を測る (listing_events)
--   King「注文が増える案」→「それで行こう」。8 月以降の登録 113 人に対して注文 0 件。
--   listings.view_count / favorite_count は全件 0 のままで、どこで止まっているか分からない。
--   商品ごとに 3 段階だけ記録する:
--     view           = 商品ページを開いた
--     buy_click      = 購入ボタンを押した (未ログインで登録画面へ行く人も含む)
--     checkout_start = 確認画面の最後のボタンを押した (create-checkout の直前)
--
--   個人を追わない: user_id は持たず、ログイン中かどうかと、ブラウザごとの乱数だけ。
--   書けるのは track_listing_event だけ。読めるのは運営 (SQL) だけ。
--   作家さん本人と運営の操作は数えない。同じ人の同じ操作は 30 分に 1 回。
--
--   集計:
--     select l.title, count(*) filter (where e.event = 'view') as views,
--            count(*) filter (where e.event = 'buy_click') as clicks,
--            count(*) filter (where e.event = 'checkout_start') as starts
--     from listing_events e join listings l on l.id = e.listing_id
--     where e.created_at >= now() - interval '30 days'
--     group by l.title order by views desc;
-- ============================================

create table if not exists public.listing_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  event text not null check (event in ('view', 'buy_click', 'checkout_start')),
  logged_in boolean not null default false,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  created_at timestamptz not null default now()
);
create index if not exists listing_events_listing_idx on public.listing_events (listing_id, created_at desc);
create index if not exists listing_events_dedupe_idx on public.listing_events (listing_id, event, visitor_id, created_at desc);

alter table public.listing_events enable row level security;
revoke all on table public.listing_events from public, anon, authenticated;

create or replace function public.track_listing_event(p_listing_id uuid, p_event text, p_visitor text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_seller uuid;
begin
  if p_event not in ('view', 'buy_click', 'checkout_start') then return; end if;
  if p_visitor is null or char_length(p_visitor) not between 8 and 64 then return; end if;

  select seller_id into v_seller from listings
    where id = p_listing_id and status in ('approved', 'sold_out');
  if not found then return; end if;

  -- 作家さん本人と運営は数えない
  if v_uid is not null then
    if v_uid = v_seller then return; end if;
    if exists (select 1 from profiles where id = v_uid and role = 'admin') then return; end if;
  end if;

  -- 同じ人の同じ操作は 30 分に 1 回
  if exists (
    select 1 from listing_events
    where listing_id = p_listing_id and event = p_event and visitor_id = p_visitor
      and created_at > now() - interval '30 minutes'
  ) then return; end if;

  -- 誰でも呼べるので、1 商品 1 日の上限を置いて表が膨らむのを防ぐ
  if (select count(*) from listing_events
      where listing_id = p_listing_id and created_at > now() - interval '1 day') >= 5000 then
    return;
  end if;

  insert into listing_events (listing_id, event, logged_in, visitor_id)
  values (p_listing_id, p_event, v_uid is not null, p_visitor);
end;
$function$;

revoke execute on function public.track_listing_event(uuid, text, text) from public;
grant execute on function public.track_listing_event(uuid, text, text) to anon, authenticated;
