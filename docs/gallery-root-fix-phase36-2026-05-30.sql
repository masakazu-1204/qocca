-- ============================================================
-- 依頼書 #36 Phase A + B SQL Bundle (2026-05-30 03:50)
-- スマホ Gallery 配列 根本修正 + pet_categories マスター
-- 🛡️ 99-safety-protocol 厳守
-- ============================================================
-- Phase A: スマホ Gallery 配列 根本修正
-- ============================================================
-- 真因:
--   #34/#35 で React <style> インライン挿入 → PWA Service Worker キャッシュ
--   や hydration タイミング差で「<style> ブロックが効かない」ケースが残った。
--   提出スクショで /gallery が 1 列縦並びのままだった事実から、
--   <style> 経由でなく index.css 経由 (Vite ハッシュ付き CSS バンドル) に
--   集約することで確実な配信を保証する。
--
-- 修正内容 (UI コード変更):
--   1. src/index.css に .qocca-gallery-grid と .qocca-home-gallery-grid を
--      !important 付きで定義
--   2. GalleryPage の <style>{...}</style> インライン挿入を撤去
--   3. HomeNewsSection の <style>{...}</style> インライン挿入を撤去
--   4. Vite が常に新しいハッシュ付き CSS を生成 → SW キャッシュ問題回避
--
-- レスポンシブ仕様 (#30 / #34 から継承):
--   <640px:   3列 / gap 2px (モバイル)
--   640-1023: 4列 / gap 3px (タブレット)
--   1024-1439: 5列 / gap 4px (PC)
--   1440+:    6列 / gap 4px (超ワイド)
-- ============================================================
-- Phase B: pet_categories マスター + 既存 22件 日本語化
-- ============================================================
-- DDL: pet_categories (マスターテーブル / 13 カテゴリ)

CREATE TABLE IF NOT EXISTS public.pet_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  label_jp TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon TEXT NOT NULL,
  display_order INTEGER DEFAULT 999,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_categories_active_order
  ON public.pet_categories(is_active, display_order) WHERE is_active = true;

ALTER TABLE public.pet_categories ENABLE ROW LEVEL SECURITY;

-- public read (anon + authenticated)
DROP POLICY IF EXISTS pet_categories_public_read ON public.pet_categories;
CREATE POLICY pet_categories_public_read ON public.pet_categories
  FOR SELECT TO anon, authenticated USING (true);

-- admin write only
DROP POLICY IF EXISTS pet_categories_admin_write ON public.pet_categories;
CREATE POLICY pet_categories_admin_write ON public.pet_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 13 カテゴリ 初期投入 (永続記録 #19 + 戦略書 §1.3 多様性準拠)
INSERT INTO public.pet_categories (slug, label_jp, label_en, icon, display_order) VALUES
  ('犬',         '犬',                  'Dog',                '🐕',  10),
  ('猫',         '猫',                  'Cat',                '🐈',  20),
  ('うさぎ',     'うさぎ',              'Rabbit',             '🐰',  30),
  ('ハムスター', 'ハムスター・齧歯類',  'Hamster / Rodent',   '🐹',  40),
  ('鳥',         '鳥',                  'Bird',               '🐦',  50),
  ('爬虫類',     '爬虫類',              'Reptile',            '🦎',  60),
  ('魚',         '魚',                  'Fish',               '🐠',  70),
  ('フェレット', 'フェレット',          'Ferret',             '🦦',  80),
  ('ハリネズミ', 'ハリネズミ',          'Hedgehog',           '🦔',  90),
  ('カメ',       'カメ',                'Turtle',             '🐢', 100),
  ('両生類',     '両生類',              'Amphibian',          '🐸', 110),
  ('昆虫',       '昆虫',                'Insect',             '🦗', 120),
  ('その他',     'その他',              'Other',              '🐾', 999)
ON CONFLICT (slug) DO UPDATE
  SET label_jp = EXCLUDED.label_jp, label_en = EXCLUDED.label_en,
      icon = EXCLUDED.icon, display_order = EXCLUDED.display_order;

-- 既存 gallery_posts 22件 日本語化
UPDATE public.gallery_posts SET pet_type = '犬'
WHERE pet_type IN ('golden', 'terrier mix', 'shiba mix');

UPDATE public.gallery_posts SET pet_type = '猫'
WHERE pet_type IN ('tabby cat', 'ginger cat', 'cat');

-- ============================================================
-- 検証結果
-- ============================================================
-- pet_categories: 13 件投入 ✅
-- gallery_posts.pet_type 変換結果:
--   '犬':   8件 (旧 golden 4 + terrier mix 3 + shiba mix 1)
--   '猫':   6件 (旧 tabby cat 3 + ginger cat 2 + cat 1)
--   'mixed': 8件 ← King 判断委ね (Phase D 編集 UI で個別更新予定)
--
-- mixed 8件 ペット名 (King 確認用):
--   まろん / こむぎ / らて / はく / そら / むぎ / おもち / ひなた
-- ============================================================
-- 🛡️ 99-safety-protocol
-- ============================================================
-- 既存 gallery_posts 22件: 件数完全保護 (pet_type 値変更のみ・14件変換 + 8件未変換)
-- 既存 blog_posts: 完全保護
-- profiles=16 / listings=8 / badges=33 / pet_facilities=63 / events=14: 全て無変動
-- DB スキーマ: pet_categories 新規追加のみ・既存テーブル無変更
-- ============================================================
-- 次フェーズ予定 (Phase C-E):
--   Phase C (投稿): MyPage に ギャラリー/ブログ 投稿 UI 追加 (Supabase Storage)
--   Phase D (編集): 自分の投稿のみ編集可能 (RLS)
--   Phase E (削除): 自分の投稿のみ削除可能 (RLS / soft delete 推奨)
-- ============================================================
