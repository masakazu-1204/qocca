// フォント装飾定数・ヘルパー (App.tsx 分割 Phase 4-a)
// 依頼書 #133 Phase A2 (2026/6/6): 無料 5本 (system / serif / mincho / round / handwriting)
// items テーブル font カテゴリ + profiles.font_* 5カラム と連動
// 適用先: display_name / bio / pet_name / one_word / blog_title
// ⚠️ App.tsx と components/ui.tsx の双方が resolveFontFamily を参照するため、
//   循環import回避の中立モジュールとして先出し (Phase 4-a)。ロジック・参照名無改変。

export const FONT_FAMILIES: Record<string, string> = {
  system: 'system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif',
  serif: 'Georgia, "Yu Mincho", "游明朝", serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", "游明朝", "MS Mincho", serif',
  round: '"M PLUS Rounded 1c", "Hiragino Maru Gothic Pro", "Yu Gothic UI", sans-serif',
  handwriting: '"Caveat", "Klee One", "Yu Mincho", cursive',
};
export const FONT_OPTIONS: Array<{ key: string; label: string; sample: string }> = [
  { key: "system", label: "システム標準", sample: "Aa あ" },
  { key: "serif", label: "セリフ", sample: "Aa あ" },
  { key: "mincho", label: "明朝", sample: "Aa あ" },
  { key: "round", label: "丸ゴシック", sample: "Aa あ" },
  { key: "handwriting", label: "手書き風", sample: "Aa あ" },
];
export const resolveFontFamily = (key: string | null | undefined): string =>
  FONT_FAMILIES[key || "system"] || FONT_FAMILIES.system;
