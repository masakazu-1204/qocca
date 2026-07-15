// src/components/ArkDonationStats.tsx
// ─────────────────────────────────────────────────────────────────
// 依頼書 #108 (2026/6/4): ARK 透明性機能 (累計送金額表示)
//
// 規約 v2.0 第11条第5項「販売手数料収入の3%を…寄付に充当します。
// 寄付の実績は、当サービスウェブサイト上にて定期的に公表します。」
// を実装で担保するコンポーネント。
//
// 永続記録 #20 ARK連携運用 v2.1 ⑦透明性 体現
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Heart, PawPrint } from "lucide-react";

const BRAND = "#F5A94A";
const BRAND_DEEP = "#B27820";
const CREAM = "#FFF9F0";
const TEXT_DARK = "#2C2C2A";
const TEXT_MUTED = "#888780";
const BORDER_WARM = "#F5E6D0";
const PINK_TINT = "#FFF4F4";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou";

type Summary = {
  total_donated_jpy: number;
  donation_count: number;
  latest_donation_date: string | null;
  first_donation_date: string | null;
};

export default function ArkDonationStats() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
        const { data } = await sb
          .from("ark_donations_summary")
          .select("*")
          .single();
        if (!cancelled) setSummary(data as Summary | null);
      } catch (e) {
        console.warn("ArkDonationStats: fetch failed (silent)", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const total = summary?.total_donated_jpy ?? 0;
  const count = summary?.donation_count ?? 0;
  const latest = summary?.latest_donation_date;
  const isZero = total === 0 || count === 0;

  return (
    <section
      style={{
        background: "#FFFFFF",
        padding: "48px 16px",
        color: TEXT_DARK,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            background: `linear-gradient(180deg, ${CREAM} 0%, ${PINK_TINT} 100%)`,
            border: `1px solid ${BORDER_WARM}`,
            borderRadius: 20,
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          {/* ヘッダ */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              letterSpacing: "0.18em",
              color: BRAND_DEEP,
              marginBottom: 14,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            <Heart size={12} strokeWidth={2} color={BRAND_DEEP} />
            TRANSPARENCY · 規約 v2.0 第11条第5項
          </div>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: TEXT_DARK,
              margin: "0 0 4px",
              lineHeight: 1.7,
            }}
          >
            🐾 特定非営利活動法人
            <br />
            <span style={{ fontWeight: 700 }}>アニマルレフュージ関西</span>
            様への
          </h3>
          <div
            style={{
              fontSize: 12,
              color: TEXT_MUTED,
              marginBottom: 20,
            }}
          >
            これまでの寄付 累計
          </div>

          {/* 累計表示 or 準備中 */}
          {isZero ? (
            <div
              style={{
                padding: "22px 16px",
                background: "#FFFFFF",
                border: `1px dashed ${BORDER_WARM}`,
                borderRadius: 14,
                fontSize: 13,
                color: TEXT_MUTED,
                lineHeight: 1.8,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <PawPrint
                  size={22}
                  strokeWidth={1.6}
                  color={BRAND}
                />
              </div>
              <div>
                寄付活動は{" "}
                <strong style={{ color: TEXT_DARK }}>
                  2026年7月1日のグランドオープン後
                </strong>
                <br />
                より順次開始予定です。
              </div>
              <div style={{ marginTop: 10, fontSize: 12 }}>
                売上の{" "}
                <strong style={{ color: BRAND_DEEP }}>3%</strong>{" "}
                を継続的に寄付してまいります。
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 48,
                  fontWeight: 700,
                  color: BRAND_DEEP,
                  margin: "8px 0",
                  letterSpacing: "0.02em",
                  lineHeight: 1.1,
                }}
              >
                ¥{total.toLocaleString()}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  justifyContent: "center",
                  flexWrap: "wrap",
                  marginTop: 14,
                  fontSize: 12,
                  color: TEXT_MUTED,
                }}
              >
                <span>
                  最新送金日: {latest ? formatJpDate(latest) : "—"}
                </span>
                <span>送金回数: {count}回</span>
              </div>
            </>
          )}

          {/* キャプション */}
          <p
            style={{
              marginTop: 24,
              fontSize: 12,
              color: TEXT_MUTED,
              lineHeight: 1.8,
            }}
          >
            Qoccaは販売手数料収入の{" "}
            <strong style={{ color: BRAND_DEEP }}>3%</strong> を、
            <br />
            アニマルレフュージ関西様に継続的に寄付しています。
          </p>
        </div>
      </div>
    </section>
  );
}

function formatJpDate(s: string): string {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return s;
  }
}
