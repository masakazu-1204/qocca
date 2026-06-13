// フォーマット・計算ユーティリティ (App.tsx 分割 Phase 1 ③)
// 純関数のみ。ロジック無改変で App.tsx から移動。

// ── 人気スコア計算（ハイブリッドアルゴリズム）─────────────────────────
// 販売数×5 + お気に入り×1 + 閲覧数×0.1 + 新規ボーナス×30(14日以内) - 経過日数×0.1
export const calcPopularityScore = (item) => {
  if (!item) return 0;
  const sales = item.sales_count || 0;
  const favs  = item.favorite_count || 0;
  const views = item.view_count || 0;
  const created = item.created_at ? new Date(item.created_at) : new Date();
  const daysSince = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)));
  const newBonus = daysSince <= 14 ? 30 : 0;

  return (sales * 5.0)
       + (favs * 1.0)
       + (views * 0.1)
       + newBonus
       - (daysSince * 0.1);
};

export const sortByPopularity = (items) => {
  return [...items].sort((a, b) => calcPopularityScore(b) - calcPopularityScore(a));
};

// ── 取引ステップ index ────────────────────────────────────────────────
export const stepIndex = (status) => {
  if (status==="pending") return 0;
  if (status==="working") return 1;
  if (status==="delivered") return 2;
  if (status==="completed") return 3;
  if (status==="disputed") return 2;
  if (status==="refunded") return -1;
  if (status==="cancelled") return -1;
  return 0;
};

// ── 統計値フォーマット (100以上は切り下げ「+」表記) ────────────────────
export const formatStat = (n:number, threshold:number = 100) => {
  if (n >= threshold) {
    // 100以上は切り下げて「+」表記（例: 234 → "200+"）
    if (n >= 1000) {
      const k = Math.floor(n / 1000);
      return `${k},000+`;
    }
    const rounded = Math.floor(n / 100) * 100;
    return `${rounded.toLocaleString()}+`;
  }
  return n.toLocaleString();
};

// ── ミニボタン style ファクトリ ───────────────────────────────────────
export const miniBtnStyle = (bg, color, disabled) => ({
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 8,
  background: bg,
  color,
  border: `1.5px solid ${color === "#fff" ? bg : color}`,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontFamily: "inherit",
});
