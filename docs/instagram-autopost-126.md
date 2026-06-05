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
[DB] instagram_post_templates (7本 active / NG語彙 0件 / hashtags + image_prompt)
[DB] instagram_posts (status, media_id, permalink, cost_usd)
[DB] social_connections (platform='instagram' / 60日トークン)
[DB] admin_alerts (refresh 失敗時 warning)
[Storage] x-images/auto-instagram/*.png (30日自動削除 cron)
```

## キャプションサンプル 3本 + 画像 1枚

### ① クリエイター応援 (実投稿成功 ✨)
- **permalink**: https://www.instagram.com/p/18112219478309297/
- **image_url**: https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/x-images/auto-instagram/1780618340434-________.png
- caption:
> Qoccaには、想いを込めた作品を 置いてくださっているクリエイターさんが居ます🎨
> うちの子の似顔絵、手作りグッズ、想い出グッズ。
> ひとつひとつが "暮らしの灯" です🌿
> 👉 qocca.pet
> #Qocca #クリエイター #ペットグッズ #うちの子グッズ #ハンドメイド

### ② うちの子おはよう (テンプレ)
> おはようございます🌅
> 今日も窓辺で日向ぼっこ☀️
> ペットと暮らす朝の景色は、何度見ても飽きへんなぁ🐾
> 👉 qocca.pet
> #Qocca #うちの子 #おはよう #日向ぼっこ #朝の景色

### ③ ARK連携 - 動物福祉 (テンプレ)
> Qoccaの売上の 3% は ARK さんを通じて、 保護動物さんたちへ届きます🐾
> 小さな循環が、 街の灯をつくる🌿
> 👉 qocca.pet
> #Qocca #ARK #動物福祉 #保護犬 #保護猫

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
