# 🛒 Variant 機能 実装前事前準備ノート

> **作成**: 2026/5/13 夜 (Phase D' デプロイ直後)
> **作成者**: クマ (Claude Code)
> **目的**: 明日朝以降の Variant (バリエーション) 機能仕様書議論の事前材料
> **指示元**: King の "今夜の任意オプション 1 + 2"

---

## 📋 これは何

Amazon 型 Variant 機能 (色違い・サイズ違いを1ページで選択 + バリエーション別在庫管理) を 7/1 グランドオープンまでに実装する大型タスクの **事前マッピング**。
明日朝の Claude.ai Sonnet の仕様書ドラフト作成、King + ちゃぴの議論で参照する想定。

---

## 🗺 現状 listings 関連処理マップ (Explore 調査結果)

### 1. DB スキーマ実態

| 項目 | 場所 | メモ |
|---|---|---|
| listings INSERT 構造 | `src/App.tsx:226-239` (`submitListing`) | id / seller_id / title / description / price / category / pet_type / delivery_days / delivery_type / image_urls (配列) / **options** (JSON配列) / stock_quantity / status |
| 既存 `options` カラム | `src/App.tsx:143` + `3706-3729` | `{ name, price }` 形式の "有料追加オプション" (例: ラッピング)。**Variant とは別概念** |
| variant 専用テーブル/列 | なし | 新規 `listing_variants` テーブル想定 |

### 2. 出品フォーム (新規/編集)

| 項目 | 場所 | メモ |
|---|---|---|
| SellPage | `src/App.tsx:3983` | ステップ制 (1.カテゴリ → 2.内容 → 3.確認) |
| price/stock/options 入力 | `src/App.tsx:4093-4182` | 在庫数 (L4150-4162)、有料オプション動的追加 (L4163-4182) |
| 画像アップロード | `src/App.tsx:4133-4148` + `214-219` | Supabase Storage `listing-images`、最大5枚 |

### 3. 商品詳細ページ ("detail")

| 項目 | 場所 | メモ |
|---|---|---|
| DetailPage | `src/App.tsx:3546` | `setPage("detail", item)` で navigate |
| DetailPageWrapper | `src/App.tsx:9399` | `/listing/:id` route、URL param から復元 |
| 価格・在庫・購入 UI | `src/App.tsx:3688-3750` | **在庫表示 UI は現状なし** (stock_quantity 読み込みだけ) |
| 決済発火 | `src/App.tsx:3568-3662` (`handleOrder`) | Stripe Edge Function "create-checkout" を直接 POST |

### 4. カート / 決済フロー

| 項目 | 場所 | メモ |
|---|---|---|
| カート state | **なし** | カート概念なし、**単品即時購入** |
| Stripe checkout | `src/App.tsx:3629-3641` | line_items は 1 listing 1 item の単純構造 |
| 注文記録 | orders テーブル | status: pending → working → delivered → completed |

### 5. その他の listings 依存箇所

- `SearchPage` (`src/App.tsx:3477-3542`) - category/keyword filter + 人気度ソート
- `MyPage` 出品タブ (`src/App.tsx:4943-4951`) - seller_id ベース、在庫増減 UI (L5883-5913)
- `Admin.tsx:241-312` - status (pending/approved/rejected/sold_out) 管理

---

## 🎯 Variant 実装時の主要な接触点 (5 箇所)

1. **DB スキーマ拡張** — `listing_variants` 新規テーブル or `listings.variants` JSON 列、SKU 概念導入
2. **SellPage / submitListing** — Variant 入力 UI (色・サイズ等の属性軸 × 各組み合わせの price/stock)
3. **DetailPage** — Variant selector UI (色 → サイズの順序選択)、SKU 別価格・在庫表示
4. **Stripe checkout** — line_items に `variant_id`/SKU を含める。`create-checkout` Edge Function 改修
5. **在庫管理 UI** (MyPage + Admin) — SKU 単位の在庫増減・状態管理

---

## ⚠️ Variant 設計の重要な分岐点

### A. 既存 `options` カラムとの関係
- **options**: 有料追加オプション (例: ラッピング +¥500、特急配送 +¥1,000)
- **variants**: 主商品の必須選択肢 (例: 色=赤 / サイズ=M)
- **判断必要**: 両者を完全分離する? options を変形して variants に流用する?
- **推奨**: 分離。意味論が違う (options は加算、variants は SKU 切替)。

### B. カート無しのままで OK?
- 現状: 単品即時購入のみ (カート state なし)
- Variant 実装後: 「異なる variant を複数まとめて買う」ニーズが出るか?
- **判断必要**: カート概念導入 (Stripe line_items を複数要素に対応) or 引き続き単品購入のみ
- **King の経営判断ポイント**: ペット用品マーケットプレイスでカート購買行動はあるか

### C. 既存 grace さん 3作品の移行プラン
- 現状: variant 概念なしの単品出品
- 移行: 既存 listings を「variant 1個 (デフォルト)」として variants テーブルに記録 or skip
- **判断必要**: マイグレーション SQL の方針

### D. Stripe 連携の "ハイブリッド方式" の中身
- King が予告で言及した「ハイブリッド方式」は具体的に何を指すか明日の議論で要明確化
- 想定1: Stripe Products + Prices で variant ごとに Price 作成
- 想定2: Stripe metadata で variant 情報を保持、Price は listing 単位
- 想定3: 既存 Edge Function で line_items を構築するだけで Stripe Product 側は単一

---

## 🔍 Phase B / D / D' で気付いた潜在的改善点 (今日のスコープ外、明日以降検討)

### 既知バグ (修正済み)
- ✅ **SectionAtelier の status filter 常時 false** (Phase D' で削除済み、`5c06cac..0555b60`)

### 残存 lint warning (許容範囲)
- `QC_TIMING` 未使用 (Phase A で定義、まだ inline 値使用中)
- App.tsx 内の `any` 型多数 (既存パターン、新規追加分も同パターンに従った)

### Variant 実装時に検討したい構造的観点
1. **useListings hook の camelCase/snake_case 混在**
   - 出力: `seller` / `imageUrls` / `imageUrl` (camel) と `seller_id` / `favorite_count` / `created_at` (snake) が混在
   - Variant 追加で更にフィールドが増えるので、明日の仕様書で命名規約を決めると今後がラク

2. **bundle size 増加トレンド**
   - Phase 1 静けさRedesign: ~883 KB → 現在: ~894 KB (chunk-size warning 出続け)
   - Variant 機能追加で更に増える見込み
   - 検討: route-based code-splitting (SellPage / DetailPage / Admin を lazy load)
   - 優先度: Variant 実装の後でOK、ただし方針は決めておきたい

3. **`useScrollProgress` のスクロール基準**
   - body.scrollHeight 基準で 0-1 進度を計算
   - 新セクション追加で実際の "朝→夜" 補間タイミングが意図とズレる可能性
   - 実物で気になる場合は Phase G 全体スクロール調整時に微調整

4. **`SectionTodaysMoments` の DB fetch 設計**
   - `gallery_posts.is_official=true` + `100<=display_priority<200` をシャッフルして12件
   - これは Hero (display_priority<100) との境界条件で意図的設計
   - ブランド人格 v3 の「いつもの軸」次第で見直し検討

### Variant とは無関係だが念のため記録
- `SectionVoices` で `isLoading` state を Phase 1 で削除済み、未使用フラグなし
- 静けさ Redesign の `QC_KEYFRAMES` 内で旧 `qocca-breathe` / `qocca-fadeIn` / `qocca-reactionPop` を削除済み、現存参照ゼロ

---

## ❓ 明日朝の仕様書議論で確認したいオープン質問 (King + ちゃぴ向け)

1. **options vs variants の概念分離** はクリアにする?(私の推奨: Yes、分離)
2. **カート機能の導入有無** はどう判断する?(現状: 単品購入のみ)
3. **既存 grace さん 3 作品の移行方針** (variant 1個扱い? skip?)
4. **「Stripe ハイブリッド方式」の具体内容** は3案 (上記 D) のどれを指す?
5. **Variant 軸の数** (色 1軸? 色 + サイズ 2軸? 任意 N軸?)
6. **在庫切れ時の UI** (品切れ表示で残す? 自動非表示?)
7. **画像** は variant ごとに別画像? listing 共通?(色違いなら variant 別画像が一般的)
8. **migration スケジュール** (本番 listings はわずか 3 件なので一度に移行可、安全)

---

## 🐨 クマからの一言

仕様書議論時、特に **B (カート機能)** と **D (Stripe 方式)** の判断が DB スキーマ全体に波及します。先にそこを決めてから、A (options 関係) と E〜H の細部に降りる順序が効率的かと。

明日、4 AI + King の集合で固めましょう。私は実装担当として、仕様書が固まり次第すぐ動けるよう待機します 🌙🐾🐨🐻

---

> **状態**: 事前準備完了
> **次のアクション**: King + Claude.ai (Sonnet) + ちゃぴ で仕様書議論 → クマ実装
