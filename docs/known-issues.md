# Known Issues / バックログ

本番運用に致命ではないが、将来的に解消したい既知の課題を記録するファイル。
新規発見時に追記し、解消時に「✅ 解消済」+ commit hash を残す。

---

## 🟡 Active (未解消)

### KI-003: Meta Pixel ID 不整合 (旧7030 誤記の解消) + DevTools `_pixels` の確認限界 (2026/6/9 #139)
- **発見日**: 2026/6/9 (Meta 広告本日公開時の Pixel 検証で発覚)
- **症状 / 経緯**:
  1. 旧引き継ぎ書に「Qocca Production = 末尾7030」と記載されていたが、実態と不一致 = **誤記**
  2. 別データセット「Qocca SNS Integration = 末尾1459」が存在するが、これは SNS Insights 系の旧用途で **広告計測には不適**
  3. 正規 = **Qocca Production (末尾1385)** を Vercel env `VITE_META_PIXEL_ID` (Production / Sensitive) に投入 → Build Cache OFF で Redeploy → bundle 反映 → 2026/6/9 21:22 Meta テストイベントで PageView 着弾実証
  4. その後も DevTools Console で `Object.keys(window._fbq.instance._pixels)` が `[]` を返す現象を観測 → 当初「未起動」と疑ったが、**Meta テストイベントには到達していたため、`_pixels` 空表示は Meta SDK 仕様によるもの** と判明
- **教訓 (今後の防止策)**:
  1. **発火確認は Meta テストイベント (Events Manager) が唯一の確実な手段**。DevTools `_pixels` 確認は補助で、SDK バージョン依存で空配列を返すことがある
  2. **env 変更 → 必ず Build Cache OFF で Redeploy** (Vite 静的埋め込みのため / `docs/meta-pixel-setup-king.md` / `docs/meta-pixel-verification.md` 両書に明記済)
  3. **データセット名と末尾 4 桁の組** で記録 (フル ID は秘匿)
- **影響**: 解消済 (実害ゼロ / 6/9 21:22 以降 Pixel 学習開始)
- **優先度**: ✅ 既解消 (記録目的のみ)
- **関連ファイル**: `docs/meta-pixel-setup-king.md` v1.1 / `docs/meta-pixel-verification.md` v1.1 (両書とも 2026/6/9 更新)

---

### KI-002: Meta Pixel をサーバー側 Conversions API に拡張 (2026/6/8 #135 King 指示)
- **発見日**: 2026/6/8 (#135 Phase A 承認時)
- **症状**: 現状の Meta Pixel はブラウザ fbq 計測のみ。iOS 14+ ATT / Adblock / Cookie 拒否で計測欠損が発生する可能性
- **改善案**: Meta Conversions API (CAPI) をサーバー側 (Edge Function) で並行発火 → ブラウザ計測の欠損を補完 + deduplication (event_id 共有) で重複防止
- **影響**: 機能影響なし / 計測精度の向上のみ
- **優先度**: 🟢 低 (Dday 7/1 後 / 広告投下が増えてからで OK)
- **見積工数**: 2-3日 (Edge Function 新規 + Pixel event_id 共有 + Meta Business 側 CAPI 接続設定)
- **参照**: https://developers.facebook.com/docs/marketing-api/conversions-api/

---

### KI-001: 「Multiple GoTrueClient instances detected」コンソール警告
- **発見日**: 2026/6/6 以前 (継続観察)
- **症状**: ブラウザ Console に `Multiple GoTrueClient instances detected in the same browser context` の warning
- **原因仮説**: Supabase JS Client の生成が複数箇所で行われている (`src/supabaseClient.ts` 共有化が一部未到達)
  - 既知箇所: `src/components/ProfileEditModal.tsx` L4 で独立 `createClient` を保持 (#119 共有化対象外として残存)
- **影響**: 機能影響なし / Auth state 同期は正常 / 単なる重複警告
- **改善案**: ProfileEditModal を含む全コンポーネントを `src/supabaseClient.ts` の shared instance に統一
- **優先度**: 🟢 低 (Dday 7/1 後の clean-up 推奨)
- **見積工数**: 1-2時間 (grep で createClient 全箇所特定 → import 置換 → build 確認)

---

## ✅ 解消済 (履歴)

(まだなし — 解消時に commit hash と日付を記録)

---

## 改訂履歴
- 2026/6/6 (依頼書 #134 後追い) v1.0 初版 / KI-001 GoTrueClient 警告を記録
- 2026/6/8 (依頼書 #135 Phase B) KI-002 Conversions API 拡張 backlog 追記
- 2026/6/9 (依頼書 #139) KI-003 Pixel ID 不整合解消 + DevTools `_pixels` 仕様注意 追記
