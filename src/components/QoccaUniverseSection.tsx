// src/components/QoccaUniverseSection.tsx
import { useNavigate } from "react-router-dom";

const BRAND = "#F5A94A";
const CREAM = "#FFF9F0";
const TEXT_DARK = "#2C2C2A";
const TEXT_MUTED = "#888780";
const BORDER = "#F1EFE8";

type FeatureItem = {
  icon: string;
  title: string;
  desc: string;
  path: string;
  color: string;
};

const FEATURES: FeatureItem[] = [
  { icon: "🛍️", title: "マーケット", desc: "世界にひとつの作品", path: "/search", color: "#FFF3E0" },
  { icon: "💬", title: "コミュニティ", desc: "ペット好きとつながる", path: "/communities", color: "#F3E5F5" },
  { icon: "📷", title: "ギャラリー", desc: "自慢の写真を共有", path: "/gallery", color: "#E3F2FD" },
  { icon: "🗺️", title: "施設マップ", desc: "お出かけスポット", path: "/facilities", color: "#E8F5E9" },
  { icon: "📝", title: "ブログ", desc: "みんなの体験談", path: "/blog", color: "#FFF8E1" },
  { icon: "🎉", title: "イベント", desc: "リアルで会おう", path: "/events", color: "#FCE4EC" },
];

export default function QoccaUniverseSection() {
  const navigate = useNavigate();

  return (
    <section
      style={{
        background: `linear-gradient(180deg, #FFFFFF 0%, ${CREAM} 100%)`,
        padding: "48px 16px 56px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.25em",
              color: BRAND,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            QOCCA UNIVERSE
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
              marginBottom: 12,
              color: TEXT_DARK,
              lineHeight: 1.4,
            }}
          >
            Qoccaは、ペット好きの<br />
            <span style={{ color: BRAND }}>居場所</span>。
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
            マーケットだけじゃない。コミュニティ・ギャラリー・施設マップまで、
            <br />
            愛犬・愛猫との毎日を彩るすべてがここに。
          </p>
        </div>

        {/* 6機能グリッド */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          {FEATURES.map((f) => (
            <button
              key={f.path}
              onClick={() => navigate(f.path)}
              style={{
                background: "#FFFFFF",
                border: `1px solid ${BORDER}`,
                borderRadius: 16,
                padding: "20px 16px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
                fontFamily: "inherit",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 16px rgba(245,169,74,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: f.color,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  marginBottom: 8,
                }}
              >
                {f.icon}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: TEXT_DARK,
                }}
              >
                {f.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: TEXT_MUTED,
                  lineHeight: 1.5,
                }}
              >
                {f.desc}
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  fontSize: 14,
                  color: BRAND,
                  fontWeight: 700,
                }}
              >
                →
              </div>
            </button>
          ))}
        </div>

        {/* フッター文言 */}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: TEXT_MUTED,
            marginTop: 28,
            marginBottom: 0,
            lineHeight: 1.6,
          }}
        >
          🐾 ペットと暮らす毎日を、もっと豊かに。
        </p>
      </div>
    </section>
  );
}
