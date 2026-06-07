# Known Issues / バックログ

本番運用に致命ではないが、将来的に解消したい既知の課題を記録するファイル。
新規発見時に追記し、解消時に「✅ 解消済」+ commit hash を残す。

---

## 🟡 Active (未解消)

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
