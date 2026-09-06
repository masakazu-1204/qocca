# Qocca ハイブリッド通貨 設計書 v1.0

> 作成: 2026/7/3 (クマ / Fable 5) — King・ワイのレビュー用ドラフト
> ステータス: **設計のみ・未実装**。実装GOは King レビュー後。
> 前提 = 通貨の憲法 (King 決定済):
> ① ハイブリッド型 (無料付与 + 課金ブースト) ② 使い道は装飾・表現専用 (**マーケット決済には使わない**)
> ③ 贈る経済あり (無料分のみ贈与可・課金分は本人専用) ④ 島とポケットの二層構造

---

## 1. 経済コンセプト

### 1-1. 島とポケットの二層構造

```
┌─────────────────── 島 (Island) ───────────────────┐
│  街全体の共有経済圏。通貨の「発行・回収・流通量」を管理する層   │
│                                                      │
│   発行 (蛇口)                  回収 (排水口)            │
│   ・ログイン/投稿への無料付与     ・装飾アイテムの購入で消費   │
│   ・イベント報酬                ・期限切れ失効            │
│   ・課金ブースト (Stripe)       ・退会時の残高消滅         │
│                                                      │
│   ┌─ ポケット (Pocket) ─┐  ┌─ ポケット ─┐             │
│   │ 住民Aの財布          │  │ 住民Bの財布 │  …          │
│   │ ├ 無料分 (贈与可)    │──贈与──▶ 無料分            │
│   │ └ 課金分 (本人専用)  │  │           │             │
│   └─────────────────┘  └───────────┘             │
└──────────────────────────────────────────────────┘
```

- **島** = 発行総量・流通速度・失効を見る「街の中央銀行」視点。インフレ(通貨余り→装飾の価値低下)を防ぐため、蛇口と排水口のバランスを月次で監視する
- **ポケット** = 個人残高。**無料分 (free) と課金分 (paid) を必ず分離して持つ**(法務・贈与制御の根幹)
- 通貨は島の外 (現金・マーケット決済) と**交換不能**。装飾・表現に使って「街を彩る」ためだけの閉じた経済

### 1-2. 通貨の名称案 (3案)

| 案 | 名称 | 単位表記 | 世界観の理由 |
|---|---|---|---|
| A ⭐推奨 | **どんぐり (Donguri)** | 🌰 1どんぐり | 街の公園で拾える・動物が集める・貯める喜びが直感的。「どんぐり3つで飾れます」の語感が優しい |
| B | **あしあと (Ashiato)** | 🐾 1あしあと | うちの子が残す足あと=住民の活動の痕跡。Qoccaの🐾モチーフと直結 |
| C | **ひだまり (Hidamari)** | ☀ 1ひだまり | 静けさ世界観そのもの。「ひだまりを贈る」の表現が詩的 |

※ UI上は絵文字を使わず、専用の細線アイコン (QC.softBrown) で描く (03-design-system 準拠)

---

## 2. 通貨の入手・消費フロー

### 2-1. 無料付与の経路 (蛇口) — 設計案

| 経路 | 付与量(案) | 上限 | 意図 |
|---|---|---|---|
| デイリーログイン | 1/日 | 1/日 | 毎日街に来る習慣 |
| うちの子写真の投稿 (gallery) | 3/投稿 | 1回/日 | 街のアルバムを賑わす |
| コミュニティ投稿・コメント | 1/投稿 | 3/日 | 広場の会話を促す |
| コミュニティ新規参加 | 5 | 初回のみ | 導線ブースト |
| マーケット購入の還元 | 価格の1%相当 | — | 買い物と装飾経済の接続 (通貨→商品は不可、商品→通貨の一方向) |
| イベント参加・企画報酬 | 10-50 | 運営裁量 | 季節イベントの目玉 |
| 贈与の受取 | 相手の無料分から | 受取上限 20/日 | 「ありがとう」の循環 |

- 付与量は**少なめから開始**(インフレ調整は増やす方が簡単。減らすと不満が出る)
- 全付与に**冪等キー必須**(§5)。1日上限は付与ルールテーブル(§4)で宣言的に管理

### 2-2. 課金ブースト (Stripe 連携) — 設計案

| 商品 | 価格 | 付与 | 備考 |
|---|---|---|---|
| ブースト S | ¥120 | 課金分 100 | お試し |
| ブースト M | ¥490 | 課金分 450 | ボーナスなし設計 (§3の論点回避のためレート一定を推奨) |
| ブースト L | ¥980 | 課金分 900 | 同上 |

- 決済は **Stripe Checkout の新規商品**として実装 (既存 create-checkout とは**別の Edge Function**。決済本丸に触らない)
- 「¥1=約1通貨」の**一定レート**とし、ボーナス積み増しをしない案を推奨 (財産的価値の計算を単純化し、法務説明を容易にする)
- **課金分は贈与不可・本人の装飾にのみ使用可** (憲法③)

### 2-3. 消費先 (排水口) — 装飾アイテムの種類・価格帯

| カテゴリ | 例 | 価格帯(通貨) |
|---|---|---|
| フォント装飾 | 投稿タイトルの明朝化・色変え (QCパレット内) | 5-15 |
| プロフィールデコ | フレーム・背景パターン(紙質感)・季節の飾り | 10-50 |
| スタンプ | 街の風景・クオッカ・うちの子種別スタンプ | 3-10 |
| アイテム棚 | プロフィールに飾る棚+置物(どんぐり細工等) | 20-100 |
| 贈答装飾 | 他の住民のうちの子写真に「花を一輪飾る」 | 1-5 |

- 消費されたら**消滅**(ユーザー間で装飾アイテム自体の転売・交換はさせない — 二次流通は法務・不正の温床)
- 期間限定アイテムで排水口を定期的に開ける (季節の飾り)

---

## 3. ★法務論点 (最重要・精査)

> ⚠️ **本章は設計上の論点整理であり、法的助言ではない。実装GO前に必ず弁護士等の専門家確認を経ること。** 断定表現は避け、条文参照はドラフト時点の理解として記す。

### 3-1. 資金決済法「前払式支払手段」該当性 (法3条1項)

該当の3要件と本設計のあてはめ:

| 要件 | 無料付与分 | 課金ブースト分 |
|---|---|---|
| ① 対価を得て発行 | **非該当の可能性が高い**(無償付与。ポイントサービスは一般に対象外とされる例が多い) | **該当しうる**(¥で購入) |
| ② 金額・数量等の財産的価値が記録 | 記録される | 記録される |
| ③ 物品購入・役務提供に使用可 | 装飾=デジタル役務の提供と評価されうる | 同左 |

→ **課金分は3要件を満たし「前払式支払手段(自家型)」に該当する可能性がある**。
→ 無料分は①を欠くため原則対象外と考えられるが、「課金分と混蔵すると全体が対象と評価されるリスク」があるため、**残高の完全分離(§4)が法務上も本質的**。

### 3-2. 回避・軽減の設計パターン (複数提示)

| パターン | 内容 | 効果 | トレードオフ |
|---|---|---|---|
| **A. 有効期限6ヶ月以内** | 課金分の有効期限を**発行から6ヶ月以内**に設定 | 法4条2号の適用除外(短期間有効の前払式支払手段は法の適用対象外)に**該当しうる** | UX毀損(せっかく買った通貨が消える不満)。失効告知UIが必須 |
| **B. 装飾・表現専用に閉じる** | マーケット決済に使えない(憲法②で採用済) | 該当性そのものは消えない(役務提供に使える限り③は満たしうる)が、**射程とリスク説明が単純になる** | 完全回避ではない点に注意 |
| **C. 無料分と課金分のDB分離** | 残高・履歴を性質別に分離(§4で採用) | 対象範囲を課金分のみに限定する主張の裏付け。未使用残高の算定も課金分だけで可能に | 実装コスト微増 |
| **D. 課金を「通貨」でなく「アイテム直接購入」にする** | ¥→装飾アイテムを直接買う(中間通貨を挟まない) | 課金分の通貨が存在しなくなり、**前払式該当リスクを構造的に大幅低減** | 「ブースト」の柔軟性を失う。ハイブリッド憲法の変更が必要 |

**推奨の組み合わせ: B + C を基盤に、A (6ヶ月失効) を課金分にのみ適用**。
これで「課金分=短期有効の閉じた装飾専用手段」となり、適用除外の主張余地 + 万一該当でも供託リスクの最小化が両立しうる。
**代替として D も真剣に検討価値あり**(法務コスト最小。Phase分割で「まず D で出し、通貨は無料分のみ」→「専門家確認後に課金ブースト解禁」の段階導入が最も安全)。

### 3-3. 自家型の届出・供託義務の閾値 (該当する場合)

- 自家型前払式支払手段は、**基準日 (毎年3/31・9/30) の未使用残高が 1,000万円を超えた場合**に財務局への**届出**義務が生じ、以後**未使用残高の1/2以上の発行保証金の供託**等が必要になる、というのがドラフト時点の理解
- Qocca の現規模 (課金分の未使用残高が1,000万円に達するのは相当先) では、**該当したとしても当面は届出閾値未満**に留まる見込み
- ただし: 閾値管理を**運用ではなくDBで機械的に監視**できるよう、課金分未使用残高の集計ビューを§4に含める
- 資金移動業(送金)該当リスク: 課金分を贈与不可にしている(憲法③)ため、換金性・送金性は構造的に排除。**無料分の贈与も現金化経路が無い**ことが重要(装飾専用+二次流通なし)

### 3-4. その他の法務チェック項目 (専門家に確認する質問リスト)

1. 課金分6ヶ月失効の適用除外(法4条2号)は本設計の「装飾専用デジタル通貨」に適用可能か
2. 無料分と課金分をDB分離した場合、無料分は前払式の射程外と整理できるか
3. 「マーケット購入の1%還元」で付与される無料分は「対価を得て発行」と評価されないか(ポイント還元の整理)
4. 資金移動業・暗号資産・景品表示法(付与上限)・特商法(課金表示)の観点で追加論点はないか
5. 利用規約に必要な条項(失効・退会時消滅・払い戻し不可)の文言

---

## 4. DB設計

> ★S1セキュリティ教訓を全面反映: **全新テーブルは anon / authenticated / PUBLIC からの INSERT/UPDATE/DELETE を REVOKE し、書き込みは SECURITY DEFINER の RPC 経由のみ**。RLS は SELECT の可視性制御に使う。

### 4-1. テーブル一覧

```sql
-- ① 残高 (ポケット)。無料分と課金分を別カラムで分離 (性質フラグより堅い)
CREATE TABLE currency_balances (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  free_balance    integer NOT NULL DEFAULT 0 CHECK (free_balance >= 0),
  paid_balance    integer NOT NULL DEFAULT 0 CHECK (paid_balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0,   -- 島の統計用
  lifetime_spent  integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ② 取引履歴 (全ての増減を記録・監査の一次ソース)
CREATE TABLE currency_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  amount        integer NOT NULL,              -- 正=増 / 負=減
  balance_type  text NOT NULL CHECK (balance_type IN ('free','paid')),
  tx_type       text NOT NULL CHECK (tx_type IN
                  ('earn','purchase','spend','gift_sent','gift_received','expire','revoke')),
  source        text,                          -- 'daily_login' / 'gallery_post' / stripe session id 等
  related_user  uuid,                          -- 贈与相手
  related_item  uuid,                          -- 消費した装飾アイテム
  idempotency_key text UNIQUE,                 -- ★二重付与ガードの核
  expires_at    timestamptz,                   -- 課金分の失効期日 (パターンA採用時)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ③ 装飾アイテムマスタ (運営管理)
CREATE TABLE decoration_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL,                  -- 'font'/'profile_deco'/'stamp'/'shelf'/'gift_deco'
  name         text NOT NULL,
  price        integer NOT NULL CHECK (price > 0),
  is_active    boolean NOT NULL DEFAULT true,
  is_seasonal  boolean NOT NULL DEFAULT false,
  available_until timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ④ 所持装飾 (購入済みアイテム。転売・交換不可なので所有者固定)
CREATE TABLE user_decorations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES decoration_items(id),
  equipped    boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now()
);

-- ⑤ 付与ルール (宣言的な蛇口管理。付与量・日次上限をコードでなくデータで持つ)
CREATE TABLE currency_earn_rules (
  rule_key    text PRIMARY KEY,                -- 'daily_login' 等
  amount      integer NOT NULL,
  daily_cap   integer,                         -- null = 無制限
  is_active   boolean NOT NULL DEFAULT true
);

-- ⑥ 法務監視ビュー (§3-3 の閾値管理)
CREATE VIEW currency_paid_outstanding AS
  SELECT SUM(paid_balance) AS total_paid_unused FROM currency_balances;
  -- security_invoker = on で作成 (advisor の security_definer_view ERROR を増やさない)
```

### 4-2. 権限 (S1原則)

```sql
-- 全テーブル: クライアント直接書き込みを遮断
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON currency_balances, currency_transactions, decoration_items,
     user_decorations, currency_earn_rules
  FROM anon, authenticated, PUBLIC;
-- 書き込みは SECURITY DEFINER RPC (§5) のみ。RPC には search_path 固定を必ず設定
```

### 4-3. RLS 方針

| テーブル | SELECT | 書き込み |
|---|---|---|
| currency_balances | 本人のみ (`auth.uid() = user_id`) | RPCのみ |
| currency_transactions | 本人のみ | RPCのみ |
| decoration_items | 全員 (is_active=true のみ) | 運営 (service_role) のみ |
| user_decorations | equipped=true は全員可視 (プロフィール表示用) / 全行は本人 | RPCのみ |
| currency_earn_rules | 全員可 (透明性) or 非公開 (King判断) | 運営のみ |

---

## 5. RPC設計

> 全 RPC は SECURITY DEFINER + `SET search_path = public` + 入力検証。クライアントは RPC 以外で残高に触れない。

```sql
-- ① 無料付与 (蛇口)
grant_free_currency(
  p_user uuid, p_rule_key text, p_idempotency_key text
) RETURNS jsonb
-- ・currency_earn_rules から amount/daily_cap を引く (ハードコードしない)
-- ・idempotency_key UNIQUE 違反 → 既付与として正常応答 (二重付与ガード)
-- ・daily_cap: 当日 (JST) の同 rule_key 付与回数を COUNT して超過なら拒否
-- ・balances.free_balance += amount と transactions INSERT を同一トランザクションで

-- ② 課金付与 (Stripe webhook からのみ呼ぶ)
grant_paid_currency(
  p_user uuid, p_amount int, p_stripe_session_id text
) RETURNS jsonb
-- ・idempotency_key = stripe_session_id (Stripe の再送に耐える)
-- ・expires_at = now() + interval '6 months' を transactions に記録 (パターンA採用時)

-- ③ 消費 (排水口)
spend_currency(
  p_user uuid, p_item_id uuid, p_idempotency_key text
) RETURNS jsonb
-- ・価格取得は decoration_items から (クライアントから価格を受け取らない ★改ざん防止)
-- ・消費順序: 課金分(期限が近い) → 無料分 の順で減算 (課金分の失効ロスを最小化)
--   ※逆順 (無料分から) も選べる。King 判断ポイント
-- ・残高不足なら例外。CHECK (balance >= 0) が最終防壁
-- ・user_decorations INSERT + balances UPDATE + transactions INSERT を同一トランザクション

-- ④ 贈与 (無料分のみ)
gift_currency(
  p_from uuid, p_to uuid, p_amount int, p_idempotency_key text
) RETURNS jsonb
-- ・★from の free_balance のみから減算 (paid_balance には一切触れない = 憲法③)
-- ・受け取り側も free_balance に加算 (贈与で paid が生まれない)
-- ・p_from = auth.uid() 検証 (他人の財布から送れない)
-- ・p_from = p_to 拒否 / 1日の贈与上限・受取上限チェック (§6)
-- ・amount <= 0 拒否

-- ⑤ 失効バッチ (pg_cron・日次)
expire_paid_currency() RETURNS int
-- ・expires_at < now() の未消費課金分を balances から減算し tx_type='expire' で記録
-- ・失効30日前に通知テーブルへ (UX配慮)
```

**不正防止の共通原則**: 冪等キー必須 / 残高マイナスは CHECK 制約で構造的に不可能 / 価格・付与量はサーバ側マスタから取得 / 全増減が transactions に残る (残高と履歴の突合バッチで改ざん検知)

---

## 6. エッジケース・不正防止

| 想定される不正/事故 | 対策 |
|---|---|
| **自作自演の贈与ループ** (複垢で無料分を集約) | 受取上限 20/日 + 同一相手への贈与上限 (例 5/日) + 新規アカウントは登録7日間 贈与受取不可 + 電話認証済みユーザーのみ贈与可 (Twilio復旧後) |
| **付与の連打** (投稿→削除→再投稿) | rule ごとの daily_cap + idempotency_key に対象コンテンツIDを含める (`gallery_post:{post_id}`) → 同一投稿での再付与を構造的に遮断 |
| **クライアント価格改ざん** | RPC は item_id のみ受け取り価格はサーバ参照 (§5-③) |
| **Stripe webhook 再送での二重チャージ付与** | idempotency_key = stripe_session_id |
| **退会時の残高** | 規約で「退会と同時に全残高消滅・払い戻し不可」を明記 (法務確認要§3-4-5)。ON DELETE CASCADE で物理削除 + 削除前に tx_type='revoke' を記録 |
| **同時実行の競合** (2端末同時消費) | balances 行の `SELECT ... FOR UPDATE` で行ロック → CHECK制約が最終防壁 |
| **負数・巨大数の入力** | RPC 冒頭で amount の範囲検証 (1〜10,000 等) |
| **島のインフレ** | 月次で「発行総量 vs 消費総量」をビュー化し King ダッシュボードで監視。蛇口(earn_rules)はデータ変更だけで絞れる設計 |

---

## 7. 実装フェーズ分割案

### Phase C-1 (MVP): 無料通貨の閉じた経済 — ★推奨開始点
- テーブル①②③④⑤ + RPC①③ (付与と消費のみ)
- 付与経路はデイリーログイン + gallery投稿の2本だけ
- 装飾はスタンプ + プロフィールフレームの2カテゴリ・各3種
- **課金なし・贈与なし** → 前払式リスクゼロで経済の回り方を観察できる
- 既存実装との統合: プロフィール表示 (`/user/:id`) に equipped 装飾の描画を追加

### Phase C-2: 贈る経済
- RPC④ (贈与) + 不正対策 (§6 の複垢対策)
- 「花を一輪飾る」贈答装飾

### Phase C-3: 課金ブースト — ★専門家確認の後
- §3 の法務確認が完了してから着手
- RPC② + 失効バッチ⑤ + Stripe 新Edge Function (既存決済3関数は非接触)
- 法務監視ビュー + 未使用残高の月次レポート

### Phase C-4: 拡張
- アイテム棚・フォント装飾・季節イベント連動
- 島ダッシュボード (Admin) でインフレ監視

---

## 付記: King 判断が必要な論点

1. **法務アプローチ**: 「B+C+A (6ヶ月失効)」で課金ブーストを目指すか、「D (アイテム直接課金)」に憲法を修正してリスク構造を消すか。→ どちらでも Phase C-1 (無料のみ) は共通なので、**MVP着手と並行して専門家相談が可能**
2. **通貨名**: どんぐり / あしあと / ひだまり (§1-2)
3. **消費順序**: 課金分から先に減らす (失効ロス最小・ユーザー有利) か、無料分から先か (§5-③)
