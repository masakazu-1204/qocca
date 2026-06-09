# Supabase Auth 設定: パスワード再設定 (recovery flow) セットアップ手順書 (King 用)

日付: 2026/6/9
依頼書: #138 タスク2 Step 3
所要時間: 10-15分 (Supabase ダッシュボード 5分 + preview 検証 10分)
タイミング: コード側 Step 1-2 (commit `8845013` + `5089279`) push 済 → King が本手順を実施 → preview で検証 → 本番反映

---

## 🎯 概要

パスワード再設定リンクが「ログインだけして新パスワード設定画面に進めない」バグの修正完了。
コード側は新 `/update-password` ルートで recovery セッションを受ける設計に変更済。

Supabase 側で **redirectTo URL の許可リストに `/update-password` を追加** すれば本番稼働。

---

## 📋 Step 1: Supabase ダッシュボードで Redirect URLs 追加

1. https://supabase.com/dashboard/project/qufrqkuipzuqeqkvuhkx にログイン
2. 左メニュー **Authentication** クリック
3. サブメニュー **URL Configuration** クリック
4. **Site URL** が `https://qocca.pet` になっていることを確認 (変更不要)
5. **Redirect URLs (Wildcards allowed)** セクションに以下を **すべて追加**:

```
https://qocca.pet/update-password
https://www.qocca.pet/update-password
https://*.vercel.app/update-password
```

6. **Save** ボタンをクリック

### 💡 補足
- **既存の Redirect URLs は削除せずそのまま維持**してください (OAuth コールバック等)
- `https://*.vercel.app/update-password` は **Vercel preview env での検証用**。本番反映後も残置 OK (preview ブランチで動作確認できる)。
- ワイルドカード `*` は Supabase 側でサポート済 (公式仕様)

---

## 📋 Step 2: preview env で recovery flow 検証 (本番反映前)

⚠️ **本番ユーザーへの影響を避けるため、必ず preview で検証してから判断してください**

### 検証手順 (予備アカ使用 / 約 10分)

1. **Vercel ダッシュボード** で最新の preview deployment URL を確認
   - 例: `https://qocca-abc123-masakazu-1204s-projects.vercel.app`
2. その preview URL を開く
3. ログイン画面 → **「パスワードを忘れた方」** クリック
4. 予備アカのメアドを入力 → 「メールを送信」
5. ⏰ 携帯/PC でメールを開く (Subject: 「Reset your password」)
6. メール内のリンクをタップ
7. **✅ 期待動作**: `/update-password` 画面が開く + 「新しいパスワードを設定」表示
8. 新パスワード (6文字以上) を 2回入力 → 「パスワードを変更する」
9. **✅ 期待動作**: 緑色「パスワードを変更しました」表示 → 1.8秒後にログイン画面へ自動 navigate
10. 新パスワードで再ログイン → 通常通り入れる

### 検証 NG パターン (発覚すべきこと)

| 症状 | 原因候補 |
|---|---|
| メール内リンクをタップしても /update-password に飛ばない | Step 1 の Redirect URLs 追加忘れ / Save 忘れ |
| /update-password を開いたが「無効なアクセスです」表示 | recovery token が失効 (1時間) / 既に消費済 → メール再送 |
| 「パスワードを変更する」を押すとエラー | updateUser API 失敗 (Console エラー確認) |
| 新パスワードで再ログインできない | password ハッシュ更新失敗 → Supabase Auth ログ確認 |

---

## 📋 Step 3: 通常ログイン挙動の不変確認 (preview で)

✅ 全項目 動作確認していただきたい (各 1-2分):

| # | テスト | 期待動作 |
|---|---|---|
| 1 | メアド + パスワードで通常ログイン | ホームへ navigate ✅ 不変 |
| 2 | Google でログイン | ホームへ navigate ✅ 不変 |
| 3 | X でログイン | ホームへ navigate ✅ 不変 |
| 4 | 既存セッションで再訪 | 自動ログイン状態維持 ✅ 不変 |
| 5 | サインアウト | ログイン画面へ ✅ 不変 |
| 6 | ⚠️ 通常ログイン中のユーザーが `/update-password` を直接開く | **「無効なアクセスです」エラー画面**表示 (= 自分のパスワードを誤って書き換えできない / 二重ガード) |

→ 全項目 ✅ なら **本番反映 GO**

---

## 📋 Step 4: 本番反映 (Vercel auto-deploy)

main HEAD への push は既に完了 (commit `8845013` + `5089279`)。
Vercel auto-deploy で本番反映済 / または次の deploy で反映。

**反映確認**:
1. https://qocca.pet を開く
2. ログイン画面 → 「パスワードを忘れた方」 → メアド入力
3. メールリンクタップ → `/update-password` が開けば本番反映成功 ✅

---

## 🛡️ Rollback 手順 (万が一の場合)

問題発生時の即時無効化:

### A. Redirect URLs 設定のロールバック (Supabase 側 / 5秒)
1. Supabase Dashboard → Authentication → URL Configuration
2. 追加した 3行 (`https://qocca.pet/update-password` 等) を **削除**
3. Save
→ Supabase 側で `/update-password` への redirect が拒否される (404)
→ 既存の `/?page=reset` 動作には戻らないが、recovery が「無効リンク」として安全停止

### B. コード側のロールバック (緊急時のみ)
```bash
git revert 5089279  # Step 2 (UpdatePasswordPage + Routes)
git revert 8845013  # Step 1 (AuthProvider 拡張)
git push origin claude/geo-and-x-longform-128-129:main
```
→ Vercel auto-deploy で 5分以内に旧挙動 (バグ ある状態) に戻る

⚠️ コードロールバックは **最終手段** (バグが戻るため)。通常は A だけで安全停止可能。

---

## 🔍 Supabase Auth ログ (デバッグ用)

問題発生時の調査経路:
1. Supabase Dashboard → **Authentication** → **Logs** (左下)
2. フィルタ: `event_type = "password_recovery"`
3. 該当ユーザーのレコードを確認:
   - timestamp / IP / user_agent / success
   - 失敗時は error_code を確認

---

## 📅 推奨タイムライン

- **6/9 (本日)**:
  - ✅ コード側 Step 1-2 完了 (commit 済)
  - ⏳ Step 1 King が Supabase URL Configuration 更新 (5分)
  - ⏳ Step 2 King が preview env で recovery flow 検証 (10分)
  - ⏳ Step 3 King が通常ログイン挙動の不変確認 (5分)
  - ⏳ Step 4 本番反映確認 (5分)
- **6/10 以降**: 通常運用 (recovery flow 復旧 ✅)

---

## ❓ 質問・トラブル時

クマ (Claude) に以下フォーマットで報告:
```
[#138 タスク2 検証]
□ Step 1 Supabase 設定追加完了
□ Step 2 preview env recovery flow テスト: 成功 / 失敗 (理由)
□ Step 3 通常ログイン挙動の不変確認: 全項目 ✅ / NG (項目)
□ Step 4 本番反映確認: 成功 / 失敗 (理由)
```

→ クマが追加調査・修正対応します 🐨💎

---

## 改訂履歴
- 2026/6/9 (依頼書 #138 タスク2 Step 3) v1.0 初版
