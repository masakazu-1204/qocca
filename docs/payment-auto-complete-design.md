# ②-1 注文の自動完了 (auto-complete) — 設計書

> 作成: 2026-06-15 / 状態: **設計のみ（未実装・King承認待ち）**
> 位置づけ: 総点検 ②-1。買い手が「受取確認」を押さないと `delivered` のまま→出品者へ永遠に送金されない致命欠陥の解消。UIは既に「72時間後に自動完了」と表示済（[audit-backlog](audit-backlog-2026-06-15.md)）。
> ⚠️ 送金を**無人で自動実行**するため最厳重。本書時点でコード・DB・cron は一切未変更。

---

## 1. 現状（実コード根拠）

| 要素 | 現状 |
|---|---|
| `orders.auto_complete_at` 列 | **存在する**（が誰もセットしてない・誰も処理してない） |
| `markDelivered`(SalesTab) | `status=delivered` + `delivered_at` のみ更新。**`auto_complete_at` 未セット** |
| pg_cron | 注文自動完了ジョブ **無し**（blog/SNS/event/shipping-cleanup のみ） |
| `complete-order` v32 | 受取確認の本体。`verify_jwt:true` ＋ **v30で buyer本人/admin のJWT認可必須** |

### complete-order v32 のガード（順序）
1. `transferred_at` 有り → 二重送金拒否
2. status が `working`/`delivered` 以外 → 拒否
3. **v32 pi_ガード**：`stripe_payment_intent_id` が `pi_` で始まらない（=未決済 cs_）→ **送金拒否**
4. **v30 認可**：JWTのcallerが buyer本人 or admin でなければ 401/403 ← ★cronはここを通れない
5. seller が `stripe_account_id` 無 or `stripe_payouts_enabled=false` → **completed + transfer_status=pending（送金せず）**（K2整合）
6. v29 原子的クレーム（`transferred_at is null` 条件付きUPDATE）＋ Stripe `Idempotency-Key` → 二重送金封鎖
7. Stripe transfer 実行 → completed/released_seller/paid

---

## 2. 設計方針：「complete-order を最大限再利用、v30認可だけ system 経路で安全に迂回」

送金・手数料・冪等・pi_ガード・payouts判定は **complete-order に1本化されてる**。自動完了専用に送金ロジックを複製するのは禁じ手（ドリフト・二重実装リスク）。
→ **cron は complete-order を呼ぶ**。買い手JWTが無い問題だけを、**service_role を知る者＝システムのみが通れる system 認可経路**で解決する。

### 変更点（3つ）

#### (A) `markDelivered`（フロント・小）
- `status=delivered` 更新時に **`auto_complete_at = now + 72h`** を併せてセット。
- 既存 delivered 行（auto_complete_at=null）は **バックフィルSQL**（`delivered_at + 72h`、確認→実行→結果確認の3点セット）。

#### (B) `complete-order`（careful・追加のみ）
- v30 認可の**手前**に system 認可分岐を追加（既存ロジックは1行も変えない・追加のみ）:
  ```
  // system(cron) 認可: service_role 鍵を持つ呼び出し かつ body.system===true の時のみ buyer認可をスキップ
  // ⚠️ 追加の安全条件: status==='delivered' かつ auto_complete_at <= now でなければ system でも拒否
  //   (system が working や期限前の注文を勝手に完了できないように)
  if (body.system === true && authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    if (order.status !== "delivered" || !order.auto_complete_at || new Date(order.auto_complete_at) > new Date()) {
      return 400 "not_eligible_for_auto_complete";
    }
    // → buyer認可スキップして続行
  } else {
    // 既存 v30 認可（buyer本人/admin）そのまま
  }
  ```
- ⚠️ **pi_ガード(v32)・payouts判定(K2)・v29冪等 は完全に そのまま効く**（system経路でも上記1〜7を通る）。

#### (C) 新 `auto-complete-orders`（cron ターゲット・新規 edge fn）
- `verify_jwt:false`（gateway通過用）だが**先頭で service_role/秘密チェック**（外部から叩かれても弾く）。
- 対象抽出（**厳格フィルタ**）:
  ```sql
  status = 'delivered'           -- working/disputed/cancelled は対象外（買い手保護）
  AND auto_complete_at <= now()  -- 72h 経過
  AND transferred_at IS NULL     -- 未送金のみ
  ```
- 各注文に対し complete-order を **system経路**で呼ぶ（`{order_id, system:true}` ＋ `Authorization: Bearer <service_role>`）。
- 完了後 `order_complete` メール（既存テンプレ）を buyer/seller へ。
- 件数・成功/失敗を log。

#### (D) pg_cron
- `auto-complete-orders` を **毎時**実行（`0 * * * *`）。72h判定はfn側なので頻度は粗くてOK。

---

## 3. King の質問への回答（安全性検証）

| 質問 | 回答 |
|---|---|
| **自動完了でも v32 pi_ガードは効くか？（無人で未決済を送金しないこと）** | ✅ **効く**。auto-complete は complete-order を呼ぶ＝**ガード3(pi_)を必ず通る**。未決済(cs_)注文は system 経路でも `payment_not_completed` で送金拒否。無人で立替送金は起きない。 |
| **seller payouts 無効なら送金されないか？（K2整合）** | ✅ **整合**。complete-order のガード5がそのまま効く＝`stripe_payouts_enabled=false` なら **completed + transfer_status=pending（送金せず）**。お金は動かない。K2解消後に別途送金導線が必要（=K2課題のまま）。 |
| **72時間の根拠・買い手保護（異議申立との関係）** | delivered から72h＝買い手が「受取確認 or 異議申立」する猶予。**disputed は cron 対象外**（status=delivered のみ抽出）なので、異議中の注文が勝手に完了することはない。72h は UI既出の約束値。**platform_settings でパラメータ化推奨**（King がDday運用で調整可能に）。 |
| 対象は delivered のみか（working は？） | ✅ delivered のみ。working（未納品）を自動完了＝未納品送金になるので**絶対に対象外**。 |

---

## 4. リスク評価
- **送金ロジック本体: 不変**（complete-order の transfer/fee/v29/v32/payouts は1行も変えない。system認可分岐の追加のみ）。
- **多層防御 全継承**: pi_(v32)・payouts(K2)・冪等(v29)・二重送金(transferred_at/Idempotency-Key)。
- **system経路の濫用防止**: service_role鍵必須 ＋ status=delivered ＋ auto_complete_at経過 の三重条件。外部から完了できない。
- **disputed保護**: 異議中は対象外。
- **段階導入可能**: (A)markDelivered+バックフィル → (B)complete-order system認可 → (C)auto-complete-orders → (D)cron、の順で各段階検証。cron(D)を最後に有効化するまで無人送金は起きない。

---

## 5. 実装順序（各段階 King 承認）
1. **(A)** markDelivered に auto_complete_at + 既存delivered バックフィルSQL（確認→実行→結果確認）
2. **(B)** complete-order v33: system認可分岐追加（deploy前にコード提示）
3. **(C)** auto-complete-orders fn 作成（手動テスト: 期限切れdelivered 1件で送金成立を確認）
4. **(D)** pg_cron 有効化（最後・無人運転開始）

> ⚠️ (C)の手動テストでは「未決済(cs_)注文は拒否される」「payouts無効は送金されない」「disputedは対象外」を実証してから (D) を有効化する。

---

## 6. 未決定事項（King 判断）
1. 72h を固定 vs `platform_settings` でパラメータ化（推奨: パラメータ化）。
2. cron頻度（推奨: 毎時）。
3. 自動完了時の通知メール（推奨: order_complete を buyer/seller 両方へ）。
4. 既存 delivered 行のバックフィル要否（現状 delivered 注文が在るか先に確認）。
