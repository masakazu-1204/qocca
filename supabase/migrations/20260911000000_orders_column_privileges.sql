-- 2026/9/11 PR1 (決済入口の硬化) — orders の列権限を当事者から絞る
--
-- なぜ:
--   orders の UPDATE ポリシー orders_update_involved は「buyer か seller なら更新可」で、WITH CHECK も
--   列の制限も無い。authenticated ロールは orders の全列に UPDATE 権限を持っている (2026/9/11 実測)。
--   complete-order は orders.listing_price + shipping_fee から送金額を決めるため、当事者がクライアント
--   (anon キー + 自分の JWT) から listing_price を書き換えると、自動完了の経路で送金額を吊り上げられる。
--   金額・当事者・送金・決済の列は当事者からは書けないようにし、Edge Function (service_role) だけが書く。
--
-- クライアントが実際に更新している列 (src/ を全検索、2026/9/11 時点で 2 箇所のみ):
--   src/pages/mypage.tsx:2380  status, updated_at                                              (異議申立)
--   src/pages/mypage.tsx:2753  status, fulfillment_status, delivered_at, auto_complete_at, updated_at  (納品完了)
-- → この 5 列だけを許可する。
--
-- 影響: 上記 2 箇所の挙動は変わらない。それ以外の列を当事者が書こうとすると権限エラーになる (それが狙い)。
-- 残る課題 (PR3): auto_complete_at は出品者が過去日時にすると自動完了が即時に走る。サーバー側で設定する形に移す。
--
-- ⚠️ 適用は King の確認後。Supabase MCP の apply_migration か Dashboard の SQL エディタで実行する。
-- 戻し方:  grant update on public.orders to authenticated;

revoke update on public.orders from authenticated;

grant update (status, fulfillment_status, delivered_at, auto_complete_at, updated_at)
  on public.orders to authenticated;

-- 確認用 (適用後にこの 5 列だけが並べば OK):
-- select column_name from information_schema.column_privileges
--  where table_name = 'orders' and grantee = 'authenticated' and privilege_type = 'UPDATE'
--  order by column_name;
