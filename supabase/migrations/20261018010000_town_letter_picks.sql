-- 2026/10/18 街だより v2 (King「おすすめの商品やブログも載せてあげたら」「50 通ずつ日を空けて」)
--
-- 1) 今週のおすすめを手で選ぶ枠。kind='listing' の item_id は listings.id。note は推薦文 (任意・1〜2 行)。
--    行が無い週は、送信関数が作家さん 1 人 1 点で 3 点を週替わりに選ぶ。
create table if not exists public.town_letter_picks (
  week_start date not null,                -- JST の月曜
  kind       text not null default 'listing',
  item_id    uuid not null,
  note       text,
  sort       int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (week_start, kind, item_id)
);
alter table public.town_letter_picks enable row level security;   -- API からは見えない (service_role / SQL だけ)

-- 使い方 (例: 10/19 の週に 1 点を推薦文つきで):
-- insert into town_letter_picks (week_start, item_id, note, sort)
-- values ('2026-10-19', '<listings.id>', '羊毛で、うちの子の表情までそっくりに。', 1);

-- 2) 毎朝 9:30 JST に、その週まだ届いていない人へ 50 通まで (King が初回の文面を確認してから登録する):
-- select cron.schedule('town-letter-daily', '30 0 * * *', $job$
--   select net.http_post(
--     url := 'https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/send-town-letter',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'x-town-letter-key', (select value from private.internal_secrets where name = 'town_letter')),
--     body := jsonb_build_object('mode','send','limit',50),
--     timeout_milliseconds := 120000);
-- $job$);
