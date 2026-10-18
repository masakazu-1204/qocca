-- 2026/10/18 街だより (King「2で進めて。街だよりにお題も入れといてあげたら」)
--   週 1 回、住民にメールを 1 通。今週のお題を目玉に、先週の街のようす・商店街の新着・近くのイベント・招待リンク。
--   配信停止はメール末尾のリンク 1 回で完了 (ログイン不要)。送信は Edge Function send-town-letter。
--
-- 1) 送信用の合言葉 (private スキーマ = API から見えない)。Edge Function は check_town_letter_key で照合する。
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.internal_secrets (
  name  text primary key,
  value text not null
);
insert into private.internal_secrets (name, value)
values ('town_letter', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create or replace function public.check_town_letter_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (select 1 from private.internal_secrets where name = 'town_letter' and value = p_key)
$$;
revoke execute on function public.check_town_letter_key(text) from public, anon, authenticated;
grant execute on function public.check_town_letter_key(text) to service_role;

-- 2) 住民ごとの配信設定 (配信停止トークン)。行が無い人 = 受け取る。
create table if not exists public.town_letter_prefs (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  token           uuid not null unique default gen_random_uuid(),
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.town_letter_prefs enable row level security;
drop policy if exists town_letter_prefs_select_own on public.town_letter_prefs;
create policy town_letter_prefs_select_own on public.town_letter_prefs for select using (auth.uid() = user_id);

-- 3) 送信記録 (同じ週に 2 度送らない)。API からは見えない (ポリシー無し)。
create table if not exists public.town_letter_sends (
  week_start date not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null,             -- sent / failed
  resend_id  text,
  error      text,
  created_at timestamptz not null default now(),
  primary key (week_start, user_id)
);
alter table public.town_letter_sends enable row level security;

-- 4) 配信停止 / 再開 (メールのリンクから。ログイン不要。トークンを知っている人だけ)
create or replace function public.set_town_letter_subscription(p_token uuid, p_subscribe boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_found uuid;
begin
  update town_letter_prefs
     set unsubscribed_at = case when p_subscribe then null else now() end
   where token = p_token
  returning user_id into v_found;
  if v_found is null then return 'not_found'; end if;
  return case when p_subscribe then 'subscribed' else 'unsubscribed' end;
end;
$$;
grant execute on function public.set_town_letter_subscription(uuid, boolean) to anon, authenticated;

-- 5) 今週の宛先 (service_role 専用)。メール確認済み・停止していない・凍結されていない・今週まだ送っていない人。
--    配信設定の行が無い人には、ここで行 (= 配信停止トークン) を作る。
create or replace function public.town_letter_recipients(p_week date)
returns table (user_id uuid, email text, display_name text, token uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
#variable_conflict use_column
begin
  insert into town_letter_prefs (user_id)
  select u.id from auth.users u
   where u.email is not null and u.email_confirmed_at is not null
  on conflict (user_id) do nothing;

  return query
  select u.id, u.email::text, coalesce(p.display_name, '住民')::text, tp.token
    from auth.users u
    join town_letter_prefs tp on tp.user_id = u.id
    left join profiles p on p.id = u.id
   where u.email is not null
     and u.email_confirmed_at is not null
     and tp.unsubscribed_at is null
     and coalesce(p.is_suspended, false) = false
     and not exists (select 1 from town_letter_sends s
                      where s.week_start = p_week and s.user_id = u.id and s.status = 'sent')
   order by u.created_at;
end;
$$;
revoke execute on function public.town_letter_recipients(date) from public, anon, authenticated;
grant execute on function public.town_letter_recipients(date) to service_role;

-- 6) 毎週月曜 9:30 JST の自動送信は、King が初回の文面を確認してから別途登録する:
-- select cron.schedule('town-letter-weekly', '30 0 * * 1', $job$
--   select net.http_post(
--     url := 'https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/send-town-letter',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'x-town-letter-key', (select value from private.internal_secrets where name = 'town_letter')),
--     body := jsonb_build_object('mode','send'),
--     timeout_milliseconds := 120000);
-- $job$);
