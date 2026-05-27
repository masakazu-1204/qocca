-- ============================================================
-- 依頼書 #28 Phase 1 UI SQL Bundle (2026-05-28 朝 8:30)
-- FacilitiesPage 検索バー連動 RPC + UI 実装
-- 🛡️ 99-safety-protocol 厳守 / 既存 63件 完全保護
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_28_phase1_ui_search_facilities_rpc"
-- 適用日時: 2026-05-28
-- 結果   : ✅ public.search_facilities RPC 作成
--          ✅ GRANT EXECUTE anon + authenticated
--          ✅ 動作テスト全 OK (osaka:12 / tokyo:13 / dogrun:50 / sqli無効化)
-- ============================================================
-- 連動 UI: src/App.tsx FacilitiesPage に検索バー実装
--   - デバウンス 300ms
--   - localStorage 履歴 (qocca_facility_search_history, 最大8件)
--   - クリアボタン + 検索中表示
--   - 検索クエリある時のみ RPC 呼び出し / 空なら従来取得
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_facilities(
  query_text TEXT DEFAULT NULL,
  filter_category TEXT[] DEFAULT NULL,
  filter_prefecture TEXT DEFAULT NULL,
  filter_pet_type TEXT[] DEFAULT NULL,
  filter_pet_size TEXT[] DEFAULT NULL,
  filter_region TEXT DEFAULT NULL,
  sort_mode TEXT DEFAULT 'relevance',  -- 'relevance' | 'newest' | 'name'
  result_limit INT DEFAULT 50
)
RETURNS SETOF public.pet_facilities AS $$
DECLARE
  ts_query TEXT;
  q_clean TEXT;
BEGIN
  -- クエリ正規化 + SQL injection / tsquery 構文エラー対策
  IF query_text IS NOT NULL AND trim(query_text) <> '' THEN
    q_clean := trim(query_text);
    q_clean := regexp_replace(q_clean, '[''";\\(\\)&|!]', ' ', 'g');
    ts_query := regexp_replace(trim(q_clean), '\s+', ' & ', 'g');
  ELSE
    ts_query := NULL;
  END IF;

  RETURN QUERY
  SELECT pf.*
  FROM public.pet_facilities pf
  WHERE
    pf.approval_status IN ('auto_approved', 'manual_approved')
    AND (
      ts_query IS NULL
      OR pf.search_text @@ to_tsquery('simple', ts_query)
      OR pf.name        ILIKE '%' || q_clean || '%'
      OR pf.address     ILIKE '%' || q_clean || '%'
      OR pf.description ILIKE '%' || q_clean || '%'
    )
    AND (filter_category   IS NULL OR pf.facility_category = ANY(filter_category) OR pf.category = ANY(filter_category))
    AND (filter_prefecture IS NULL OR pf.prefecture = filter_prefecture)
    AND (filter_pet_type   IS NULL OR pf.pet_type_allowed && filter_pet_type OR pf.pet_types && filter_pet_type)
    AND (filter_pet_size   IS NULL OR pf.pet_size_allowed && filter_pet_size)
    AND (filter_region     IS NULL OR pf.region = filter_region)
  ORDER BY
    CASE
      WHEN sort_mode = 'relevance' AND ts_query IS NOT NULL THEN
        ts_rank(pf.search_text, to_tsquery('simple', ts_query))
      ELSE 0
    END DESC,
    CASE WHEN sort_mode = 'name'    THEN pf.name        END ASC,
    CASE WHEN sort_mode = 'newest'  THEN pf.created_at  END DESC,
    pf.review_count DESC NULLS LAST,
    pf.created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE
  SET search_path = public;

GRANT EXECUTE ON FUNCTION public.search_facilities(TEXT, TEXT[], TEXT, TEXT[], TEXT[], TEXT, TEXT, INT)
  TO anon, authenticated;

-- ============================================================
-- 動作確認結果 (apply_migration 直後)
-- ============================================================
-- SELECT COUNT(*) FROM search_facilities()                 → 50  (no-query, default limit 50)
-- SELECT COUNT(*) FROM search_facilities('大阪')           → 12  ✅
-- SELECT COUNT(*) FROM search_facilities('東京')           → 13  ✅
-- SELECT COUNT(*) FROM search_facilities('dog_run')        → 50  ✅
-- SELECT COUNT(*) FROM search_facilities(NULL, ARRAY['dog_run']) → 50 ✅
-- SELECT COUNT(*) FROM search_facilities(NULL, NULL, '大阪')      → 12 ✅
-- SELECT COUNT(*) FROM search_facilities(''';DROP TABLE...')      → 0 (SQL injection 無効化) ✅
--
-- 🛡️ 既存 63件 完全保護 (ROW COUNT 不変)
-- ============================================================
