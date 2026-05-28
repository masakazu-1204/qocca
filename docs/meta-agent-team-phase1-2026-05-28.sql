-- ============================================================
-- 依頼書 #31 Phase 1 + Phase 3 SQL Bundle (2026-05-28 朝 10:55)
-- Qocca メタエージェント (監視・統合) Phase 1 DDL + Phase 3 UI
-- 🛡️ 99-safety-protocol 厳守 / 既存資産完全保護
-- 🌌 Qocca AI エージェントチーム憲法 v1.0 準拠
-- ============================================================
-- 適用先 : Supabase project qufrqkuipzuqeqkvuhkx
-- 適用方法: mcp__supabase__apply_migration "request_31_phase1_meta_agent_team"
-- 適用日時: 2026-05-28
-- 結果   :
--   ✅ 3 tables (state / messages / notifications)
--   ✅ 6 RLS policies (admin_full + service_role_full × 3)
--   ✅ 8 indexes
--   ✅ 1 RPC (meta_agent_summary)
--   ✅ 8 初期 Agent レコード投入
-- ============================================================
-- Tier 4 専門 Agent 8体制:
--   1. events_collection (#27 v2 / paused)
--   2. facility_info (#28 / paused)
--   3. x_post (#16 v2 + #29 / 🟢 healthy 完全稼働)
--   4. threads_post (#25 / paused)
--   5. instagram_post (#25 / paused)
--   6. blog_seo (#24 v2 / 🟢 healthy 稼働中)
--   7. meta_ads (#26 v2 / paused / King 6月準備後)
--   8. meta_agent (#31 自身 / 🟢 healthy)
-- ============================================================

-- ============================================================
-- 1) meta_agent_state (各 Agent 稼働状態)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_agent_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL UNIQUE,
  agent_status TEXT CHECK (agent_status IN ('healthy', 'warning', 'error', 'paused')) DEFAULT 'healthy',
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  cost_today NUMERIC(10,4) DEFAULT 0,
  cost_month NUMERIC(10,4) DEFAULT 0,
  metrics JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) meta_agent_messages (Agent 間中継 / 憲法 第5条 連携の原則)
CREATE TABLE IF NOT EXISTS public.meta_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent TEXT,
  to_agent TEXT,
  message_type TEXT,
  payload JSONB,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3) meta_agent_notifications (King 通知)
CREATE TABLE IF NOT EXISTS public.meta_agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT,
  notification_type TEXT,
  title TEXT,
  body TEXT,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')) DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- インデックス (8本)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_meta_state_status      ON public.meta_agent_state(agent_status);
CREATE INDEX IF NOT EXISTS idx_meta_state_last_run    ON public.meta_agent_state(last_run_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_meta_msg_unprocessed   ON public.meta_agent_messages(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_meta_msg_to_agent      ON public.meta_agent_messages(to_agent);
CREATE INDEX IF NOT EXISTS idx_meta_msg_priority      ON public.meta_agent_messages(priority);
CREATE INDEX IF NOT EXISTS idx_meta_notif_unread      ON public.meta_agent_notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_meta_notif_severity    ON public.meta_agent_notifications(severity);
CREATE INDEX IF NOT EXISTS idx_meta_notif_created     ON public.meta_agent_notifications(created_at DESC);

-- ============================================================
-- RLS 超厳格 (admin_only + service_role / 一般ユーザー完全禁止)
-- 憲法 第2条 (Kill Switch) + 第3条 (透明性) 体現
-- ============================================================
ALTER TABLE public.meta_agent_state         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_agent_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_agent_notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['meta_agent_state','meta_agent_messages','meta_agent_notifications']
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
-- 初期 Agent 8レコード投入
-- ============================================================
INSERT INTO public.meta_agent_state (agent_name, agent_status, metrics) VALUES
  ('events_collection', 'paused',  '{"description":"全国小規模動物イベント自動収集 (#27 v2)","tier":4}'::jsonb),
  ('facility_info',     'paused',  '{"description":"全国施設拡張 + AI 収集 + ワード検索 (#28)","tier":4}'::jsonb),
  ('x_post',            'healthy', '{"description":"X 自動投稿 + 画像 + 自動 refresh (#16 v2 + #29)","tier":4}'::jsonb),
  ('threads_post',      'paused',  '{"description":"Threads 自動投稿 (#25)","tier":4}'::jsonb),
  ('instagram_post',    'paused',  '{"description":"Instagram 自動投稿 (#25)","tier":4}'::jsonb),
  ('blog_seo',          'healthy', '{"description":"ブログ SEO + gpt-image-1 (#24 v2)","tier":4}'::jsonb),
  ('meta_ads',          'paused',  '{"description":"Meta 広告 AI 自動運用 (#26 v2)","tier":4}'::jsonb),
  ('meta_agent',        'healthy', '{"description":"監視・統合 メタエージェント (#31)","tier":4}'::jsonb)
ON CONFLICT (agent_name) DO NOTHING;

-- ============================================================
-- RPC: meta_agent_summary (全 Agent 状態サマリ)
-- ============================================================
CREATE OR REPLACE FUNCTION public.meta_agent_summary()
RETURNS TABLE(
  agent_name TEXT,
  agent_status TEXT,
  last_run_at TIMESTAMPTZ,
  cost_month NUMERIC,
  description TEXT
) AS $$
  SELECT
    s.agent_name,
    s.agent_status,
    s.last_run_at,
    s.cost_month,
    s.metrics->>'description' AS description
  FROM public.meta_agent_state s
  ORDER BY
    CASE s.agent_status
      WHEN 'critical' THEN 1 WHEN 'error' THEN 2 WHEN 'warning' THEN 3
      WHEN 'healthy' THEN 4 WHEN 'paused' THEN 5 ELSE 6
    END,
    s.agent_name;
$$ LANGUAGE SQL STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.meta_agent_summary() TO authenticated;

-- ============================================================
-- 動作確認結果
-- ============================================================
-- meta_agent_state: 8件 (healthy=3 / paused=5)
-- meta_agent_messages: 0件 (Phase 2 dispatcher で生成)
-- meta_agent_notifications: 0件 (Phase 2 monitor で生成)
-- RLS: 6 policies (admin_full + service_role_full × 3)
-- RPC: meta_agent_summary 動作 OK
-- 既存資産: profiles=16 / pet_facilities=63 / events=14 全て無変動 ✅
-- ============================================================
-- Phase 3 UI: Admin.tsx に MetaAgentManagementPage (+389行) 追加
-- 10メニュー化: dashboard/events/listings/members/reports/sales/
--               crowdfunding/meta-ads/events-ai/meta-agent
-- 6 タブ: Dashboard / 個別 Agent / Messages / Notifications / Cost / Kill Switch
-- ============================================================
-- Phase 2 (Edge Function 3本) と Phase 4 (既存 Agent 組み込み) は 8月着手予定
-- ============================================================
