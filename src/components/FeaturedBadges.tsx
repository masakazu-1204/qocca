import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

const TIER_GLOW: Record<string, string> = {
  founding: "rgba(255,215,0,0.6)",
  bronze:   "rgba(205,127,50,0.4)",
  silver:   "rgba(192,192,192,0.4)",
  gold:     "rgba(255,215,0,0.5)",
  platinum: "rgba(229,228,226,0.6)",
  diamond:  "rgba(125,211,252,0.6)",
};

interface Props {
  userId: string;
  size?: number;
  maxBadges?: number;
}

interface BadgeRow {
  badge_id: string;
  badges: {
    id: string;
    name: string;
    image_url: string;
    tier: string;
    tier_order: number;
    category: string;
  } | null;
}

export default function FeaturedBadges({ userId, size = 28, maxBadges = 3 }: Props) {
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    loadFeatured();
  }, [userId]);

  async function loadFeatured() {
    try {
      const { data } = await supabase
        .from("user_badges")
        .select(`
          badge_id,
          badges (
            id, name, image_url, tier, tier_order, category
          )
        `)
        .eq("user_id", userId);

      if (!data) return;

      // カテゴリごとに最高ティアだけ残す
      const byCategory: Record<string, any> = {};
      (data as any[]).forEach((row) => {
        if (!row.badges) return;
        const b = row.badges;
        if (!byCategory[b.category] || b.tier_order > byCategory[b.category].tier_order) {
          byCategory[b.category] = b;
        }
      });

      // 創業メンバー優先 → tier_order高い順
      const sorted = Object.values(byCategory).sort((a: any, b: any) => {
        if (a.category === "special") return -1;
        if (b.category === "special") return 1;
        return b.tier_order - a.tier_order;
      });

      setBadges(sorted.slice(0, maxBadges));
    } catch (e) {
      console.error("Failed to load featured badges:", e);
    }
  }

  if (badges.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      gap: 4,
      alignItems: "center",
      justifyContent: "center",
    }}>
      {badges.map((b: any) => (
        <img
          key={b.id}
          src={b.image_url}
          alt={b.name}
          title={b.name}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "contain",
            boxShadow: `0 0 6px ${TIER_GLOW[b.tier] || TIER_GLOW.bronze}`,
          }}
        />
      ))}
    </div>
  );
}
