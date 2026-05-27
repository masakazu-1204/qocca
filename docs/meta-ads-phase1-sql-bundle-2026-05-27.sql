-- ============================================================
-- 依頼書 #26 v2 Phase 1 SQL Bundle (2026-05-27 深夜)
-- Meta 広告 AI 完全自動運用 DDL 8テーブル
-- 🛡️ 99-safety-protocol 厳守 / 既存資産完全保護
-- 🔒 RLS 超厳格: admin_only + service_role のみ / 一般ユーザー完全禁止
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_26_v2_phase1_meta_ads_tables"
-- 適用日時: 2026-05-27
-- 結果   : ✅ 8 tables / 16 policies (admin+service_role × 8) / 8 indexes
--          ✅ 2 monthly_budgets レコード (2026-06 paused / 2026-07 normal 50k/100k)
-- ============================================================
-- 設計思想:
--   - 「異常な ROAS」目指す (5x〜10x)
--   - 3段階予算ガード: Meta 側 10万 + AI 側 5万 + 異常検知 paused
--   - 経営機密 (予算/ROAS/売上/ターゲット) のため超厳格 RLS
--   - Edge Function は 6月 King 事前準備後に Phase 3 で deploy
-- ============================================================

-- ============================================================
-- 1. meta_campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_campaign_id TEXT UNIQUE,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  daily_budget NUMERIC(10,2),
  total_spend NUMERIC(10,2) DEFAULT 0,
  target_audience JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. meta_ad_sets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  meta_ad_set_id TEXT UNIQUE,
  name TEXT,
  targeting JSONB,
  budget NUMERIC(10,2),
  optimization_goal TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. meta_creatives (Phase 3 で gpt-4o + gpt-image-1 自動生成)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_set_id UUID REFERENCES public.meta_ad_sets(id) ON DELETE CASCADE,
  meta_creative_id TEXT UNIQUE,
  type TEXT CHECK (type IN ('image','video','carousel')),
  headline TEXT,
  body TEXT,
  cta TEXT,
  media_urls TEXT[],
  landing_page_url TEXT,
  generated_by TEXT,                -- 'gpt-4o' / 'gpt-image-1' / 'manual'
  generation_prompt TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  ctr NUMERIC(5,4),
  cpc NUMERIC(10,2),
  cpm NUMERIC(10,2),
  roas NUMERIC(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. meta_ab_tests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT,
  variant_a_id UUID REFERENCES public.meta_creatives(id) ON DELETE SET NULL,
  variant_b_id UUID REFERENCES public.meta_creatives(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  winner_id UUID REFERENCES public.meta_creatives(id) ON DELETE SET NULL,
  confidence NUMERIC(5,4),          -- 統計的有意性 (>0.95 で勝者確定)
  test_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. meta_budget_adjustments (AI 予算調整履歴)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_budget_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_set_id UUID REFERENCES public.meta_ad_sets(id) ON DELETE CASCADE,
  before_budget NUMERIC(10,2),
  after_budget NUMERIC(10,2),
  reason TEXT,                      -- 'ROAS>5x +20%' 等
  ai_confidence NUMERIC(5,4),
  applied_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. meta_landing_pages (LP A/B テスト)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  variant_name TEXT,
  visits INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,4),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. meta_monthly_budgets (3段階予算ガードの基盤)
-- ============================================================
-- レベル1: max_budget = 月絶対上限 (King 確定 10万円)
-- レベル2: base_budget = 通常運用 (King 確定 5万円)
-- レベル3: mode で AI 動作切替
--   normal:    < 5万 / ROAS > 5x → +20%, < 2x → -20%
--   expansion: 5-8万 / ROAS > 7x → +20%, 3-7x → 維持, < 3x → -30%
--   careful:   8-9.5万 / ±10% のみ
--   paused:    9.5万+ / 全広告 pause + King 通知
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL UNIQUE,
  base_budget NUMERIC(10,2) DEFAULT 50000,
  max_budget NUMERIC(10,2) DEFAULT 100000,
  current_spend NUMERIC(10,2) DEFAULT 0,
  remaining NUMERIC(10,2),
  mode TEXT CHECK (mode IN ('normal','expansion','careful','paused')) DEFAULT 'normal',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. meta_daily_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_spend NUMERIC(10,2),
  total_revenue NUMERIC(10,2),
  total_roas NUMERIC(5,2),
  top_creative_id UUID REFERENCES public.meta_creatives(id) ON DELETE SET NULL,
  ai_actions_taken JSONB,
  ai_recommendations TEXT,
  current_mode TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- インデックス (8本)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_meta_creatives_roas        ON public.meta_creatives(roas DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_meta_creatives_is_active   ON public.meta_creatives(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_campaign      ON public.meta_ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_creatives_ad_set      ON public.meta_creatives(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_meta_daily_reports_date    ON public.meta_daily_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_monthly_budgets_month ON public.meta_monthly_budgets(month);
CREATE INDEX IF NOT EXISTS idx_meta_budget_adj_ad_set     ON public.meta_budget_adjustments(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_meta_ab_tests_winner       ON public.meta_ab_tests(winner_id);

-- ============================================================
-- RLS 有効化 + 超厳格ポリシー
-- ============================================================
-- 設計:
--   1. admin_full: authenticated + admins テーブル exists → 完全アクセス
--   2. service_role_full: Edge Function (cron / auto-optimize-budget) 用
--   3. anon / authenticated (non-admin): policy なし = 完全禁止
-- ============================================================
ALTER TABLE public.meta_campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_sets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_creatives          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ab_tests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_budget_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_landing_pages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_monthly_budgets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_daily_reports      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'meta_campaigns','meta_ad_sets','meta_creatives','meta_ab_tests',
    'meta_budget_adjustments','meta_landing_pages','meta_monthly_budgets','meta_daily_reports'
  ]
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
-- 初期 monthly_budgets レコード
-- ============================================================
INSERT INTO public.meta_monthly_budgets (month, base_budget, max_budget, mode, notes)
VALUES
  ('2026-07', 50000, 100000, 'normal', 'グランドオープン稼働初月 / King 確定予算 v2.0'),
  ('2026-06', 0,     0,      'paused', 'King 事前準備期 / 広告稼働なし')
ON CONFLICT (month) DO NOTHING;

-- ============================================================
-- dry_run 検証結果 (適用直後 SELECT)
-- ============================================================
-- 8 tables: ✅ (cols: 9/9/22/10/7/8/10/10)
-- 16 RLS policies: ✅ admin_full + service_role_full × 8
-- 8 indexes: ✅
-- 2 initial monthly_budgets rows: ✅ (2026-06 paused, 2026-07 normal)
--
-- 既存資産完全保護:
--   profiles: 16 (変動なし)
--   listings: 8 (変動なし)
--   badges: 33 (変動なし)
--   cron jobs: 4 active / 4 inactive (#25 と同じ)
--
-- 🛡️ 99-safety-protocol 厳守完了
