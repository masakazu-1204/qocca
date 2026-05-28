-- ============================================================
-- 依頼書 #30 SQL Bundle (2026-05-28 朝 9:50)
-- ギャラリー Instagram ライクグリッド + 検索基盤
-- 🛡️ 99-safety-protocol 厳守 / 既存 22件 完全保護
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_30_gallery_search_basis"
-- 適用日時: 2026-05-28
-- 結果   :
--   ✅ search_text TSVECTOR カラム追加 (#28 と同パターン)
--   ✅ Trigger trg_gallery_search_text (caption + pet_name + pet_type + time_of_day)
--   ✅ 既存 22件 全件 search_text 生成 (no-op UPDATE で Trigger 駆動)
--   ✅ 5 indexes (GIN tsvector / GIN trgm caption / GIN trgm pet_name / btree pet_type / btree priority)
--   ✅ search_gallery RPC (GRANT anon, authenticated)
-- ============================================================

-- ============================================================
-- search_text カラム
-- ============================================================
ALTER TABLE public.gallery_posts ADD COLUMN IF NOT EXISTS search_text TSVECTOR;

-- ============================================================
-- Trigger (caption + pet_name + pet_type + time_of_day を 'simple' tokenize)
-- ※ Supabase は 'japanese' configuration 不可のため 'simple' + pg_trgm 併用
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_gallery_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := to_tsvector('simple',
    COALESCE(NEW.caption, '') || ' ' ||
    COALESCE(NEW.pet_name, '') || ' ' ||
    COALESCE(NEW.pet_type, '') || ' ' ||
    COALESCE(NEW.time_of_day, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gallery_search_text ON public.gallery_posts;
CREATE TRIGGER trg_gallery_search_text
  BEFORE INSERT OR UPDATE ON public.gallery_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_gallery_search_text();

UPDATE public.gallery_posts SET id = id WHERE search_text IS NULL;

-- ============================================================
-- インデックス (5本)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_gallery_search_text       ON public.gallery_posts USING GIN(search_text);
CREATE INDEX IF NOT EXISTS idx_gallery_caption_trgm      ON public.gallery_posts USING GIN(caption gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gallery_pet_name_trgm     ON public.gallery_posts USING GIN(pet_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gallery_pet_type          ON public.gallery_posts(pet_type);
CREATE INDEX IF NOT EXISTS idx_gallery_display_priority  ON public.gallery_posts(display_priority DESC NULLS LAST);

-- ============================================================
-- RPC: search_gallery
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_gallery(
  query_text TEXT DEFAULT NULL,
  filter_pet_type TEXT[] DEFAULT NULL,
  sort_mode TEXT DEFAULT 'newest',
  result_limit INT DEFAULT 100
)
RETURNS SETOF public.gallery_posts AS $$
DECLARE
  ts_query TEXT;
  q_clean TEXT;
BEGIN
  IF query_text IS NOT NULL AND trim(query_text) <> '' THEN
    q_clean := trim(query_text);
    q_clean := regexp_replace(q_clean, '[''";\\(\\)&|!]', ' ', 'g');
    ts_query := regexp_replace(trim(q_clean), '\s+', ' & ', 'g');
  ELSE
    ts_query := NULL;
  END IF;

  RETURN QUERY
  SELECT gp.*
  FROM public.gallery_posts gp
  WHERE
    (
      ts_query IS NULL
      OR gp.search_text @@ to_tsquery('simple', ts_query)
      OR gp.caption  ILIKE '%' || q_clean || '%'
      OR gp.pet_name ILIKE '%' || q_clean || '%'
      OR gp.pet_type ILIKE '%' || q_clean || '%'
    )
    AND (filter_pet_type IS NULL OR gp.pet_type = ANY(filter_pet_type))
  ORDER BY
    CASE
      WHEN sort_mode = 'relevance' AND ts_query IS NOT NULL THEN
        ts_rank(gp.search_text, to_tsquery('simple', ts_query))
      ELSE 0
    END DESC,
    CASE WHEN sort_mode = 'likes' THEN gp.likes_count END DESC,
    gp.created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE
  SET search_path = public;

GRANT EXECUTE ON FUNCTION public.search_gallery(TEXT, TEXT[], TEXT, INT)
  TO anon, authenticated;

-- ============================================================
-- 動作確認結果
-- ============================================================
-- search_text_populated: 22 / 22 ✅ (Trigger 動作)
-- search_gallery() (no-query): 22件 ✅
-- search_gallery('cat'): 6件 ✅ (cat, tabby cat, ginger cat 等)
-- search_gallery('shiba'): 1件 ✅
-- search_gallery(NULL, ARRAY['golden']): 4件 ✅ (filter_pet_type)
-- SQL injection (''; DROP TABLE...): 危険文字 [;'"&|!()] 除去で無効化 ✅
--
-- 🛡️ 既存 22件 完全保護 (件数不変・データ無変動)
-- ============================================================
