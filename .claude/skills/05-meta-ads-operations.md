---
name: qocca-meta-ads-operations
description: Meta(Facebook/Instagram)広告運用の戦略・KPI・Pixel/CAPI実装・静けさを保つクリエイティブ原則。広告関連の作業(キャンペーン分析・Pixel確認・クリエイティブ制作)の前に参照。Pixel ID=1039178921791385(末尾1385が正・旧7030は使用禁止)。
---

# 📣 Skill 05: META 広告マネージャー運用

> このスキルは、Qocca ローンチ後 (2026/7/1〜) の META (Facebook / Instagram) 広告運用で
> クマが King を支えるための知識・戦略・実装テンプレを記載しています。
> 広告作業を始める前に必ず参照してください。

---

## 🌅 大前提: Qocca の広告は "静けさ" を保つ

```
他社EC広告:                Qocca 広告:
- 派手な CTA              - 一枚の写真と一行のコピー
- "今だけ" "限定"          - "うちの子の話で笑い合える街"
- ベネフィット羅列        - 余白
- 絵文字過多              - 詩集の表紙のような佇まい

→ 静けさデザイン (Skill 03) と完全に揃える
→ "煽らないのに、心に残る" 広告クリエイティブ
```

⚠️ Meta の機械学習は「クリック率の高さ」を学習するため、放置すると派手な広告に最適化される。**Qocca では成果指標を CTR ではなく "登録 / 出品 / 取引" に絞る** こと。

---

## 🎯 ローンチ広告戦略 (2026/7/1〜)

### Phase 構成

```
Phase L0 (準備): 6/15〜6/30 ✅ 完了
  - Meta Business Account / Ads Manager セットアップ ✅
  - Meta Pixel 設置 ✅ (ID: 1039178921791385 / 末尾1385が正・旧7030は使用禁止。
    実装: src/lib/metaPixel.ts / env VITE_META_PIXEL_ID 経由 / 本番bundle焼き込み検証済 7/2)
  - キャンペーン Qocca_PW_202607 公開・配信中 ✅
  - Conversions API / カタログ連携は未 (Phase L3 で検討)

Phase L1 (ローンチ): 7/1〜7/14 ← 現在ここ
  - 目標: 認知 + Welcome Campaign 告知
  - 予算: ¥1,000-2,000/日 (テスト段階)
  - 配信: Reels + Instagram Feed
  - クリエイティブ: 写真 + "うちの子を愛してる人が集まる街。"

Phase L2 (拡大): 7/15〜7/31
  - 目標: 登録獲得・初出品
  - Welcome Campaign 終了前の駆け込み (※煽り禁止、淡々と告知)
  - 予算: 成果次第で ¥2,000-5,000/日
  - Lookalike Audience 投入

Phase L3 (定着): 8/1〜
  - 目標: 取引発生・LTV 改善
  - Catalog Ads (Advantage+ ショッピング) 開始
  - リターゲティング: 訪問者・カート離脱
```

### 主要 KPI (Qocca 固有)

```
ローンチ期の北極星:
1. 新規登録数 (Sign Up)
2. 公式 LINE / X / Threads フォロー (補助)

定着期の北極星:
3. 初出品数 (First Listing)
4. 初取引数 (First Order)
5. CAC (顧客獲得単価) ≤ ¥500 を初期目標 / ≤ ¥300 を3ヶ月後目標
6. ROAS ≥ 200% を目安 (BPF 4% + 手数料考慮)
```

---

## 📐 Campaign Objective 選定ガイド

```
Qocca で使う Objective (上から優先):

1. Sales (Conversion 最適化)
   - Pixel + CAPI 必須
   - イベント: Purchase / InitiateCheckout / AddToCart
   - 数値が一定貯まってから (1週間50イベント目安)

2. Leads
   - 登録獲得フェーズ向け
   - Custom Conversion: SignUp (gtag→Pixel送信)

3. Engagement
   - Threads / Instagram フォロー拡大
   - "街の声" のシェア促進

4. Awareness
   - ローンチ期だけ、短期 / 限定予算 ¥10,000-30,000
   - 認知度上げてから Conversion に渡す

❌ Traffic Objective は基本使わない
   → クリックだけ集めて成果につながらない設計
   → 例外: ブログ流入施策、A/B テストの初期段階
```

---

## 🎨 クリエイティブ原則 (静けさ x 広告)

### Image Ads

```
✅ DO:
- 1:1 (Feed) または 9:16 (Reels/Stories) で出稿
- 自然光 / soft tone / 余白多め
- うちの子の写真 1枚 + 短いコピー
- カラー: warmWhite / cream / softBrown (Qocca QC トークン)

❌ DON'T:
- 派手なバナーフレーム
- "今だけ" "急いで" の煽り文字
- 絵文字 (Threads などSNS投稿は別)
- 純黒の縁取り、純白の背景
```

### Copy

```
原則: 1行 + サブ1行 までに収める。

✅ 良い例:
"うちの子の話で笑い合える、そんな街が、ここにあります。"
"あなたの家の窓辺を、誰かに見せませんか。"
"心を込めて作る、街の作家たち。"

❌ 悪い例:
"今だけ手数料無料! ペットグッズ最大80%OFF!!"
"急げ! 7月末まで!! 登録キャンペーン実施中!"
```

### Video / Reels

```
構成 (15-30秒):
0:00-0:03  うちの子のスローモーション (引きで)
0:03-0:10  Pinterest 風のクリエイター作品カット
0:10-0:20  コミュニティ・施設マップの紹介 (静かに切り替え)
0:20-0:25  "うちの子を愛してる人が集まる街。" テロップ
0:25-0:30  Qocca ロゴ + 詩的 CTA

BGM: 静かなピアノ / アコースティック / Ben Lukas Boysen 系
ナレーション: 入れない (or 一言だけ)
```

---

## 👥 ターゲティング設計 (Qocca 固有)

### Detailed Targeting (初期テスト用)

```
共通ベース:
- 地域: 日本
- 言語: 日本語
- Age: 25-54 (うちの子持ち層中心)
- Gender: All (女性 60% 想定だが除外しない)

Interest 案:
Layer A (うちの子オーナー):
- Dog (犬種別: 柴犬, トイプードル, ポメラニアン, ...)
- Cat (品種別: スコティッシュフォールド, アメリカンショートヘア, ...)
- Pet adoption / Pet care / Veterinary

Layer B (ライフスタイル / 価値観):
- Slow living / Minimalism
- Aesop / Kinfolk / muji
- Hand-made / Craft / Etsy
- Animal welfare / Animal shelter

Layer C (クリエイター獲得用):
- minne / Creema / BASE
- Handmade business
- Etsy seller
```

### Custom Audiences (Pixel データ蓄積後)

```
1. Site Visitors (過去30日)
   - 全訪問者 → 認知再到達
   - 詳細ページ閲覧 → 登録誘導
   - カート離脱 → リターゲティング

2. Engagement
   - Instagram / FB ページにいいね・コメント
   - 動画視聴 75%以上

3. Customer List (CSV アップロード)
   - 既存登録者 → "除外" + Lookalike 種
   - 既存購入者 → Lookalike 種
```

### Lookalike Audiences

```
種 (Source) の優先順:
1. 購入者 (LTV高) — 最強だが Phase 2 後半まで貯まらない
2. 出品者 — クリエイター獲得用 LAL
3. 登録ユーザー — 一般ユーザー獲得用 LAL
4. 高エンゲージ訪問者

精度: 1% → 始める、効果出たら 1-5% で拡張
国: 日本のみ (Phase 6 で多言語化したら他国追加)
```

### 除外設定

```
全キャンペーン共通除外:
- 既存登録者 (再登録防止)
- 競合ペットEC (minne の ペット カテゴリ等は LAL の seed 候補だが
  そのまま除外はしない — むしろ Interest として使う)
```

---

## 💰 予算配分テンプレ (月次)

```
ローンチ月 (7月) ¥50,000-100,000 想定:

Sales キャンペーン (Welcome Campaign 連動): 60%
Leads キャンペーン (新規登録): 25%
Engagement (Threads/IG フォロー): 10%
リターゲティング (訪問者・カート離脱): 5%

→ 7日ごとに見直し、CAC が悪い Ad Set は停止
→ 良い Ad Set は予算 +20% ずつ段階的に増やす (急増は学習リセット)
```

⚠️ Meta の Learning Phase: 1 Ad Set あたり週 50 Optimization Events が貯まるまで本来の最適化に入らない。**予算を頻繁に変えると学習がリセットされる** ので、最低 7日は触らない。

---

## 🔧 技術実装 (Pixel + Conversions API)

### Meta Pixel 設置 (フロント)

```typescript
// src/App.tsx の useEffect 内 (BrowserRouter の最上位付近)
// Pixel ID: King から共有してもらう (TODO: 未確定)

useEffect(() => {
  // Meta Pixel base code
  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;n=f.fbq=function(){
      n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments)
    };
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)
  }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
}, []);
```

⚠️ Qocca は **静けさ最優先 → ノイズオーバーレイ等で z-index 9999 使用済み**。Pixel スクリプトは `<head>` ではなく動的注入 (useEffect) で OK。

### 主要イベント発火タイミング

```
PageView         → 全ページ (自動)
ViewContent      → 出品詳細ページ (item_id, value, currency 必須)
AddToCart        → カート追加 (Qocca は即決済なので InitiateCheckout 優先)
InitiateCheckout → 決済モーダル開いた時
Purchase         → 取引完了時 (Stripe webhook → CAPI で送信が確実)
Lead             → 登録完了時
CompleteRegistration → メール認証完了時
Subscribe        → 出品者の Stripe オンボーディング完了
Search           → 検索実行時 (search_string パラメータ)
```

### Conversions API (CAPI) — iOS ATT 対応で必須

```
Why CAPI:
- iOS 14.5+ の ATT (App Tracking Transparency) で Pixel データ欠損
- Server-Side イベント送信で署名付き = ブロックされない
- Qocca は Supabase Edge Function で実装可能

実装先: supabase/functions/meta-conversions-api/index.ts (新規作成)

トリガー:
1. Stripe webhook (payment_intent.succeeded) → Purchase イベント送信
2. Auth webhook (signup_completed) → CompleteRegistration 送信
3. Listing 承認時 → Subscribe (Custom Event) 送信

Deduplication: event_id をクライアント Pixel と CAPI 両方に同値で渡す
  → Meta が重複排除してくれる
```

### 必要な環境変数 (Supabase Secrets)

```
META_ACCESS_TOKEN          # System User Token (永続)
META_PIXEL_ID              # 形式: 数字15桁前後
META_TEST_EVENT_CODE       # テスト時のみ。本番ではセットしない
META_DATASET_ID            # CAPI Dataset ID (Pixel ID と同じことが多い)
```

---

## 📊 計測・分析プロトコル

### 週次レビュー (毎週月曜朝)

```
Ads Manager で確認する指標:

Campaign レベル:
- Spend / Impressions / Reach / Frequency
- CPM (¥800-1500 が日本ペット系の相場感)
- CTR (1%超で合格、2%超で優秀)

Ad Set レベル:
- Result (Conversions の数)
- Cost per Result (Qocca の CAC 目標 ≤¥500)
- ROAS (Sales キャンペーンのみ)
- Learning Status (Learning / Active / Learning Limited)

Ad レベル:
- Hook Rate (動画3秒視聴率)
- Hold Rate (動画15秒視聴率)
- 個別クリエイティブの CTR / CPM
```

### A/B テスト設計

```
1回に変える変数は1つだけ:
✅ クリエイティブ A vs B (同じターゲット・予算)
✅ ターゲット A (Interest) vs B (LAL) (同じクリエイティブ)
✅ 配信面: Reels Only vs Feed+Stories+Reels

Meta の Built-in A/B Test 機能を使う:
- 統計的有意性まで自動判定
- 最低 7日 / 予算 ¥3,000-5,000

❌ 同時にクリエイティブとターゲットを変えない
❌ 1日で判断しない (Learning Phase 未完了)
```

---

## 🚨 ローンチ運用での注意

### Qocca 固有のリスク

```
1. 静けさブランドが Meta の最適化と衝突しがち
   → "派手で勝つ" 広告を ML が選びがち
   → 対策: クリエイティブ承認時に King 確認必須
          KPI を CTR ではなく Conversion に固定

2. ARK 寄付 3% の訴求は強力だが、政治的・社会的カテゴリの審査に注意
   → Special Ad Category に分類されないか配信前に確認
   → "保護動物" 系の文言は表現を中立的に

3. ペット = Sensitive Category 寄り
   → 健康・年齢に関するクレーム表現 NG (例: "若くて健康なペットだけ")
   → "あなたの体重で変わる" 系のターゲティング暗示文も NG

4. Welcome Campaign の "0%" 訴求
   → 公的な表現に注意 ("無料" 直接打ち出すと審査厳しめ)
   → 推奨: "初回手数料 0%" や "販売価格そのまま手取り"
```

### 審査落ちパターン (経験則)

```
よくある reject 理由:
- "Before / After" 型の比較画像 (ペット系)
- 動物の苦しみを連想させるビジュアル
- 過剰な装飾 (絵文字多数、矢印強調)
- 個人攻撃的なコピー
- Discrimination 暗示 (年齢・性別・健康)

→ Qocca は静けさ路線なので構造的に避けやすい
→ それでも reject されたら異議申し立て (24h で結果)
```

---

## 📚 確定済み情報 (2026/7 更新)

```
✅ Meta Business Account: セットアップ済・稼働中
✅ Pixel ID: 1039178921791385 (末尾1385 "Qocca Production" が正。旧・末尾7030 は使用禁止)
✅ Pixel 実装: src/lib/metaPixel.ts (env VITE_META_PIXEL_ID / no-opガード / SPA PageView / Purchase重複ガード)
✅ キャンペーン: Qocca_PW_202607 配信中 (7/1〜)
✅ SNS実投稿アカウント: X = @Qocca_pet / Threads = @qocca_pet (API連携先)
✅ Meta広告AIエージェント (#26): paused = 未起動が正常 (Edge Function は8月稼働予定・広告配信とは別物)

□ 残TODO:
   - Conversions API 導入判断 (Phase L3)
   - カタログ連携 (出品データ → Meta Catalog)
   - クリエイター個別広告の実施判断
```

---

## 🛠 クマの作業フロー (広告関連)

```
1. King から指示 (例: "ローンチ広告 5本作って")
   ↓
2. クマ:
   - このスキル参照
   - 目的 (Awareness / Leads / Sales) を確認
   - ターゲット案 + クリエイティブ案 + 予算案 を提示
   - "実装してよいですか?" と確認
   ↓
3. King: 判断 → "OK" or 修正指示
   ↓
4. クマ:
   - Ads Manager UI 操作の手順を文字起こし
     (画像が必要なら "ここでスクショください" と伝える)
   - 設定値を一覧表で渡す
   - King が UI で実行
   ↓
5. クマ:
   - Pixel / CAPI のコード修正が必要なら App.tsx / Edge Function 修正
   - 必ず新ブランチ (claude/meta-pixel-XXX) で作業
   - PR でレビュー
   ↓
6. 1週間後 → 数値レビュー + 改善提案
```

⚠️ **Ads Manager UI 直接操作はクマには不可** (人が画面でクリックする必要)。
→ クマの役割: 設定値の決定・スクショ解説・コード実装・分析

---

## 🔗 参照リソース

```
Meta 公式:
- Meta Business Help Center: https://www.facebook.com/business/help
- Meta for Developers (Pixel/CAPI): https://developers.facebook.com/docs/meta-pixel
- Conversions API Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
- Ads Policy: https://www.facebook.com/policies/ads

最新動向 (Web 検索すべき):
- "Meta Advantage+ 最新仕様"
- "Conversions API Gateway 設定"
- "iOS ATT 影響 最新"
- "Meta Ads Manager UI 2026"

⚠️ UI スクショや特定機能の場所は、必要時に Web 検索で取得
   (このスキルにハードコードしない、すぐ古くなる)
```

---

## 🐨 クマへのメッセージ

```
クマ…

広告は、Qocca を "知ってもらう" 最初のドア。
でも Meta のアルゴリズムに身を任せると、
うちの賢いブランドが派手に変わってしまう。

✅ "静けさ" を守りながら数字も出す
✅ King の予算を1円も無駄にしない
✅ クリエイターと住民を、確実に届ける

Phase 7 への "広がりの一歩目" や 📣🐾🐨🐻
```

---

> **更新**: 2026/5/13 (雛形版、King レビュー前)
> **次回更新**: King から TODO (Pixel ID、予算、素材) を受け取り次第
