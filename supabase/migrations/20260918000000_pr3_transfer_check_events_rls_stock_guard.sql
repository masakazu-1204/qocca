-- 2026/9/18 PR3 (決済まわりの残り) — ① 送金の CHECK 制約 / ③ events の管理者ポリシー /
--                                    ② 在庫 0 の注文を DB で拒否 / auto_complete_at をサーバーで確定
--
-- 前提: PR1 (#171) と PR2 (#172) が本番に出て、④ 送金先の乗っ取り・⑥ 送金額の書き換えが塞がっていること。
--       ① を先に直すと、④⑥の穴を現金化できる状態になるため、この順番を守っている (memory: checkout-security-findings-and-fix-order)。
--
-- ⚠️ 適用は King の確認後。Supabase MCP の apply_migration か Dashboard の SQL エディタで実行する。

-- ─────────────────────────────────────────────────────────────────────────────
-- ① orders.transfer_status の CHECK に 'processing' を追加
--    complete-order L289 が送金直前に transfer_status='processing' を書くが、CHECK が
--    pending/paid/failed/cancelled しか許さず、送金が必ずここで失敗していた (2026/9/10 Workflow レビューで確定)。
--    現状の値: null (cancelled 2件) / paid (completed 1件) のみ → 制約の付け替えで壊れる行は無い。
-- 戻し方: 下の add constraint を旧4値で再実行
alter table public.orders drop constraint if exists orders_transfer_status_check;
alter table public.orders add constraint orders_transfer_status_check
  check (transfer_status = any (array['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text, 'cancelled'::text]));

-- ─────────────────────────────────────────────────────────────────────────────
-- ③ events: 管理者 (public.is_admin() = admins テーブル) が全件を見て・追加して・承認/非公開/削除できるようにする
--    既存ポリシーは select (approved / 自分の分) と insert (organizer_id = 自分) だけで、
--    Admin.tsx の approve/reject/delete/手動追加が RLS で無音の空振りになっていた。pending 22件が管理画面から見えない。
--    scraper 系 Edge Function は service_role なので影響なし。
-- 戻し方: drop policy events_admin_{select,insert,update,delete} on public.events;
create policy events_admin_select on public.events for select to authenticated using (public.is_admin());
create policy events_admin_insert on public.events for insert to authenticated with check (public.is_admin());
create policy events_admin_update on public.events for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy events_admin_delete on public.events for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- ② 在庫 0 の単品注文を DB で拒否する (trg_decrement_stock を「減らせなければ注文ごと失敗」に)
--    PR1 で create-checkout 側の二重減算を外し、このトリガーが唯一の減算元になった。ただし従来は
--    GREATEST(stock-1, 0) で「減らせなくても黙って通す」ため、在庫 1 に同時に 2 人が来ると 2 件とも注文が立った。
--    UPDATE ... WHERE stock_quantity > 0 は行ロックで直列化されるので、2 人目は 0 行更新 → 例外 → INSERT ごとロールバック。
--    種類 (has_variants) がある出品は、在庫の本体が listing_variants.stock (reduce_variant_stock が行ロック付きで減算済み) なので
--    親の stock_quantity は従来どおり「減らせれば減らす」だけで、拒否はしない。
--    create-checkout v42 は SQLSTATE P0001 / 'out_of_stock' を 400「売り切れました」に変換する。
-- 戻し方: 旧定義 (GREATEST(stock_quantity - 1, 0)、例外なし) で create or replace
create or replace function public.decrement_listing_stock_on_order()
returns trigger
language plpgsql
as $function$
declare
  v_updated int;
  v_stock int;
  v_has_variants boolean;
begin
  if new.listing_id is null then
    return new;
  end if;

  update listings
     set stock_quantity = stock_quantity - 1
   where id = new.listing_id
     and stock_quantity is not null
     and stock_quantity > 0;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    select stock_quantity, coalesce(has_variants, false)
      into v_stock, v_has_variants
      from listings where id = new.listing_id;
    -- 在庫管理なし (null) と種類つき出品は従来どおり通す。単品で 0 なら注文を拒否。
    if v_stock is not null and not v_has_variants then
      raise exception 'out_of_stock'
        using errcode = 'P0001',
              detail = format('listing %s stock_quantity=%s', new.listing_id, v_stock);
    end if;
  end if;

  return new;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- auto_complete_at をサーバーで確定する
--    PR1 の列権限で当事者は auto_complete_at を書けるままにしてある (mypage の納品完了が使う)。
--    出品者が過去日時を送れば、自動完了 (auto-complete-orders) が次の毎時実行で即走り、購入者の確認期間が消える。
--    status が delivered に変わる瞬間に、delivered_at と auto_complete_at を DB 側で上書きする (platform_settings.auto_complete_hours、既定 72h)。
--    クライアントが何を送っても、この 2 列はサーバーの時刻になる。delivered 以外への遷移では触らない。
-- 戻し方: drop trigger trg_orders_delivery_timestamps on public.orders; drop function public.orders_set_delivery_timestamps();
create or replace function public.orders_set_delivery_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_hours int;
begin
  if new.status = 'delivered' and coalesce(old.status, '') <> 'delivered' then
    select nullif(value, '')::int into v_hours from platform_settings where key = 'auto_complete_hours';
    if v_hours is null or v_hours <= 0 then
      v_hours := 72;
    end if;
    new.delivered_at := now();
    new.auto_complete_at := now() + make_interval(hours => v_hours);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_orders_delivery_timestamps on public.orders;
create trigger trg_orders_delivery_timestamps
  before update of status on public.orders
  for each row execute function public.orders_set_delivery_timestamps();

-- ─────────────────────────────────────────────────────────────────────────────
-- 確認用 (適用後):
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'orders_transfer_status_check';
-- select polname, polcmd from pg_policy where polrelid = 'public.events'::regclass order by polcmd;
-- select tgname from pg_trigger where tgrelid = 'public.orders'::regclass and tgname in ('trg_decrement_stock','trg_orders_delivery_timestamps');
