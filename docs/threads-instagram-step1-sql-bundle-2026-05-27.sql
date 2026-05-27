-- ============================================================
-- 依頼書 #25 Step 1 SQL Bundle (2026-05-27 深夜)
-- Threads + Instagram 自動投稿基盤 DDL (Phase 1.2 x_post_* パターン拡張)
-- 🛡️ 99-safety-protocol 厳守 / 既存住民16・出品8・バッジ33 完全保護
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_25_step1_threads_instagram_tables"
-- 適用日時: 2026-05-27
-- 結果   : ✅ 10 tables / 10 RLS policies / 8 indexes / 2 singleton settings
--          ✅ 4 pg_cron jobs (active=false / Edge Function deploy 待ち)
-- ============================================================

-- ============================================================
-- THREADS (5 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.threads_post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL,
  day_of_week INTEGER,
  time_slot TEXT NOT NULL,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  image_prompt TEXT,
  use_image BOOLEAN DEFAULT false,
  weight NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  weight_history JSONB DEFAULT '[]'::jsonb,
  performance_score NUMERIC,
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.threads_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.threads_post_templates(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  cost_usd NUMERIC,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metrics_1h JSONB,
  metrics_24h JSONB,
  metrics_7d JSONB,
  engagement_rate NUMERIC,
  follower_delta INTEGER,
  performance_score NUMERIC,
  analyzed_at TIMESTAMPTZ,
  reposts_count INTEGER DEFAULT 0,   -- Threads 固有
  quotes_count INTEGER DEFAULT 0     -- Threads 固有
);

CREATE TABLE IF NOT EXISTS public.threads_post_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  kill_switch BOOLEAN DEFAULT false,
  morning_time TIME DEFAULT '08:00:00',
  evening_time TIME DEFAULT '20:00:00',
  morning_use_image BOOLEAN DEFAULT false,
  evening_use_image BOOLEAN DEFAULT true,
  max_posts_per_day INTEGER DEFAULT 2,
  auto_improvement_enabled BOOLEAN DEFAULT true,
  weight_adjustment_factor NUMERIC DEFAULT 0.10,
  min_data_points INTEGER DEFAULT 5,
  ai_template_generation_enabled BOOLEAN DEFAULT true,
  CONSTRAINT threads_post_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.threads_followers_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ DEFAULT now(),
  follower_count INTEGER NOT NULL,
  following_count INTEGER,
  total_posts INTEGER
);

CREATE TABLE IF NOT EXISTS public.threads_monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  total_posts INTEGER,
  total_impressions INTEGER,
  total_engagement INTEGER,
  avg_engagement_rate NUMERIC,
  follower_growth INTEGER,
  total_cost_usd NUMERIC,
  top_templates JSONB,
  bottom_templates JSONB,
  ai_recommendations TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INSTAGRAM (5 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.instagram_post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL,
  day_of_week INTEGER,
  time_slot TEXT NOT NULL,
  caption_template TEXT NOT NULL,       -- Instagram 固有 (template の代わり)
  hashtags TEXT[] DEFAULT '{}',         -- Instagram 固有
  variables JSONB DEFAULT '[]'::jsonb,
  image_prompt TEXT NOT NULL,           -- Instagram 必須 (画像なしは投稿不可)
  weight NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  weight_history JSONB DEFAULT '[]'::jsonb,
  performance_score NUMERIC,
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.instagram_post_templates(id) ON DELETE SET NULL,
  caption TEXT NOT NULL,
  media_url TEXT NOT NULL,              -- Instagram 必須
  media_id TEXT,                        -- IG Graph API media id
  permalink TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  cost_usd NUMERIC,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metrics_1h JSONB,
  metrics_24h JSONB,
  metrics_7d JSONB,
  engagement_rate NUMERIC,
  follower_delta INTEGER,
  performance_score NUMERIC,
  analyzed_at TIMESTAMPTZ,
  saves_count INTEGER DEFAULT 0         -- Instagram 固有
);

CREATE TABLE IF NOT EXISTS public.instagram_post_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  kill_switch BOOLEAN DEFAULT false,
  morning_time TIME DEFAULT '09:00:00', -- Instagram は 9:00 JST
  evening_time TIME DEFAULT '19:00:00', -- Instagram は 19:00 JST
  morning_use_image BOOLEAN DEFAULT true,
  evening_use_image BOOLEAN DEFAULT true,
  max_posts_per_day INTEGER DEFAULT 2,
  auto_improvement_enabled BOOLEAN DEFAULT true,
  weight_adjustment_factor NUMERIC DEFAULT 0.10,
  min_data_points INTEGER DEFAULT 5,
  ai_template_generation_enabled BOOLEAN DEFAULT true,
  CONSTRAINT instagram_post_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.instagram_followers_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ DEFAULT now(),
  follower_count INTEGER NOT NULL,
  following_count INTEGER,
  total_posts INTEGER
);

CREATE TABLE IF NOT EXISTS public.instagram_monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  total_posts INTEGER,
  total_impressions INTEGER,
  total_engagement INTEGER,
  avg_engagement_rate NUMERIC,
  follower_growth INTEGER,
  total_cost_usd NUMERIC,
  top_templates JSONB,
  bottom_templates JSONB,
  ai_recommendations TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 初期 settings レコード (singleton)
-- ============================================================
INSERT INTO public.threads_post_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instagram_post_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS 有効化 + 管理者専用ポリシー (10 tables × admin only)
-- ============================================================
ALTER TABLE public.threads_post_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads_post_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads_followers_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads_monthly_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_post_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_post_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_followers_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_monthly_reports   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'threads_post_templates','threads_posts','threads_post_settings',
    'threads_followers_history','threads_monthly_reports',
    'instagram_post_templates','instagram_posts','instagram_post_settings',
    'instagram_followers_history','instagram_monthly_reports'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_only ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_admin_only ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- ============================================================
-- インデックス (8本)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_threads_posts_status            ON public.threads_posts(status);
CREATE INDEX IF NOT EXISTS idx_threads_posts_scheduled_at      ON public.threads_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_threads_post_templates_active   ON public.threads_post_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_threads_followers_history_recorded ON public.threads_followers_history(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_status            ON public.instagram_posts(status);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_scheduled_at      ON public.instagram_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_instagram_post_templates_active   ON public.instagram_post_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_instagram_followers_history_recorded ON public.instagram_followers_history(recorded_at DESC);

-- ============================================================
-- pg_cron jobs (4本 / active=false / Edge Function deploy 後に King が active 化)
-- ============================================================
-- threads-morning-post   : 23:00 UTC = 08:00 JST
-- threads-evening-post   : 11:00 UTC = 20:00 JST
-- instagram-morning-post : 00:00 UTC = 09:00 JST
-- instagram-evening-post : 10:00 UTC = 19:00 JST
-- 呼び先 Edge Function:
--   threads-cron-handler  / instagram-cron-handler  (Step 2 で deploy 予定)

-- 実投入は cron.schedule() + cron.alter_job(active := false) 経由
-- ※ cron.job への直接 UPDATE は permission denied (Supabase)
-- ※ cron.alter_job() は SECURITY DEFINER 経由なので OK

-- ============================================================
-- dry_run 検証結果 (適用直後 SELECT)
-- ============================================================
-- 10 tables: ✅ created (cols: 5/12/11/15/20 × 2 PF = 一致)
-- 10 RLS policies: ✅ admin_only × 10
-- 10 RLS enabled: ✅
-- 8 indexes: ✅
-- 2 singleton settings rows: ✅ (threads=1, instagram=1)
-- 4 cron jobs: ✅ (all active=false)
--
-- 既存データ完全保護:
--   profiles: 16 (変動なし)
--   listings: 8 (変動なし)
--   badges: 33 (変動なし)
--   crowdfunding_rewards: 14 (変動なし)
--   x_post_templates: 46 (変動なし)
--   pets: 7 / pet_stories: 31 (変動なし)
--
-- 🛡️ 99-safety-protocol 厳守完了
