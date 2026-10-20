# 07 ペットウォーカーのスポット拡充 (定期実行の手順書)

> King 2026/10/21「定期的に更新されてくようにしといてほしい。毎回指示してられへんから」
> 予約タスク `petwalker-auto-expand` がこの手順書を読んで回す。手で回すときも同じ手順。
> 方針の原点: 2026/7/7 King 合意「件数上限なし・取れるだけ全部・ただし全部公式根拠つき (水増し禁止)」

## 1 回でやること

件数の少ないエリアを 4 つ選ぶ。調査役 4 人で根拠つきのスポットを集め、確認してから登録する。座標と画像まで付けて、最後に報告する。
**コードは変えない・git commit しない・PR を作らない** (道具は全部 main にある)。

## 守ること (崩さない)

- **根拠**: 1 件ごとに、ペット可と書いてあるページを 1 つ付ける。調査役が WebFetch で実際に開いたものに限る。
  - 使ってよい: 施設の公式・自治体・観光協会/DMO・大手ペット旅行ガイドの個別ページ (kyuzitsu-inubu.com / petokoto.com の記事 / inutome.jp/spots/<id> / wanwan-dog.jp など)
  - 使わない: 個人ブログ、予約サイトや一覧・ランキングの「名前だけ」のページ、口コミの又聞き、古い情報 (閉店・数年前の年しか書いてない)
- **外す**: ペット不可のところ、「予約前に相談」としか書いてないところ、ほかのエリアの範囲 (同じ県の隣のエリアに注意。例: 河口湖と山中湖、湯布院と別府、奥飛騨と飛騨高山)
- **条件文**: 根拠ページに書いてある事実だけ。分からないことは「〜は要確認」と書く。推測の言い方 (「と思われる」「可能性」「おそらく」) は使わない。最後は必ず「詳細は施設公式で要確認」で締める
- **説明文**: 静かで控えめな 1〜2 文。絵文字・「！」・煽り言葉 (今すぐ・限定) は使わない
- **category**: `spot` / `cafe` / `hotel` の 3 つだけ (DB の check 制約)。カフェと飲食店は cafe、宿とキャンプ場は hotel、それ以外は全部 spot
- **area_tag**: 既にあるエリア名だけを使う。新しいエリアは作らない (King の判断が要る)

## 手順

作業フォルダは `petwalker-out/expand/<今日の日付>/` (gitignore 済み)。最初に開始時刻を UTC でメモしておく (重複チェックで使う)。

### 1. エリアを選ぶ

```
node scripts/petwalker-area-status.mjs
```

件数の少ない順に、次のエリアは外して上から 4 つ選ぶ。

- テーマのエリア: `道の駅・ドッグラン` / `雨の日OK・屋内あそび場` / `高速SA・ドッグラン`
- 最終追加が 14 日以内のエリア (同じところばかり掘らないため)

### 2. 調査役を 4 人同時に出す

```
node scripts/petwalker-area-status.mjs --areas A,B,C,D
```

これで既存の名前と市区町村が出る。エリアごとに general-purpose の調査役を `run_in_background` で 4 人同時に出す。指示文は下の雛形を使い、`{...}` を埋める。範囲には、含める市区町村と、外す隣のエリアをはっきり書く。

```
You are researching dog-friendly places for Qocca's PetWalker (a Japanese pet-owner app). Area: {エリア名} ({含める市区町村}). Do NOT include {外す地域} (separate area). Find 10–25 NEW places that are NOT already listed.

Already listed (do NOT return these or obvious variants): {既存の名前を " / " でつなぐ}

Evidence rule (strict, most important): every item must have ONE evidence_url that you actually opened with WebFetch and that explicitly says dogs/pets are allowed. Acceptable: the facility's own official site (facility_official), a municipality page (municipal_official), a tourism association / DMO page (tourism_association), or an individual facility page on a major pet travel guide such as kyuzitsu-inubu.com, petokoto.com articles, inutome.jp/spots/<id>, wanwan-dog.jp (pet_guide). NOT acceptable: personal blogs, booking-site or list/ranking pages that only name the place without stating pet rules, reviews/hearsay, pages that look outdated (closed, old year with no current info). If a place says pets are not allowed or only "ask before booking", exclude it. Do not invent anything.

Output: ONLY a JSON array (no prose before or after), each item:
{"name":"","category":"spot|cafe|hotel","pref":"{県}","city":"{市町村}","address":"full address without parenthetical notes, or empty string","description":"","evidence_url":"","evidence_type":"facility_official|municipal_official|tourism_association|pet_guide","conditions":"","latitude":null,"longitude":null}
- category must be exactly spot, cafe (cafés/restaurants), or hotel (lodging/camping). Parks, shops, attractions, dog runs → spot.
- description: 1–2 calm, quiet, poetic Japanese sentences. No emoji, no "！", no hype words like 今すぐ/限定.
- conditions: only facts stated on the evidence page, joined with "・" (size/weight limits, head count, fees, vaccination, which areas allow dogs, leash rules, seasons). For anything not stated write "〜は要確認". Never speculate ("〜と思われる", "可能性"). Always end with "詳細は施設公式で要確認".
- latitude/longitude: only if the evidence page states them; otherwise null.
Aim for a mix of hotels, cafés and spots. Quality over quantity.
```

### 3. 返ってきたら 1 件ずつ目で確かめる (エリアごと)

返ってきた JSON 配列を `petwalker-out/expand/<日付>/<エリア>.json` に保存してから、次を見る。

- 推測や又聞きの言い方 → 言い切らない形に直すか、その条件だけ消す
- 根拠が一覧や予約サイトだけ、「相談」としか書いてない、隣のエリアのもの → その件ごと外す
- 住所の括弧書き (「(管理事務所)」「(〇〇店内)」など) → 取る (付いたままだと座標が引けない)
- 丸めた座標 (小数 3 桁以下など) や出どころの怪しい座標 → null にする (住所から付け直す)
- 古い年の料金 → 金額を消して「料金は要確認」にする

### 4. 登録する (エリアごと)

```
node scripts/petwalker-check-evidence.mjs petwalker-out/expand/<日付>/<エリア>.json   # exit 1 なら、そのリンクの件を外してからもう一度
node scripts/insert-petwalker-spots.mjs petwalker-out/expand/<日付>/<エリア>.json "<area_tag>"
node scripts/geocode-petwalker-gsi.mjs --write
node scripts/petwalker-dupcheck.mjs <開始時刻UTC 例 2026-10-24T01:00Z>
```

重複チェックで、ほかのエリアの既存スポットと同じ施設が出たときの扱い。

- **この回に入れたほう**を ID 指定で消す (REST の DELETE で `id=in.(...)&created_at=gte.<開始時刻>` の両方を条件にする)
- 古いほうの住所が空なら、今回の住所で埋める
- 商業施設とその中の店、同じビルの別の施設は重複ではないので残す
- **この回より前からある行は消さない・書き換えない** (住所の空欄を埋めるのは例外として許す)

### 5. 画像を作る (4 エリアぶんまとめて)

```
node scripts/petwalker-new-spot-images.mjs --area "A,B,C,D" > petwalker-out/expand/<日付>/images.log 2>&1
```

- 終わったら `node scripts/petwalker-area-status.mjs` で、画像なしが 0 になったか見る
- 0 でなければ同じコマンドをもう一度流す (画像が無い行だけを拾うので、続きから作られる)
- `fal 402/403` (残高切れ・鍵切れ) で止まったら、そこでやめて報告する。チャージは King がする
- REGION に無いエリアは「in Japan」の背景になる。その場合は報告に書く (スクリプトの修正は手で PR)

## 報告 (最後のメッセージ。King が見る)

King への報告は関西弁まじりで簡潔に。最後のメッセージに次を入れる。

- エリアごとの件数の増え方 (前 → 後) と、全体の件数
- 外した件とその理由 (1 行ずつ)
- 重複チェックの結果、画像なし・座標なしの残り
- 止まったところがあれば、その場所と理由

最後に、記憶ファイル `petwalker-phaseb-deepening-policy.md` の末尾に 1 行だけ追記する (日付・エリア・件数)。

## 道具の場所

| やること | コマンド |
|---|---|
| 件数・材料 | `scripts/petwalker-area-status.mjs [--areas ...]` |
| 根拠リンクの確認 | `scripts/petwalker-check-evidence.mjs <json...>` |
| 登録 (同じエリア内の同名は除外) | `scripts/insert-petwalker-spots.mjs <json> <area_tag> [--dry-run]` |
| 座標 (国土地理院・鍵いらず) | `scripts/geocode-petwalker-gsi.mjs --write` |
| 全国の重複 | `scripts/petwalker-dupcheck.mjs <since UTC>` |
| 画像 (fal → Storage → 配線) | `scripts/petwalker-new-spot-images.mjs --area "..."` |

鍵は `scripts/.sbkey.local` (Supabase の service role)。fal の鍵は `scripts/.falkey.local`。どちらもチャットに出さない。
