---
name: qocca-coding-guidelines
description: Qoccaのコード修正時の必須プロセス(git同期・行数記録・Grep確認・Before/After報告)、分割済みコード構成、過去バグ(コメント衝突/React import漏れ)、Git/Stripe規約。src/配下のコードを修正する前に必ず参照。
---

# 🛠 Skill 02: コーディング規約 (Qocca固有)

> このスキルは、Qoccaプロジェクトのコードを修正する時に
> クマが守るべきルールを記載しています。
> App.tsx を触る前に必ず参照してください。

---

## 🚨 App.tsx を触る前の必須プロセス

### 1. 最新コードの確認

```
King は時々 GitHub Web UI から直接 push する (画像アップ等)。

✅ 作業開始前に必ず:
git fetch origin && git pull origin main
でローカルを同期する。King への確認は不要 (競合が出た時だけ相談)。
```

### 2. 行数を記録

```bash
# 修正前
wc -l src/pages/home.tsx
# 例: 3900 src/pages/home.tsx

# 修正後
wc -l src/pages/home.tsx
# 大幅減少していたら危険信号
```

### 3. 主要関数の存在確認 (Grep)

```bash
# 修正前に主要コンポーネントが存在することを記録
grep -n "^const Section" src/App.tsx
grep -n "^function " src/App.tsx
grep -n "^export " src/App.tsx
```

### 4. 修正後に同じGrepを再実行

```
修正前後で主要関数の数が変わってないか確認。
減ってたら何か壊した可能性。
```

### 5. 変更内容のBefore/After報告

```
King への報告フォーマット:

## 変更内容
- 修正したコンポーネント: SectionHero
- 修正した箇所: home.tsx SectionHero (Grep で特定した該当範囲・約150行)
- 削除した関数: なし
- 追加した関数: useScrollProgress

## Before/After 機能リスト
✅ SectionHero: 動作維持
✅ SectionTodaysMoments: 動作維持 (触ってない)
✅ HomePage: 新背景補間追加 ← New
...

→ "壊してないこと" を明示する
```

---

## 📋 コード構成 (分割済み・2026/7 時点)

```
旧: App.tsx 約8671行のモノリシック
現: 分割完了。App.tsx は約557行 (ルーティング + レイアウトのみ)

主要ファイル (src/):
- App.tsx (~557行)          : Routes / TabBar / SharedFooter 配置
- pages/home.tsx (~3900行)  : HomePage + 全セクション (Hero/WhatIsQocca V1-V3/QuietlyLoved/TodaysMoments 等)
- pages/marketplace.tsx (~2400行) : SearchPage/SellPage/DetailPage/submitListing
- pages/facilities.tsx      : 施設マップ
- pages/petwalker.tsx       : ペットウォーカー
- pages/gallery.tsx         : BlogPage/GalleryPage
- pages/community.tsx       : コミュニティ/イベント
- pages/account.tsx         : アカウント/電話認証
- pages/mypage.tsx          : マイページ
- pages/pet_gallery.tsx     : うちの子ギャラリー
- components/               : ListingEditModal/FloatingBackButton/CrowdfundingBanner 等
- hooks/index.ts            : useNav (setPage→navigate のルート表)
- constants/theme.ts        : QC/C トークン・フォント定数

⚠️ 行番号マップは持たない (改修で即古くなる)。
   シンボル位置は毎回 Grep -n で特定 → Read offset/limit で部分読み
   (token-efficiency スキル A-1/A-2 参照)
```

---

## 🐛 過去の失敗事例 (繰り返さない)

### Bug 1: コメントアウト */ 衝突

```
🚨 やってはいけない例:

/* 古いコード削除
function HomePage() {
  return (
    <>
      {/* セクション1 */}  ← この */ で /* が終了!
      <SectionHero />
      {/* セクション2 */}
      <SectionAtelier />
    </>
  );
}
*/  ← ここはもう "*/  " の文字列扱い、構文崩壊

✅ 正しい対処:
- 旧コードは git 履歴に任せて、削除する
- どうしても残したい時は、別ファイルにコピーする
- /* */ ではコメントアウトしない
```

### Bug 2: React Import 漏れ

```
🚨 やってはいけない例:

import { useState, useEffect } from "react";
// React 本体 import 漏れ

const HomePage = () => (
  <React.Fragment>  ← "React is not defined" エラー!
    ...
  </React.Fragment>
);

✅ 正しい対処:
import React, { useState, useEffect } from "react";

→ React.Fragment, React.MouseEvent 等を使う時は、
  default import を必ず付ける
```

---

## 🌿 Git ブランチ戦略

```
✅ Phase 7 向けプロ開発フロー:

main (本番)
  └── develop (任意、開発統合)
      └── feature/xxx (機能追加)
      └── fix/xxx (バグ修正)
      └── claude/xxx (Claude Code 作業ブランチ)

ルール:
1. main 直接コミット 禁止
2. 全ての変更は新ブランチで作業
3. PR (Pull Request) 経由でレビュー
4. King が承認 → マージ
5. マージ後、Vercel が自動デプロイ
```

### ブランチ命名規則

```
✅ claude/silent-redesign-day2
✅ claude/welcome-campaign-impl
✅ claude/window-redirectTo-fix
✅ feature/auto-blog-generator
✅ fix/section-hero-loading

❌ test
❌ work
❌ tmp
❌ 日本語名
```

---

## 💎 Supabase 操作のルール

```
⚠️ カラム名の罠:
✅ stripe_payment_intent_id (eあり)
✅ stripe_transfer_id (eあり)
✅ stripe_account_id (eあり)
❌ strip_payment_intent_id (誤、e抜け)

→ 一部の過去資料に "strip_" 表記があるが、正しくは "stripe_"

確認方法:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
```

### 重要テーブル

```
profiles (ユーザー)
listings (出品)
orders (注文)
gallery_posts (ギャラリー)
post_reactions (リアクション)
communities (コミュニティ)
events (イベント)
blog_posts (ブログ)
facilities (施設)
favorites (お気に入り)
```

### RLS (Row Level Security) を意識

```
Qocca は Supabase の RLS を使ってる。
INSERT/UPDATE/DELETE 時は、RLS ポリシーを意識する。

→ ポリシーに違反するクエリは失敗する
→ エラーメッセージに "RLS" や "policy" が含まれてたら、ポリシー確認
```

---

## 💳 Stripe Connect 操作のルール

```
⚠️ 必須3段階:

1. 残高確認
   → Stripe MCP の retrieve_balance を使う

2. 影響範囲確認
   → 関連する payment_intent や transfer を fetch_stripe_resources で取得
   → 何件影響するか、いくらの金額か、明示する

3. 実行
   → King の "OK" を確認してから実行

→ 失敗時のロールバック手順も提示
```

### 手数料の計算

```
出品者手数料 (Seller Fee):
- 初回 (first_listing_used=false): 0%
- Welcome Campaign 期間中: 0%
- 登録から90日以内: 5%
- 通常時: 10%

購入者手数料 (Buyer Protection Fee):
- BPF: 表示価格の 4% を購入時に徴収
- Stripe 振込手数料は売上から差し引く

例:
商品価格 ¥3,000
+ BPF (4%) ¥120
= 購入者支払い ¥3,120

出品者受取り (90日以内、Stripe手数料3.6%):
¥3,000 - 5% (¥150) - Stripe手数料 (¥108) = ¥2,742
```

---

## 🚫 やってはいけないこと (絶対NG)

```
❌ main ブランチに直接コミット
❌ 確認なしの DROP TABLE / DELETE / DROP COLUMN
❌ Stripe で残高超える transfer 試行
❌ Supabase の Edge Function を本番デプロイ (King の確認なし)
❌ qocca.pet のDNS設定変更
❌ .env や Secret の中身を出力する
❌ Stripe Restricted Key を出力する
❌ ユーザーの個人情報 (email, 住所等) を勝手に取得・表示
❌ "とりあえず動けばOK" の精神でコード書く
❌ 絵文字をUIに入れる (静けさ違反)
❌ 純黒/純白を使う (静けさ違反)
❌ Welcome Campaign の0%が初回0%カウントされない実装 (King ルール違反)
```

---

## ✅ 推奨フロー (Phase 7 体制)

```
King: "クマ、SectionHero の写真表示時間を14秒にして"

クマ:
1. App.tsx の最新版確認
2. wc -l でファイル行数記録
3. grep で SectionHero 周辺確認
4. constants/theme.ts の QC_HERO_DURATIONS を Grep で発見
5. 変更案を Before/After で提示
6. "実装してよいですか?" と確認

King: "OK"

クマ:
7. 新ブランチ claude/hero-duration-update 作成
8. ファイル編集 (str_replace で精密に)
9. wc -l で行数確認 (大きな変動なし)
10. grep で機能存続確認
11. git commit & push
12. PR作成
13. King に完了報告 + 動作確認依頼

King: 動作確認 → マージ → デプロイ

→ これが理想のサイクル ✨
```

---

> **更新**: 2026/5/12 (雛形版)
> **次回更新**: 2026/5/13 King と詳細追加
