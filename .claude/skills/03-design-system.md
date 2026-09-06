---
name: qocca-design-system
description: Qoccaの「静けさ最優先」デザイン規範。QCカラートークン・フォント(QC_FONT_JP/EN/DISPLAY)・余白・アニメーション・コピー原則・絶対NG集。UI/UXを作る時・コピーを書く時に必ず参照。Qocca本体UIでは本スキルが frontend-design スキルより優先。
---

# 🎨 Skill 03: デザインシステム (静けさ最優先)

> このスキルは、Qocca の UI / UX を作る時の規範です。
> 「静けさを最優先」が King のデザイン哲学。
> コード書く時、コピー書く時、必ず参照してください。

---

## 🌌 大原則: 静けさ最優先

```
Qocca は、機能的Webサイトではなく、"美術館の図録ページ" を作る作業。

Before (情報的Web):           After (静かな空間):
- 情報を見せる                - 体感させる
- 行動を促す                  - 居させる
- 機能を伝える                - 余白を残す

参考にすべきサイト:
- aesop.com (余白と静寂)
- kinfolk.com (タイポグラフィの軽さ)
- 美術館の Web サイト (情報の控えめさ)

絶対NG:
- メルカリ (情報過多)
- 楽天 (賑やか)
- 一般EC (CTA強い、煽り)
```

---

## 🎨 QC カラーパレット (確定版)

```typescript
const QC = {
  warmWhite: '#FAF7F2',    // メイン背景 (朝の光)
  cream: '#F5EFE6',         // セクション背景 (午後の光)
  lightSand: '#EEE6D9',     // 境界線・夕方の光
  charcoal: '#2C2926',      // メインテキスト (夜の影)
  warmGray: '#6B6259',      // サブテキスト
  softBrown: '#8B6F5C',     // タイトル (大地の色)
  mutedGreen: '#7A8B6E',    // アクセント
  sage: '#A8B59E',          // 副アクセント (植物)
  terracotta: '#C97B5F',    // CTAボタン (温かい土)
};

⚠️ 使ってはいけない色:
❌ #F5A94A (旧オレンジ、明るすぎる)
❌ #000 純黒
❌ #FFF 純白
❌ 鮮やかな色全般
```

---

## 🔤 フォント

```typescript
const QC_FONT_JP = '"Zen Kaku Gothic New", "Noto Sans JP", sans-serif';
const QC_FONT_EN = '"Instrument Serif", "Manrope", serif';
// 依頼書 #134 Phase 2 案A改 (2026/6/6) で追加。見出し・キャッチ専用の明朝:
const QC_FONT_DISPLAY = '"Shippori Mincho", "Yu Mincho", "游明朝", serif';

⚠️ Instrument Serif は英字専用 (Qocca, Today's, etc.)
⚠️ 日本語本文は Zen Kaku Gothic New (柔らかいゴシック)
⚠️ Shippori Mincho は h2/h3 見出し・「号」見出し専用 (本文には使わない)
```

### フォントウェイト (大原則: 軽く)

```
❌ 700 以上 (太字、原則厳禁)
   ※ 例外: QC_FONT_DISPLAY (Shippori Mincho) の見出しのみ 700 可
     (依頼書 #134 案A改・King 承認済み。明朝の700は「号」見出しの品位でありゴシックの太字とは別物)
❌ 600 (Semibold、避ける)
✅ 500 (Medium、ゴシックの最大ウェイト)
✅ 400 (Regular、標準)
✅ 300 (Light、推奨)
✅ 200 (Extra Light、装飾用、控えめに)

使い分け:
- H1: 400-500
- H2: 500
- H3: 400
- 本文: 300
- キャプション: 300
- ボタン: 300
- 装飾アイコン: 200
```

---

## 📏 余白システム (拡大)

```
セクション余白:
- 縦 (top/bottom): 200px (デスクトップ)、120px (モバイル)
- 横 (left/right): 32px (モバイル)、64px (デスクトップ)

ヘッダー下余白:
- セクションタイトル下: 80px (詩集のような呼吸)

カード:
- 内余白 (padding): 28px (小)、56px x 32px (中央型)
- 外余白 (margin): 20px (Pinterest型)、28px (大型)

テキスト:
- 行間: 1.9 (本文)、1.8 (タイトル)
- 段落間: 24px
- letterSpacing: 0.5-1.2 (静けさ)
```

---

## ⏱ トランジション & アニメーション (優しく)

```typescript
const QC_TIMING = {
  // ⚠️ 0.3s 以下は禁止 (せわしない)
  
  hoverDuration: '0.8s',
  hoverEasing: 'cubic-bezier(0.22, 1, 0.36, 1)', // ease-out-quint
  
  sectionFadeIn: '1.2s',
  sectionFadeInEasing: 'cubic-bezier(0.16, 1, 0.3, 1)', // ease-out-expo
  
  heroCrossFade: 1500, // ms
  pageTransition: '0.8s',
  buttonHover: '0.6s',
  microMotion: '1.0s',
  staggerDelay: 200, // ms
};
```

### アニメーションの種類

```
✅ Ken Burns (写真ゆっくりズーム/パン)
✅ Cross-fade (1500ms)
✅ Stagger (200ms間隔の連続フェードイン)
✅ Breathe (4秒周期の呼吸)
✅ Hover translateY: -2px (控えめ)

❌ Bounce, Wobble, Shake (賑やか)
❌ Rotate 360° (回転、賑やか)
❌ 大きなスケール変化 (1.05以下)
❌ 強い影 (drop-shadow, 派手)
```

---

## 🌫 グラスモーフィズム (少しだけ)

```typescript
const GLASS = {
  // ガラス感を "少しだけ" - 強すぎないこと
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  background: 'rgba(250, 247, 242, 0.7)', // warmWhite at 70%
  border: '1px solid rgba(255, 255, 255, 0.3)',
};

⚠️ 使用箇所:
✅ SECTIONヘッダー固定帯
✅ モーダルオーバーレイ
✅ SECTION切り替わり境界

❌ Hero のキャプション (削除済み)
❌ 全カードに適用 (やりすぎ)
```

---

## 🎞 ノイズオーバーレイ (粒子感)

```css
/* SVG ノイズフィルター */
opacity: 0.04;  /* 厳守 (0.05+ はノイジー) */
mix-blend-mode: multiply;
pointer-events: none;
position: fixed;
inset: 0;
z-index: 9999;
```

→ 全画面に薄くフィルム粒子感
→ "詩集の紙の質感" を演出

---

## 📝 コピーライティングの原則

```
✅ DO:
- 「、」で繋ぎ、「。」で終わる
- 「？」より「。」(押し付けない)
- 改行で呼吸を作る
- 詩的、控えめ、温かい

❌ DON'T:
- 「！」の連発
- 「今すぐ」「急いで」「限定」
- 絵文字の装飾的使用
- 商業的すぎる表現
- 機能訴求の羅列
```

### 良い例 vs 悪い例

```
❌ Before:
「今すぐ会員登録して、特別なクーポンをゲット！🐾✨」

✅ After:
「あなたの家の窓辺を、誰かに見せませんか。」

---

❌ Before:
「お得な情報を見逃さないで！登録は無料！」

✅ After:
「うちの子の話で笑い合える、そんな街が、ここにあります。」

---

❌ Before:
「💸 手数料無料！🎉 今すぐ出品！」

✅ After:
「販売価格そのまま、あなたの手取りに。」
```

---

## 🎯 SECTION デザインの原則

> ⚠️ 2026/7 注記: 以下の SECTION 記述は 5月時点の構成。その後の改修で
> TodaysMoments は横スクロール化・WhatIsQocca は V3 画像カルーセル化等が入っている。
> **現行実装は src/pages/home.tsx が正** (構成は Grep で都度確認)。
> 本節は「各セクションが守るべきトーン」の参考として読む。

### SectionHero (映像的)

```
✅ フルスクリーン写真ローテーション (14/10/10/10/10/10/14秒)
✅ Cross-fade 1500ms (ゆっくり)
✅ Ken Burns (写真がゆっくりズーム/パン)
✅ キャプションは影だけ (ガラスなし)
✅ ロゴはフェードイン (0.5s遅延)
✅ スクロール誘導 4秒周期の呼吸
```

### SectionTodaysMoments (Pinterest型)

```
✅ Masonry レイアウト (4/3/2列レスポンシブ)
✅ 自然な高さ (aspect-ratio なし)
✅ Stagger フェードイン (200ms間隔)
✅ カード hover: scale(1.015) (控えめ)
✅ ホバー時のみキャプション表示
```

### SectionTownMap (詩集風)

```
✅ 4カード (○広場 □商店街 ◇案内所 △展示場)
✅ アイコンは細い線、size 24px
✅ 余白たっぷり (padding 56px 32px)
✅ hover translateY: -2px
```

### SectionAtelier (商店街)

```
✅ Pinterest型 Masonry
✅ "Qoccaの作家" 等のデフォルト文言なし
✅ "すべての作品を見る" は線リンク (枠ボタンじゃない)
```

### SectionVoices (雑誌コラム風)

```
✅ アイコンなし (○△ 削除)
✅ "5 人" のみ (「住民」削除)
✅ hover translateX: 2px (控えめ)
```

### SectionJoinTown (詩的CTA)

```
✅ "見せませんか。" (？→。)
✅ CTAボタン: 細枠 (塗りなし)
✅ "登録は無料です" 削除
✅ ログイン済みは非表示
```

---

## 🌅 "時間が流れるUI" (スクロール背景補間)

```
スクロール量に応じて背景色が変化:

0%:   warmWhite (朝の光)
40%:  cream (午後の光)
75%:  lightSand (夕方の光)
100%: 夜の深い色

→ ユーザーが "1日を歩いた" 感覚
→ Qocca 独自の世界観
```

実装: `useScrollProgress` + `qoccaInterpolateBackground` 関数

---

## 📱 レスポンシブ

```
ブレークポイント:
- モバイル: < 768px
- タブレット: 768-1024px
- デスクトップ: 1024px+

モバイル優先設計:
- Hero: フルスクリーン縦長
- Masonry: 2列
- セクション余白: 120px (200pxから縮小)
- 文字サイズ: 13-14px (本文)

デスクトップ:
- Hero: 中央縦長 + 両サイドぼかし
- Masonry: 4列
- セクション余白: 200px
- 文字サイズ: 14-15px (本文)
```

---

## 🚫 デザインの絶対NG

```
❌ 絵文字を UI に入れる (🐾🌿🐨等)
   → ロゴ・ボタン・ヘッダー・本文すべて NG
   → Threadsなど SNS 投稿は例外でOK

❌ オレンジ #F5A94A 使う
   → 旧ブランド色、絶対使わない

❌ 純黒 #000 / 純白 #FFF
   → 必ず QC 定数を使う

❌ 「今すぐ」「急いで」「限定」「特別」等
   → 煽り表現、コピー全般で禁止

❌ font-weight 700+
   → 最大 500 (Medium)

❌ transition 0.3s 以下
   → 最低 0.6s、推奨 0.8s

❌ 装飾的アニメーション (回転・バウンス・点滅)
   → 静けさを壊す

❌ 強い影 (box-shadow)
   → 薄く控えめに、または使わない
```

---

## 🐨 クマへのメッセージ

```
クマ…

Qocca のデザインは、King の魂や。

"静けさ" は単なる美的選択じゃない。
King の思想:
- 動物への愛は静かなもの
- うちの子との時間は穏やかなもの
- 押し付けない、ゆっくり寄り添う

これをUIで表現するのが Qocca のデザイン。

コード書く時、コピー書く時、
迷ったら "静けさ最優先" に立ち返る。

これが、ペット界の標準への道や 🌙🐾🐨🐻
```

---

> **更新**: 2026/5/12 (雛形版)
> **次回更新**: 2026/5/13 King と詳細追加
