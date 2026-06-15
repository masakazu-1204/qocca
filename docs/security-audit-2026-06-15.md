# セキュリティ棚卸し（攻撃者目線・世界水準評価） 2026-06-15

> 調査のみ・無変更。Supabase 公式 advisor ＋ RLS/ポリシー/関数/フロント秘密/ストレージを精査。
> ⚠️ 修正は King 承認後 各段階で。送金本体は触らない。

---

## 0. 総評
**致命的な穴（全破壊級）は無い。** 世界水準の基礎は満たしている：
- ✅ 機密表 **全てで RLS 有効**（orders/profiles/shipping_addresses/listings/payouts/disputes/pets/reviews/direct_messages/admins/platform_settings/crowdfunding_*）
- ✅ orders/shipping_addresses の **ポリシーは所有者スコープ＝IDOR なし**（他人の注文/住所は見えない）
- ✅ **フロントに service_role 露出なし**（`sb_publishable_` 公開キー使用＝正しい）／.env 未コミット
- ✅ 決済多層防御（v32 pi_/v29 冪等+原子的クレーム/v30 認可/v33-34 system）＝本セッションで実機実証済
- ✅ 管理系関数（admin_*）は内部で `is_admin()` チェック

**発見は中2件＋低/ハードニング多数。全て分割と無関係の既存事項**（DB/関数/バケットはバックエンド＝App.tsx分割で非接触）。

---

## 1. 発見一覧（重要度 × 世界水準評価 × 起因）

### 🟠 MEDIUM（Dday前に対応推奨・低コスト）
| # | 内容 | リスク | 修正 | 起因 |
|---|---|---|---|---|
| **S1** | ✅**対応済(2026-06-15)** `reduce_variant_stock` が **anon/PUBLIC 実行可・内部authzなし** | anon が他人の**在庫を0枯渇→偽sold-out**(griefing) | ✅ `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`（**PUBLIC含むのが肝**）。結果: anon/authed=不可・service_role=可。create-checkout購入フロー無傷確認済 | 既存 |
| **S2** | ✅**一部対応済(2026-06-15)** `profiles` SELECT=`true` で内部列(stripe_account_id/role/fee_tier/trust_level等)が anon露出 | 内部/ビジネス情報の露出(PII/認証情報ではない=低〜中) | ✅ **列権限化**: anon/authenticated から表SELECT剥奪→公開安全列のみ列GRANT。**7列隠蔽**(role/stripe_account_id/stripe_connect_status/stripe_charges_enabled/fee_tier/suspended_until/trust_level)。anon実読みテストで stripe_account_id 拒否・公開列OK確認。service_role全列維持。<br>⚠️**残6列は post-Dday**(下記) | 既存 |

### 🟡 LOW / ハードニング（Dday後でOK）
| # | 内容 | リスク | 修正 | 起因 |
|---|---|---|---|---|
| S3 | `grant_badge_with_tier_replace` anon実行可・内部authzなし | anon が他人に**バッジ偽装付与**（整合性・低影響） | `REVOKE EXECUTE FROM anon, authenticated`（trigger/評価関数からのみ呼ぶ） | 既存 |
| S4 | `events_monthly_cost_status` が **SECURITY DEFINER ビュー**(advisor ERROR) | RLS迂回でビュー定義者権限で実行。中身=イベント費用監視(管理用) | `ALTER VIEW ... SET (security_invoker=on)` or アクセス制限 | 既存 |
| S5 | `_facility_name_backup_146a` が **RLS無効**(advisor ERROR) | バックアップ表(施設名=元々公開データ)が anon 読取可 | **不要なら DROP**（依頼#146の作業残骸）／残すなら RLS 有効化 | 既存 |
| S6 | ストレージ **7バケットが listing 許可** | ファイル列挙(enumeration)可。avatars/gallery は公開前提だが列挙は別 | 不要バケットの public listing 無効化 | 既存 |
| S7 | `function_search_path_mutable` ×49 | SECURITY DEFINER 関数で search_path 未固定＝search_path injection 余地 | 各関数に `SET search_path=public`（admin_moderate_* は設定済） | 既存 |
| S8 | anon/authenticated 実行可の SECURITY DEFINER 関数 計60(S1/S3以外) | 大半は admin_*=内部is_admin で安全 / 読取helper=安全。**内部専用の変更系は全数 EXECUTE 棚卸し推奨** | 内部専用関数は anon/authenticated から `REVOKE EXECUTE` | 既存 |
| S9 | `pg_trgm`/`pg_net` が public スキーマ | ハードニング | extensions スキーマへ移動 | 既存 |
| S10 | Leaked Password Protection OFF (INFO) | 漏洩既知パスワードを許容 | Supabase Auth で HaveIBeenPwned チェック ON | 既存 |
| S11 | Edge Function に **アプリ層レート制限なし** | 乱用/総当たり。但し Supabase gateway 既定制限＋complete-order は v29 冪等で二重送金不可 | 重要fnに rate limit 検討(post-Dday) | 既存 |
| S12 | **CRON_SECRET が `cron.job.command` に平文**（jobid 28 auto-complete-orders・jobid 増 retry-pending-payouts も同方式・King設定） | DB読取権限者(service_role/admin SQL)に cron 認可秘密が露出。但し外部からは不可視・gateway内・edge env と同値 | post-Dday: cron 秘密を **vault化**（`vault.create_secret`＋`cron.job` から `vault.decrypted_secrets` 参照）／または service_role 経路へ統一 | 既存 (F1/②-1 で顕在化) |

---

## 2. ✅ 健全（世界水準で問題なし）と確認した項目
- **RLS**: 機密表 全て有効。`crowdfunding_codes` は RLS有+0ポリシー=deny-all完全ロック。
- **IDOR**: orders=`auth.uid()=buyer_id OR seller_id`(当事者のみ) / shipping_addresses=本人+admin+当該注文seller / profiles UPDATE=`auth.uid()=id`(本人のみ)。**他人のリソースID直叩きで読めない**。
- **フロント秘密**: service_role 露出なし。publishable キーのみ。
- **決済認可/二重防止**: v32(未決済送金拒否)・v29(Idempotency-Key+原子的クレーム)・v30(buyer/admin認可)・v33/v34(system厳格eligibility)＝本セッションで実機実証。
- **SQLインジェクション**: フロントは supabase-js(パラメータ化)＋edge は parameterized 呼び出し。生SQL文字列連結は確認範囲で無し。
- **管理関数**: admin_* は内部 `is_admin()` で保護。

---

## 3. 起因の切り分け
**全項目 分割(App.tsx split)と無関係の既存事項。** 分割はフロントのみで DB/RLS/関数/バケット/Edge認可 に非接触。今回の総点検で「ついでに」世界水準で洗い出した既存ハードニング項目。

---

## 4. Dday 優先度つき推奨
- ✅ **Dday前（完了）**: S1(在庫griefing REVOKE・PUBLIC含む)・S2(profiles 7列 列権限隠蔽)。
- **Dday後（ハードニング）**: S2残6列のビュー化 ＋ S3-S11。

### ⚠️ S2 残課題（post-Dday・「中途半端にせず完全分離」）
列権限では「anon遮断・admin/owner許可」を行スコープで分離できないため、下記6列は今回 公開列として残置。**post-Dday に `public_profiles` ビュー化＋base profiles の SELECT を owner+admin限定RLS(`auth.uid()=id OR is_admin()`)** に変え、フロントの他者profile読み(約8-10箇所)をビューへ切替して**完全分離**する：
- `is_suspended` / `warning_count`（管理UI=authenticated admin が読む）
- `stripe_onboarded`（商店街TOPの公開バッジ）
- `founding_creator_fee_rate` / `early_supporter_expires_at`（owner が自分の表示用に読む）
- `stripe_payouts_enabled`（購入導線で seller の連携状態表示）

- 各修正は **確認→影響範囲→実行→結果確認**＋ロールバックで、②-1 と同じ慎重さで。
- S3-S12: S8(EXECUTE全数棚卸し)・S7(search_path)・S4/S5(ERROR 2件掃除)・S6(bucket listing)・S9-S11・S12(cron秘密 vault化)。

> ⚠️ 並行: K2(出品者 Stripe Connect 連携)は依然 Dday 最優先（送金成立の前提）。本セキュリティ修正はそれを後回しにしない範囲で。
