// ============================================
// 買う手前を測る (2026/11/4 King「それで行こう」)
//
// 商品ごとに 3 段階を記録する: view / buy_click / checkout_start
// 書き込みは RPC track_listing_event だけ。集計は supabase/migrations/20261104000000_listing_events.sql。
//
// 🛡️ 安全設計:
//   - 個人情報は送らない (ブラウザごとの乱数だけ)
//   - 待たない・失敗しても静かに諦める (購入の流れには一切影響させない)
//   - localhost では送らない (開発の操作を本番の数字に混ぜない)
// ============================================

import { supabase } from "../supabaseClient";

export type ListingEvent = "view" | "buy_click" | "checkout_start";

const VISITOR_KEY = "qocca_visitor_v1";
let memoryVisitor: string | null = null;

function isDev(): boolean {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.endsWith(".local");
}

function newVisitorId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function visitorId(): string {
  if (memoryVisitor) return memoryVisitor;
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved) return (memoryVisitor = saved);
    const created = newVisitorId();
    localStorage.setItem(VISITOR_KEY, created);
    return (memoryVisitor = created);
  } catch {
    // 保存できないブラウザでは、開いている間だけの id で数える
    return (memoryVisitor = newVisitorId());
  }
}

export function trackListingEvent(listingId: string | null | undefined, event: ListingEvent): void {
  try {
    if (!listingId || typeof window === "undefined" || isDev()) return;
    void supabase
      .rpc("track_listing_event", { p_listing_id: listingId, p_event: event, p_visitor: visitorId() })
      .then(() => undefined, () => undefined);
  } catch { /* 計測失敗で購入フローを妨げない */ }
}
