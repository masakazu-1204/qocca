-- 2026/10/18 send-email の鍵かけ
--   send-email (Edge Function) は v42 まで認証なしで誰でも呼べ、Qocca 名義のメールを任意の宛先へ送れた。
--   v43 から「内部の合言葉 (x-send-email-key)」か「service_role」か「ログイン住民 (納品通知だけ)」に限る。
--   この migration は DB 側の呼び出し 2 本に合言葉ヘッダを足す。
--   ⚠️ 順番: この migration を先に当てる (v42 は余計なヘッダを無視するので先に当てても壊れない) → そのあと send-email v43 をデプロイ。

-- 1) 合言葉 (private.internal_secrets は 20261018000000_town_letter.sql で作成済み)
insert into private.internal_secrets (name, value)
values ('send_email', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create or replace function public.check_send_email_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (select 1 from private.internal_secrets where name = 'send_email' and value = p_key)
$$;
revoke execute on function public.check_send_email_key(text) from public, anon, authenticated;
grant execute on function public.check_send_email_key(text) to service_role;

-- 2) 登録時のようこそメール (profiles の INSERT トリガ on_new_profile_send_welcome)
--    合言葉を読むため security definer に。メール送信の失敗で登録そのものが止まらないよう例外は握りつぶす。
create or replace function public.send_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $function$
begin
  begin
    perform net.http_post(
      url := 'https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-send-email-key', coalesce((select value from private.internal_secrets where name = 'send_email'), '')),
      body := json_build_object(
        'type', 'welcome',
        'user_id', NEW.id,
        'data', json_build_object('user_name', coalesce(NEW.display_name, 'ユーザー'))
      )::jsonb
    );
  exception when others then
    raise warning 'send_welcome_email failed: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

-- 3) DM のメール通知 (cron dm-email-notify, 2 分ごと)
--    anon key の直書きをやめて合言葉ヘッダに。中身 (30 分スロットル・既読マーク) は元のまま。
create or replace function public.notify_unread_dms()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
  v_key text := coalesce((select value from private.internal_secrets where name = 'send_email'), '');
  v_url text := 'https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/send-email';
begin
  for rec in
    select dm.recipient_id, dm.sender_id,
           (array_agg(dm.content order by dm.created_at desc))[1] as latest_content,
           array_agg(dm.id) as msg_ids
    from direct_messages dm
    where dm.is_read = false
      and dm.email_notified = false
      and dm.created_at < now() - interval '2 minutes'
    group by dm.recipient_id, dm.sender_id
  loop
    -- 30分スロットル: 同じ送信者→受信者で直近30分に通知済みがあればメールはスキップ(markはする)
    if not exists (
      select 1 from direct_messages d2
      where d2.recipient_id = rec.recipient_id and d2.sender_id = rec.sender_id
        and d2.email_notified = true and d2.created_at > now() - interval '30 minutes'
    ) then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type','application/json','x-send-email-key',v_key),
        body := jsonb_build_object(
          'type','new_message',
          'user_id', rec.recipient_id,
          'data', jsonb_build_object(
            'user_name',      coalesce((select display_name from profiles where id = rec.recipient_id), 'ユーザー'),
            'sender_name',    coalesce((select display_name from profiles where id = rec.sender_id), 'ユーザー'),
            'message_preview', left(rec.latest_content, 80),
            'messages_url',   'https://qocca.pet/mypage'
          )
        )
      );
    end if;
    update direct_messages set email_notified = true where id = any(rec.msg_ids);
  end loop;
end;
$function$;

-- 戻し方 (v42 に戻すとき): send-email を git の 65734f0 の中身で再デプロイすれば、
-- この migration のヘッダは無視されるのでそのまま動く (DB 側は戻さなくてよい)。
