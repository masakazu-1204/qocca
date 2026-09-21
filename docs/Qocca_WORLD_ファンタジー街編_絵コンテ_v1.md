# Qocca WORLD ファンタジー街編「初めて Qocca の街に入る」絵コンテ v1 (2026/9/21)

Meta 広告用 / 15秒 / 9:16 / 飛び先: トップ (utm_content=world_town_01)
制作: Higgsfield (静止画 Nano Banana → 動画 Seedance 2.0 Mini 5秒 × 5カット) → build-cm.mjs で1本に

---

## 狙い

「もし、動物たちが暮らす街が本当に存在したら？」を、**自分の目で歩いて見る**。
機能紹介はしない。15秒で「何この街？」「ここ行ってみたい」「もう一回見たい」を作り、
最後に初めて「その街の名前が Qocca やった」と分かる。

```
質感    実写映画で撮った架空の街。動物は犬は犬・猫は猫のまま (擬人化しない・服も最小限)
視点    最初から最後まで一人称 (POV)。歩きの自然な揺れ。24mm・浅い被写界深度
光      朝〜夕方の柔らかい光。最後の広場だけ夕方の斜光
広告感  ゼロ。ロゴは最後の 3.4秒だけ
小ネタ  画面の端に「生活してる動物」を必ず2〜3匹。1回で全部気づかない密度
```

## カット表 (本編 12.0秒 + 締め 3.4秒 = 約15.4秒)

| # | 尺 | 場所 | 一人称で見えるもの | 端の小ネタ (2〜3個ずつ) | 静止画 |
|---|---|---|---|---|---|
| 1 | 2.5 | 街の入口 | 石造りのアーチをくぐる。石畳、ツタ、小さな店の並び。奥に犬猫が普通に歩いてる | 郵便かばんを提げた犬 / 花の鉢を運ぶ猫 | 新規 |
| 2 | 2.5 | MARKET の通り | 首輪・リード・手作りの雑貨が並ぶ露店。柴犬が店番 (エプロン)。猫が商品を見てる | 荷車を引くゴールデン / パン屋から出てくる柴犬 | d1 流用 |
| 3 | 2.5 | 広場・公園 | 噴水と大きな木。散歩する犬、ベンチの犬猫。花屋で働く猫 | 新聞の前に座るブルドッグ / 横断歩道を渡るコーギー / 走る子犬 | d2 流用 |
| 4 | 2.5 | カフェ・COMMUNITY | テラス席の犬と猫。カウンターの猫。掲示板 (文字なしの紙)。写真を撮ってる (三脚とカメラ、動物が覗いてる) | 窓辺で寝る猫 / 荷物を待つ犬 | 新規 |
| 5 | 2.0 | 中央の大広場 | 立ち止まる。夕方の斜光。奥まで街が続く。たくさんの犬猫と、後ろ姿の人が数人 | 遠くの観覧車 / 屋根の上の猫 | d3 改 |
| 締 | 3.4 | カード | 「ペットとの毎日を、もっと特別に。」 小さく「うちの子を愛してる人が集まる街。」 ロゴ / Qocca | — |

Qocca の機能は言わない。**MARKET=カット2、WALK/PLACES=カット3、COMMUNITY/EVENT/ALBUM=カット4** に「街の出来事」として置いてあるだけ。

## テロップ (本編・日本語・標準語)

```
0.4〜2.4   もし、動物たちが暮らす街があったら。
5.2〜7.4   お店も、散歩道も、カフェも。
9.6〜11.8  そこは、ずっと前からあった気がする。
```
フォント Zen Kaku Gothic New Medium / 64px / 下から3割。字幕は3枚だけ。読ませるより「間」を作る。

## ナレーション (英語・Alden・音なしでも成立させる)

```
Somewhere, there's a town where the animals live like anyone else.
Shops. Walks. Cafés.
Somehow, it feels like it was always here.
Qocca.
```

## 音

環境音 (足音・鳥・遠くの話し声) を主にして、BGM はごく薄いピアノ。締めカードで音を引く。

---

## 生成プロンプト

共通: `Photorealistic, vertical 9:16, first-person point of view at human eye height, 24mm lens, shallow depth of field, cinematic, warm haze, volumetric light, film grain. The animals are completely photorealistic real animals, not cartoon, not anthropomorphic. No text, no readable signs or lettering, no human faces.`

**静止画 (Nano Banana・1クレジット/枚)**

1. 入口
```
Walking through a large old stone archway into a whimsical storybook town: cobblestone street, ivy on the walls,
small crooked shops with round windows and striped awnings, hanging lanterns, flower boxes. Down the street, a real
shiba inu and a real cat walk calmly like residents. Near the arch, a real beagle with a small leather mail satchel,
a real cat carrying nothing but sitting beside a flower pot. Soft morning light.
```
4. カフェ
```
Standing at the terrace of a small café in a storybook town: round tables, a real tabby cat sitting on a stool behind
the counter, a real corgi and a real cat sharing a terrace table, a wooden notice board with blank paper notes,
an old camera on a tripod with a real pomeranian peeking at it. A real cat asleep on the windowsill. Warm afternoon light.
```
5. 大広場 (d3 を昼→夕方に寄せる。d3 の job を image_references に)
```
Same town as the reference. Standing still at the edge of the large central square at golden hour: long shadows,
a fountain, many real dogs and cats scattered across the square living their lives, a few humans seen only from behind
at a distance, the town continuing far into the distance up a hill, a small ferris wheel far away, a cat on a rooftop.
```

**動画 (Seedance 2.0 Mini・5秒・start_image・12.5/カット)**

共通: `Live-action first-person footage, gentle handheld walking sway, slow forward walk, camera occasionally glances left and right. Animals move naturally and minimally (a tail wag, a head turn, a slow walk). No text, no captions.`

```
1  walk forward through the archway into the street, light blooming as we pass under the arch
2  keep walking; the shiba behind the stall looks up at us; the golden retriever with the cart crosses in front
3  slow down at the square; the corgi crosses; the bulldog turns a page (paper flutters); puppies run far away
4  turn the head slowly from the counter cat to the terrace table; the pomeranian ducks behind the camera tripod
5  stop walking; camera settles; slight breath sway; the cat on the roof stretches; light flares softly
```

## 予算

```
静止画   新規3枚 (1・4・5) + 直し2枚         5
動画     5カット × 12.5 + 撮り直し2本         87.5
ナレ     Alden 1本                            (音声モデルの単価に依存)
合計     約 100 クレジット
```

## 組み方 (build-cm.mjs)

```
CAP_FONT=ads-out/fonts/ZenKakuGothicNew-Medium.ttf CAP_SIZE=64 node scripts/build-cm.mjs ads-out/world_town_01.mp4 \
  "ads-out/w1.mp4:0:2.5" "ads-out/w2.mp4:0:2.5" "ads-out/w3.mp4:0:2.5" "ads-out/w4.mp4:0:2.5" "ads-out/w5.mp4:0:2.0" \
  --copy "ペットとの毎日を、もっと特別に。" --sub "うちの子を愛してる人が集まる街。" \
  --vo "ads-out/vo/world_alden.wav:0.8" \
  --caption "0.4:2.0:もし、動物たちが暮らす街があったら。" \
  --caption "5.2:2.2:お店も、散歩道も、カフェも。" \
  --caption "9.6:2.2:そこは、ずっと前からあった気がする。"
```

## シリーズ化 (Qocca WORLD)

```
02  MARKET の街 (露店を1軒ずつ覗く)        05  海辺の街
03  WALK の森 (朝霧の遊歩道)               06  夜の Qocca (提灯と窓の灯り)
04  EVENT の広場 (マルシェの日)            07  クリスマスの Qocca
```
同じ「入口 → 歩く → 立ち止まる → 名前」の型で、場所だけ変える。

---

## 判断待ち

- コピー「ペットとの毎日を、もっと特別に。」で行くか、これまでの「うちの子を愛してる人が集まる街。」を主にするか
- 人を「後ろ姿だけ・遠く」で入れるか、完全に動物だけにするか (チャピ案は「動物と人が共存」)
