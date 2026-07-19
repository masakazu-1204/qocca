// ペットウォーカー: ペットと「行きたくなる場所」(宿/カフェ/観光) の情報ページ
// ⚠️ 施設マップ(facilities.tsx)とは別機能。pet_walker_spots テーブル(approved のみ公開)を読む。
// ⚠️ 静けさ世界観: QC トークン・絵文字なし・font-weight<=500・transition 0.8s+・詩的コピー。
// 構成: エリアタイル一覧 → エリア特集(カテゴリ別) → スポット詳細。view 状態は内部 useState。
// ⚠️ 決済・施設マップ・既存テーブルには一切触れない (読むのは pet_walker_spots のみ)。

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY, QC_TIMING } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { PW_AREAS, PW_CATEGORIES, PW_PET_LABELS } from "../constants/petwalker";
import { trackEvent as mpTrackEvent } from "../lib/metaPixel";
import { PetWalkerReviews } from "../components/PetWalkerReviews";
import { FloatingBackButton } from "../components/FloatingBackButton";
// 2026/7/16 特集 Phase1: 雑誌レイアウトの特集記事 (blog_posts post_type='magazine')
import { PetWalkerMagazine, type MagazineArticle } from "../components/PetWalkerMagazine";

// GPS Phase3: 近隣マップ (Leaflet は地図表示時のみロード = lazy)
const PetWalkerMapView = lazy(() => import("../components/PetWalkerMapView"));

type Spot = {
  id: string; name: string; category: string; pref: string; city: string | null;
  pet_types: string[]; description: string | null; area_tag: string;
  secondary_area_tags: string[] | null;
  latitude: number | null; longitude: number | null; address: string | null;
  image_urls: string[] | null;
  source_note: string | null; // 2026/7/16 特集Phase1: 記事内で「ペット可条件+公式根拠」を最新表示するため
};

// スポット画像 (Supabase Storage petwalker/spots/*.webp を image_urls に配線)。未配線なら null。
const firstImage = (s: Spot): string | null =>
  Array.isArray(s.image_urls) && s.image_urls.length > 0 ? s.image_urls[0] : null;

// 広域親エリア(九州/日光・那須など)に子エリア(湯布院/阿蘇/奥日光)のスポットも内包する。
// 子エリア固有ページではそのエリア固有のみ。親エリアでは自身+子の合算が見える。
const matchArea = (s: Spot, tag: string) =>
  s.area_tag === tag || (s.secondary_area_tags || []).includes(tag);

const ease = QC_TIMING.hoverEasing;

// 2026/7/12 GPS Phase2 (docs/petwalker-gps-design.md): 距離計算 (client haversine)。
// 現在地は端末内でのみ使用 (サーバー送信・保存・ログなし)。
const rad = (d: number) => (d * Math.PI) / 180;
const distKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371, dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
// 表示は丸めて「約」を付ける (過度な精密演出をしない)
const distLabel = (km: number) => (km < 1 ? `約${Math.max(10, Math.round((km * 1000) / 10) * 10)}m` : `約${km.toFixed(1)}km`);

const petLabel = (types: string[] | null) =>
  (types || []).map((t) => PW_PET_LABELS[t] || t).join("・");

const catLabel = (key: string) => PW_CATEGORIES.find((c) => c.key === key)?.label || key;

// 2026/6/28 軽傷UX-③: ブラウザ「戻る」操作で エリア→トップ・スポット→エリア と1段ずつ
// 巻き戻すための history pushState/popstate パッチ。petwalker.tsx 内に閉じる。
const PW_NAV = "petwalker_nav";

// ── 共有可能URL (2026/7/17) ──────────────────────────────────────
// 目的: 広告の着地先・SNSからの個別リンク・将来のSEO。それまで全ビューが /petwalker のままだった。
// ⚠️ ルートは App.tsx 側で "/petwalker/*" のワイルドカード1本。こうすると URL が変わっても
//    React Router から見て同一ルート = 再マウントしない → 1,551件の再取得も戻る挙動も現状不変。
//    URL の反映は既存の pushState に第3引数を足すだけ。popstate ハンドラの marker 判定は不変。
const areaSlugOf = (tag: string) => PW_AREAS.find((a) => a.tag === tag)?.slug || null;
const PW_URL = {
  top: "/petwalker",
  area: (tag: string) => { const s = areaSlugOf(tag); return s ? `/petwalker/area/${s}` : "/petwalker"; },
  spot: (id: string) => `/petwalker/spot/${id}`,
  feature: (m: { id: string; slug?: string | null }) => `/petwalker/feature/${m.slug || m.id}`,
  nearby: "/petwalker/nearby",
};

// 初期URL (マウント時に1度だけ読む) → 開くべきビュー。以降の遷移は pushState 側が URL を持つ。
type DeepLink = { type: "area"; slug: string } | { type: "spot"; id: string } | { type: "feature"; key: string } | null;
const parseDeepLink = (pathname: string): DeepLink => {
  const m = pathname.match(/^\/petwalker\/(area|spot|feature)\/([^/?#]+)\/?$/);
  if (!m) return null;
  const key = decodeURIComponent(m[2]);
  if (m[1] === "area") return { type: "area", slug: key };
  if (m[1] === "spot") return { type: "spot", id: key };
  return { type: "feature", key };
};

export function PetWalkerPage({ setPage, isPC, likedSpots, onLikeSpot }: {
  setPage?: (p: string) => void; isPC?: boolean;
  // 2026/7/13 横断お気に入り Phase2: スポット保存 (未接続でも動くよう任意プロップ)
  likedSpots?: Record<string, boolean>; onLikeSpot?: (spotId: string) => void;
}) {
  // 2026/7/19 #3: 未ログイン誘導の出し分けに使用 (読むだけ)。AuthContext は createContext(null) で
  // 未型付け(既存の型負債)のため、最小形にキャストして受ける (any は使わない・型負債を増やさない)。
  const user = (useAuth() as { user: { id: string } | null } | null)?.user ?? null;
  const navigate = useNavigate();
  const goLogin = () => navigate("/login");
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [activeCat, setActiveCat] = useState<string>("all"); // スポット一覧のカテゴリ絞り込み (エリア入場で all にリセット)
  // 2026/7/12 GPS Phase2: 現在地から近い順。位置情報はボタンタップ時のみ取得 (ロード時自動リクエスト禁止)。
  const [nearbyOn, setNearbyOn] = useState(false);
  const [nearbyStatus, setNearbyStatus] = useState<"locating" | "ready" | "denied" | "error">("locating");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyLimit, setNearbyLimit] = useState(30); // 近い順の表示件数 (「もうすこし遠くまで」で+30)
  const [nearbyMode, setNearbyMode] = useState<"list" | "map">("list"); // GPS Phase3: リスト/地図トグル
  // 2026/7/16 特集 Phase1: 公開済み特集記事 (published=true のみ。draft は棚に出ない)
  const [magazines, setMagazines] = useState<MagazineArticle[]>([]);
  const [activeMagazine, setActiveMagazine] = useState<MagazineArticle | null>(null);

  // history 連動ヘルパー: setActive* を直接呼ばずこちらを使う
  const openArea = (tag: string) => {
    setActiveCat("all");
    setActiveArea(tag);
    setActiveSpot(null);
    window.history.pushState({ [PW_NAV]: { type: "area", tag } }, "", PW_URL.area(tag));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSpot = (s: Spot) => {
    setActiveSpot(s);
    window.history.pushState({ [PW_NAV]: { type: "spot", id: s.id } }, "", PW_URL.spot(s.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => { window.history.back(); };
  // 特集 Phase1: 記事を開く (PW_NAV pushState パターン踏襲)
  const openMagazine = (m: MagazineArticle) => {
    setActiveMagazine(m);
    setActiveSpot(null);
    window.history.pushState({ [PW_NAV]: { type: "magazine", id: m.id } }, "", PW_URL.feature(m));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // GPS Phase2: nearby view を開く。geolocation はここ (明示タップ) でのみ発火。
  const openNearby = () => {
    setActiveCat("all");
    setNearbyLimit(30);
    setNearbyMode("list");
    setNearbyOn(true);
    setNearbyStatus("locating");
    window.history.pushState({ [PW_NAV]: { type: "nearby" } }, "", PW_URL.nearby);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!("geolocation" in navigator)) { setNearbyStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNearbyStatus("ready"); },
      (err) => { setNearbyStatus(err.code === 1 ? "denied" : "error"); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  // popstate: ブラウザ「戻る」(右スワイプ/戻るボタン) を捕まえて1段ずつ巻き戻す
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const marker = (e.state as { [k: string]: { type: string; tag?: string; id?: string } } | null)?.[PW_NAV];
      if (marker?.type === "area") {
        // area 状態に巻き戻る: spot を閉じる
        setActiveSpot(null);
      } else if (marker?.type === "nearby") {
        // nearby 状態に巻き戻る: spot を閉じる (nearby は維持)
        setActiveSpot(null);
      } else if (marker?.type === "magazine") {
        // 特集記事に巻き戻る: spot を閉じる (記事は維持)
        setActiveSpot(null);
      } else {
        // marker 無し = /petwalker 初期状態に巻き戻る: 全て閉じる
        setActiveSpot(null);
        setActiveArea(null);
        setNearbyOn(false);
        setActiveMagazine(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      // 2026/7/12 バグ修正: supabase-js デフォルト上限1000行のため、1,551件時代に
      // 後半カテゴリ(spot等)が丸ごと欠落していた (道の駅0件表示等)。range ページングで全件取得。
      const PAGE = 1000;
      let all: Spot[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data } = await supabase
          .from("pet_walker_spots")
          .select("id,name,category,pref,city,pet_types,description,area_tag,secondary_area_tags,latitude,longitude,address,image_urls,source_note")
          .eq("approval_status", "approved")
          .order("category", { ascending: true })
          .order("name", { ascending: true })
          .range(from, from + PAGE - 1);
        const rows = (data as Spot[]) || [];
        all = all.concat(rows);
        if (rows.length < PAGE) break;
      }
      if (alive) {
        setSpots(all);
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

  // Meta Pixel: 近く検索表示 (⚠️座標・位置情報は一切送らない)
  useEffect(() => {
    if (nearbyOn) mpTrackEvent("PetWalkerNearbyView");
  }, [nearbyOn]);

  // 特集 Phase1: 公開済み特集を取得 (published=true のみ = RLS とも一致。0件なら棚ごと非表示)
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,slug,title,content,hero_image_url,spot_ids,meta_description")
        .eq("post_type", "magazine")
        .eq("published", true)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(12);
      if (alive) setMagazines((data as MagazineArticle[]) || []);
    })();
    return () => { alive = false; };
  }, []);

  // Meta Pixel: 特集表示 (記事タイトルのみ・個人情報なし)
  useEffect(() => {
    if (activeMagazine) mpTrackEvent("PetWalkerMagazineView", { content_name: activeMagazine.title });
  }, [activeMagazine]);

  // ── 共有可能URL: 直リンクで来た人を、そのビューまで連れていく (2026/7/17) ──────
  // マウント時の URL を1度だけ読み、必要データが揃った時点で1回だけ開く。
  // 「もどる」がサイト外に出ないよう、履歴を [トップ] → [目的のビュー] の2段に整えてから開く。
  const initialPathRef = useRef<string>(typeof window === "undefined" ? "" : window.location.pathname);
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current) return;
    const link = parseDeepLink(initialPathRef.current);
    if (!link) { deepLinkDoneRef.current = true; return; }

    // 深いURLの手前に「トップ」の履歴を1枚差し込む (戻る先を作る)
    const seedHistory = (marker: object, url: string) => {
      window.history.replaceState({}, "", PW_URL.top);
      window.history.pushState({ [PW_NAV]: marker }, "", url);
    };

    if (link.type === "area") {
      const area = PW_AREAS.find((a) => a.slug === link.slug);
      deepLinkDoneRef.current = true;
      if (area) {
        seedHistory({ type: "area", tag: area.tag }, PW_URL.area(area.tag));
        setActiveCat("all");
        setActiveArea(area.tag);
      }
      return; // 該当なし = トップのまま (404 にはしない)
    }
    if (link.type === "spot") {
      if (spots.length === 0) return; // 読み込み待ち
      const s = spots.find((x) => x.id === link.id);
      deepLinkDoneRef.current = true;
      if (s) {
        seedHistory({ type: "spot", id: s.id }, PW_URL.spot(s.id));
        setActiveSpot(s);
      }
      return;
    }
    // feature: slug 優先・旧ID でも開けるようフォールバック
    if (magazines.length === 0) return; // 読み込み待ち
    const m = magazines.find((x) => x.slug === link.key || x.id === link.key);
    deepLinkDoneRef.current = true;
    if (m) {
      seedHistory({ type: "magazine", id: m.id }, PW_URL.feature(m));
      setActiveMagazine(m);
    }
  }, [spots, magazines]);

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
            ← {activeMagazine ? "特集へ戻る" : nearbyOn ? "近くの一覧へ戻る" : `${s.area_tag} の一覧へ戻る`}
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              <span style={tagStyle}>{catLabel(s.category)}</span>
              <span style={tagStyle}>{[s.pref, s.city].filter(Boolean).join(" ")}</span>
              {petLabel(s.pet_types) && <span style={tagStyle}>{petLabel(s.pet_types)} と</span>}
            </div>
            {/* 2026/7/13 横断お気に入り Phase2: スポット保存 (静けさ世界観・絵文字なし・状態は文言で示す) */}
            {onLikeSpot && (() => {
              const saved = !!likedSpots?.[s.id];
              return (
                <button
                  onClick={() => onLikeSpot(s.id)}
                  aria-pressed={saved}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "10px 22px", borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${saved ? QC.softBrown : QC.lightSand}`,
                    background: saved ? QC.softBrown : "transparent",
                    color: saved ? "#fff" : QC.softBrown,
                    fontFamily: QC_FONT_JP, fontSize: 13.5, fontWeight: 400, letterSpacing: 0.5,
                    marginBottom: 28,
                    transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
                  }}
                >
                  {saved ? "保存済み" : "この場所を保存"}
                </button>
              );
            })()}
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

  // ── 特集記事 (Phase1・雑誌レイアウト) ────────────────────────────
  if (activeMagazine) {
    return (
      <>
        <PetWalkerMagazine
          article={activeMagazine}
          spots={spots}
          isPC={isPC}
          onBack={goBack}
          onSpotClick={(id) => { const s = spots.find((x) => x.id === id); if (s) openSpot(s); }}
          likedSpots={likedSpots}
          onLikeSpot={onLikeSpot}
          isLoggedIn={!!user}
          onJoin={goLogin}
        />
        <FloatingBackButton aboveTabBar={true} />
      </>
    );
  }

  // ── いまいる場所のちかくで (GPS Phase2) ─────────────────────────
  // 座標あり (1,531/1,551件) のみ距離ソートで表示。座標なしは従来どおりエリアから。
  if (nearbyOn) {
    const withDist = userLoc
      ? spots
          .filter((s) => s.latitude != null && s.longitude != null)
          .map((s) => ({ s, d: distKm(userLoc.lat, userLoc.lng, s.latitude as number, s.longitude as number) }))
          .sort((a, b) => a.d - b.d)
      : [];
    const catFiltered = withDist.filter(({ s }) => activeCat === "all" || s.category === activeCat);
    const shown = catFiltered.slice(0, nearbyLimit);
    const avail = PW_CATEGORIES.filter((c) => withDist.some(({ s }) => s.category === c.key));
    return (
      <div style={{ background: QC.warmWhite, minHeight: "60vh" }}>
        <style>{`.pw-card{transition: all ${QC_TIMING.hoverDuration} ${ease};} .pw-card:hover{transform: translateY(-3px); box-shadow: 0 10px 30px rgba(44,41,38,0.08);}`}</style>
        <div style={wrap}>
          <button onClick={goBack} style={fixedBackLinkStyle(isPC)}>← もどる</button>
          <div style={{ marginTop: 20, marginBottom: 40, animation: `qocca-fadeInSlowUp 1s ${ease} both` }}>
            <p style={{ fontFamily: QC_FONT_EN, fontSize: 13, letterSpacing: 3, color: QC.sage, margin: "0 0 10px" }}>NEARBY</p>
            <h1 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 34 : 26, margin: "0 0 12px", color: QC.charcoal }}>
              近くのおでかけ先
            </h1>
            <p style={{ fontSize: 13, color: QC.sage, fontWeight: 300, margin: 0 }}>
              位置情報は、この端末の中だけで使います。
            </p>
          </div>

          {nearbyStatus === "locating" && (
            <p style={{ color: QC.warmGray, fontWeight: 300, lineHeight: 2.0 }}>いまの場所をたずねています。</p>
          )}
          {(nearbyStatus === "denied" || nearbyStatus === "error") && (
            <div style={{ animation: `qocca-fadeInSlowUp 1s ${ease} both` }}>
              <p style={{ color: QC.warmGray, fontWeight: 300, lineHeight: 2.0, margin: "0 0 20px" }}>
                {nearbyStatus === "denied"
                  ? "位置情報が使えないときは、エリアからどうぞ。"
                  : "うまく取得できませんでした。エリアからもさがせます。"}
              </p>
              <button
                onClick={goBack}
                style={{
                  padding: "11px 24px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${QC.softBrown}`, color: QC.softBrown, background: "transparent",
                  fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 400, letterSpacing: 0.5,
                  transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
                }}
              >
                エリアからさがす →
              </button>
            </div>
          )}

          {nearbyStatus === "ready" && (
            <>
              {/* GPS Phase3: リスト/地図トグル (控えめ2択) */}
              <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
                {([["list", "リスト"], ["map", "地図"]] as const).map(([key, label]) => {
                  const on = nearbyMode === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setNearbyMode(key)}
                      style={{
                        padding: "7px 18px", borderRadius: 999, cursor: "pointer",
                        fontFamily: QC_FONT_JP, fontSize: 13, fontWeight: 400, letterSpacing: 0.4,
                        border: `1px solid ${on ? QC.softBrown : QC.lightSand}`,
                        background: on ? QC.softBrown : "transparent",
                        color: on ? "#fff" : QC.warmGray,
                        transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {avail.length > 1 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
                  {[{ key: "all", label: "すべて" }, ...avail].map((c) => {
                    const on = activeCat === c.key;
                    const cnt = c.key === "all" ? withDist.length : withDist.filter(({ s }) => s.category === c.key).length;
                    return (
                      <button
                        key={c.key}
                        onClick={() => { setActiveCat(c.key); setNearbyLimit(30); }}
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
              )}
              {nearbyMode === "map" ? (
                <Suspense fallback={<p style={{ color: QC.warmGray, fontWeight: 300 }}>地図をよういしています。</p>}>
                  <PetWalkerMapView
                    items={catFiltered}
                    userLoc={userLoc as { lat: number; lng: number }}
                    isPC={isPC}
                    distLabel={distLabel}
                    onSelect={(m) => { const hit = spots.find((x) => x.id === m.id); if (hit) openSpot(hit); }}
                  />
                </Suspense>
              ) : (
                <>
              <div style={{ display: "grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap: 18 }}>
                {shown.map(({ s, d }) => (
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
                      <div style={{ fontSize: 12.5, color: QC.sage, marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span>{[s.pref, s.city].filter(Boolean).join(" ")}</span>
                        <span style={{ whiteSpace: "nowrap" }}>{distLabel(d)}</span>
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
              {catFiltered.length > nearbyLimit && (
                <div style={{ textAlign: "center", marginTop: 36 }}>
                  <button
                    onClick={() => setNearbyLimit((n) => n + 30)}
                    style={{
                      padding: "11px 28px", borderRadius: 999, cursor: "pointer",
                      border: `1px solid ${QC.lightSand}`, color: QC.softBrown, background: "transparent",
                      fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 400, letterSpacing: 0.5,
                      transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
                    }}
                  >
                    もうすこし遠くまで
                  </button>
                </div>
              )}
                </>
              )}
              <p style={{ fontSize: 12, color: QC.sage, fontWeight: 300, lineHeight: 1.8, marginTop: 40, textAlign: "center" }}>
                座標が未整備の場所は、エリアからさがせます。
              </p>
            </>
          )}
        </div>
        <FloatingBackButton aboveTabBar={true} />
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
          {/* 2026/7/19 #3: 未ログインの人へ、静かな保存の誘い (ログイン済みには「保存した場所」があるので出さない) */}
          {!user && (
            <p style={{ fontSize: isPC ? 14 : 13, color: QC.sage, fontWeight: 300, lineHeight: 1.9, margin: "22px auto 0", letterSpacing: 0.3 }}>
              気になる場所は、保存できます。うちの子との、次のおでかけに。
              <button
                onClick={goLogin}
                style={{ background: "none", border: "none", padding: 0, marginLeft: 8, cursor: "pointer", fontFamily: QC_FONT_JP, fontSize: isPC ? 14 : 13, fontWeight: 400, color: QC.softBrown, borderBottom: `1px solid ${QC.softBrown}` }}
              >
                はじめる
              </button>
            </p>
          )}
        </div>

        {/* 2026/7/16 特集 Phase1: 特集棚 (雑誌の表紙)。published の特集がある時だけ。1本目を大きく */}
        {magazines.length > 0 && (
          <section style={{ marginBottom: isPC ? 72 : 52, animation: `qocca-fadeInSlowUp 1s ${ease} both` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 0 22px", paddingBottom: 12, borderBottom: `1px solid ${QC.lightSand}` }}>
              <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 22 : 19, margin: 0, color: QC.softBrown }}>特集</h2>
              <span style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 2, color: QC.sage }}>Feature</span>
            </div>
            <button
              onClick={() => openMagazine(magazines[0])}
              className="pw-tile"
              style={{
                width: "100%", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
                borderRadius: 18, overflow: "hidden", display: "block", fontFamily: QC_FONT_JP,
              }}
            >
              <div
                style={{
                  position: "relative", width: "100%", minHeight: isPC ? 340 : 240,
                  display: "flex", flexDirection: "column", justifyContent: "flex-end",
                  background: `linear-gradient(180deg, rgba(44,41,38,0.10) 0%, rgba(44,41,38,0.72) 100%), url("${magazines[0].hero_image_url || ""}") center / cover no-repeat, ${QC.softBrown}`,
                  padding: isPC ? "48px 40px" : "32px 22px",
                  boxSizing: "border-box",
                }}
              >
                <span style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 3, color: "rgba(255,255,255,0.88)", marginBottom: 12, textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
                  FEATURE
                </span>
                <span style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 30 : 21, lineHeight: 1.7, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
                  {magazines[0].title}
                </span>
                {magazines[0].meta_description && (
                  <span style={{ fontSize: isPC ? 13.5 : 12.5, color: "rgba(255,255,255,0.9)", fontWeight: 300, lineHeight: 1.9, marginTop: 12, maxWidth: 560, textShadow: "0 1px 8px rgba(0,0,0,0.55)" }}>
                    {magazines[0].meta_description}
                  </span>
                )}
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 16, letterSpacing: 0.5 }}>
                  特集を読む →
                </span>
              </div>
            </button>
            {/* 2026/7/16 特集2本目以降: 小さめカードの横並び (設計書の非対称レイアウト) */}
            {magazines.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap: isPC ? 18 : 12, marginTop: isPC ? 18 : 12 }}>
                {magazines.slice(1).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => openMagazine(m)}
                    className="pw-tile"
                    style={{ border: "none", padding: 0, cursor: "pointer", textAlign: "left", borderRadius: 16, overflow: "hidden", display: "block", fontFamily: QC_FONT_JP }}
                  >
                    <div
                      style={{
                        position: "relative", width: "100%", minHeight: isPC ? 170 : 140,
                        display: "flex", flexDirection: "column", justifyContent: "flex-end",
                        background: `linear-gradient(180deg, rgba(44,41,38,0.12) 0%, rgba(44,41,38,0.70) 100%), url("${m.hero_image_url || ""}") center / cover no-repeat, ${QC.softBrown}`,
                        padding: isPC ? "22px 24px" : "18px 18px",
                        boxSizing: "border-box",
                      }}
                    >
                      <span style={{ fontFamily: QC_FONT_EN, fontSize: 10.5, letterSpacing: 2.5, color: "rgba(255,255,255,0.85)", marginBottom: 8, textShadow: "0 1px 5px rgba(0,0,0,0.4)" }}>
                        FEATURE
                      </span>
                      <span style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 18 : 16, lineHeight: 1.7, color: "#fff", textShadow: "0 1px 10px rgba(0,0,0,0.5)" }}>
                        {m.title}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 2026/7/13 お気に入り Phase3: 保存した場所を優先表示 (一覧トップ・保存が1件以上ある時だけ) */}
        {(() => {
          const savedSpots = spots.filter((s) => likedSpots?.[s.id]);
          if (savedSpots.length === 0) return null;
          return (
            <section style={{ marginBottom: isPC ? 56 : 44, animation: `qocca-fadeInSlowUp 1s ${ease} both` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 0 22px", paddingBottom: 12, borderBottom: `1px solid ${QC.lightSand}` }}>
                <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 22 : 19, margin: 0, color: QC.softBrown }}>保存した場所</h2>
                <span style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 2, color: QC.sage }}>Saved</span>
                <span style={{ fontSize: 12, color: QC.sage, marginLeft: "auto" }}>{savedSpots.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap: 18 }}>
                {savedSpots.slice(0, 6).map((s) => (
                  <button key={s.id} onClick={() => openSpot(s)} style={spotCardStyle} className="pw-card">
                    {firstImage(s) && (
                      <div style={{ width: "100%", aspectRatio: "16 / 9", overflow: "hidden", background: QC.cream }}>
                        <img src={firstImage(s) as string} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </div>
                    )}
                    <div style={{ padding: "18px 20px" }}>
                      <div style={{ fontFamily: QC_FONT_JP, fontWeight: 500, fontSize: 16, color: QC.charcoal, marginBottom: 8, lineHeight: 1.6 }}>{s.name}</div>
                      <div style={{ fontSize: 12.5, color: QC.sage }}>{[s.pref, s.city].filter(Boolean).join(" ")}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })()}

        {/* いまいる場所から (GPS Phase2・位置情報は明示タップ時のみ取得) */}
        {"geolocation" in navigator && (
          <section style={{ marginBottom: isPC ? 48 : 36, animation: `qocca-fadeInSlowUp 1s ${ease} both` }}>
            <button
              onClick={openNearby}
              className="pw-card"
              style={{
                width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
                padding: isPC ? "26px 30px" : "20px 22px",
                background: "#fff", border: `1px solid ${QC.lightSand}`, borderRadius: 16,
                cursor: "pointer", fontFamily: QC_FONT_JP, textAlign: "left",
              }}
            >
              <span style={{ fontFamily: QC_FONT_EN, fontSize: 11.5, letterSpacing: 2.5, color: QC.sage }}>NEARBY</span>
              <span style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 22 : 18, color: QC.charcoal }}>
                近くのおでかけ先
              </span>
              <span style={{ fontSize: 12.5, color: QC.warmGray, fontWeight: 300 }}>
                位置情報は、この端末の中だけで使います。
              </span>
            </button>
          </section>
        )}

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
// (backLinkStyle は 2026/7/16 型負債返済で削除: 未使用・fixedBackLinkStyle に置換済みだった)

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
