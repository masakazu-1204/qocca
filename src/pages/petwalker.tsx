// ペットウォーカー: ペットと「行きたくなる場所」(宿/カフェ/観光) の情報ページ
// ⚠️ 施設マップ(facilities.tsx)とは別機能。pet_walker_spots テーブル(approved のみ公開)を読む。
// ⚠️ 静けさ世界観: QC トークン・絵文字なし・font-weight<=500・transition 0.8s+・詩的コピー。
// 構成: エリアタイル一覧 → エリア特集(カテゴリ別) → スポット詳細。view 状態は内部 useState。
// ⚠️ 決済・施設マップ・既存テーブルには一切触れない (読むのは pet_walker_spots のみ)。

import { useState, useEffect } from "react";
import { QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY, QC_TIMING } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { PW_AREAS, PW_CATEGORIES, PW_PET_LABELS } from "../constants/petwalker";

type Spot = {
  id: string; name: string; category: string; pref: string; city: string | null;
  pet_types: string[]; description: string | null; area_tag: string;
  latitude: number | null; longitude: number | null; address: string | null;
};

const ease = QC_TIMING.hoverEasing;

const petLabel = (types: string[] | null) =>
  (types || []).map((t) => PW_PET_LABELS[t] || t).join("・");

const catLabel = (key: string) => PW_CATEGORIES.find((c) => c.key === key)?.label || key;

export function PetWalkerPage({ setPage, isPC }: { setPage?: (p: string) => void; isPC?: boolean }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("pet_walker_spots")
        .select("id,name,category,pref,city,pet_types,description,area_tag,latitude,longitude,address")
        .eq("approval_status", "approved")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (alive) {
        setSpots((data as Spot[]) || []);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // エリア別件数
  const countByArea = (tag: string) => spots.filter((s) => s.area_tag === tag).length;

  // ⚠️ モバイルは固定Navbar(position:fixed, height:60)があるため top=76 (60+余白16) でクリア。
  //   PCは App側で paddingTop:68 済 + 固定PCNavbar(68) なので 64 でOK。(facilities の paddingTop:isPC?0:60 と同作法)
  const wrap: React.CSSProperties = {
    maxWidth: 1080, margin: "0 auto", padding: isPC ? "64px 32px 120px" : "76px 20px 96px",
    fontFamily: QC_FONT_JP, color: QC.charcoal, background: QC.warmWhite,
  };

  // ── スポット詳細 ───────────────────────────────────────────────
  if (activeSpot) {
    const s = activeSpot;
    return (
      <div style={{ background: QC.warmWhite, minHeight: "60vh" }}>
        <div style={wrap}>
          <button onClick={() => setActiveSpot(null)} style={backLinkStyle}>
            ← {s.area_tag} の一覧へ戻る
          </button>
          <div style={{ marginTop: 28, animation: `qocca-fadeInSlowUp 1s ${ease} both` }}>
            <p style={{ fontFamily: QC_FONT_EN, fontSize: 13, letterSpacing: 2, color: QC.sage, margin: "0 0 10px" }}>
              {PW_CATEGORIES.find((c) => c.key === s.category)?.en || ""}
            </p>
            <h1 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 34 : 26, lineHeight: 1.5, margin: "0 0 16px", color: QC.charcoal }}>
              {s.name}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
              <span style={tagStyle}>{catLabel(s.category)}</span>
              <span style={tagStyle}>{[s.pref, s.city].filter(Boolean).join(" ")}</span>
              {petLabel(s.pet_types) && <span style={tagStyle}>{petLabel(s.pet_types)} と</span>}
            </div>
            {s.description && (
              <p style={{ fontSize: isPC ? 17 : 15, lineHeight: 2.0, color: QC.warmGray, fontWeight: 300, maxWidth: 720, margin: "0 0 36px" }}>
                {s.description}
              </p>
            )}
            {/* 地図ピン: 座標は準備中 (lat/lng が入ったら地図表示に拡張予定) */}
            <div style={{ borderTop: `1px solid ${QC.lightSand}`, paddingTop: 28 }}>
              <p style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 2, color: QC.sage, margin: "0 0 8px" }}>LOCATION</p>
              {s.latitude != null && s.longitude != null ? (
                <p style={{ fontSize: 14, color: QC.warmGray, fontWeight: 300 }}>
                  {s.address || [s.pref, s.city].filter(Boolean).join(" ")}（{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}）
                </p>
              ) : (
                <p style={{ fontSize: 14, color: QC.warmGray, fontWeight: 300 }}>
                  {[s.pref, s.city].filter(Boolean).join(" ")} ・ 地図は準備中です。
                </p>
              )}
              {/* 情報鮮度の注記 (さりげなく・小さめグレー) */}
              <p style={{ fontSize: 11.5, color: QC.sage, fontWeight: 300, lineHeight: 1.7, marginTop: 16 }}>
                ペット可の条件は変わることがあります。おでかけ前に各施設の最新情報をご確認ください。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── エリア特集 (カテゴリ別) ────────────────────────────────────
  if (activeArea) {
    const area = PW_AREAS.find((a) => a.tag === activeArea);
    const areaSpots = spots.filter((s) => s.area_tag === activeArea);
    return (
      <div style={{ background: QC.warmWhite, minHeight: "60vh" }}>
        <div style={wrap}>
          <button onClick={() => setActiveArea(null)} style={backLinkStyle}>
            ← エリアをえらぶ
          </button>
          <div
            style={{
              marginTop: 20, marginBottom: 48, borderRadius: 18, overflow: "hidden",
              padding: isPC ? "64px 40px" : "44px 26px",
              display: "flex", flexDirection: "column", justifyContent: "flex-end",
              minHeight: isPC ? 280 : 200,
              background: `linear-gradient(180deg, rgba(44,41,38,0.25) 0%, rgba(44,41,38,0.70) 100%), url("${area?.img}") center / cover no-repeat, ${QC.softBrown}`,
              animation: `qocca-fadeInSlow 1.2s ${ease} both`,
            }}
          >
            <p style={{ fontFamily: QC_FONT_EN, fontSize: 14, letterSpacing: 3, color: "rgba(255,255,255,0.9)", margin: "0 0 10px", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              {area?.en}
            </p>
            <h1 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 40 : 30, margin: "0 0 12px", color: "#fff", textShadow: "0 2px 14px rgba(0,0,0,0.55)" }}>
              {activeArea}
            </h1>
            <p style={{ fontSize: isPC ? 17 : 15, color: "rgba(255,255,255,0.95)", fontWeight: 300, lineHeight: 1.9, textShadow: "0 1px 10px rgba(0,0,0,0.6)", margin: 0 }}>
              {area?.blurb}
            </p>
          </div>

          {loading ? (
            <p style={{ color: QC.warmGray, fontWeight: 300 }}>読み込んでいます。</p>
          ) : (
            PW_CATEGORIES.map((cat) => {
              const list = areaSpots.filter((s) => s.category === cat.key);
              if (list.length === 0) return null;
              return (
                <section key={cat.key} style={{ marginBottom: 56 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20, borderBottom: `1px solid ${QC.lightSand}`, paddingBottom: 12 }}>
                    <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: 22, margin: 0, color: QC.softBrown }}>{cat.label}</h2>
                    <span style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 2, color: QC.sage }}>{cat.en}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap: 18 }}>
                    {list.map((s) => (
                      <button key={s.id} onClick={() => setActiveSpot(s)} style={spotCardStyle} className="pw-card">
                        <div style={{ fontFamily: QC_FONT_JP, fontWeight: 500, fontSize: 16, color: QC.charcoal, marginBottom: 8, lineHeight: 1.6 }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 12.5, color: QC.sage, marginBottom: 10 }}>
                          {[s.pref, s.city].filter(Boolean).join(" ")}
                        </div>
                        {s.description && (
                          <div style={{ fontSize: 13.5, color: QC.warmGray, fontWeight: 300, lineHeight: 1.85, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {s.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── エリア一覧 (タイル) ────────────────────────────────────────
  return (
    <div style={{ background: QC.warmWhite, minHeight: "60vh" }}>
      <style>{`.pw-card{transition: all ${QC_TIMING.hoverDuration} ${ease};} .pw-card:hover{transform: translateY(-3px); box-shadow: 0 10px 30px rgba(44,41,38,0.08);} .pw-tile{transition: all ${QC_TIMING.hoverDuration} ${ease};} .pw-tile:hover{transform: translateY(-4px); box-shadow: 0 14px 40px rgba(44,41,38,0.10);}`}</style>
      <div style={wrap}>
        <div style={{ textAlign: "center", marginBottom: isPC ? 72 : 48, animation: `qocca-fadeInSlow 1.2s ${ease} both` }}>
          <p style={{ fontFamily: QC_FONT_EN, fontSize: 14, letterSpacing: 4, color: QC.sage, margin: "0 0 14px" }}>
            Pet Walker
          </p>
          <h1 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 44 : 30, lineHeight: 1.5, margin: "0 0 18px", color: QC.charcoal }}>
            うちの子と、出かける。
          </h1>
          <p style={{ fontSize: isPC ? 17 : 15, color: QC.warmGray, fontWeight: 300, lineHeight: 2.0, maxWidth: 560, margin: "0 auto" }}>
            泊まれる宿、一緒に入れるカフェ、歩きたくなる場所。<br />
            この子と過ごす旅を、エリアごとに。
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isPC ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: isPC ? 24 : 14 }}>
          {PW_AREAS.map((a, i) => (
            <button
              key={a.tag}
              onClick={() => { setActiveArea(a.tag); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="pw-tile"
              style={{
                ...areaTileStyle,
                // 背景: 暗幕グラデ + 画像 + フォールバック色 を background shorthand 一本で(longhand混在警告回避)。
                // 画像欠落時は末尾の softBrown が残り白文字が読める。
                background: `linear-gradient(180deg, rgba(44,41,38,0.20) 0%, rgba(44,41,38,0.72) 100%), url("${a.img}") center / cover no-repeat, ${QC.softBrown}`,
                animation: `qocca-fadeInSlowUp 1s ${ease} both`,
                animationDelay: `${0.06 * i}s`,
              }}
            >
              <span style={{ fontFamily: QC_FONT_EN, fontSize: 11.5, letterSpacing: 2.5, color: "rgba(255,255,255,0.9)", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>{a.en}</span>
              <span style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 26 : 20, color: "#fff", margin: "6px 0 8px", textShadow: "0 1px 10px rgba(0,0,0,0.5)" }}>{a.tag}</span>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.92)", fontWeight: 300, lineHeight: 1.7, textShadow: "0 1px 8px rgba(0,0,0,0.55)" }}>{a.blurb}</span>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 12, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
                {loading ? "" : `${countByArea(a.tag)} スポット`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── スタイル ─────────────────────────────────────────────────────
const backLinkStyle: React.CSSProperties = {
  background: "none", border: "none", color: QC.softBrown, fontFamily: QC_FONT_JP,
  fontSize: 14, fontWeight: 400, cursor: "pointer", padding: 0, letterSpacing: 0.5,
};

const tagStyle: React.CSSProperties = {
  fontSize: 12.5, color: QC.warmGray, background: QC.cream, border: `1px solid ${QC.lightSand}`,
  borderRadius: 999, padding: "5px 14px", fontWeight: 400,
};

const spotCardStyle: React.CSSProperties = {
  textAlign: "left", background: "#fff", border: `1px solid ${QC.lightSand}`, borderRadius: 14,
  padding: "20px 22px", cursor: "pointer", fontFamily: QC_FONT_JP, width: "100%", display: "block",
};

const areaTileStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-end",
  border: "none", borderRadius: 16, overflow: "hidden",
  padding: "22px 22px", cursor: "pointer", fontFamily: QC_FONT_JP, textAlign: "left", minHeight: 200,
};
