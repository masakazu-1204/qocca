-- 2026/10/11 今週のお題 (King「1. 中を動かす」): 毎週ひとつのお題をホームと Threads に出し、
--   街のアルバム (gallery_posts) への投稿に乗せる。投稿には既存の earn rule gallery_post (3 あしあと・1 日 2 回) が付く。
--
-- 1) お題テーブル (公開読み取り・書き込みは管理側 = SQL / service_role)
create table if not exists public.weekly_themes (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null unique,          -- JST の月曜日
  title       text not null,                 -- 例: うちの子の寝顔
  body        text not null default '',      -- 1〜2 行の添え書き
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.weekly_themes enable row level security;
drop policy if exists weekly_themes_select_all on public.weekly_themes;
create policy weekly_themes_select_all on public.weekly_themes for select using (true);
grant select on public.weekly_themes to anon, authenticated;

-- 2) gallery_posts にお題の紐づけ
alter table public.gallery_posts add column if not exists theme_id uuid references public.weekly_themes(id) on delete set null;
create index if not exists gallery_posts_theme_id_idx on public.gallery_posts (theme_id) where theme_id is not null;

-- 3) 公開ビューに theme_id を足す (security_invoker は維持)
create or replace view public.gallery_posts_public with (security_invoker = true) as
  select id, user_id, pet_id, image_url, caption, likes_count, created_at, is_official,
         pet_name, pet_type, time_of_day, display_priority, search_text, is_deleted, deleted_at, theme_id
    from public.gallery_posts
   where is_deleted = false;

-- 4) 最初の 9 週ぶん (今週 10/5 〜 11/30)
insert into public.weekly_themes (week_start, title, body) values
  ('2026-10-05', 'うちの子の寝顔',       '眠っているときの顔は、その子のいちばん静かな表情です。'),
  ('2026-10-12', '散歩道で見つけた秋',   '落ち葉、どんぐり、少し長くなった影。いつもの道の、今だけの景色を。'),
  ('2026-10-19', 'いちばん好きな場所',   'ソファの端、窓の下、玄関マット。その子が選んだ場所には理由があります。'),
  ('2026-10-26', 'ごはんを待つ顔',       '待てをしている数秒間の、あの真剣な目を。'),
  ('2026-11-02', '窓辺の光',             '午後の光が差し込む時間に、そっと一枚。'),
  ('2026-11-09', 'お気に入りのおもちゃ', 'ぼろぼろになっても手放さない、その子の宝物と。'),
  ('2026-11-16', 'ふたりの影',           '夕方の散歩で、地面に並ぶふたつの影を。'),
  ('2026-11-23', '毛布にくるまる季節',   '寒くなってきました。あたたかいところに潜り込む姿を。'),
  ('2026-11-30', '今年いちばんの一枚',   '今年、いちばん好きだった写真を、もう一度この街に。')
on conflict (week_start) do nothing;

-- 5) 月曜 9:00 JST (= 月曜 0:00 UTC) に Threads へお題を投稿。その週のお題が無ければ何もしない。
--    kill_switch (threads_post_settings) を尊重。post-to-threads-adhoc は 2 段 API なので timeout 30 秒。
select cron.unschedule('weekly-theme-threads-post') where exists (select 1 from cron.job where jobname = 'weekly-theme-threads-post');
select cron.schedule('weekly-theme-threads-post', '0 0 * * 1', $job$
  select net.http_post(
    url := 'https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/post-to-threads-adhoc',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('text',
      '今週のお題は「' || t.title || '」。' || E'\n' || t.body || E'\n\n' ||
      'Qocca の街のアルバムに、一枚どうぞ。' || E'\n' || 'https://www.qocca.pet/gallery'),
    timeout_milliseconds := 30000)
    from public.weekly_themes t
   where t.is_active
     and t.week_start = (date_trunc('week', now() at time zone 'Asia/Tokyo'))::date
     and not coalesce((select kill_switch from public.threads_post_settings limit 1), false);
$job$);

-- 確認:
-- select week_start, title from weekly_themes order by week_start;
-- select jobname, schedule from cron.job where jobname = 'weekly-theme-threads-post';
-- select column_name from information_schema.columns where table_name = 'gallery_posts_public' and column_name = 'theme_id';
