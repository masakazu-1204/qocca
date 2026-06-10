# Meta Pixel 動作検証手順書 (King 用)

日付: 2026/6/8 (2026/6/9 改訂)
依頼書: #135 Phase B / #139 本日記録
所要時間: 10-15分
タイミング: Vercel env に `VITE_META_PIXEL_ID` 投入後の本番反映完了後

---

## ✅ 本番 確定情報 (2026/6/9 21:22 着弾実証)

| 項目 | 値 |
|---|---|
| **データセット名** | **Qocca Production** |
| **Pixel ID (フル)** | **`1039178921791385`** (末尾 **1385**) |
| 初回 PageView 着弾 | 2026/6/9 21:22 (Meta テストイベント受信) |

> 📌 Pixel ID は HTML/bundle.js 埋め込みの**公開識別子** (token/secret ではない) のため、引き継ぎ混同防止を優先しフル値を記載 (2026/6/11 #143 後追い / #139 の末尾4桁方針を更新)。

### ⚠️ 旧 ID への注意 (混同防止)
- **末尾 7030** : 旧引き継ぎ書の **誤記** (実態と不一致 / 今後使用禁止)
- **末尾 1459 (Qocca SNS Integration)**: 別用途の旧データセット (広告計測 NG)

---

## 🚨 Vite 静的埋め込み 重要注意 (env 変更後 必読)

**Vite は `import.meta.env.VITE_META_PIXEL_ID` を ビルド時に bundle.js へ静的置換** する仕様。
= **Vercel env を変更しただけでは本番 bundle に反映されない**。

env 変更後の正しい手順:
1. Vercel Dashboard → Deployments
2. 最新 production deployment の「⋯」→ **Redeploy**
3. **「Use existing Build Cache」のチェックを外す** ⚠️ (これを忘れると旧 bundle が再利用される)
4. **Redeploy** クリック → 完了まで ~2分
5. 本書の手順で着弾確認

### env 反映確認 (技術裏取り)
```bash
# bundle.js を取得して末尾4桁を grep (フル ID は伏せる)
curl -sL https://www.qocca.pet/ | grep -oE '/assets/[^"]+\.js'
curl -sL https://www.qocca.pet/assets/<bundle>.js | grep -oE '"1385"'
# → "1385" がヒットすれば env 反映済
```

---

## 🛠️ 事前準備

### Chrome 拡張インストール
1. https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc を開く
2. **「Chrome に追加」**
3. ツールバーの拡張アイコンに「Meta Pixel Helper」が表示されることを確認

---

## ✅ 検証 5項目 (全イベント実装済 / 確認のみ)

### 検証 1: PageView (全ルート)

1. 新しいタブで https://qocca.pet を開く
2. Pixel Helper アイコンが **緑色 + 「1 Pixel found」** 表示
3. クリック → イベント一覧に **「PageView」** が出ること

✅ 期待: PageView 1 件 / Pixel ID 一致

---

### 検証 2: 追加 PageView (SPA route 遷移)

1. ナビゲーション「さがす」をクリック → `/marketplace` に遷移
2. Pixel Helper を再度開く
3. **「PageView」が +1 件** されていること (合計 2 件)

✅ 期待: SPA route 変更で発火

---

### 検証 3: ViewContent (商品詳細)

1. 商品カードをクリック → 詳細ページへ
2. Pixel Helper 開く
3. 「**ViewContent**」イベントが発火、パラメータに:
   - `value`: 商品価格 (数値)
   - `currency`: `JPY`
   - `content_ids`: [listing_id]

✅ 期待: ViewContent 1 件 / value + currency + content_ids 確認

---

### 検証 4: InitiateCheckout (購入ボタン)

1. 商品詳細ページで「**購入する**」or「**カートへ**」相当ボタン → 注文確認モーダル
2. 「**決済に進む**」ボタンクリック → Stripe Checkout に遷移する直前
3. Pixel Helper 開く (Stripe ページに移る前にチェック)
4. 「**InitiateCheckout**」イベントが発火、パラメータに:
   - `value`: 商品価格
   - `currency`: `JPY`

✅ 期待: InitiateCheckout 1 件

⚠️ **テスト購入** は: STRIPE_SECRET_KEY を一時的に Test Key に切替 → テストカード 4242 4242 4242 4242 でテスト推奨 (依頼書 #127 で確認済の手順)。**本番 Live Key でやらない**こと。

---

### 検証 5: Purchase (取引完了)

1. Stripe Checkout でテスト決済完了 (テストカード)
2. `/mypage?order=success&order_id=<uuid>` にリダイレクト
3. Pixel Helper 開く
4. 「**Purchase**」イベントが発火、パラメータに:
   - `value`: amount (購入者支払額)
   - `currency`: `JPY`
   - `content_ids`: [listing_id]

✅ 期待: Purchase 1 件 / 重複ガード動作 (リロードしても再発火しない)

---

### 検証 6: CompleteRegistration (新規登録)

1. ログアウト状態で `/signup` を開く
2. 新規アカウント登録完了
3. Pixel Helper 開く
4. 「**CompleteRegistration**」イベントが発火 (パラメータなし)

✅ 期待: CompleteRegistration 1 件

---

## 🔍 Meta 側での確認 (リアルタイム)

並行で別タブで:
1. https://www.facebook.com/events_manager → 対象 Pixel
2. 「テストイベント」タブ
3. 上記検証中に **リアルタイムにイベントが流れてくる** ことを確認

---

## 🚨 トラブルシューティング

### Pixel Helper が「No Pixel found」
- ブラウザ DevTools (F12) → Console で `window.fbq` を確認 → `undefined` なら未ロード
- 原因候補:
  1. Vercel env `VITE_META_PIXEL_ID` 未投入 → 投入 + **Redeploy (Build Cache OFF 必須)**
  2. **env 投入後に Vite 再ビルドされていない** → Redeploy で Build Cache のチェックを外す
  3. localhost で確認している → 本番 URL (qocca.pet) で確認
  4. Pixel Helper が古いバージョン → 拡張を最新化

### `Object.keys(window._fbq.instance._pixels)` が `[]` を返す
**重要**: DevTools Console での `_pixels` 配列確認は SDK バージョンや Meta SDK 内部仕様によっては **空配列を返すことがある** (= 必ずしも未起動を意味しない)。
- 発火の最終確認は **Meta テストイベント タブ** で行うのが確実 (本書 §「Meta 側での確認」参照)
- Pixel Helper 拡張も並行して使うとさらに確実 (Meta 公式 / ブロック回避)

### Purchase が発火しない
- URL に `?order=success&order_id=<uuid>` が含まれているか確認
- `order_id` の UUID が orders テーブルに存在するか確認
- 同じ order で **既に sessionStorage に記録済** の可能性 → シークレットウィンドウで再試行

### イベントは発火するが Meta 側に届かない
- ブラウザ Adblock / Privacy 拡張で `connect.facebook.net` がブロックされている
- DNS 障害
- Pixel ID が間違っている (Pixel Helper の表示 ID と Meta Business の Pixel ID を突合)

---

## ✅ 検証完了報告フォーマット (King → クマ)

```
□ PageView (qocca.pet)
□ PageView (/marketplace)
□ ViewContent (商品詳細)
□ InitiateCheckout (購入ボタン)
□ Purchase (テスト決済完了)
□ CompleteRegistration (新規登録)
□ Meta テストイベント タブで上記 6 件 到達確認

→ 全 ✅ で本番計測開始 OK
```

---

## 改訂履歴
- 2026/6/8 (依頼書 #135 Phase B) v1.0 初版
- 2026/6/9 (依頼書 #139 本日記録) v1.1: 本番確定情報追記 (Qocca Production / 末尾1385 / 着弾実証 2026/6/9 21:22) + Vite 静的埋め込み Build Cache 注意書き追加 + DevTools `_pixels=[]` の SDK 仕様注意追記 + 旧誤情報 (末尾7030 / 1459) の明示的禁止
- 2026/6/11 (依頼書 #143 後追い) v1.2: Pixel ID をフル値 (`1039178921791385`) で明示 (公開識別子 / 引き継ぎ混同防止 / #139 の末尾4桁方針を更新)
