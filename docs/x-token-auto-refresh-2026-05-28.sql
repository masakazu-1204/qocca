-- ============================================================
-- 依頼書 #29 緊急 SQL Bundle (2026-05-28 朝 8:35)
-- X access_token 自動更新システム + 失敗投稿リトライ
-- 🛡️ 99-safety-protocol 厳守 / 既存 cron 4本 + Edge Function 完全保護
-- ============================================================
-- 経緯:
--   5/28 8:00 JST x-morning-post 失敗 (access_token expired)
--   原因: X OAuth 2.0 token は 2時間で expire するが、自動 refresh 機構なし
--   social_connections に refresh_token カラム無し → metadata.refresh_token に格納されてた
--
-- 対応:
--   1. x-refresh-token v1 新規 deploy (metadata.refresh_token → 新 access_token)
--   2. post-to-x v3 deploy (期限残り<5分 / 401 で auto-refresh)
--   3. x-retry-handler v1 新規 deploy (failed 投稿の自動再試行)
--   4. pg_cron 2本追加: x-token-auto-refresh (毎時) / x-retry-failed-posts (15分ごと)
--   5. 8:00 失敗投稿 1件を手動リカバリー → tweet_id=2059778044248887478 ✅
-- ============================================================

-- ============================================================
-- pg_cron 2本追加 (DDL のみ・Edge Function は MCP deploy 経由)
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('x-token-auto-refresh') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='x-token-auto-refresh');
  PERFORM cron.unschedule('x-retry-failed-posts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='x-retry-failed-posts');

  -- 1) 毎時 0分: x-refresh-token (threshold_minutes=60 → 残り 60分以下で refresh)
  PERFORM cron.schedule(
    'x-token-auto-refresh',
    '0 * * * *',
    $cmd$SELECT net.http_post(url:='https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-refresh-token',headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('threshold_minutes',60,'source','pg_cron'));$cmd$
  );

  -- 2) 15分ごと: x-retry-handler (24時間以内の failed を最大5件まで再試行 / retry_count 上限 3)
  PERFORM cron.schedule(
    'x-retry-failed-posts',
    '*/15 * * * *',
    $cmd$SELECT net.http_post(url:='https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-retry-handler',headers:=jsonb_build_object('Content-Type','application/json'),body:='{"source":"pg_cron"}'::jsonb);$cmd$
  );
END
$$;

-- ============================================================
-- 動作確認結果 (本番 live test)
-- ============================================================
-- ① x-refresh-token live test (force_refresh=true):
--    POST /functions/v1/x-refresh-token {"force_refresh":true}
--    → { success: true, refreshed: true, minutes_was_remaining: 114,
--        new_token_expires_at: "2026-05-28T01:23:57.162Z" (10:23 JST),
--        rotated_refresh_token: true }
--
-- ② 8:00 失敗投稿 リカバリー live test:
--    POST /functions/v1/post-to-x {"x_post_id":"898cec80-..."}
--    → { success: true, tweet_id: "2059778044248887478",
--        permalink: "https://x.com/Qocca_pet/status/2059778044248887478",
--        posted_at: "2026-05-27T23:25:29Z" (8:25 JST 復活投稿) }
--
-- ③ cron jobs 確認:
--    x-morning-post / x-evening-post: active=true (既存維持)
--    x-token-auto-refresh / x-retry-failed-posts: active=true (新規)
-- ============================================================

-- ============================================================
-- 設計判断
-- ============================================================
-- ・refresh_token は metadata JSONB に格納する既存設計を踏襲 (DDL 変更不要)
-- ・x-refresh-token は idempotent: threshold_minutes 以上残ってれば no-op
-- ・post-to-x は 2段階防御: 事前 expiry チェック + 401 リトライ
-- ・x-retry-handler は retry_count 3 で停止 (無限ループ防止 / error_message に [retry:N] タグ管理)
-- ・x-retry-handler は 24時間以内の failed のみ対象 (古い失敗は無視)
-- ・retryable error pattern: access_token expired / auto_refresh_failed / x_api_error / caught_error / token_expired / fetch_error
-- ============================================================

-- ============================================================
-- 🛡️ 99-safety-protocol 完全準拠
-- ============================================================
-- 既存 cron 4本 (blog/cleanup/x-morning/x-evening): 完全無傷
-- 新規 cron 2本: 即 active=true (緊急対応のため誤発火リスクなし)
-- Edge Function:
--   x-init-oauth v8 / x-oauth-callback v6: 完全保護 (offline.access scope 既に取得済)
--   x-post v4 / x-profile v6 / generate-x-post v2: 完全保護
--   post-to-x v2 → v3: backward compatible (旧呼び出しも動作)
--   x-refresh-token v1 / x-retry-handler v1: 新規追加 (既存影響なし)
-- DB:
--   social_connections: スキーマ変更なし (既存 metadata カラムを活用)
--   x_posts: 件数変動なし (1件を failed→posted に状態遷移のみ)
-- ============================================================
