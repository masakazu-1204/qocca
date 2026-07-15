// トップ「街の読みもの」セクション (2026/7/5)
// 既存ブログ機能 (blog_posts / /blog / /blog/:postId) の表示枠をトップに追加するだけ。
// ブログ本体 (作成/一覧/詳細) は一切変更しない。
// fetch は BlogPage (pages/gallery.tsx) の一覧と同条件 (published=true・新しい順) の limit 3。
// 様式: HomeCommunitiesSection / HomeEventsSection と同一のQC文法 (英字キッカー+Shippori h2+カード+アウトラインピル)。
// 0件時はセクションごと非表示。Reveal ラップは home.tsx 側 (他セクションと同じ呼吸)。

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY } from "../constants/theme";

type BlogCard = {
  id: string;
  title: string;
  cover_image_url: string | null;
  category: string | null;
  created_at: string;
};

// YYYY.MM.DD (静かな日付表記)
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export const HomeBlogSection = ({ setPage }: { setPage: (page: string) => void }) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogCard[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, cover_image_url, category, created_at")
        .eq("published", true)
        .neq("post_type", "magazine") // 2026/7/16 特集Phase1: PW特集は「街の読みもの」に混ぜない (完全分離)
        .order("created_at", { ascending: false })
        .limit(3);
      if (mounted) setPosts((data as BlogCard[]) || []);
    })();
    return () => { mounted = false; };
  }, []);

  if (posts.length === 0) return null;

  return (
    <section style={{ padding: "80px 16px", background: "transparent" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p style={{ fontFamily: QC_FONT_EN, fontSize: 13, fontStyle: "italic", color: QC.warmGray, letterSpacing: 0.8, margin: "0 0 10px 0", opacity: 0.75, fontWeight: 300 }}>
            Journal
          </p>
          <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, color: QC.softBrown, letterSpacing: "0.06em", lineHeight: 1.55, margin: 0 }}>
            街の読みもの
          </h2>
          <p style={{ fontFamily: QC_FONT_JP, fontSize: 12.5, fontWeight: 300, color: QC.warmGray, lineHeight: 1.8, margin: "12px 0 0", letterSpacing: 0.3 }}>
            うちの子との暮らしを、住民が綴っています。
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
          marginBottom: 32,
        }}>
          {posts.map((p) => {
            const isHover = hoverId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => navigate(`/blog/${p.id}`)}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{
                  background: QC.warmWhite,
                  borderRadius: 4,
                  border: `1px solid ${isHover ? QC.softBrown : QC.lightSand}`,
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                  transform: isHover ? "translateY(-2px)" : "translateY(0)",
                }}
              >
                <div style={{
                  width: "100%",
                  aspectRatio: "16 / 10",
                  background: QC.cream,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {p.cover_image_url ? (
                    <img
                      src={p.cover_image_url}
                      alt={p.title}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        transition: "transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
                        transform: isHover ? "scale(1.02)" : "scale(1)",
                      }}
                    />
                  ) : (
                    // サムネ無し記事のフォールバック (静けさ文法)
                    <p style={{ fontFamily: QC_FONT_EN, fontSize: 16, fontStyle: "italic", fontWeight: 300, color: QC.softBrown, letterSpacing: 2, margin: 0, opacity: 0.6 }}>
                      Journal
                    </p>
                  )}
                </div>
                <div style={{ padding: "16px 18px 18px" }}>
                  <p style={{
                    fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 400, color: QC.charcoal,
                    margin: "0 0 10px 0", lineHeight: 1.7,
                    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: 47,
                  }}>
                    {p.title}
                  </p>
                  <p style={{ fontFamily: QC_FONT_EN, fontSize: 11, fontStyle: "italic", fontWeight: 300, color: QC.warmGray, margin: 0, letterSpacing: "0.12em" }}>
                    {fmtDate(p.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={() => setPage("blog")} style={{
            padding: "10px 28px", background: "transparent", color: QC.softBrown,
            border: `1px solid ${QC.softBrown}`, borderRadius: 999,
            fontSize: 13, fontWeight: 400, cursor: "pointer",
            fontFamily: QC_FONT_JP, letterSpacing: 0.5,
            transition: "all 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = QC.softBrown; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = QC.softBrown; }}
          >
            ブログをもっと見る →
          </button>
        </div>
      </div>
    </section>
  );
};
