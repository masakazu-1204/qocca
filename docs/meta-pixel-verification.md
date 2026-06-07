# Meta Pixel 動作検証手順書 (King 用)

日付: 2026/6/8
依頼書: #135 Phase B
所要時間: 10-15分
タイミング: Vercel env に `VITE_META_PIXEL_ID` 投入後の本番反映完了後

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
  1. Vercel env `VITE_META_PIXEL_ID` 未投入 → 投入 + Redeploy
  2. localhost で確認している → 本番 URL (qocca.pet) で確認
  3. Pixel Helper が古いバージョン → 拡張を最新化

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
