# Known Issues / バックログ

本番運用に致命ではないが、将来的に解消したい既知の課題を記録するファイル。
新規発見時に追記し、解消時に「✅ 解消済」+ commit hash を残す。

---

## 🟡 Active (未解消)

### KI-004: 出品 approve 前の Stripe 連携 (payouts_enabled) 必須化 — 根本解決 (2026/6/10 #143 TOP2)
- **発見日**: 2026/6/10 (#143 バグ棚卸し TOP2 調査)
- **症状 / 経緯**:
  - create-checkout が seller の送金可否を未チェックで、**Stripe 未連携 (payouts_enabled=false) の出品者からも購入が通る** → お金がエスクローで無期限 pending (塩漬けリスク)。
  - 現状: approved 出品保有 7出品者**すべて** payouts_enabled=false (完全連携 active は運営事務局 1人のみ)。
- **#143 TOP2 で実施した対症療法 (方式B)**: 購入は止めず、購入確認モーダルで**警告バナー + 同意**を表示 (commit `64d6956` / create-checkout v39 `seller_payout_pending` フラグ)。
- **根本解決 (本 KI / 未実装)**: **出品を approve する前に Stripe 連携 (payouts_enabled=true) を必須化**する。
  - 案: admin の listing approve フロー / RPC で `seller.stripe_payouts_enabled=true` を承認条件に追加。
  - または出品者が「Stripe 連携完了」しないと listing を `approved` にできない gating。
  - → これにより「buyable な出品 = 必ず送金可能な出品者」になり、塩漬けが構造的にゼロに。
- **影響**: 対症療法 (方式B) で当面の購入者保護は完了。根本解決は運用フロー変更を伴うため Dday 前後で別途設計。
- **優先度**: 🟠 中 (7/1 までに出品者オンボーディングが進めば自然解消するが、approve gating があると確実)
- **見積工数**: 半日 (approve 条件追加 + 出品者向け「連携してください」導線)
- **関連**: #143 TOP2 (方式B 実装済) / #142 TOP2 (profiles の stripe カラム公開 / Dday後)

---

### KI-003: Meta Pixel ID 不整合 (旧7030 誤記の解消) + DevTools `_pixels` の確認限界 (2026/6/9 #139)
- **発見日**: 2026/6/9 (Meta 広告本日公開時の Pixel 検証で発覚)
- **症状 / 経緯**:
  1. 旧引き継ぎ書に「Qocca Production = 末尾7030」と記載されていたが、実態と不一致 = **誤記**
  2. 別データセット「Qocca SNS Integration = 末尾1459」が存在するが、これは SNS Insights 系の旧用途で **広告計測には不適**
  3. 正規 = **Qocca Production (末尾1385)** を Vercel env `VITE_META_PIXEL_ID` (Production / Sensitive) に投入 → Build Cache OFF で Redeploy → bundle 反映 → 2026/6/9 21:22 Meta テストイベントで PageView 着弾実証
  4. その後も DevTools Console で `Object.keys(window._fbq.instance._pixels)` が `[]` を返す現象を観測 → 当初「未起動」と疑ったが、**Meta テストイベントには到達していたため、`_pixels` 空表示は Meta SDK 仕様によるもの** と判明
- **教訓 (今後の防止策)**:
  1. **発火確認は Meta テストイベント (Events Manager) が唯一の確実な手段**。DevTools `_pixels` 確認は補助で、SDK バージョン依存で空配列を返すことがある
  2. **env 変更 → 必ず Build Cache OFF で Redeploy** (Vite 静的埋め込みのため / `docs/meta-pixel-setup-king.md` / `docs/meta-pixel-verification.md` 両書に明記済)
  3. **データセット名 + Pixel ID フル値** で記録 (Pixel ID は HTML/bundle 埋め込みの公開識別子 = 秘匿不要 / 2026/6/11 #143 後追いで「末尾4桁のみ」→「フル明示」に方針更新。正規 = **Qocca Production / `1039178921791385`**)
- **影響**: 解消済 (実害ゼロ / 6/9 21:22 以降 Pixel 学習開始)
- **優先度**: ✅ 既解消 (記録目的のみ)
- **関連ファイル**: `docs/meta-pixel-setup-king.md` v1.2 / `docs/meta-pixel-verification.md` v1.2 (フル ID 明示 / 2026/6/11 更新)

---

### KI-002: Meta Pixel をサーバー側 Conversions API に拡張 (2026/6/8 #135 King 指示)
- **発見日**: 2026/6/8 (#135 Phase A 承認時)
- **症状**: 現状の Meta Pixel はブラウザ fbq 計測のみ。iOS 14+ ATT / Adblock / Cookie 拒否で計測欠損が発生する可能性
- **改善案**: Meta Conversions API (CAPI) をサーバー側 (Edge Function) で並行発火 → ブラウザ計測の欠損を補完 + deduplication (event_id 共有) で重複防止
- **影響**: 機能影響なし / 計測精度の向上のみ
- **優先度**: 🟢 低 (Dday 7/1 後 / 広告投下が増えてからで OK)
- **見積工数**: 2-3日 (Edge Function 新規 + Pixel event_id 共有 + Meta Business 側 CAPI 接続設定)
- **参照**: https://developers.facebook.com/docs/marketing-api/conversions-api/

---

### KI-001: 「Multiple GoTrueClient instances detected」コンソール警告
- **発見日**: 2026/6/6 以前 (継続観察)
- **症状**: ブラウザ Console に `Multiple GoTrueClient instances detected in the same browser context` の warning
- **原因仮説**: Supabase JS Client の生成が複数箇所で行われている (`src/supabaseClient.ts` 共有化が一部未到達)
  - 既知箇所: `src/components/ProfileEditModal.tsx` L4 で独立 `createClient` を保持 (#119 共有化対象外として残存)
- **影響**: 機能影響なし / Auth state 同期は正常 / 単なる重複警告
- **改善案**: ProfileEditModal を含む全コンポーネントを `src/supabaseClient.ts` の shared instance に統一
- **優先度**: 🟢 低 (Dday 7/1 後の clean-up 推奨)
- **見積工数**: 1-2時間 (grep で createClient 全箇所特定 → import 置換 → build 確認)

---

## 🔐 決済・セキュリティ修正記録 (2026/6/10-11 #142 / #143)

Dday(7/1) 前のセキュリティ・公平性 総点検で完了した本番修正の記録。
**実取引が動く本番**に対し、Step制 (提案→設計→承認→実装) + 各 Step ロールバック手順 + 既存データ本体不可触 を厳守して実施。

### ✅ 完了した修正一覧

| # | 修正 | 実装 | 防御内容 |
|---|---|---|---|
| 🔴 | **二重送金封鎖** | complete-order **v29** + フロント | 三層防御 (下記) |
| 🟠 | **RLS orders 修正** | DROP ポリシー (#142) | `orders_insert (WITH CHECK true)` 削除でなりすまし注文封鎖 + 重複ポリシー整理 (7→4) |
| 🟠 | **Stripe 未連携購入 警告** | create-checkout **v39** + フロント (方式B) | `seller_payout_pending` フラグ + 購入確認モーダルに警告バナー。判定軸 = **`stripe_payouts_enabled`** (`onboarded` は restricted とのズレ実在で不採用) |
| 🟠 | **認可漏れ封鎖** | complete-order **v30** | 受取確認は **buyer本人 or admin のみ**。`getUser(token)` で callerId 取得 → `buyer_id` 一致 or `admins` テーブル直接照会 → 不一致 403 / 未認証 401 |
| 🟠 | **手数料取りこぼし** | complete-order **v31** (方式C) | welcome 判定**のみ** `order.created_at` 基準に変更 → 受注生産品 (3-4週間) が welcome 期間中購入なら受取が8月でも 0% 適用 |

### 🔴 二重送金 三層防御 (complete-order v29 + フロント)
| 層 | 防御 | 効果 |
|---|---|---|
| Stripe | `Idempotency-Key: transfer_${order_id}` | 同一 order の重複送金を Stripe が物理的に1回に固定 |
| DB | 原子的クレーム `transfer_status='processing'` (UPDATE 行ロック再評価) | 並行2本目を 0行で安全中断 |
| フロント | `confirming` state + ボタン disabled | await 中の連打を物理的に防止 |

### ⚠️ complete-order は v29→v30→v31 と積層 — 触る時の注意 (最重要)

complete-order は**1関数に3つの独立した防御が積み重なっている**。今後改修する際、各層を壊さないこと:

| 層 | 役割 | コード位置 | 触る時の注意 |
|---|---|---|---|
| **v31** 手数料 | welcome 判定を `order.created_at` 基準 | fee 候補収集ブロック (`candidates.push`) | welcome の if のみ created_at / **他 tier (standard/first/3M/early/founding) は `now` のまま**。min(rate) ロジックを壊さない |
| **v30** 認可 | buyer本人/admin チェック | order 取得後 ・ **原子的クレームの手前** | `getUser(token)` で callerId → buyer_id 一致 or admins 照会。**service_role 経路なし前提** (将来必要なら `x-internal-secret` 例外を別途設計) |
| **v29** 二重送金 | 冪等キー + 原子的クレーム | クレーム = fee 計算の後 / 冪等キー = transfer fetch | クレームは transfer の**直前**・冪等キーは `transfer_${order_id}` 固定。**順序 (認可→fee→クレーム→冪等transfer) を変えない** |

- **改修原則**: 認可は常にクレームの**上流**、クレームは transfer の**直前**、welcome は `created_at`・他 tier は `now`。この不変条件を破ると二重送金 or 認可漏れ or 手数料バグが再発する。
- **ロールバック**: 各版は独立 (v31→v30→v29→v28 と1版ずつ戻せる)。Edge Function 版管理で即時復帰。

### 📋 バックログ (Dday 後)
| 項目 | 内容 |
|---|---|
| 方式A (全 tier 注文時ロック) | create-checkout で全 tier を確定し `orders.fee_tier_locked`/`fee_rate_locked` (DDL) に保存 → complete-order は参照のみ。welcome 以外の根本解決 |
| P2/P3/P4 | within_3months 境界 / first_transaction 消費判定 / early_supporter 境界。**welcome 期間中は welcome 優先で 8/1 まで顕在化せず** → 方式A でまとめて対応 |
| KI-004 | 出品 approve 前の Stripe 連携必須化 (本ファイル上部) |
| #142 TOP2 | profiles の stripe カラム公開 (RLS USING(true)) の絞り込み (Dday後) |

---

## ✅ 解消済 (履歴)

(まだなし — 解消時に commit hash と日付を記録)

---

## 改訂履歴
- 2026/6/6 (依頼書 #134 後追い) v1.0 初版 / KI-001 GoTrueClient 警告を記録
- 2026/6/8 (依頼書 #135 Phase B) KI-002 Conversions API 拡張 backlog 追記
- 2026/6/9 (依頼書 #139) KI-003 Pixel ID 不整合解消 + DevTools `_pixels` 仕様注意 追記
- 2026/6/10 (依頼書 #143 TOP2) KI-004 出品 approve 前 Stripe 連携必須化 (根本解決) 登録
- 2026/6/11 (依頼書 #143 後追い) 「決済・セキュリティ修正記録」セクション追加 (二重送金/RLS/未連携警告/認可漏れ/手数料 の5修正 + complete-order v29→v30→v31 積層注意) + KI-003 を Pixel ID フル明示方針に更新
