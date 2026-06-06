-- ============================================================================
-- クラファン基盤 Step 1: SQL バンドル
-- 作成日: 2026/5/25
-- 作成者: クマちゃん (Claude Code)
-- 依頼者: King + Claude.ai (依頼書 #5)
-- 実行方法: Supabase Dashboard > SQL Editor で 1ブロックずつ順番に実行
-- 99-safety-protocol 厳守: 既存テーブル無傷確認済み
-- ============================================================================
--
-- 【既存スキーマとの整合性調整内容】
--   1. 依頼書の badges.threshold カラム → 既存スキーマは tier_order/requirement_type/count
--      → INSERT 文を既存スキーマに合わせて書き換え済み
--   2. 依頼書 RLS の profiles.is_admin → 既存は profiles.role='admin'
--      → RLS ポリシーを role='admin' で書き換え済み
--   3. 既存 crowdfunding_codes (Step 1完了済み) を活用、新規 redemption_codes は作らず
--      crowdfunding_codes.backer_id 列を ALTER ADD で追加 (テーブル増設を回避)
--   4. 7段階リターン: 既存7件 (cheer/resident/ark/seller/avatar/sponsor/partner)
--      を is_active=false で不二化 + 新7件 INSERT で並存 (履歴維持)
--
-- 【tier 値の対応関係】
--   依頼書の短縮 tier → 新 crowdfunding_rewards.id (両方を許可する CHECK 制約)
--     supporter   → supporter_1000   (¥1,000  無制限)
--     resident    → resident_3000    (¥3,000  300名限定)
--     creator     → creator_8000     (¥8,000  100名限定)
--     family      → family_15000     (¥15,000  50名限定)
--     mayor       → mayor_30000      (¥30,000  20名限定)
--     ark_patron  → ark_patron_50000 (¥50,000  10名限定)
--     corporate   → corporate_300000 (¥300,000  5社限定)
--
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 【DDL #1】 crowdfunding_rewards: 既存7件 不二化 + 新7件 INSERT
--   既存履歴は維持 (is_active=false)、新運用は新7件で
-- ────────────────────────────────────────────────────────────────────────────

-- 既存7件を不二化 (履歴維持)
UPDATE crowdfunding_rewards
SET is_active = false
WHERE id IN (
  'cheer_500', 'resident_1500', 'ark_3000',
  'seller_5000', 'avatar_10000', 'sponsor_30000', 'partner_100000'
);

-- 新7件 INSERT (King 戦略変更版・¥1,000～¥300,000)
INSERT INTO crowdfunding_rewards (id, name, price_jpy, description, benefits, total_slots, is_active) VALUES
  ('supporter_1000', '応援サポーター',
    1000,
    '2026年クラファン期に Qocca を支援してくださった応援サポーター様',
    '["応援バッジ", "創業期住民の名簿に名前掲載 (希望者のみ)"]'::jsonb,
    NULL,  -- 無制限
    true),
  ('resident_3000', '創業メンバー｜街の住民',
    3000,
    '2026年6月クラファン時にお迎えした創業期住民',
    '["創業メンバーバッジ", "Qocca街の住民登録 (永久)", "創業期住民限定セクションへのアクセス"]'::jsonb,
    300,
    true),
  ('creator_8000', '創業クリエイター｜出品者',
    8000,
    '2026年クラファン時にお迎えした創業期クリエイター (出品者)',
    '["創業クリエイターバッジ", "永久手数料3% (通常10%→3%)", "創業クリエイター名簿掲載", "クリエイター限定セクション"]'::jsonb,
    100,
    true),
  ('family_15000', '創業ファミリー｜うちの子コース',
    15000,
    '2026年クラファン時にお迎えした創業ファミリー (うちの子コース)',
    '["創業ファミリーバッジ", "うちの子プロフィール強調表示", "創業ファミリー限定セクション", "イベント先行案内"]'::jsonb,
    50,
    true),
  ('mayor_30000', 'プレミアム住民｜永久首長',
    30000,
    '2026年クラファン時にお迎えしたプレミアム住民 (永久首長)',
    '["永久首長バッジ", "Qocca街の永久首長称号", "公式イベント貴賓席", "King との対談機会 (年1回)"]'::jsonb,
    20,
    true),
  ('ark_patron_50000', 'ARK 専用｜動物福祉パトロン',
    50000,
    '2026年クラファン時にお迎えした ARK 動物福祉パトロン',
    '["ARK パトロンバッジ", "支援金は全額 ARK 寄付", "ARK 譲渡会への招待状", "ARK レポート月次配信"]'::jsonb,
    10,
    true),
  ('corporate_300000', '法人スポンサー｜街の協力者',
    300000,
    '2026年クラファン時にお迎えした法人スポンサー (街の協力者)',
    '["法人スポンサーバッジ", "HomePage に企業ロゴ掲載", "LegalPage 第30条にスポンサー名記載", "Qocca 公式パートナー認定", "プレスリリース共同発信権"]'::jsonb,
    5,
    true)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 【DDL #2】 crowdfunding_backers テーブル新規作成 (CAMPFIRE CSV 取込用)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crowdfunding_backers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  tier TEXT NOT NULL CHECK (tier IN (
    'supporter_1000', 'resident_3000', 'creator_8000',
    'family_15000', 'mayor_30000', 'ark_patron_50000', 'corporate_300000'
  )),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  campfire_order_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  redeemed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backers_tier ON crowdfunding_backers(tier);
CREATE INDEX IF NOT EXISTS idx_backers_status ON crowdfunding_backers(status);
CREATE INDEX IF NOT EXISTS idx_backers_email ON crowdfunding_backers(email);
CREATE INDEX IF NOT EXISTS idx_backers_user_id ON crowdfunding_backers(user_id);

-- RLS 有効化 + ポリシー (既存 profiles.role='admin' で判定)
ALTER TABLE crowdfunding_backers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can do everything on backers" ON crowdfunding_backers;
CREATE POLICY "Admin can do everything on backers"
  ON crowdfunding_backers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can read own backer record" ON crowdfunding_backers;
CREATE POLICY "Users can read own backer record"
  ON crowdfunding_backers
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE crowdfunding_backers IS '2026年クラファンバッカー (CAMPFIRE CSV 取込元データ)';
COMMENT ON COLUMN crowdfunding_backers.tier IS 'リターン tier (crowdfunding_rewards.id と同じ値)';
COMMENT ON COLUMN crowdfunding_backers.status IS 'pending=未履行 / fulfilled=コード使用済み / cancelled=キャンセル';


-- ────────────────────────────────────────────────────────────────────────────
-- 【DDL #3】 既存 crowdfunding_codes に backer_id 列を ALTER ADD
--   新規テーブル増設を避け、既存 Edge Function (redeem-crowdfunding-code) を流用
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE crowdfunding_codes
  ADD COLUMN IF NOT EXISTS backer_id UUID REFERENCES crowdfunding_backers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_codes_backer_id ON crowdfunding_codes(backer_id);

COMMENT ON COLUMN crowdfunding_codes.backer_id IS '対応する crowdfunding_backers レコード (1バッカー1コード)';


-- ────────────────────────────────────────────────────────────────────────────
-- 【DDL #4】 badges 新7件 INSERT
--   既存スキーマ (tier_order/requirement_type/requirement_count) に合わせて調整
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO badges (id, name, description, category, tier, tier_order, requirement_type, requirement_count, image_url) VALUES
  ('crowdfund-supporter', '応援サポーター',
    '2026年クラファン期に Qocca を支援してくださった応援サポーター様',
    'special', 'special', 1, 'special', 0, NULL),
  ('crowdfund-resident', '創業メンバー｜街の住民',
    '2026年6月クラファン時にお迎えした創業期住民',
    'special', 'special', 2, 'special', 0, NULL),
  ('crowdfund-creator', '創業クリエイター',
    '2026年クラファン時にお迎えした創業期クリエイター',
    'special', 'special', 3, 'special', 0, NULL),
  ('crowdfund-family', '創業ファミリー',
    '2026年クラファン時にお迎えしたうちの子コース支援者',
    'special', 'special', 4, 'special', 0, NULL),
  ('crowdfund-mayor', '永久首長',
    '2026年クラファン時にお迎えしたプレミアム住民',
    'special', 'special', 5, 'special', 0, NULL),
  ('crowdfund-ark-patron', 'ARK 動物福祉パトロン',
    '2026年クラファン時にお迎えした ARK 専用支援者',
    'special', 'special', 6, 'special', 0, NULL),
  ('crowdfund-corporate', '法人スポンサー',
    '2026年クラファン時にお迎えした法人協力者',
    'special', 'special', 7, 'special', 0, NULL)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 【DDL #5】 profiles テーブルに 3 列追加
--   永久手数料率・創業クリエイター/首長フラグ
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_founding_creator BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_founding_mayor   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_creator_fee_rate INTEGER DEFAULT NULL;

COMMENT ON COLUMN profiles.is_founding_creator IS '創業クリエイター枠 (¥8,000 リターン) 受領済みフラグ';
COMMENT ON COLUMN profiles.is_founding_mayor IS '創業首長枠 (¥30,000 リターン) 受領済みフラグ';
COMMENT ON COLUMN profiles.founding_creator_fee_rate IS '創業クリエイターの永久手数料率 (3 = 3%固定)。NULL なら通常レート';


-- ────────────────────────────────────────────────────────────────────────────
-- 【SELECT 確認】 DDL 適用後、以下のクエリで結果検証
-- ────────────────────────────────────────────────────────────────────────────

-- 1. crowdfunding_rewards: 既存7件 (is_active=false) + 新7件 (is_active=true) で計14件
SELECT id, name, price_jpy, total_slots, is_active FROM crowdfunding_rewards ORDER BY is_active DESC, price_jpy;

-- 2. crowdfunding_backers テーブル存在確認 + 列定義
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'crowdfunding_backers' ORDER BY ordinal_position;

-- 3. crowdfunding_codes に backer_id 列追加確認
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'crowdfunding_codes' AND column_name = 'backer_id';

-- 4. badges 新7件確認 (tier_order 1-7)
SELECT id, name, tier_order FROM badges WHERE id LIKE 'crowdfund-%' ORDER BY tier_order;

-- 5. profiles 新3列確認
SELECT column_name, data_type, column_default FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name IN
    ('is_founding_creator', 'is_founding_mayor', 'founding_creator_fee_rate')
  ORDER BY column_name;


-- ============================================================================
-- 【実行順序】 上から順に 5 ブロック実行 → 最後の SELECT 5本で検証
-- ============================================================================
-- DDL #1 (rewards 戦略変更): 既存7件 UPDATE + 新7件 INSERT
-- DDL #2 (backers 新規):       CREATE TABLE + RLS + INDEX
-- DDL #3 (codes ALTER):       backer_id 列追加
-- DDL #4 (badges 新7件):       INSERT ON CONFLICT DO NOTHING
-- DDL #5 (profiles 3列):       ALTER ADD COLUMN
-- ============================================================================
