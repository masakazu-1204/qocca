---
name: qocca-database-rules
description: Supabase/Postgres操作の安全プロトコル。3段階(確認SQL→実行→結果確認)・WHERE限定・1件性の担保(PostgresはUPDATE/DELETEにLIMIT不可)・RLS・stripe_カラム名の正。破壊的DB操作(DELETE/UPDATE/DROP)の前に必ず参照。
---

# 💎 Skill 04: データベース操作ルール

> このスキルは、Supabase / Postgres を操作する時の
> クマが必ず守るべき安全プロトコルを記載しています。
> 破壊的操作 (DELETE/UPDATE/DROP) 前に必ず参照してください。

---

## 🚨 大原則: 確認 → 実行 → 結果確認 の3段階

```
全てのDB操作は3段階で実行:

ステップ1: 確認SQL (現状把握)
↓
King の "OK" を待つ
↓
ステップ2: 実行SQL (本番操作)
↓
ステップ3: 結果確認SQL (反映確認)

→ "とりあえず実行" は絶対NG
```

---

## 🔍 例: 1ユーザーの listing を削除する場合

### ❌ やってはいけない例

```sql
-- いきなり実行
DELETE FROM listings WHERE user_id = 'abc-123';
```

→ WHERE 条件が間違ってたら大事故

### ✅ 正しい3段階

```sql
-- ステップ1: 確認SQL
-- どのユーザーの何件を削除するか明示
SELECT 
  l.id,
  l.title,
  l.price,
  l.status,
  l.created_at,
  p.username
FROM listings l
JOIN profiles p ON l.user_id = p.id
WHERE l.user_id = 'abc-123'
ORDER BY l.created_at DESC;

-- → King に結果を見せる
-- → "この5件を削除します。よろしいですか?" と確認
```

```sql
-- ステップ2: 実行SQL (Kingの OK 後)
DELETE FROM listings 
WHERE user_id = 'abc-123'
  AND status = 'draft';  -- ← 安全のため status も指定

-- ⚠️ WHERE 句に必ず限定条件
```

```sql
-- ステップ3: 結果確認SQL
SELECT COUNT(*) AS remaining_count
FROM listings
WHERE user_id = 'abc-123';

-- → "削除後、残り0件です" を確認
```

---

## 🛡 「1件性の担保」の癖

```
⚠️ PostgreSQL は UPDATE / DELETE に LIMIT 句を書けない (構文エラーになる)。
   「LIMIT 1 を付ければ安全」は MySQL の作法で、Qocca (Postgres) では使えない。

1件だけ操作することが明確な場合、Postgres での正しい保険は:

① 事前の確認SELECTで「マッチ件数 = 1」を必ず確認する
   SELECT COUNT(*) FROM listings WHERE id = 'listing-123';
   -- → 1 であることを King に見せてから実行

② WHERE は PK (id) か一意条件で限定する
   UPDATE listings
   SET status = 'approved'
   WHERE id = 'listing-123';   -- id は PK なので構造的に最大1件

③ 実行後の結果確認SELECTで反映件数を検証する
   SELECT id, status FROM listings WHERE id = 'listing-123';

✅ SELECT のプレビューには LIMIT を積極的に使ってよい
   SELECT id, title FROM listings WHERE user_id = 'abc' LIMIT 5;

❌ 危険な例 (1件のつもりで非一意条件):
UPDATE listings SET status = 'approved' WHERE title = 'ぬいぐるみ';
   → 同名が複数あれば全部書き換わる。id で限定すること
```

---

## 📋 重要テーブル一覧

```
公開テーブル (RLS有効):
- profiles (ユーザー)
- listings (出品)
- orders (注文)
- gallery_posts (ギャラリー投稿)
- post_reactions (リアクション)
- communities (コミュニティ)
- community_members (コミュニティメンバー)
- community_posts (コミュニティ投稿)
- events (イベント)
- blog_posts (ブログ記事)
- facilities (施設)
- favorites (お気に入り)
- direct_messages (DM)
- reports (通報)

ビュー:
- post_reactions_summary (リアクション集計)

⚠️ Auth テーブル (Supabase 管理):
- auth.users (Supabase Auth が管理)
  → profiles テーブルと user_id で連携
```

---

## ⚠️ カラム名の罠

### Stripe 関連カラム

```
⚠️ "stripe_" (eあり) が正しい:

✅ stripe_payment_intent_id
✅ stripe_transfer_id
✅ stripe_account_id
✅ stripe_charge_id

❌ strip_payment_intent_id (e抜け、誤)

→ 一部の過去資料に "strip_" 表記があるが、誤り
→ 必ず "stripe_" で確認すること
```

### カラム存在確認の方法

```sql
-- テーブルの全カラム一覧
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- 特定カラムの存在確認
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'orders' 
    AND column_name = 'stripe_payment_intent_id'
) AS column_exists;
```

---

## 🔐 RLS (Row Level Security) を意識

```
Qocca は Supabase の RLS を使用。
INSERT/UPDATE/DELETE 時、RLSポリシーが適用される。

エラー例:
"new row violates row-level security policy"
"permission denied for table"

対処:
1. RLSポリシーを確認
2. service_role キーで実行 (管理操作のみ)
3. ポリシーを一時的に変更 (慎重に)
```

### RLSポリシー確認

```sql
-- 特定テーブルのRLSポリシー一覧
SELECT * FROM pg_policies 
WHERE tablename = 'listings';
```

---

## 🚨 絶対NG操作

```
❌ DROP TABLE (本番)
   → 確認なしの実行禁止
   → 必ず King の二重確認

❌ DELETE FROM table; (WHERE なし)
   → 全件削除、絶対NG

❌ UPDATE table SET col = X; (WHERE なし)
   → 全件更新、絶対NG

❌ TRUNCATE table;
   → 本番では絶対NG

❌ ALTER TABLE で既存カラムを DROP
   → データ消失リスク、要確認

❌ auth.users への直接操作
   → Supabase Auth に任せる

❌ 本番でテストデータ投入
   → 別環境でテストする

❌ Stripe 関連カラムの誤更新
   → 決済データは特に慎重に
```

---

## ✅ 推奨フロー (Phase 7 体制)

### 例: ユーザーの listing 数を確認したい

```sql
-- いきなり全件取らずに、まず件数把握
SELECT COUNT(*) FROM listings;

-- ユーザー別の件数 (上位10名)
SELECT 
  p.username,
  COUNT(l.id) AS listing_count
FROM listings l
JOIN profiles p ON l.user_id = p.id
GROUP BY p.username
ORDER BY listing_count DESC
LIMIT 10;
```

### 例: Welcome Campaign の0%取引数を確認

```sql
-- 7/1-7/31 の取引で seller_fee_rate=0% のもの
SELECT 
  COUNT(*) AS welcome_orders,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount
FROM orders
WHERE created_at >= '2026-07-01'
  AND created_at < '2026-08-01'
  AND seller_fee_rate = 0
  AND status = 'completed';
```

---

## 🔥 緊急時のロールバック

```
もし DELETE / UPDATE で間違えた場合:

1. すぐに King に報告
   "申し訳ありません、○○件を誤って削除しました"

2. バックアップから復元
   → Supabase Dashboard → Database → Backups
   → Point-in-Time Recovery (Pro プラン以上)

3. 影響範囲を特定
   → 誰のデータが消えたか
   → どのテーブルか

4. 必要なら別チャネルで連絡 (メール等)

⚠️ 隠したり誤魔化したりは絶対NG
→ 即座に正直に報告
```

---

## 📊 Qocca 固有のクエリパターン

### 1. ユーザー別ダッシュボード

```sql
SELECT 
  p.username,
  p.created_at AS user_since,
  COUNT(DISTINCT l.id) AS listings,
  COUNT(DISTINCT o.id) AS orders,
  COUNT(DISTINCT gp.id) AS gallery_posts,
  COUNT(DISTINCT cm.community_id) AS communities_joined
FROM profiles p
LEFT JOIN listings l ON p.id = l.user_id
LEFT JOIN orders o ON p.id = o.buyer_id
LEFT JOIN gallery_posts gp ON p.id = gp.user_id
LEFT JOIN community_members cm ON p.id = cm.user_id
WHERE p.id = 'user-id-here'
GROUP BY p.id;
```

### 2. 今日の活動サマリー

```sql
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE created_at::date = CURRENT_DATE) AS new_users,
  (SELECT COUNT(*) FROM orders WHERE created_at::date = CURRENT_DATE) AS new_orders,
  (SELECT COUNT(*) FROM listings WHERE created_at::date = CURRENT_DATE) AS new_listings,
  (SELECT COUNT(*) FROM gallery_posts WHERE created_at::date = CURRENT_DATE) AS new_gallery_posts;
```

### 3. Stripe オンボーディング状況

```sql
SELECT 
  p.username,
  p.stripe_account_id,
  p.stripe_onboarded,
  p.stripe_payouts_enabled,
  COUNT(l.id) AS listing_count
FROM profiles p
LEFT JOIN listings l ON p.id = l.user_id
WHERE p.stripe_account_id IS NOT NULL
GROUP BY p.id
ORDER BY listing_count DESC;
```

### 4. Welcome Campaign 効果測定

```sql
-- 期間中の取引数 (Welcome Campaign 開始後)
SELECT 
  DATE(created_at) AS day,
  COUNT(*) AS orders_count,
  SUM(amount) AS total_amount,
  AVG(seller_fee_rate) AS avg_fee_rate
FROM orders
WHERE created_at >= '2026-07-01'
  AND status = 'completed'
GROUP BY DATE(created_at)
ORDER BY day;
```

---

## 🐨 クマへのメッセージ

```
クマ…

DBは Qocca の "心臓" や。
ここを壊したら、King の街が止まる。

✅ 必ず3段階 (確認 → 実行 → 結果確認)
✅ WHERE 条件で限定
✅ 1件性の担保 (事前COUNT=1確認 + PK WHERE。UPDATE/DELETEにLIMITは書けない)
✅ RLS を意識
✅ Stripe カラムは "stripe_" (eあり)
✅ 緊急時は隠さず即報告

これが Phase 7 への信頼の基盤や 💎🐾🐨🐻
```

---

> **更新**: 2026/5/12 (雛形版)
> **次回更新**: 2026/5/13 King と詳細追加
