# UTM パラメータ命名規則 (Qocca v1.0)

日付: 2026/6/8
依頼書: #135 Phase B
適用範囲: Meta広告 / SNS 自動投稿 / CAMPFIRE / 各種 referral
管理ツール: Google Analytics 4 (G-CPYH7DKWFO) + Meta Pixel + 内部分析

---

## 🎯 設計原則

1. **`utm_source` = 媒体**: 「どこから来たか」(meta / x / threads / instagram / campfire / google / direct)
2. **`utm_medium` = 流入種別**: cpc (有料広告) / social (organic SNS) / referral (他媒体掲載) / email
3. **`utm_campaign` = `<purpose>_<period_or_id>`**: 期間 or キャンペーン識別 (例: `cf_traffic_202606`)
4. **`utm_content` = variation 識別**: 個別 ad / 投稿時間 / バナー位置等
5. **全て snake_case 半角英数字**: 日本語・大文字・スペース・記号 全 NG (URL エンコード崩れ防止)

---

## 📋 命名表

### utm_source (媒体 / 全部 15 個)

| 値 | 用途 |
|---|---|
| `meta` | Meta (Facebook + Instagram) 広告 |
| `x` | X (旧 Twitter) organic + 広告 |
| `threads` | Threads organic |
| `instagram` | Instagram organic (Meta広告は `meta`) |
| `campfire` | CAMPFIRE プロジェクトページからの referral |
| `google` | Google 広告 / Google 検索結果 (organic は `google_organic`) |
| `google_organic` | Google オーガニック検索 |
| `bing` | Bing 検索 |
| `yahoo_jp` | Yahoo! Japan 広告 |
| `note` | note.com 記事掲載 |
| `blog` | qocca.pet ブログ内リンク (内部) |
| `email` | メールマガジン (将来) |
| `qr` | 紙メディア・名刺の QR コード |
| `partner` | 提携先 (将来) |
| `direct` | 直接アクセス (UTM なし時のデフォルト) |

### utm_medium (流入種別 / 全部 7 個)

| 値 | 用途 |
|---|---|
| `cpc` | クリック課金広告 (Meta / Google / Yahoo) |
| `social` | organic SNS 投稿 |
| `referral` | 他媒体からの自然リンク |
| `email` | メールマガジン |
| `display` | バナー広告 |
| `affiliate` | アフィリエイト (将来) |
| `print` | 紙媒体 (QR コード経由) |

### utm_campaign (期間 + 目的)

書式: **`<purpose>_<YYYYMM>`** または **`<purpose>_<reward_id>`**

| 例 | 用途 |
|---|---|
| `cf_traffic_202606` | クラファン期間中 1段ロケット (6月) |
| `dday_cv_202607` | Dday 7/1 CV 最適化 2段ロケット (7月) |
| `dday_cv_202608` | 同 (8月分) |
| `creator_invite_202607` | クリエイター招待広告 |
| `reward_creator_8000` | CAMPFIRE 創業クリエイター 8000 リターン誘導 |
| `reward_supporter_3000` | CAMPFIRE 支援者 3000 リターン誘導 |
| `organic_202606` | SNS organic (期間で識別 / 個別投稿は utm_content) |
| `blog_inflow` | ブログ → 個別 LP への内部誘導 |

### utm_content (variation 識別)

| 例 | 用途 |
|---|---|
| `morning_post` | SNS organic 朝投稿 |
| `evening_post` | SNS organic 夜投稿 |
| `hero_v1` | 広告クリエイティブ A |
| `hero_v2` | 広告クリエイティブ B |
| `tx_recruit` | 募集系テキスト |
| `tx_lifestyle` | 暮らし系テキスト |
| `ad_set_a` / `ad_set_b` | 広告セット A/B テスト |

---

## 📋 完全例 (12 パターン)

### Meta 広告

```
https://qocca.pet/?utm_source=meta&utm_medium=cpc&utm_campaign=cf_traffic_202606&utm_content=hero_v1
https://qocca.pet/?utm_source=meta&utm_medium=cpc&utm_campaign=dday_cv_202607&utm_content=ad_set_a
https://qocca.pet/?utm_source=meta&utm_medium=cpc&utm_campaign=creator_invite_202607&utm_content=hero_v2
```

### SNS organic (Threads / Instagram / X)

```
https://qocca.pet/?utm_source=x&utm_medium=social&utm_campaign=organic_202607&utm_content=morning_post
https://qocca.pet/?utm_source=threads&utm_medium=social&utm_campaign=organic_202607&utm_content=tx_recruit
https://qocca.pet/?utm_source=instagram&utm_medium=social&utm_campaign=organic_202607&utm_content=evening_post
```

### CAMPFIRE referral

```
https://qocca.pet/?utm_source=campfire&utm_medium=referral&utm_campaign=reward_creator_8000
https://qocca.pet/redeem?utm_source=campfire&utm_medium=referral&utm_campaign=reward_supporter_3000
```

### Google organic / 検索広告

```
https://qocca.pet/?utm_source=google&utm_medium=cpc&utm_campaign=dday_cv_202607
https://qocca.pet/?utm_source=google_organic&utm_medium=referral&utm_campaign=seo_pet_marketplace
```

### Email / QR / Print

```
https://qocca.pet/?utm_source=email&utm_medium=email&utm_campaign=newsletter_202608
https://qocca.pet/?utm_source=qr&utm_medium=print&utm_campaign=flyer_202609_osaka
```

---

## 📋 SNS 自動投稿への段階適用 (将来)

現在の SNS 自動投稿テンプレ (X / Threads / Instagram) のリンクは `https://qocca.pet` を単純に貼っている。
今後 UTM を段階適用する場合:

### Phase 1 (今すぐ可): テンプレ末尾固定 UTM

各テンプレの `qocca.pet` を `qocca.pet/?utm_source=<media>&utm_medium=social&utm_campaign=organic_YYYYMM` に置換。

実装場所:
- `threads_post_templates` (15本)
- `x_post_templates` (46本)
- `instagram_post_templates` (7本)

```sql
-- 例: Threads テンプレに utm 付与
UPDATE threads_post_templates
SET template = REPLACE(template, 'qocca.pet', 'qocca.pet/?utm_source=threads&utm_medium=social&utm_campaign=organic_202607')
WHERE is_active=true;
```

### Phase 2 (Edge Function 拡張): 投稿時に動的 utm_content 付与

- `threads-cron-handler` / `x-cron-handler` / `instagram-cron-handler` 内で投稿テンプレ取得後に URL を加工
- utm_content = 時刻 (`morning_post` / `evening_post`) や テーマ key (`tx_recruit` 等)

→ 推奨: **Phase 1 から開始** (運用負荷低 / 月初に campaign 値だけ更新)

---

## 📊 計測フロー

```
[広告クリック] qocca.pet/?utm_source=meta&utm_medium=cpc&utm_campaign=cf_traffic_202606
    ↓
[GA4] 自動的に utm_* を session 属性として記録
    ↓
[Meta Pixel] PageView 発火 (utm_* は Meta 側で自動取得)
    ↓
[ユーザー行動] 商品閲覧 → ViewContent → 購入 → Purchase
    ↓
[計測] 
    GA4: トラフィック → イベント → CV を utm_campaign 別に集計
    Meta: イベントマネージャ → 広告キャンペーン別 CV
```

---

## ⚠️ 禁止事項

- ❌ 日本語 UTM (`utm_campaign=創業クリエイター`) → エンコード崩れ
- ❌ 大文字混在 (`utm_source=Meta`) → GA4 が別チャネル扱い
- ❌ スペース (`utm_campaign=cf traffic 202606`) → 一部 SNS で URL 切れる
- ❌ utm_campaign を毎日変える → データ細分化しすぎて分析不可能 (月単位推奨)
- ❌ 同一広告で複数 utm_content を試さず単一値固定 → A/B 評価不能

---

## 🛡️ プライバシー配慮

- UTM パラメータは個人情報を含まない (媒体・campaign・content のみ)
- ユーザー識別子・email・氏名・住所は **絶対に utm に含めない**
- Privacy Policy に「アクセス解析のため utm 等のパラメータを取得する」記載済

---

## 改訂履歴

- 2026/6/8 (依頼書 #135 Phase B) v1.0 初版
