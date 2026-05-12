# 静けさ Redesign 進捗ログ

ブランチ: `claude/silent-redesign-day2`
ベース: `claude/priceless-mirzakhani-5d2bff` (commit `ec5312e`)
開始: 2026-05-13 (King 就寝中、A→E 連続実行)

## 命名衝突の解消（Phase A 開始前の判断）

- **QC_FONT_JP**: 既存は "LINE Seed JP" をフォールバックに含む上位互換 → そのまま維持
- **QC_FONT_EN**: 既存と仕様書一致 → 変更なし
- **QC_KEYFRAMES**: 既存の `qocca-breathe`/`qocca-fadeIn` は Phase B 置換対象の SectionHero 内のみで使用、`qocca-reactionPop` は未使用 → 全置換可能と判断、仕様書版に差し替え
- **QC_HERO_DURATIONS**: `[10,7,...]` → `[14,10,...]` に値更新
- **QC_TRANSITION_MS** (800) → **QC_HERO_TRANSITION_MS** (1500) にリネーム + 値更新（既存参照は Phase B で置換される SectionHero 内のみ）
- **QC_PC_BREAKPOINT**: 768 で一致 → 変更なし
- **QC_REACTIONS**: 既存と仕様書版が完全一致 → 重複定義せず既存維持

## 進捗

- [x] **Phase A 完了**: `QC_KEYFRAMES` を仕様書版に全置換 / `QC_TIMING` 追加 / `QC_HERO_DURATIONS` 値更新 / `QC_TRANSITION_MS`→`QC_HERO_TRANSITION_MS=1500` リネーム + 3か所参照を更新 / `useScrollProgress`、`qoccaInterpolateBackground`、`useInViewStaggered`、`QoccaNoiseOverlay` 追加（src/App.tsx L1175-1300 周辺）
- [x] **Phase B 完了**: SectionHero を仕様書版に全置換（Ken Burns 効果モバイルのみ、cross-fade 1500ms、キャプション 2行・ガラス背景削除、ロゴ/スクロール誘導フェードイン）。snippet 内 `rgba(0,0,0,0.3)` は厳守事項に従い `rgba(44,41,38,0.3)` (QC.charcoal) に変更
- [x] **Phase C 完了**: 5セクション置換 — SectionTodaysMoments（+ MomentCard/MomentModal/LoginPromptModal を別コンポーネントに分割）/ SectionTownMap（◯△□◇→○□◇△、warmGray、半透明）/ SectionAtelier（Pinterest Masonry、CTA を線リンク）/ SectionVoices（アイコン削除、{n}人、絵文字📍削除、未使用 `isLoading` 削除）/ SectionJoinTown（細枠CTA、"？→。"、"登録は無料です" 削除）
- [x] **Phase D 完了**: HomePage に `useScrollProgress`/`qoccaInterpolateBackground` 統合、背景補間 + `<QoccaNoiseOverlay/>` + `<style>{QC_KEYFRAMES}</style>` 追加
- [x] **Phase E 完了**: `npm run build` 成功（既存の chunk-size 警告のみ、新規エラーなし）/ ESLint 実行: App.tsx 内の新規 lint 問題は `QC_TIMING` 未使用 1件のみ（仕様書通り定義したが現在は inline 値使用、許容範囲）/ 旧 `QC_TRANSITION_MS`・旧アニメーション名 (`qocca-breathe`/`qocca-fadeIn`/`qocca-reactionPop`) の残存ゼロ確認 / 実機での npm run dev・レスポンシブ確認は King の朝の作業に委譲

## 統計

- 行数: 8671 → 9102 (+431 行)
- App.tsx 差分: +1025 -594 (working tree)
- 変更ファイル: `src/App.tsx` のみ（`silent-redesign-progress.md` は新規追加）

## 残課題（Phase F – King 待ち）

- ローカル `npm run dev` での挙動確認（スクロール背景補間、Ken Burns、ノイズオーバーレイなど）
- レスポンシブ確認（モバイル/タブレット/PC）
- 実機で違和感あれば微調整指示
- git commit & push & デプロイ（**指示があるまで実行しない**）
