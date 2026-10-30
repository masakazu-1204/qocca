-- 2026/10/29 出品をラクに: よそ (minne / Creema / BASE) で売っている自分の作品ページの URL から、出品の下書きを作る (King「その方向で大丈夫」)
-- Edge Function import-listing-from-url が使う記録。1 人 1 日 20 回まで (この表で数える)。
-- 読み込むのは作家さん本人が貼った 1 ページだけ。巡回はしない。名乗りは QoccaBot、各サイトの robots.txt で許されている作品ページだけ。
create table if not exists public.listing_imports (
  id bigserial primary key,
  user_id uuid not null,
  url text not null,
  host text not null,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists listing_imports_user_idx on public.listing_imports (user_id, created_at desc);
alter table public.listing_imports enable row level security;
