# CM A案「その愛は、重くない。」絵コンテ (2026/8/25)

30秒 / 9:16 / 飛び先: 商店街 or トップ

---

## なぜこの構成か

既存2本は「モノの旅」と「楽しさの羅列」で、後者には turn が無かった。
turn の無いCMは気持ちよく見られて、そのまま忘れられる。

この案が使うのは **飼い主が一番隠している感情**。

> うちの子への愛が「重すぎる」と思っていて、
> それを人には言わない。自分だけがおかしいと思っている。

turn は「自分だけやと思ってた」→「みんなやった」。
広告でもっとも安定して効く構造で、かつ **「街」のメタファーが初めて画で成立する**
(これまではコピーで言っていただけ。窓の灯りで見せる)。

## 撮り方の制約

⚠️ 人物の顔は映さない。AI は顔で破綻する。
   使えるのは **手 / 後ろ姿 / シルエット / 引きの窓** まで。
   turn のカット6は人が要らないので、そこは安全。

⚠️ 犬は1匹に固定しない。「みんなの家の話」なので、家ごとに違う犬でよい。
   むしろ揃えると「1人の話」に見えてしまい、turn が弱くなる。

---

## カット表

| # | 尺 | 内容 | 役割 |
|---|---|---|---|
| 1 | 4.0s | 暗い部屋。犬用のちいさなケーキに火を灯す手。犬がじっと見ている | フック |
| 2 | 3.5s | 別の家。ソファの後ろ姿。犬に話しかけている。犬が首をかしげる | 積み上げ |
| 3 | 3.5s | 別の家。スマホのカメラロールをスクロールする指。全部おなじ犬 | 積み上げ |
| 4 | 3.5s | 別の家。犬のごはんに刻んだ野菜をきれいに乗せる手。奥で犬が待つ | 積み上げ |
| 5 | 3.5s | 別の家。玄関。散歩帰り、犬の足を1本ずつ拭く手 | 積み上げ |
| 6 | 6.0s | 夜の住宅街を引き。窓の灯りがぽつぽつ、いくつも | **turn** |
| 7 | 3.5s | その中の一つの窓に寄る。カーテン越しに人と犬のシルエット | 着地 |

本編 27.5 − ディゾルブ6×0.5 = **24.5秒** + 締めカード 3.4秒 = **27.9秒**

---

## 生成プロンプト (そのまま投げる)

共通の末尾: `Serene, warm, unhurried, high-end commercial cinematography. No text, no graphics, no faces.`

**1. ケーキ (フック)**
```
Cinematic television commercial shot, dark quiet living room at night. A hand
strikes a match and lights a single candle on a very small dog-friendly cake on
a low wooden table. A dog sits perfectly still just behind it, face lit softly by
the candle flame, eyes fixed on it. Everything else falls into darkness.
Shallow depth of field, 85mm lens, natural film grain, warm palette of amber and
deep brown. Almost still camera. Serene, warm, unhurried, high-end commercial
cinematography. No text, no graphics, no faces.
```

**2. 話しかけている**
```
Cinematic television commercial shot, warm evening living room. Seen from behind,
a person sits on a sofa with their back to camera, shoulders relaxed, clearly
talking to a dog sitting on the floor facing them. The dog tilts its head, ears
shifting, listening intently. Soft lamplight. Shallow depth of field, 50mm lens,
natural film grain, warm palette of amber, cream and soft brown. Static camera.
Serene, warm, unhurried, high-end commercial cinematography. No text, no graphics,
no faces.
```

**3. カメラロール**
```
Cinematic television commercial macro shot. A thumb scrolls slowly up a phone
photo grid held in one hand. Every single thumbnail is the same cat, sleeping,
photographed from slightly different angles again and again. The screen glow lights
the fingers. Everything around is dark and soft. Extreme shallow depth of field,
100mm macro lens, natural film grain, warm palette of soft blue screen light and
amber room light. Static camera. Serene, warm, unhurried, high-end commercial
cinematography. No text, no graphics, no faces.
```

**4. ごはん**
```
Cinematic television commercial shot, evening kitchen. Two hands carefully arrange
finely chopped vegetables and shredded chicken on top of a bowl of dog food,
placing each piece neatly, taking real care. In the soft-focus background a dog
waits patiently, sitting upright. Warm overhead kitchen light. Shallow depth of
field, 50mm lens, natural film grain, warm palette of cream and soft green.
Static camera. Serene, warm, unhurried, high-end commercial cinematography.
No text, no graphics, no faces.
```

**5. 足を拭く**
```
Cinematic television commercial shot, low angle in a Japanese genkan entryway after
a walk. Two hands gently wipe a dog's paw with a soft towel, one paw at a time,
lifting each carefully. The dog stands patiently, tail giving one small wag.
Soft evening light from the door. Shallow depth of field, 50mm lens, natural film
grain, warm palette of pale wood and cream. Static camera. Serene, warm, unhurried,
high-end commercial cinematography. No text, no graphics, no faces.
```

**6. 夜の街 (turn) ★ここが企画の生命線**
```
Cinematic television commercial shot, night. A slow wide pull-back over a quiet
Japanese residential neighbourhood seen from just above rooftop height. Dozens of
windows glow warm amber in the darkness, scattered across the houses, each one a
small pocket of light. Still air, faint haze. Deep blue night sky above.
Shallow depth of field on the nearest rooftops, 35mm lens, natural film grain,
palette of deep blue and warm amber. Very slow steady pull-back.
Serene, warm, unhurried, high-end commercial cinematography. No text, no graphics,
no people.
```

**7. 窓に寄る**
```
Cinematic television commercial shot, night, exterior. A slow push-in toward one
warmly lit window of a house. Through the thin curtain, the soft silhouette of a
person and a dog moves gently together, undefined and glowing. Everything else is
dark. Shallow depth of field, 85mm lens, natural film grain, palette of deep blue
and warm amber. Very slow push-in. Serene, warm, unhurried, high-end commercial
cinematography. No text, no graphics, no faces.
```

---

## ナレーション (英語・Alden)

```
You don't tell people this.
But you celebrate their birthday.
You talk to them.
Every photo is the same face.
Their meals get more care than your own.

Sometimes you wonder if it's too much.

But tonight, in all these houses,
somebody is doing exactly the same thing.

It isn't too much.
Here, it's normal.

Qocca.
```

## 字幕 (日本語)

```
0.8:3.4   誰にも言わへんけど、|うちの子の誕生日は、ちゃんと祝ってる。
4.6:3.0   話しかけてるし、
8.0:3.2   写真は、おなじ顔ばっかり増えていく。
11.6:3.2  ごはんも、自分のより気をつかってる。
15.2:3.0  ちょっと重いかな、と思うことがある。
19.0:5.0  でも、おなじ夜に|おなじことをしてる家が、こんなにある。
```

⚠️ 最後の字幕はカット6 (夜の街) に重ねる。turn と同時に出す。

## 締めカード

```
--copy "その愛は、重くない。"
--sub  "うちの子を愛してる人が集まる街。"
```

---

## ビルドコマンド (映像が揃ったら)

```bash
node scripts/build-cm.mjs cm-out/qocca_cm_omoku_nai.mp4 \
  "cm-out/a1_cake.mp4:0.3:4.3" \
  "cm-out/a2_talk.mp4:0.5:4.0" \
  "cm-out/a3_roll.mp4:0.5:4.0" \
  "cm-out/a4_gohan.mp4:0.5:4.0" \
  "cm-out/a5_ashi.mp4:0.5:4.0" \
  "cm-out/a6_machi.mp4:0:6.0" \
  "cm-out/a7_mado.mp4:0.5:4.0" \
  --copy "その愛は、重くない。" \
  --sub "うちの子を愛してる人が集まる街。" \
  --vo "cm-out/vo/omokunai_Alden.wav:2.5" \
  --caption "0.8:3.4:誰にも言わへんけど、|うちの子の誕生日は、ちゃんと祝ってる。" \
  --caption "4.6:3.0:話しかけてるし、" \
  --caption "8.0:3.2:写真は、おなじ顔ばっかり増えていく。" \
  --caption "11.6:3.2:ごはんも、自分のより気をつかってる。" \
  --caption "15.2:3.0:ちょっと重いかな、と思うことがある。" \
  --caption "19.0:5.0:でも、おなじ夜に|おなじことをしてる家が、こんなにある。"

node scripts/add-music.mjs cm-out/qocca_cm_omoku_nai.mp4 曲.mp3 cm-out/_mix.mp4 0.35 --keep-voice
node scripts/finalize-video.mjs cm-out/_mix.mp4 "cm-out/Qocca_CM_その愛は重くない_配信用.mp4"
```

## 曲 (SUNO・Instrumental を ON)

```
Cinematic emotional orchestral score. Sparse solo felt piano, single notes,
lots of silence. Warm strings enter around 15 seconds. Opens up into a full
but restrained swell at 19-24 seconds, then resolves and fades to near silence.
No drums, no percussion. Tender, hopeful, quietly devastating.
```

⚠️ 19〜24秒に山が来ること。そこが turn (夜の街) と重なる。

---

## 費用

| | クレジット |
|---|---:|
| 7カット | 227.5 |
| 撮り直し見込み (3割) | 約70 |
| ナレーション | 0.1 |
| **合計** | **約300** |

⚠️ カット6が出なければ企画ごと組み直しになる。**最初に6番だけ単体で回して確認する。**
