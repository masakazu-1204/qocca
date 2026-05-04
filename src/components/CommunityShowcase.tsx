// src/components/CommunityShowcase.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const SUPABASE_KEY = "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BRAND = "#F5A94A";
const BRAND_DEEP = "#B27820";
const CREAM = "#FFF9F0";
const TEXT_DARK = "#2C2C2A";
const TEXT_MUTED = "#888780";
const BORDER = "#F1EFE8";

type Community = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  member_count?: number;
  message_count?: number;
};

export default function CommunityShowcase() {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // アクティブなコミュニティを取得(発言数の多い順)
        const { data, error } = await supabase
          .from("communities")
          .select("id, name, description, category, message_count, member_count")
          .eq("is_archived", false)
          .order("message_count", { ascending: false })
          .limit(3);

        if (error) {
          console.error("CommunityShowcase fetch error:", error);
          setLoading(false);
          return;
        }

        setCommunities(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 0件の場合は表示しない
  if (!loading && communities.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        background: `linear-gradient(135deg, #FFF9F0 0%, #FFE5B4 100%)`,
        padding: "48px 16px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.25em",
              color: BRAND_DEEP,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            COMMUNITY
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
              marginBottom: 10,
              color: TEXT_DARK,
              lineHeight: 1.4,
            }}
          >
            💬 ペット好きが<br />集まる場所
          </h2>
          <p
            style={{
              fontSize: 13,
              color: TEXT_MUTED,
              lineHeight: 1.7,
              margin: 0,
              padding: "0 8px",
            }}
          >
            犬種別・猫種別・エリア別に、毎日たくさんの会話が生まれています。
            <br />
            あなたの「うちの子」と同じ仲間がきっと見つかる。
          </p>
        </div>

        {/* コミュニティカード3つ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {loading
            ? Array(3)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(255,255,255,0.5)",
                      borderRadius: 14,
                      padding: 16,
                      height: 72,
                    }}
                  />
                ))
            : communities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/community/${c.id}`)}
                  style={{
                    background: "#FFFFFF",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    padding: "16px 18px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateX(4px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(245,169,74,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateX(0)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      background: `linear-gradient(135deg, ${BRAND}, #FFE5B4)`,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    💬
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: TEXT_DARK,
                        marginBottom: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: TEXT_MUTED,
                        display: "flex",
                        gap: 10,
                      }}
                    >
                      <span>👥 {c.member_count || 0}人</span>
                      <span>💭 {c.message_count || 0}件</span>
                      {c.category && <span>· {c.category}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, color: BRAND, fontWeight: 800 }}>→</div>
                </button>
              ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => navigate("/communities")}
            style={{
              padding: "12px 32px",
              background: BRAND,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 4px 12px rgba(245,169,74,0.3)",
            }}
          >
            すべてのコミュニティを見る →
          </button>
        </div>
      </div>
    </section>
  );
}
