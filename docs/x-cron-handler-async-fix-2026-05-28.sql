-- ============================================================
-- 依頼書 #32 緊急 SQL Bundle (2026-05-28 夜 22:40)
-- x-cron-handler v2 非同期化 + pg_cron timeout 拡張
-- 🛡️ 99-safety-protocol 厳守 / 既存 x_posts 完全保護
-- ============================================================
-- 真因:
--   5/28 11:00 UTC (20:00 JST) evening cron 起動 → x-cron-handler 呼び出し
--   → x-cron-handler が同期で generate-x-post (gpt-image-1 ~30秒) を待機
--   → pg_net の デフォルトタイムアウト 5000ms で connection 切断
--   → net._http_response.id=100 に error "Timeout of 5000 ms reached"
--   → cron 自体は succeeded だが Edge Function 側は中断 (or 接続切断検知で abort)
--   → x_posts に新規 INSERT 無し
--
-- 対応:
--   1. x-cron-handler v2 deploy:
--      EdgeRuntime.waitUntil() で background task 化
--      cron に即 200 返答 → 裏で generate→post を継続実行
--   2. pg_cron 更新:
--      net.http_post に timeout_milliseconds := 30000 を追加 (二重防御)
--      非同期 v2 なら 5秒で十分だが、念のため 30秒に拡張
--   3. 5/28 20:00 失敗投稿の挽回:
--      手動で curl 同期モード (wait=true) で trigger → 45秒で完了
--      tweet_id: 2060038955215798602 (画像付き / 一週間振り返り / $0.04)
--      https://x.com/Qocca_pet/status/2060038955215798602
-- ============================================================

-- ============================================================
-- pg_cron 更新 (timeout_milliseconds=30000 追加)
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('x-morning-post') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='x-morning-post');
  PERFORM cron.unschedule('x-evening-post') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='x-evening-post');

  PERFORM cron.schedule(
    'x-morning-post',
    '0 23 * * *',
    $cmd$SELECT net.http_post(url:='https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-cron-handler',headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('time_slot','morning','source','pg_cron'),timeout_milliseconds:=30000);$cmd$
  );
  PERFORM cron.schedule(
    'x-evening-post',
    '0 11 * * *',
    $cmd$SELECT net.http_post(url:='https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-cron-handler',headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('time_slot','evening','source','pg_cron'),timeout_milliseconds:=30000);$cmd$
  );
END
$$;

-- ============================================================
-- Edge Function deploy (Supabase MCP 経由)
-- ============================================================
-- x-cron-handler v1 → v2:
--   - EdgeRuntime.waitUntil で非同期化
--   - waitMode=true で同期実行 (テスト/手動 trigger 用)
--   - 内部 runJob 関数化
--   - エラー時の console.error ログ強化
-- ============================================================

-- ============================================================
-- 動作確認結果 (本番 live test)
-- ============================================================
-- 1) x-cron-handler v2 deploy: version 2 ✅
-- 2) pg_cron 更新後の job:
--    x-morning-post: 0 23 * * * (timeout_milliseconds=30000) active=true ✅
--    x-evening-post: 0 11 * * * (timeout_milliseconds=30000) active=true ✅
-- 3) 挽回投稿 (curl --data '{"time_slot":"evening","wait":true}'):
--    started_at: 16:41:30 UTC / completed_at: 16:42:15 UTC (45秒)
--    tweet_id: 2060038955215798602
--    theme: 一週間振り返り / 画像付き / cost: $0.04
-- ============================================================

-- ============================================================
-- 🛡️ 99-safety-protocol
-- ============================================================
-- 既存 x_posts データ: 朝 8:25 posted は完全保護 (tweet_id: 2059778044248887478)
-- 既存 cron jobs: refresh / retry / x-morning は影響なし
-- 既存 Edge Function 22本: x-cron-handler 以外 完全保護
-- generate-x-post v2 / post-to-x v3 / x-refresh-token v1 / x-retry-handler v1: 無変更
-- DB スキーマ: 変更なし
-- ============================================================
