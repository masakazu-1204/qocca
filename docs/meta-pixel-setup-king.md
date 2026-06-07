# Meta Pixel セットアップ手順書 (King 用)

日付: 2026/6/8
依頼書: #135 Phase B
所要時間: 30-45分 (Meta Business 経験あり前提) / 60-90分 (初回)
タイミング: **CAMPFIRE 審査通過を待たず今週中に完了推奨**

---

## 🎯 概要

Qocca のフロント側 Meta Pixel コード (`src/lib/metaPixel.ts` + App.tsx 統合) は依頼書 #121 で完全実装済。
Pixel ID を Vercel env (`VITE_META_PIXEL_ID`) に投入するだけで全イベントが自動発火開始する。

ID 未投入時は `metaPixel.ts` が **完全 no-op** (通信ゼロ・エラーゼロ) で安全。

---

## 📋 Step 1: Meta Business アカウント確認 (King 既存)

1. https://business.facebook.com にログイン
2. 「ビジネス設定」→ 「アカウント」→ 「Pixel」 セクションを開く
3. 既存 Pixel があれば再利用 / なければ新規作成へ

---

## 📋 Step 2: 新規 Pixel 作成 (新規の場合)

1. 「Pixel を追加」クリック
2. **Pixel 名**: `Qocca Production`
3. **ウェブサイト URL**: `https://qocca.pet`
4. 「次へ」→ **「コードを手動で追加」を選択** (Qocca はコード実装済のため自動セットアップ不要)
5. 表示された **Pixel ID (16桁の数字)** をコピー → クマに連絡 (例: `123456789012345`)

---

## 📋 Step 3: イベントマネージャでイベント設定

1. https://www.facebook.com/events_manager で対象 Pixel を選択
2. 「設定」タブ → 「テストイベント」 で **テストイベントコード** を取得 (デバッグ用 / 任意)
3. 「ドメインの確認」→ `qocca.pet` を確認 (meta-tag 方式 推奨)
   - クマに連絡: `<meta name="facebook-domain-verification" content="...">` を index.html に追加するため

---

## 📋 Step 4: カスタムコンバージョン設定 (= 広告最適化対象)

「カスタムコンバージョン」セクションで以下を作成:

| 名前 | ベースイベント | URL ルール | 用途 |
|---|---|---|---|
| **Qocca Purchase** | Purchase | (URL ルールなし) | 2段ロケット 2段目 CV 最適化対象 |
| **Qocca Signup** | CompleteRegistration | (URL ルールなし) | 住民登録の補助 KPI |
| **Qocca ProductView** | ViewContent | (URL ルールなし) | 興味段階 KPI |

→ 2段目 (7/1 Dday) の Meta 広告キャンペーンで **「Qocca Purchase」を目的に設定** すると ROAS 計測が可能。

---

## 📋 Step 5: クマに連絡 → Vercel env 投入

以下 2 つの情報をクマに送る:
1. **Pixel ID** (16桁数字)
2. **facebook-domain-verification meta tag value** (32文字英数字)

クマが実施:
- Vercel `Settings > Environment Variables` で `VITE_META_PIXEL_ID = <ID>` を Production scope に投入
- `index.html` に `<meta name="facebook-domain-verification" content="...">` を追加 → commit + push
- Vercel auto-redeploy 完了で本番反映 (~5分)

---

## 📋 Step 6: 反映確認 (King + クマ)

### Meta 側
- イベントマネージャ → 「概要」タブで PageView がリアルタイム計測されることを確認 (1-5分以内)

### クマ側
- 検証手順書 `docs/meta-pixel-verification.md` (別 doc) で全 5 イベント発火確認

---

## 📋 Step 7: 2段ロケット 1段目 (CAMPFIRE 期間中 小額テスト) 着手

Pixel が学習データ蓄積するため、CAMPFIRE 期間中に:
- **広告セット**: 日予算 ¥1,000 / トラフィック目的 / CAMPFIRE プロジェクトページに誘導
- UTM: `?utm_source=meta&utm_medium=cpc&utm_campaign=cf_traffic_202606&utm_content=<ad_id>` (`docs/utm-conventions.md` 準拠)
- ターゲット: 「ペット飼育者」「動物福祉関心層」「クラウドファンディング支援者」

→ 数千 PV 蓄積で Pixel が学習 → 2段目 (7/1) の CV 最適化精度が UP

---

## ⚠️ 注意事項

1. **テストモード**: 初回は「テストイベントコード」を使うと本番計測に混じらない
2. **個人情報**: Qocca は email / 名前 / 住所を Pixel に送らない設計 (`metaPixel.ts` 安全 3 原則 #3)
3. **iOS 14+ ATT**: Meta 自動対応 / Qocca 側は特別な対応不要
4. **Cookie 同意**: 日本は明示同意必須でないが、Privacy Policy に Meta Pixel 利用記載済 (依頼書 #121 で対応済)
5. **ID 漏洩リスク**: Pixel ID は公開情報 (HTML に埋め込まれる) のため秘匿不要だが、Vercel env で管理することで「投入前 deploy」の安全性を確保

---

## 🛡️ Rollback 手順

問題発生時の即時無効化:
1. Vercel Settings → Environment Variables → `VITE_META_PIXEL_ID` を **削除 or 空文字に上書き**
2. Redeploy (~2分)
3. `metaPixel.ts` が完全 no-op に戻る (通信ゼロ)

---

## 📅 推奨タイムライン

- **6/8-6/10** (今週): King が Meta Business で Pixel 発行 + イベントマネージャ設定
- **6/10-6/12**: クマが Vercel env + domain-verification 投入 → 本番反映
- **6/12-6/30** (CAMPFIRE期間): 1段目 小額テスト (¥1,000/日) で Pixel 学習開始
- **7/1 Dday**: 2段目 (¥5万/月 CV 最適化) ロケット発射 🚀
