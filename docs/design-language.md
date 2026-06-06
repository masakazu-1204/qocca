# Qocca デザイン言語 v1.0

日付: 2026/6/6
依頼書: #134 Phase 3
適用範囲: HomePage トップ + 今後の UI 実装 (Phase B アイテムショップ / 島の装飾 UI 等)
参照スキル: Anthropic 公式 `frontend-design` (`.claude/skills/frontend-design/SKILL.md`)

---

## 1. 採用美学: **Editorial Documentary**

Qocca のデザイン言語は **「街の創刊号 (Issue Zero)」 を毎日めくる暮らし** を視覚化する。

### コンセプトの3要素

1. **Documentary**: 装飾でなく「記録」。実生活の質感を残す (Instagram で確立済の Documentary × Kinfolk と完全合致)
2. **Editorial**: 雑誌の編集力で「号」を組む。タイポグラフィで見出しの存在感を作る
3. **「住める速度を超えない」**: 派手装飾でなく文字と余白の品位で語る (King 哲学)

### 避けるべき (Generic AI Aesthetics)

- ❌ Arial / Inter / Roboto / system-ui 単独 (display フォント無し)
- ❌ 紫グラデーション on 白背景
- ❌ Material 風一律カード (border-radius 12px + box-shadow + gradient ヘッダー)
- ❌ 「センター揃え + センター CTA」の予測可能レイアウト
- ❌ 過度なホバーアニメーション (scale 1.1 + box-shadow ジャンプ)
- ❌ 派手な絵文字バナー (🎉✨💥)

---

## 2. CSS 変数システム

`index.html` の `:root` で定義済 (本番反映)。

### タイポグラフィ

```css
--qc-font-display: "Shippori Mincho", "Yu Mincho", "游明朝", serif;
--qc-font-body: "Noto Sans JP", "Hiragino Kaku Gothic ProN", system-ui, sans-serif;
```

App.tsx 側では定数で参照:
```typescript
const QC_FONT_DISPLAY = '"Shippori Mincho", "Yu Mincho", "游明朝", serif';
const QC_FONT_JP = '"Zen Kaku Gothic New", "LINE Seed JP", "Noto Sans JP", sans-serif';
```

### カラーパレット

```css
/* インク (本文・見出し) */
--qc-ink: #1A1208;        /* 最暗 - 見出し */
--qc-sumi: #2D1F0A;       /* 墨色 - 重要本文 */

/* 紙 (背景) */
--qc-paper: #FAFAF7;      /* 紙のクリーム */
--qc-warm-white: #FAF7F2; /* Hero 文字補強用 */

/* 朱色 (accent / オレンジを朱と再定義) */
--qc-vermilion: #F5A94A;       /* primary */
--qc-vermilion-deep: #C9742A;  /* hover / 強調 */
--qc-vermilion-pale: #FFF3E0;  /* 背景 / バッジ */

/* 罫線・霧 */
--qc-mist: #EDE9E3;       /* divider / border */

/* film grain overlay */
--qc-grain: rgba(45, 31, 10, 0.05);
```

### 色の使用ルール

- **本文テキスト**: `--qc-ink` または `--qc-sumi`
- **副次テキスト**: `#9E9B95` (warmGray)
- **アクセント (CTA / 強調 1 箇所)**: `--qc-vermilion`
- **背景**: `--qc-paper` または `--qc-warm-white`
- **区切り線**: `--qc-mist` または `rgba(0,0,0,0.06)`

「Dominant colors with sharp accents outperform timid, evenly-distributed palettes」(SKILL.md) を厳守: 朱は **1 セクション 1 箇所** に留める。

---

## 3. フォントペアリングと適用ルール

### 二重構造

| 用途 | フォント | weight | 用途例 |
|---|---|---|---|
| **見出し (h1/h2/h3)** | `Shippori Mincho` (display) | 700 | セクションタイトル / Hero キャッチ / ロゴ |
| **副次見出し (英字)** | `Instrument Serif Italic` | 300 | "Quietly Loved in Town" / "Voices of the Town" |
| **本文・サブキャッチ** | `Noto Sans JP` (body) | 300/400 | 説明文 / モバイル可読性最優先 |
| **手書きアクセント** | (Phase A2: `Caveat`) | - | プロフィール装飾 (ユーザー選択) |

### サイズ階層 (clamp で responsive)

| レベル | mobile | PC | 用途 |
|---|---|---|---|
| **L1 Hero メイン** | clamp(22px, 6.5vw, 32px) | clamp(28px, 4.4vw, 56px) | Hero のメインキャッチ |
| **L2 セクション h2** | 26px | clamp(26px, 4.4vw, 36px) | 各セクションの見出し |
| **L3 サブセクション h3** | 18px | 20px | カードタイトル / 紹介セクション h3 |
| **L4 サブキャッチ・補助** | 13-14px (Noto Sans) | 14-16px (Noto Sans) | 本文 / 説明文 |
| **L5 メタ情報** | 11-12px | 12px | キャプション / 日付 / 細かい注記 |

### letter-spacing ルール

- **Shippori Mincho 見出し**: `0.04em - 0.06em` (明朝は字間広げすぎ厳禁)
- **Noto Sans JP 本文**: `0.02em - 0.05em`
- **「号外」風日付組み**: `0.18em` (年月日のみ・大きく広げる)
- **英字 Instrument Serif**: `0.8 - 1.0` (Italic 用)

### 禁止: フォント切替の暴走

「街全体が一トーンに寄りすぎる」のを防ぐため:
- **Hero と各セクション h2 は Shippori Mincho** で統一
- **本文は必ず Noto Sans JP** (Body 明朝への全振りは見送り = King 指示)
- **詩的引用は italic + Light** (節度ある詩性)

---

## 4. スペーシング・スケール

### 余白 (padding / margin)

| Level | 値 | 用途 |
|---|---|---|
| xs | 4-8px | アイコン横の gap |
| sm | 12-16px | ボタン padding |
| md | 24-32px | コンテナ margin |
| lg | 48-80px | セクション内 gap |
| xl | 120-200px | セクション間 padding |

セクション間は **広く取る** (PC: 160-240px / mobile: 80-120px)。 雑誌の紙面の「余白の品位」を再現。

### 角丸

- カード: `4-16px` (Editorial は控えめ寄り)
- ボタン: `10-22px` (機能性優先)
- アバター・タグ: `50% / 20px`
- ❌ 全て一律 `12px` で揃えるのは Material 風で NG

### 影

- 基本: 影なし or `0 1px 3px rgba(0,0,0,0.04)` 極小
- Hover 時: `0 2px 12px rgba(245,169,74,0.06)` 朱の淡い影
- ❌ `0 10px 40px rgba(0,0,0,0.2)` 大袈裟な影は NG

---

## 5. モーション原則

### 基調: 「呼吸する街」

- **transition 1.0-1.5s ease** (急がない)
- **scale 1.02** (大きく拡大しない / 1.1 は NG)
- **translateY(-2px)** (浮き上がりすぎない)
- **`qocca-fadeInSlow 2.4s cubic-bezier(0.16, 1, 0.3, 1)`** (Hero キャッチ・Hero ロゴ)
- **`qocca-breathe-slow 4s ease-in-out infinite`** (呼吸 - スクロール誘導線)

### 禁止

- ❌ `transition: 0.2s` (速すぎ = 機械的)
- ❌ `scale(1.1)` 以上のホバー (主張しすぎ)
- ❌ 縦揺れ・横揺れ keyframes 全般 (notification 系のみ可)
- ❌ scroll-triggered intersection observer の大量適用 (パフォーマンス劣化)

---

## 6. 背景・テクスチャ

### Hero / セクション背景

- **背景補間**: `qoccaInterpolateBackground(progress)` でスクロールに応じて朝→昼→夕→夜の遷移 (既存実装)
- **Noise Overlay**: `<QoccaNoiseOverlay />` で film grain を全面付与
- **transition: background 1.5s ease** (急変させない)

### セクション境界

- 派手な区切りなし
- 細い divider (`width 32px, height 1px, background: var(--qc-mist)`) で控えめに
- セクション間の余白で「ページめくり」感を出す

---

## 7. 禁止事項 (No Generic AI Aesthetics 具体例)

### フォント

- ❌ `font-family: Arial, sans-serif`
- ❌ `font-family: 'Helvetica Neue', sans-serif` 単独
- ❌ `font-family: Inter` (なるべく避ける)
- ✅ 必ず `QC_FONT_DISPLAY` (Shippori Mincho) と `QC_FONT_JP` (Noto Sans JP) を CSS変数 or 定数経由で使用

### 色

- ❌ `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` 紫グラデ
- ❌ `background: #f0f0f0` (生 grey)
- ❌ ピュア `#000` / `#FFF` (Qocca は paper #FAFAF7 + ink #1A1208)
- ✅ warm orange `#F5A94A` 軸 + ink + paper のトリオ

### レイアウト

- ❌ 「3 column equal grid + center text + bottom CTA button」テンプレ
- ❌ 全カード `border-radius: 12px` + 同サイズ画像 + 同サイズ説明
- ✅ Hero は左右非対称・縦組み的余白 / カードは画像比率・テキスト量で variety を出す

### コピー (前提: Qocca マーケ・ブランド戦略書 v1.0)

- ❌ 「限定」「キャンペーン」「絶対」「最強」「No.1」 等
- ❌ 「永久」「永遠」「無期限」 (CAMPFIRE 審査対応)
- ❌ 「お得」「激安」「今だけ」
- ✅ 「想いを形にして、ふたりをつなぐ。」「街の創刊号」「住む速度」 等

---

## 8. 適用済セクション (本番反映済 / 2026/6/6)

| セクション | h1/h2/h3 適用 | commit |
|---|---|---|
| Hero メインキャッチ | ✅ Shippori Mincho 700 | `58ca204` |
| Hero 右上ロゴ | ✅ Shippori Mincho 700 (italic 解除) | `58ca204` |
| 共通 Logo (`src/App.tsx L504`) | ✅ Arial 撤去 → Shippori Mincho 700 | `58ca204` |
| header-nav 折り返し修正 | ✅ nowrap + clamp gap | `09ea980` |
| Announcement | ✅ Shippori Mincho 700 / 号外風日付 | `3f5accf` |
| WhatIsQocca h2 + 3カード h3 | ✅ Shippori Mincho 700 | `4b026d9` |
| CrowdfundingBanner h3 | ✅ Shippori Mincho 700 / ARK 表記不変 | `8e14993` |
| QuietlyLoved h2 | ✅ Shippori Mincho 700 | `1c9c505` |
| TodaysMoments h2 | ✅ Shippori Mincho 700 | `13bc3cf` |
| TownMap h2 | ✅ Shippori Mincho 700 | `a4f90fa` |
| ResidentArtisans h2 | ✅ Shippori Mincho 700 | `af67530` |
| Voices h2 | ✅ Shippori Mincho 700 | `26b530f` |
| ArkPartnership h3 (本文・正式名称完全保持) | ✅ Shippori Mincho 700 | `005ceba` |
| InitialMembers h3 | ✅ Shippori Mincho 700 | `443d3e6` |
| FoundingPartners h3 | ✅ Shippori Mincho 700 | `e38a9c0` |
| JoinTown h2 | ✅ Shippori Mincho 700 | `1da4814` |
| HomeEvents h2 | ✅ Shippori Mincho 700 | `dc3d304` |
| SharedFooter Logo | ✅ (共通 Logo 経由で済) | `58ca204` |

---

## 9. Phase B 以降の運用指針

### アイテムショップ / 島の装飾 UI / アイテム 65 種ビジュアル

- 必ず本文書を参照してから実装着手
- 新フォント追加時 (Phase B のポイント枠 15-20種 / 課金枠 10-15種): 既存 Shippori Mincho + Noto Sans JP の **二重構造を崩さない** こと
- アイテムショップの商品カードは Editorial 「号外」風グリッド: 画像縦横比は 4:5 / 価格は朱色 1 点強調 / 装飾過多回避

### 想定外ケース

- ユーザー要望で「もっと派手に」と要求された場合 → 本書を引用して説明 + alternative 提案
- 季節アイテム (春/夏/秋/冬) → 朱色 / 緑 (苔色) / 藍色 / 雪 (snow) のサブパレットで季節感を出すが、ベースは Editorial を維持

---

## 改訂履歴

- v1.0 (2026/6/6): 依頼書 #134 Phase 3 初版 / Hero + 14 セクション Editorial 化完了時点の言語仕様
