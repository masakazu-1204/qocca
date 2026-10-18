-- 2026/10/18 街だよりの自動送信を開始 (King「明日から始めていいよ」)。本番で登録済み (jobid 43)。
--   毎朝 9:30 JST に、その週まだ届いていない住民へ 50 通まで。月曜 50・火曜 50・水曜に残り…と自然に分かれる。
--   Resend の 1 日 100 通は注文・DM 通知と共有なので、街だよりは 50 で止める。
select cron.unschedule('town-letter-daily') where exists (select 1 from cron.job where jobname = 'town-letter-daily');
select cron.schedule('town-letter-daily', '30 0 * * *', $job$
  select net.http_post(
    url := 'https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/send-town-letter',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-town-letter-key', (select value from private.internal_secrets where name = 'town_letter')),
    body := jsonb_build_object('mode','send','limit',50),
    timeout_milliseconds := 120000);
$job$);

-- 止めたいとき: select cron.unschedule('town-letter-daily');
-- 送れたか:     select week_start, status, count(*) from town_letter_sends group by 1, 2 order by 1 desc;
