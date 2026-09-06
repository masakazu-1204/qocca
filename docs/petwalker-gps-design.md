# ペットウォーカー GPS現在地検索 技術設計書 v1

> 作成: 2026/7/11 Fable 5（設計フェーズ・実装なし）
> 前提調査: 2026/7/11 通常クマ調査（変更ゼロ・読み取りのみ）
> King確定方針: 座標整備は **案A = name+pref+city ジオコーディングで正確に整備**
> 実装は本設計のKing承認後、通常クマが Phase 単位で実施する。

---

## 0. 全体像（3 Phase 構成）

```
Phase 1: 座標backfill（1,372件）        ← UI変更ゼロ・データ整備のみ
Phase 2: 現在地 → 近い順リスト          ← GPS取得 + client haversine + 新view
Phase 3: 近隣マップ表示                  ← Leaflet流用（静けさ再スタイル）
```

- 各Phaseは独立ブランチ・独立PR。前Phaseの完了検証後に次へ。
- Phase 2 の時点でユーザー価値が出る（Phase 3 は体験強化であり必須ではない）。
- 決済・AuthContext・facilitiesテーブルには全Phase通して非接触。
  petwalker.tsx の「pet_walker_spots のみ読む」隔離設計を維持する。

---

## 1. Phase 1: 座標backfill設計（最重要）

### 1-1. API選定

**推奨: Google Places API (New) — Text Search**

| 候補 | 評価 | 理由 |
|---|---|---|
| **Places Text Search (New)** | ◎ 採用 | POI名+地域名の検索に最適化。「店名 都道府県 市区町村」クエリの正答率が最も高い。place_id/formatted_address/位置が一括で返る |
| Geocoding API | △ | 住所文字列向け。住所が88.5%欠損している本件では主役になれない |
| Nominatim (OSM) | ✕ | 日本のPOI名カバレッジが弱い・1req/s制限・商用利用ポリシー注意 |

**コスト（2025/3以降の新料金体系）**
- Text Search は Pro SKU: **月5,000コールまで無料枠**、超過分 $32/1,000
- 本件は 1,372〜1,551 コール（1回きり）→ **無料枠内で $0 の見込み**
- 再実行・低信頼分の再クエリを含めても最悪 ~$50（当初概算どおり）
- 前提: Google Cloud プロジェクト + 請求先アカウント + APIキー発行（King作業）

**APIキーの扱い**
- キー制限: 「Places API (New)」のみ許可・IP制限（King PC）推奨
- 保存場所: `scripts/.gmapskey.local`（`*.local` gitignore済パターンを踏襲。env より優先で読む — 画像生成スクリプトと同作法）
- クライアント(ブラウザ)には一切埋め込まない。**バッチ専用・サーバーサイド利用のみ**

### 1-2. バッチスクリプト設計（`scripts/geocode-petwalker.mjs`）

画像生成スクリプト（generate-petwalker-phasea.mjs）と同じ運用感で作る。

```
入力:  pet_walker_spots で latitude IS NULL の行（id, name, pref, city）
処理:  Text Search (New) に query = `${name} ${pref} ${city ?? ""}`
       languageCode: "ja", regionCode: "JP"
       ※ locationBias は使わない（pref文字列で十分・バイアス誤誘導を避ける）
出力:  geocode-out/results.json（全件の生ログ: id, query, 返却name, 返却address,
       lat, lng, place_id, types, confidence, verdict）
書込:  verdict=AUTO のみ DB UPDATE。verdict=REVIEW は書かずにレビューリストへ
```

**CLIフラグ（画像生成スクリプトと同作法）**
- `--dry-run` : クエリ一覧のみ表示・API/DB非接触
- `--only <id,...>` : 対象限定（再実行・補正用）
- `--write` : これを付けた時のみDB書込（デフォルトはAPI取得+JSON出力まで）
  → 「取得」と「書込」を分離し、間にレビューを挟める

**レート・所要時間**
- 5 QPS（200ms間隔）で十分。1,372件 ≒ 5分弱。リトライは 429/5xx のみ最大2回・指数バックオフ

**冪等性・再実行可能性**
- 対象抽出が `latitude IS NULL` なので、成功済みは自動的にスキップされる（再実行安全）
- results.json は追記でなく実行ごとに別ファイル（`results_<n>.json`）で残す
- DB書込は id 指定の1行UPDATE。部分失敗しても再実行で残りだけ処理される

### 1-3. 精度検証と信頼度判定（自動判定 → 二層書込）

**自動バリデーション（全件・機械判定）**
1. **日本境界チェック**: lat 24.0–46.0 / lng 122.0–146.0 の外は無条件 REJECT
2. **都道府県一致**: 返却 formatted_address に `pref` 文字列が含まれるか
3. **市区町村一致**: 返却 address に `city` が含まれるか（表記ゆれがあるため参考判定）
4. **名称類似**: 返却 displayName と DB name の正規化比較
   （空白・括弧・全半角を正規化した上で、部分一致 or 先頭N文字一致）
5. **重複座標検知**: 既存179件+新規の中で完全同一座標が3件以上 → 全て REVIEW 行き
   （汎用名が市中心に落ちる事故はここで捕まる）

**verdict 判定**
| verdict | 条件 | 扱い |
|---|---|---|
| AUTO | 境界OK + pref一致 + (name類似 or city一致) | `--write` でDB書込 |
| REVIEW | 境界OKだが pref不一致 / name非類似 / 座標重複 | レビューCSVへ（書かない） |
| REJECT | 境界外 or 結果0件 | 座標なしのまま（従来UIで動く） |

**レビュー運用（REVIEW分・想定5〜15% = 70〜200件）**
- `geocode-out/review.csv`（name / query / 返却name / 返却address / GoogleマップURL）を出力
- King か通常クマが目視 → OKなら `--only id --write --force-id <place>` で個別確定
- 全件を無理に埋めない。**REVIEW/REJECT分は座標なしのまま公開継続**（後述の両立設計で従来動作）

**スキーマは変更しない**
- 信頼度フラグはDBに持たせず、`geocode-out/` のJSON/CSVで管理（カラム新設不要のKing方針堅持）
- 監査ログテーブル（`pet_walker_geocode_log`）は任意オプション → King判断ポイント③

### 1-4. DB書込の3点セット（99-safety-protocol 準拠）

```sql
-- ① 確認SELECT（実行前・対象規模の確認）
SELECT COUNT(*) FROM pet_walker_spots WHERE latitude IS NULL;

-- ② UPDATE（スクリプトが id 単位で発行。手動実行する場合の型）
UPDATE pet_walker_spots
SET latitude = <lat>, longitude = <lng>
WHERE id = '<uuid>' AND latitude IS NULL;   -- 二重書込防止のガード付き

-- ③ 結果確認SELECT
SELECT COUNT(*) FILTER (WHERE latitude IS NOT NULL) AS has_coords, COUNT(*) AS total
FROM pet_walker_spots;
```

- スクリプト経由でも同じ規律: 実行前カウント → 書込 → 実行後カウントをログ出力
- address カラムには書かない（Places の formatted_address を勝手に正とはしない。JSONに保持のみ）

### 1-5. Phase 1 検証ポイント
- [ ] カバレッジ: has_coords が 179 → 1,300+（85%+）へ
- [ ] 全件境界内・重複座標クラスタなし
- [ ] ランダム30件 + REVIEW全件の目視（GoogleマップURLをCSVに同梱して1クリック確認）
- [ ] UI無変更の確認（petwalker.tsx は触っていない）

---

## 2. Phase 2: 現在地取得 + 近い順リスト

### 2-1. GPS取得設計（navigator.geolocation）

```ts
navigator.geolocation.getCurrentPosition(onOk, onErr, {
  enableHighAccuracy: false,  // 街区精度で十分・高速・省電力
  timeout: 8000,
  maximumAge: 300000,         // 5分キャッシュ（連続タップで再測位しない）
});
```

**発火タイミング（重要・静けさ設計）**
- ページロード時に自動リクエストは**しない**。ユーザーが「いまいる場所から」を**明示的にタップした時のみ**許可ダイアログが出る
- 取得中は控えめなローディング文言（例:「いまの場所をたずねています。」）

**エラー・拒否時のフォールバック**
| ケース | 挙動 |
|---|---|
| PERMISSION_DENIED | 静かな一文（例:「位置情報が使えないときは、エリアからどうぞ。」）+ 従来のエリアタイルへ |
| POSITION_UNAVAILABLE / TIMEOUT | 同上（文言は「うまく取得できませんでした。」系） |
| 非対応ブラウザ | `"geolocation" in navigator` で導線ごと非表示 |

**プライバシー原則**
- 現在地は**クライアント内でのみ**使用（サーバー送信・保存・ログ一切なし）
- Meta Pixel イベントは `PetWalkerNearbyView`（座標を含めない・既存作法どおり）

### 2-2. 距離計算・近い順ソート（client haversine）

```ts
// utils または petwalker.tsx 内に閉じる純関数
const distKm = (aLat, aLng, bLat, bLng) => {
  const R = 6371, dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat/2)**2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
```

- 対象: `latitude != null && longitude != null` のスポットのみ（Phase 1 後 ~1,300+件）
- 1,551件のソートは <1ms。**既に全件ロード済みのUI構造をそのまま活かす**（追加fetch不要）
- 表示: 1km未満 = 「約850m」／以上 = 「約1.2km」（丸めて"約"を付ける = 静けさ・過度な精密演出をしない）

**将来のサーバーRPC移行余地（今はやらない）**
- スポットが1万件超 or 全件ロード廃止時に `nearby_pet_walker_spots(lat, lng, max_km, lim)` RPC へ
- その際 `cube` + `earthdistance` 拡張を有効化し `ll_to_earth` GiSTインデックス（facilities の search_facilities RPC と同じ思想）
- 拡張有効化はDB変更 → その時点で改めてKing承認。**Phase 2 では不要**

### 2-3. UI設計（静けさ世界観厳守）

**導線（petwalker.tsx トップ）**
- ヒーロー文の直下・「エリアで探す」の上に、控えめな横長ボタンを1本:
  - 和文「いまいる場所のちかくで」/ 英字ラベル "NEARBY"
  - QCトークンのみ（境界 lightSand・文字 softBrown・背景 transparent→hover cream）
  - 絵文字なし・transition 0.8s+・押し付けない一文を添える（例:「位置情報は端末の中だけで使います。」）

**新view: `nearby`**
- 既存の `activeArea` / `activeSpot` と同列の view state を1つ追加
- history 連動は既存 PW_NAV パターンを踏襲: `pushState({ [PW_NAV]: { type: "nearby" } })`
  popstate ハンドラに nearby 分岐を1行追加（戻る操作で1段ずつ巻き戻る挙動を維持）

**近い順リスト**
- 既存 spotCardStyle をそのまま再利用し、右肩 or メタ行に距離ラベル（sage色・小さく）
- カテゴリチップ（既存 activeCat の仕組み）をそのまま流用して絞込可能
- 初期表示は近い順 **30件**、末尾に「もうすこし遠くまで」で +30件ずつ（静かなページング）
- 座標なしスポットはリストに出さず、末尾に一文:
  「座標が未整備の場所は、エリアからさがせます。」→ エリア一覧への静かなリンク

**座標あり/なしの両立（段階設計）**
| スポット | 近い順リスト | 詳細ページの地図 |
|---|---|---|
| 座標あり | 出る（距離表示付き） | 従来どおり Googleマップ検索リンク（name+pref+city）を維持 |
| 座標なし | 出ない | 従来どおり（変化なし） |

- 詳細ページのGoogleリンクは **name ベースを維持**（座標クエリより「そのお店のGoogleマップページ」に着地して体験が良い）→ King判断ポイント⑦
- スポット詳細に距離バッジを足すのは任意（nearby 経由で開いた時のみ表示が自然）

### 2-4. Phase 2 検証ポイント
- [ ] 実機（モバイル・HTTPS本番 or vercel preview）で許可→近い順が出る
- [ ] 許可拒否・タイムアウト・非対応の3系統フォールバック
- [ ] 戻る操作（スワイプ/ブラウザ戻る）で nearby → トップが1段で戻る
- [ ] typecheck + build 緑
- [ ] 静けさチェック（絵文字なし・font-weight≤500・transition 0.8s+・煽り文言なし）

---

## 3. Phase 3: 近隣マップ表示

### 3-1. 方針: FacilityMapView の「初期化パターン」だけ流用・見た目は再設計

⚠️ **重要**: FacilityMapView は旧世界観（絵文字ピン🚧・#F5A94A・font-weight:800）で作られている。
コンポーネントは共有せず、**PetWalkerMapView を新規に作る**（コピー元として参照）。

**流用するもの（実証済みパターン）**
- `L.map` 初期化 / OSMタイル + attribution（© OpenStreetMap contributors 必須）
- markercluster（chunkedLoading: true）・null/0,0座標の除外ガード
- ポップアップの DOM 直組み（textContent = XSS安全）
- `requestAnimationFrame(() => map.invalidateSize())` / cleanup パターン

**再設計するもの（静けさ）**
- ピン: 絵文字なしの小さな丸ドット（QC.softBrown・白縁・小さめ 14–18px）
- 現在地マーカー: さらに控えめな点（QC.sage系・パルスアニメなし）
- ポップアップ: QC_FONT_JP・font-weight≤500・ボタンは terracotta ではなく softBrown 枠線スタイル
- 初期表示: 現在地中心 zoom 13前後・fitBounds は近傍30件で

**リスト/地図トグル**
- nearby view 内に控えめな2択トグル（「リスト」「地図」）。facilities の地図トグルと同じ操作感

### 3-2. Phase 3 検証ポイント
- [ ] クラスタ動作・モバイル描画性能（1,300ピンでも chunkedLoading で問題なし想定）
- [ ] OSM出典表記の表示
- [ ] 旧世界観の混入ゼロ（絵文字・#F5A94A・太字）

---

## 4. 運用ルール（Phase B 深掘り継続との整合）

1. **新規スポット追加時の座標**: address の必須化はしない（取得コストが高い）。
   代わりに **「スポット追加バッチ後に geocode スクリプトを1回流す」を標準手順化**
   （`latitude IS NULL` 抽出なので差分だけ自動処理・冪等）
2. **定期監査**: `SELECT COUNT(*) FROM pet_walker_spots WHERE latitude IS NULL;` を深掘り作業の締めに実行
3. **座標の手修正**: 明らかなズレ報告があれば Admin ではなく SQL 3点セットで個別修正（当面）

---

## 5. King判断ポイント（承認前に決めること）

| # | 論点 | 推奨 | 備考 |
|---|---|---|---|
| ① | APIキー発行 | Google Cloud + Places API (New) キーを新規発行 | King作業。請求先アカウント必要。無料枠内なら$0・最悪~$50 |
| ② | REVIEW分（推定70〜200件）の扱い | King目視 or クマ目視で確定、残りは座標なし運用 | 全件埋めに固執しない |
| ③ | 監査ログテーブル新設 | **不要**（geocode-out/のJSONで足りる） | 作るならDDL承認が別途必要 |
| ④ | 近い順リストの初期件数 | 30件 + 「もうすこし遠くまで」 | 半径制限は設けない（過疎地でも空にならない） |
| ⑤ | Phase 3（地図）の実施時期 | Phase 2 リリース後の反応を見てから | Phase 2 単体で価値が出る |
| ⑥ | 新規スポット運用 | 追加バッチ後に geocode 差分実行を標準化 | address必須化はしない |
| ⑦ | 詳細ページのGoogleリンク | name ベース維持 | 座標リンクに変えない |

---

## 6. 触ってはいけない領域（全Phase共通）

- 決済 / AuthContext / facilities テーブル・facilities.tsx のロジック: **非接触**
  （PetWalkerMapView は facilities.tsx を import しない。パターンの参照のみ）
- pet_walker_spots への書込は Phase 1 の latitude/longitude UPDATE のみ（スキーマ変更なし）
- petwalker.tsx の既存3層UI（エリア一覧/特集/詳細）の挙動は不変。nearby は純増設
