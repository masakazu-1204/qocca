import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

const C = {
  orange: "#F5A94A", orangeLight: "#FAC97A", orangePale: "#FFF3E0",
  orangeDeep: "#E8903A", cream: "#FAFAF7", dark: "#1A1208",
  darkBrown: "#2D1F0A", warmGray: "#9E9B95", lightGray: "#F5F3F0",
  border: "#EDE9E3", white: "#FFFFFF",
};

const CATEGORY_INFO: Record<string, { label: string; icon: string; order: number }> = {
  special:   { label: "特別バッジ",       icon: "👑", order: 0 },
  trade:     { label: "取引バッジ",       icon: "🛍️", order: 1 },
  rating:    { label: "評価バッジ",       icon: "⭐", order: 2 },
  blog:      { label: "ブログバッジ",     icon: "📝", order: 3 },
  gallery:   { label: "ギャラリーバッジ", icon: "📷", order: 4 },
  community: { label: "コミュニティバッジ", icon: "💬", order: 5 },
};

const TIER_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  founding: { bg: "linear-gradient(135deg,#FFD700,#FF6B6B,#4ECDC4)", border: "#FFD700", glow: "rgba(255,215,0,0.6)" },
  bronze:   { bg: "#FFE0B2", border: "#CD7F32", glow: "rgba(205,127,50,0.4)" },
  silver:   { bg: "#E8E8E8", border: "#C0C0C0", glow: "rgba(192,192,192,0.4)" },
  gold:     { bg: "#FFF3C4", border: "#FFD700", glow: "rgba(255,215,0,0.5)" },
  platinum: { bg: "#F0F0F0", border: "#E5E4E2", glow: "rgba(229,228,226,0.6)" },
  diamond:  { bg: "#E1F5FE", border: "#7DD3FC", glow: "rgba(125,211,252,0.6)" },
};

interface Badge {
  id: string;
  category: string;
  tier: string;
  tier_order: number;
  name: string;
  description: string;
  image_url: string;
  earned: boolean;
  earned_at?: string;
}

interface Props {
  userId: string;
  isOwn?: boolean;
}

export default function MyBadgesSection({ userId, isOwn = true }: Props) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showAllModal, setShowAllModal] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadBadges();
  }, [userId]);

  async function loadBadges() {
    setLoading(true);
    try {
      const { data: allBadges } = await supabase
        .from("badges")
        .select("*")
        .order("tier_order");

      const { data: userBadges } = await supabase
        .from("user_badges")
        .select("badge_id, earned_at")
        .eq("user_id", userId);

      const earnedMap = new Map(
        (userBadges || []).map((ub: any) => [ub.badge_id, ub.earned_at])
      );

      const merged: Badge[] = (allBadges || []).map((b: any) => ({
        ...b,
        earned: earnedMap.has(b.id),
        earned_at: earnedMap.get(b.id) as string | undefined,
      }));

      setBadges(merged);
    } catch (e) {
      console.error("Failed to load badges:", e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{
          background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
          padding: 12, textAlign: "center", color: C.warmGray, fontSize: 12,
        }}>
          読み込み中...
        </div>
      </div>
    );
  }

  const earnedCount = badges.filter((b) => b.earned).length;
  const totalCount = badges.length;

  // 代表バッジ: カテゴリごとに最高ティア（earned）を1つずつ抽出 → 最大3個
  const featured: Badge[] = [];
  const byCategoryEarned: Record<string, Badge> = {};
  badges.filter((b) => b.earned).forEach((b) => {
    if (!byCategoryEarned[b.category] || b.tier_order > byCategoryEarned[b.category].tier_order) {
      byCategoryEarned[b.category] = b;
    }
  });
  // 創業メンバー優先 → tier_order高い順
  const sortedFeatured = Object.values(byCategoryEarned).sort((a, b) => {
    if (a.category === "special") return -1;
    if (b.category === "special") return 1;
    return b.tier_order - a.tier_order;
  });
  featured.push(...sortedFeatured.slice(0, 3));

  // カテゴリ別グループ（モーダル用）
  const groupedByCategory: Record<string, Badge[]> = {};
  badges.forEach((b) => {
    if (!groupedByCategory[b.category]) groupedByCategory[b.category] = [];
    groupedByCategory[b.category].push(b);
  });

  // バッジ1個のレンダリング（全画面モーダル用）
  const renderBadge = (b: Badge, size: "sm" | "md" = "md") => {
    const tierColor = TIER_COLORS[b.tier] || TIER_COLORS.bronze;
    return (
      <button
        key={b.id}
        onClick={() => setSelectedBadge(b)}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          padding: 4, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 4, fontFamily: "inherit",
          opacity: b.earned ? 1 : 0.35,
          filter: b.earned ? "none" : "grayscale(0.8)",
          transition: "transform 0.15s ease",
          width: "100%",
        }}
      >
        <div style={{
          width: "100%", aspectRatio: "1 / 1",
          borderRadius: "50%", overflow: "hidden",
          background: b.earned ? tierColor.bg : C.lightGray,
          boxShadow: b.earned ? `0 0 12px ${tierColor.glow}` : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {b.image_url ? (
            <img src={b.image_url} alt={b.name}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
          ) : (
            <span style={{ fontSize: 24 }}>👑</span>
          )}
        </div>
        <div style={{
          fontSize: 9, color: b.earned ? C.dark : C.warmGray,
          textAlign: "center", fontWeight: b.earned ? 700 : 500, lineHeight: 1.2,
        }}>
          {b.tier === "founding" ? "創業" : b.tier.charAt(0).toUpperCase() + b.tier.slice(1)}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* コンパクトなマイページ用ボタン */}
      <button
        onClick={() => setShowAllModal(true)}
        style={{
          marginTop: 12, width: "100%",
          background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
          padding: "12px 14px", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>🏆</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>
            {isOwn ? "マイバッジ" : "バッジ"}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.orangeDeep,
            background: C.orangePale, padding: "2px 8px", borderRadius: 10,
          }}>
            {earnedCount} / {totalCount}
          </span>
        </div>

        {/* 代表バッジ画像（最大3個、横並び、小さく） */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {featured.length > 0 ? (
            featured.map((b) => {
              const tierColor = TIER_COLORS[b.tier] || TIER_COLORS.bronze;
              return (
                <div key={b.id} style={{
                  width: 30, height: 30, borderRadius: "50%",
                  overflow: "hidden", flexShrink: 0,
                  boxShadow: `0 0 6px ${tierColor.glow}`,
                }}>
                  <img src={b.image_url} alt={b.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
                </div>
              );
            })
          ) : (
            <span style={{ fontSize: 11, color: C.warmGray }}>未獲得</span>
          )}
          <span style={{ fontSize: 14, color: C.warmGray, marginLeft: 4 }}>›</span>
        </div>
      </button>

      {/* 全バッジモーダル */}
      {showAllModal && (
        <div
          onClick={() => setShowAllModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 9998,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: "20px 20px 0 0",
              width: "100%", maxWidth: 600,
              maxHeight: "85vh", overflowY: "auto",
              padding: "20px 18px 30px",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.dark }}>
                🏆 {isOwn ? "マイバッジ" : "バッジ"}コレクション
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                style={{
                  background: "transparent", border: "none",
                  fontSize: 24, cursor: "pointer", color: C.warmGray,
                  fontFamily: "inherit", padding: 4,
                }}
              >×</button>
            </div>

            <div style={{
              fontSize: 13, color: C.warmGray, marginBottom: 16,
              padding: "8px 12px", background: C.orangePale, borderRadius: 10,
            }}>
              獲得済み: <span style={{ color: C.orangeDeep, fontWeight: 800 }}>{earnedCount}</span> / {totalCount}
            </div>

            {Object.entries(CATEGORY_INFO)
              .sort((a, b) => a[1].order - b[1].order)
              .map(([catKey, catInfo]) => {
                const catBadges = (groupedByCategory[catKey] || []).sort((a, b) => a.tier_order - b.tier_order);
                if (catBadges.length === 0) return null;

                const earnedInCat = catBadges.filter((b) => b.earned).length;
                const isSpecial = catKey === "special";

                return (
                  <div key={catKey} style={{ marginBottom: 18 }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 10,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>
                        {catInfo.icon} {catInfo.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.warmGray }}>
                        {earnedInCat} / {catBadges.length}
                      </div>
                    </div>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: 8,
                    }}>
                      {catBadges.map((b) => renderBadge(b))}
                      {isSpecial && catBadges.length < 5 &&
                        Array.from({ length: 5 - catBadges.length }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))
                      }
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* バッジ詳細モーダル */}
      {selectedBadge && (
        <div
          onClick={() => setSelectedBadge(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 20, padding: 30,
              maxWidth: 360, width: "100%", textAlign: "center", position: "relative",
            }}
          >
            <button
              onClick={() => setSelectedBadge(null)}
              style={{
                position: "absolute", top: 12, right: 12,
                background: "transparent", border: "none",
                fontSize: 24, cursor: "pointer", color: C.warmGray, fontFamily: "inherit",
              }}
            >×</button>

            <div style={{
              width: 160, height: 160, margin: "0 auto 16px",
              borderRadius: "50%", overflow: "hidden",
              opacity: selectedBadge.earned ? 1 : 0.3,
              filter: selectedBadge.earned ? "none" : "grayscale(0.9)",
              boxShadow: selectedBadge.earned
                ? `0 0 24px ${(TIER_COLORS[selectedBadge.tier] || TIER_COLORS.bronze).glow}`
                : "none",
            }}>
              <img src={selectedBadge.image_url} alt={selectedBadge.name}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
            </div>

            <div style={{ fontSize: 20, fontWeight: 900, color: C.dark, marginBottom: 6 }}>
              {selectedBadge.name}
            </div>

            <div style={{
              fontSize: 13, color: C.warmGray, marginBottom: 16, lineHeight: 1.6,
            }}>
              {selectedBadge.description}
            </div>

            {selectedBadge.earned ? (
              <div style={{
                display: "inline-block", padding: "6px 14px",
                background: C.orangePale, color: C.orangeDeep,
                fontSize: 12, fontWeight: 700, borderRadius: 20,
              }}>
                ✨ 獲得済み
                {selectedBadge.earned_at && (
                  <span style={{ marginLeft: 6, fontWeight: 500 }}>
                    {new Date(selectedBadge.earned_at).toLocaleDateString("ja-JP")}
                  </span>
                )}
              </div>
            ) : (
              <div style={{
                display: "inline-block", padding: "6px 14px",
                background: C.lightGray, color: C.warmGray,
                fontSize: 12, fontWeight: 700, borderRadius: 20,
              }}>
                🔒 未獲得
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
