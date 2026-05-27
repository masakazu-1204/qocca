-- ============================================================
-- 依頼書 #28 Phase 1 SQL Bundle (2026-05-28 早朝)
-- 施設カテゴリ大幅拡張 + ワード検索基盤 + AI 収集準備
-- 🛡️ 99-safety-protocol 厳守 / 既存 63件 (pet_facilities) 完全保護
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_28_phase1_pet_facilities_expansion"
-- 適用日時: 2026-05-28
-- 結果   :
--   ✅ pet_facilities 19→33 cols (+14)
--   ✅ 28種カテゴリ CHECK (Phase 1=15 / Phase 2=8 / Phase 3=4 + dog_run/park/other 前方宣言)
--   ✅ 9 indexes (basic 5 + GIN tsvector 1 + GIN pg_trgm 2 + pet_facilities 既存)
--   ✅ 2 triggers (search_text 自動更新 + reviews_enabled 自動制御)
--   ✅ pg_trgm extension installed
--   ✅ facility_sources 新規テーブル
--   ✅ 既存 63件 migration: manual_approved:63 / admin_manual:63 / dog_run:50,park:13
--   ✅ search_text 全件 populated / official_url 全件 (63件)
--   ✅ TSVECTOR 検索動作: 'dog_run'→50, 'park'→13
--   ✅ pg_trgm 動作: '大阪' ILIKE→12, similarity('ドッグラン','ドッグランパーク')=0.5
-- ============================================================
-- 設計判断:
--   1. 実テーブル名 = pet_facilities (依頼書では facilities 表記)
--   2. 既存 category('dogrun','park') を保持 + 新規 facility_category 並列
--   3. Supabase は 'japanese' tsvector configuration 不可
--      → 'simple' で TSVECTOR 化 (空白区切り token のみ)
--      → 日本語の partial match は pg_trgm で補完 (Phase 2 予定 → Phase 1 前倒し)
--   4. Phase 2/3 用 CHECK 値も Phase 1 で全部宣言 (後の ALTER 不要)
-- ============================================================

-- ============================================================
-- 拡張機能
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- pet_facilities 拡張 (+14 cols)
-- ============================================================
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS facility_category TEXT
  CHECK (facility_category IN (
    'dog_run', 'park',
    'cafe_dog_ok', 'restaurant_dog_ok', 'shopping_dog_ok',
    'hotel_pet_ok', 'onsen_pet_ok',
    'dog_cafe', 'cat_cafe', 'small_animal_cafe',
    'tourist_dog_ok', 'beach_dog_ok',
    'camp_pet_ok', 'bbq_pet_ok',
    'leisure_dog_ok', 'museum_dog_ok', 'garden_dog_ok',
    'pet_salon', 'pet_hotel', 'training_school',
    'photo_studio', 'pet_goods_shop', 'craft_shop',
    'organic_food_shop', 'insurance_info',
    'vet_clinic', 'pet_shop_live', 'pet_funeral', 'pet_therapy',
    'other'
  ));

ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS region TEXT
  CHECK (region IN (
    'hokkaido','tohoku','kanto','chubu','kinki','chugoku','shikoku','kyushu','okinawa','nationwide'
  ));

ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS pet_size_allowed TEXT[]
  DEFAULT ARRAY['small','medium','large']::TEXT[];
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS pet_type_allowed TEXT[]
  DEFAULT ARRAY['dog']::TEXT[];

ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS official_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS source_type TEXT
  CHECK (source_type IN ('ai_scraped','user_submitted','admin_manual','business_owner'));
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS approval_status TEXT
  DEFAULT 'pending'
  CHECK (approval_status IN ('pending','auto_approved','manual_approved','rejected'));
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2);
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS reviews_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.pet_facilities ADD COLUMN IF NOT EXISTS search_text TSVECTOR;

-- ============================================================
-- Trigger 1: search_text 自動更新 ('simple' configuration)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_pet_facility_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := to_tsvector('simple',
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.address, '') || ' ' ||
    COALESCE(NEW.prefecture, '') || ' ' ||
    COALESCE(NEW.city, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.facility_category, '') || ' ' ||
    COALESCE(NEW.category, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pet_facilities_search_text ON public.pet_facilities;
CREATE TRIGGER trg_pet_facilities_search_text
  BEFORE INSERT OR UPDATE ON public.pet_facilities
  FOR EACH ROW EXECUTE FUNCTION public.update_pet_facility_search_text();

-- ============================================================
-- Trigger 2: reviews_enabled 自動制御
--   病院・ペットショップ生体・葬儀 → 強制 false (中立情報のみ)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_pet_facility_reviews_enabled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.facility_category IN ('vet_clinic', 'pet_shop_live', 'pet_funeral') THEN
    NEW.reviews_enabled := false;
  ELSE
    NEW.reviews_enabled := COALESCE(NEW.reviews_enabled, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pet_facilities_reviews_enabled ON public.pet_facilities;
CREATE TRIGGER trg_pet_facilities_reviews_enabled
  BEFORE INSERT OR UPDATE ON public.pet_facilities
  FOR EACH ROW EXECUTE FUNCTION public.set_pet_facility_reviews_enabled();

-- ============================================================
-- 既存 63件 Migration (idempotent)
-- ============================================================
UPDATE public.pet_facilities SET approval_status = 'manual_approved' WHERE approved = true AND approval_status = 'pending';
UPDATE public.pet_facilities SET approval_status = 'rejected'        WHERE approved = false AND approval_status = 'pending';
UPDATE public.pet_facilities SET source_type = 'admin_manual' WHERE source_type IS NULL;
UPDATE public.pet_facilities SET official_url = website WHERE website IS NOT NULL AND website <> '' AND (official_url IS NULL OR official_url = '');
UPDATE public.pet_facilities SET facility_category = 'dog_run' WHERE category = 'dogrun' AND facility_category IS NULL;
UPDATE public.pet_facilities SET facility_category = 'park'    WHERE category = 'park'   AND facility_category IS NULL;
-- search_text 全件再生成 (no-op UPDATE で Trigger 発火)
UPDATE public.pet_facilities SET id = id WHERE search_text IS NULL;

-- ============================================================
-- インデックス (9本)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pet_facilities_prefecture_category ON public.pet_facilities(prefecture, facility_category);
CREATE INDEX IF NOT EXISTS idx_pet_facilities_city               ON public.pet_facilities(city);
CREATE INDEX IF NOT EXISTS idx_pet_facilities_facility_cat       ON public.pet_facilities(facility_category);
CREATE INDEX IF NOT EXISTS idx_pet_facilities_region             ON public.pet_facilities(region);
CREATE INDEX IF NOT EXISTS idx_pet_facilities_approval           ON public.pet_facilities(approval_status);
CREATE INDEX IF NOT EXISTS idx_pet_facilities_search_text        ON public.pet_facilities USING GIN(search_text);
CREATE INDEX IF NOT EXISTS idx_pet_facilities_name_trgm          ON public.pet_facilities USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pet_facilities_address_trgm       ON public.pet_facilities USING GIN(address gin_trgm_ops);

-- ============================================================
-- facility_sources (AI 収集源管理 / event_sources と並列)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.facility_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source_type TEXT CHECK (source_type IN (
    'aggregator','prefecture_tourism','city_official','pet_blog',
    'cafe_directory','hotel_directory','social','rss'
  )),
  prefecture TEXT,
  city TEXT,
  facility_category TEXT,
  last_scraped_at TIMESTAMPTZ,
  scrape_frequency TEXT CHECK (scrape_frequency IN ('daily','weekly','monthly')),
  is_active BOOLEAN DEFAULT true,
  success_rate NUMERIC(3,2),
  facilities_collected INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facility_sources_active     ON public.facility_sources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_facility_sources_freq       ON public.facility_sources(scrape_frequency);
CREATE INDEX IF NOT EXISTS idx_facility_sources_prefecture ON public.facility_sources(prefecture);

-- ============================================================
-- RLS (facility_sources のみ / pet_facilities は既存 RLS 維持)
-- ============================================================
ALTER TABLE public.facility_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS facility_sources_admin_full ON public.facility_sources;
CREATE POLICY facility_sources_admin_full ON public.facility_sources
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS facility_sources_service_role_full ON public.facility_sources;
CREATE POLICY facility_sources_service_role_full ON public.facility_sources
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- dry_run 検証結果
-- ============================================================
-- pet_facilities cols: 19 → 33 (+14)
-- 既存 63件 全件 migration 完了:
--   approval_status='manual_approved': 63
--   source_type='admin_manual': 63
--   facility_category: dog_run=50, park=13
--   search_text: 全件 populated (Trigger 動作 ✅)
--   official_url: 全件 (63)
--   reviews_enabled=true: 63件 (全て口コミ可能カテゴリ)
-- pg_trgm extension: ✅ installed
-- facility_sources: ✅ 新規作成
-- 9 indexes (basic 5 + GIN tsvector 1 + GIN pg_trgm 2 + 既存)
--
-- 検索動作テスト:
--   to_tsquery('simple','dog_run') @@ search_text → 50件
--   to_tsquery('simple','park') @@ search_text → 13件
--   name ILIKE '%大阪%' → 12件
--   name ILIKE '%東京%' → 12件
--   similarity('ドッグラン','ドッグランパーク') = 0.5 ✅
--
-- 🛡️ 既存資産完全保護:
--   profiles: 16, listings: 8, badges: 33, events: 14, pet_facilities: 63
--   pets: 7, pet_stories: 31, x_post_templates: 46
--   meta/threads/instagram: 8/5/5 tables (無傷)
--   facility_reviews: 0 → 0 (元から空)
--   cron 4 active 無傷
-- ============================================================

-- ============================================================
-- 次フェーズ予定
--   Phase 1 UI (6/5):  FacilitiesPage 検索バー強化 + カテゴリ別タブ
--   Phase 2 DDL (6/8): PostGIS extension + location GEOGRAPHY + シノニム辞書 + 8カテゴリ追加
--   Phase 3 (6/15):    ai-facility-search Edge Function + 病院/ペットショップ 4カテゴリ
-- ============================================================
