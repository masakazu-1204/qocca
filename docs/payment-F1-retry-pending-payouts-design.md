# F1: pending売上の再送金経路 設計書（連携完了後に過去売上を届ける）

> 作成: 2026-06-15 / 状態: **設計のみ（未実装・King レビュー用）**
> 背景: K2検証で「未連携のまま取引完了 → completed+pending で固着 → 後で連携しても過去売上が宙に浮く」と判明。F2(見える化)済。F1は「届く化」。
> 方針: **complete-order を再利用（送金ロジックを複製しない）＋②-1 と同じ expand/確認/承認/dry_run/キルスイッチ**。送金本体は追加・並行で。

---

## 1. 現状の固着メカニズム
- 未連携seller の注文が完了 → complete-order が `status=completed, transfer_status=pending, transferred_at=null, seller_payout=実額(F2)` にする（送金せず）。
- complete-order は入口で `status IN (working,delivered)` 必須 → **status=completed を弾く**＝再処理不可。
- 他に再送金する fn/cron/trigger なし → **永遠に pending**。

## 2. F1 の2要素（complete-order 再利用）

### (B1) complete-order 入口ガードを「固着pendingの再処理」に開く（最小・送金ロジック不変）
現状: `if (!["working","delivered"].includes(status)) reject`。
変更: **`status=completed かつ transfer_status IN ('pending','failed') かつ transferred_at IS NULL`（＝固着）も通す**。
- それ以降は**既存フローそのまま**：pi_ガード(v32)→認可(v30/v33)→payouts判定→ now連携済なら v29原子的クレーム→Stripe transfer→paid。
- **二重送金防止は既存ガードがそのまま効く**：冒頭 `if (transferred_at) return "Already transferred"` ＋ v29 Idempotency-Key(`transfer_${order_id}`) ＋ 原子的クレーム。固着pendingは transferred_at=null なので claim 成功→1回だけ送金。
- payouts まだ無効なら → 既存の payouts無効パス(F2)で pending のまま（送金されない）。
- ⚠️ transfer/fee/v29/v30/v32/v33認可 ロジックは**1行も変えない**。入口ガードに「固着pending」を**追加で許可**するだけ。

### (B2) retry-pending-payouts fn ＋ cron（②-1 auto-complete-orders と同型）
- 抽出: `status='completed' AND transfer_status IN ('pending','failed') AND transferred_at IS NULL`（固着）。
- 各注文に complete-order を **system経路**（`{order_id, system:true}` + service_role）で呼ぶ。
  - ⚠️ system eligibility(v33) は現状 `status='delivered'` 必須 → 固着は status=completed なので**通らない**。→ **v33 の system 条件に「完了済の再送金」を追加許可**が必要（後述・最小追加）。
- 認可: **CRON_SECRET / service_role**（②-1 と同じ dual-auth）。
- dry_run 対応（抽出のみ・送金しない）。
- 連携完了seller の固着分だけ送金される（payouts無効なら complete-order 内で pending 維持＝空振り）。

### v33 system 条件の最小追加（B1と整合）
現 system 分岐: `status==='delivered' && auto_complete_at 経過`。
追加: **`または (status==='completed' && transfer_status IN ('pending','failed') && transferred_at IS NULL)`**（＝固着の再送金を system に許可）。他は不変。

---

## 3. expand-contract / 段階（②-1 と同じ慎重さ）
1. **(B1)** complete-order 入口ガード緩和（固着pendingを通す）＋ v33 system条件に固着を追加。**全コード提示→King確認→deploy→照合**。
2. **(B2)** retry-pending-payouts fn 作成（dual-auth・dry_run）。**コード提示→deploy→照合**。
3. **テスト**（②-1 と同方式・お金が動かない検証優先）:
   - 未決済(cs_)固着 → pi_ガードで送金拒否（ゼロ）
   - payouts無効のまま固着 → pending維持（ゼロ）
   - **payouts有効＋pi_＋固着 → 1回だけ送金**（少額実取引 or King管理下）。二重送金されない（Idempotency-Key）
4. **cron 有効化**（pg_cron・毎時 or 日次）。キルスイッチ=`cron.unschedule`。

## 4. 安全性
- 送金本体（transfer/fee/v29/v30/v32）不変。変更は「入口ガードに固着pendingを追加許可」＋「v33 system条件に固着追加」＋「新fn(呼ぶだけ)」。
- 二重送金: `transferred_at` ガード ＋ v29 Idempotency-Key ＋ 原子的クレーム で**多層防御維持**。
- 未決済固着: pi_ガードで送金拒否（無人立替なし）。
- payouts無効固着: pending維持（送金されない）。
- cron無効化までは誰も再送金を呼ばない（②-1 と同じドーマント）。

## 5. King 決定事項
1. (B2)の駆動: **cron（毎時/日次・推奨）** vs stripe-connect-status同期時に即トリガー vs 両方。
2. テストで「payouts有効＋固着」の実送金まで踏むか（少額・①-1テスト同様）/ ガード実証(お金動かない)に留めるか。
3. 着手順: F1 を Dday前に完遂するか（K2の「届く化」＝受動設計の前提）。
