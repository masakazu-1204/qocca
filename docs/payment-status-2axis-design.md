# 決済/注文ステータス 2軸化 設計書（payment_status × fulfillment_status）

> 作成: 2026-06-15 / 状態: **設計のみ（未実装・King レビュー用）**
> 背景: [世界標準レビュー](payment-status-world-standard-review.md) で「決済軸×フルフィルメント軸の2軸」が世界標準と確認。現 orders は3件(=最安全な移行窓)。
> 方針: **expand-contract（追加・並行稼働・各段階可逆・King承認・確認SQL付き）**。送金本体(transfer/fee/v29/v30/v32/v33/v34)は追加・並行で**1行も壊さない**。

---

## 1. 目標スキーマ（世界標準=Shopify/Stripe準拠）

`orders` に2列を追加（既存 `status` は移行期間 並存）。

### 1-A. `payment_status`（決済軸 / Shopify financial_status 準拠）
| 値 | 意味 | Stripe対応 |
|---|---|---|
| `awaiting_payment` | 注文作成・未決済 | Checkout Session(cs_) 作成済・PaymentIntent 未succeeded |
| `paid` | 決済成立 | checkout.session.completed / PaymentIntent succeeded (pi_) |
| `refunded` | 全額返金 | charge.refunded(全額) |
| `partially_refunded` | 部分返金（**将来**） | charge.refunded(部分) |
| `expired` | 期限切れ・失敗で無効 | checkout.session.expired / async_payment_failed |
| `authorized` | 与信のみ（**将来**・capture前） | PaymentIntent requires_capture |

> Dday時点で実際に使うのは `awaiting_payment`/`paid`/`refunded`/`expired` の4値。partially_refunded・authorized は CHECK 制約に**含めておくが書き込みは将来**（拡張耐性）。

### 1-B. `fulfillment_status`（フルフィルメント軸 / Shopify fulfillment_status 準拠）
| 値 | 意味 |
|---|---|
| `unfulfilled` | 未着手（決済前 or 作業開始前） |
| `working` | 作業中（決済成立後） |
| `delivered` | 納品済み |
| `completed` | 受取確認 or 自動完了（取引成立・送金解放） |
| `disputed` | 異議申立中 |
| `cancelled` | キャンセル（フルフィルメント中止） |
| `shipped` | 発送済み（**将来**・物理配送追跡②-4と連動） |

> 送金可否(transfer_status: pending/paid/failed/cancelled)・エスクロー(escrow_status)は**既存列のまま**（第3の軸として元々分離済）。2軸化はあくまで「決済」と「フルフィルメント」の分離。

### 1-C. 2軸の直交イメージ
```
payment_status:      awaiting_payment ──(決済成立)──► paid ──(返金)──► refunded
                            │(期限切れ)                  │
                            ▼                            │
                         expired                         │
fulfillment_status:  unfulfilled ─► working ─► delivered ─► completed
                                       └────────► disputed / cancelled
```
返金は payment_status のみ変え **fulfillment_status は文脈保持**（「completed なのに refunded」=納品後返金 が表現可能）← 世界標準の利点。

---

## 2. 現 `status` → 新2軸 完全マッピング

| 現 status | 判定材料 | payment_status | fulfillment_status |
|---|---|---|---|
| `pending` | pi_前提=未決済 | `awaiting_payment` | `unfulfilled` |
| `working` | 決済済(pi_) | `paid` | `working` |
| `delivered` | 決済済 | `paid` | `delivered` |
| `completed` | 決済済(送金済/pending問わず) | `paid` | `completed` |
| `disputed` | 決済済 | `paid` | `disputed` |
| `cancelled` (cs_=未決済で期限切れ) | stripe_payment_intent_id NOT LIKE 'pi_%' | `expired` | `cancelled` |
| `cancelled` (pi_=決済後にキャンセル) | stripe_payment_intent_id LIKE 'pi_%' | `paid`※or refunded | `cancelled` |
| `refunded` | 返金済 | `refunded` | (直前のfulfillment保持・なければ `completed`) |

### 既存3件の具体マッピング（バックフィル）
| order | 現status | pay_ref | → payment_status | → fulfillment_status |
|---|---|---|---|---|
| cancelled×2 | cancelled | cs_ | `expired` | `cancelled` |
| completed×1 | completed | pi_ | `paid` | `completed` |

→ **バックフィルSQL（P1で実行・確認付き）**:
```sql
UPDATE orders SET
  payment_status = CASE
    WHEN status='refunded' THEN 'refunded'
    WHEN status IN ('pending') THEN 'awaiting_payment'
    WHEN status='cancelled' AND COALESCE(stripe_payment_intent_id,'') NOT LIKE 'pi_%' THEN 'expired'
    WHEN status='cancelled' THEN 'paid'   -- 決済後キャンセル(レア)
    ELSE 'paid'                            -- working/delivered/completed/disputed
  END,
  fulfillment_status = CASE
    WHEN status='pending' THEN 'unfulfilled'
    WHEN status='working' THEN 'working'
    WHEN status='delivered' THEN 'delivered'
    WHEN status='completed' THEN 'completed'
    WHEN status='disputed' THEN 'disputed'
    WHEN status IN ('cancelled') THEN 'cancelled'
    WHEN status='refunded' THEN 'completed'  -- 文脈不明な既存返金は completed 起点とみなす
    ELSE 'unfulfilled'
  END
WHERE payment_status IS NULL OR fulfillment_status IS NULL;
```

---

## 3. Stripe 同期（payment_status の真実ソース）

| トリガー | payment_status | fulfillment_status |
|---|---|---|
| create-checkout INSERT | `awaiting_payment` | `unfulfilled` |
| webhook `checkout.session.completed` | `paid` | `working` |
| webhook `checkout.session.expired`/`async_payment_failed` | `expired` | `cancelled` |
| webhook `charge.refunded` | `refunded` | （不変＝文脈保持） |
| markDelivered | (不変 `paid`) | `delivered` |
| complete-order 成立 | (不変 `paid`) | `completed` |

> Stripe PaymentIntent.status が決済の真実、Qocca payment_status はそれを webhook で写像（Stripe公式の「決済status と注文status を分離」に準拠）。

---

## 4. expand-contract 4段階 安全移行（各段階 可逆・King承認・確認SQL）

### Phase 1（expand）: 列追加＋バックフィル ※既存挙動ゼロ変更
- DDL: `payment_status`/`fulfillment_status` 追加（nullable→backfill→CHECK制約）。既存 `status` 不変。
- §2 バックフィルSQL 実行（3件・確認SQL→実行→結果確認）。
- **コード変更なし＝挙動完全不変。**
- ロールバック: `ALTER TABLE orders DROP COLUMN payment_status, DROP COLUMN fulfillment_status;`（追加のみなので無害）。

### Phase 2（dual-write）: 全所で新2軸も書く ※読みは旧statusのまま
- create-checkout / stripe-webhook / complete-order / markDelivered を、旧 `status` 書き込みに**加えて**新2軸も書くよう変更（§3）。
- 読み取り側（フロント/ガード）は**まだ旧 `status`**。＝挙動不変、ただし新2軸が正しく並走するか検証可能に。
- 検証: 新規/既存遷移で `status` と (payment_status,fulfillment_status) が §2 マッピング通り一致するか SQL で照合。
- ロールバック: 各 fn を1つ前のバージョンへ（旧 status が依然 真実ソース）。

### Phase 3（read-switch）: 読み取りを新2軸へ ※dual-write 継続
- フロント表示（statusLabel/OrderStatusBar/フィルタ/バッジ）と各ガードを **payment_status/fulfillment_status 参照**へ切替。
  - 例: ①B「決済待ち」= `payment_status='awaiting_payment'`。販売管理バッジ = `fulfillment_status='working'`。
  - ②-1 cron 抽出 = `fulfillment_status='delivered' AND auto_complete_at<=now`。
- 旧 `status` はまだ dual-write 継続（保険）。
- 検証: 全画面・全ガードを新軸で実描画＋ロジック確認（②-1同様 実機）。
- ロールバック: 読み取りを旧 status へ戻す。

### Phase 4（contract）: 旧 `status` 縮退
- 旧 `status` への依存を除去。安全策として **`status` を生成列(generated)**として残す or 当面 dual-write 維持（完全削除は最後）。
- ロールバック: 生成列なら無害・即復帰可能。

---

## 5. 既存防御が2軸化後も全部効くことの確認

| 防御 | 2軸化後 | 担保 |
|---|---|---|
| ①B 決済待ち表示・作業開始ボタン廃止 | `payment_status='awaiting_payment'` で表示・ボタン無し | P3で参照切替・実機確認 |
| **v32 pi_ガード**（未決済送金拒否） | **そのまま維持**（pi_ チェックは payment_status と独立）。任意で `payment_status='paid'` 二重チェック追加可 | 変更しない＝最強の防御を温存 |
| ②-1 自動完了 cron / v33 system認可 / v34 | 抽出条件を `fulfillment_status='delivered'` に置換（P3）。eligibility/pi_/payouts/v29 は不変 | system経路・全ガード継承 |
| v29 二重送金封鎖 / transfer_status / escrow_status | **完全に独立**（2軸化と無関係） | 非接触 |

→ **送金本体(transfer/fee/v29/v30/v32/v33/v34) は一切触らない。** 2軸化は「決済前後の表現」を整えるだけで、お金を動かすロジックには追加・並行でしか関与しない。

---

## 6. ⚠️ K2 との並行（優先度の明示）
- **Dday(7/1) の真のブロッカーは K2（全出品者 `stripe_payouts_enabled=false`＝status設計が完璧でも誰も送金されない）。**
- 2軸化は「正しさ・拡張性」、K2は「取引が成立するか」＝**K2の方がDday優先度は高い**。
- 本2軸化は **K2(出品者のStripe Connect連携促進)を後回しにしない**ことを条件に進める。2軸化の各Phase承認待ちの隙間でK2導線（リマインド等）を並行で進めるのが理想。

---

## 7. 移行の安全性まとめ
- **今が最安全窓**：orders 3件・実トラフィックなし。Phase4(数千件)より桁違いに安全。
- 各Phaseが**追加的・並行・可逆**（ビッグバン切替なし）。旧 `status` が P3 まで真実ソースとして生き続ける＝いつでも戻せる。
- 送金本体 非接触。防御 全継承。
- **King 承認を各Phaseで取り、確認SQL→実行→結果確認**（②-1と同じ慎重さ）。

---

## 8. 未決定事項（King 判断）
1. `cancelled`/`expired` の扱い：上記マッピングでよいか（未決済期限切れ→payment=expired/fulfillment=cancelled）。
2. 旧 `status` の最終形：生成列(generated)で残す vs 完全削除（推奨: 当面 生成列で残し安全確保）。
3. 着手タイミング：K2 と並行で Phase 1 から始めるか、K2 を先に一段落させてからか。

---

## 追記 (2026-06-15): Phase1-3 完了・Phase4 は安定後の仕上げ
- **Phase1(列追加+backfill)・Phase2(dual-write)・Phase3(読み切替)= 完了・本番反映済**（PR #25 マージ・実機確認OK）。挙動は新2軸ベースで稼働。
- **Phase4(旧 `status` 縮退)= 急がない**。dual-write で旧 status も維持＝当面そのままでも無害。#25安定（実取引で2軸が正しく回るのを確認）後に、旧 `status` を生成列(generated)化 or 縮退する**最後の仕上げ**として実施。投機的に今やらない。
