// src/components/FacilityMapPromo.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

const BRAND = "#F5A94A";
const BRAND_DEEP = "#B27820";
const TEXT_DARK = "#2C2C2A";
const TEXT_MUTED = "#888780";

const FACILITY_TYPES = [
  { icon: "☕", label: "カフェ" },
  { icon: "🌳", label: "ドッグラン" },
  { icon: "✂️", label: "トリミング" },
  { icon: "🏥", label: "動物病院" },
  { icon: "🏨", label: "ホテル" },
  { icon: "🍽️", label: "レストラン" },
];

export default function FacilityMapPromo() {
  const navigate = useNavigate();

  return (
    <section
      style={{
        background: "#FFFFFF",
        padding: "48px 16px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div
          style={{
            background: `linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)`,
            borderRadius: 20,
            padding: "36px 24px",
            position: "relative",
            overflow: "hidden",
            color: "#fff",
          }}
        >
          {/* 背景装飾 */}
          <div
            style={{
              position: "absolute",
              right: -20,
              top: -10,
              fontSize: 140,
              opacity: 0.1,
            }}
          >
            🗺️
          </div>
          <div
            style={{
              position: "absolute",
              right: 30,
              bottom: 20,
              fontSize: 60,
              opacity: 0.15,
            }}
          >
            🐾
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* バッジ */}
            <div
              style={{
                display: "inline-block",
                padding: "5px 12px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 14,
                letterSpacing: "0.15em",
              }}
            >
              FACILITY MAP
            </div>

            {/* タイトル */}
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                margin: 0,
                marginBottom: 12,
                lineHeight: 1.3,
              }}
            >
              🗺️ お出かけ先、<br />
              もう迷わない。
            </h2>

            <p
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                margin: 0,
                marginBottom: 22,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              ペット可カフェ・ドッグラン・トリミング・動物病院。
              <br />
              全国のペットフレンドリーな施設を地図で探せます。
            </p>

            {/* 施設タイプアイコン */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 22,
              }}
            >
              {FACILITY_TYPES.map((t) => (
                <div
                  key={t.label}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    padding: "10px 8px",
                    textAlign: "center",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 2 }}>{t.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{t.label}</div>
                </div>
              ))}
            </div>

            {/* CTAボタン */}
            <button
              onClick={() => navigate("/facilities")}
              style={{
                display: "block",
                width: "100%",
                padding: "13px 24px",
                background: "#fff",
                color: "#2E7D32",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              🗺️ マップで施設を探す →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
