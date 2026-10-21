-- 2026/10/22 King「イベントもっと集めてこれる？承認が面倒やからそのまま載せてほしい。日にちが過ぎてるやつは消していこう」
--
-- 1. events.end_date を足す (複数日のイベントを初日の翌日に消さないため)。scraper v8 が AI の end_date を入れる
-- 2. 終わったイベントは翌日 0:30 (JST) に消す。判定は coalesce(end_date, event_date) と JST の今日
--    - 自動収集・管理者登録 (organizer_id なし) → 削除
--    - 住民の投稿 (organizer_id あり) → 2026/10/9 の King の判断「住民の投稿は一旦残す」に従い、削除せず ended にするだけ
--    これまでは CURRENT_DATE (UTC) で ended にしてから 30 日待って消していた
-- 3. 収集を週 2 回 (火・土) から毎日 3:00 (JST) に。1 回あたりの上限は 40 ソース。
--    AI の費用は 1 ソース約 $0.003 で、月の上限 $13.33 には十分おさまる
-- 4. いま承認待ちの自動収集イベントは公開にする。承認済みの行は approval_status を管理画面の「公開中」に揃える

alter table public.events add column if not exists end_date date;

select cron.alter_job(
  (select jobid from cron.job where jobname = 'events-mark-ended-daily'),
  command := $cmd$
  -- 2026/10/22: 終わったら翌日に消す (JST・最終日で判定)。住民の投稿は消さずに ended のまま残す
  DELETE FROM public.events
  WHERE organizer_id IS NULL
    AND coalesce(end_date, event_date) < (now() at time zone 'Asia/Tokyo')::date;
  UPDATE public.events
  SET status = 'ended', approval_status = 'expired'
  WHERE organizer_id IS NOT NULL
    AND coalesce(end_date, event_date) < (now() at time zone 'Asia/Tokyo')::date
    AND status NOT IN ('ended','rejected');
  $cmd$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'event-scrape-weekly'),
  schedule := '0 18 * * *',
  command := $cmd$
  SELECT net.http_post(
    url := 'https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/event-scrape-orchestrator',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{"limit":40}'::jsonb
  ) AS request_id;
  $cmd$
);

-- 承認待ちのまま止まっている自動収集分を公開
update public.events
set status = 'approved', approval_status = 'auto_approved'
where source_type = 'ai_scraped'
  and status = 'pending'
  and event_date >= (now() at time zone 'Asia/Tokyo')::date;

-- 公開されているのに approval_status が pending / rejected の行 (旧画面で承認したもの) を揃える
update public.events
set approval_status = 'manual_approved'
where status = 'approved'
  and approval_status in ('pending','rejected');

-- 404 が続いている収集先を止める
update public.event_sources set is_active = false where url = 'https://dogfes.com/';
