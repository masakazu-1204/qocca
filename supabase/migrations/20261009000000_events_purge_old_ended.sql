-- 2026/10/9 終わったイベントの掃除 (King「a で住民の投稿は一旦残しておこう」)
--
-- 1) 一度きりの掃除 (MCP で実行済み): 自動収集分の ended 313 件 + 過去日付の rejected 5 件 = 318 件を削除。
--    住民が投稿したもの (organizer_id あり) は残した。コメント・参加表明は 0 件で巻き添え無し。
--    delete from public.events
--     where organizer_id is null
--       and (status = 'ended' or (status = 'rejected' and event_date < current_date));
--
-- 2) 毎晩の cron (events-mark-ended-daily, jobid 20, 15:30 UTC = 0:30 JST) に自動削除を追加:
--    自動収集分は終了から 30 日たったら削除。住民の投稿は残す。
select cron.alter_job(
  (select jobid from cron.job where jobname = 'events-mark-ended-daily'),
  command := $cmd$
  UPDATE public.events
  SET status = 'ended', approval_status = 'expired'
  WHERE event_date < CURRENT_DATE AND status NOT IN ('ended','rejected');
  -- 2026/10/9 King「a で住民の投稿は一旦残す」: 自動収集分は終了から 30 日たったら削除。住民の投稿 (organizer_id あり) は残す。
  DELETE FROM public.events
  WHERE organizer_id IS NULL
    AND event_date < CURRENT_DATE - 30
    AND status IN ('ended','rejected');
$cmd$);

-- 確認:
-- select jobname, schedule, command from cron.job where jobname = 'events-mark-ended-daily';
-- select status, count(*) from events group by status;
