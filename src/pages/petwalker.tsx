// ペットウォーカー: ペットと「行きたくなる場所」(宿/カフェ/観光) の情報ページ
// ⚠️ 施設マップ(facilities.tsx)とは別機能。pet_walker_spots テーブル(approved のみ公開)を読む。
// ⚠️ 静けさ世界観: QC トークン・絵文字なし・font-weight<=500・transition 0.8s+・詩的コピー。
// 構成: エリアタイル一覧 → エリア特集(カテゴリ別) → スポット詳細。view 状態は内部 useState。
// ⚠️ 決済・施設マップ・既存テーブルには一切触れない (読むのは pet_walker_spots のみ)。

import { useState, useEffect } from "react";
import { QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY, QC_TIMING } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { PW_AREAS, PW_CATEGORIES, PW_PET_LABELS } from "../constants/petwalker";
import { trackEvent as mpTrackEvent } from "../lib/metaPixel";
import { PetWalkerReviews } from "../components/PetWalkerReviews";
import { FloatingBackButton } from "../components/FloatingBackButton";

type Spot = {
  id: string; name: string; category: string; pref: string; city: string | null;
  pet_types: string[]; description: string | null; area_tag: string;
  secondary_area_tags: string[] | null;
  latitude: number | null; longitude: number | null; address: string | null;
  image_urls: string[] | null;
};

// スポット画像 (Supabase Storage petwalker/spots/*.webp を image_urls に配線)。未配線なら null。
const firstImage = (s: Spot): string | null =>
  Array.isArray(s.image_urls) && s.image_urls.length > 0 ? s.image_urls[0] : null;

// 広域親エリア(九州/日光・那須など)に子エリア(湯布院/阿蘇/奥日光)のスポットも内包する。
// 子エリア固有ページではそのエリア固有のみ。親エリアでは自身+子の合算が見える。
const matchArea = (s: Spot, tag: string) =>
  s.area_tag === tag || (s.secondary_area_tags || []).includes(tag);

const ease = QC_TIMING.hoverEasing;

const petLabel = (types: string[] | null) =>
  (types || []).map((t) => PW_PET_LABELS[t] || t).join("・");

const catLabel = (key: string) => PW_CATEGORIES.find((c) => c.key === key)?.label || key;

// 2026/6/28 軽傷UX-③: ブラウザ「戻る」操作で エリア→トップ・スポット→エリア と1段ずつ
// 巻き戻すための history pushState/popstate パッチ。petwalker.tsx 内に閉じる。React Router 設定不変。
const PW_NAV = "petwalker_nav";

export function PetWalkerPage({ setPage, isPC }: { setPage?: (p: string) => void; isPC?: boolean }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [activeCat, setActiveCat] = useState<string>("all"); // スポット一覧のカテゴリ絞り込み (エリア入場で all にリセット)

  // history 連動ヘルパー: setActive* を直接呼ばずこちらを使う
  const openArea = (tag: string) => {
    setActiveCat("all");
    setActiveArea(tag);
    setActiveSpot(null);
    window.history.pushState({ [PW_NAV]: { type: "area", tag } }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSpot = (s: Spot) => {
    setActiveSpot(s);
    window.history.pushState({ [PW_NAV]: { type: "spot", id: s.id } }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => { window.history.back(); };

  // popstate: ブラウザ「戻る」(右スワイプ/戻るボタン) を捕まえて1段ずつ巻き戻す
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const marker = (e.state as { [k: string]: { type: string; tag?: string; id?: string } } | null)?.[PW_NAV];
      if (marker?.type === "area") {
        // area 状態に巻き戻る: spot を閉じる
        setActiveSpot(null);
      } else {
        // marker 無し = /petwalker 初期状態に巻き戻る: 両方閉じる
        setActiveSpot(null);
        setActiveArea(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("pet_walker_spots")
        .select("id,name,category,pref,city,pet_types,description,area_tag,secondary_area_tags,latitude,longitude,address,image_urls")
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

  // Meta Pixel: スポット詳細表示 (個人情報なし=施設名/カテゴリのみ・no-op安全)
  useEffect(() => {
    if (activeSpot) mpTrackEvent("PetWalkerSpotView", { content_name: activeSpot.name, content_category: activeSpot.category });
  }, [activeSpot]);

  // Meta Pixel: エリア表示 (個人情報なし=エリア名のみ)
  useEffect(() => {
    if (activeArea) mpTrackEvent("PetWalkerAreaView", { content_name: activeArea });
  }, [activeArea]);

  // エリア別件数 (親エリアは子エリア分も内包)
  const countByArea = (tag: string) => spots.filter((s) => matchArea(s, tag)).length;

  // タイル描画 (エリア/テーマ共通)。i は各セクション内の連番 (stagger 用)。
  const renderTile = (a: typeof PW_AREAS[number], i: number) => (
    <button
      key={a.tag}
      onClick={() => openArea(a.tag)}
      className="pw-tile"
      style={{
        ...areaTileStyle,
        // 背景: 暗幕グラデ + 画像 + フォールバック色 を background shorthand 一本で(longhand混在警告回避)。
        background: `linear-gradient(180deg, rgba(44,41,38,0.20) 0%, rgba(44,41,38,0.72) 100%), url("${a.img}") center / cover no-repeat, ${QC.softBrown}`,
        animation: `qocca-fadeInSlowUp 1s ${ease} both`,
        animationDelay: `${0.05 * i}s`,
      }}
    >
      <span style={{ fontFamily: QC_FONT_EN, fontSize: 11.5, letterSpacing: 2.5, color: "rgba(255,255,255,0.9)", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>{a.en}</span>
      <span style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 26 : 20, color: "#fff", margin: "6px 0 8px", textShadow: "0 1px 10px rgba(0,0,0,0.5)" }}>{a.tag}</span>
      <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.92)", fontWeight: 300, lineHeight: 1.7, textShadow: "0 1px 8px rgba(0,0,0,0.55)" }}>{a.blurb}</span>
      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 12, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
        {loading ? "" : `${countByArea(a.tag)} スポット`}
      </span>
    </button>
  );

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
          <button onClick={goBack} style={fixedBackLinkStyle(isPC)}>
            ← {s.area_tag} の一覧へ戻る
          </button>
          {firstImage(s) && (
            <div style={{ marginTop: 20, animation: `qocca-fadeInSlow 1.2s ${ease} both` }}>
              <div style={{ borderRadius: 18, overflow: "hidden", aspectRatio: isPC ? "16 / 9" : "3 / 2", background: QC.cream }}>
                <img
                  src={firstImage(s) as string}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              <p style={{ fontSize: 11, color: QC.sage, fontWeight: 300, textAlign: "right", margin: "6px 2px 0", letterSpacing: 0.3 }}>
                ※画像はイメージです。実際の施設とは異なります。
              </p>
            </div>
          )}
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
            {/* 地図: Googleマップで開く (証明された方式・座標不要・name+地域で検索) */}
            <div style={{ borderTop: `1px solid ${QC.lightSand}`, paddingTop: 28 }}>
              <p style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 2, color: QC.sage, margin: "0 0 8px" }}>LOCATION</p>
              <p style={{ fontSize: 14, color: QC.warmGray, fontWeight: 300, margin: "0 0 16px" }}>
                {[s.pref, s.city].filter(Boolean).join(" ")}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.pref, s.city].filter(Boolean).join(" "))}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 24px", borderRadius: 999,
                  border: `1px solid ${QC.softBrown}`, color: QC.softBrown, background: "transparent",
                  fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 400, textDecoration: "none", letterSpacing: 0.5,
                  transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = QC.softBrown; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = QC.softBrown; }}
              >
                Googleマップで探す →
              </a>
              {/* 情報鮮度の注記 (さりげなく・小さめグレー) */}
              <p style={{ fontSize: 11.5, color: QC.sage, fontWeight: 300, lineHeight: 1.7, marginTop: 20 }}>
                ペット可の条件は変わることがあります。おでかけ前に各施設の最新情報をご確認ください。
              </p>
            </div>
            {/* 口コミ (DB基盤に乗せるだけ・ログイン時のみ投稿/通報・公開はis_hidden=false) */}
            <PetWalkerReviews spotId={s.id} isPC={isPC} />
            {/* Qocca 紹介 + 商店街CTA (広告着地の初見ユーザー向け・控えめ) */}
            <div style={{ marginTop: 40, paddingTop: 28, borderTop: `1px solid ${QC.lightSand}` }}>
              <p style={{ fontSize: 13.5, color: QC.warmGray, fontWeight: 300, lineHeight: 2.0, maxWidth: 600, margin: "0 0 18px" }}>
                Qocca は、ペットと暮らす人のための街。<br />
                お出かけ情報も、うちの子のグッズも、ここで。
              </p>
              <button
                onClick={() => { mpTrackEvent("PetWalkerToMarket"); setPage && setPage("marketplace"); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 24px", borderRadius: 999,
                  border: `1px solid ${QC.lightSand}`, background: "transparent", color: QC.softBrown,
                  fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 400, cursor: "pointer", letterSpacing: 0.5,
                  transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = QC.cream; e.currentTarget.style.borderColor = QC.softBrown; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = QC.lightSand; }}
              >
                商店街をのぞいてみる →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── エリア特集 (カテゴリ別) ────────────────────────────────────
  if (activeArea) {
    const area = PW_AREAS.find((a) => a.tag === activeArea);
    const areaSpots = spots.filter((s) => matchArea(s, activeArea));
    return (
      <div style={{ background: QC.warmWhite, minHeight: "60vh" }}>
        <div style={wrap}>
          <button onClick={goBack} style={fixedBackLinkStyle(isPC)}>
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

          {/* カテゴリ絞り込み (具体的に探し始めた人向け・控えめ)。
              そのエリアに存在するカテゴリのみ・1種以下なら非表示。デフォルト「すべて」。 */}
          {!loading && (() => {
            const avail = PW_CATEGORIES.filter((c) => areaSpots.some((s) => s.category === c.key));
            if (avail.length <= 1) return null;
            const chips = [{ key: "all", label: "すべて" }, ...avail];
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
                {chips.map((c) => {
                  const on = activeCat === c.key;
                  const cnt = c.key === "all" ? areaSpots.length : areaSpots.filter((s) => s.category === c.key).length;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setActiveCat(c.key)}
                      style={{
                        padding: "7px 16px", borderRadius: 999, cursor: "pointer",
                        fontFamily: QC_FONT_JP, fontSize: 13, fontWeight: 400, letterSpacing: 0.4,
                        border: `1px solid ${on ? QC.softBrown : QC.lightSand}`,
                        background: on ? QC.softBrown : "transparent",
                        color: on ? "#fff" : QC.warmGray,
                        transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
                      }}
                    >
                      {c.label} <span style={{ fontSize: 11, opacity: 0.7 }}>{cnt}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {loading ? (
            <p style={{ color: QC.warmGray, fontWeight: 300 }}>読み込んでいます。</p>
          ) : (
            PW_CATEGORIES.filter((cat) => activeCat === "all" || cat.key === activeCat).map((cat) => {
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
                      <button key={s.id} onClick={() => openSpot(s)} style={spotCardStyle} className="pw-card">
                        {firstImage(s) && (
                          <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden", background: QC.cream }}>
                            <img
                              src={firstImage(s) as string}
                              alt=""
                              loading="lazy"
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                            <span style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(44,41,38,0.52)", color: "rgba(255,255,255,0.92)", fontSize: 10, letterSpacing: 0.5, padding: "3px 8px", borderRadius: 999, fontFamily: QC_FONT_JP, fontWeight: 400 }}>
                              イメージ
                            </span>
                          </div>
                        )}
                        <div style={{ padding: "18px 20px" }}>
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
                        </div>
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

        {/* エリアで探す (地名・北→南) */}
        <section style={{ marginBottom: isPC ? 64 : 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 0 22px", paddingBottom: 12, borderBottom: `1px solid ${QC.lightSand}` }}>
            <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 22 : 19, margin: 0, color: QC.softBrown }}>エリアで探す</h2>
            <span style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 2, color: QC.sage }}>By Area</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isPC ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: isPC ? 24 : 14 }}>
            {PW_AREAS.filter((a) => a.kind === "area").map(renderTile)}
          </div>
        </section>

        {/* 目的で探す (テーマ特集) */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 0 22px", paddingBottom: 12, borderBottom: `1px solid ${QC.lightSand}` }}>
            <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 22 : 19, margin: 0, color: QC.softBrown }}>目的で探す</h2>
            <span style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 2, color: QC.sage }}>By Purpose</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isPC ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: isPC ? 24 : 14 }}>
            {PW_AREAS.filter((a) => a.kind === "theme").map(renderTile)}
          </div>
        </section>
      </div>
      {/* 2026/6/29 案① B案: フローティング戻るボタン。内部 view (area一覧/スポット詳細)
          は pushState で履歴に積まれているので navigate(-1) で popstate ハンドラが view を1段ずつ戻す。
          area トップでは TabBar が表示されるので aboveTabBar=true。 */}
      <FloatingBackButton aboveTabBar={true} />
    </div>
  );
}

// ── スタイル ─────────────────────────────────────────────────────
const backLinkStyle: React.CSSProperties = {
  background: "none", border: "none", color: QC.softBrown, fontFamily: QC_FONT_JP,
  fontSize: 14, fontWeight: 400, cursor: "pointer", padding: 0, letterSpacing: 0.5,
};

// 2026/6/28 軽傷UX-②: スクロール追従する戻るボタン。常時画面左上に貼り付く。
//   モバイル: 固定Navbar(高さ60)の下 / PC: 固定PCNavbar(高さ68)の下。半透明+blur で景色を遮らない。
const fixedBackLinkStyle = (isPC?: boolean): React.CSSProperties => ({
  position: "fixed",
  top: isPC ? 80 : 70,
  left: isPC ? 32 : 16,
  zIndex: 20,
  background: "rgba(250, 247, 242, 0.92)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: `1px solid ${QC.lightSand}`,
  borderRadius: 999,
  color: QC.softBrown,
  fontFamily: QC_FONT_JP,
  fontSize: 13,
  fontWeight: 400,
  cursor: "pointer",
  padding: "8px 14px",
  letterSpacing: 0.3,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
});

const tagStyle: React.CSSProperties = {
  fontSize: 12.5, color: QC.warmGray, background: QC.cream, border: `1px solid ${QC.lightSand}`,
  borderRadius: 999, padding: "5px 14px", fontWeight: 400,
};

const spotCardStyle: React.CSSProperties = {
  textAlign: "left", background: "#fff", border: `1px solid ${QC.lightSand}`, borderRadius: 14,
  padding: 0, overflow: "hidden", cursor: "pointer", fontFamily: QC_FONT_JP, width: "100%", display: "block",
};

const areaTileStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-end",
  border: "none", borderRadius: 16, overflow: "hidden",
  padding: "22px 22px", cursor: "pointer", fontFamily: QC_FONT_JP, textAlign: "left", minHeight: 200,
};
