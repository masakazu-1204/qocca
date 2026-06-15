# 分割完了後 総点検バックログ（仕分け台帳）

> 作成: 2026-06-15 / 分割プロジェクト(Phase 0〜8b)完了直後の全体総点検で洗い出した項目。
> ⚠️ 全て**コード/cron/DB/実描画で裏取り済**。実装要否・Dday前後の仕分けは King 判断。
> 関連: [app-split-plan.md](app-split-plan.md)(教訓L1-L3) / [payment-C-awaiting-payment-design.md](payment-C-awaiting-payment-design.md)(C設計)

---

## 状態凡例
- ✅ 対応済 / 🔧 対応中 / ⬜ 未着手 / 🟢 健全（対応不要）

---

## ① しょうもないバグ / ポリッシュ

| # | 状態 | 内容 | 根拠 | 深刻度 |
|---|---|---|---|---|
| ①-1 | ⬜ | `alert()`/`confirm()` 多用（成功・エラー・確認が素のブラウザダイアログ）。静けさ世界観＆「！禁止」に反する | mypage 34 / marketplace 13 / community 7 | 中 |
| ①-2 | ✅ | 「72時間後に自動完了」が表示だけで未実装 → **②-1で実装完了**（cron jobid 28 稼働中） | OrdersTab文言 vs cron無し | 高 |
| ①-3 | ⬜ | home「今日のうちの子たち」0件時に見出しだけ残る（空状態文言なし） | home.tsx:1077 emptyブランチ無し | 低 |
| ①-4 | ⬜ | ローディングが英語"Loading..."（home他）。世界観・日本語UIと不一致 | home.tsx:1075 | 低 |
| ①-5 | ✅ | 納品しても買い手に通知が飛ばない → **②-2で実装完了**（delivery_notice メール） | markDelivered にメール無し | 中 |

### 🟢 確認して健全だったもの
- 二重送信ガード：出品`submitting`／購入`ordering`／受取確認`confirming` 有り
- 空状態文言：多くのリストでカバー有り
- モバイル横はみ出し：home / search を375pxで検査＝offenderゼロ

### ⚠️ 未カバー（King実機 or 追加調査向き）
ログイン必須フロー（出品フォーム実入力・購入確認モーダル実描画・プロフ/ペット編集）／全カード長文はみ出し／PC細部レイアウト。

---

## ② 絶対必要な機能（取引成立レベル）

| # | 状態 | 機能 | なぜ必須か | 規模 | 根拠 |
|---|---|---|---|---|---|
| 🔴②-1 | ✅ **完了・本番稼働** | **注文の自動完了ジョブ** | 買い手が受取確認を押さないと `delivered` のまま→出品者へ永遠に送金されない | A→B→C→v34→D 全段階 | **実装済**: markDelivered(A)+complete-order v33/v34 system認可(B/v34)+auto-complete-orders fn(C)+pg_cron jobid 28 毎時(D)。4項目実機実証(未決済拒否/payouts無効pending/disputed除外/期限前除外・送金ゼロ)。キルスイッチ=`select cron.unschedule('auto-complete-orders-hourly');`。設定=`platform_settings.auto_complete_hours=72`。多層防御(pi_/payouts/v29)全継承。[payment-auto-complete-design](payment-auto-complete-design.md) |
| 🔴②-2 | ✅ **完了** | **納品通知メール（出品者→買い手）** | 納品しても買い手が気づけず受取確認されない | 小（send-email再利用） | **実装済**: markDelivered で既存 `delivery_notice` テンプレを invoke（best-effort・送金非接触）。PR #20 |
| 🔴②-3 | 🔧 **技術担保完了/運用は継続** | **K2: 出品者の Stripe Connect 連携** | 出品者全員 `stripe_payouts_enabled=false`＝送金不可。Dday最優先 | 受動設計（促進導線・バナー）＋技術担保 | **受動設計の技術担保 完了**: F2(見える化)+F1(届く化)。下記参照。残=King の連携促進(運用) |

### K2 受動設計の技術担保（F2＋F1）= 完了 2026-06-16
King 方針: 能動営業せず「案内・決済バーで促進＋月締め月払い」。それを技術で担保する2点：
- **F2 見える化 ✅** (complete-order v36/deployed v37): payouts未連携の completed+pending でも `seller_payout/qocca_fee/stripe_fee/fee_tier_used` を**実額保存** → `seller_balances.pending_balance` に「待っている売上」が出る。送金本体不変・再取得照合済。
- **F1 届く化 ✅** (complete-order v37/deployed **v39**＋`retry-pending-payouts` fn v1＋日次cron): 連携完了後に固着pending(`completed`+`transfer_status∈pending/failed`+`transferred_at null`)を送金。
  - **(B1)** complete-order 入口ガードに固着pendingを追加許可＋v33 system条件に固着追加。送金本体(pi_/v29/v30/Idempotency/transfer/fee)は1行も不変。
  - **(B2)** `retry-pending-payouts` fn(dual-auth・dry_run・verify_jwt:false)が complete-order(system)を呼ぶだけ。
  - **cron**: `retry-pending-payouts-daily`・日次 UTC17:00(JST02:00)。**キルスイッチ=`SELECT cron.unschedule('retry-pending-payouts-daily');`**
  - **実証(お金動かない3項目)**: dry_run抽出(送金済は除外=二重送金第1層)/空振り(payouts無効→pending維持)/未決済cs_はpi_ガード拒否。本物`tr_`ゼロ・seller=payouts無効固定で送金パス構造的到達不可・テスト注文クリーンアップ済。
  - ⚠️ **未実施(意図的)**: 「payouts**有効**seller＋固着→1回だけ実送金・二重にならない」の**実額検証**は、本番LIVE実注文を作らない方針のため **King 管理下の少額実取引でのみ別途実施**。今回は送金本体に到達しない範囲で多層防御を実証。
  - ⚠️ deploy 事故記録: complete-order v38 で入口ガードに転記ミス(`!!`二重否定→正常注文拒否)→約4分(JST 04:08-04:12)後 v39 で即修正。影響ゼロ確認済(全注文 touched_in_bad_window=false・完了取引 QOC-2026-9109 不変)。
  - docs: [payment-F1-retry-pending-payouts-design.md](payment-F1-retry-pending-payouts-design.md)
| 🟡②-4 | ⬜ | 配送追跡番号 | 物理配送で買い手が追跡できない（DMで代替可） | 小（列＋UI） | orders に tracking列なし |
| 🟡②-5 | ⬜ | 買い手起点のキャンセル/返金 | 決済後の自動キャンセル/返金が無い（現状 異議申立→手動サポート） | 中（Stripe refund + status） | DisputeModal=手動のみ |

### Dday(7/1)必須ライン
🔴②-1・②-2・②-3 ＝「無いと取引が完結せず出品者にお金が渡らない」レベル＝**必須**。🟡②-4・②-5 ＝少数取引なら手動運用で凌げる＝King判断。

---

## 既存課題（分割無関係・別記録）
- K1: 施設「もっと見る」duplicate-key警告（[app-split-plan.md](app-split-plan.md) 既知バグ表）
- createClient 多重（Multiple GoTrueClient 構造債・CLAUDE.md既知）
- tsc ~684件の緩い型ノイズ（implicit any / never型）= `npm run typecheck` の TS2304(未定義参照)ゼロを合格基準に運用、型ノイズ撲滅は別Phase候補
