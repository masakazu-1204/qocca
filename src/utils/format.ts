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

// ── 2軸(payment_status × fulfillment_status)→ 表示キー導出 (Phase3 読み取り切替) ──
// 既存 statusLabel/stepIndex のキー(pending/working/delivered/completed/disputed/refunded/cancelled)を返す。
// 優先順位: 返金 > 決済待ち > キャンセル/期限切れ > 異議 > 完了 > 納品 > 作業中。
// ⚠️ 新2軸が無い旧データは order.status にフォールバック。
export const orderStatusKey = (o: any): string => {
  const p = o?.payment_status;
  const f = o?.fulfillment_status;
  if (!p && !f) return o?.status || "pending";        // フォールバック(旧データ)
  if (p === "refunded") return "refunded";            // 返金は最優先(納品後返金でも返金済み表示)
  if (p === "awaiting_payment") return "pending";     // 決済待ち
  if (f === "cancelled" || p === "expired") return "cancelled";
  if (f === "disputed") return "disputed";
  if (f === "completed") return "completed";
  if (f === "delivered") return "delivered";
  if (f === "working") return "working";
  return o?.status || "pending";                      // 最終フォールバック
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
