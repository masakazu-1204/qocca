-- 2026/9/28 住民紹介のお礼 (King「GO」): 招待リンク /welcome/r/<code> から来た人が住民になったら、
--   招いた側に あしあと 5 を贈る。1 日 3 人分まで (自作自演の量産止め)。クリエイターも同じく受け取れる
--   (手数料 5% の creator_referral とは独立)。決済ロジックには触らない。
--
-- 仕組み: registration_sources への INSERT (初回ログイン時にクライアントが 1 行入れる) を AFTER トリガーで拾い、
--   landing_path の code から招いた人を引いて残高に加算。冪等キー invite_resident:<招いた人>:<登録した人> で二重付与を防ぐ。
--   付与量は currency_earn_rules (サーバ側マスタ) から読む。

insert into public.currency_earn_rules (rule_key, amount, daily_cap, is_active)
values ('invite_resident', 5, 3, true)
on conflict (rule_key) do nothing;

create or replace function public.grant_invite_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_inviter uuid;
  v_rule    record;
  v_key     text;
  v_today   int;
begin
  -- 招待リンク経由でなければ何もしない
  if new.landing_path is null or new.landing_path !~ '^/welcome/r/[0-9a-f]{12}$' then
    return new;
  end if;
  v_code := substr(new.landing_path, 12, 12);

  select id into v_inviter
    from profiles
   where replace(id::text, '-', '') like v_code || '%'
   limit 1;
  -- 招いた人が居ない / 自分自身 → 何もしない
  if v_inviter is null or v_inviter = new.user_id then
    return new;
  end if;

  select * into v_rule from currency_earn_rules
   where rule_key = 'invite_resident' and is_active = true;
  if not found then
    return new;
  end if;

  -- 冪等 (同じ組み合わせは 1 回だけ)
  v_key := 'invite_resident:' || v_inviter::text || ':' || new.user_id::text;
  if exists (select 1 from currency_transactions where idempotency_key = v_key) then
    return new;
  end if;

  -- 日次上限 (JST 当日、招いた側の invite_resident 付与回数)
  if v_rule.daily_cap is not null then
    select count(*) into v_today
      from currency_transactions
     where user_id = v_inviter
       and tx_type = 'earn'
       and source = 'invite_resident'
       and created_at >= ((now() at time zone 'Asia/Tokyo')::date::timestamp at time zone 'Asia/Tokyo');
    if v_today >= v_rule.daily_cap then
      return new;
    end if;
  end if;

  insert into currency_balances (user_id, free_balance, lifetime_earned)
  values (v_inviter, v_rule.amount, v_rule.amount)
  on conflict (user_id) do update set
    free_balance    = currency_balances.free_balance + excluded.free_balance,
    lifetime_earned = currency_balances.lifetime_earned + excluded.lifetime_earned,
    updated_at      = now();

  insert into currency_transactions (user_id, amount, balance_type, tx_type, source, related_user, idempotency_key)
  values (v_inviter, v_rule.amount, 'free', 'earn', 'invite_resident', new.user_id, v_key);

  return new;
exception when others then
  -- お礼の付与に失敗しても登録記録そのものは止めない
  raise warning 'grant_invite_reward skipped: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_grant_invite_reward on public.registration_sources;
create trigger trg_grant_invite_reward
  after insert on public.registration_sources
  for each row execute function public.grant_invite_reward();

-- 確認:
-- select * from currency_earn_rules where rule_key = 'invite_resident';
-- select tgname from pg_trigger where tgrelid = 'public.registration_sources'::regclass and not tgisinternal;
