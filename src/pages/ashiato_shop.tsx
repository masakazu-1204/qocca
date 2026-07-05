// 「あしあと」ショップ (Phase C-1 UI第2弾・2026/7/5)
// 貯めたあしあとで装飾 (スタンプ/フレーム) を交換する画面。/ashiato-shop
// - 商品はサーバ側マスタ decoration_items から取得 (価格のクライアント保持なし・改ざん不可)
// - 購入 = spend_currency RPC。idempotency_key は `shop:{userId}:{itemId}` の安定キー
//   → 連打・リロード・別タブからの二重購入を構造的に防止 (RPC側 UNIQUE が最終防壁)
// - 装備 (equip) は第3弾 (equip_decoration RPC migration 後)。本画面は「交換」まで。
// - トーン: 機能画面 = Cトークン系 (#F5A94A基調・設計書§0)。文言は煽らない (「交換する」)。
// ⚠️ バックエンド (テーブル/RPC) 変更なし・決済/AuthContext 非接触。

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { AshiatoIcon } from "../components/AshiatoIcon";
import { useAshiatoBalance } from "../hooks/useAshiato";
import { C } from "../constants/theme";

type DecoItem = {
  id: string;
  name: string;
  category: string; // 'stamp' | 'profile_deco'
  price: number;
  image_url: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  stamp: "スタンプ",
  profile_deco: "フレーム",
};
const CATEGORY_ORDER = ["stamp", "profile_deco"];

export const AshiatoShopPage = ({ setPage, isPC }: { setPage: (page: string) => void; isPC: boolean }) => {
  const auth = useAuth() as { user?: { id: string } | null } | null;
  const user = auth?.user;
  const { free, loading: balLoading } = useAshiatoBalance(user?.id);

  const [items, setItems] = useState<DecoItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<DecoItem | null>(null); // 確認モーダル対象
  const [busy, setBusy] = useState(false);                          // 交換中 (連打ガード①)
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 商品棚 + 所持一覧 (RLS: decoration_items=activeのみ / user_decorations=本人のみ)
  const fetchAll = useCallback(async () => {
    const [itemsRes, ownedRes] = await Promise.all([
      supabase
        .from("decoration_items")
        .select("id, name, category, price, image_url")
        .order("price", { ascending: true })
        .order("name", { ascending: true }),
      user?.id
        ? supabase.from("user_decorations").select("item_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] as { item_id: string }[] } as any),
    ]);
    setItems((itemsRes.data as DecoItem[]) || []);
    setOwnedIds(new Set(((ownedRes.data as { item_id: string }[]) || []).map((r) => r.item_id)));
    setLoaded(true);
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 交換実行 (二重防御: ①busyフラグ ②安定idempotency_key → RPC側UNIQUEで冪等)
  const handleSpend = async () => {
    if (!selected || !user?.id || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc("spend_currency", {
        p_item_id: selected.id,
        p_idempotency_key: `shop:${user.id}:${selected.id}`,
      });
      if (error) {
        setErrorMsg("交換できませんでした。時間をおいて、もう一度お試しください。");
        return;
      }
      if (data?.success) {
        // duplicated=true (既に交換済み) も所持扱いにして静かに整合
        setOwnedIds((prev) => new Set(prev).add(selected.id));
        window.dispatchEvent(new Event("ashiatoChanged")); // 残高カード等へ反映
        setSelected(null);
        setToast(`「${selected.name}」を交換しました`);
        setTimeout(() => setToast(null), 3200);
      } else if (data?.error === "insufficient_balance") {
        setErrorMsg(`あしあとが足りません (必要: ${data.required} / いま: ${data.free_balance})`);
      } else if (data?.error === "item_not_found") {
        setErrorMsg("このアイテムは現在お取り扱いがありません。");
        fetchAll();
      } else {
        setErrorMsg("交換できませんでした。");
      }
    } finally {
      setBusy(false);
    }
  };

  // ── 未ログイン ─────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: isPC ? "40px 0 80px" : "32px 16px 80px", textAlign: "center" }}>
        <AshiatoIcon size={40} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.dark, margin: "16px 0 8px" }}>あしあとショップ</h1>
        <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 2, margin: "0 0 24px" }}>
          街を歩いて貯めたあしあとで、<br />スタンプやフレームと交換できます。
        </p>
        <button
          onClick={() => setPage("login")}
          style={{
            padding: "12px 32px", background: C.orange, color: "#fff", border: "none",
            borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          ログインして始める
        </button>
      </div>
    );
  }

  const sections = CATEGORY_ORDER
    .map((cat) => ({ cat, list: items.filter((i) => i.category === cat) }))
    .filter((s) => s.list.length > 0);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: isPC ? "8px 0 80px" : "20px 16px 96px" }}>

      {/* ヘッダー: タイトル + 残高 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: isPC ? 22 : 19, fontWeight: 700, color: C.dark, margin: 0 }}>
          あしあとショップ
        </h1>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: C.orangePale, border: `1px solid ${C.border}`,
          borderRadius: 999, padding: "8px 16px",
        }}>
          <AshiatoIcon size={20} />
          <span style={{ fontSize: 16, fontWeight: 800, color: C.orange, lineHeight: 1 }}>
            {balLoading ? "…" : free}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.warmGray }}>あしあと</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.9, margin: "0 0 28px" }}>
        街を歩いて貯めたあしあとを、うちの子の装飾と交換できます。
      </p>

      {!loaded ? (
        <p style={{ fontSize: 12, color: C.warmGray, textAlign: "center", padding: "48px 0" }}>読み込み中…</p>
      ) : (
        sections.map(({ cat, list }) => (
          <div key={cat} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: "0 0 4px" }}>
              {CATEGORY_LABELS[cat] || cat}
            </h2>
            <p style={{ fontSize: 11, color: C.warmGray, margin: "0 0 14px" }}>
              {cat === "stamp" ? "コミュニティやプロフィールで使える、小さな彩り。" : "プロフィールを飾る、うちの子の額縁。"}
              {cat === "profile_deco" && " (飾る機能は準備中)"}
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${isPC ? 168 : 140}px, 1fr))`,
              gap: 12,
            }}>
              {list.map((item) => {
                const owned = ownedIds.has(item.id);
                const affordable = free >= item.price;
                const tappable = !owned && affordable;
                return (
                  <div
                    key={item.id}
                    onClick={() => { if (tappable) { setErrorMsg(null); setSelected(item); } }}
                    style={{
                      background: C.white,
                      border: `1px solid ${C.border}`,
                      borderRadius: 14,
                      padding: 12,
                      cursor: tappable ? "pointer" : "default",
                      opacity: owned ? 0.85 : affordable ? 1 : 0.55,
                      transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    onMouseEnter={(e) => { if (tappable) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(245,169,74,0.14)"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                  >
                    <div style={{
                      width: "100%", aspectRatio: "1", background: C.lightGray,
                      borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 10, overflow: "hidden",
                    }}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          style={{ width: "82%", height: "82%", objectFit: "contain" }}
                        />
                      ) : (
                        <AshiatoIcon size={36} />
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: C.dark, lineHeight: 1.5, minHeight: 37, marginBottom: 8 }}>
                      {item.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <AshiatoIcon size={15} />
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.orange, lineHeight: 1 }}>{item.price}</span>
                      </div>
                      {owned ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.green, background: C.greenPale, borderRadius: 999, padding: "4px 10px" }}>
                          所持済み
                        </span>
                      ) : affordable ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.orange, border: `1px solid ${C.orangeLight}`, borderRadius: 999, padding: "4px 10px" }}>
                          交換する
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: C.warmGray }}>
                          あしあとが足りません
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* 交換確認モーダル (spend は残高が減る操作 → 必ずここを通る) */}
      {selected && (
        <div
          onClick={() => { if (!busy) setSelected(null); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(26, 18, 8, 0.55)",
            zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.white, borderRadius: 18, padding: "28px 24px", maxWidth: 340, width: "100%", textAlign: "center" }}
          >
            <div style={{
              width: 84, height: 84, margin: "0 auto 14px", background: C.lightGray,
              borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {selected.image_url
                ? <img src={selected.image_url} alt={selected.name} style={{ width: "80%", height: "80%", objectFit: "contain" }} />
                : <AshiatoIcon size={32} />}
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: "0 0 6px" }}>{selected.name}</p>
            <p style={{ fontSize: 12.5, color: C.warmGray, lineHeight: 1.9, margin: "0 0 4px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle" }}>
                <AshiatoIcon size={14} />
                <b style={{ color: C.orange }}>{selected.price}</b>
              </span>
              {" "}あしあとで交換しますか。
            </p>
            <p style={{ fontSize: 10.5, color: C.warmGray, margin: "0 0 16px" }}>
              交換後のあしあと: {Math.max(free - selected.price, 0)}
            </p>
            {errorMsg && (
              <p style={{ fontSize: 11, color: C.red, background: C.redPale, borderRadius: 8, padding: "8px 10px", margin: "0 0 12px", lineHeight: 1.7 }}>
                {errorMsg}
              </p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setSelected(null)}
                disabled={busy}
                style={{
                  flex: 1, padding: "12px 0", background: C.lightGray, color: C.warmGray,
                  border: "none", borderRadius: 999, fontSize: 13, fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                やめる
              </button>
              <button
                onClick={handleSpend}
                disabled={busy || free < selected.price}
                style={{
                  flex: 1, padding: "12px 0",
                  background: busy || free < selected.price ? C.orangeLight : C.orange,
                  color: "#fff", border: "none", borderRadius: 999, fontSize: 13, fontWeight: 600,
                  cursor: busy || free < selected.price ? "default" : "pointer",
                }}
              >
                {busy ? "交換中…" : "交換する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 交換完了トースト */}
      {toast && (
        <div style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
          background: C.dark, color: "#fff", borderRadius: 999,
          padding: "10px 20px", fontSize: 12.5, zIndex: 1300,
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 6px 20px rgba(26,18,8,0.25)",
        }}>
          <AshiatoIcon size={16} />
          {toast}
        </div>
      )}
    </div>
  );
};
