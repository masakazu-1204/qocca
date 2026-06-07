-- ============================================
-- 健康記録 Phase 2 B1 Step 1 DDL (依頼書 #136 / 2026/6/8)
-- 実行済: Supabase MCP 経由 (commit 当日)
-- 検証: テーブル 2 / RLS 8 / index 4 / rows 0
--
-- 設計憲法 6箇条 (#136 Phase A 承認時):
--   1. 記録 + 可視化 + 過去並列表示 のみ
--   2. 診断・治療助言・病名候補 一切なし
--   3. 異常値の自動判定・警告アラート 一切なし
--   4. 公開側 (UserProfile / 街の物語) への自動流出なし (opt-in は B2 以降)
--   5. プライバシー: RLS で飼い主のみ参照・編集可
--   6. 「気になる場合は獣医師にご相談ください」定型文 常設 (UI 側)
-- ============================================

-- 1. 体重記録 (高頻度 / グラフ用)
CREATE TABLE IF NOT EXISTS pet_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  recorded_at DATE NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 200),
  memo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pet_weights_pet_date ON pet_weights(pet_id, recorded_at DESC);

-- 2. 通院記録
CREATE TABLE IF NOT EXISTS pet_clinic_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visited_at DATE NOT NULL,
  clinic_name TEXT,
  reason TEXT,
  memo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pet_clinic_pet_date ON pet_clinic_visits(pet_id, visited_at DESC);

-- 3. RLS: 飼い主のみ 全操作 (SELECT / INSERT / UPDATE / DELETE)
ALTER TABLE pet_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pw_select_owner ON pet_weights;
CREATE POLICY pw_select_owner ON pet_weights FOR SELECT
  USING (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_weights.pet_id AND pets.owner_id = auth.uid()));
DROP POLICY IF EXISTS pw_insert_owner ON pet_weights;
CREATE POLICY pw_insert_owner ON pet_weights FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_weights.pet_id AND pets.owner_id = auth.uid()));
DROP POLICY IF EXISTS pw_update_owner ON pet_weights;
CREATE POLICY pw_update_owner ON pet_weights FOR UPDATE
  USING (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_weights.pet_id AND pets.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_weights.pet_id AND pets.owner_id = auth.uid()));
DROP POLICY IF EXISTS pw_delete_owner ON pet_weights;
CREATE POLICY pw_delete_owner ON pet_weights FOR DELETE
  USING (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_weights.pet_id AND pets.owner_id = auth.uid()));

ALTER TABLE pet_clinic_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pcv_select_owner ON pet_clinic_visits;
CREATE POLICY pcv_select_owner ON pet_clinic_visits FOR SELECT
  USING (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_clinic_visits.pet_id AND pets.owner_id = auth.uid()));
DROP POLICY IF EXISTS pcv_insert_owner ON pet_clinic_visits;
CREATE POLICY pcv_insert_owner ON pet_clinic_visits FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_clinic_visits.pet_id AND pets.owner_id = auth.uid()));
DROP POLICY IF EXISTS pcv_update_owner ON pet_clinic_visits;
CREATE POLICY pcv_update_owner ON pet_clinic_visits FOR UPDATE
  USING (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_clinic_visits.pet_id AND pets.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_clinic_visits.pet_id AND pets.owner_id = auth.uid()));
DROP POLICY IF EXISTS pcv_delete_owner ON pet_clinic_visits;
CREATE POLICY pcv_delete_owner ON pet_clinic_visits FOR DELETE
  USING (EXISTS (SELECT 1 FROM pets WHERE pets.id = pet_clinic_visits.pet_id AND pets.owner_id = auth.uid()));

-- 検証 (実行直後): 期待値
-- pet_weights_exists = 1 / pet_clinic_visits_exists = 1
-- pet_weights_rls_policies = 4 / pet_clinic_visits_rls_policies = 4
-- pet_weights_indexes = 2 (PK + 複合) / pet_clinic_visits_indexes = 2
-- pet_weights_rows = 0 / pet_clinic_visits_rows = 0
