# 「あしあと」🐾 UI設計書 v1.0 (Phase C-1 フロント)

> 作成: 2026/7/3 (クマ / Fable 5) — 設計のみ・実装は別フェーズ
> バックエンド稼働中: currency_balances / currency_transactions / decoration_items / user_decorations / currency_earn_rules + RPC `grant_free_currency` / `spend_currency`
> 世界観: **「街を歩いた足跡が、貯まっていく。」** — 稼ぐ通貨ではなく、暮らした証。

---

## 0. デザイントークン方針 (最初に決める)

Qocca には2つのデザイン体系が併存している (実装事実):

| 体系 | 使用画面 | 特徴 |
|---|---|---|
| **C トークン** (C.orange = #F5A94A 系) | マーケット/マイページ/出品/TabBar 等の**機能画面** | 明快・操作的 |
| **QC トークン** (静けさ) | ホーム/ペットウォーカー等の**世界観画面** | 余白・軽いウェイト |

**方針**: あしあとUIは「機能画面」側なので **C トークン基調 (#F5A94A)** で既存のマイページ/ショップ系と統一する。ただし:
- ホーム等の静けさ画面に露出する要素 (残高ミニバッジ等) は **QC トークンで馴染ませる**
- ⚠️ 03-design-system は QC 画面で #F5A94A を禁止している。**静けさ画面へのオレンジ持ち込みはしない** (機能画面内に閉じる)
- 付与演出は「派手なゲーム風」でなく「温かい紙の質感」— Mercari型のハードル感ゼロ + Qocca の詩情

---

## 1. 画面1: あしあと残高表示

### 1-1. 配置 (2箇所)

```
A. マイページ ヘッダー直下 (メイン表示)
┌──────────────────────────────┐
│  マイページ                     │
│ ┌──────────────────────────┐ │
│ │ 🐾 12 あしあと      [ショップへ →] │ │  ← カード型・C.orangePale 背景
│ │ 今日: ログイン +1 / 投稿 +3      │ │  ← 当日の獲得内訳 (小さく)
│ └──────────────────────────┘ │
└──────────────────────────────┘

B. 装飾ショップ ヘッダー (常時表示)
│ 🐾 12   ← 右上固定。購入時に数字がカウントダウンする
```

- **TabBar / グローバルヘッダーには置かない** (常時露出は圧が強い。Mercari型=気づいたら貯まってた、が理想)
- 数値は `currency_balances.free_balance` を RLS 経由 SELECT (本人のみ可視・実装済み)

### 1-2. free/paid の将来分離
- C-1 は free のみ表示。**表示コンポーネントの props は `{ free: number, paid?: number }` で先に切っておく**
- C-3 で paid 追加時は「🐾 12 (+ブースト 100)」の2段表示を想定 — 今はUI上何も出さない

### 1-3. ビジュアル
- 🐾 は絵文字でなく**専用SVGアイコン** (素材リスト§4-3)。C.orange 塗り・丸みのある肉球
- 数字: 大きめ (20-24px / weight 700 ※機能画面なのでCトークン系の太字OK)
- 「あしあと」単位表記は小さく添える (11px / C.warmGray)

---

## 2. 画面2: 装飾ショップ

### 2-1. ルート・構成

- 新ページ `/ashiato-shop` (pages/ashiato_shop.tsx・App.tsx には Route 1行だけ追加)
- 入口: マイページ残高カードの「ショップへ →」+ マイページメニュー

```
┌──────────────────────────────┐
│ ← あしあとショップ        🐾 12  │  ← 戻る + 残高常時表示
│                                │
│ 「街を歩いた足跡と、すこし交換。」  │  ← 詩的リード文 1行
│                                │
│ [スタンプ] [フレーム]            │  ← カテゴリタブ (2つ)
│ ┌─────────┐ ┌─────────┐      │
│ │ (画像)    │ │ (画像)    │      │  ← 2列グリッド (PC 3-4列)
│ │はじめての  │ │街のクオッカ│      │
│ │あしあと    │ │           │      │
│ │ 🐾 3      │ │ 🐾 3      │      │
│ │[交換する]  │ │[✓ 持ってる]│      │  ← 所持済みはボタン無効化+チェック
│ └─────────┘ └─────────┘      │
└──────────────────────────────┘
```

### 2-2. カード仕様
| 要素 | 仕様 |
|---|---|
| 画像 | 1:1・角丸12px・C.orangePale 背景にアイテム画像 |
| 名前 | 13px / 700 / C.dark |
| 価格 | 🐾アイコン + 数字 (C.orange / 700) |
| ボタン | 「交換する」(C.orange 塗り) / 所持済み「✓ 持ってる」(C.lightGray・無効) / 残高不足「🐾 あと2」(枠のみ・押せるが確認画面で不足案内) |

- 文言は「購入」でなく **「交換する」** (お金っぽさを消す・前払式の印象も避ける)

### 2-3. 購入フロー (UX)

```
カードタップ
 → 確認モーダル (画像大きく + 「『はじめてのあしあと』と交換しますか?」
    + 「🐾 3 つかう → のこり 🐾 9」)
 → [交換する] 押下
 → spend_currency(item_id, idempotency_key) 呼び出し
    idempotency_key = `spend:{user_id}:{item_id}:{uuid}` (連打はボタン disable でも防ぐ)
 → 成功: モーダルが「手に入れた!」演出 (§3-3) → 所持一覧へ反映
 → insufficient_balance: 「あしあとが あと N たりません。
    今日も街を歩けば、貯まっていきます 🐾」 (焦らせない・課金誘導もしない)
 → item_not_found / エラー: 「うまく交換できませんでした。時間をおいて試してください」
```

### 2-4. 所持・装備
- 「もっているもの」タブ (第3タブ or マイページ内) で所持一覧
- フレームは「つける/はずす」トグル → `user_decorations.equipped` 更新
- ⚠️ equipped 更新は現状 RPC が無い (REVOKE済みでクライアント直接UPDATE不可) → **実装フェーズで `equip_decoration(p_decoration_id, p_equipped)` RPC を1本追加する必要あり** (申し送り)

---

## 3. 画面3: 付与演出

### 3-1. デイリーログイン (+1🐾)

- 発火: その日初めてのアプリ起動時 (App.tsx で `grant_free_currency('daily_login', 'daily:{uid}:{date}')` → success 時のみ演出)
- 演出: **画面下からトースト**が ふわっと上がる (0.6s ease-out)

```
┌────────────────────┐
│ 🐾 +1               │
│ 今日も、街へようこそ。 │
└────────────────────┘
   ↑ 2.5秒表示 → ふわっと消える。タップで即閉じ
```
- 音なし・バイブなし・画面中央を塞がない (静けさとの折衷)

### 3-2. gallery投稿 (+3🐾)
- 発火: 投稿完了トースト内に統合 (投稿成功メッセージ + 🐾 +3 を1つのトーストで)
- 「思い出をありがとう 🐾 +3」
- daily_cap 到達時 (3投稿目以降): **演出なし・無言** (「今日はもう貰えません」と言わない。付与がない日も投稿は嬉しい行為のままにする)

### 3-3. 交換成功演出 (ショップ)
- モーダル内: アイテム画像が**ぽん、と一度だけ小さくバウンス** (scale 0.9→1.05→1.0 / 0.5s) + 足跡が画像の周りに 3つ順番にスタンプされる (stagger 150ms)
- コピー: 「あなたの棚に加わりました」

### 3-4. アニメーション原則
| OK | NG |
|---|---|
| 足跡がポン・ポン・ポンと順に現れる (stagger) | 紙吹雪・コイン落下 (ゲーム的すぎ) |
| ふわっと (0.5-0.8s ease-out) | バウンス連発・点滅・回転 |
| +N のカウントアップ (数字がころころ増える 0.4s) | 効果音 |

---

## 4. ★必要素材リスト (Higgsfield 生成用)

> 共通スタイル指定 (全プロンプト末尾に付ける):
> `warm orange (#F5A94A) and cream color palette, soft rounded shapes, flat illustration with subtle paper texture, gentle and cozy, no text, no letters, transparent or cream background, consistent minimal style`

### 4-1. スタンプ画像 (現行3種 + 拡張3種 = 6点・1:1・512px)

| # | アイテム名 (DB) | モチーフ | Higgsfield プロンプト案 |
|---|---|---|---|
| S1 | はじめてのあしあと (3🐾) | 小さな肉球の足跡ひとつ・踏み出した感じ | `a single small cute paw print stamp, first step motif, warm orange (#F5A94A), soft rounded flat illustration, subtle paper texture, cozy, no text, cream background` |
| S2 | 街のクオッカ (3🐾) | ほほえむクオッカの顔スタンプ | `a smiling quokka face stamp, round friendly character, warm orange and cream palette, flat illustration with soft edges, cozy and gentle, no text` |
| S3 | 雨あがりのあしあと (5🐾) | 水たまり+虹の反射+肉球 | `paw prints beside a small puddle reflecting a soft rainbow after rain, warm orange and cream tones, flat cozy illustration, subtle texture, no text` |
| S4 (拡張) | おさんぽ日和 | リード+お散歩道 | `a curved walking path with tiny paw prints and a leash, sunny day mood, warm orange cream palette, flat rounded illustration, no text` |
| S5 (拡張) | おやつの時間 | 骨型クッキー+魚クッキー | `a bone-shaped cookie and a fish-shaped cookie, bakery style, warm orange and cream, soft flat illustration, cozy, no text` |
| S6 (拡張) | まちの花 | 一輪の花 (贈答装飾のC-2先行素材) | `a single gentle flower with round petals, warm orange and soft green accents, flat cozy illustration, paper texture, no text` |

### 4-2. フレーム画像 (現行3種・正方形フレーム・1024px・中央透過)

| # | アイテム名 (DB) | 世界観 | Higgsfield プロンプト案 |
|---|---|---|---|
| F1 | 木漏れ日のフレーム (15🐾) | 葉の影が落ちる縁 | `a square photo frame border of soft dappled sunlight through leaves, warm orange and cream, gentle leaf shadows on the frame edges only, empty transparent center, flat illustration, no text` |
| F2 | 紙の質感フレーム (15🐾) | クラフト紙・切り絵風の縁 | `a square photo frame border made of warm craft paper with torn edges, cream and soft orange tones, paper texture, empty transparent center, cozy handmade feel, no text` |
| F3 | 夕暮れの街並みフレーム (25🐾) | 下辺に小さな街のシルエット+夕陽 | `a square photo frame with a tiny warm town silhouette along the bottom edge at sunset, soft orange gradient sky on frame edges, empty transparent center, cozy flat illustration, no text` |

### 4-3. 通貨アイコン (ブランド化・必須 1点 + 派生)

| # | 用途 | 仕様 | プロンプト案 |
|---|---|---|---|
| I1 | 🐾 あしあとアイコン (マスター) | SVG化前提・単色シルエットが理想 | `a simple rounded paw print icon, single warm orange color (#F5A94A), soft plump pads, minimal flat logo style, centered, transparent background, no text` |
| I1-b | 白抜き版 (オレンジボタン上) | I1 の色替え (生成不要・SVG編集) | — |

→ **生成後に手動でSVGトレース推奨** (残高表示・価格表示・演出で多サイズ使用するため)。ラスタのままなら 128px/512px の2サイズ書き出し。

### 4-4. エフェクト素材 (付与演出用 2点)

| # | 用途 | プロンプト案 |
|---|---|---|
| E1 | 足跡スタンプ連打素材 (交換成功演出) | `three small paw prints in a walking sequence, warm orange, simple flat stamps, slightly rotated each, transparent background, no text` ※または I1 の SVG を回転コピーで自作 (生成不要・推奨) |
| E2 | トースト背景の紙質感 | `a soft cream paper texture card with subtle warm grain, very light, minimal, no pattern, no text` ※CSS (bg + noise) でも代替可・優先度低 |

**生成必須は 10点** (S1-S6, F1-F3, I1)。E1/E2 は SVG/CSS 代替可。

---

## 5. コンポーネント分割案 (App.tsx 肥大の反省を反映)

```
src/
├── pages/
│   └── ashiato_shop.tsx        # ショップページ (一覧/タブ/購入モーダル/所持)
├── components/
│   ├── AshiatoBalance.tsx      # 残高表示 (props: {free, paid?} / variant: 'card'|'badge')
│   ├── AshiatoGrantToast.tsx   # 付与トースト (§3-1/3-2 共用・queue対応)
│   └── AshiatoIcon.tsx         # 🐾 SVGアイコン (size/color props)
├── hooks/
│   └── useAshiato.ts           # 残高取得 + grant/spend RPC ラッパ + 冪等キー生成
└── App.tsx                     # 変更は Route 1行 + デイリー付与 useEffect のみ
```

- App.tsx への追加は**最小2点** (Route / ログイン付与トリガ)。ロジックは全て hooks/components へ
- gallery投稿付与は `pages/gallery.tsx` の投稿成功ハンドラに1行 (`grant → toast`)

---

## 6. 実装フェーズの推奨順序

| 順 | 内容 | 依存 |
|---|---|---|
| 1 | `AshiatoIcon` + `useAshiato` フック | 素材 I1 |
| 2 | `AshiatoBalance` + マイページ残高カード | 1 |
| 3 | デイリーログイン付与 + `AshiatoGrantToast` | 1 (画像なしでも文字トーストで先行可) |
| 4 | ショップページ (一覧・購入フロー) | 素材 S1-S3, F1-F3 |
| 5 | gallery投稿付与の接続 | 3 |
| 6 | 所持一覧 + フレーム装備 (**equip RPC 追加が必要**・要 migration) | 4 |
| 7 | 拡張スタンプ S4-S6 投入 (decoration_items INSERT) | 素材 |

→ **1-3 は素材が I1 1点だけあれば出せる** (ショップより先に「貯まる体験」を回し始められる)。King の Higgsfield 生成は I1 → S1-S3/F1-F3 → S4-S6 の順が効率的。

---

## 付記: King 判断ポイント

1. **拡張スタンプ S4-S6 の価格** (案: おさんぽ日和 5🐾 / おやつの時間 5🐾 / まちの花 3🐾)
2. 残高バッジをホーム(静けさ画面)にも出すか → クマ推奨は**出さない** (マイページ/ショップに閉じる)
3. デイリー付与の発火タイミング (起動即 vs マイページ初訪問時) → クマ推奨は**起動即** (Mercari型・気づいたら貯まる)
