---
name: qocca-sns-content-ops
description: SNS投稿 (ネタ画像・ネタ動画・おちゃ動画) の制作手順・コスト・自動投稿の仕組み・在庫の見方。SNS素材を作る/増やす/動かす/投稿を調べる作業の前に参照。動画モデルは Seedance 2.0 Mini (12.5) が既定で 2.5 (32.5) は使わない。
---

# 🎬 Skill 06: SNS コンテンツ運用 (制作・自動投稿・在庫)

> ネタ画像・ネタ動画・おちゃ動画を「作る → 仕上げる → 登録する → 自動で流れる」までの
> 確立済みの手順。2026/9/6〜8 の作業で固めた。**ここに無いやり方を試す前に King に聞く。**
> おちゃ (キャラ) の設定そのものは `docs/Qocca動画制作バイブル.md` §16-15 が正典。

---

## 🗺 全体像

```
ネタ画像  sns_neta_posts   → sns-neta-cron-handler   毎日 06:00 UTC (15:00 JST)  X / Threads / Instagram
動画      sns_video_assets → sns-video-cron-handler  毎日 09:00 UTC (18:00 JST)  Threads / Instagram
                                 ↑ どちらも GUARD_HOURS=46 で「実質2日に1本」
                                   (48 だと投稿API完了の約90秒遅れで 47:58 になり3日に1本になっていた → #164)
在庫監視  check_sns_stock()  毎日 16:20 UTC。未使用が残り14日分を切ると admin_alerts に warning、6日で critical
Storage   sns-neta/ (画像 = ルート直下 *.webp、動画 = video/*.mp4、おちゃ素材 = quokka/)
```

**どちらの cron も `use_count = 0` のものしか選ばない。** 尽きたら `step:"depleted"` で静かに止まる
(だから在庫監視がある)。cron の `succeeded` は「HTTP を投げた」までの意味で、投稿の成否ではない。

在庫の確認:
```sql
select
  (select count(*) from sns_neta_posts   where is_active and use_count=0) as img_left,
  (select count(*) from sns_video_assets where is_active and use_count=0) as vid_left;
-- 残り本数 × 2 = あと何日もつか
```

---

## 💰 コスト (Higgsfield / クレジット)

```
Nano Banana (画像)        1   /枚   ネタ画像はこれ
outpaint_image (画像)     2   /枚   16:9 → 9:16 に「描き足して」広げる
Seedance 2.0 Mini (動画)  12.5 /本   ★既定。静止画を動かす用途はこれで十分 (King 確認済)
Seedance 2.0 fast         17.5 /本   おちゃ動画の正典設定 (5秒×3カット = 52.5)
Seedance 2.5              32.5 /本   ✗ 使わない。2026/8/24-25 に43本まわして約1,370溶けた
Kling 3.0 Turbo           7.5 /本    安いが 2026/8/31 にキューから20分以上返らず、実質使えなかった
```

**作る前に `balance` で残高を見る。大量生成の前に必ず1本テストして King に見せる。**
Max プランの月枠は 1,800。

---

## 🖼 ネタ画像を作る

**型: 「動物は自然な姿のまま、人間の場所にいる」。** 擬人化せず、状況だけで笑わせる。
「横一列に整列」「順番待ち」「1匹だけ中央」が強い。文字は絶対に入れない。

```
Photorealistic. [場所の描写]. [動物 N匹] [自然な姿勢] ... with completely serious faces.
Natural photography, warm light, shallow depth of field, 50mm lens.
Ordinary [dogs/cats] in natural poses, not anthropomorphic, not standing on two legs.
No text, no signage lettering, no people.
```

- **服**: アイドル・巫女・制帽・前掛けなど「服が本体」の絵は着せると強い。リアルさが売りの絵 (整列・寝顔) は
  裸のほうが強い (着せると作り物っぽくなる)。**Qocca はペット服を売っているので、服ありは商品訴求にもなる。**
- 出力は 16:9 (1344x768)。`sharp` で webp q88 に変換して Storage `sns-neta/` 直下へ
  (`scripts/upload-neta-batch4.mjs` が雛形。命名 `neta_[番号2桁]_[key]_a.webp`)
- DB 登録 (MCP で INSERT。4〜5件ずつに分け、最後に単独 SELECT で件数を検証):
```sql
insert into sns_neta_posts (slot_no, image_path, caption, hashtags, sort_order) values
('48','neta_48_xxx_a.webp', E'一言セリフ🍁（ツッコミ）\n\nQoccaへの誘導文。\n#Qocca #犬種 #テーマ #犬のいる暮らし', array['Qocca','犬種'], 47);
```
  キャプションの型: `セリフ+絵文字（ツッコミ）` / 空行 / `うちの子の◯◯顔、Qoccaで。` / ハッシュタグ4つ。

---

## 🎥 ネタ画像を縦動画にする (確立済み・14本実績)

**切らない。描き足す。** 9:16 に中央クロップすると幅の 68% が消えて「8匹の整列」が4匹になる。
outpaint は上下を描き足すので全員残る (むしろ余白が効いて良くなるものもある)。

```
1. media_import_url    公開URL (Storage の webp) を取り込む → media_id
2. outpaint_image      { image_id, aspect_ratio: "9:16" }               … 2
3. generate_video_batch model: seedance_2_0_mini / aspect_ratio: "9:16"
                       medias: [{ role: "start_image", value: <outpaint の job_id> }] … 12.5
                       プリセット推奨で差し戻されたら declined_preset_id を付けて同じプロンプトで再送
4. node scripts/finalize-video.mjs <raw.mp4> <out.mp4>   音量正規化・ビットレート調整
5. node scripts/upload-neta-video.mjs <out.mp4> <名前.mp4> → sns-neta/video/
6. sns_video_assets に INSERT (title 'ネタ｜〜', aspect_ratio '9:16', duration_sec 5, source 'higgsfield',
   platforms array['threads','instagram'], is_active true)
7. 元の静止画を sns_neta_posts で is_active=false にする  ← 忘れると同じネタが2回出る
```

**動かし方の原則: 動物は動かさず、環境とカメラだけ動かす。**「動かないこと」が笑い。
湯気・落ち葉・光・ペンライト・ゆっくり寄る。プロンプトは
`Live-action photographic footage. ...` で始め `... No text, no captions.` で締める。

**動画化は在庫を増やさない。画像キューから動画キューへ移すだけ。** 総数は同じで質が上がる。
静止画のほうが強い構図 (旅館の整列・お昼寝・握手会・楽屋) は動画にしない — 意図して混ぜる。

落とし穴:
- 子犬の滑り台 (公園) が安全フィルタで `nsfw` 判定された。無理に通す言い換えはしない
- Instagram は約 10,000 kb/s 超の動画を弾く。finalize-video.mjs を必ず通す
- `verify_jwt=false` の Edge Function を再デプロイするときは **必ず false のまま**。true にすると cron が全部 401 で沈黙する

---

## 🐹 おちゃ動画

設定・素材・生成パラメータは **`docs/Qocca動画制作バイブル.md` §16-15** と Storage `sns-neta/quokka/` が正典。
芯は「真顔で全力」、しゃべらない・文字を入れない、不幸に見える絵は作らない。
5秒×3カット (振り→実行→結果)、Seedance 2.0 fast / 720p / bitrate high / audio on。
**季節ものは在庫を先に確認する** — 2026/9 は月見団子が既に在庫にあった (is_active=false で寝かせ、
9/25 17:00 JST に `video_id` 指定の一回限り cron `sns-video-tsukimi-2026` で出す)。
`video_id` 指定は `is_active` を見ないので、寝かせたまま狙った日に出せる。

---

## 🔧 手で確かめる / 手で出す

```bash
# 投稿せず「次に何が選ばれるか」だけ見る
curl -s -X POST https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/sns-neta-cron-handler  -H "Content-Type: application/json" -d '{"test_mode":true}'
curl -s -X POST https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/sns-video-cron-handler -H "Content-Type: application/json" -d '{"test_mode":true}'
# 特定の動画を今すぐ出す (間隔ガードを通り抜ける)
#   body: {"video_id":"<uuid>"}
```

投稿の実績は `sns_video_uses.posted_at` / `sns_neta_posts.last_used_at`、失敗は
`instagram_posts` `threads_posts` `x_posts` の `status` / `error_message`。
