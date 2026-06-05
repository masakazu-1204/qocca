# Threads 自動投稿 実装記録 (依頼書 #125)

日付: 2026/6/5 (金)
main HEAD: a139691 起算

## 構成

```
[pg_cron] threads-morning-post  30 23 * * *  UTC = 8:30 JST  (active=false)
[pg_cron] threads-evening-post  30 11 * * *  UTC = 20:30 JST (active=false)
[pg_cron] threads-token-refresh 30 18 * * *  UTC = 3:30 JST  (active=false)
              ↓ HTTP POST (pg_net)
[Edge] threads-cron-handler v9      ← 投稿 (テンプレ rotation + /v1.0/me/threads)
[Edge] threads-refresh-token v2     ← 60日トークン th_refresh_token 更新
              ↓
[DB] threads_post_templates (15本 active / NG語彙 0件)
[DB] threads_posts (status, thread_id, permalink)
[DB] social_connections (platform='threads' / access_token / token_expires_at)
[DB] admin_alerts (refresh 失敗時 warning)
```

## サンプル投稿 (実投稿 + テンプレ抜粋)

### ① 月: ビジョン (実テスト投稿成功)
`threads_posts.thread_id = 18417768694181521`
permalink: https://www.threads.net/@qocca_pet/post/18417768694181521

> 今日もお疲れさまでした🌙
> うちの子はもう寝てるかな?
> 足元でくるんと丸まった姿を見ると、 不思議と疲れが溶けていく🐾
> そんな小さな景色がある暮らしを、Qoccaで…

### ② 水: 開発の裏側 → 既存テンプレ「Qocca哲学・朝」
> 「もう一つの人生を置いておける街」🌳
> Qoccaが目指す景色です。
> 忙しい毎日のなかで、うちの子と過ごす時間だけは "住める速度を超えない" ようにしたい。

### ③ 土: 動物福祉 → 既存テンプレ「うちの子物語」
> うちの子は、おやつの袋の音にだけ 異常な反応をする🐾
> そんな些細な物語を、Qoccaは集めたい街です🌌
> ペットと暮らす日々は、 ガチで小さな奇跡の連続。

## 月額コスト試算

| 項目 | 月間使用 | コスト |
|---|---|---|
| GPT-4o-mini | 0 (テンプレ駆動、AI 生成未使用) | ¥0 |
| Threads API | 60 投稿 + 30 refresh | ¥0 (Meta 無料) |
| Supabase Edge Function | ~90 invocations × 3-7秒 | ¥0 (Free 500K 内) |
| **合計** | | **¥0/月** (目標 ¥50 を大幅下回り) |

※ 将来 GPT-4o-mini で動的生成移行時: 200トークン × 60件 × $0.15/1M = $0.0018/月 ≈ ¥0.27

## 安全機構

- `threads_post_settings.kill_switch = true` で全停止
- env `SNS_KILL_SWITCH = "true"` でも全停止 (二重ガード)
- `token_expires_at < now()` で投稿スキップ + threads_posts.status=failed
- refresh 失敗時 `admin_alerts` に severity=warning INSERT
- `/v1.0/me/threads` 推奨 endpoint 採用 (`/v1.0/{user_id}/threads` は permission error 既知)

## King 承認後の cron 有効化 SQL

```sql
SELECT cron.alter_job(job_id := 11, active := true);  -- threads-morning-post
SELECT cron.alter_job(job_id := 12, active := true);  -- threads-evening-post
SELECT cron.alter_job(job_id := 24, active := true);  -- threads-token-refresh
```

## 実装ファイル

- (deploy) supabase Edge Function `threads-cron-handler` v9 (依頼書 #38 で雛形 → #125 で /me/threads + 詳細 error)
- (deploy) supabase Edge Function `threads-refresh-token` v2 (新規 / 24時間ルール + 7日閾値 + admin_alerts 連動)
- (DB) pg_cron 3 jobs (全 disabled)
- (DB) threads_post_settings (kill_switch=false 維持)
- (DB) threads_post_templates (15 active / 0 NG / 既存維持)
