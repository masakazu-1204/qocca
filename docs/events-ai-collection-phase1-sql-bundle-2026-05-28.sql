-- ============================================================
-- 依頼書 #27 v2 Phase 1 SQL Bundle (2026-05-28 早朝)
-- 全国小規模動物イベント自動収集システム DDL
-- 🛡️ 99-safety-protocol 厳守 / 既存 14 events 完全保護
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_27_v2_phase1_events_ai_collection"
-- 適用日時: 2026-05-28
-- 結果   : ✅ events 17→28 cols (+11) / 6 indexes / 3 新テーブル / 6 RLS policies
--          ✅ 既存 14件 移行 (manual_approved:7 / expired:6 / rejected:1)
--          ✅ 既存 10件の url を official_url にコピー
-- ============================================================
-- 設計判断:
--   - prefecture: 既存カラム (NOT NULL 漢字) → IF NOT EXISTS で衝突回避
--   - category: 既存カラム → 新規 event_category を追加して並列運用
--   - approval_status: 新規追加し、既存 status から自動移行:
--     * 'approved' → 'manual_approved'
--     * 'ended'    → 'expired'
--     * 'rejected' → 'rejected'
--   - official_url: 新規 NOT NULL DEFAULT '' / 既存 url 値をコピー
--   - source_type: 既存 14件は全て 'admin_manual' に設定
-- ============================================================

-- ============================================================
-- events テーブル拡張 (10 columns / prefecture は既存ためスキップ)
-- ============================================================
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_category TEXT
  CHECK (event_category IN (
    'adoption', 'expo', 'market', 'seminar', 'training',
    'cafe_event', 'shopping_dog_ok', 'medical_check', 'photo_session',
    'fundraising', 'welfare', 'other'
  ));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS region TEXT
  CHECK (region IN (
    'hokkaido', 'tohoku', 'kanto', 'chubu',
    'kinki', 'chugoku', 'shikoku', 'kyushu', 'okinawa',
    'nationwide', 'online'
  ));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_size TEXT
  CHECK (event_size IN ('local', 'regional', 'national'));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_type TEXT
  CHECK (source_type IN (
    'ai_scraped', 'user_submitted', 'admin_manual', 'official_api'
  ));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS approval_status TEXT
  DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'auto_approved', 'manual_approved', 'rejected', 'expired'));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS official_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- ============================================================
-- 既存 14件の移行 (idempotent: WHERE 句で再実行安全)
-- ============================================================
UPDATE public.events SET approval_status = 'manual_approved' WHERE status = 'approved' AND approval_status = 'pending';
UPDATE public.events SET approval_status = 'expired'         WHERE status = 'ended'    AND approval_status = 'pending';
UPDATE public.events SET approval_status = 'rejected'        WHERE status = 'rejected' AND approval_status = 'pending';
UPDATE public.events SET official_url = url WHERE url IS NOT NULL AND url <> '' AND (official_url IS NULL OR official_url = '');
UPDATE public.events SET source_type = 'admin_manual' WHERE source_type IS NULL;

-- ============================================================
-- events 検索インデックス (6本)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_prefecture_date
  ON public.events(prefecture, event_date)
  WHERE approval_status IN ('auto_approved', 'manual_approved');
CREATE INDEX IF NOT EXISTS idx_events_city           ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_events_region_date    ON public.events(region, event_date);
CREATE INDEX IF NOT EXISTS idx_events_event_category ON public.events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_size           ON public.events(event_size);
CREATE INDEX IF NOT EXISTS idx_events_approval       ON public.events(approval_status);

-- ============================================================
-- event_sources (新規)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source_type TEXT CHECK (source_type IN (
    'prefecture_official', 'city_official', 'npo', 'pet_shop',
    'cafe', 'vet', 'aggregator', 'social', 'rss'
  )),
  prefecture TEXT,
  city TEXT,
  last_scraped_at TIMESTAMPTZ,
  scrape_frequency TEXT CHECK (scrape_frequency IN ('daily', 'weekly', 'monthly')),
  is_active BOOLEAN DEFAULT true,
  success_rate NUMERIC(3,2),
  events_collected INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- event_scrape_logs (新規)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.event_sources(id) ON DELETE SET NULL,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  events_found INTEGER,
  events_new INTEGER,
  events_duplicate INTEGER,
  errors TEXT,
  ai_cost_usd NUMERIC(10,4)
);

-- ============================================================
-- event_dedup_hashes (新規)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_dedup_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  content_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 新規テーブル インデックス (6本)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_sources_active        ON public.event_sources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_event_sources_freq          ON public.event_sources(scrape_frequency);
CREATE INDEX IF NOT EXISTS idx_event_sources_prefecture    ON public.event_sources(prefecture);
CREATE INDEX IF NOT EXISTS idx_event_scrape_logs_source    ON public.event_scrape_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_event_scrape_logs_scraped   ON public.event_scrape_logs(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_dedup_hashes_event_id ON public.event_dedup_hashes(event_id);

-- ============================================================
-- RLS (admin_only + service_role) — Meta 広告と同じ超厳格パターン
-- ============================================================
ALTER TABLE public.event_sources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_scrape_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_dedup_hashes  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['event_sources','event_scrape_logs','event_dedup_hashes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_full ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_service_role_full ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_admin_full ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_service_role_full ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- ============================================================
-- dry_run 検証結果
-- ============================================================
-- events cols: 17 → 28 (+11)
-- events 14件: manual_approved=7 / expired=6 / rejected=1
-- official_url 移行: 10件
-- source_type='admin_manual': 14件
-- 3 新テーブル: ✅ event_sources / event_scrape_logs / event_dedup_hashes
-- 29 indexes total on event* tables
-- 6 RLS policies (2 × 3 tables)
--
-- 既存資産完全保護:
--   profiles: 16, listings: 8, badges: 33, events: 14
--   pets: 7, pet_stories: 31, x_post_templates: 46
--   meta/threads/instagram: 8/5/5 tables (無傷)
--   cron 4 active (blog/cleanup/x-morning/x-evening) 無傷
--
-- 🛡️ 99-safety-protocol 厳守完了
-- ============================================================

-- ============================================================
-- 次フェーズ予定 (期限順)
--   Phase 3 (6/2):  Admin UI 8タブ (Dashboard / pending / auto / 公開中 / sources / logs / 信頼度 / Kill)
--   Phase 2 (6/5):  Edge Function 5本 (discovery / orchestrator / scraper / verifier / deduplicator)
--   Phase 4 (6/8):  EventsPage 強化 (都道府県・市区町村・カテゴリ・規模・近所検索・提案フォーム)
--   Phase 5 (6/10): pg_cron 5本 (active=false でデプロイ・King 確認後 active 化)
-- ============================================================
