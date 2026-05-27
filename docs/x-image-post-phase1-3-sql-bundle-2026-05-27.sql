-- ============================================================
-- 依頼書 #25 Step 2 (= #16 v2 Phase 1.3) SQL Bundle (2026-05-27 深夜)
-- X 自動投稿に画像対応 (gpt-image-1 + X media upload)
-- 🛡️ 99-safety-protocol 厳守 / 既存資産完全保護
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_25_step2_x_images_bucket"
-- 適用日時: 2026-05-27
-- 結果   : ✅ x-images Storage bucket / 3 RLS policies
--          ✅ Edge Functions v2 deploy: generate-x-post v2 / post-to-x v2
-- ============================================================
-- 既存テンプレ状況:
--   morning (23 templates): use_image=false (テキストのみ, 朝はクイック投稿)
--   evening (23 templates): use_image=true + image_prompt 設定済 (画像つき夕投稿)
-- → 5/28 20:00 JST が初の画像付き X 自動投稿
-- ============================================================

-- ============================================================
-- Storage バケット x-images
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'x-images',
  'x-images',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS Policies (3本)
-- ============================================================
-- 1. service_role 全権限 (Edge Function 用)
DROP POLICY IF EXISTS "x_images_service_role_all" ON storage.objects;
CREATE POLICY "x_images_service_role_all" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'x-images')
  WITH CHECK (bucket_id = 'x-images');

-- 2. public read (X 媒体に貼った画像が誰でも閲覧可能)
DROP POLICY IF EXISTS "x_images_public_read" ON storage.objects;
CREATE POLICY "x_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'x-images');

-- 3. admin 削除権
DROP POLICY IF EXISTS "x_images_admin_delete" ON storage.objects;
CREATE POLICY "x_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'x-images' AND EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- ============================================================
-- Edge Functions v2 deploy (Supabase MCP 経由)
-- ============================================================
-- generate-x-post v2 (version 2):
--   - 動的: gpt-image-1 で画像生成 → x-images バケット保存 → image_url 設定
--   - フォールバック: 画像生成失敗してもテキストのみで継続
--   - cost_usd: 画像なし null / 画像あり $0.040 (gpt-image-1 1024x1024)
--
-- post-to-x v2 (version 2):
--   - image_url ある場合に画像ダウンロード → X v1.1 media/upload
--   - media_id を取得して /2/tweets で media.media_ids に含める
--   - フォールバック: media upload 失敗時はテキストのみ投稿 + error_message 記録
-- ============================================================

-- ============================================================
-- 動作確認方法 (King 手動・任意)
-- ============================================================
-- A. 朝投稿テスト (画像なし、5/28 8:00 JST cron で自動実行):
--   supabase functions invoke generate-x-post --no-verify-jwt \
--     -H 'Content-Type: application/json' -d '{"time_slot":"morning","test_mode":true}'
--
-- B. 夕投稿テスト (画像あり、コスト ~$0.04):
--   supabase functions invoke generate-x-post --no-verify-jwt \
--     -H 'Content-Type: application/json' -d '{"time_slot":"evening","test_mode":true,"force_image":true}'
--
-- C. 投稿実行 (上の返却 x_post_id を使う):
--   supabase functions invoke post-to-x --no-verify-jwt \
--     -H 'Content-Type: application/json' -d '{"x_post_id":"..."}'
--
-- D. 動作ログ確認:
--   SELECT id, status, content, image_url, tweet_id, cost_usd, posted_at, error_message
--     FROM x_posts ORDER BY created_at DESC LIMIT 5;
-- ============================================================

-- ============================================================
-- 既存資産完全保護:
--   profiles: 16 (変動なし)
--   listings: 8 (変動なし)
--   x_post_templates: 46 (変動なし)
--   cron jobs: 4 active / 4 inactive (#25 と同じ)
--   既存 Storage buckets: 9本全て無傷 (avatars/badges/blog-images/dispute-evidence/
--                                     event-images/facility-photos/gallery-images/
--                                     listing-images/pet-photos)
--
-- 🛡️ 99-safety-protocol 厳守完了
-- ============================================================
