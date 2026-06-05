# Instagram 自動投稿 実装記録 (依頼書 #126)

日付: 2026/6/5 (金)
main HEAD: 1173672 起算 (Phase 0 #126 完了後)

## 構成

```
[pg_cron] instagram-morning-post     0 3 * * *  UTC = 12:00 JST  (active=false)
[pg_cron] instagram-token-refresh   30 18 * * *  UTC = 3:30 JST  (active=false)
[pg_cron] instagram-storage-cleanup  0 19 * * *  UTC = 4:00 JST  (active=false)
                ↓ HTTP POST (pg_net)
[Edge] instagram-cron-handler v1   ← テンプレ rotation + gpt-image-1 生成 → Storage → invoke
[Edge] post-to-instagram v3        ← graph.instagram.com/v21.0/{ig}/media + media_publish
[Edge] instagram-refresh-token v1  ← ig_refresh_token (24h ルール + 7日閾値 + admin_alerts)
                ↓
[DB] instagram_post_templates (v2: 7本 active 豆知識系 + 7本 inactive 旧ブランド系 / NG語彙 0件 / day_of_week 0-6 全曜日)
[DB] instagram_posts (status, media_id, permalink, cost_usd)
[DB] social_connections (platform='instagram' / 60日トークン)
[DB] admin_alerts (refresh 失敗時 warning)
[Storage] x-images/auto-instagram/*.png (30日自動削除 cron)
```

## v2 (依頼書 #126 v2 / King 方針反映): 豆知識・実用情報系 + リアル系画像

### 曜日テーマ (1日1回 12:00 JST)
| 曜日 | テーマ | day_of_week |
|---|---|---|
| 月 | 健康・肉球ケア | 1 |
| 火 | ごはん・NG食材 | 2 |
| 水 | しつけ・暮らしの工夫 | 3 |
| 木 | 季節の注意・体調管理 | 4 |
| 金 | グッズ・ブラッシング | 5 |
| 土 | 動物福祉・保護動物 | 6 |
| 日 | 豆知識総合・平熱 | 0 |

### 安全ルール (テンプレ全件適用済)
- 断定回避: 「〜と言われています」「〜が一般的です」
- 健康・食事系には 「気になる場合は獣医師にご相談ください」を添える
- 投薬量・治療法など誤情報リスクの高い断定は扱わない
- NG 語彙 0件 (バズ/No.1/最強/今だけ/急成長/爆発/絶対/100%/必ず/お得/激安/永久/永遠/無期限)
- 画像プロンプト: v3 で 飼い主スマホスナップ風 photorealistic / 自然光 / 文字なし (誤字リスク回避)

### 画像プロンプト 3 段階進化

| Ver | スタイル | 残課題 |
|---|---|---|
| v1 (初版) | warm pastel / Japanese illustration | Threads と方向性被り |
| v2 (King 方針1) | photorealistic / 自然光 / soft warm tones | まだ水彩寄りの仕上がり |
| **v3 (King 方針2 最終)** | **candid smartphone photo by pet owner / Japanese home interior / shallow DOF / no staging / NOT watercolor/illustration/anime/pastel/painting** | スタジオ撮影感ゼロ・ギャラリー投稿テイスト |

v3 共通プロンプト構造 (全7本):
```
Candid smartphone photo taken by a pet owner: [テーマ別シーン], 
soft natural window light, shallow depth of field, warm everyday tones,
authentic everyday moment, no staging, no text overlay.
Photorealistic, NOT watercolor, NOT illustration, NOT anime, NOT pastel, NOT painting.
```

### サンプル投稿 (3 バージョン目視比較用)

#### ① v3 金: グッズ・ブラッシング (最新テスト投稿 ✨ 飼い主スマホスナップ風)
- **permalink**: **https://www.instagram.com/p/18062903696472460/**
- image_url: https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/x-images/auto-instagram/1780620056192-_____________.png

#### ② v2 金: グッズ・ブラッシング (前回テスト・水彩寄り)
- **permalink**: https://www.instagram.com/p/18110638616478828/
- **image_url**: https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/x-images/auto-instagram/1780618969112-_____________.png
- caption:
> 🐾 【ブラッシングの豆知識】
> 毛並みの長さや種類によって、 おすすめのブラシは変わると言われています🪮
> 短毛種はラバーブラシ、 長毛種はピンブラシが 一般的です🌿
> お手入れの時間は、 うちの子の体調を観察する 大切な瞬間でもありますね🐾
> 詳しくは qocca.pet のブログへ
> #ブラッシング #ペットのお手入れ #犬猫 #愛犬グッズ #Qocca

#### ② 月: 健康・肉球ケア (テンプレ)
> 🐾 【肉球ケアの豆知識】
> 夏が近づくと、 アスファルトは体感より熱くなると 言われています☀️
> お散歩前に 手の甲で地面の温度を確認すると、 肉球を守りやすいです🐕
> 気になる赤みやひび割れがある場合は、 動物病院でご相談ください🌿
> #犬の健康 #肉球ケア #ペットと暮らす #犬のいる暮らし #Qocca

#### ③ 火: ごはん・NG食材 (テンプレ)
> 🐾 【知っておきたい NG 食材】
> 玉ねぎ・チョコレート・ぶどう・アボカドなどは、 ペットに与えてはいけない食材として 知られています🚫
> うちの子の口に入りやすい場所にないか、 こまめにチェックしておきたいですね🐕🐈
> もし誤って口にした場合は、 すぐに獣医師にご相談ください🌿
> #犬の食事 #猫の食事 #NG食材 #ペットの健康 #Qocca

### 旧 v1 (依頼書 #126 初版・実装直前差し替え)
- 旧 7本 (ブランド系: Qocca哲学・うちの子・クリエイター応援 等) は `is_active=false` で保持 (instagram_posts.template_id FK 維持)
- 旧テスト投稿: https://www.instagram.com/p/18112219478309297/ — King 判断で手動削除可

## 月額コスト試算

| 項目 | 月間使用 | コスト |
|---|---|---|
| gpt-image-1 (medium 1024×1024) | 30 枚 × $0.04 | $1.20 ≈ ¥190 |
| GPT-4o-mini キャプション生成 | 0 (テンプレ駆動) | ¥0 |
| Instagram Graph API | 30 投稿 + 30 refresh | ¥0 (Meta 無料) |
| Edge Function | ~90 invocations × 60-90秒 | ¥0 (Free 500K 内) |
| Storage (30日自動削除) | ~30 × 800KB ≈ 24MB pool | ¥0 (Free 1GB 内) |
| **合計** | | **¥190/月** (依頼書目安 ¥50-200 内 ✅) |

## Phase C 採用判断: instagram-refresh-token 単独 (threads と統合せず)

**理由**:
- 別 API endpoint: `graph.instagram.com` vs `graph.threads.net`
- 別 grant_type: `ig_refresh_token` vs `th_refresh_token`
- 別 admin_alerts カテゴリ: `sns_instagram_refresh` vs `sns_threads_refresh`
- 統合だと条件分岐だらけで保守性低下 → 横展開コピー方式が読みやすい (X #29 と同パターン)

## 安全機構

- `instagram_post_settings.kill_switch = true` で全停止
- env `SNS_KILL_SWITCH = "true"` でも全停止 (二重ガード / post-to-instagram も独立チェック)
- `token_expires_at < now()` で投稿スキップ + instagram_posts.status=failed
- refresh 失敗 → `admin_alerts` に severity=warning INSERT (#118 連携)
- 30日経過画像自動削除 (Egress / 容量超過防止 #119 教訓)
- 文字なし画像生成プロンプト (誤字リスク回避)

## King 承認後の cron 有効化 SQL

```sql
SELECT cron.alter_job(job_id := 13, active := true);  -- instagram-morning-post (12:00 JST)
SELECT cron.alter_job(job_id := 25, active := true);  -- instagram-token-refresh (3:30 JST)
SELECT cron.alter_job(job_id := 26, active := true);  -- instagram-storage-cleanup (4:00 JST)
```

## 実装ファイル

- (deploy) supabase Edge Function `instagram-refresh-token` v1 (新規)
- (deploy) supabase Edge Function `instagram-cron-handler` v1 (既存維持)
- (deploy) supabase Edge Function `post-to-instagram` v3 (既存維持)
- (DB) instagram_post_templates 7本 INSERT (NG語彙 0件)
- (DB) pg_cron 3 jobs (全 disabled / evening-post jobid 14 削除)

## 4 媒体並行 自動運用 (#125 + #126 完成形)

| 媒体 | 投稿時刻 (JST) | テンプレ | コスト/月 |
|---|---|---|---|
| X (#16 v2) | 8:00 / 20:00 | 46本 + gpt-image-1 画像 | ~¥200 |
| Threads (#125) | 8:30 / 20:30 | 15本 (テキストのみ) | ¥0 |
| Instagram (#126) | 12:00 | 7本 + gpt-image-1 画像 | ¥190 |
| Blog (Phase 3a) | 月 12 本 | gpt-4o + DALL-E | ~¥91 |
