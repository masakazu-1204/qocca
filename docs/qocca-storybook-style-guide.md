# Qocca 絵本シリーズ 公式スタイルガイド v1.0

日付: 2026/6/10
依頼書: #141
位置づけ: TikTok / Instagram Reels / YouTube Shorts / 将来の絵本コンテンツ における **画風・世界観の不変の土台 (資産)**
目的: AI 生成絵本動画の量産時に「画風のブレ」を構造的に防止
管理: King 確定 / 改変は King 承認必須 (本書のマスタープロンプトは特に **改変禁止**)

---

## 📜 序文: なぜスタイルガイドが必要か

TikTok / Shorts における AI 生成絵本動画は、**画風統一が量産の生命線**。
参考事例 `@coco_dog852` は AI 生成絵本で 13.2万いいね を獲得しているが、その成功要因の一つは「シリーズ全話を通じた画風の完全統一」。

Qocca 絵本シリーズも同じ原則で運用するため:
- ✅ マスタープロンプトを 1 箇所で固定 (= 本書セクション1)
- ✅ シーン指定は 1 行のみ追加 (それ以上の改変禁止)
- ✅ キャラクター・色・構図・世界観 を本書で永続定義
- ✅ 将来 (Phase 2 以降) はクマが本書を読んで動画量産パイプライン化

---

## 🎨 セクション1: マスタープロンプト (全シリーズ共通 / 先頭固定 / 改変禁止)

⚠️ **以下の英文は gpt-image-1 用に最適化されたマスタープロンプト**。
⚠️ **改変禁止**。コピペで毎回先頭に貼り付け、その後にシーン指定を1行だけ追加する運用。

### --- 共通スタイル ---
```
Watercolor storybook illustration. Soft watercolor and colored pencil texture.
Warm nostalgic atmosphere.
Color palette: beige, off-white, muted orange, warm sunlight, soft wood tones.
Gentle natural lighting. Emotional facial expressions. Hand-painted feeling.
No AI-art look. No sharp outlines. No anime exaggeration. No photorealism.
No 3D rendering. No bright saturated colors.
```

### --- キャラクター固定 ---
```
A small-to-medium mixed breed dog. Cream and light caramel fur. Round eyes.
Soft floppy ears. Gentle and expressive face.
The same dog must appear throughout the entire series.
Consistent character design. Consistent proportions. Consistent fur color.
Consistent illustration style.
```

### --- 構図 ---
```
Vertical composition. 9:16 aspect ratio. Lots of negative space.
Simple background. Focus on emotion and storytelling.
Comfortable reading flow. Leave room for captions. No text inside the image.
```

### --- 世界観 ---
```
A quiet life shared between pets and people.
Warm memories. Trust. Kindness. Forgiveness. Belonging. Home. Companionship.
The feeling of: "Living together."
```

### --- NG項目 ---
```
No text. No logos. No watermark. No modern UI elements. No social media elements.
No speech bubbles. No exaggerated cartoon style. No overly detailed background.
No strong contrast. No dark horror mood. No sadness without hope.
```

### --- Qocca DNA ---
```
The image should feel like:
"A memory someone never wants to forget."
and "A small story shared between a pet and its family."
```

---

## ⚙️ セクション2: 運用ルール

### 2-1. プロンプト構成 (毎回同じ手順)

1. **セクション1 のマスタープロンプト全文** を先頭に貼り付け (改変ゼロ)
2. **シーン指定 1 行** を末尾に追加 (英語推奨)
3. gpt-image-1 で生成 (size: `1024x1792` 推奨 = 9:16 縦)

### 2-2. シーン指定の例文 (英語)

```
Waiting at the front door for their owner to come home.
Walking together during sunset.
The dog's first day in a new home.
A rescue dog meeting their new family.
Sleeping curled up next to their owner.
Watching rain from a sunny window.
The owner kneeling down to hug the dog after a long day.
Sharing a small piece of bread on a picnic blanket.
Looking up at the owner with hopeful eyes.
A quiet walk down a familiar street at dawn.
```

→ シーンによって 1 行追加だけ。それ以上の改変は **禁止** (画風がブレる原因)。

### 2-3. テロップは後乗せ (CapCut 等)

- ✅ **画像内には絶対に文字を入れない** ("No text inside the image" を厳守)
- ✅ 日本語テロップは **CapCut / VLLO / iMovie** 等で後乗せ
- 理由:
  1. AI の日本語文字は化けるリスクが極めて高い
  2. テロップ修正・差し替えが自由 (画像再生成不要)
  3. 量産時の工程分離 (画像生成 ≠ テロップ作業 / 並列化可)

### 2-4. 推奨設定

| 項目 | 値 |
|---|---|
| 生成 API | OpenAI gpt-image-1 |
| サイズ | **1024x1792** (= 9:16 縦 / TikTok Shorts Reels 共通) |
| 1枚あたりコスト | 約 $0.040 ~ $0.080 (HD) |
| 1動画 (10枚 / 1分) コスト | 約 $0.40 ~ $0.80 |
| 1シリーズ (10話 × 10枚) コスト | 約 $4 ~ $8 |

### 2-5. 量産パイプライン (Phase 2 以降 / 将来クマ実装)

- Edge Function 新規: `generate-storybook-frames`
  - 入力: テーマ key (例: `walking`) + シーン配列
  - 動作: マスタープロンプト + 各シーン指定で 10枚生成 → Supabase Storage 保存
  - 出力: 画像 URL 10件 + メタデータ
- 動画化 (CapCut) は当面手動 / 完全自動化は Phase 3 以降検討

---

## 📚 セクション3: テーマ・ストック (King 確定 10テーマ)

### 軽め (頻度高め / 量産推奨)
| # | テーマ | 雰囲気 | 推奨頻度 |
|---|---|---|---|
| 1 | 散歩 | 日常の幸せ / リズム | 週 1-2 本 |
| 2 | お留守番 | 待つ時間 / 信頼 | 週 1 本 |
| 3 | 初めての家 | 新しい始まり / 希望 | 月 1-2 本 |
| 4 | 病院 | 不安 → 安心 / 寄り添い | 月 1 本 |
| 5 | 犬から見た飼い主 | 視点転換 / 愛情 | 月 2 本 |
| 6 | 生まれ変わり | 再会 / 巡り合わせ | 月 1 本 |

### ⚠️ 喪失系 (頻度抑えめ / 取扱注意)
| # | テーマ | 雰囲気 | 推奨頻度 |
|---|---|---|---|
| 7 | 老犬 | 加齢 / 大切な時間 | 月 1 本 (注意深く) |
| 8 | 虹の橋 | 別れ / 再会への願い | 月 1 本まで (連続投稿禁止) |
| 9 | 保護犬 | 救い / 希望 | 月 1-2 本 |
| 10 | 最後の日 | 喪失 | **2-3ヶ月 1 本まで** (連続投稿禁止 / コメント欄ケア必須) |

### 喪失系 取扱原則 (重要)
1. **連続投稿しない** (例: 「虹の橋」「最後の日」を連日投稿は NG)
2. **「希望なしの悲しみ」は禁止** (マスタープロンプト NG項目 `No sadness without hope` 厳守)
3. キャプションでは「思い出す」「忘れない」など **前向きな視点** で
4. コメント欄でペットロス相談が来たら **獣医師 / カウンセラー紹介** (依頼書 #29 ペットロス対応研究と整合)
5. 投稿後 24時間 はコメント欄を定期確認 (King + 創業期メンバー運用)

---

## 🎬 セクション4: 第1話 確定パッケージ「散歩が好きな理由」

⚠️ シーン10枚 + テロップ + キャプション + ハッシュタグ の完全パッケージ (King 確定済の想定でドラフト / 実投稿前に King 最終確認)。

### 4-1. シーン別プロンプト 10枚

各シーンは「セクション1 のマスタープロンプト全文」+ 下記 1 行 で生成。

| # | 秒数 | シーン指定 (英語 / 末尾追加) | 意図 |
|---|---|---|---|
| 1 | 0-6s | `A small dog watching the front door, ears perked up, hopeful and waiting expression.` | 散歩の予感 / 期待 |
| 2 | 6-12s | `The dog sitting next to a leash hanging on the wall, looking up with gentle eyes.` | 散歩道具への注目 |
| 3 | 12-18s | `The owner kneeling down to attach the leash to the dog's collar, both calm and happy.` | 出発の準備 |
| 4 | 18-24s | `The dog walking out the front door into soft morning sunlight, owner following behind.` | 一歩外へ |
| 5 | 24-30s | `The dog sniffing flowers along a familiar street, tail gently wagging.` | 馴染みの匂い |
| 6 | 30-36s | `The dog and owner stopping to greet a neighbor, dog's friendly expression.` | 街との繋がり |
| 7 | 36-42s | `The dog looking up at the owner with bright eyes, sunlight warming their fur.` | 信頼の眼差し |
| 8 | 42-48s | `The dog and owner walking side by side along a quiet path, soft afternoon light.` | 並んで歩く時間 |
| 9 | 48-54s | `The dog drinking water from a shared bottle, owner gently holding it.` | 小さな分かち合い |
| 10 | 54-60s | `The dog curled up at home, content and tired, after the walk.` | 帰宅後の安堵 |

### 4-2. テロップ (日本語 / CapCut で後乗せ)

| シーン | テロップ |
|---|---|
| 1 | 「ねぇ、 そろそろ?」 |
| 2 | リードを 見つめる その目 |
| 3 | カチャ、 と 鳴る 鈴の音 |
| 4 | ドアの向こうは いつもの世界 |
| 5 | おなじみの匂いを ひとつずつ |
| 6 | 「こんにちは」 街のみんなと |
| 7 | あなたが いてくれる |
| 8 | 並んで歩く この時間が好き |
| 9 | ひとくちの水も しあわせ |
| 10 | おうちに 帰ると もっと しあわせ |

### 4-3. キャプション (TikTok / Instagram 投稿文 / 日本語)

```
うちの子が 散歩を 好きな理由って 
歩くこと だけじゃ なかった。

ドアの音、 リードの鈴、 街の匂い、
誰かとの会釈、 そして 並んで歩く時間。

ぜんぶ 「あなたといる時間」 だったから。

あなたのうちの子は、 どんな瞬間が 一番好きそう?
コメントで教えて〜🐾

#うちの子 #犬のいる暮らし #犬好きさんと繋がりたい
#Qocca #ペットのいる暮らし #もしあの子が話せたら
#illustration #絵本 #絵本のような暮らし
```

### 4-4. ハッシュタグ戦略

| 種別 | タグ | 目的 |
|---|---|---|
| 🐾 ペットコミュニティ | `#うちの子` `#犬のいる暮らし` `#犬好きさんと繋がりたい` | 既存ファン層リーチ |
| 🌅 Qocca ブランド | `#Qocca` `#ペットのいる暮らし` | ブランド認知 |
| 📖 シリーズ識別 | `#もしあの子が話せたら` | 続編誘導 / 検索性 |
| 🎨 ビジュアル | `#illustration` `#絵本` `#絵本のような暮らし` | アート / 雰囲気タグ |

→ **各投稿 8-10 タグ** が最適 (TikTok アルゴリズム的に過剰タグは逆効果)

### 4-5. 投稿運用 (King + 創業期メンバー)

| ステップ | 担当 |
|---|---|
| 1. 10枚生成 (gpt-image-1) | King 手動 (Phase 2 で自動化検討) |
| 2. CapCut で動画化 + テロップ + BGM | King |
| 3. TikTok / Instagram Reels / YouTube Shorts に同時投稿 | King |
| 4. 投稿後 30分以内 いいね・コメント返信 | King + 創業期メンバー (初速エンジン) |
| 5. 24時間 コメント欄監視 (ペットロス対応含む) | King + 創業期メンバー |

---

## 🛡️ セクション5: 改訂ルール

- 本書の **マスタープロンプト (セクション1)** は **King 承認なしの改変禁止**
- セクション2-4 の追記・修正は King 承認必須
- 改訂時は本書末尾「改訂履歴」に **日付 / 改訂内容 / 承認者** を記録

---

## 📅 Phase ロードマップ

| Phase | 内容 | 時期 |
|---|---|---|
| **Phase 1 (現在)** | 本書 公式化 / 第1話「散歩が好きな理由」手動運用 | 2026/6/10〜 |
| Phase 2 | テーマ毎パッケージ (お留守番 / 初めての家 等) を本書に追加 | 2026/6 後半 |
| Phase 3 | Edge Function `generate-storybook-frames` で 10枚一括生成 自動化 | 2026/7 (Dday 後検討) |
| Phase 4 | 動画化までの完全自動化 (gpt-image-1 → ffmpeg → 投稿) | 2026 後半 |

---

## 🛡️ 99-safety-protocol 厳守 (本書作成時)

- ✅ docs 1本 新規追加のみ
- ✅ コード変更ゼロ / DB 変更ゼロ
- ✅ Edge Function / Vercel / Supabase / Stripe / OAuth 一切不変
- ✅ 既存 18住民・10出品・1取引 完全保護
- ✅ Kill Switch 未触 / token・secret 露出なし
- ✅ お金・認証・決済フローに一切触れていない

---

## 🎬 BRO に渡せる量産テンプレ (v2) — TikTok 縦長絵本シリーズ

> 依頼書 #143 後追い記録 (2026/6/11): King が確定させた「完成版テンプレ」。
> このセクションだけで BRO (制作担当) が 1 エピソードを量産できる粒度。

### 共通ルール (全エピソード厳守)

| 項目 | 仕様 |
|---|---|
| 画面比率 | **TikTok 用 縦長 9:16** |
| テロップ | **画像内に焼き込む** / 位置 = **上部 35% 付近** / **手書き風フォント** / **黒文字** |
| 余白 | **十分に確保** (テロップと絵が干渉しない) |
| 主役の犬 | **全シーン同一個体**: **茶色の垂れ耳ミックス犬** |
| 画風 | **水彩絵本タッチ** / **ベージュ・オフホワイト・くすみオレンジ** / ノスタルジック / やわらかい光 |
| 表情 | **感情が伝わる表情** (各シーンの感情に対応) |
| 禁止 | **AI 感なし** / **写真風禁止** / **3D 禁止** / シリーズを通して**同じ画風**を維持 |

### 各エピソードの作り方

- **9 シーン構成** (テロップ + シーン描写 の 9 ペア)
- **1 シーンだけテロップなしの「間(ま)」** を作る構成が有効 (感情の余白)
- **ストーリーアーク**: 不安 → 戸惑い → 気づき → 受容 → 安心 (感情起伏で引き込む)

---

### ✅ Episode 2「初めてのおうち」(完成例として記録)

| 項目 | 内容 |
|---|---|
| テーマ | 初めてのおうち (あたたかい / 涙 + 希望) |
| 語り手 | 保護施設からお迎えされた犬 |
| 締めコピー | **「ずっと、誰かを待ってた。今日からここが、ぼくのおうち。」** |

#### 9 シーン (テロップ + シーン描写 / King 確定)

| # | テロップ | シーン描写 |
|---|---|---|
| 1 | きみは ぼくを 見つけてくれた | 保護施設のケージの中、不安そうに見上げる茶色の垂れ耳ミックス犬 |
| 2 | 名前を 呼ばれた 気がした | ケージ越しに差し出された手に、おそるおそる鼻を近づける犬 |
| 3 | (テロップなし ＝「間」) | 抱き上げられ、施設の外の光に照らされる犬 (テロップなしで余韻) |
| 4 | はじめての 車 | 車の窓から流れる景色を、戸惑いながら見つめる犬 |
| 5 | ここが…… ぼくの おうち? | 玄関で立ち止まり、新しい家を見上げる犬 |
| 6 | こわごわ 歩いてみる | 部屋の中を、足音を確かめるように歩く犬 |
| 7 | ぼくの ベッド、あるんだ | 用意された小さなベッドに気づき、近づく犬 |
| 8 | あったかい においが する | ベッドに身を丸め、安心した表情で目を細める犬 |
| 9 | ずっと、誰かを待ってた。今日からここが、ぼくのおうち。 | 窓辺のやわらかい光の中で眠る犬 (締めコピー全文) |

#### キャプション例
```
#もしあの子が話せたら #保護犬 #保護犬を家族に #犬のいる暮らし #犬の気持ち #ペットとの暮らし #絵本 #Qocca
```

---

### 📦 今後の量産候補 (同フォーマットで展開予定)

| 候補テーマ | 想定アーク |
|---|---|
| **お留守番** | 寂しさ → 待つ → 物音に期待 → 帰宅 → 再会の喜び |
| **虹の橋** | 別れ → 喪失 → 思い出 → 受容 → やさしい余韻 |
| **老犬** | 衰え → 戸惑い → 寄り添い → 感謝 → 穏やかな日々 |
| **保護猫** | 警戒 → 距離 → 歩み寄り → 信頼 → 家族に |

---

### ⚠️ gpt-image-1 制作時の注意 (BRO 必読)

1. **プロンプトは日本語ポジティブ表現のみ**
   - ❌ ネガティブ表現の羅列 (「〜しない」「〜禁止」を画像プロンプト本文に大量に書く) → **フィルター誤反応**でブロックされやすい
   - ✅ 「やわらかい水彩タッチで」「あたたかい光で」等、**してほしいこと**を肯定形で記述
2. **画像内テロップ (日本語) は崩れる可能性**
   - gpt-image-1 は日本語文字が崩れることがある
   - → **まず 1〜2 枚 試し打ち**してテロップの可読性を確認
   - → 崩れたら **テロップは画像から外し、CapCut で後乗せ**に切替 (絵だけ生成 → 編集で日本語テロップ重畳)
3. **同一個体・同一画風の維持**
   - 各シーン生成時、犬の特徴 (茶色・垂れ耳・ミックス) と画風 (水彩・くすみオレンジ系) をプロンプトに毎回明記してブレを防ぐ

---

## 改訂履歴
- 2026/6/10 (依頼書 #141) v1.0 初版 / 4 セクション + 第1話確定パッケージ収録
- 2026/6/11 (依頼書 #143 後追い) v2.0「BRO に渡せる量産テンプレ」追加 / Episode 2「初めてのおうち」9シーン完成例 + 共通ルール + 量産候補 + gpt-image-1 注意点
