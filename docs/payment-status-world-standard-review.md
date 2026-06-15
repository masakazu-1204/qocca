# 決済/注文ステータス設計 — 世界標準レビュー & 設計提案

> 作成: 2026-06-15 / 状態: **調査＋設計提案（未実装・King判断待ち）**
> 目的: Qocca の注文 status 設計を「世界水準・実績ある標準形」と比較し、C(awaiting_payment) の位置づけと将来スケール耐性を評価。
> ⚠️ 調査のみ。実装/送金本体は無変更。

---

## 1. 世界標準の核心：「決済status」と「フルフィルメントstatus」の **2軸分離**

主要プレイヤーは**注文を1つの status で表さず、直交する2軸**で持つ。

| 出典 | 決済軸 (payment/financial) | フルフィルメント軸 (fulfillment) |
|---|---|---|
| **Shopify** | `financial_status`: pending / authorized / paid / partially_paid / refunded / partially_refunded / voided / expired | `fulfillment_status`: unfulfilled / partial / fulfilled / shipped / on_hold ... |
| **Stripe**(公式推奨) | `PaymentIntent.status`(requires_payment_method→…→succeeded) が決済の真実 | **自分のDBで注文/フルフィルメント status を別管理**（webhookで遷移） |
| **メルカリ**(日本C2C) | 支払い待ち → 支払い済み | 発送待ち → 発送済み → 輸送中 → 配達済み → 受取評価 → 取引完了 |

**Stripe公式の明確な指針**：
- フルフィルメントは**クライアント側で判断せず webhook**(`payment_intent.succeeded`/`checkout.session.completed`)で。
- **「決済status = PaymentIntent」「注文/フルフィルメントstatus = 自社システム」を分離**せよ。これにより注文は決済状態と独立してフルフィルメント状態を遷移できる。

→ **世界標準 = 決済軸とフルフィルメント軸を分ける。** 出典は §7。

---

## 2. Qocca 現状 vs 標準（ギャップ分析）

Qocca は**単一 `orders.status`** に決済・フルフィルメント・終端を混在：

| Qocca status | 実際の意味 | 標準での軸 |
|---|---|---|
| `pending` | **未決済**(決済待ち) | ← 決済軸(financial) |
| `working` | 決済済み・作業中 | ← フルフィルメント軸 |
| `delivered` | 納品済み | ← フルフィルメント軸 |
| `completed` | 受取確認・送金済み | ← フルフィルメント軸 |
| `disputed` | 異議中 | ← フルフィルメント軸(例外) |
| `cancelled` / `refunded` | 終端 | ← 決済軸とフルフィルメント軸の混合 |

**ズレの本質**：`pending`(決済軸) と working/delivered/completed(フルフィルメント軸) が**1列に同居**。だから「未払いを出品者が対応可能と誤認」「`pending` が他ドメインと語衝突」が起きる。**C(awaiting_payment) はこの単一軸の中で名前を明確化するだけ＝標準の2軸化には至らない部分対応。**

**ただし重要**：Qocca は **Stripe の `stripe_payment_intent_id`(cs_=未決済 / pi_=決済済み) を事実上の決済軸**として既に持ち、v32 がそれで送金可否を判定している。＝**決済軸は「暗黙的に」既に存在**し、安全判定に使われている。

---

## 3. 将来スケール ストレステスト（多通貨・返金・分割・サブスク）

| 将来機能 | 単一status のままで問題が出るか | 評価 |
|---|---|---|
| **多通貨** | status とは直交（currency/amount 列の話）。単一statusは**障害にならない** | 🟢 status改修は不要・別途 currency 列 |
| **返金（部分・作業途中）** | 単一 `refunded` は**フルフィルメント文脈を失う**（「納品後の返金」「部分返金」を表現できない）。標準は payment軸で返金を扱い fulfillment軸は別保持 | 🟡 **最初に2軸が効く場面** |
| **分割/与信(authorize)→capture** | `authorized`(与信のみ) と `paid`(captureで確定) を区別できない（今は即capture前提） | 🟡 与信モデル導入時に必要 |
| **サブスク/継続課金** | Stripe Subscription が決済を持つ。注文status とは別概念 | 🟢 別オブジェクトで対応・status直交 |

**結論**：多通貨・サブスクは status 設計と直交＝今の単一軸でも将来詰まない。**詰まり始めるのは「返金の高度化(部分返金/作業途中返金)」と「与信→capture分離」**で、これは **Phase 4+(全国/海外スケール)で実機能として必要になった時**に2軸化すれば足りる。

---

## 4. C(awaiting_payment) の位置づけ（世界標準の観点）

- C = 単一軸の中で「未決済」を `pending`→`awaiting_payment` に改名。**標準が説く2軸化の "入口" だが、本質(軸分離)には届かない中途半端**。
- 安全目的(誤送金)は **v32 で軸に依存せず達成済**。C は安全を足さない。
- C をやっても、将来 返金高度化・与信分離 が来たら結局 **2軸への本格再設計**が必要 → C は "二度手間" になりうる。

---

## 5. 推奨（世界標準 × Dday × スケール）

**(a) Dday(7/1) まで：現状維持＋小修正のみ**
- 安全は v32 で達成済。**プレ-Dday に決済status を再設計するのは高リスク**（決済根幹）＝やらない。
- 残存の誤認1箇所だけ閉じる：`pendingSalesCount` を `["working"]` に(1行)。
- (任意) 自動完了 72h は**メルカリ9日比で短い** → 買い手保護の観点で `auto_complete_hours` を見直す余地（設定値なので運用で調整可・コード変更不要）。

**(b) フルC(awaiting_payment 単独) は見送り推奨**
- 中途半端（標準の2軸に届かず、安全も既達）。やるなら(c)へ直行。

**(c) Phase 4+(スケール期)：世界標準の2軸へ本格移行**
- `orders` に **`payment_status`(awaiting_payment/paid/refunded/partially_refunded/...) と `fulfillment_status`(working/delivered/completed/disputed/...) の2列**を導入。
- 既存 `status` は移行期間 両建て→廃止。Stripe PaymentIntent を payment_status の真実ソースに同期(webhook)。
- **返金高度化・与信→capture・多通貨** を入れる「実機能の必要が出た時」に、専用migration＋十分なテストで実施（今 投機的にやらない）。

---

## 6. まとめ（King 判断用）
| 選択肢 | 世界標準適合 | Dday安全 | コスト | 推奨 |
|---|---|---|---|---|
| 現状維持＋バッジ1行修正 | △(暗黙の決済軸+単一fulfillment) | ✅(v32) | 最小 | ◎ **Ddayはこれ** |
| フルC(awaiting_payment単独) | △(2軸に未到達) | ✅(既達) | 中 | ✗ 中途半端 |
| 2軸化(payment_status + fulfillment_status) | ◎(完全準拠) | ✅ | 大 | ◎ **但しPhase 4+/機能必要時** |

→ **「Dday は最小修正、世界標準の2軸化はスケール期に本格実施」が、King の "車輪の再発明をしない＋中途半端を許さない" 思想に最も合致。** awaiting_payment 単独(フルC)は、その中間で どっちつかずになるため非推奨。

---

## 7. 出典
- Stripe PaymentIntent lifecycle / verifying status（webhookでフルフィルメント・決済statusと注文statusの分離）: https://docs.stripe.com/payments/payment-intents/verifying-status
- Stripe PaymentIntents lifecycle 解説: https://dev.to/stripe/the-paymentintents-lifecycle-4f5o
- Shopify financial_status / fulfillment_status（2軸）: https://shopify.dev/docs/api/admin-graphql/latest/enums/OrderDisplayFinancialStatus / https://help.shopify.com/en/manual/fulfillment/managing-orders/order-status
- 状態機械ベストプラクティス（記述的命名・遷移定義・複数state machine）: https://docs.commercetools.com/learning-model-your-business-structure/state-machines/states-and-best-practices
- メルカリ 取引の流れ（支払い待ち→発送→受取評価→完了 / 発送9日後 自動完了）: https://help.jp.mercari.com/guide/articles/63/ / https://help.jp.mercari.com/guide/articles/115/
