# 決済根本対応 (C): `awaiting_payment` ステータス分離 — 設計書

> 作成: 2026-06-15 / 状態: **設計のみ（未実装・King承認待ち）**
> 位置づけ: 未決済テスト注文 09e569cc 事件の根本治療。A(フロント防御)・B(complete-order v32 pi_ガード) は実装済。本書は C(根本) の設計。
> ⚠️ 本書時点で **コード・DB は一切変更していない**。実装は King の GO 後。

---

## 1. 背景

2026-06-15、本番DBプレビューで実出品者(eighty eight・ひぐまジャーキー)の商品に対し、決済未完了の注文 09e569cc が作成された。調査の結果:

- 未決済注文も `status="pending"` で作られ、出品者の「販売管理」に**対応待ちとして見えうる**状態だった。
- `complete-order` が決済未完了でも送金しうる構造だった（→ B で pi_ ガード追加・v32 済）。

A(フロント表示)・B(送金ガード)は対症療法。**C = 「未決済」を独立したステータスにして、構造的に混同不能にする**根本治療。

---

## 2. 現状ライフサイクル（実コード根拠）

| # | トリガー | 実装 | status 遷移 | 決済参照 |
|---|---|---|---|---|
| 1 | 購入確定 | `create-checkout` v46 | INSERT **`pending`**, escrow=`held` | `cs_`(Checkout Session) |
| 2 | 決済完了 | `stripe-webhook` `checkout.session.completed` | `pending`→**`working`** | `pi_`(PaymentIntent) |
| 3 | 期限切れ/失敗 | `stripe-webhook` `expired`/`async_payment_failed` | →`cancelled` | (cs_ のまま) |
| 4 | 返金 | `stripe-webhook` `charge.refunded` | →`refunded` (pi_照合) | pi_ |
| 5 | 受取確認 | `complete-order` v32 | `working`/`delivered`→`completed` | pi_ガード有 |

**status 許可値** (`orders_status_check`): `pending, working, delivered, completed, disputed, cancelled, refunded`

**現状の注文データ**: 計3件のみ（cancelled×2[cs_], completed×1[pi_]）。**`pending` 在庫ゼロ**＝移行リスク極小。

### 問題点
- `pending` = 「決済待ち(未払い)」だが、語が**他ドメインと衝突**（listings.status=審査中 / events.approval_status=承認待ち / pet_facilities=承認待ち / backers=未受け取り）。読み手・実装者が誤解しやすい。
- 「未払い」と「支払い済みで何か保留」が同じ語に同居 → 防御の穴になりやすい（事件の根因）。

---

## 3. 提案ライフサイクル

`pending`(初期) を **`awaiting_payment`** に分離。

| # | トリガー | status 遷移 |
|---|---|---|
| 1 | 購入確定 | INSERT **`awaiting_payment`**, escrow=`held` |
| 2 | 決済完了 | `awaiting_payment`→`working` |
| 3 | 期限切れ/失敗 | →`cancelled` |
| 4 | 返金 | →`refunded` |
| 5 | 受取確認 | `working`/`delivered`→`completed` |

→ `awaiting_payment` = 「お金が動く前」を明示。出品者の対応待ち・送金・進捗からは**定義上除外**できる。

---

## 4. 変更点リスト（全 touch-point・行番号付き）

### 4-1. DB（migration）
- `orders_status_check` に **`awaiting_payment` を追加**（既存値は全て維持）。
  - 推奨: `pending` は制約に**残す**（レガシー・在庫ゼロだが念のため）。書き込みは停止する。

### 4-2. Edge Function
- **`create-checkout`**: `insertData.status = "pending"` → **`"awaiting_payment"`**（1行）。エラー時の `cancelled` は不変。
- **`stripe-webhook`**: **変更不要**（completed は order_id で working に更新・前ステータス非依存 / expired→cancelled も同様）。
- **`complete-order`**: pi_ ガードで既に防御済。任意で `status==="awaiting_payment"` 明示リジェクトを追加（多層防御・低コスト）。

### 4-3. フロント（`src` / ORDER status のみ・他ドメインpendingは非対象）
| ファイル:行 | 現状 | 変更 |
|---|---|---|
| `utils/format.ts:28` `stepIndex` | `pending→0` | `awaiting_payment` 追加（決済前=進捗バー非表示 or step 0） |
| `constants/data.ts:31` `ORDER_STEPS` | `pending=注文確定` | 進捗バー方針に応じて調整 |
| `pages/mypage.tsx:2149` `statusLabel`(OrdersTab) | `pending:決済待ち` | `awaiting_payment:決済待ち` 追加 |
| `pages/mypage.tsx:2587` `statusLabel`(SalesTab) | 同上 | 同上 |
| `pages/mypage.tsx:690` `pendingSalesCount` | `.in(["pending","working"])` | **`["working"]`**（未払いを出品者対応待ちから除外＝事件の核） |
| `pages/mypage.tsx:2228/2679` `OrderStatusBar` | 全status描画 | `awaiting_payment` は非表示 or 「決済待ち」専用表示 |
| `pages/mypage.tsx:2960` ミニ表示 | fallback「取引中」 | 任意で「決済待ち」 |
| `components/ui.tsx:461` `OrderStatusBar` | stepIndex依存 | format.ts 連動 |

> ⚠️ 買い手の `pendingOrdersCount`(mypage:677) は `status="delivered"` 限定 → **変更不要**。

---

## 5. デプロイ順序（重要・順序厳守）

未対応ステータスの注文が宙に浮かないよう、**書き込み開始を最後**にする:

1. **DB migration**（`awaiting_payment` を制約に追加）← これが無いと create-checkout が CHECK 違反で落ちる
2. **フロント deploy**（`awaiting_payment` のラベル/バッジ/進捗対応）← 表示できる状態を先に
3. **`create-checkout` deploy**（`awaiting_payment` 書き込み開始）← 最後

→ 各段階の間で既存フローは壊れない（1,2 の時点では誰も awaiting_payment を書かないので無害）。

---

## 6. ロールバック
- create-checkout を `pending` 書き込みに戻すだけで即旧挙動（制約は両値許可のまま）。
- フロントは `pending`/`awaiting_payment` 両対応で残すので戻し不要。
- DB制約は追加のみ（破壊なし）＝ロールバック不要。

---

## 7. リスク評価
- **データ移行リスク: 極小**（現 `pending` 注文ゼロ）。
- **決済フロー本体: 不変**（Stripe呼び出し・金額計算・BP・webhook署名検証は一切触らない）。
- **多層防御維持**: B の pi_ ガード(v32) はそのまま。C は「入口の意味付け」を足すだけ。
- **SNS自動投稿・施設・create-checkout の金額/在庫ロジック**: 非接触。

---

## 8. King の決定事項
1. **方式**: `pending`→`awaiting_payment` 置換（pendingは制約に残す）＝推奨 / 完全廃止 / 別案。
2. **進捗バー**: `awaiting_payment` で OrderStatusBar を非表示にする（推奨）か、step 0 表示するか。
3. **実装タイミング**: 今すぐ実装に着手 / 設計レビューのみで 7/1 後に実装。
4. **complete-order の追加ガード**（status明示リジェクト）を入れるか（推奨: 入れる）。

---

> 次アクション: King の方式決定 → migration SQL（確認→実行→結果確認の3点セット）→ フロント → create-checkout の順で、各段階 King 承認のうえ実装。

---

## 9. 再評価 (2026-06-15・②-1/②-2 完成後)

①B(決済待ち表示・作業開始ボタン廃止)・②v32(未決済送金拒否 pi_ガード)・②-1(自動完了もpi_ガード継承) の実装後、C の当初目的がどこまで達成されたかを再評価。

### C の当初目的 vs 現状
| C の狙い | 現状の達成手段 | 達成度 |
|---|---|---|
| **未決済の誤送金防止** | **v32 pi_ガード**(cs_拒否・status非依存)＋②-1継承 | ✅ **完全達成**(status分離に依存しない最強の防御) |
| 出品者が未払いを「対応可能」と誤認 | ①B: pending=「決済待ち」表示・作業開始ボタン無し / activeフィルタ pending除外 | ✅ 概ね達成 |
| (残存) 販売管理バッジが未払いを計上 | `pendingSalesCount` が `["pending","working"]` を数える | ⚠️ 1箇所のみ残存(操作不可・ラベル明確だが数字が膨らむ) |

### 結論
- **誤送金リスク = v32 で完全に閉じている**（status分離の有無と無関係）。C の安全目的は既に達成済。
- 出品者の誤認 = ①B で大部分解消。**唯一の具体的残存は「バッジ計上」1箇所** → これは `pendingSalesCount` の `["pending","working"]` → `["working"]` の **1行修正**で閉じる(フルCより遥かに安価)。
- フルC(awaiting_payment 分離) が今 追加する価値は **(a)コード明瞭性(`pending`の多ドメイン重複解消) (b)構造的保証(将来の新クエリが pending を誤って対応可能扱いしない)** の2点＝**保守性/堅牢性の改善であって、Dday安全要件ではない**。

### 推奨
- **C は Dday必須ではない**（安全目的は v32 で達成済）。
- **小修正のみ推奨**: `pendingSalesCount` を `["working"]` に（残存1箇所を閉じる・1行）。
- **フルC は Dday後に回す or 任意**（明瞭性改善として）。awaiting_payment の DB 制約・create-checkout 変更は未適用のまま(中間状態なし)＝いつでも判断可能。
