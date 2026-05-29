-- ============================================================
-- 依頼書 #38 Phase C-E SQL Bundle (2026-05-30 早朝)
-- マイページ 投稿管理 = 新規投稿 + 編集 + 削除 (soft delete)
-- 🛡️ 99-safety-protocol 厳守 / 既存 gallery_posts 22 + blog_posts 4 完全保護
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_38_phase_cde_soft_delete_update_rls"
-- 適用日時: 2026-05-30
-- 結果:
--   ✅ gallery_posts/blog_posts に is_deleted + deleted_at カラム追加
--   ✅ idx_gallery_posts_visible / idx_blog_posts_visible (partial index)
--   ✅ gallery_posts_update_own RLS (本人のみ UPDATE)
--   ✅ gallery_posts_public view + blog_posts_public view (削除済除外)
--   ✅ GRANT SELECT TO anon, authenticated
-- ============================================================

-- ============================================================
-- soft delete カラム追加 (gallery_posts + blog_posts)
-- ============================================================
ALTER TABLE public.gallery_posts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.gallery_posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.blog_posts    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.blog_posts    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gallery_posts_visible
  ON public.gallery_posts(created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_blog_posts_visible
  ON public.blog_posts(created_at DESC) WHERE is_deleted = false;

-- ============================================================
-- gallery_posts RLS: UPDATE policy 追加 (既存は select/insert/delete のみ)
-- ============================================================
DROP POLICY IF EXISTS gallery_posts_update_own ON public.gallery_posts;
CREATE POLICY gallery_posts_update_own ON public.gallery_posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 公開 view (削除済除外)
-- ============================================================
CREATE OR REPLACE VIEW public.gallery_posts_public AS
  SELECT * FROM public.gallery_posts WHERE is_deleted = false;
GRANT SELECT ON public.gallery_posts_public TO anon, authenticated;

CREATE OR REPLACE VIEW public.blog_posts_public AS
  SELECT * FROM public.blog_posts WHERE is_deleted = false AND published = true;
GRANT SELECT ON public.blog_posts_public TO anon, authenticated;

-- ============================================================
-- UI (src/App.tsx):
--   - MyPage tabs に { id:"posts", icon:"📸", label:"投稿管理" } 追加
--   - PostsTab コンポーネント (一覧 + 編集/削除ボタン)
--   - GalleryComposeForm (新規/編集 兼用):
--     画像アップロード → gallery-images bucket
--     pet_categories から13カテゴリセレクト
--     キャプション (500字)
--     INSERT or UPDATE
--   - BlogComposeForm (新規/編集 兼用):
--     カバー画像 → blog-images bucket
--     5 ブログカテゴリ (diary/tips/review/memorial/other)
--     published toggle (下書き or 公開)
--   - DeleteConfirmDialog:
--     「本当に削除しますか?」
--     「削除すると元に戻せません」
--     「急ぐ必要はないので、もう一度ゆっくり考えてください」
--     キャンセル + 削除する 2ボタン
--   - 削除実行: is_deleted=true + deleted_at=now() (soft delete)
-- ============================================================

-- ============================================================
-- 検証結果
-- ============================================================
-- gallery_posts: 22 件 (件数不変)
-- gallery_posts_visible (is_deleted=false): 22 件
-- blog_posts: 4 件 (件数不変)
-- blog_posts_visible: 4 件
-- gallery_rls: select / insert / delete / update_own (NEW)
-- 🛡️ 既存資産完全保護
-- ============================================================
