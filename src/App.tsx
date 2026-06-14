import React, { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from "react-router-dom";
// Leaflet (L/CSS/markercluster) は施設マップ専用のため pages/facilities.tsx へ移設 (Phase5 ④facilities)
import AboutPage from "./pages/AboutPage";
import AboutSection from "./components/AboutSection";
// 依頼書 #108 (2026/6/4): ARK 透明性機能 Phase C - Admin 寄付管理画面
import AdminArkDonations from "./pages/AdminArkDonations";
// 依頼書 #109 (2026/6/4): 法人スポンサー (¥300,000) Phase B - Admin 管理画面
import AdminCorporateSponsors from "./pages/AdminCorporateSponsors";
// 依頼書 #110 (2026/6/4): 商店街 v2.0 リッチ TOP ページ
import MarketplacePage from "./pages/MarketplacePage";
// 依頼書 #111 (2026/6/4): 基礎データ分析ダッシュボード (AI 戦略 Phase 1)
import AdminAnalytics from "./pages/AdminAnalytics";
// 依頼書 #113 (2026/6/4): 全国小規模動物イベント自動収集 v2 - source 管理 UI
import AdminEventSources from "./pages/AdminEventSources";
import HomeNewsSection from "./components/HomeNewsSection";
import QoccaUniverseSection from "./components/QoccaUniverseSection";
import CommunityShowcase from "./components/CommunityShowcase";
import FacilityMapPromo from "./components/FacilityMapPromo";
import { CrowdfundingBanner } from "./components/CrowdfundingBanner";
import { ListingEditModal } from "./components/ListingEditModal";
import { BlogPage, GalleryPage } from "./pages/gallery";
import { EventsPage, CommunitiesPage, CommunityDetailPage } from "./pages/community";
import { SearchPage, UserProfilePage, SellPage, DetailPageWrapper } from "./pages/marketplace";
import { FacilitiesPage } from "./pages/facilities";
import ProfileEditModal from "./components/ProfileEditModal";
import PetEditModal from "./components/PetEditModal";
import AdminDashboard from "./Admin";
import HelpPage from "./HelpPage";
import { ReviewModal } from "./components/ReviewModal";
import AddToHomeScreenBanner from "./components/AddToHomeScreenBanner";
import type { FoundingCreator } from "./types";
import { TokushoPage, TermsPage, PrivacyPage, ContactPage, QoccaTownGuide, FirstStepGuide, FoundingCreatorsPage, SponsorsPage, LegalPage, FAQPage } from "./pages/static";
import { C, CAT_COLORS, QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY, QC_KEYFRAMES, QC_HERO_DURATIONS, QC_TIMING, QC_HERO_TRANSITION_MS, QC_PC_BREAKPOINT } from "./constants/theme";
import { CATS, LISTINGS, EVENTS, ORDER_STEPS, DISPUTE_REASONS, QC_REACTIONS, CONTACT_PATTERNS, NG_WORDS, CROWDFUNDING_ACTIVE, CAMPFIRE_PROJECT_URL_WITH_UTM } from "./constants/data";
import { stepIndex, formatStat, miniBtnStyle } from "./utils/format";
import { detectContacts } from "./utils/moderation";
import { petLabelShort, petIcon } from "./constants/pets";
// ── Supabase Client ───────────────────────────────────────────────────────
// 依頼書 #119 Phase C (2026/6/5): 全ページ共有の唯一 client に統一 (RLS 認証問題解消)
import { supabase } from "./supabaseClient";
// 依頼書 #121 (2026/6/5): Meta Pixel + コンバージョン計測 (7/1 Meta 広告稼働準備)
// ID 未設定で完全 no-op、localhost で発火しない fail-safe 設計
import { initMetaPixel, trackPageView as mpTrackPageView, trackEvent as mpTrackEvent, trackPurchaseOnce as mpTrackPurchase } from "./lib/metaPixel";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useListings, useFavorites, useIsPC, useNav } from "./hooks";
import { resolveFontFamily } from "./constants/fonts";
import { Logo, Card, Sidebar, PCNavbar, Navbar, OrderStatusBar, SharedFooter, TabBar, PCBanner } from "./components/ui";
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";

// AuthContext / AuthProvider / useAuth は contexts/AuthContext.tsx へ移動 (Phase 2)
// ⚠️ createContext は複製せず移動のみ (唯一の Auth Context)

// ── Supabase Data Hooks ──────────────────────────────────────────────────

// useListings / useFavorites は hooks/index.ts へ移動 (Phase 3)
// (calcPopularityScore / sortByPopularity は utils/format.ts へ移動済 Phase 1 ③)

// 出品をSupabaseに保存
// Phase B: variants 対応版
// - isDraft 引数バグ修正 (旧: 関数定義に含まれず、L4051 で渡してたが受け取ってなかった)
// - variants 引数追加 (Phase A の listing_variants テーブルに別途 INSERT)
// - listings.has_variants フラグを variants の有無で自動設定
// - variants INSERT 失敗時は listing も削除して整合性保持
// submitListing は pages/marketplace.tsx へ移動 (Phase6 6b)

// ── Colors & Constants ────────────────────────────────────────────────────
// ── フォント装飾 (依頼書 #133 Phase A2, 2026/6/6) ──────────────────
// 無料 5本: system / serif / mincho / round / handwriting
// items テーブル font カテゴリ + profiles.font_* 5カラム と連動
// 適用先: display_name / bio / pet_name / one_word / blog_title
// FONT_FAMILIES / FONT_OPTIONS / resolveFontFamily は constants/fonts.ts へ移動 (Phase 4-a)

// ── 暮らしの空気 (v3.2 第23章: "設定" でなく "模様替え") ──────────────────
// MyPage 内だけ色が変わる。5 プリセット。保存ボタンなし、即タップ反映。
// "世界観を見せるカスタム" でなく "住む感覚を増やすカスタム"。
type AtmospherePreset = {
  id: "asa" | "yuugata" | "yoru" | "kokage" | "atatakai";
  icon: string;
  label: string;
  bg: string;
  accent: string;
  cardBorder: string;
};

const ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  { id: "asa",      icon: "☀️", label: "朝",        bg: "#FAFAF7", accent: "#FFB47A", cardBorder: "#E8C99A" },
  { id: "yuugata",  icon: "🌆", label: "夕方",      bg: "#FCF5ED", accent: "#F5A94A", cardBorder: "#D87B5A" },
  { id: "yoru",     icon: "🌙", label: "夜",        bg: "#ECEFF2", accent: "#4A6FA5", cardBorder: "#8DAEC9" },
  { id: "kokage",   icon: "🌿", label: "木陰",      bg: "#F2F5EC", accent: "#7A9968", cardBorder: "#A8C09A" },
  { id: "atatakai", icon: "🕯", label: "あたたかい", bg: "#FAF3E8", accent: "#C9925E", cardBorder: "#E0B788" },
];
const DEFAULT_ATMOSPHERE = ATMOSPHERE_PRESETS[4]; // atatakai
const findAtmosphere = (id?: string | null): AtmospherePreset =>
  ATMOSPHERE_PRESETS.find(a => a.id === id) || DEFAULT_ATMOSPHERE;

// CATS / LISTINGS / REVIEWS / EVENTS / PREFS_47_ORDER は constants/data.ts へ移動 (Phase 1 ②/c)
// 動物カテゴリ定数・表示ヘルパー (PET_CATEGORIES/PET_CAT_BY_ID/petLabel/petLabelShort/petIcon/petColor/petBg/evPetLabel/evPetColor/evPetBg) は constants/pets.ts へ移動 (Phase 1 a)

// ORDER_STEPS は constants/data.ts へ移動 (Phase 1 ②)
// stepIndex は utils/format.ts へ移動 (Phase 1 ③)

// DISPUTE_REASONS は constants/data.ts へ移動 (Phase 1 ②)

// Logo は components/ui.tsx へ移動 (Phase 4-b)

// ── レスポンシブ判定 ──────────────────────────────────────────────────────
// useIsPC は hooks/index.ts へ移動 (Phase 3)

// ── PC用サイドバー (v3.1 準拠 3層構造) ───────────────────────────────────
// 「街を歩く」「作品を置く」「暮らしの設定」の3階層で "圧を抜く" 設計。
// - カテゴリ7つは SearchPage 内チップに統合 (Sidebar からは削除)
// - "🐾 出品する" 巨大 CTA を「作品を置く」内のテキストリンクに格下げ
// - hover で C.orange に静かに transition (気配レベル)
// - 階層見出しは控えめ (warmGray, weight 400, opacity 0.85)
// 既存呼び出し側との互換性のため activeCat / setActiveCat props は受け取るが未使用
// Sidebar は components/ui.tsx へ移動 (Phase 4-b)

// ── User Menu (ログイン後のアイコンメニュー) ──────────────────────────────
// UserMenu は components/ui.tsx へ移動 (Phase 4-b)

// ── PC用ナビバー ───────────────────────────────────────────────────────────
// PCNavbar は components/ui.tsx へ移動 (Phase 4-b)

// Stars / Tag / Card は components/ui.tsx へ移動 (Phase 4-b)

// ── Mobile Navbar (v3.1 準拠 3層構造、PC Sidebar と統一) ──────────────────
// 「街を歩く」「作品を置く」「暮らしの設定」の3階層、PC Sidebar と完全に同じ認知モデル。
// - ホーム / さがす はハンバーガーから削除 (ロゴクリックで Home、検索バーは中央常時表示)
// - "出品する" アイコン: 🐾 (Gallery と重複) → ✎ (識別性向上、PC と統一)
// - 階層見出し: fontSize 11, weight 400, warmGray, letterSpacing
// - 区切り線: opacity 0.5
// - 各リンク: weight 400 (装飾控えめ), タップ可能性 padding 14/20px 維持
// スマホ第一: タップ可能性・読みやすさは現状維持以上
// Navbar は components/ui.tsx へ移動 (Phase 4-b)

// ── ヒーローセクション統計データ取得 ──────────────────────────────────────
// リアル値を取得し、100超えたら「+」表記
// formatStat は utils/format.ts へ移動 (Phase 1 ③)

// useHeroStats は hooks/index.ts へ移動 (Phase 3)

// ── HOME (Mobile) ─────────────────────────────────────────────────────────

// 静的ページ群 (Tokusho/Terms/Privacy/Contact/QoccaTownGuide/FirstStepGuide) は pages/static.tsx へ移動 (Phase5 ①static)

// ============================================================================
// Qocca リニューアル用デザイントークン
// QC_TIMING / QC_HERO_TRANSITION_MS / QC_PC_BREAKPOINT は constants/theme.ts へ移動 (Phase 1 b)

// ============================================================================
// SECTION 1: ファーストビュー (SectionHero)
// ============================================================================

// Phase B: PC 専用シネマ画像 (16:9 フルワイド表示)
// モバイルは既存の supabase gallery_posts (display_priority 1〜7) を使用
// per-image caption は alt 属性として使用 (画面表示は静的 main+sub copy)
const HERO_IMAGES_CINEMA = [
  {
    url: 'https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/gallery-images/official/cinema/cinema-1-bed.png',
    caption: '誰もまだ起きていない、朝。',
  },
  {
    url: 'https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/gallery-images/official/cinema/cinema-2-window.png',
    caption: '窓の向こうを、ずっと見ていた。',
  },
  {
    url: 'https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/gallery-images/official/cinema/cinema-3-path.png',
    caption: 'いつもの散歩道、いつもの時間。',
  },
  {
    url: 'https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/gallery-images/official/cinema/cinema-4-living.png',
    caption: 'ソファに残った、温もり。',
  },
  {
    url: 'https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/gallery-images/official/cinema/cinema-5-kitchen.png',
    caption: '夕飯の支度の音を、聞いていた。',
  },
  {
    url: 'https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/gallery-images/official/cinema/cinema-6-entrance.png',
    caption: 'おかえりを、ずっと待っていた。',
  },
  {
    url: 'https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/gallery-images/official/cinema/cinema-7-town.png',
    caption: 'この街と、この子と。',
  },
];

// ----------------------------------------------------------------------------
// useScrollProgress hook - スクロール量を 0-1 で取得
// ----------------------------------------------------------------------------
const useScrollProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf: number | null = null;

    const handleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        const p = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
        setProgress(p);
        raf = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return progress;
};

// ----------------------------------------------------------------------------
// 背景色補間関数 - progress (0-1) に応じて朝→昼→夕→夜の背景色を返す
// ----------------------------------------------------------------------------
const qoccaInterpolateBackground = (p: number): string => {
  const stops = [
    { at: 0.0,  color: [250, 247, 242] }, // warmWhite 朝
    { at: 0.4,  color: [245, 239, 230] }, // cream 昼
    { at: 0.75, color: [238, 230, 217] }, // lightSand 夕
    { at: 1.0,  color: [232, 221, 207] }, // 夜
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].at && p <= stops[i + 1].at) {
      const t = (p - stops[i].at) / (stops[i + 1].at - stops[i].at);
      const [r1, g1, b1] = stops[i].color;
      const [r2, g2, b2] = stops[i + 1].color;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return `rgb(${stops[stops.length - 1].color.join(',')})`;
};

// ----------------------------------------------------------------------------
// useInViewStaggered hook - IntersectionObserver で要素が見えたら index に応じて遅延発火
// ----------------------------------------------------------------------------
const useInViewStaggered = (index = 0, delay = 200) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setInView(true), index * delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [index, delay]);

  return { ref, inView };
};

// ----------------------------------------------------------------------------
// QoccaNoiseOverlay - 全画面に薄くノイズ (film grain) を重ねる
// ----------------------------------------------------------------------------
const QoccaNoiseOverlay = () => (
  <div
    aria-hidden
    style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 9999,
      opacity: 0.04,
      mixBlendMode: 'multiply',
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }}
  />
);

const SectionHero = () => {
  const [images, setImages] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPC, setIsPC] = useState(
    typeof window !== "undefined" && window.innerWidth >= QC_PC_BREAKPOINT
  );

  // レスポンシブ判定
  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= QC_PC_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // モバイル用データ取得 (gallery_posts の display_priority 1〜7)
  // PC は HERO_IMAGES_CINEMA を使用するため、この fetch はモバイル専用
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("gallery_posts")
          .select("id, image_url, caption, pet_name")
          .eq("is_official", true)
          .lt("display_priority", 100)
          .order("display_priority", { ascending: true });
        if (error) throw error;
        if (mounted) setImages(data || []);
      } catch (e) {
        console.error("Hero fetch error:", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // PC はシネマ画像 (常に 7 枚利用可能)、モバイルは fetch した画像
  const displayImages = isPC
    ? HERO_IMAGES_CINEMA.map((c, i) => ({
        id: `cinema-${i}`,
        image_url: c.url,
        caption: c.caption,
      }))
    : images;

  // プリロード
  useEffect(() => {
    displayImages.forEach((img) => {
      const preloader = new Image();
      preloader.src = img.image_url;
    });
  }, [displayImages]);

  // ローテーション
  useEffect(() => {
    if (displayImages.length === 0) return;
    const duration = (QC_HERO_DURATIONS[currentIndex] || 10) * 1000;
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % displayImages.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, displayImages.length]);

  // ローディング中 (背景のみ) — PC は cinema で常に画像あり、mobile は fetch 待ち
  if (displayImages.length === 0) {
    return (
      <section style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: 600,
        background: QC.charcoal,
      }}>
        <style>{QC_KEYFRAMES}</style>
      </section>
    );
  }

  return (
    <section style={{
      position: "relative",
      width: "100%",
      height: "100vh",
      minHeight: 600,
      overflow: "hidden",
      background: QC.charcoal,
    }}>
      <style>{QC_KEYFRAMES}</style>

      {/* 画像レイヤー */}
      {displayImages.map((img, i) => {
        const isActive = i === currentIndex;
        const isFirst = i === 0;
        const kenBurnsIndex = (i % 3) + 1;
        const kenBurnsDuration = QC_HERO_DURATIONS[i] + 2;

        if (isPC) {
          // PC: シネマ画像をフルワイドで1枚表示 (両サイドぼかし削除、Ken Burns なし)
          return (
            <img
              key={img.id}
              src={img.image_url}
              alt={img.caption}
              loading={isFirst ? "eager" : "lazy"}
              decoding="async"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                opacity: isActive ? 1 : 0,
                transition: `opacity ${QC_HERO_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                pointerEvents: "none",
              }}
            />
          );
        }

        // モバイル: 縦長フルスクリーン + Ken Burns (既存維持)
        return (
          <img
            key={img.id}
            src={img.image_url}
            alt={img.caption}
            loading={isFirst ? "eager" : "lazy"}
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center center",
              opacity: isActive ? 1 : 0,
              transition: `opacity ${QC_HERO_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
              animation: isActive
                ? `qocca-ken-burns-${kenBurnsIndex} ${kenBurnsDuration}s linear infinite alternate`
                : "none",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* 中央下キャッチコピー (PC: メイン+サブコピー / Mobile: 既存維持) */}
      <div style={{
        position: "absolute",
        bottom: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center",
        width: "85%",
        maxWidth: 720,
        padding: 0,
        background: "transparent",
        zIndex: 10,
        opacity: 0,
        animation: "qocca-fadeInSlow 2.4s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards",
      }}>
        {isPC ? (
          <>
            {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): メインキャッチ Shippori Mincho 700 */}
            <p style={{
              fontSize: "clamp(28px, 4.4vw, 56px)",
              fontFamily: QC_FONT_DISPLAY,
              fontWeight: 700,
              color: QC.warmWhite,
              letterSpacing: "0.06em",
              lineHeight: 1.55,
              opacity: 0.97,
              margin: 0,
              textShadow: "0 2px 24px rgba(44, 41, 38, 0.55), 0 1px 4px rgba(44, 41, 38, 0.35)",
            }}>
              想いを形にして、
              <br />
              ふたりをつなぐ。
            </p>
            {/* サブ: 控えめに Noto Sans JP Light を維持 (本文・モバイル可読性優先) */}
            <p style={{
              fontSize: "clamp(13px, 1.2vw, 16px)",
              fontFamily: QC_FONT_JP,
              fontWeight: 300,
              color: QC.warmWhite,
              letterSpacing: "0.14em",
              lineHeight: 1.9,
              opacity: 0.78,
              margin: "28px 0 0 0",
              textShadow: "0 2px 16px rgba(44, 41, 38, 0.5)",
            }}>
              うちの子との時間を、ちゃんと残せる場所。
            </p>
          </>
        ) : (
          <>
            {/* 依頼書 #134 Phase 2 案A改: モバイル メインキャッチ Shippori Mincho 700 */}
            <p style={{
              fontSize: "clamp(22px, 6.5vw, 32px)",
              fontFamily: QC_FONT_DISPLAY,
              fontWeight: 700,
              color: QC.warmWhite,
              letterSpacing: "0.05em",
              lineHeight: 1.65,
              opacity: 0.96,
              margin: 0,
              textShadow: "0 2px 24px rgba(44, 41, 38, 0.55), 0 1px 4px rgba(44, 41, 38, 0.35)",
            }}>
              想いを形にして、
              <br />
              ふたりをつなぐ。
            </p>
            <p style={{
              fontSize: "clamp(11px, 3vw, 13px)",
              fontFamily: QC_FONT_JP,
              fontWeight: 300,
              color: QC.warmWhite,
              letterSpacing: "0.14em",
              lineHeight: 1.9,
              opacity: 0.78,
              margin: "18px 0 0 0",
              textShadow: "0 2px 16px rgba(44, 41, 38, 0.5)",
            }}>
              うちの子と暮らす街。
            </p>
          </>
        )}
      </div>

      {/* 右上ロゴ + ブランドスローガン (フェードイン 0.5s遅延 + 2s)
          依頼書 #33 / マーケ・ブランド戦略書 v1.0 §1:
            英語メイン (ロゴ下): Live with pets.
            日本語サブ: 動物を飼ったら、当たり前に入れる街。
      */}
      {/* 依頼書 #42 (5/31): iOS Safari status bar / notch 対策
          top: max(env(safe-area-inset-top, 0px), 56px) で iPhone notch + Android status bar 両対応
          index.html viewport meta に viewport-fit=cover 追加で env() 有効化済み */}
      <div style={{
        position: "absolute",
        top: "max(env(safe-area-inset-top, 0px), 56px)",
        right: "max(env(safe-area-inset-right, 0px), 32px)",
        textAlign: "right",
        opacity: 0,
        zIndex: 20,
        animation: "qocca-fadeInSlow 2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards",
      }}>
        {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): ロゴ Shippori Mincho 700 (italic解除・Editorial らしい品位) */}
        <div style={{
          fontFamily: QC_FONT_DISPLAY,
          fontSize: 22,
          color: QC.warmWhite,
          letterSpacing: "0.04em",
          fontWeight: 700,
          textShadow: "0 1px 6px rgba(44, 41, 38, 0.4)",
          lineHeight: 1,
        }}>
          Qocca
        </div>
        <div style={{
          fontFamily: QC_FONT_EN,
          fontSize: 13,
          color: QC.warmWhite,
          letterSpacing: "0.12em",
          fontWeight: 300,
          opacity: 0.82,
          marginTop: 4,
          textShadow: "0 1px 6px rgba(44, 41, 38, 0.4)",
          lineHeight: 1,
        }}>
          Live with pets.
        </div>
        <div style={{
          fontFamily: QC_FONT_JP,
          fontSize: 10,
          color: QC.warmWhite,
          letterSpacing: "0.08em",
          fontWeight: 300,
          opacity: 0.6,
          marginTop: 6,
          textShadow: "0 1px 4px rgba(44, 41, 38, 0.4)",
          lineHeight: 1.3,
        }}>
          動物を飼ったら、<br/>当たり前に入れる街。
        </div>
      </div>

      {/* 下中央スクロール誘導 (呼吸4秒) */}
      <div style={{
        position: "absolute",
        bottom: 40,
        left: "50%",
        width: 1,
        height: 48,
        background: QC.warmWhite,
        zIndex: 10,
        opacity: 0,
        animation: "qocca-breathe-slow 4s ease-in-out 2s infinite",
      }} />
    </section>
  );
};

// ============================================================================
// SECTION 2: 今日のうちの子たち (SectionTodaysMoments)
// ============================================================================

// QC_REACTIONS は constants/data.ts へ移動 (Phase 1 ②)

// ============================================================================
// ============================================================================
// SectionAnnouncement: "街の片隅に貼ってある紙" — 7月開店 + 6月クラファン告知
// ============================================================================
// 表示期間: 〜2026/6/30 23:59 JST (7/1 00:00 JST 以降は自動 null return)
// v3.1 第6章 NG語彙回避 (グランド/キャンペーン/限定 不使用)
// v3.1 第2章七 "完成させすぎない" → "少しずつ始まります"
// v3.1 第13章 "風通しを良くして待つ" → 派手装飾ゼロ
// v3.1 第17章 "置いていく" → 街の掲示板そのもの
// クリック領域・CTA・煽り装飾・絵文字・カウントダウン・アニメーション 一切なし

const SectionAnnouncement = () => {
  const navigate = useNavigate();
  const SHOW_UNTIL = new Date('2026-07-01T00:00:00+09:00');
  const [show] = useState(() => new Date() < SHOW_UNTIL);
  const [linkHover, setLinkHover] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!show) return null;

  const Divider = () => (
    <div style={{
      width: 64,
      height: 1,
      background: C.warmGray,
      opacity: 0.35,
      margin: '32px auto',
    }} />
  );

  // 依頼書 #134 追補 (2026/6/8): モバイル 80px → 50px / PC 120px → clamp 化
  return (
    <section style={{
      padding: 'clamp(50px, 10vw, 120px) 16px',
      background: 'transparent',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        maxWidth: 520,
        width: '100%',
        padding: isMobile ? '0 8px' : '0 16px',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}>
        {/* 上の区切り線 ("貼り紙" の境界) */}
        <Divider />

        {/* ブロック1: 7月開店 / 依頼書 #134 Phase 2 案A改: Shippori Mincho 700 で創刊号風 */}
        <div style={{
          fontSize: isMobile ? 22 : 26,
          fontFamily: QC_FONT_DISPLAY,
          fontWeight: 700,
          color: C.dark,
          lineHeight: 1.65,
          letterSpacing: '0.04em',
        }}>
          7月から、少しずつ始まります。
        </div>
        {/* 日付: Shippori Mincho 500 + 大きめ字間で「号外」風 */}
        <div style={{
          fontSize: isMobile ? 13 : 14,
          fontFamily: QC_FONT_DISPLAY,
          fontWeight: 500,
          color: C.warmGray,
          marginTop: 18,
          letterSpacing: '0.18em',
        }}>
          2026年7月1日
        </div>

        <Divider />

        {/* ブロック2: 販売手数料無料 + 出品無料 + 仕組みリンク */}
        <div style={{
          fontSize: isMobile ? 13 : 14,
          fontWeight: 400,
          color: C.dark,
          lineHeight: 1.8,
        }}>
          7月の1ヶ月間、<br />
          販売手数料を無料にしています。
        </div>
        <div style={{
          fontSize: isMobile ? 13 : 14,
          fontWeight: 400,
          color: C.dark,
          lineHeight: 1.8,
          marginTop: 22,
        }}>
          出品はいつでも、どなたでも、無料です。
        </div>
        <div style={{
          marginTop: 22,
          fontSize: isMobile ? 12 : 13,
          lineHeight: 1.8,
        }}>
          <a
            href="/help/fees"
            onClick={(e) => { e.preventDefault(); navigate('/help/fees'); }}
            onMouseEnter={() => setLinkHover(true)}
            onMouseLeave={() => setLinkHover(false)}
            style={{
              color: linkHover ? C.orange : C.warmGray,
              textDecoration: 'none',
              fontWeight: 400,
              letterSpacing: '0.02em',
              transition: 'color 0.4s ease',
              cursor: 'pointer',
              display: 'inline-block',
            }}
          >
            <span style={{ marginRight: 6, fontSize: '0.9em' }}>▷</span>手数料の仕組み
          </a>
        </div>

        <Divider />

        {/* ブロック3: クラファン主導線 / 依頼書 #137 (2026/6/8): "公開中" 確定後 CTA 強化 */}
        <div style={{
          fontSize: isMobile ? 18 : 22,
          fontFamily: QC_FONT_DISPLAY,
          fontWeight: 700,
          color: C.dark,
          lineHeight: 1.7,
          letterSpacing: '0.04em',
        }}>
          {CROWDFUNDING_ACTIVE ? (
            <>クラウドファンディング、<br />公開中。</>
          ) : (
            <>6月、<br />クラウドファンディングを始めます。</>
          )}
        </div>
        {CROWDFUNDING_ACTIVE && (
          <div style={{
            fontSize: isMobile ? 13 : 14,
            fontWeight: 400,
            color: C.warmGray,
            lineHeight: 1.85,
            marginTop: 16,
          }}>
            7月1日のグランドオープンに向けて、<br />
            創業期の住民を募集しています。
          </div>
        )}
        <div style={{
          fontSize: isMobile ? 13 : 14,
          fontWeight: 400,
          color: C.warmGray,
          lineHeight: 1.8,
          marginTop: 22,
        }}>
          Qoccaを、<br />
          これからも静かに育てていくために。
        </div>
        <div style={{
          fontSize: isMobile ? 13 : 14,
          fontWeight: 400,
          color: C.warmGray,
          lineHeight: 1.8,
          marginTop: 22,
        }}>
          もしこの街を好きだと思ってくれたら、<br />
          一緒に見守ってもらえたら嬉しいです。
        </div>

        {/* 依頼書 #137 (2026/6/8): Hero 直下の主導線 CTA - 朱色 / Editorial Documentary */}
        {CROWDFUNDING_ACTIVE && (
          <a
            href={CAMPFIRE_PROJECT_URL_WITH_UTM}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 28,
              padding: '13px 28px',
              background: '#F5A94A',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: 999,
              fontSize: isMobile ? 13 : 14,
              fontWeight: 700,
              letterSpacing: '0.06em',
              boxShadow: '0 2px 10px rgba(245,169,74,0.25)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 14px rgba(245,169,74,0.35)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 10px rgba(245,169,74,0.25)'; }}
          >
            CAMPFIRE で支援する →
          </a>
        )}

        {/* 下の区切り線 ("貼り紙" の境界) */}
        <Divider />
      </div>
    </section>
  );
};

// ============================================================================
// SectionWhatIsQocca: 機能理解導線 (Hero と TodaysMoments の間)
// "感情で引き込み、機能で理解させる" - 05-branding-ux.md 準拠
// ============================================================================

const SectionWhatIsQocca = ({ setPage }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const items = [
    {
      title: 'うちの子との記憶を、形に残す',
      quote: '"あの瞬間を、長く残る形に"',
      desc: '似顔絵、羊毛作品、記念グッズ。\n街の作家たちが、心を込めて。',
      linkText: '商店街を覗いてみる',
      onClick: () => setPage("marketplace"),
    },
    {
      title: 'うちの子の話で、笑い合う',
      quote: '"犬種ごとの、専門コミュニティ"',
      desc: '毎日の発見を、分かり合える人と。\nうちの子と同じ仲間の集まり。',
      linkText: '広場でつながる',
      onClick: () => setPage("communities"),
    },
    {
      title: '街を歩いてみる',
      quote: '"クリエイター、イベント、施設"',
      desc: 'ペットと過ごす日常を、もっと豊かに。\nお出かけ先、出会い、発見。',
      linkText: '案内所へ',
      onClick: () => setPage("facilities"),
    },
  ];

  return (
    <section style={{
      padding: 'clamp(80px, 14vw, 160px) 0',
      background: 'transparent',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 32px' }}>

        {/* セクションヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <p style={{
            fontFamily: QC_FONT_EN,
            fontSize: 13,
            fontStyle: 'italic',
            color: QC.warmGray,
            letterSpacing: 0.8,
            margin: '0 0 12px 0',
            opacity: 0.75,
            fontWeight: 300,
          }}>
            What you can do here
          </p>
          {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h2 Shippori Mincho 700 で「号」見出し品位 */}
          <h2 style={{
            fontFamily: QC_FONT_DISPLAY,
            fontSize: 'clamp(26px, 4.4vw, 36px)',
            fontWeight: 700,
            color: QC.softBrown,
            letterSpacing: '0.06em',
            lineHeight: 1.55,
            margin: 0,
          }}>
            Qocca、できること
          </h2>
          <div style={{
            marginTop: 40,
            width: 32,
            height: 1,
            background: QC.lightSand,
            margin: '40px auto 0',
          }} />
        </div>

        {/* 3カード */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 24 : 32,
        }}>
          {items.map((item, i) => {
            const isHover = hoverIndex === i;
            return (
              <div
                key={i}
                onClick={item.onClick}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{
                  background: QC.warmWhite,
                  borderRadius: 4,
                  padding: isMobile ? '64px 32px' : '80px 48px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 1.0s ease, border-color 0.8s ease',
                  border: `1px solid ${isHover ? QC.softBrown : QC.lightSand}`,
                  transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                }}
              >
                {/* タイトル (詩的・大きく) / 依頼書 #134 Phase 2 案A改: Shippori Mincho 700 で「号」見出し化 */}
                <h3 style={{
                  fontFamily: QC_FONT_DISPLAY,
                  fontSize: 20,
                  fontWeight: 700,
                  color: QC.softBrown,
                  margin: '0 0 18px 0',
                  letterSpacing: '0.04em',
                  lineHeight: 1.55,
                }}>
                  {item.title}
                </h3>

                {/* 引用 (詩的・控えめ) */}
                <p style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: 12,
                  fontStyle: 'italic',
                  fontWeight: 300,
                  color: QC.warmGray,
                  margin: '0 0 24px 0',
                  letterSpacing: 0.5,
                  lineHeight: 1.7,
                  opacity: 0.85,
                }}>
                  {item.quote}
                </p>

                {/* 機能説明 (具体的) */}
                <p style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: 12,
                  fontWeight: 300,
                  color: QC.warmGray,
                  margin: '0 0 32px 0',
                  lineHeight: 1.9,
                  letterSpacing: 0.3,
                  whiteSpace: 'pre-line',
                }}>
                  {item.desc}
                </p>

                {/* リンク (CTA代わり、控えめ) */}
                <div style={{
                  marginTop: 'auto',
                  textAlign: 'center',
                }}>
                  <span style={{
                    fontFamily: QC_FONT_JP,
                    fontSize: 12,
                    fontWeight: 300,
                    color: QC.softBrown,
                    letterSpacing: 1.2,
                    borderBottom: `1px solid ${isHover
                      ? QC.softBrown
                      : 'rgba(139, 111, 92, 0.3)'}`,
                    paddingBottom: 4,
                    transition: 'border-color 0.6s ease',
                  }}>
                    {item.linkText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 空気コピー (3カードの下) */}
        <div style={{ marginTop: 'clamp(40px, 8vw, 80px)' as any, textAlign: 'center' }}>
          <p style={{
            fontFamily: QC_FONT_JP,
            fontSize: 11,
            fontStyle: 'italic',
            fontWeight: 300,
            color: QC.warmGray,
            letterSpacing: 1.2,
            opacity: 0.7,
            margin: 0,
          }}>
            今日も、新しい思い出が置かれています。
          </p>
        </div>
      </div>
    </section>
  );
};

const SectionTodaysMoments = ({ setPage }) => {
  const { user } = useAuth();
  const [moments, setMoments] = useState<any[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, any>>({});
  const [myReactionsMap, setMyReactionsMap] = useState<Record<string, Set<string>>>({});
  const [selectedMoment, setSelectedMoment] = useState<any | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [columnCount, setColumnCount] = useState(2);

  // レスポンシブ
  useEffect(() => {
    const checkSize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setColumnCount(w >= 1024 ? 4 : w >= 768 ? 3 : 2);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  // データ取得
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: posts } = await supabase
          .from("gallery_posts")
          .select("id, image_url, caption, pet_name, pet_type, time_of_day, created_at, display_priority, user_id")
          .eq("is_official", true)
          .gte("display_priority", 100)
          .lt("display_priority", 200)
          .order("display_priority", { ascending: true });

        if (!mounted) return;

        const shuffled = [...(posts ?? [])].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 12);
        setMoments(selected);

        const postIds = selected.map(p => p.id);
        if (postIds.length === 0) {
          setIsLoading(false);
          return;
        }

        const { data: rxs } = await supabase
          .from("post_reactions_summary")
          .select("*")
          .in("post_id", postIds)
          .eq("post_type", "gallery");

        if (rxs && mounted) {
          const counts: Record<string, any> = {};
          rxs.forEach((r: any) => {
            counts[r.post_id] = {
              precious: r.precious_count ?? 0,
              healed: r.healed_count ?? 0,
              glad_met: r.glad_met_count ?? 0,
              want_see: r.want_see_count ?? 0,
            };
          });
          setReactionCounts(counts);
        }

        if (user?.id) {
          const { data: my } = await supabase
            .from("post_reactions")
            .select("post_id, reaction_type")
            .in("post_id", postIds)
            .eq("post_type", "gallery")
            .eq("user_id", user.id);

          if (my && mounted) {
            const map: Record<string, Set<string>> = {};
            my.forEach((r: any) => {
              if (!map[r.post_id]) map[r.post_id] = new Set();
              map[r.post_id].add(r.reaction_type);
            });
            setMyReactionsMap(map);
          }
        }
      } catch (e) {
        console.error("Moments fetch error:", e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // リアクション操作
  const handleReact = async (postId: string, reactionKey: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    setAnimatingKey(`${postId}-${reactionKey}`);
    setTimeout(() => setAnimatingKey(null), 400);

    const myRx = myReactionsMap[postId] || new Set();
    const isReacted = myRx.has(reactionKey);

    setReactionCounts(prev => {
      const cur = prev[postId] || { precious: 0, healed: 0, glad_met: 0, want_see: 0 };
      return {
        ...prev,
        [postId]: {
          ...cur,
          [reactionKey]: Math.max(0, cur[reactionKey] + (isReacted ? -1 : 1)),
        },
      };
    });

    setMyReactionsMap(prev => {
      const m = { ...prev };
      const s = new Set(m[postId] || []);
      if (isReacted) s.delete(reactionKey); else s.add(reactionKey);
      m[postId] = s;
      return m;
    });

    try {
      if (isReacted) {
        await supabase.from("post_reactions").delete()
          .eq("post_id", postId).eq("post_type", "gallery")
          .eq("user_id", user.id).eq("reaction_type", reactionKey);
      } else {
        await supabase.from("post_reactions").insert({
          post_id: postId, post_type: "gallery",
          user_id: user.id, reaction_type: reactionKey,
        });
      }
    } catch (e) {
      console.error("Reaction error:", e);
    }
  };

  return (
    <>
      <section style={{
        padding: "clamp(100px, 18vw, 200px) 0",
        background: "transparent",
        position: "relative",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>

          {/* セクションヘッダー */}
          <div style={{
            padding: "0 32px 80px",
            marginBottom: 32,
          }}>
            <p style={{
              fontFamily: QC_FONT_EN,
              fontSize: 13,
              fontStyle: "italic",
              color: QC.warmGray,
              letterSpacing: 0.8,
              marginBottom: 12,
              opacity: 0.75,
              margin: "0 0 12px 0",
              fontWeight: 300,
            }}>
              Today's Quiet Moments
            </p>
            {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h2 Shippori Mincho 700 */}
            <h2 style={{
              fontFamily: QC_FONT_DISPLAY,
              fontSize: 34,
              fontWeight: 700,
              color: QC.softBrown,
              letterSpacing: '0.06em',
              lineHeight: 1.55,
              margin: 0,
            }}>
              今日のうちの子たち
            </h2>
            <div style={{
              marginTop: 40,
              width: 32,
              height: 1,
              background: QC.lightSand,
              opacity: 0.6,
            }} />
          </div>

          {/* Masonry ギャラリー */}
          <div style={{
            columnCount: columnCount,
            columnGap: columnCount === 4 ? 24 : columnCount === 3 ? 22 : 20,
            padding: columnCount === 4 ? "0 64px" : columnCount === 3 ? "0 48px" : "0 24px",
            maxWidth: 1280,
            margin: "0 auto",
          }}>
            {isLoading ? (
              <p style={{
                color: QC.warmGray,
                textAlign: "center",
                padding: 40,
                fontFamily: QC_FONT_JP,
                fontWeight: 300,
              }}>
                Loading...
              </p>
            ) : moments.map((m, idx) => {
              const isHover = hoveredCardId === m.id;
              const counts = reactionCounts[m.id] || { precious: 0, healed: 0, glad_met: 0, want_see: 0 };
              const mySet = myReactionsMap[m.id] || new Set();

              return (
                <MomentCard
                  key={m.id}
                  moment={m}
                  isHover={isHover}
                  counts={counts}
                  mySet={mySet}
                  animatingKey={animatingKey}
                  isMobile={isMobile}
                  index={idx}
                  onMouseEnter={() => setHoveredCardId(m.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  onClick={() => { if (isMobile) setSelectedMoment(m); }}
                  onReact={handleReact}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* モバイル詳細モーダル */}
      {selectedMoment && (
        <MomentModal
          moment={selectedMoment}
          counts={reactionCounts[selectedMoment.id]}
          mySet={myReactionsMap[selectedMoment.id]}
          onReact={handleReact}
          onClose={() => setSelectedMoment(null)}
        />
      )}

      {/* ログイン誘導モーダル */}
      {showLoginModal && (
        <LoginPromptModal
          onClose={() => setShowLoginModal(false)}
          onLogin={() => { setShowLoginModal(false); setPage("login"); }}
        />
      )}
    </>
  );
};

// ----------------------------------------------------------------------------
// MomentCard - 静けさ実装 (stagger フェードイン、ホバー時のみ pet_name)
// ----------------------------------------------------------------------------
const MomentCard = ({ moment, isHover, counts, mySet, animatingKey, isMobile, index, onMouseEnter, onMouseLeave, onClick, onReact }) => {
  const { ref, inView } = useInViewStaggered(index, 200);

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        position: "relative",
        borderRadius: 4,
        overflow: "hidden",
        background: QC.cream,
        border: "1px solid rgba(44, 41, 38, 0.03)",
        marginBottom: 20,
        cursor: "pointer",
        transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 1.2s ease",
        transform: isHover
          ? "scale(1.015)"
          : (inView ? "translateY(0)" : "translateY(16px)"),
        opacity: inView ? 1 : 0,
        breakInside: "avoid",
        display: "block",
      }}
    >
      <img
        src={moment.image_url}
        alt={moment.caption}
        loading="lazy"
        decoding="async"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          objectFit: "cover",
        }}
      />

      {/* ホバー時オーバーレイ (PC) */}
      {!isMobile && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, transparent 0%, rgba(250, 247, 242, 0.95) 70%)",
          opacity: isHover ? 1 : 0,
          transition: "opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 24,
          pointerEvents: isHover ? "auto" : "none",
        }}>
          <p style={{
            fontSize: 14,
            fontWeight: 400,
            color: QC.charcoal,
            marginBottom: 6,
            fontFamily: QC_FONT_JP,
            lineHeight: 1.7,
            margin: "0 0 6px 0",
            letterSpacing: 0.5,
          }}>
            「{moment.caption}」
          </p>
          <p style={{
            fontSize: 11,
            color: QC.warmGray,
            marginBottom: 14,
            fontFamily: QC_FONT_JP,
            fontWeight: 300,
            margin: "0 0 14px 0",
            letterSpacing: 0.5,
          }}>
            {moment.pet_name}
          </p>

          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 16px",
            fontSize: 12,
            fontFamily: QC_FONT_JP,
          }}>
            {QC_REACTIONS.map(({ key, label }) => {
              const isSel = mySet.has(key);
              const cnt = counts[key];
              const isAnim = animatingKey === `${moment.id}-${key}`;
              return (
                <button
                  key={key}
                  onClick={(e) => { e.stopPropagation(); onReact(moment.id, key); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "2px 0",
                    cursor: "pointer",
                    color: isSel ? QC.softBrown : QC.warmGray,
                    background: "none",
                    border: "none",
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    borderBottomColor: isSel ? QC.softBrown : "transparent",
                    transition: "all 0.6s ease",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    fontWeight: 300,
                    transform: isAnim ? "translateY(-4px)" : "translateY(0)",
                  }}
                >
                  <span>{label}</span>
                  {cnt > 0 && (
                    <span style={{
                      fontSize: 10,
                      color: QC.sage,
                      fontWeight: 400,
                    }}>
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* 通常時フッター = 削除 (ホバーオーバーレイのみで pet_name 表示) */}
    </div>
  );
};

// ----------------------------------------------------------------------------
// MomentModal - モバイル詳細モーダル (フォント軽く)
// ----------------------------------------------------------------------------
const MomentModal = ({ moment, counts = {}, mySet = new Set(), onReact, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(44, 41, 38, 0.85)",
      zIndex: 1000,
      display: "flex",
      alignItems: "flex-end",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        background: QC.warmWhite,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 32,
        maxHeight: "88vh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={{
        width: 40, height: 4,
        background: QC.lightSand,
        borderRadius: 2,
        margin: "0 auto 32px",
      }} />

      <img
        src={moment.image_url}
        alt={moment.caption}
        style={{
          width: "100%",
          maxHeight: "60vh",
          objectFit: "cover",
          borderRadius: 4,
          marginBottom: 32,
        }}
      />

      <p style={{
        fontSize: 18,
        fontWeight: 400,
        color: QC.charcoal,
        marginBottom: 8,
        fontFamily: QC_FONT_JP,
        lineHeight: 1.7,
        margin: "0 0 8px 0",
        letterSpacing: 0.5,
      }}>
        「{moment.caption}」
      </p>

      <p style={{
        fontSize: 13,
        fontWeight: 300,
        color: QC.warmGray,
        marginBottom: 40,
        fontFamily: QC_FONT_JP,
        margin: "0 0 40px 0",
        letterSpacing: 0.5,
      }}>
        {moment.pet_name}
      </p>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "14px 20px",
        fontSize: 14,
        fontFamily: QC_FONT_JP,
      }}>
        {QC_REACTIONS.map(({ key, label }) => {
          const cnt = (counts || {})[key] || 0;
          const isSel = (mySet || new Set()).has(key);
          return (
            <button
              key={key}
              onClick={() => onReact(moment.id, key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                cursor: "pointer",
                color: isSel ? QC.softBrown : QC.warmGray,
                background: "none",
                border: "none",
                borderBottomWidth: 1,
                borderBottomStyle: "solid",
                borderBottomColor: isSel ? QC.softBrown : "transparent",
                fontFamily: "inherit",
                fontSize: "inherit",
                fontWeight: 300,
                transition: "all 0.6s ease",
              }}
            >
              <span>{label}</span>
              {cnt > 0 && (
                <span style={{ fontSize: 11, color: QC.sage, fontWeight: 400 }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// ----------------------------------------------------------------------------
// LoginPromptModal - CTA弱める版
// ----------------------------------------------------------------------------
const LoginPromptModal = ({ onClose, onLogin }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(44, 41, 38, 0.85)",
      zIndex: 1100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: QC.warmWhite,
        borderRadius: 4,
        padding: 48,
        maxWidth: 400,
        width: "100%",
        textAlign: "center",
      }}
    >
      <h3 style={{
        fontSize: 20,
        color: QC.charcoal,
        marginBottom: 20,
        fontFamily: QC_FONT_JP,
        fontWeight: 400,
        margin: "0 0 20px 0",
        letterSpacing: 0.5,
      }}>
        街の住民になりませんか
      </h3>

      <p style={{
        fontSize: 13,
        fontWeight: 300,
        color: QC.warmGray,
        marginBottom: 40,
        lineHeight: 1.9,
        fontFamily: QC_FONT_JP,
        margin: "0 0 40px 0",
      }}>
        ログインすると、お気に入りのうちの子に
        <br />
        気持ちを伝えられます
      </p>

      <button
        onClick={() => { onClose(); onLogin(); }}
        style={{
          background: "transparent",
          color: QC.terracotta,
          border: `1px solid ${QC.terracotta}`,
          padding: "14px 32px",
          borderRadius: 0,
          fontSize: 13,
          fontWeight: 300,
          cursor: "pointer",
          fontFamily: QC_FONT_JP,
          letterSpacing: 1.2,
          width: "100%",
          transition: "all 0.6s ease",
        }}
      >
        Qoccaに登録する
      </button>

      <button
        onClick={onClose}
        style={{
          background: "transparent",
          color: QC.warmGray,
          border: "none",
          padding: "14px 32px",
          marginTop: 12,
          fontSize: 12,
          fontWeight: 300,
          cursor: "pointer",
          fontFamily: QC_FONT_JP,
          letterSpacing: 0.5,
        }}
      >
        またあとで
      </button>
    </div>
  </div>
);


// ============================================================================
// SECTION 3: Qocca、こんな街です (A Town Map)
// ============================================================================

const SectionTownMap = ({ setPage }) => {
  const places = [
    {
      icon: "○",
      name: "広場",
      en: "Plaza",
      desc: "同じうちの子を持つ仲間と語る場所",
      onClick: () => setPage("communities"),
    },
    {
      icon: "□",
      name: "商店街",
      en: "Atelier",
      desc: "心を込めて作る、街の作家たち",
      onClick: () => setPage("marketplace"),
    },
    {
      icon: "◇",
      name: "案内所",
      en: "Map",
      desc: "ペット同伴可の場所を、隅々まで",
      onClick: () => setPage("facilities"),
    },
    {
      icon: "△",
      name: "展示場",
      en: "Gallery",
      desc: "うちの子の、いちばんの瞬間を",
      onClick: () => setPage("gallery"),
    },
  ];

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  return (
    <section style={{
      padding: "clamp(100px, 18vw, 200px) 0",
      background: "rgba(245, 239, 230, 0.5)",
      borderTop: `1px solid ${QC.lightSand}`,
      borderBottom: `1px solid ${QC.lightSand}`,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>

        {/* セクションヘッダー */}
        <div style={{ marginBottom: 'clamp(40px, 8vw, 80px)' as any, textAlign: "center" }}>
          <p style={{
            fontFamily: QC_FONT_EN,
            fontSize: 13,
            fontStyle: "italic",
            color: QC.warmGray,
            letterSpacing: 0.8,
            margin: "0 0 12px 0",
            opacity: 0.75,
            fontWeight: 300,
          }}>
            A Town Map
          </p>
          {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h2 Shippori Mincho 700 */}
          <h2 style={{
            fontFamily: QC_FONT_DISPLAY,
            fontSize: "clamp(26px, 4.4vw, 36px)",
            fontWeight: 700,
            color: QC.softBrown,
            letterSpacing: "0.06em",
            lineHeight: 1.55,
            margin: 0,
          }}>
            Qocca、こんな街です
          </h2>
          <div style={{
            marginTop: 40,
            width: 32,
            height: 1,
            background: QC.softBrown,
            opacity: 0.3,
            margin: "40px auto 0",
          }} />
        </div>

        {/* 4つの場所カード */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 32,
        }}>
          {places.map((p, i) => {
            const isHover = hoverIndex === i;
            return (
              <div
                key={i}
                onClick={p.onClick}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{
                  background: QC.warmWhite,
                  borderRadius: 4,
                  padding: "56px 32px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.8s ease",
                  border: `1px solid ${QC.lightSand}`,
                  transform: isHover ? "translateY(-2px)" : "translateY(0)",
                  boxShadow: isHover ? "0 8px 24px rgba(44, 41, 38, 0.04)" : "none",
                }}
              >
                <div style={{
                  fontSize: 24,
                  color: QC.warmGray,
                  marginBottom: 24,
                  fontWeight: 200,
                  opacity: 0.6,
                  lineHeight: 1,
                }}>
                  {p.icon}
                </div>
                <p style={{
                  fontFamily: QC_FONT_EN,
                  fontSize: 12,
                  fontStyle: "italic",
                  color: QC.warmGray,
                  letterSpacing: 0.8,
                  margin: "0 0 8px 0",
                  opacity: 0.75,
                  fontWeight: 300,
                }}>
                  {p.en}
                </p>
                <h3 style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: 18,
                  fontWeight: 400,
                  color: QC.softBrown,
                  margin: "0 0 20px 0",
                  letterSpacing: 0.8,
                }}>
                  {p.name}
                </h3>
                <p style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: 12,
                  fontWeight: 300,
                  color: QC.warmGray,
                  lineHeight: 1.9,
                  margin: 0,
                  letterSpacing: 0.3,
                }}>
                  {p.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// SECTION: 街で静かに愛されている作品 (Phase D - SectionQuietlyLoved)
// "プロダクトから文化へ" - 住民の作品を主役に
// 仕様書: docs/Phase_D_SectionQuietlyLoved_仕様書_v2.md
// 設計判断:
//   - データソース: 既存 listings prop (useListings hook) を流用
//     → 新規 DB クエリ不要、seller/imageUrls 整形済み、onDetail と型整合
//   - カードクリック: 既存 onDetail(item) → "detail" page で開く
//     (仕様書の setPage("listing-detail", ...) は未定義 page id のため不採用)
// ============================================================================

const SectionQuietlyLoved = ({ listings, onDetail, setPage }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [allLinkHover, setAllLinkHover] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 新着順 (useListings hook で created_at DESC 取得済み) の先頭 6 件
  // status は useListings hook で approved/sold_out に絞り済み
  const items = (listings || []).slice(0, 6);

  if (items.length === 0) return null;

  return (
    <section style={{
      padding: 'clamp(100px, 18vw, 200px) 0',
      background: 'transparent',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>

        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(50px, 10vw, 100px)' as any}}>
          <p style={{
            fontFamily: QC_FONT_EN,
            fontSize: 13,
            fontStyle: 'italic',
            color: QC.warmGray,
            letterSpacing: 0.8,
            opacity: 0.75,
            fontWeight: 300,
            margin: '0 0 12px 0',
          }}>
            Quietly Loved in Town
          </p>
          {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h2 Shippori Mincho 700 で「号」見出し */}
          <h2 style={{
            fontFamily: QC_FONT_DISPLAY,
            fontSize: 'clamp(26px, 4.4vw, 36px)',
            fontWeight: 700,
            color: QC.softBrown,
            letterSpacing: '0.06em',
            lineHeight: 1.55,
            margin: 0,
          }}>
            街で静かに愛されている作品
          </h2>
          <div style={{
            marginTop: 40,
            width: 32,
            height: 1,
            background: QC.lightSand,
            margin: '40px auto 0',
          }} />
        </div>

        {/* カード レイアウト
            Mobile: 横スクロール (flex + scroll-snap) — "街の道を通れる" 哲学
                    65vw 幅で次のカードが少し見えて "横に続いてる気配"
                    矢印・ドット・フェード・自動スクロール 一切なし
            PC:     3列 grid 維持 (minmax(0, 1fr) で nowrap 子要素の min-content leak 防止) */}
        <div style={{
          display: isMobile ? 'flex' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'repeat(3, minmax(0, 1fr))',
          gap: isMobile ? 16 : 48,
          overflowX: isMobile ? 'auto' : undefined,
          scrollSnapType: isMobile ? 'x mandatory' : undefined,
          paddingRight: isMobile ? 24 : undefined,
          WebkitOverflowScrolling: isMobile ? 'touch' : undefined,
        }}>
          {items.map((item, i) => {
            const isHover = hoverIndex === i;
            const firstImage = (item.imageUrls && item.imageUrls[0]) || item.imageUrl || "";
            const sellerName = item.seller || '街の住民';
            const favoriteCount = item.favorite_count || 0;

            return (
              <div
                key={item.id}
                onClick={() => onDetail(item)}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{
                  flexShrink: isMobile ? 0 : undefined,
                  width: isMobile ? '65vw' : undefined,
                  scrollSnapAlign: isMobile ? 'start' : undefined,
                  cursor: 'pointer',
                  transition: 'transform 1.0s cubic-bezier(0.22, 1, 0.36, 1)',
                  transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
                }}
              >
                {/* 画像 (大きく、Airbnb 風 / mobile はカード詰まり防止で marginBottom 縮小) */}
                <div style={{
                  width: '100%',
                  aspectRatio: '4/5',
                  overflow: 'hidden',
                  marginBottom: isMobile ? 8 : 20,
                  background: QC.cream,
                }}>
                  {firstImage && (
                    <img
                      src={firstImage}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease',
                        transform: isHover ? 'scale(1.02)' : 'scale(1)',
                        opacity: isHover ? 1.0 : 0.95,
                        filter: 'saturate(0.9)',
                      }}
                    />
                  )}
                </div>

                {/* 作品名 (mobile は詰まり防止で 13px / 1行強制 ellipsis) */}
                <h3 style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: isMobile ? 13 : 15,
                  fontWeight: 400,
                  color: QC.softBrown,
                  letterSpacing: 0.5,
                  lineHeight: 1.6,
                  margin: isMobile ? '0 0 4px 0' : '0 0 8px 0',
                  overflow: isMobile ? 'hidden' : undefined,
                  textOverflow: isMobile ? 'ellipsis' : undefined,
                  whiteSpace: isMobile ? 'nowrap' : undefined,
                }}>
                  {item.title}
                </h3>

                {/* by ○○ — この街の住民 (Resident 表現)
                    mobile: 2 行 (by 〜 改行 — この街の住民)
                    PC:     1 行 inline */}
                <p style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: isMobile ? 10 : 11,
                  fontWeight: 300,
                  color: QC.warmGray,
                  opacity: 0.7,
                  margin: isMobile ? '0 0 6px 0' : '0 0 12px 0',
                  letterSpacing: 0.3,
                  lineHeight: 1.5,
                }}>
                  <span style={{
                    display: isMobile ? 'block' : 'inline',
                    overflow: isMobile ? 'hidden' : undefined,
                    textOverflow: isMobile ? 'ellipsis' : undefined,
                    whiteSpace: isMobile ? 'nowrap' : undefined,
                  }}>
                    by {sellerName}
                  </span>
                  <span style={{
                    marginLeft: isMobile ? 0 : 8,
                    opacity: 0.6,
                    fontStyle: 'italic',
                    display: isMobile ? 'block' : 'inline',
                  }}>
                    — この街の住民
                  </span>
                </p>

                {/* 価格 + 共感数字
                    mobile: 価格のみ表示 (10px 左寄せ、"そっと保存" は窮屈なので非表示)
                    PC:     space-between で両方表示 */}
                {isMobile ? (
                  <span style={{
                    fontFamily: QC_FONT_JP,
                    fontSize: 10,
                    fontWeight: 300,
                    color: QC.warmGray,
                    opacity: 0.7,
                    letterSpacing: 0.3,
                  }}>
                    ¥{(item.price || 0).toLocaleString()}
                  </span>
                ) : (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontFamily: QC_FONT_JP,
                      fontSize: 11,
                      fontStyle: 'italic',
                      color: QC.warmGray,
                      opacity: 0.6,
                    }}>
                      {favoriteCount >= 1
                        ? `${favoriteCount}人がそっと保存しました`
                        : ''}
                    </span>

                    <span style={{
                      fontFamily: QC_FONT_JP,
                      fontSize: 11,
                      fontWeight: 300,
                      color: QC.warmGray,
                      opacity: 0.7,
                      letterSpacing: 0.3,
                    }}>
                      ¥{(item.price || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 街の温度ナレーション + 控えめなリンク */}
        <div style={{ marginTop: 'clamp(50px, 10vw, 100px)' as any, textAlign: 'center', padding: '0 32px' }}>
          <p style={{
            fontFamily: QC_FONT_JP,
            fontSize: 12,
            fontStyle: 'italic',
            fontWeight: 300,
            color: QC.warmGray,
            letterSpacing: 1.2,
            opacity: 0.65,
            margin: '0 0 24px 0',
            lineHeight: 1.8,
          }}>
            今日も、誰かの大切な時間が、この街に残されています。
          </p>

          {/* 区切り点 (小さな丸) */}
          <div style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: QC.lightSand,
            margin: '0 auto 40px',
          }} />

          {/* "すべての作品を覗いてみる" 線リンク (推奨ワード: 覗いてみる) */}
          <span
            onClick={() => setPage("search")}
            onMouseEnter={() => setAllLinkHover(true)}
            onMouseLeave={() => setAllLinkHover(false)}
            style={{
              fontFamily: QC_FONT_JP,
              fontSize: 12,
              fontWeight: 300,
              color: QC.softBrown,
              letterSpacing: 1.2,
              borderBottom: `1px solid ${allLinkHover ? QC.softBrown : 'rgba(139, 111, 92, 0.3)'}`,
              paddingBottom: 4,
              cursor: 'pointer',
              transition: 'border-color 0.6s ease',
            }}
          >
            すべての作品を覗いてみる
          </span>
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// SECTION: 街の作家たち (Phase D' - SectionResidentArtisans)
// "作家ベース" の Resident 特集型 (旧 SectionAtelier を完全リデザイン)
// 仕様: King 確定 (3者議論 Phase D 直後)
// 設計判断:
//   - データソース: 既存 listings prop (useListings hook) を流用
//     → seller_id で重複排除、各作家の代表作1点 + サブ作品 max 2点
//   - 旧 SectionAtelier の status filter バグ修正 (常時 false で非表示だった)
//   - 価格非表示 (作家フォーカス、数字を主役にしない)
//   - "作品を覗いてみる" → onDetail(代表作)、"すべての作家を覗いてみる" → setPage("search")
// ============================================================================

const SectionResidentArtisans = ({ listings, onDetail, setPage }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [linkHoverIndex, setLinkHoverIndex] = useState<number | null>(null);
  const [allLinkHover, setAllLinkHover] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 作家ごとに作品をグループ化 (seller_id で重複排除)、最大3人
  // useListings hook は status=approved/sold_out に絞り済みのため、
  // 旧 SectionAtelier の status filter (常時 false バグ) は撤去
  const grouped = new Map<string, { seller_id: string; seller_name: string; works: any[] }>();
  (listings || []).forEach((item: any) => {
    const sellerId = item.seller_id;
    if (!sellerId) return;
    if (!grouped.has(sellerId)) {
      grouped.set(sellerId, {
        seller_id: sellerId,
        seller_name: item.seller || '街の住民',
        works: [],
      });
    }
    grouped.get(sellerId)!.works.push(item);
  });
  const artisans = Array.from(grouped.values()).slice(0, 3);

  if (artisans.length === 0) return null;

  return (
    <section style={{
      padding: 'clamp(100px, 18vw, 200px) 0',
      background: 'transparent',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>

        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(50px, 10vw, 100px)' as any}}>
          <p style={{
            fontFamily: QC_FONT_EN,
            fontSize: 13,
            fontStyle: 'italic',
            color: QC.warmGray,
            letterSpacing: 0.8,
            opacity: 0.75,
            fontWeight: 300,
            margin: '0 0 12px 0',
          }}>
            Residents of the Town
          </p>
          {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h2 Shippori Mincho 700 */}
          <h2 style={{
            fontFamily: QC_FONT_DISPLAY,
            fontSize: 'clamp(26px, 4.4vw, 36px)',
            fontWeight: 700,
            color: QC.softBrown,
            letterSpacing: '0.06em',
            lineHeight: 1.55,
            margin: 0,
          }}>
            街の作家たち
          </h2>
          <div style={{
            marginTop: 40,
            width: 32,
            height: 1,
            background: QC.lightSand,
            margin: '40px auto 0',
          }} />
        </div>

        {/* 作家カード (縦に各作家1枚ずつ、gap 80px) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(40px, 8vw, 80px)' as any,
        }}>
          {artisans.map((artisan, i) => {
            const isHover = hoverIndex === i;
            const works = artisan.works;
            const mainWork = works[0];
            const subWorks = works.slice(1, 3);
            const mainImage = (mainWork.imageUrls && mainWork.imageUrls[0]) || mainWork.imageUrl || '';
            const workTitles = works.slice(0, 3).map(w => w.title).filter(Boolean).join('、');
            const introText = workTitles ? `${workTitles}を作っています` : '';

            return (
              <article
                key={artisan.seller_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: isMobile ? 32 : 56,
                  alignItems: 'center',
                }}
              >
                {/* 左カラム: 作品コラージュ */}
                <div>
                  {/* 代表作 */}
                  <div
                    onClick={() => onDetail(mainWork)}
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                    style={{
                      width: '100%',
                      aspectRatio: '4/5',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: QC.cream,
                      marginBottom: subWorks.length > 0 ? 16 : 0,
                    }}
                  >
                    {mainImage && (
                      <img
                        src={mainImage}
                        alt={mainWork.title}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          transition: 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease',
                          transform: isHover ? 'scale(1.02)' : 'scale(1)',
                          opacity: isHover ? 1.0 : 0.95,
                          filter: 'saturate(0.9)',
                        }}
                      />
                    )}
                  </div>

                  {/* サブ作品 (max 2点 横並び 1:1) */}
                  {subWorks.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${subWorks.length}, 1fr)`,
                      gap: 16,
                    }}>
                      {subWorks.map(sub => {
                        const subImage = (sub.imageUrls && sub.imageUrls[0]) || sub.imageUrl || '';
                        return (
                          <div
                            key={sub.id}
                            onClick={() => onDetail(sub)}
                            style={{
                              width: '100%',
                              aspectRatio: '1/1',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              background: QC.cream,
                            }}
                          >
                            {subImage && (
                              <img
                                src={subImage}
                                alt={sub.title}
                                loading="lazy"
                                decoding="async"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                  filter: 'saturate(0.9)',
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 右カラム: 作家情報 + CTA */}
                <div>
                  <h3 style={{
                    fontFamily: QC_FONT_JP,
                    fontSize: 17,
                    fontWeight: 500,
                    color: QC.softBrown,
                    letterSpacing: 0.5,
                    lineHeight: 1.6,
                    margin: 0,
                  }}>
                    {artisan.seller_name}
                    <span style={{
                      marginLeft: 12,
                      fontSize: 12,
                      fontWeight: 300,
                      fontStyle: 'italic',
                      opacity: 0.6,
                      letterSpacing: 0.3,
                      color: QC.warmGray,
                    }}>
                      — この街の住民
                    </span>
                  </h3>

                  {introText && (
                    <p style={{
                      fontFamily: QC_FONT_JP,
                      fontSize: 13,
                      fontWeight: 300,
                      color: QC.warmGray,
                      lineHeight: 1.9,
                      letterSpacing: 0.5,
                      margin: '24px 0 32px 0',
                    }}>
                      {introText}
                    </p>
                  )}

                  {/* CTA: 作品を覗いてみる → onDetail(代表作) */}
                  <span
                    onClick={() => onDetail(mainWork)}
                    onMouseEnter={() => setLinkHoverIndex(i)}
                    onMouseLeave={() => setLinkHoverIndex(null)}
                    style={{
                      fontFamily: QC_FONT_JP,
                      fontSize: 12,
                      fontWeight: 300,
                      color: QC.softBrown,
                      letterSpacing: 1.2,
                      borderBottom: `1px solid ${linkHoverIndex === i ? QC.softBrown : 'rgba(139, 111, 92, 0.3)'}`,
                      paddingBottom: 4,
                      cursor: 'pointer',
                      transition: 'border-color 0.6s ease',
                    }}
                  >
                    作品を覗いてみる
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        {/* 下部: 空気ナレーション + 区切り点 + "すべての作家を覗いてみる" */}
        <div style={{ marginTop: 'clamp(60px, 12vw, 120px)' as any, textAlign: 'center', padding: '0 32px' }}>
          <p style={{
            fontFamily: QC_FONT_JP,
            fontSize: 12,
            fontStyle: 'italic',
            fontWeight: 300,
            color: QC.warmGray,
            letterSpacing: 1.2,
            opacity: 0.65,
            margin: '0 0 24px 0',
            lineHeight: 1.8,
          }}>
            この街で、心を込めて作る人たち。
          </p>
          <div style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: QC.lightSand,
            margin: '0 auto 40px',
          }} />
          <span
            onClick={() => setPage('search')}
            onMouseEnter={() => setAllLinkHover(true)}
            onMouseLeave={() => setAllLinkHover(false)}
            style={{
              fontFamily: QC_FONT_JP,
              fontSize: 12,
              fontWeight: 300,
              color: QC.softBrown,
              letterSpacing: 1.2,
              borderBottom: `1px solid ${allLinkHover ? QC.softBrown : 'rgba(139, 111, 92, 0.3)'}`,
              paddingBottom: 4,
              cursor: 'pointer',
              transition: 'border-color 0.6s ease',
            }}
          >
            すべての作家を覗いてみる
          </span>
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// SECTION 5: 街の声 (Voices) - コミュニティ + イベント
// ============================================================================

const SectionVoices = ({ setPage }) => {
  const [communities, setCommunities] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [hoverIdC, setHoverIdC] = useState<string | null>(null);
  const [hoverIdE, setHoverIdE] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ data: cs }, { data: es }] = await Promise.all([
          supabase
            .from("communities")
            // 実 DB スキーマ: pet_type は存在せず → category ("犬種別" "猫種別" 等) に変更
            .select("id, name, description, category, member_count")
            .order("member_count", { ascending: false })
            .limit(3),
          supabase
            .from("events")
            // 実 DB スキーマ: location は存在せず → place、event_date は date 型 (YYYY-MM-DD)
            .select("id, title, place, event_date, description")
            .gte("event_date", new Date().toISOString().slice(0, 10))
            .order("event_date", { ascending: true })
            .limit(3),
        ]);
        if (mounted) {
          setCommunities(cs || []);
          setEvents(es || []);
        }
      } catch (e) {
        console.error("Voices fetch error:", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (communities.length === 0 && events.length === 0) return null;

  return (
    <section style={{
      padding: "clamp(100px, 18vw, 200px) 0",
      background: "rgba(245, 239, 230, 0.5)",
      borderTop: `1px solid ${QC.lightSand}`,
      borderBottom: `1px solid ${QC.lightSand}`,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>

        <div style={{ marginBottom: 80 }}>
          <p style={{
            fontFamily: QC_FONT_EN,
            fontSize: 13,
            fontStyle: "italic",
            color: QC.warmGray,
            letterSpacing: 0.8,
            margin: "0 0 12px 0",
            opacity: 0.75,
            fontWeight: 300,
          }}>
            Voices of the Town
          </p>
          {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h2 Shippori Mincho 700 */}
          <h2 style={{
            fontFamily: QC_FONT_DISPLAY,
            fontSize: "clamp(26px, 4.4vw, 36px)",
            fontWeight: 700,
            color: QC.softBrown,
            letterSpacing: "0.06em",
            lineHeight: 1.55,
            margin: 0,
          }}>
            街の声
          </h2>
          <div style={{
            marginTop: 40,
            width: 32,
            height: 1,
            background: QC.lightSand,
          }} />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 48,
        }}>

          {/* コミュニティ */}
          {communities.length > 0 && (
            <div>
              <h3 style={{
                fontFamily: QC_FONT_JP,
                fontSize: 15,
                fontWeight: 400,
                color: QC.charcoal,
                margin: "0 0 28px 0",
                letterSpacing: 0.8,
              }}>
                広場でのおしゃべり
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {communities.map(c => {
                  const isHover = hoverIdC === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setPage("communities")}
                      onMouseEnter={() => setHoverIdC(c.id)}
                      onMouseLeave={() => setHoverIdC(null)}
                      style={{
                        background: QC.warmWhite,
                        padding: "24px 28px",
                        borderRadius: 4,
                        cursor: "pointer",
                        border: `1px solid ${QC.lightSand}`,
                        transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                        transform: isHover ? "translateX(2px)" : "translateX(0)",
                      }}
                    >
                      <p style={{
                        fontFamily: QC_FONT_JP,
                        fontSize: 13,
                        fontWeight: 400,
                        color: QC.charcoal,
                        margin: "0 0 8px 0",
                        lineHeight: 1.7,
                      }}>
                        {c.name}
                      </p>
                      <p style={{
                        fontFamily: QC_FONT_JP,
                        fontSize: 11,
                        fontWeight: 300,
                        color: QC.warmGray,
                        margin: 0,
                        letterSpacing: 0.5,
                      }}>
                        {c.member_count || 0} 人
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* イベント */}
          {events.length > 0 && (
            <div>
              <h3 style={{
                fontFamily: QC_FONT_JP,
                fontSize: 15,
                fontWeight: 400,
                color: QC.charcoal,
                margin: "0 0 28px 0",
                letterSpacing: 0.8,
              }}>
                街のお知らせ
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {events.map(ev => {
                  const isHover = hoverIdE === ev.id;
                  const d = new Date(ev.event_date);
                  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setPage("events")}
                      onMouseEnter={() => setHoverIdE(ev.id)}
                      onMouseLeave={() => setHoverIdE(null)}
                      style={{
                        background: QC.warmWhite,
                        padding: "24px 28px",
                        borderRadius: 4,
                        cursor: "pointer",
                        border: `1px solid ${QC.lightSand}`,
                        transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                        transform: isHover ? "translateX(2px)" : "translateX(0)",
                        display: "flex",
                        gap: 20,
                      }}
                    >
                      <div style={{
                        flexShrink: 0,
                        fontFamily: QC_FONT_EN,
                        fontSize: 17,
                        color: QC.softBrown,
                        fontWeight: 400,
                        letterSpacing: 0.5,
                      }}>
                        {dateStr}
                      </div>
                      <div>
                        <p style={{
                          fontFamily: QC_FONT_JP,
                          fontSize: 13,
                          fontWeight: 400,
                          color: QC.charcoal,
                          margin: "0 0 6px 0",
                          lineHeight: 1.7,
                        }}>
                          {ev.title}
                        </p>
                        {ev.place && (
                          <p style={{
                            fontFamily: QC_FONT_JP,
                            fontSize: 11,
                            fontWeight: 300,
                            color: QC.warmGray,
                            margin: 0,
                            letterSpacing: 0.5,
                          }}>
                            {ev.place}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// SECTION 6: 仲間になろう (Join the Town) - 登録CTA
// ============================================================================

const SectionJoinTown = ({ setPage }) => {
  const { user } = useAuth();
  const [isHover, setIsHover] = useState(false);

  if (user) return null;

  return (
    <section style={{
      padding: "clamp(120px, 22vw, 240px) 0",
      background: "transparent",
      textAlign: "center",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 32px" }}>

        <p style={{
          fontFamily: QC_FONT_EN,
          fontSize: 13,
          fontStyle: "italic",
          color: QC.warmGray,
          letterSpacing: 1,
          margin: "0 0 24px 0",
          opacity: 0.75,
          fontWeight: 300,
        }}>
          Join the Town
        </p>

        {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h2 Shippori Mincho 700 で「号」見出し */}
        <h2 style={{
          fontFamily: QC_FONT_DISPLAY,
          fontSize: "clamp(26px, 4.4vw, 36px)",
          fontWeight: 700,
          color: QC.softBrown,
          letterSpacing: "0.06em",
          lineHeight: 1.7,
          margin: "0 0 44px 0",
        }}>
          あなたの家の窓辺を、
          <br />
          誰かに見せませんか。
        </h2>

        <p style={{
          fontFamily: QC_FONT_JP,
          fontSize: 13,
          fontWeight: 300,
          color: QC.warmGray,
          lineHeight: 1.9,
          margin: "0 0 80px 0",
          letterSpacing: 0.5,
        }}>
          うちの子の話で笑い合える、
          <br />
          そんな街が、ここにあります。
        </p>

        <button
          onClick={() => setPage("login")}
          onMouseEnter={() => setIsHover(true)}
          onMouseLeave={() => setIsHover(false)}
          style={{
            fontFamily: QC_FONT_JP,
            background: isHover ? "rgba(201, 123, 95, 0.05)" : "transparent",
            color: QC.terracotta,
            border: `1px solid ${QC.terracotta}`,
            padding: "16px 48px",
            fontSize: 14,
            fontWeight: 300,
            letterSpacing: 1.5,
            cursor: "pointer",
            borderRadius: 0,
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          Qoccaの住民になる
        </button>
      </div>
    </section>
  );
};


// ============================================================================
// 新 HomePage（Phase 1.5 リニューアル版）
// ============================================================================
// ── 依頼書 #10 (5/25): クラファン誘導バナー + ARK 連携セクション ─────────
// 期限制御内蔵: 7/1 以降は完全非表示。6/3-6/30 は「実施中」表示に切り替え
// (依頼書 #46 5/31: 6/1 → 6/3 公開日修正)
// CrowdfundingBanner + クラファン期間定数は components/CrowdfundingBanner.tsx へ移動 (Phase5 ②gallery 循環import回避)

// ── 依頼書 #35 v2 (2026/5/31): 創業パートナー HomePage セクション ─────────
// SELECT crowdfunding_public_sponsors (anon 可) → mayor_30000 + corporate_300000 で
// founding_display_consent=true のみ表示 (オプトイン)
// 名前のみシンプル表示 (永続記録 #11「シンプル維持」哲学準拠)
const FoundingPartnersSection = () => {
  const [partners, setPartners] = useState<Array<{
    backer_id: string; tier: string; amount: number;
    founding_display_name: string | null; sponsor_company_name: string | null;
    display_name: string | null;
  }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("crowdfunding_public_sponsors")
        .select("backer_id, tier, amount, founding_display_name, sponsor_company_name, display_name, founding_display_consent")
        .in("tier", ["mayor_30000", "corporate_300000"])
        .eq("founding_display_consent", true)
        .order("amount", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(50);
      setPartners((data as any[]) || []);
      setLoaded(true);
    })();
  }, []);

  // データがまだない期間は誠実セクションを薄く出す (CTA 中心)
  const hasPartners = loaded && partners.length > 0;

  return (
    <div style={{ padding: "36px 20px 28px", background: "#FFF9F0" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>🌟</div>
        {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h3 Shippori Mincho 700 */}
        <h3 style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: "#5A4A2C", margin: "0 0 14px", letterSpacing: "0.04em" }}>
          創業パートナー
        </h3>
        <p style={{ fontSize: 12, color: "#8B7355", lineHeight: 1.9, margin: "0 0 18px" }}>
          Qocca の街を 最初に信じて<br />
          一緒に作ってくださっている方々
        </p>
        {hasPartners ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 18 }}>
            {partners.map(p => {
              const name = p.tier === "corporate_300000"
                ? (p.sponsor_company_name || p.founding_display_name || p.display_name || "法人スポンサー")
                : (p.founding_display_name || p.display_name || "街の首長");
              const icon = p.tier === "corporate_300000" ? "🏢" : "👑";
              return (
                <span key={p.backer_id} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "6px 12px", background: "#FFF", borderRadius: 20,
                  fontSize: 12, color: "#5A4A2C", fontWeight: 600,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <span>{icon}</span><span>{name}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "8px 0 18px", color: "#A89580", fontSize: 11.5, lineHeight: 1.9, fontStyle: "italic" }}>
            ※ 創業パートナーの公開掲載は<br />
            クラウドファンディング 公開中。創業期住民・作家さんの紹介を順次掲載します🌅
          </div>
        )}
        <div style={{ fontSize: 11, color: "#A07640" }}>
          <a href="/about" style={{ color: "#A07640", textDecoration: "underline", fontWeight: 700 }}>創業期メンバーになる →</a>
        </div>
      </div>
    </div>
  );
};

const ArkPartnershipSection = () => {
  const now = new Date();
  // 6/3 以降は SectionAnnouncement や CrowdfundingBanner が ARK 言及するので重複回避で薄める
  // ただし誠実な常時表示として残す
  return (
    <div style={{ padding: "36px 20px 28px", background: "#FAFAF7" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 22, marginBottom: 10 }}>🐕</div>
        {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h3 Shippori Mincho 700 / 本文は Noto Sans JP 維持 (ARK 正式名称含むため可読性最優先) */}
        <h3 style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: "#3D2E1E", margin: "0 0 18px", letterSpacing: "0.04em" }}>
          動物福祉団体との連携
        </h3>
        <p style={{ fontSize: 12.5, color: "#8B7355", lineHeight: 2, margin: 0 }}>
          Qocca で生まれる売上の <strong style={{ color: "#3D2E1E" }}>3% を</strong><br />
          <strong style={{ color: "#3D2E1E" }}>特定非営利活動法人<br />
          アニマルレフュージ関西【ARK】</strong> へ<br />
          寄付しています。
        </p>
        <p style={{ fontSize: 11.5, color: "#A89580", lineHeight: 2, margin: "18px 0 0", fontStyle: "italic" }}>
          「ペットと暮らすこと」と<br />
          「動物福祉」は、<br />
          本来切り離せない問題のはずです。
        </p>
      </div>
    </div>
  );
};

// ── 依頼書 #116 (2026/6/5): HomePage 末尾イベントセクション (#113 最終ピース) ─────
// 既存 events テーブル読み取りのみ (新規スキーマなし)
// approved + event_date >= 今日 + limit 4 で取得 (L14531 のロジック流用)
// 0件のときはセクションごと非表示
const HomeEventsSection = ({ events, setPage }: { events: any[]; setPage: any }) => {
  if (!events || events.length === 0) return null;
  const petEmoji = (pt: string | null) => pt === "dog" ? "🐶" : pt === "cat" ? "🐱" : pt === "both" ? "🐾" : "🐾";
  return (
    <section style={{ padding: "48px 16px", background: C.white, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h2 Shippori Mincho 700 */}
          <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: C.dark, margin: "0 0 8px", letterSpacing: "0.04em" }}>
            🐾 全国のペットイベント
          </h2>
          <p style={{ fontSize: 12, color: C.warmGray, margin: 0, lineHeight: 1.7 }}>
            お近くのイベント、のぞいてみませんか
          </p>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}>
          {events.map((e: any) => (
            <div key={e.id} onClick={() => setPage("events")} style={{
              background: C.cream, borderRadius: 14, padding: 16,
              border: `1px solid ${C.border}`, cursor: "pointer",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
              onMouseEnter={ev => { (ev.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (ev.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 16px rgba(245,169,74,0.12)"; }}
              onMouseLeave={ev => { (ev.currentTarget as HTMLDivElement).style.transform = ""; (ev.currentTarget as HTMLDivElement).style.boxShadow = ""; }}>
              <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginBottom: 6, letterSpacing: 0.3 }}>
                {petEmoji(e.pet_type)} {e.category || "イベント"}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 8, lineHeight: 1.4,
                overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: 38,
              }}>
                {e.title}
              </div>
              <div style={{ fontSize: 11, color: C.warmGray, lineHeight: 1.7 }}>
                📅 {e.event_date}{e.event_time ? ` ${e.event_time}` : ""}
              </div>
              <div style={{ fontSize: 11, color: C.warmGray, lineHeight: 1.7 }}>
                📍 {e.prefecture || "—"}{e.city ? ` / ${e.city}` : ""}
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <button onClick={() => setPage("events")} style={{
            padding: "10px 24px", background: C.orange, color: "#fff", border: "none",
            borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit",
          }}>
            イベントをもっと見る →
          </button>
        </div>
      </div>
    </section>
  );
};

const HomePage = ({ setPage, listings, liked, onLike, onDetail, homeEvents = [] }) => {
  const progress = useScrollProgress();
  const bgColor = qoccaInterpolateBackground(progress);

  return (
    <div style={{
      background: bgColor,
      transition: "background 1.5s ease",
      minHeight: "100vh",
      position: "relative",
    }}>
      <style>{QC_KEYFRAMES}</style>
      <QoccaNoiseOverlay />

      <SectionHero />
      <SectionAnnouncement />
      {/* 依頼書 #10 (5/25): クラファン誘導バナー (期限制御内蔵) */}
      <CrowdfundingBanner />
      <SectionWhatIsQocca setPage={setPage} />
      <SectionQuietlyLoved listings={listings} onDetail={onDetail} setPage={setPage} />
      <SectionTodaysMoments setPage={setPage} />
      <SectionTownMap setPage={setPage} />
      <SectionResidentArtisans listings={listings} onDetail={onDetail} setPage={setPage} />
      <SectionVoices setPage={setPage} />
      {/* 依頼書 #10 (5/25): ARK 連携 誠実セクション (常時表示) */}
      <ArkPartnershipSection />
      {/* 依頼書 #36 (5/31): 初期メンバー紹介 (ARK と 創業パートナーの間) */}
      <InitialMembersSection />
      {/* 依頼書 #35 v2 (5/31): 創業パートナー (mayor_30000 + corporate_300000) */}
      <FoundingPartnersSection />
      <SectionJoinTown setPage={setPage} />
      {/* 🔴 緊急修正 (2026/6/5): #116 末尾セクションを本来あるべき HomePage 内 (SectionJoinTown と Footer の間) に正しく配置 - 0件時 null 非表示 */}
      <HomeEventsSection events={homeEvents} setPage={setPage}/>
      <SharedFooter setPage={setPage}/>
    </div>
  );
};

// ── SEARCH (v3.2 商い街化 Phase 1: 5経路 + ふらっと + 空配列導線) ─────────
// SearchPage は pages/marketplace.tsx へ移動 (Phase6 6a)

// ── DETAIL ─────────────────────────────────────────────────────────────────
// DetailPage / SellPage は pages/marketplace.tsx へ移動 (Phase6 6b 決済本丸)

// ── SIGNUP / LOGIN (Supabase Auth) ────────────────────────────────────────
const SignupPage = ({ setPage }) => {
  const { user, signUp, signIn, signInWithProvider, resetPassword } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // ログイン済みならマイページへ
  if (user) return <MyPage setPage={setPage}/>;

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "register" && !agreeTerms) {
      setError("利用規約への同意が必要です。");
      setLoading(false);
      return;
    }

    if (!email || !pass) {
      setError("メールアドレスとパスワードを入力してください。");
      setLoading(false);
      return;
    }

    if (pass.length < 6) {
      setError("パスワードは6文字以上にしてください。");
      setLoading(false);
      return;
    }

    try {
      if (mode === "login") {
        const { error } = await signIn(email, pass);
        if (error) {
          if (error.message.includes("Invalid login")) {
            setError("メールアドレスまたはパスワードが正しくありません。");
          } else {
            setError(error.message);
          }
        } else {
          setPage("home");
        }
      } else {
        const { data, error } = await signUp(email, pass, displayName || email.split("@")[0]);
        if (error) {
          if (error.message.includes("already registered")) {
            setError("このメールアドレスは既に登録されています。");
          } else {
            setError(error.message);
          }
        } else if (data?.user?.identities?.length === 0) {
          setError("このメールアドレスは既に登録されています。");
        } else {
          setMessage("✉️ 確認メールを送信しました！メール内のリンクをクリックして登録を完了してください。");
          // 依頼書 #121 (2026/6/5): Meta Pixel CompleteRegistration (個人情報なし)
          try { mpTrackEvent("CompleteRegistration"); } catch (_) { /* no-op */ }
        }
      }
    } catch (e) {
      setError("エラーが発生しました。もう一度お試しください。");
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    setError("");
    const { error } = await signInWithProvider(provider);
    if (error) setError(error.message);
  };

  const handleReset = async () => {
    setError("");
    setMessage("");
    if (!email) {
      setError("メールアドレスを入力してください。");
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      setError(error.message);
    } else {
      setMessage("✉️ パスワードリセットメールを送信しました。メールをご確認ください。");
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 16px" }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <Logo size={36}/>
          <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginTop:14 }}>
            {showReset ? "パスワードリセット" : mode==="login" ? "ログイン" : "新規登録"}
          </h1>
        </div>
        <div style={{ background:C.white, borderRadius:20, padding:"24px 16px", border:`1px solid ${C.border}` }}>
          {!showReset && (
            <div style={{ display:"flex", background:C.lightGray, borderRadius:10, padding:4, marginBottom:20 }}>
              {[["login","ログイン"],["register","新規登録"]].map(([v,l])=>(
                <button key={v} onClick={()=>{setMode(v);setError("");setMessage("");}} style={{
                  flex:1, padding:"9px", border:"none", borderRadius:8, cursor:"pointer",
                  background:mode===v?C.white:"transparent", fontWeight:800, fontSize:13, fontFamily:"inherit",
                  color:mode===v?C.dark:C.warmGray
                }}>{l}</button>
              ))}
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div style={{ background:C.redPale, border:`1px solid ${C.red}`, borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:13, color:C.red, fontWeight:600 }}>
              ⚠️ {error}
            </div>
          )}
          {message && (
            <div style={{ background:C.greenPale, border:`1px solid ${C.green}`, borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:13, color:C.green, fontWeight:600 }}>
              {message}
            </div>
          )}

          {showReset ? (
            <>
              <p style={{ fontSize:13, color:C.warmGray, marginBottom:16, lineHeight:1.6 }}>
                登録時のメールアドレスを入力してください。パスワードリセットのリンクをお送りします。
              </p>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>メールアドレス</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
                  style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <button onClick={handleReset} disabled={loading} style={{
                width:"100%", padding:"14px", background:loading?C.warmGray:C.orange, border:"none", borderRadius:12,
                color:"#fff", fontWeight:800, fontSize:15, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit"
              }}>{loading ? "送信中..." : "リセットメールを送信"}</button>
              <button onClick={()=>{setShowReset(false);setError("");setMessage("");}} style={{
                width:"100%", padding:"12px", marginTop:12, background:"none", border:"none",
                color:C.orange, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit"
              }}>← ログインに戻る</button>
            </>
          ) : (
            <>
              {/* 新規登録時のみ表示名 */}
              {mode==="register" && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>表示名（ニックネーム）</label>
                  <input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="例：みかん工房"
                    style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                </div>
              )}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>メールアドレス</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
                  style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <div style={{ marginBottom:mode==="register"?14:6 }}>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>パスワード</label>
                <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="6文字以上"
                  style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>

              {/* パスワードリセットリンク */}
              {mode==="login" && (
                <div style={{ textAlign:"right", marginBottom:16 }}>
                  <button onClick={()=>{setShowReset(true);setError("");setMessage("");}} style={{
                    background:"none", border:"none", color:C.orange, fontSize:12, fontWeight:600,
                    cursor:"pointer", fontFamily:"inherit", padding:0
                  }}>パスワードを忘れた方</button>
                </div>
              )}

              {/* 利用規約同意（新規登録のみ） */}
              {mode==="register" && (
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={agreeTerms} onChange={e=>setAgreeTerms(e.target.checked)}
                      style={{ marginTop:3, accentColor:C.orange, width:18, height:18 }}/>
                    <span style={{ fontSize:12, color:C.warmGray, lineHeight:1.6 }}>
                      <span onClick={()=>setPage("terms")} style={{ color:C.orange, fontWeight:700, cursor:"pointer" }}>利用規約</span>
                      、
                      <span onClick={()=>setPage("privacy")} style={{ color:C.orange, fontWeight:700, cursor:"pointer" }}>プライバシーポリシー</span>
                      に同意します
                    </span>
                  </label>
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading} style={{
                width:"100%", padding:"14px", background:loading?C.warmGray:C.orange, border:"none", borderRadius:12,
                color:"#fff", fontWeight:800, fontSize:15, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit",
                opacity:loading?0.7:1, transition:"opacity 0.2s"
              }}>
                {loading ? (
                  <span>処理中...</span>
                ) : (
                  mode==="login" ? "ログイン" : "アカウントを作成"
                )}
              </button>

              <div style={{ display:"flex", alignItems:"center", gap:8, margin:"16px 0" }}>
                <div style={{ flex:1, height:1, background:C.border }}/>
                <span style={{ fontSize:12, color:C.warmGray }}>または</span>
                <div style={{ flex:1, height:1, background:C.border }}/>
              </div>

              {/* ソーシャルログイン */}
              <button onClick={()=>handleOAuth("google")} style={{
                width:"100%", padding:"11px", marginBottom:8, border:`1.5px solid ${C.border}`,
                borderRadius:10, background:C.white, cursor:"pointer", fontSize:13, fontWeight:700,
                fontFamily:"inherit", color:C.dark, display:"flex", alignItems:"center", justifyContent:"center", gap:8
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Googleで続ける
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── MY PAGE ───────────────────────────────────────────────────────────────
// ── USER PROFILE PAGE（他ユーザーのプロフィール閲覧） ──
// UserProfilePage は pages/marketplace.tsx へ移動 (Phase6 6a)

// Phase D Phase 2 (5/22 夜): /pet/:petId — 個別ペット詳細ページ (King 推奨A案)
const PetDetailPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const { petId } = useParams();
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState<{
    id: string; owner_id: string; name: string; species: string;
    breed?: string | null; birthday?: string | null; bio?: string | null;
    avatar_url?: string | null; gender?: string | null; status: string;
  } | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; photo_url: string; caption?: string | null; taken_at?: string | null }>>([]);
  const [owner, setOwner] = useState<{ id: string; display_name: string; avatar_url?: string | null; font_pet_name?: string | null } | null>(null);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  // 依頼書 #136 B1 Step 2 (2026/6/8): 健康記録 (体重 + 通院) - 飼い主専用
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [weights, setWeights] = useState<Array<{ id: string; recorded_at: string; weight_kg: number; memo: string | null }>>([]);
  const [clinicVisits, setClinicVisits] = useState<Array<{ id: string; visited_at: string; clinic_name: string | null; reason: string | null; memo: string | null }>>([]);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [wDate, setWDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [wKg, setWKg] = useState("");
  const [wMemo, setWMemo] = useState("");
  const [showClinicForm, setShowClinicForm] = useState(false);
  const [cDate, setCDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cName, setCName] = useState("");
  const [cReason, setCReason] = useState("");
  const [cMemo, setCMemo] = useState("");
  const [hrSaving, setHrSaving] = useState(false);
  const [hrError, setHrError] = useState("");

  // 認証ガード (King 判断: ログイン必要)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const returnTo = encodeURIComponent(window.location.pathname);
        navigate(`/login?returnTo=${returnTo}`, { replace: true });
        return;
      }
      setAuthChecked(true);
    })();
  }, [navigate]);

  // pet + photos + owner 取得
  useEffect(() => {
    if (!petId) return;
    (async () => {
      setLoading(true);
      const { data: petData } = await supabase
        .from("pets")
        .select("id, owner_id, name, species, breed, birthday, bio, avatar_url, gender, status")
        .eq("id", petId)
        .single();
      setPet(petData || null);

      if (petData) {
        const { data: photoData } = await supabase
          .from("pet_photos")
          .select("id, photo_url, caption, taken_at")
          .eq("pet_id", petId)
          .order("display_order", { ascending: true });
        setPhotos(photoData || []);

        const { data: ownerData } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, font_pet_name")
          .eq("id", petData.owner_id)
          .single();
        setOwner(ownerData || null);
      }
      setLoading(false);
    })();
  }, [petId]);

  // 依頼書 #136 B1 Step 2 (2026/6/8): currentUser 取得 + 飼い主のみ健康記録 fetch
  // 設計憲法: 飼い主のみ参照可 (RLS で保護 / fetch 結果も RLS 側で 0行 になる安全二重)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    })();
  }, []);
  useEffect(() => {
    if (!petId || !pet || !currentUserId || currentUserId !== pet.owner_id) {
      setWeights([]);
      setClinicVisits([]);
      return;
    }
    (async () => {
      const [{ data: ws }, { data: cs }] = await Promise.all([
        supabase.from("pet_weights").select("id, recorded_at, weight_kg, memo").eq("pet_id", petId).order("recorded_at", { ascending: false }).limit(20),
        supabase.from("pet_clinic_visits").select("id, visited_at, clinic_name, reason, memo").eq("pet_id", petId).order("visited_at", { ascending: false }).limit(20),
      ]);
      setWeights(ws || []);
      setClinicVisits(cs || []);
    })();
  }, [petId, pet, currentUserId]);

  // 依頼書 #136 B1 Step 2: 体重記録追加
  const handleAddWeight = async () => {
    if (!petId || !currentUserId) return;
    const kgNum = parseFloat(wKg);
    if (!wDate || isNaN(kgNum) || kgNum <= 0 || kgNum >= 200) {
      setHrError("日付と体重 (0 < kg < 200) を入力してください");
      return;
    }
    setHrSaving(true); setHrError("");
    const { data, error } = await supabase.from("pet_weights").insert({
      pet_id: petId, recorded_at: wDate, weight_kg: kgNum, memo: wMemo.trim() || null, created_by: currentUserId
    }).select("id, recorded_at, weight_kg, memo").single();
    setHrSaving(false);
    if (error) { setHrError("保存に失敗しました: " + error.message); return; }
    if (data) setWeights([data, ...weights]);
    setShowWeightForm(false); setWKg(""); setWMemo(""); setWDate(new Date().toISOString().slice(0, 10));
  };

  // 依頼書 #136 B1 Step 2: 通院記録追加
  const handleAddClinic = async () => {
    if (!petId || !currentUserId) return;
    if (!cDate) { setHrError("日付を入力してください"); return; }
    setHrSaving(true); setHrError("");
    const { data, error } = await supabase.from("pet_clinic_visits").insert({
      pet_id: petId, visited_at: cDate, clinic_name: cName.trim() || null, reason: cReason.trim() || null, memo: cMemo.trim() || null, created_by: currentUserId
    }).select("id, visited_at, clinic_name, reason, memo").single();
    setHrSaving(false);
    if (error) { setHrError("保存に失敗しました: " + error.message); return; }
    if (data) setClinicVisits([data, ...clinicVisits]);
    setShowClinicForm(false); setCName(""); setCReason(""); setCMemo(""); setCDate(new Date().toISOString().slice(0, 10));
  };

  // 削除 (体重・通院 共通)
  const handleDeleteWeight = async (id: string) => {
    if (!confirm("この体重記録を削除しますか?")) return;
    const { error } = await supabase.from("pet_weights").delete().eq("id", id);
    if (!error) setWeights(weights.filter(w => w.id !== id));
  };
  const handleDeleteClinic = async (id: string) => {
    if (!confirm("この通院記録を削除しますか?")) return;
    const { error } = await supabase.from("pet_clinic_visits").delete().eq("id", id);
    if (!error) setClinicVisits(clinicVisits.filter(c => c.id !== id));
  };

  if (!authChecked || loading) return <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>読み込み中...</div>;
  if (!pet) return <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>うちの子が見つかりません</div>;

  const isMemorial = pet.status === "memorial";
  const speciesEmoji = petIcon(pet.species);
  const genderIcon = pet.gender === "male" ? "♂" : pet.gender === "female" ? "♀" : "";
  const speciesLabel = petLabelShort(pet.species);
  const heroPhoto = photos[selectedPhotoIdx]?.photo_url || pet.avatar_url || "";
  const showBio = !!pet.bio && !pet.bio.startsWith("(Phase D サンプル");

  // 年齢計算
  let ageText = "";
  if (pet.birthday) {
    const bd = new Date(pet.birthday);
    const now = new Date();
    const years = now.getFullYear() - bd.getFullYear();
    const m = now.getMonth() - bd.getMonth();
    const isBeforeBirthday = m < 0 || (m === 0 && now.getDate() < bd.getDate());
    const ageYears = isBeforeBirthday ? years - 1 : years;
    if (ageYears > 0) ageText = `${ageYears}歳`;
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* 戻るボタン (owner のプロフィールへ) */}
      {owner && (
        <button
          onClick={() => navigate(`/profile/${owner.id}`)}
          style={{
            background: "none",
            border: "none",
            color: C.warmGray,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: "10px 0",
            marginBottom: 8,
            fontFamily: "inherit",
            minHeight: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← {owner.display_name} のプロフィールへ
        </button>
      )}

      {/* ヒーロー写真 */}
      <div style={{
        width: "100%",
        aspectRatio: "4 / 3",
        background: "#FFF5EB",
        borderRadius: 16,
        marginBottom: photos.length > 1 ? 12 : 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 96,
        position: "relative",
        opacity: isMemorial ? 0.94 : 1,
        overflow: "hidden",
      }}>
        {heroPhoto ? (
          <img src={heroPhoto} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : speciesEmoji}
        {isMemorial && (
          <div style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,255,255,0.95)",
            color: "#8B6F4E",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 14px",
            borderRadius: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            🌈 虹の橋を渡った子
          </div>
        )}
      </div>

      {/* サムネイル列 (2枚以上ある場合のみ) */}
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}>
          {photos.map((ph, i) => (
            <button
              key={ph.id}
              onClick={() => setSelectedPhotoIdx(i)}
              style={{
                flexShrink: 0,
                width: 64,
                height: 64,
                borderRadius: 10,
                overflow: "hidden",
                background: C.orangePale,
                cursor: "pointer",
                border: `2px solid ${i === selectedPhotoIdx ? C.orange : "transparent"}`,
                transition: "border 0.2s",
                padding: 0,
                fontFamily: "inherit",
              }}
              aria-label={`写真 ${i + 1}`}
            >
              <img src={ph.photo_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}

      {/* 基本情報カード */}
      <div style={{
        background: C.white,
        borderRadius: 16,
        padding: "20px",
        border: `1px solid ${C.border}`,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.dark, marginBottom: 6, lineHeight: 1.3, fontFamily: resolveFontFamily(owner?.font_pet_name) }}>
          {pet.name}
          {genderIcon && (
            <span style={{ color: C.warmGray, fontSize: 18, fontWeight: 600, marginLeft: 10 }}>{genderIcon}</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.8 }}>
          {speciesEmoji} {pet.breed || speciesLabel}
          {pet.birthday && (
            <> ・ {new Date(pet.birthday).getFullYear()}年生まれ{ageText && ` (${ageText})`}</>
          )}
        </div>
      </div>

      {/* 自己紹介 (うちの子の物語) */}
      {showBio && (
        <div style={{
          background: C.orangePale,
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 16,
          fontSize: 14,
          color: C.dark,
          lineHeight: 1.8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {pet.bio}
        </div>
      )}

      {/* 軌跡セクション (Phase D Phase 2 後半で taken_at タイムライン詳細実装) */}
      <div style={{
        background: C.white,
        borderRadius: 14,
        padding: "24px 20px",
        border: `1px dashed ${C.border}`,
        marginBottom: 16,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
          📜 うちの子の軌跡
        </div>
        <div style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.7 }}>
          {photos.length > 0
            ? `これまでの ${photos.length} 枚の記録を、もうすぐここに。`
            : "写真とともに、これまでの記録をここに残せるようになります。"}
        </div>
      </div>

      {/* 依頼書 #136 B1 Step 2 (2026/6/8): 健康のきろく (飼い主専用 / 設計憲法 6箇条 厳守)
          - 記録 + 可視化のみ / 診断・助言・自動判定・公開流出 一切なし
          - RLS で飼い主のみアクセス / フロント側で currentUserId === pet.owner_id でも二重ガード */}
      {currentUserId && pet.owner_id === currentUserId && (
        <div style={{ marginBottom: 16 }}>
          {/* セクションヘッダー */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 6, letterSpacing: "0.04em" }}>
              📋 健康のきろく
            </div>
            <div style={{ fontSize: 11, color: C.warmGray, lineHeight: 1.7 }}>
              あなた専用 — このページは飼い主にしか見えません
            </div>
          </div>

          {/* 獣医師相談 定型文 (設計憲法 #6) */}
          <div style={{ background: "#FFF8E1", border: "1px solid #F5D680", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#7A5C00", lineHeight: 1.7 }}>
            ⚠️ 体調の急変や気になる症状がある場合は、必ず獣医師にご相談ください。Qocca は記録の保存・可視化のみを行います。
          </div>

          {hrError && (
            <div style={{ background: C.redPale, color: C.red, padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠️ {hrError}</div>
          )}

          {/* 2 カード レイアウト: 体重 / 通院 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>

            {/* 体重カード */}
            <div style={{ background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>⚖️ 体重 ({weights.length})</div>
                <button onClick={() => setShowWeightForm(!showWeightForm)} style={{ background: showWeightForm ? C.lightGray : C.orange, color: showWeightForm ? C.dark : "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {showWeightForm ? "閉じる" : "+ 記録する"}
                </button>
              </div>
              {showWeightForm && (
                <div style={{ background: C.lightGray, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }} />
                    <input type="number" inputMode="decimal" step="0.1" min="0.1" max="199.9" value={wKg} onChange={(e) => setWKg(e.target.value)} placeholder="体重 (kg)" style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }} />
                  </div>
                  <input type="text" value={wMemo} onChange={(e) => setWMemo(e.target.value)} maxLength={100} placeholder="メモ (任意・100文字以内)" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <button onClick={handleAddWeight} disabled={hrSaving} style={{ width: "100%", padding: "9px", background: hrSaving ? C.warmGray : C.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: hrSaving ? "wait" : "pointer", fontFamily: "inherit" }}>
                    {hrSaving ? "保存中..." : "💾 記録する"}
                  </button>
                </div>
              )}
              {/* 依頼書 #136 B1 Step 3 (2026/6/8): 体重推移グラフ (SVG / 2件以上で表示 / 過去並列のみ・判定なし) */}
              {weights.length >= 2 && (() => {
                const sorted = [...weights].slice(0, 10).reverse(); // ASC
                const vals = sorted.map(d => Number(d.weight_kg));
                const max = Math.max(...vals);
                const min = Math.min(...vals);
                const range = Math.max(max - min, 0.1);
                const yMin = min - range * 0.15;
                const yMax = max + range * 0.15;
                const W = 280, H = 80;
                const points = sorted.map((d, i) => ({
                  x: sorted.length === 1 ? W / 2 : (i / (sorted.length - 1)) * W,
                  y: H - ((Number(d.weight_kg) - yMin) / (yMax - yMin)) * H,
                  ...d,
                }));
                const pathD = points.map((p, i) => (i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)).join(" ");
                const first = sorted[0], last = sorted[sorted.length - 1];
                return (
                  <div style={{ background: C.cream, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 4 }}>📈 直近 {sorted.length} 件の推移 (過去並列・判定なし)</div>
                    <svg viewBox={`0 0 ${W} ${H + 18}`} style={{ width: "100%", height: 96, display: "block" }} preserveAspectRatio="none" role="img" aria-label="体重推移グラフ">
                      <path d={pathD} stroke={C.orange} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={C.orange} />
                      ))}
                      <text x={0} y={H + 14} fill={C.warmGray} fontSize="9">{first.recorded_at.slice(5)} {first.weight_kg}kg</text>
                      <text x={W} y={H + 14} fill={C.warmGray} fontSize="9" textAnchor="end">{last.recorded_at.slice(5)} {last.weight_kg}kg</text>
                    </svg>
                  </div>
                );
              })()}
              {weights.length === 0 ? (
                <div style={{ fontSize: 12, color: C.warmGray, textAlign: "center", padding: 16 }}>まだ記録がありません</div>
              ) : (
                <div>
                  {weights.slice(0, 10).map((w) => (
                    <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: C.warmGray, fontSize: 11, marginRight: 8 }}>{w.recorded_at}</span>
                        <span style={{ color: C.dark, fontWeight: 700 }}>{w.weight_kg} kg</span>
                        {w.memo && <span style={{ color: C.warmGray, fontSize: 11, marginLeft: 8 }}>· {w.memo}</span>}
                      </div>
                      <button onClick={() => handleDeleteWeight(w.id)} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 14, cursor: "pointer", padding: 4 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 依頼書 #136 B1 Step 4 (2026/6/8): 時系列タイムライン (体重 + 通院 を merge) */}
            {(weights.length > 0 || clinicVisits.length > 0) && (() => {
              const merged: Array<{ type: 'w' | 'c'; date: string; key: string; line1: string; line2?: string }> = [];
              weights.forEach(w => merged.push({ type: 'w', date: w.recorded_at, key: `w-${w.id}`, line1: `⚖️ ${w.weight_kg} kg`, line2: w.memo || undefined }));
              clinicVisits.forEach(c => merged.push({ type: 'c', date: c.visited_at, key: `c-${c.id}`,
                line1: `🏥 ${c.clinic_name || "(病院名なし)"}${c.reason ? ` · ${c.reason}` : ""}`,
                line2: c.memo || undefined }));
              merged.sort((a, b) => b.date.localeCompare(a.date)); // DESC
              const top = merged.slice(0, 30);
              return (
                <div style={{ background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>📜 時系列 ({merged.length})</div>
                  <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 10 }}>体重と通院を時系列で並べた振り返り (飼い主専用 / 判定なし)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {top.map((e) => (
                      <div key={e.key} style={{
                        display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px",
                        background: e.type === 'c' ? "#FFF8E7" : C.cream, borderRadius: 8,
                        borderLeft: `2px solid ${e.type === 'c' ? "#D9B888" : C.orangeLight}`,
                      }}>
                        <div style={{ fontSize: 10, color: C.warmGray, minWidth: 56, fontFamily: "monospace" }}>{e.date.slice(5)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: C.dark, fontWeight: 600 }}>{e.line1}</div>
                          {e.line2 && <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{e.line2}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {merged.length > 30 && (
                    <div style={{ fontSize: 10, color: C.warmGray, textAlign: "center", marginTop: 8 }}>...直近 30 件のみ表示</div>
                  )}
                </div>
              );
            })()}

            {/* 通院カード */}
            <div style={{ background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>🏥 通院 ({clinicVisits.length})</div>
                <button onClick={() => setShowClinicForm(!showClinicForm)} style={{ background: showClinicForm ? C.lightGray : C.orange, color: showClinicForm ? C.dark : "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {showClinicForm ? "閉じる" : "+ 記録する"}
                </button>
              </div>
              {showClinicForm && (
                <div style={{ background: C.lightGray, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <input type="text" value={cName} onChange={(e) => setCName(e.target.value)} maxLength={50} placeholder="病院名 (任意)" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <input type="text" value={cReason} onChange={(e) => setCReason(e.target.value)} maxLength={50} placeholder="理由 (定期検診/ワクチン/その他)" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <input type="text" value={cMemo} onChange={(e) => setCMemo(e.target.value)} maxLength={200} placeholder="メモ (任意・200文字以内)" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <button onClick={handleAddClinic} disabled={hrSaving} style={{ width: "100%", padding: "9px", background: hrSaving ? C.warmGray : C.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: hrSaving ? "wait" : "pointer", fontFamily: "inherit" }}>
                    {hrSaving ? "保存中..." : "💾 記録する"}
                  </button>
                </div>
              )}
              {clinicVisits.length === 0 ? (
                <div style={{ fontSize: 12, color: C.warmGray, textAlign: "center", padding: 16 }}>まだ記録がありません</div>
              ) : (
                <div>
                  {clinicVisits.slice(0, 10).map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: C.warmGray, fontSize: 11, marginBottom: 2 }}>{c.visited_at}</div>
                        <div style={{ color: C.dark, fontWeight: 700, fontSize: 13 }}>{c.clinic_name || "(病院名なし)"}{c.reason ? ` · ${c.reason}` : ""}</div>
                        {c.memo && <div style={{ color: C.warmGray, fontSize: 11, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.memo}</div>}
                      </div>
                      <button onClick={() => handleDeleteClinic(c.id)} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 14, cursor: "pointer", padding: 4, marginLeft: 8 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Phase D: /profile/me — ログイン中ユーザの公開プロフィールへリダイレクト
const ProfileMeRedirect: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate(`/profile/${user.id}`, { replace: true });
      } else {
        const returnTo = encodeURIComponent("/profile/me");
        navigate(`/login?returnTo=${returnTo}`, { replace: true });
      }
    })();
  }, [navigate]);
  return <div style={{ padding: 40, textAlign: "center", color: C.warmGray, fontSize: 13 }}>読み込み中...</div>;
};

// ============================================================================
// UpdatePasswordPage (依頼書 #138 タスク2 Step 2, 2026/6/9)
// パスワード再設定リンクを受ける専用ルート (/update-password)
// 設計憲法:
//   1. isRecovery=true (recovery メール経由) のみ新パスワード入力を許可
//   2. 通常ログイン中のユーザーが直接 URL を叩いてもエラー画面 (=自分のパスワードを書き換えできない)
//   3. 成功時は signOut → /login へ navigate (新パスワードで再ログイン)
//   4. Editorial Documentary トーン
// ============================================================================
const UpdatePasswordPage = () => {
  const navigate = useNavigate();
  const { isRecovery, user, updatePassword, signOut } = useAuth() as any;
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setErrMsg("");
    if (pass.length < 6) { setErrMsg("パスワードは 6文字以上で入力してください"); return; }
    if (pass !== pass2) { setErrMsg("確認用パスワードが一致しません"); return; }
    setSubmitting(true);
    const { error } = await updatePassword(pass);
    setSubmitting(false);
    if (error) { setErrMsg(error.message || "パスワード変更に失敗しました"); return; }
    setSuccess(true);
    // 安全のため signOut してログイン画面へ
    setTimeout(async () => {
      await signOut();
      navigate("/?page=login");
    }, 1800);
  };

  // ガード: isRecovery=false かつ user=非ログイン → 無効アクセス
  // recovery 経由でない通常ログイン中ユーザーも はじく (= 自分のパスワードを誤って書き換えできない)
  if (!isRecovery) {
    return (
      <div style={{ paddingTop: 60, minHeight: "100vh", background: "#FAF5EC", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
        <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 18, padding: "32px 22px", textAlign: "center", border: `1px solid ${C.border}`, boxShadow: "0 4px 18px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
          <div style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 10, letterSpacing: "0.04em" }}>
            無効なアクセスです
          </div>
          <div style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.85, marginBottom: 22 }}>
            このページはメールで届いた<br />
            パスワード再設定リンクからのみ開けます。<br /><br />
            パスワードをお忘れの方は、ログイン画面の<br />
            「パスワードを忘れた方」からやり直してください。
          </div>
          <button onClick={() => navigate(user ? "/" : "/?page=login")} style={{ padding: "10px 22px", background: C.orange, color: "#fff", border: "none", borderRadius: 22, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 42 }}>
            {user ? "ホームへ戻る" : "ログイン画面へ"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 60, minHeight: "100vh", background: "#FAF5EC", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 18, padding: "32px 22px", border: `1px solid ${C.border}`, boxShadow: "0 4px 18px rgba(0,0,0,0.04)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          <div style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 8, letterSpacing: "0.04em" }}>
            新しいパスワードを設定
          </div>
          <div style={{ fontSize: 12.5, color: C.warmGray, lineHeight: 1.8 }}>
            6文字以上の新しいパスワードを<br />入力してください。
          </div>
        </div>

        {success ? (
          <div style={{ background: "#E8F5E9", color: "#2E7D32", padding: "18px 14px", borderRadius: 12, textAlign: "center", fontSize: 13, fontWeight: 700, lineHeight: 1.7 }}>
            ✅ パスワードを変更しました<br />
            <span style={{ fontSize: 11, fontWeight: 400, color: "#558B5C" }}>ログイン画面へ移動します...</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.dark, display: "block", marginBottom: 6 }}>新しいパスワード</label>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="6文字以上" autoComplete="new-password" style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}/>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.dark, display: "block", marginBottom: 6 }}>確認のためもう一度</label>
              <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="もう一度入力" autoComplete="new-password" style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}/>
            </div>
            {errMsg && (
              <div style={{ background: "#FFE4E1", color: "#A33C2E", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 14, lineHeight: 1.6 }}>⚠️ {errMsg}</div>
            )}
            <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: 13, background: submitting ? C.warmGray : C.orange, color: "#fff", border: "none", borderRadius: 24, fontSize: 14, fontWeight: 700, cursor: submitting ? "wait" : "pointer", fontFamily: "inherit", minHeight: 46 }}>
              {submitting ? "変更中..." : "パスワードを変更する"}
            </button>
            <div style={{ marginTop: 14, fontSize: 11, color: C.warmGray, textAlign: "center", lineHeight: 1.7 }}>
              変更後は安全のため自動でログアウトされます。<br />新パスワードで改めてログインしてください。
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── /redeem ページ (依頼書 #7 Phase A, 2026/5/25) ───────────────────────────
// CAMPFIRE クラファンバッカーがメールで受け取ったコードを引き換える
// redeem-crowdfunding-code Edge Function → RPC redeem_crowdfunding_code v2 呼び出し
const REDEEM_TIER_THEME: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  supporter_1000:   { color: "#42A5F5", bg: "#E3F2FD", icon: "🤝", label: "応援サポーター" },
  resident_3000:    { color: "#66BB6A", bg: "#E8F5E9", icon: "🏘️", label: "創業メンバー｜街の住民" },
  creator_8000:     { color: "#AB47BC", bg: "#F3E5F5", icon: "🎨", label: "創業クリエイター" },
  family_15000:     { color: "#F5A94A", bg: "#FFF3E0", icon: "🐾", label: "創業ファミリー" },
  mayor_30000:      { color: "#FFA000", bg: "#FFF8E1", icon: "👑", label: "街の首長" },
  ark_patron_50000: { color: "#26A69A", bg: "#E0F2F1", icon: "🏥", label: "動物福祉パトロン" },
  corporate_300000: { color: "#5C6BC0", bg: "#E8EAF6", icon: "🏢", label: "法人スポンサー" },
};

const RedeemPage = ({ setPage }: { setPage: (p: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (user === null) {
      navigate("/login?returnTo=" + encodeURIComponent("/redeem"), { replace: true });
    }
  }, [user, navigate]);

  const handleRedeem = async () => {
    setError("");
    setResult(null);
    if (!code.trim()) { setError("コードを入力してください"); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("ログインが必要です"); setLoading(false); return; }
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/redeem-crowdfunding-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code: code.trim() }),
        }
      );
      const data = await res.json();
      if (!data?.success) {
        setError(data?.message || "コードの引き換えに失敗しました");
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError("通信エラー: " + (err?.message || String(err)));
    }
    setLoading(false);
  };

  const theme = result?.reward_id ? REDEEM_TIER_THEME[result.reward_id] : null;

  if (!user) return <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.cream, paddingTop: 64, paddingBottom: 80, fontFamily: "'Noto Sans JP',sans-serif" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, margin: "0 0 6px" }}>クラファン特典を受け取る</h1>
          <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.6, margin: 0 }}>
            CAMPFIRE のメールで届いた引き換えコードを入力してや🐾<br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>創業期住民として、Qocca の街にようこそ🌅</span>
          </p>
        </div>

        {!result && (
          <div style={{ background: C.white, borderRadius: 20, padding: 24, boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              引き換えコード
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="QOCCA-XXXX-XXXX-XXXX"
              maxLength={32}
              style={{
                width: "100%", padding: "14px 16px", fontSize: 16, letterSpacing: 1.5,
                fontFamily: "monospace", border: `2px solid ${C.border}`, borderRadius: 12,
                outline: "none", boxSizing: "border-box", textAlign: "center", fontWeight: 700,
              }}
            />
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6, textAlign: "center" }}>
              大文字小文字どっちで入力しても OK・空白は無視
            </div>

            {error && (
              <div style={{ marginTop: 16, padding: "12px 14px", background: "#FFEBEE", color: "#C62828", borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleRedeem}
              disabled={loading || !code.trim()}
              style={{
                width: "100%", marginTop: 20, padding: "16px", fontSize: 15, fontWeight: 800,
                background: loading || !code.trim() ? C.warmGray : C.orange,
                color: "#fff", border: "none", borderRadius: 12,
                cursor: loading || !code.trim() ? "wait" : "pointer", fontFamily: "inherit",
                transition: "background 0.2s",
              }}
            >
              {loading ? "確認中..." : "🎉 特典を受け取る"}
            </button>

            <div style={{ marginTop: 20, padding: 12, background: C.cream, borderRadius: 10, fontSize: 11, color: C.warmGray, lineHeight: 1.7 }}>
              💡 <strong style={{ color: C.dark }}>困った時は:</strong><br />
              ・コードが届いてない → CAMPFIRE のメッセージ機能でお問い合わせください<br />
              ・「既に使用されています」と出る → 既に引き換え済みです。マイページで特典をご確認ください<br />
              ・その他 → <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => navigate("/contact")}>お問い合わせ</span>
            </div>
          </div>
        )}

        {result && theme && (
          <div style={{ background: C.white, borderRadius: 20, padding: 28, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 12, animation: "qoccaBounce 0.6s ease" }}>{theme.icon}</div>
            <div style={{ background: theme.bg, color: theme.color, display: "inline-block", padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 800, marginBottom: 14 }}>
              {theme.label}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: C.dark, margin: "0 0 8px" }}>
              ありがとうございます🌅
            </h2>
            <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.7, margin: "0 0 20px" }}>
              <strong style={{ color: C.dark }}>{result.reward_name}</strong> の特典を受け取りました。<br />
              Qocca の街は、あなたという住民を得て<br />一歩深くなりました🐾
            </p>

            {/* 受け取った特典リスト */}
            <div style={{ background: C.cream, borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 10 }}>✨ 受け取った特典</div>
              {(result.benefits || []).filter((b: string) => !b.startsWith("badge:") && b !== "founding_creator" && b !== "founding_mayor" && b !== "founding_fee_rate_3" && b !== "early_supporter").map((b: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: C.dark, padding: "4px 0", borderBottom: i < (result.benefits.length - 1) ? `1px solid ${C.border}` : "none" }}>
                  ・{b}
                </div>
              ))}
              {(result.newly_granted_badges || []).length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 0 0", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>🏅 獲得バッジ</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {result.newly_granted_badges.map((b: string) => (
                      <span key={b} style={{ background: theme.bg, color: theme.color, padding: "4px 10px", borderRadius: 14, fontSize: 11, fontWeight: 700 }}>
                        {b.replace("crowdfund-", "")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(result.profile_flags_set || []).length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 0 0", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>⭐ プロフィール特典</div>
                  {result.profile_flags_set.includes("is_founding_creator") && (
                    <div style={{ fontSize: 12, color: C.dark, marginTop: 2 }}>🎨 創業クリエイター認定 (事業が存続する限り手数料 3%)</div>
                  )}
                  {result.profile_flags_set.includes("is_founding_mayor") && (
                    <div style={{ fontSize: 12, color: C.dark, marginTop: 2 }}>👑 創業首長認定</div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => { setPage("mypage"); navigate("/mypage"); }}
              style={{ width: "100%", padding: "14px", background: C.orange, color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}
            >
              🏠 マイページで確認
            </button>
            <button
              onClick={() => { setResult(null); setCode(""); }}
              style={{ width: "100%", padding: "12px", background: "transparent", color: C.warmGray, border: `1px solid ${C.border}`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              別のコードを引き換える
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes qoccaBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }`}</style>
    </div>
  );
};

// ============================================================================
// PostsTab (依頼書 #38 Phase C-E)
// ギャラリー / ブログ 投稿の新規作成・編集・削除
// 戦略書 §1.3 多様性: pet_categories マスター (13カテゴリ) からセレクト
// "住める速度を超えない" UX: 急かさない・キャンセル可能・削除確認
// ============================================================================
type PetCategory = { slug: string; label_jp: string; icon: string };

const PostsTab = () => {
  const { user } = useAuth();
  const [myGallery, setMyGallery] = useState<any[]>([]);
  const [myBlog, setMyBlog] = useState<any[]>([]);
  const [petCategories, setPetCategories] = useState<PetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "compose-gallery" | "compose-blog" | "edit-gallery" | "edit-blog">("list");
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "gallery" | "blog"; id: string; title: string } | null>(null);
  const [activeSection, setActiveSection] = useState<"gallery" | "blog">("gallery");

  const loadAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [galRes, blogRes, catRes] = await Promise.all([
      supabase.from("gallery_posts").select("*").eq("user_id", user.id).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("blog_posts").select("*").eq("author_id", user.id).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("pet_categories").select("slug, label_jp, icon").eq("is_active", true).order("display_order"),
    ]);
    setMyGallery(galRes.data || []);
    setMyBlog(blogRes.data || []);
    setPetCategories(catRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [user?.id]);

  const handleSoftDelete = async () => {
    if (!confirmDelete) return;
    const table = confirmDelete.type === "gallery" ? "gallery_posts" : "blog_posts";
    await supabase.from(table).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", confirmDelete.id);
    setConfirmDelete(null);
    loadAll();
  };

  const startEdit = (post: any, type: "gallery" | "blog") => {
    setEditing(post);
    setMode(type === "gallery" ? "edit-gallery" : "edit-blog");
  };

  if (!user) {
    return <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>ログインしてください</div>;
  }

  // ── 投稿モーダル / 編集モーダル ──
  if (mode === "compose-gallery" || mode === "edit-gallery") {
    return (
      <GalleryComposeForm
        user={user}
        petCategories={petCategories}
        editing={mode === "edit-gallery" ? editing : null}
        onClose={() => { setMode("list"); setEditing(null); loadAll(); }}
      />
    );
  }
  if (mode === "compose-blog" || mode === "edit-blog") {
    return (
      <BlogComposeForm
        user={user}
        editing={mode === "edit-blog" ? editing : null}
        onClose={() => { setMode("list"); setEditing(null); loadAll(); }}
      />
    );
  }

  // ── 一覧画面 ──
  const card: React.CSSProperties = { background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 };
  const btn = (bg: string, color = "#fff"): React.CSSProperties => ({
    padding: "10px 16px", background: bg, color, border: "none", borderRadius: 10,
    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 40,
  });

  return (
    <div>
      {/* 投稿ボタン 2列 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode("compose-gallery")} style={{ ...btn(C.orange), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📸 ギャラリー投稿
        </button>
        <button onClick={() => setMode("compose-blog")} style={{ ...btn("#4A90E2"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📝 ブログ投稿
        </button>
      </div>

      {/* セクション切替 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: `2px solid ${C.border}` }}>
        {[
          { id: "gallery" as const, label: `📸 ギャラリー (${myGallery.length})` },
          { id: "blog" as const,    label: `📝 ブログ (${myBlog.length})` },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            padding: "10px 14px", background: activeSection === s.id ? C.orange : "transparent",
            color: activeSection === s.id ? "#fff" : C.warmGray, border: "none",
            borderRadius: "10px 10px 0 0", fontWeight: 700, fontSize: 12, fontFamily: "inherit",
            cursor: "pointer", borderBottom: activeSection === s.id ? `3px solid ${C.orange}` : "none", marginBottom: -2,
          }}>{s.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>読み込み中…</div>
      ) : activeSection === "gallery" ? (
        myGallery.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 32, color: C.warmGray, fontSize: 13 }}>
            まだギャラリーへの投稿はありません<br/>
            <span style={{ fontSize: 11 }}>上の「📸 ギャラリー投稿」から、うちの子の一枚を置いてください</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {myGallery.map(g => (
              <div key={g.id} style={card}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {g.image_url && (
                    <img src={g.image_url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}/>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 2 }}>
                      {g.pet_type && <>🐾 {g.pet_type}</>}
                      {g.pet_name && <> · {g.pet_name}</>}
                      {" "}· {new Date(g.created_at).toLocaleDateString("ja-JP")}
                    </div>
                    <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {g.caption || <span style={{ color: C.warmGray }}>(キャプションなし)</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(g, "gallery")} style={btn(C.cream, C.dark)}>✏️ 編集</button>
                      <button onClick={() => setConfirmDelete({ type: "gallery", id: g.id, title: g.pet_name || "投稿" })}
                        style={btn("#FFEBEE", C.red)}>🗑️ 削除</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        myBlog.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 32, color: C.warmGray, fontSize: 13 }}>
            まだブログへの投稿はありません<br/>
            <span style={{ fontSize: 11 }}>上の「📝 ブログ投稿」から、書きはじめてください</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {myBlog.map(b => (
              <div key={b.id} style={card}>
                {b.cover_image_url && (
                  <img src={b.cover_image_url} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, marginBottom: 10 }}/>
                )}
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 4 }}>
                  {b.title || "(タイトルなし)"}
                </div>
                <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 8 }}>
                  {b.published ? "🌅 公開中" : "📝 下書き"}
                  {b.category && <> · {b.category}</>}
                  {" "}· {new Date(b.created_at).toLocaleDateString("ja-JP")}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(b, "blog")} style={btn(C.cream, C.dark)}>✏️ 編集</button>
                  <button onClick={() => setConfirmDelete({ type: "blog", id: b.id, title: b.title || "ブログ" })}
                    style={btn("#FFEBEE", C.red)}>🗑️ 削除</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 削除確認ダイアログ (急かさない・取り消せない旨を明示) */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.white, borderRadius: 18, padding: 24, maxWidth: 380, width: "100%",
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.dark, marginBottom: 10 }}>
              本当に削除しますか?
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, marginBottom: 20 }}>
              「{confirmDelete.title}」を削除します。<br/>
              <span style={{ color: C.red, fontWeight: 700 }}>削除すると元に戻せません。</span><br/>
              <span style={{ fontSize: 11, color: C.warmGray }}>急ぐ必要はないので、もう一度ゆっくり考えてください。</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ ...btn(C.cream, C.dark), flex: 1 }}>キャンセル</button>
              <button onClick={handleSoftDelete} style={{ ...btn(C.red), flex: 1 }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// === ギャラリー投稿/編集フォーム ===
const GalleryComposeForm = ({ user, petCategories, editing, onClose }: any) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>(editing?.image_url || "");
  const [caption, setCaption] = useState<string>(editing?.caption || "");
  const [petType, setPetType] = useState<string>(editing?.pet_type || "");
  const [petName, setPetName] = useState<string>(editing?.pet_name || "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editing;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setImageFile(f); setPreview(URL.createObjectURL(f)); }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!isEdit && !imageFile) { alert("画像を選んでください"); return; }
    setBusy(true);
    let imageUrl = editing?.image_url || "";
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gallery-images").upload(path, imageFile);
      if (upErr) { alert("画像アップロード失敗: " + upErr.message); setBusy(false); return; }
      const { data } = supabase.storage.from("gallery-images").getPublicUrl(path);
      imageUrl = data.publicUrl;
    }

    if (isEdit) {
      await supabase.from("gallery_posts").update({
        caption, pet_type: petType || null, pet_name: petName || null,
        ...(imageFile ? { image_url: imageUrl } : {}),
      }).eq("id", editing.id);
    } else {
      await supabase.from("gallery_posts").insert({
        user_id: user.id, image_url: imageUrl, caption,
        pet_type: petType || null, pet_name: petName || null,
      });
    }
    setBusy(false);
    onClose();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 14, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>← キャンセル</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.dark }}>{isEdit ? "📸 ギャラリーを編集" : "📸 ギャラリーに投稿"}</div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }}/>
      {preview ? (
        <div style={{ marginBottom: 14 }}>
          <img src={preview} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 320, objectFit: "cover", background: "#000" }}/>
          <button onClick={() => fileRef.current?.click()} style={{ marginTop: 6, fontSize: 12, color: C.orange, background: "none", border: "none", cursor: "pointer" }}>📷 画像を変更</button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} style={{
          width: "100%", padding: "40px 20px", border: `2px dashed ${C.border}`, borderRadius: 14,
          background: C.cream, cursor: "pointer", marginBottom: 14, textAlign: "center", fontFamily: "inherit",
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
          <div style={{ fontSize: 13, color: C.warmGray }}>タップして写真を選ぶ</div>
        </button>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 4 }}>うちの子の名前 (任意)</label>
        <input value={petName} onChange={e => setPetName(e.target.value)} placeholder="例: まろん"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}/>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 6 }}>
          うちの子の種類 (任意)
          <span style={{ fontSize: 11, color: C.warmGray, fontWeight: 400 }}> · 13 種類から</span>
        </label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {petCategories.map((c: PetCategory) => (
            <button key={c.slug} onClick={() => setPetType(petType === c.slug ? "" : c.slug)} style={{
              padding: "6px 10px", background: petType === c.slug ? C.orange : C.white,
              color: petType === c.slug ? "#fff" : C.warmGray,
              border: `1.5px solid ${petType === c.slug ? C.orange : C.border}`, borderRadius: 16,
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{c.icon} {c.label_jp}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 4 }}>キャプション</label>
        <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="うちの子のエピソードを書いてね🐾" rows={4} maxLength={500}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}/>
        <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 2 }}>{caption.length} / 500</div>
      </div>

      <button onClick={handleSubmit} disabled={busy || (!isEdit && !imageFile)} style={{
        width: "100%", padding: 14, background: busy ? C.warmGray : C.orange, color: "#fff",
        border: "none", borderRadius: 12, fontWeight: 800, fontSize: 15,
        cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
      }}>{busy ? "送信中…" : isEdit ? "💾 変更を保存" : "🐾 投稿する"}</button>
    </div>
  );
};

// === ブログ投稿/編集フォーム ===
const BlogComposeForm = ({ user, editing, onClose }: any) => {
  const [title, setTitle] = useState<string>(editing?.title || "");
  const [content, setContent] = useState<string>(editing?.content || "");
  const [category, setCategory] = useState<string>(editing?.category || "diary");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(editing?.cover_image_url || "");
  const [published, setPublished] = useState<boolean>(editing?.published ?? false);
  const [busy, setBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editing;

  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!title.trim()) { alert("タイトルを入力してください"); return; }
    if (!content.trim()) { alert("本文を入力してください"); return; }
    setBusy(true);
    let coverUrl = editing?.cover_image_url || "";
    if (coverFile) {
      const ext = coverFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("blog-images").upload(path, coverFile);
      if (upErr) { alert("画像アップロード失敗: " + upErr.message); setBusy(false); return; }
      const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
      coverUrl = data.publicUrl;
    }
    if (isEdit) {
      await supabase.from("blog_posts").update({
        title, content, category, published,
        ...(coverFile ? { cover_image_url: coverUrl } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", editing.id);
    } else {
      await supabase.from("blog_posts").insert({
        author_id: user.id, title, content, category, published,
        cover_image_url: coverUrl, ai_generated: false,
      });
    }
    setBusy(false);
    onClose();
  };

  const BLOG_CATEGORIES = [
    { slug: "diary",     icon: "📔", label: "うちの子日記" },
    { slug: "tips",      icon: "💡", label: "暮らしのコツ" },
    { slug: "review",    icon: "⭐", label: "レビュー" },
    { slug: "memorial",  icon: "🌸", label: "そらの子へ" },
    { slug: "other",     icon: "📝", label: "その他" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 14, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>← キャンセル</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.dark }}>{isEdit ? "📝 ブログを編集" : "📝 ブログに投稿"}</div>
      </div>

      <input ref={coverRef} type="file" accept="image/*" onChange={handleCover} style={{ display: "none" }}/>
      {coverPreview ? (
        <div style={{ marginBottom: 14 }}>
          <img src={coverPreview} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover" }}/>
          <button onClick={() => coverRef.current?.click()} style={{ marginTop: 6, fontSize: 12, color: C.orange, background: "none", border: "none", cursor: "pointer" }}>📷 カバー画像を変更</button>
        </div>
      ) : (
        <button onClick={() => coverRef.current?.click()} style={{
          width: "100%", padding: "32px 20px", border: `2px dashed ${C.border}`, borderRadius: 14,
          background: C.cream, cursor: "pointer", marginBottom: 14, textAlign: "center", fontFamily: "inherit",
        }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🖼️</div>
          <div style={{ fontSize: 12, color: C.warmGray }}>カバー画像を選ぶ (任意)</div>
        </button>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 4 }}>タイトル *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 雨の日のまろん"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}/>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 6 }}>カテゴリ</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {BLOG_CATEGORIES.map(c => (
            <button key={c.slug} onClick={() => setCategory(c.slug)} style={{
              padding: "6px 10px", background: category === c.slug ? C.orange : C.white,
              color: category === c.slug ? "#fff" : C.warmGray,
              border: `1.5px solid ${category === c.slug ? C.orange : C.border}`, borderRadius: 16,
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{c.icon} {c.label}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 4 }}>本文 *</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="思いを書いてね…" rows={10}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7 }}/>
      </div>

      <div style={{ marginBottom: 18, padding: 12, background: C.cream, borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="blog-published" checked={published} onChange={e => setPublished(e.target.checked)} style={{ width: 18, height: 18, cursor: "pointer" }}/>
        <label htmlFor="blog-published" style={{ fontSize: 13, color: C.dark, cursor: "pointer" }}>
          🌅 すぐ公開する {!published && <span style={{ fontSize: 11, color: C.warmGray }}>(チェックを外すと下書き保存)</span>}
        </label>
      </div>

      <button onClick={handleSubmit} disabled={busy} style={{
        width: "100%", padding: 14, background: busy ? C.warmGray : "#4A90E2", color: "#fff",
        border: "none", borderRadius: 12, fontWeight: 800, fontSize: 15,
        cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
      }}>{busy ? "送信中…" : isEdit ? "💾 変更を保存" : (published ? "🌅 公開する" : "📝 下書き保存")}</button>
    </div>
  );
};

const MyPage = ({ setPage }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("profile");
  const [isPC, setIsPC] = useState(typeof window !== "undefined" ? window.innerWidth >= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsPC(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleOpenDM = () => setTab("messages");
    window.addEventListener("openDM", handleOpenDM);
    return () => window.removeEventListener("openDM", handleOpenDM);
  }, []);
  useEffect(() => {
    // Sidebar の「管理する」等から特定タブを強制で開く汎用イベント
    const handleOpenTab = (e: any) => {
      const t = e?.detail?.tab;
      if (typeof t === "string" && t.length > 0) setTab(t);
    };
    window.addEventListener("openMyPageTab", handleOpenTab);
    return () => window.removeEventListener("openMyPageTab", handleOpenTab);
  }, []);
  // 暮らしの空気 (v3.2 第23章): MyPage 内だけの "模様替え"
  // - 初回ログイン時に DB から読み込み (default: atatakai)
  // - 切替時に即反映 (保存ボタンなし)、DB は非同期で更新
  const [atmosphereId, setAtmosphereId] = useState<string>("atatakai");
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("home_atmosphere")
        .eq("id", user.id)
        .single();
      if (data?.home_atmosphere) setAtmosphereId(data.home_atmosphere);
    })();
  }, [user?.id]);
  const atmosphere = findAtmosphere(atmosphereId);
  const changeAtmosphere = async (id: string) => {
    setAtmosphereId(id); // 即反映 (optimistic)
    if (!user?.id) return;
    // DB は非同期で更新 (失敗してもUIは戻さない、次回ログイン時に正しい値が読まれる)
    await supabase.from("profiles").update({ home_atmosphere: id }).eq("id", user.id);
  };
  const [editOpen, setEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Phase D Phase 2 (5/22): うちの子セクション state
  const [petEditOpen, setPetEditOpen] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [myPets, setMyPets] = useState<Array<{
    id: string; name: string; species: string; breed?: string | null;
    birthday?: string | null; bio?: string | null; avatar_url?: string | null;
    gender?: string | null; status: string;
  }>>([]);
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; bio?: string; created_at?: string; early_supporter_expires_at?: string | null; is_founding_creator?: boolean; is_founding_mayor?: boolean; founding_creator_fee_rate?: number | null; font_display_name?: string | null; font_bio?: string | null; font_one_word?: string | null; font_pet_name?: string | null; font_blog_title?: string | null } | null>(null);
  // 依頼書 #7 Phase A.2: クラファン引き換え済みコード + 未受け取りバッカー
  const [crowdfundCodes, setCrowdfundCodes] = useState<any[]>([]);
  const [crowdfundPendingBackers, setCrowdfundPendingBackers] = useState<any[]>([]);
  const [stats, setStats] = useState<{ listings: number; completed: number; avgRating: number | null }>({ listings: 0, completed: 0, avgRating: null });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio, created_at, early_supporter_expires_at, is_founding_creator, is_founding_mayor, founding_creator_fee_rate, font_display_name, font_bio, font_one_word, font_pet_name, font_blog_title")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    })();
  }, [user?.id, refreshKey]);
  // 依頼書 #7 Phase A.2 (5/25): クラファン引き換え済みコード + 未受け取り backers 取得
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [codesRes, pendingRes] = await Promise.all([
        // 引き換え済み: redeemed_by_user_id = user.id
        supabase
          .from("crowdfunding_codes")
          .select("id, code, reward_id, redeemed_at, backer_id, crowdfunding_rewards (id, name, price_jpy, benefits)")
          .eq("redeemed_by_user_id", user.id)
          .order("redeemed_at", { ascending: false }),
        // 未受け取り: backers.user_id = user.id AND status='pending' (Admin が紐付け済の場合のみ)
        supabase
          .from("crowdfunding_backers")
          .select("id, tier, amount, status, email")
          .eq("user_id", user.id)
          .eq("status", "pending"),
      ]);
      setCrowdfundCodes(codesRes.data || []);
      setCrowdfundPendingBackers(pendingRes.data || []);
    })();
  }, [user?.id, refreshKey]);
  // Phase D Phase 2 (5/22): 自分の pets を取得 (active → memorial 順)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, species, breed, birthday, bio, avatar_url, gender, status, display_order")
        .eq("owner_id", user.id)
        .order("status", { ascending: true })
        .order("display_order", { ascending: true });
      setMyPets(data || []);
    })();
  }, [user?.id, refreshKey, petEditOpen]);
  useEffect(()=>{
    if (!user?.id) return;
    (async ()=>{
      const [listingsRes, ordersRes, reviewsRes] = await Promise.all([
        supabase.from("listings").select("id", { count:"exact", head:true }).eq("seller_id", user.id),
        supabase.from("orders").select("id", { count:"exact", head:true }).eq("seller_id", user.id).eq("status", "completed"),
        supabase.from("reviews").select("rating").eq("seller_id", user.id),
      ]);
      const ratings = (reviewsRes.data || []).map((r:{rating:number})=>r.rating);
      const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;
      setStats({
        listings: listingsRes.count || 0,
        completed: ordersRes.count || 0,
        avgRating: avg,
      });
    })();
  }, [user?.id, refreshKey]);

  // マイ活動カウント
  const [activity, setActivity] = useState<{ communities:number; events:number; gallery:number; blog:number; following:number; followers:number }>({ communities:0, events:0, gallery:0, blog:0, following:0, followers:0 });
  useEffect(()=>{
    if (!user?.id) return;
    (async ()=>{
      const [comm, ev, gal, bl, fwing, fwer] = await Promise.all([
        supabase.from("community_members").select("community_id", { count:"exact", head:true }).eq("user_id", user.id),
        supabase.from("events").select("id", { count:"exact", head:true }).eq("organizer_id", user.id),
        supabase.from("gallery_posts").select("id", { count:"exact", head:true }).eq("user_id", user.id),
        supabase.from("blog_posts").select("id", { count:"exact", head:true }).eq("author_id", user.id),
        supabase.from("follows").select("following_id", { count:"exact", head:true }).eq("follower_id", user.id),
        supabase.from("follows").select("follower_id", { count:"exact", head:true }).eq("following_id", user.id),
      ]);
      setActivity({
        communities: comm.count || 0,
        events: ev.count || 0,
        gallery: gal.count || 0,
        blog: bl.count || 0,
        following: fwing.count || 0,
        followers: fwer.count || 0,
      });
    })();
  }, [user?.id, refreshKey]);

  const [activityModal, setActivityModal] = useState<string | null>(null);

  // 依頼書 #138 タスク1 (2026/6/9): 公開ページ URL 共有 (8eighty8eight さん DM 起点)
  // 出品クリエイターが Instagram に貼るための URL。/user/:userId 形式 (依頼書指定)。
  const publicProfileUrl = user?.id ? `https://www.qocca.pet/user/${user.id}` : "";
  const [copyToast, setCopyToast] = useState<"" | "ok" | "fail">("");
  const handleCopyPublicUrl = async () => {
    if (!publicProfileUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicProfileUrl);
        setCopyToast("ok");
      } else {
        // フォールバック (古い Safari 等): textarea + execCommand
        const ta = document.createElement("textarea");
        ta.value = publicProfileUrl;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        setCopyToast(ok ? "ok" : "fail");
      }
    } catch (_) {
      setCopyToast("fail");
    }
    setTimeout(() => setCopyToast(""), 2400);
  };
  const openPublicProfile = () => {
    if (publicProfileUrl && typeof window !== "undefined") {
      window.open(publicProfileUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (!user) return null;

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "ユーザー";
  const initial = displayName.charAt(0).toUpperCase();
  const provider = user?.app_metadata?.provider;
  const providerLabel = provider === "google" ? "Google" : provider === "twitter" ? "X" : "メール";

  const handleSignOut = async () => { await signOut(); setPage("home"); };

  // バッジ用の未読数（DBから取得、初期値0）
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0); // 受取確認待ちの注文数（購入者として）
  const [pendingSalesCount, setPendingSalesCount] = useState(0); // 対応待ちの販売（出品者として）

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // 受取確認待ち（自分が購入者でstatus=delivered）
      const { count: ordersCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", user.id)
        .eq("status", "delivered");
      setPendingOrdersCount(ordersCount || 0);

      // 対応待ちの販売（自分が出品者でstatus=workingまたはpending）
      const { count: salesCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .in("status", ["pending", "working"]);
      setPendingSalesCount(salesCount || 0);

      // 未読DM数（recipient_idが自分でis_read=false）
      const { count: dmCount } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
      setUnreadMsgs(dmCount || 0);
    })();
  }, [user?.id, refreshKey]);

  const tabs = [
    { id:"profile", icon:"👤", label:"プロフィール" },
    { id:"posts", icon:"📸", label:"投稿管理" }, // 依頼書 #38 Phase C-E
    { id:"listings", icon:"🐾", label:"マイ出品" },
    { id:"sales", icon:"🛍️", label:"販売管理", badge:pendingSalesCount },
    { id:"orders", icon:"📦", label:"注文履歴", badge:pendingOrdersCount },
    { id:"earnings", icon:"💰", label:"売上" },
    { id:"addresses", icon:"🏠", label:"配送先" },
    { id:"messages", icon:"💬", label:"メッセージ", badge:unreadMsgs },
    { id:"notifications", icon:"🔔", label:"通知", badge:unreadNotifs },
    { id:"support", icon:"🎧", label:"サポート" },
  ];

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:atmosphere.bg, padding:"80px 16px 40px", transition:"background 0.6s ease" }}>
      {/* 依頼書 #138 タスク1 (2026/6/9): コピー結果トースト (Editorial / fade in-out / 2.4s) */}
      {copyToast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          padding: "12px 22px", borderRadius: 24, fontSize: 13, fontWeight: 700,
          fontFamily: "inherit", zIndex: 9999,
          background: copyToast === "ok" ? "#FFF8E7" : "#FFE4E1",
          color: copyToast === "ok" ? "#7A5C00" : "#A33C2E",
          border: `1px solid ${copyToast === "ok" ? "#F5D680" : "#D9888C"}`,
          boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
          opacity: 0.98,
          maxWidth: "90vw", textAlign: "center", lineHeight: 1.5,
        }}>
          {copyToast === "ok" ? "🔗 公開ページのリンクをコピーしました。SNS にどうぞ。" : "コピーできませんでした。手動で URL をコピーしてください。"}
        </div>
      )}
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        {/* 依頼書 #138 タスク1 (2026/6/9): SNS 宣伝用 公開ページ共有導線 (8eighty8eight さん DM 起点)
            - 「自分の公開ページを見る」: 新規タブで /user/:userId を開く
            - 「リンクをコピー」: https://www.qocca.pet/user/:userId をクリップボードへ */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            onClick={openPublicProfile}
            title={publicProfileUrl}
            style={{
              padding: "10px 16px",
              background: C.white,
              border: `1.5px solid ${C.orange}`,
              borderRadius: 22,
              color: C.orange,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
            }}
          >
            🔗 自分の公開ページを見る
          </button>
          <button
            onClick={handleCopyPublicUrl}
            title={publicProfileUrl}
            style={{
              padding: "10px 16px",
              background: C.orange,
              border: `1.5px solid ${C.orange}`,
              borderRadius: 22,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
            }}
          >
            📋 リンクをコピー
          </button>
        </div>
        {/* Tab Navigation - レスポンシブ：スマホ2列(4行) / PC4列(2行) */}
        <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap:6, marginBottom:20 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"10px 8px", border:`1.5px solid ${tab===t.id?C.orange:C.border}`,
              borderRadius:12, background:tab===t.id?C.orangePale:C.white,
              color:tab===t.id?C.orange:C.warmGray, fontSize:12, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:5, position:"relative", minHeight:42
            }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>
              <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.label}</span>
              {t.badge > 0 && <span style={{ background:C.orange, color:"#fff", fontSize:9, fontWeight:800, padding:"1px 5px", borderRadius:8, minWidth:14, textAlign:"center", flexShrink:0 }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab==="profile" && (
          <>
            <div style={{ background:C.white, borderRadius:20, padding:"28px 20px", border:`1px solid ${C.border}`, textAlign:"center", marginBottom:20 }}>
              <div style={{ width:72, height:72, borderRadius:"50%", background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : C.orange, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:900, color:"#fff", margin:"0 auto 12px" }}>{!profile?.avatar_url && initial}</div>
              <div style={{ fontSize:18, fontWeight:700, color:C.dark, marginBottom:4, fontFamily: resolveFontFamily(profile?.font_display_name) }}>{displayName}</div>
              <div style={{ fontSize:13, color:C.warmGray, marginBottom:8 }}>{user?.email}</div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", background:C.orangePale, borderRadius:20, fontSize:11, fontWeight:700, color:C.orange }}>{providerLabel}でログイン中</div>
              {/* Phase D Phase 2: プロフィール情報セクション「編集」+「公開で見る」 */}
              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{
                    padding: "8px 16px",
                    background: C.orange,
                    border: "none",
                    borderRadius: 18,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 36,
                  }}
                >
                  ✏️ 編集
                </button>
                <button
                  onClick={openPublicProfile}
                  title={publicProfileUrl}
                  style={{
                    padding: "8px 16px",
                    background: C.white,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 18,
                    color: C.dark,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 36,
                  }}
                >
                  🔗 公開ページを見る
                </button>
                <button
                  onClick={handleCopyPublicUrl}
                  title={publicProfileUrl}
                  style={{
                    padding: "8px 16px",
                    background: C.orangePale,
                    border: `1.5px solid ${C.orange}`,
                    borderRadius: 18,
                    color: C.orange,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 36,
                  }}
                >
                  📋 リンクをコピー
                </button>
              </div>
            </div>
            {/* 創業期出品者バッジ (King 哲学: 本人のみ見える、公開プロフィールには出さない) */}
            {profile?.early_supporter_expires_at && (() => {
              const expiresAt = new Date(profile.early_supporter_expires_at!);
              const now = new Date();
              if (expiresAt <= now) return null;
              const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "linear-gradient(135deg, #FFF3E0 0%, #FFE8D6 100%)",
                  borderRadius: 12,
                  border: `1px solid ${C.orange}`,
                  fontSize: 13,
                  color: C.dark,
                  textAlign: "center",
                  lineHeight: 1.7,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.orange, marginBottom: 4 }}>
                    ⭐ 創業期出品者
                  </div>
                  <div style={{ fontSize: 12, color: C.warmGray }}>
                    手数料 5%・残り {daysLeft} 日 (〜{expiresAt.toLocaleDateString("ja-JP")})
                  </div>
                </div>
              );
            })()}
            {profile?.bio && (
                <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 16px", marginTop:16, marginBottom:4, textAlign:"left", fontSize:14, color:C.dark, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{profile.bio}</div>
              )}
              {/* 依頼書 #7 Phase A.2 (5/25): 👑 Founding Mayor 2026 称号バッジ */}
              {profile?.is_founding_mayor && (
                <div style={{
                  marginTop: 16, padding: "14px 18px",
                  background: "linear-gradient(135deg, #FFF8E1 0%, #FFE082 100%)",
                  borderRadius: 14, border: `2px solid #FFA000`,
                  textAlign: "center", boxShadow: "0 4px 12px rgba(255,160,0,0.15)",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#E65100", marginBottom: 2, letterSpacing: 0.5 }}>
                    👑 Founding Mayor 2026
                  </div>
                  <div style={{ fontSize: 11, color: "#8B6F00", lineHeight: 1.6 }}>
                    Qocca の街の首長として、創業期から街を支える方
                  </div>
                </div>
              )}
              {/* 依頼書 #7 Phase A.2 (5/25): 🎨 Founding Creator バッジ + 事業が存続する限り3% 手数料 */}
              {profile?.is_founding_creator && (
                <div style={{
                  marginTop: 12, padding: "14px 18px",
                  background: "linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)",
                  borderRadius: 14, border: `2px solid #AB47BC`,
                  textAlign: "center", boxShadow: "0 4px 12px rgba(171,71,188,0.12)",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#6A1B9A", marginBottom: 2 }}>
                    🎨 Founding Creator
                  </div>
                  <div style={{ fontSize: 11, color: "#7B1FA2", lineHeight: 1.6 }}>
                    事業が存続する限り手数料 <strong style={{ fontSize: 14 }}>{profile.founding_creator_fee_rate ?? 3}%</strong> (通常10% → 創業特典)
                  </div>
                </div>
              )}
              {/* 依頼書 #7 Phase A.2 (5/25): 🎁 未受け取り特典あり → /redeem 誘導 */}
              {crowdfundPendingBackers.length > 0 && (
                <div
                  onClick={() => navigate("/redeem")}
                  style={{
                    marginTop: 16, padding: "14px 18px", cursor: "pointer",
                    background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)",
                    borderRadius: 14, border: `2px dashed #4CAF50`,
                    textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{ fontSize: 28 }}>🎁</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#2E7D32", marginBottom: 2 }}>
                      未受け取りの特典が {crowdfundPendingBackers.length} 件あります
                    </div>
                    <div style={{ fontSize: 11, color: "#388E3C" }}>
                      タップして引き換えコードを入力してや 🌅
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: "#2E7D32" }}>→</div>
                </div>
              )}
              {/* 依頼書 #7 Phase A.2 (5/25): 🎁 私の特典 (引き換え済みコード一覧) */}
              {crowdfundCodes.length > 0 && (
                <div style={{ marginTop: 20, background: C.white, borderRadius: 16, padding: "16px 16px 14px", border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>🎁</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>私のクラファン特典</span>
                    <span style={{ fontSize: 10, color: C.warmGray, marginLeft: "auto" }}>{crowdfundCodes.length} 件</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {crowdfundCodes.map((c: any) => {
                      const tierId = c.reward_id || c.crowdfunding_rewards?.id;
                      const theme = REDEEM_TIER_THEME[tierId] || { color: C.orange, bg: C.orangePale, icon: "🎁", label: c.crowdfunding_rewards?.name || tierId };
                      const redeemedDate = c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString("ja-JP") : "-";
                      return (
                        <div key={c.id} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 12px", background: theme.bg, borderRadius: 12, border: `1px solid ${theme.color}40`,
                        }}>
                          <div style={{ fontSize: 22 }}>{theme.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: theme.color, marginBottom: 2 }}>
                              {theme.label}
                            </div>
                            <div style={{ fontSize: 10, color: C.warmGray }}>
                              受け取り日 {redeemedDate}
                              {c.crowdfunding_rewards?.price_jpy ? ` ・ ¥${c.crowdfunding_rewards.price_jpy.toLocaleString()}` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: C.warmGray, marginTop: 10, textAlign: "center", lineHeight: 1.6 }}>
                    ありがとうございます。Qocca の街は、あなたの想いで一歩深くなりました🌅
                  </div>
                </div>
              )}
              {/* Phase D Phase 2 (5/22): 🐾 うちの子セクション */}
              <div style={{ marginTop: 20, background: C.white, borderRadius: 16, padding: "16px 16px 14px", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
                    🐾 うちの子 ({myPets.length})
                  </div>
                  <button
                    onClick={() => { setEditingPetId(null); setPetEditOpen(true); }}
                    style={{
                      padding: "6px 14px",
                      background: C.orange,
                      color: "#fff",
                      border: "none",
                      borderRadius: 16,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      minHeight: 32,
                    }}
                  >
                    + 追加
                  </button>
                </div>
                {myPets.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 12px", color: C.warmGray, fontSize: 12, lineHeight: 1.8, border: `1px dashed ${C.border}`, borderRadius: 10, background: "#FAFAFA" }}>
                    まだ うちの子 を追加していません。<br/>
                    「+ 追加」から、ペットの情報を残せます。
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                    {myPets.map((p) => {
                      const isMemorial = p.status === "memorial";
                      const genderIcon = p.gender === "male" ? "♂" : p.gender === "female" ? "♀" : "";
                      const speciesEmoji = petIcon(p.species);
                      const heroPhoto = p.avatar_url || "";
                      return (
                        <div
                          key={p.id}
                          style={{
                            background: isMemorial ? "#F8F6F2" : C.white,
                            borderRadius: 12,
                            border: `1px solid ${C.border}`,
                            overflow: "hidden",
                            opacity: isMemorial ? 0.92 : 1,
                          }}
                        >
                          <div style={{
                            width: "100%",
                            aspectRatio: "1",
                            background: "#FFF5EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 40,
                            position: "relative",
                            overflow: "hidden",
                          }}>
                            {heroPhoto ? (
                              <img src={heroPhoto} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            ) : speciesEmoji}
                            {isMemorial && (
                              <div style={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                background: "rgba(255,255,255,0.92)",
                                color: "#8B6F4E",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 8,
                              }}>
                                🌈 虹の橋
                              </div>
                            )}
                          </div>
                          <div style={{ padding: "8px 10px" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                              {genderIcon && <span style={{ color: C.warmGray, fontSize: 11, fontWeight: 600 }}>{genderIcon}</span>}
                            </div>
                            <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 8, lineHeight: 1.4, height: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {speciesEmoji} {p.breed || petLabelShort(p.species)}
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => { setEditingPetId(p.id); setPetEditOpen(true); }}
                                style={{
                                  flex: 1, padding: "5px 8px",
                                  background: C.orangePale, color: C.orange,
                                  border: "none", borderRadius: 6,
                                  fontSize: 10, fontWeight: 700,
                                  cursor: "pointer", fontFamily: "inherit",
                                  minHeight: 28,
                                }}
                              >
                                ✏️ 編集
                              </button>
                              <button
                                onClick={() => navigate(`/pet/${p.id}`)}
                                style={{
                                  flex: 1, padding: "5px 8px",
                                  background: C.white, color: C.dark,
                                  border: `1px solid ${C.border}`, borderRadius: 6,
                                  fontSize: 10, fontWeight: 700,
                                  cursor: "pointer", fontFamily: "inherit",
                                  minHeight: 28,
                                }}
                              >
                                👁️ 公開で見る
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            <div style={{ display:"flex", gap:0, marginTop:16, background:C.white, borderRadius:12, padding:"12px 0", border:`1px solid ${C.border}` }}>
                <button onClick={()=>setActivityModal("listings")} style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}`, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:18, fontWeight:600, color:C.dark }}>{stats.listings}</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>出品</div>
                </button>
                <button onClick={()=>setActivityModal("completed")} style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}`, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:18, fontWeight:600, color:C.dark }}>{stats.completed}</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>取引完了</div>
                </button>
                <button onClick={()=>setActivityModal("reviews")} style={{ flex:1, textAlign:"center", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:18, fontWeight:600, color:C.dark }}>{stats.avgRating !== null ? stats.avgRating.toFixed(1) : "-"}</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>⭐ 評価</div>
                </button>
              </div>

            {/* フォロー・フォロワー */}
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button onClick={()=>setActivityModal("following")} style={{ flex:1, padding:"10px", background:C.white, border:`1px solid ${C.border}`, borderRadius:10, cursor:"pointer", fontFamily:"inherit" }}>
                <span style={{ fontSize:15, fontWeight:800, color:C.dark }}>{activity.following}</span>
                <span style={{ fontSize:11, color:C.warmGray, marginLeft:6 }}>フォロー中</span>
              </button>
              <button onClick={()=>setActivityModal("followers")} style={{ flex:1, padding:"10px", background:C.white, border:`1px solid ${C.border}`, borderRadius:10, cursor:"pointer", fontFamily:"inherit" }}>
                <span style={{ fontSize:15, fontWeight:800, color:C.dark }}>{activity.followers}</span>
                <span style={{ fontSize:11, color:C.warmGray, marginLeft:6 }}>フォロワー</span>
              </button>
            </div>

            {/* マイ活動セクション (v3.1: 4色違い → C.cream 統一、識別性はアイコン絵文字で維持) */}
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.warmGray, marginBottom:8, paddingLeft:4 }}>マイ活動</div>
              <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                {[
                  { id:"communities", icon:"💬", label:"参加中のコミュニティ", count:activity.communities },
                  { id:"events", icon:"📅", label:"投稿したイベント", count:activity.events },
                  { id:"gallery", icon:"🐾", label:"投稿したギャラリー", count:activity.gallery },
                  { id:"blog", icon:"📝", label:"投稿したブログ", count:activity.blog },
                ].map((item, i) => (
                  <button key={item.id} onClick={()=>setActivityModal(item.id)} style={{
                    width:"100%", padding:"14px 16px", border:"none", borderBottom: i < 3 ? `1px solid ${C.border}` : "none",
                    background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", gap:12, fontFamily:"inherit", textAlign:"left"
                  }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{item.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>{item.label}</div>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginRight:6 }}>{item.count}</div>
                    <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
       
            <button onClick={()=>setEditOpen(true)} style={{ marginTop:16, background:"transparent", color:C.orange, border:`1.5px solid ${C.orange}`, borderRadius:20, padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"background 0.3s ease, color 0.3s ease" }}>✏️ プロフィールを編集</button>
            <div style={{ background:C.white, borderRadius:20, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {[
                { icon:"❤️", label:"お気に入り", desc:"気になる出品", action:()=>setPage("liked") },
                { icon:"📦", label:"注文履歴", desc:"過去の注文を確認", action:()=>setTab("orders") },
                { icon:"💰", label:"売上", desc:"売上・出金管理", action:()=>setTab("earnings") },
                { icon:"🏠", label:"配送先住所", desc:"住所の管理", action:()=>setTab("addresses") },
                { icon:"💬", label:"メッセージ", desc:"取引メッセージ", action:()=>setTab("messages") },
                { icon:"🔔", label:"通知", desc:`${unreadNotifs}件の未読`, action:()=>setTab("notifications") },
                { icon:"🎧", label:"サポート", desc:"お問い合わせ", action:()=>setTab("support") },
              ].map((item, i) => (
                <button key={item.label} onClick={item.action} style={{
                  width:"100%", padding:"16px 20px", border:"none", borderBottom: i < 6 ? `1px solid ${C.border}` : "none",
                  background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", gap:14, fontFamily:"inherit", textAlign:"left"
                }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{item.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.dark }}>{item.label}</div>
                    <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>{item.desc}</div>
                  </div>
                  <span style={{ color:C.warmGray, fontSize:14 }}>→</span>
                </button>
              ))}
            </div>
            {/* 電話番号認証への導線 (v3.2 第29-30章: 任意機能、出品者推奨) */}
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.warmGray, marginBottom:10, paddingLeft:4 }}>
                安心の準備
              </div>
              <button
                onClick={() => navigate("/settings/phone-verification")}
                style={{
                  width:"100%", minHeight:44, padding:"14px 16px",
                  background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
                  display:"flex", alignItems:"center", gap:12,
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                  transition:"border-color 0.3s ease",
                }}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📱</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>電話番号の認証</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2, lineHeight:1.5 }}>出品をはじめる方におすすめ</div>
                </div>
                <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
              </button>
            </div>

            {/* Phase X (5/24, 案C 移植 5/26): 外部サービス連携 — X */}
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.warmGray, marginBottom:10, paddingLeft:4 }}>
                外部サービス連携
              </div>
              <button
                onClick={() => navigate("/settings/x")}
                style={{
                  width:"100%", minHeight:44, padding:"14px 16px",
                  background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
                  display:"flex", alignItems:"center", gap:12,
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                  transition:"border-color 0.3s ease",
                }}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:"#000", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, color:"#fff" }}>🐦</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>X 連携</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2, lineHeight:1.5 }}>Qocca から X (Twitter) に投稿できます</div>
                </div>
                <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
              </button>
              {/* Phase Threads (5/23, 案C 移植 5/27): Threads 連携ボタン */}
              <button
                onClick={() => navigate("/settings/threads")}
                style={{
                  width:"100%", minHeight:44, padding:"14px 16px", marginTop:8,
                  background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
                  display:"flex", alignItems:"center", gap:12,
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                  transition:"border-color 0.3s ease",
                }}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:"#000", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, color:"#fff" }}>🧵</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>Threads 連携</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2, lineHeight:1.5 }}>Qocca から Threads に投稿できます</div>
                </div>
                <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
              </button>
              {/* Phase Instagram (5/28 #25 Step 2): Instagram 連携ボタン */}
              <button
                onClick={() => navigate("/settings/instagram")}
                style={{
                  width:"100%", minHeight:44, padding:"14px 16px", marginTop:8,
                  background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
                  display:"flex", alignItems:"center", gap:12,
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                  transition:"border-color 0.3s ease",
                }}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, color:"#fff" }}>📷</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>Instagram 連携</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2, lineHeight:1.5 }}>Qocca から Instagram に投稿できます (Business Account 必須)</div>
                </div>
                <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
              </button>
            </div>

            {/* 暮らしの空気 (v3.2 第23章): "設定" でなく "模様替え" */}
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.warmGray, marginBottom:10, paddingLeft:4 }}>
                🏠 暮らしの空気
              </div>
              <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch" }}>
                {ATMOSPHERE_PRESETS.map(preset => {
                  const selected = atmosphereId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => changeAtmosphere(preset.id)}
                      style={{
                        flexShrink: 0,
                        minHeight: 44,
                        padding: "8px 14px",
                        background: selected ? preset.bg : C.white,
                        color: selected ? C.dark : C.warmGray,
                        border: `1.5px solid ${selected ? preset.cardBorder : C.border}`,
                        borderRadius: 22,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        whiteSpace: "nowrap",
                        transition: "background 0.4s ease, color 0.4s ease, border-color 0.4s ease",
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{preset.icon}</span>
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize:11, color:C.warmGray, marginTop:8, paddingLeft:4, opacity:0.7 }}>
                自分の家だけの空気。いつでも気分で。
              </div>
            </div>

            <button onClick={handleSignOut} style={{ width:"100%", padding:"14px", marginTop:20, background:C.white, border:`1.5px solid ${C.red}`, borderRadius:14, color:C.red, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>🚪 ログアウト</button>
          </>
        )}

        {/* My Listings Tab (マイ出品 - 出品者向け) */}
        {tab==="listings" && <MyListingsTab setPage={setPage}/>}

        {/* Sales Tab (販売管理 - 出品者向け) */}
        {tab==="sales" && <SalesTab/>}

        {/* Orders Tab */}
        {tab==="orders" && <OrdersTab/>}

        {/* Earnings Tab */}
        {tab==="earnings" && <EarningsTab/>}

        {/* Addresses Tab */}
        {tab==="addresses" && <AddressesTab/>}

        {/* Messages Tab */}
        {tab==="messages" && <MessagesTab/>}

        {/* Notifications Tab */}
        {tab==="notifications" && <NotificationsTab/>}

        {/* Support Tab */}
        {tab==="support" && <SupportTab/>}

        {/* 依頼書 #38 Phase C-E: 投稿管理 (新規投稿/編集/削除) */}
        {tab==="posts" && <PostsTab/>}
      </div>
          <ProfileEditModal
        open={editOpen}
        onClose={()=>setEditOpen(false)}
        userId={user?.id}
        onSaved={()=>setRefreshKey(k=>k+1)}
      />
      {/* Phase D Phase 2 (5/22): PetEditModal (追加/編集モード、petId=null で追加) */}
      {user?.id && (
        <PetEditModal
          open={petEditOpen}
          onClose={() => { setPetEditOpen(false); setEditingPetId(null); }}
          userId={user.id}
          petId={editingPetId}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
      {activityModal && <ActivityDetailModal type={activityModal} userId={user?.id} onClose={()=>setActivityModal(null)} setPage={setPage}/>}
    </div>
  );
};

// ── マイ活動詳細モーダル ──────────────────────────────────────────────────
const ActivityDetailModal = ({ type, userId, onClose, setPage }: { type:string; userId:string; onClose:()=>void; setPage:(p:string,d?:any)=>void }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      setLoading(true);
      let data:any[] = [];
      if (type === "listings") {
        const { data: d } = await supabase.from("listings").select("id, title, price, image_urls, created_at").eq("seller_id", userId).order("created_at", { ascending: false });
        data = d || [];
      } else if (type === "completed") {
        const { data: d } = await supabase.from("orders").select("id, listing_id, created_at, status, buyer_id").eq("seller_id", userId).eq("status", "completed").order("created_at", { ascending: false });
        if (d && d.length > 0) {
          const listingIds = [...new Set(d.map((o:any)=>o.listing_id).filter(Boolean))];
          const { data: lists } = listingIds.length ? await supabase.from("listings").select("id, title, image_urls").in("id", listingIds) : { data: [] };
          const listMap = Object.fromEntries((lists||[]).map((l:any)=>[l.id, l]));
          data = d.map((o:any) => ({ ...o, listing: listMap[o.listing_id] }));
        }
      } else if (type === "reviews") {
        const { data: d } = await supabase.from("reviews").select("id, rating, comment, created_at, reviewer_id").eq("seller_id", userId).order("created_at", { ascending: false });
        if (d && d.length > 0) {
          const ids = [...new Set(d.map((r:any)=>r.reviewer_id))];
          const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
          const profMap = Object.fromEntries((profs||[]).map((p:any)=>[p.id, p]));
          data = d.map((r:any) => ({ ...r, reviewer_name: profMap[r.reviewer_id]?.display_name || "ユーザー", reviewer_avatar: profMap[r.reviewer_id]?.avatar_url }));
        }
      } else if (type === "communities") {
        const { data: mems } = await supabase.from("community_members").select("community_id").eq("user_id", userId);
        const ids = (mems||[]).map((m:any)=>m.community_id);
        if (ids.length) {
          const { data: comms } = await supabase.from("communities").select("id, name, icon, category, member_count").in("id", ids);
          data = comms || [];
        }
      } else if (type === "events") {
        const { data: d } = await supabase.from("events").select("id, title, event_date, prefecture, status, image_url").eq("organizer_id", userId).order("event_date", { ascending: false });
        data = d || [];
      } else if (type === "gallery") {
        const { data: d } = await supabase.from("gallery_posts").select("id, image_url, caption, created_at").eq("user_id", userId).eq("is_deleted", false).order("created_at", { ascending: false });
        data = d || [];
      } else if (type === "blog") {
        const { data: d } = await supabase.from("blog_posts").select("id, title, category, cover_image_url, created_at").eq("author_id", userId).order("created_at", { ascending: false });
        data = d || [];
      } else if (type === "following") {
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
        const ids = (f||[]).map((x:any)=>x.following_id);
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url, bio").in("id", ids);
          data = profs || [];
        }
      } else if (type === "followers") {
        const { data: f } = await supabase.from("follows").select("follower_id").eq("following_id", userId);
        const ids = (f||[]).map((x:any)=>x.follower_id);
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url, bio").in("id", ids);
          data = profs || [];
        }
      }
      setItems(data);
      setLoading(false);
    })();
  }, [type, userId]);

  const titles: Record<string, string> = {
    listings: "📦 出品中の商品", completed: "✅ 取引完了履歴", reviews: "⭐ もらったレビュー",
    communities: "💬 参加中のコミュニティ", events: "📅 投稿したイベント",
    gallery: "🐾 投稿したギャラリー", blog: "📝 投稿したブログ",
    following: "👥 フォロー中", followers: "👥 フォロワー",
  };

  const handleNavigate = (path:string) => { onClose(); setPage(path); };

  const renderItem = (item:any) => {
    if (type === "listings") {
      return (
        <button key={item.id} onClick={()=>handleNavigate(`listing/${item.id}`)} style={{ width:"100%", display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, cursor:"pointer", textAlign:"left", fontFamily:"inherit", alignItems:"center" }}>
          <div style={{ width:50, height:50, borderRadius:8, background: item.image_urls?.[0] ? `url(${item.image_urls[0]}) center/cover` : C.orangePale, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
            <div style={{ fontSize:14, fontWeight:800, color:C.orange, marginTop:2 }}>¥{item.price?.toLocaleString()}</div>
          </div>
        </button>
      );
    }
    if (type === "completed") {
      return (
        <div key={item.id} style={{ display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, alignItems:"center" }}>
          <div style={{ width:50, height:50, borderRadius:8, background: item.listing?.image_urls?.[0] ? `url(${item.listing.image_urls[0]}) center/cover` : C.orangePale, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.listing?.title || "商品"}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>✅ {new Date(item.created_at).toLocaleDateString("ja-JP")}</div>
          </div>
        </div>
      );
    }
    if (type === "reviews") {
      return (
        <div key={item.id} style={{ padding:"12px 14px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background: item.reviewer_avatar ? `url(${item.reviewer_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:C.orange }}>{!item.reviewer_avatar && (item.reviewer_name||"?").charAt(0).toUpperCase()}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.dark }}>{item.reviewer_name}</div>
              <div style={{ fontSize:10, color:C.warmGray }}>{"⭐".repeat(item.rating)} ・ {new Date(item.created_at).toLocaleDateString("ja-JP")}</div>
            </div>
          </div>
          {item.comment && <div style={{ fontSize:12, color:C.dark, lineHeight:1.5 }}>{item.comment}</div>}
        </div>
      );
    }
    if (type === "communities") {
      return (
        <button key={item.id} onClick={()=>handleNavigate(`community/${item.id}`)} style={{ width:"100%", display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, cursor:"pointer", textAlign:"left", fontFamily:"inherit", alignItems:"center" }}>
          <div style={{ width:44, height:44, borderRadius:10, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{item.icon || "🐾"}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>{item.category} · 👥 {item.member_count || 0}人</div>
          </div>
        </button>
      );
    }
    if (type === "events") {
      const statusBadge: Record<string, {bg:string;color:string;label:string}> = {
        approved: { bg:"#E8F5E9", color:"#4CAF50", label:"公開中" },
        pending: { bg:"#FFF8E1", color:"#996200", label:"審査中" },
        rejected: { bg:"#FFEBEE", color:"#C62828", label:"却下" },
      };
      const sb = statusBadge[item.status] || statusBadge.pending;
      return (
        <div key={item.id} style={{ display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, alignItems:"center" }}>
          <div style={{ width:50, height:50, borderRadius:8, background: item.image_url?.startsWith("http") ? `url(${item.image_url}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{!item.image_url?.startsWith("http") && (item.image_url || "🐾")}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>📅 {item.event_date} · 📍 {item.prefecture}</div>
          </div>
          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:sb.bg, color:sb.color, fontWeight:700, flexShrink:0 }}>{sb.label}</span>
        </div>
      );
    }
    if (type === "gallery") {
      // 依頼書 #12 (5/26): CSS background:url() のカッコ問題 → img タグ統一 (タスク #23 同様のリグレッション修正)
      return (
        <button key={item.id} onClick={()=>handleNavigate(`gallery/${item.id}`)} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", cursor:"pointer", padding:0, fontFamily:"inherit", textAlign:"left" }}>
          <div style={{ width:"100%", aspectRatio:"1", overflow:"hidden", background:C.cream }}>
            {item.image_url && (
              <img src={item.image_url} alt={item.caption || ""} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
            )}
          </div>
          {item.caption && <div style={{ padding:"8px 12px", fontSize:11, color:C.dark, lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{item.caption}</div>}
        </button>
      );
    }
    if (type === "blog") {
      return (
        <button key={item.id} onClick={()=>handleNavigate(`blog/${item.id}`)} style={{ width:"100%", display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, alignItems:"center", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
          <div style={{ width:50, height:50, borderRadius:8, background: item.cover_image_url ? `url(${item.cover_image_url}) center/cover` : C.orangePale, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>{item.category} · {new Date(item.created_at).toLocaleDateString("ja-JP")}</div>
          </div>
          <span style={{ fontSize:14, color:C.orange }}>›</span>
        </button>
      );
    }
    if (type === "following" || type === "followers") {
      return (
        <button key={item.id} onClick={()=>handleNavigate(`user/${item.id}`)} style={{ width:"100%", display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, cursor:"pointer", textAlign:"left", fontFamily:"inherit", alignItems:"center" }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background: item.avatar_url ? `url(${item.avatar_url}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:C.orange, flexShrink:0 }}>{!item.avatar_url && (item.display_name||"?").charAt(0).toUpperCase()}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{item.display_name || "ユーザー"}</div>
            {item.bio && <div style={{ fontSize:11, color:C.warmGray, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.bio}</div>}
          </div>
        </button>
      );
    }
    return null;
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white, borderRadius:20, padding:"20px", width:"100%", maxWidth:480, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:900, color:C.dark }}>{titles[type] || "詳細"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.warmGray }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8 }}>
          {loading ? (
            <div style={{ padding:30, textAlign:"center", color:C.warmGray, fontSize:13 }}>読み込み中...</div>
          ) : items.length === 0 ? (
            <div style={{ padding:30, textAlign:"center", color:C.warmGray, fontSize:13 }}>まだありません</div>
          ) : type === "gallery" ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:8 }}>{items.map(renderItem)}</div>
          ) : (
            items.map(renderItem)
          )}
        </div>
      </div>
    </div>
  );
};

// ── Order Status Bar ──────────────────────────────────────────────────────
// OrderStatusBar は components/ui.tsx へ移動 (Phase 4-b)

// ── Earnings Tab (売上・出金管理) ──────────────────────────────────────
const EarningsTab = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [connectStatus, setConnectStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showInstantModal, setShowInstantModal] = useState(false);
  const [instantAmount, setInstantAmount] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  // 依頼書 #7 Phase A.2 (5/25): 創業クリエイター事業が存続する限り3%手数料表示用
  const [foundingCreatorFeeRate, setFoundingCreatorFeeRate] = useState<number | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qufrqkuipzuqeqkvuhkx.supabase.co";
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou";

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

      // 残高サマリー
      const { data: bal } = await sb
        .from("seller_balances")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setBalance(bal);

      // 出金履歴
      const { data: payoutData } = await sb
        .from("payouts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setPayouts(payoutData || []);

      // platform_settings
      const { data: settingsData } = await sb
        .from("platform_settings")
        .select("key, value")
        .in("key", ["instant_payout_fee_rate", "instant_payout_fee_min", "monthly_payout_threshold"]);
      const settingsMap: Record<string, string> = {};
      for (const s of settingsData || []) settingsMap[s.key] = s.value;
      setSettings(settingsMap);

      // 依頼書 #7 Phase A.2: 創業クリエイター情報取得 (事業が存続する限り3%手数料表示用)
      const { data: prof } = await sb
        .from("profiles")
        .select("is_founding_creator, founding_creator_fee_rate")
        .eq("id", user.id)
        .single();
      if (prof?.is_founding_creator) {
        setFoundingCreatorFeeRate(prof.founding_creator_fee_rate ?? 3);
      } else {
        setFoundingCreatorFeeRate(null);
      }

      // Stripe Connect ステータス確認
      const statusRes = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
        body: JSON.stringify({ user_id: user.id }),
      });
      const statusData = await statusRes.json();
      setConnectStatus(statusData);
    } catch (e) {
      console.error("Load earnings failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const handleStartOnboarding = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect-onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("オンボーディング URL の取得に失敗しました: " + (data.error || ""));
      }
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  };
const handleOpenDashboard = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect-dashboard-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert("ダッシュボードへのリンク取得に失敗しました: " + (data.error || ""));
      }
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  };
  const handleInstantPayout = async () => {
    if (!user?.id) return;
    const amount = parseInt(instantAmount);
    if (!amount || amount < 100) { alert("100円以上の金額を入力してください"); return; }
    
    const fee = parseInt(settings.instant_payout_fee_min || "250"); // 一律¥250(税抜・税込¥275)
    const net = amount - fee;
    
    if (!confirm(`即時受け取りを実行しますか？\n\n出金額: ¥${amount.toLocaleString()}\n手数料: ¥${fee.toLocaleString()} (一律)\n受取額: ¥${net.toLocaleString()}\n\n数分以内に銀行口座へ振込されます。`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-instant-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
        body: JSON.stringify({ user_id: user.id, amount }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ 即時受け取りが完了しました！\n\n出金額: ¥${data.breakdown.gross.toLocaleString()}\n手数料: ¥${data.breakdown.fee.toLocaleString()}\n受取額: ¥${data.breakdown.net.toLocaleString()}`);
        setShowInstantModal(false);
        setInstantAmount("");
        loadData();
      } else {
        alert("エラー: " + (data.message || data.error || "不明"));
      }
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding:40, textAlign:"center", color:C.textMuted }}>読み込み中...</div>;
  }

  const isConnected = connectStatus?.connected && connectStatus?.payouts_enabled;
  const monthlyThreshold = parseInt(settings.monthly_payout_threshold || "30000");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Stripe Connect 連携状況 (v3.1: 2px ボーダー + orange solid CTA → line CTA に控えめ化) */}
      {!isConnected && (
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <span style={{ fontSize:20 }}>🏦</span>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:C.dark }}>銀行口座を設定してください</h3>
          </div>
          <p style={{ margin:"8px 0 12px", fontSize:13, color:C.text, lineHeight:1.6 }}>
            売上を受け取るには、Stripe で銀行口座を連携する必要があります。<br/>
            セキュアな本人確認を経て、安全に振込が可能になります。
          </p>
          <button
            onClick={handleStartOnboarding}
            disabled={actionLoading}
            style={{ background:"transparent", color:C.orange, border:`1.5px solid ${C.orange}`, borderRadius:12, padding:"12px 24px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity: actionLoading ? 0.6 : 1, transition:"background 0.3s ease, color 0.3s ease" }}
          >
            {actionLoading ? "処理中..." : "銀行口座を設定する →"}
          </button>
        </div>
      )}

      {/* 依頼書 #7 Phase A.2 (5/25): 🎨 創業クリエイター事業が存続する限り3%手数料バナー */}
      {foundingCreatorFeeRate !== null && (
        <div style={{
          background: "linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)",
          border: `2px solid #AB47BC`,
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 12px rgba(171,71,188,0.12)",
        }}>
          <div style={{ fontSize: 32 }}>🎨</div>
          <div style={{ flex: 1, lineHeight: 1.6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#6A1B9A", marginBottom: 2 }}>
              あなたは創業クリエイター
            </div>
            <div style={{ fontSize: 12, color: "#7B1FA2" }}>
              事業が存続する限り販売手数料 <strong style={{ fontSize: 16 }}>{foundingCreatorFeeRate}%</strong> (通常 10% → 創業特典)
            </div>
          </div>
        </div>
      )}

      {/* 残高サマリー (v3.1: 3つ並ぶうち1つだけ強調する EC的設計を排除、統一スタイル) */}
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:20 }}>
        <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:C.text }}>残高サマリー</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <div style={{ background:C.cream, padding:14, borderRadius:12, textAlign:"center", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.warmGray, marginBottom:4 }}>取引中</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dark }}>¥{(balance?.in_escrow || 0).toLocaleString()}</div>
          </div>
          <div style={{ background:C.cream, padding:14, borderRadius:12, textAlign:"center", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.warmGray, marginBottom:4 }}>受取可能</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dark }}>¥{(balance?.pending_balance || 0).toLocaleString()}</div>
          </div>
          <div style={{ background:C.cream, padding:14, borderRadius:12, textAlign:"center", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.warmGray, marginBottom:4 }}>累計売上</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dark }}>¥{(balance?.total_earned || 0).toLocaleString()}</div>
          </div>
        </div>
        <div style={{ marginTop:12, fontSize:11, color:C.warmGray, lineHeight:1.6 }}>
          完了取引数: {balance?.completed_orders_count || 0}件
        </div>
      </div>

      {/* 振込スケジュール案内 */}
      <div style={{ background:"#F8F9FA", borderRadius:16, padding:16, fontSize:12, lineHeight:1.7, color:C.text }}>
        <div style={{ fontWeight:800, marginBottom:6 }}>📅 振込について</div>
        <div>• <strong>月末自動振込</strong>: ¥{monthlyThreshold.toLocaleString()}以上は手数料無料、未満は¥275(税込)</div>
        <div>• <strong>即時受け取り</strong>: 一律¥275(税込) / 数分で着金</div>
      </div>

      {/* 即時受け取りボタン (v3.1: 巨大 orange solid + ⚡絵文字 → line CTA + 矢印) */}
      {isConnected && (balance?.pending_balance || 0) > 0 && (
        <button
          onClick={() => setShowInstantModal(true)}
          style={{ background:"transparent", color:C.orange, border:`1.5px solid ${C.orange}`, borderRadius:14, padding:"14px 24px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"background 0.3s ease, color 0.3s ease" }}
        >
          今すぐ受け取る →
        </button>
      )}
{/* 銀行口座・支払い設定を変更（Stripe Express ダッシュボード） */}
      {isConnected && (
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.text, marginBottom:4 }}>🏦 銀行口座・支払い設定</div>
              <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5 }}>
                銀行口座の変更、住所変更、税情報の更新などはStripeのページから安全に行えます。
              </div>
            </div>
            <button
              onClick={handleOpenDashboard}
              disabled={actionLoading}
              style={{ background:C.white, color:C.orange, border:`2px solid ${C.orange}`, borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", opacity: actionLoading ? 0.6 : 1, whiteSpace:"nowrap" }}
            >
              {actionLoading ? "処理中..." : "設定を変更する ↗"}
            </button>
          </div>
        </div>
      )}
      {/* 出金履歴 */}
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:20 }}>
        <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:800, color:C.text }}>📜 出金履歴</h3>
        {payouts.length === 0 ? (
          <div style={{ padding:20, textAlign:"center", color:C.textMuted, fontSize:13 }}>まだ出金履歴はありません</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {payouts.map(p => (
              <div key={p.id} style={{ padding:12, border:`1px solid ${C.border}`, borderRadius:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, color:C.textMuted }}>
                    {new Date(p.created_at).toLocaleDateString("ja-JP")} - {p.payout_type === "instant" ? "⚡即時" : p.payout_type === "monthly_auto" ? "📅月末" : "🖱️手動"}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>¥{p.net_amount.toLocaleString()}</div>
                  {p.fee > 0 && <div style={{ fontSize:11, color:C.textMuted }}>手数料 ¥{p.fee.toLocaleString()}</div>}
                </div>
                <span style={{ 
                  fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:8,
                  background: p.status === "paid" ? "#E8F5E9" : p.status === "in_transit" ? "#FFF3E0" : p.status === "failed" ? "#FFEBEE" : "#F5F5F5",
                  color: p.status === "paid" ? "#2E7D32" : p.status === "in_transit" ? "#EF6C00" : p.status === "failed" ? "#C62828" : "#666"
                }}>
                  {p.status === "paid" ? "✅完了" : p.status === "in_transit" ? "🚀 振込中" : p.status === "failed" ? "❌失敗" : "保留中"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 即時受け取りモーダル */}
      {showInstantModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
          <div style={{ background:C.white, borderRadius:16, padding:24, maxWidth:400, width:"90%", maxHeight:"88vh", overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:800 }}>⚡ 即時受け取り</h3>
            <p style={{ fontSize:13, color:C.text, lineHeight:1.6, margin:"0 0 16px" }}>
              手数料: 一律¥275(税込)<br/>
              受取可能残高: <strong>¥{(balance?.pending_balance || 0).toLocaleString()}</strong>
            </p>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, marginBottom:6 }}>出金額（円）</label>
              <input
                type="number"
                value={instantAmount}
                onChange={e => setInstantAmount(e.target.value)}
                placeholder="例: 10000"
                style={{ width:"100%", padding:12, border:`1px solid ${C.border}`, borderRadius:10, fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }}
              />
              {instantAmount && (
                <div style={{ marginTop:8, padding:10, background:C.orangePale, borderRadius:10, fontSize:12, lineHeight:1.6 }}>
                  手数料: ¥250 (税込¥275)<br/>
                  受取額: ¥{Math.max(0, parseInt(instantAmount||"0") - 250).toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setShowInstantModal(false); setInstantAmount(""); }} style={{ flex:1, padding:12, border:`1px solid ${C.border}`, background:C.white, borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
              <button onClick={handleInstantPayout} disabled={actionLoading || !instantAmount} style={{ flex:1, padding:12, border:"none", background:C.orange, color:C.white, borderRadius:10, fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", opacity: (actionLoading || !instantAmount) ? 0.5 : 1 }}>
                {actionLoading ? "処理中..." : "実行"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Addresses Tab (配送先住所管理) ──────────────────────────────────────
const AddressesTab = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState({ recipient_name:"", postal_code:"", prefecture:"", city:"", address_line:"", phone:"", label:"自宅", is_default:false });

  const fetchAddresses = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("user_id", user.id)
      .is("delete_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setAddresses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAddresses(); }, [user?.id]);

  const resetForm = () => {
    setForm({ recipient_name:"", postal_code:"", prefecture:"", city:"", address_line:"", phone:"", label:"自宅", is_default:false });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.recipient_name || !form.postal_code || !form.prefecture || !form.city || !form.address_line || !form.phone) {
      alert("必須項目をすべて入力してください");
      return;
    }
    if (!user?.id) { alert("ログインしてください"); return; }

    if (form.is_default) {
      await supabase.from("shipping_addresses").update({ is_default: false }).eq("user_id", user.id);
    }

    if (editingId) {
      const { error } = await supabase
        .from("shipping_addresses")
        .update({
          recipient_name: form.recipient_name,
          postal_code: form.postal_code,
          prefecture: form.prefecture,
          city: form.city,
          address_line: form.address_line,
          phone: form.phone,
          label: form.label,
          is_default: form.is_default,
        })
        .eq("id", editingId);
      if (error) { alert("更新失敗: " + error.message); return; }
    } else {
      const { error } = await supabase
        .from("shipping_addresses")
        .insert({
          user_id: user.id,
          recipient_name: form.recipient_name,
          postal_code: form.postal_code,
          prefecture: form.prefecture,
          city: form.city,
          address_line: form.address_line,
          phone: form.phone,
          label: form.label,
          is_default: addresses.length === 0 || form.is_default,
        });
      if (error) { alert("追加失敗: " + error.message); return; }
    }
    resetForm();
    fetchAddresses();
  };

  const handleEdit = (addr:any) => {
    setForm({
      recipient_name: addr.recipient_name,
      postal_code: addr.postal_code,
      prefecture: addr.prefecture,
      city: addr.city,
      address_line: addr.address_line,
      phone: addr.phone,
      label: addr.label || "自宅",
      is_default: addr.is_default,
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleDelete = async (addr:any) => {
    if (!confirm(`「${addr.label || "住所"}」を削除しますか？`)) return;
    const { error } = await supabase.from("shipping_addresses").delete().eq("id", addr.id);
    if (error) { alert("削除失敗: " + error.message); return; }
    fetchAddresses();
  };

  const handleSetDefault = async (addr:any) => {
    if (!user?.id) return;
    await supabase.from("shipping_addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("shipping_addresses").update({ is_default: true }).eq("id", addr.id);
    fetchAddresses();
  };

  return (
    <div style={{ padding:"20px 16px", paddingBottom:80 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, margin:0 }}>🏠 配送先住所</h2>
        <button onClick={()=>{ resetForm(); setShowForm(true); }} style={{
          padding:"8px 14px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
        }}>+ 追加</button>
      </div>
      <div style={{ background:"#FFF8F0", padding:"12px 14px", borderRadius:10, fontSize:11, color:C.warmGray, marginBottom:14, lineHeight:1.5 }}>
        🔒 配送が必要な取引時に出品者に共有される住所です。取引完了後30日で自動削除されます。
      </div>

      {loading && <div style={{ textAlign:"center", padding:20, color:C.warmGray }}>読み込み中...</div>}

      {!loading && addresses.length === 0 && !showForm && (
        <div style={{ textAlign:"center", padding:"40px 20px", background:C.white, borderRadius:14, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
          <div style={{ fontSize:14, color:C.warmGray, marginBottom:14 }}>登録された住所はありません</div>
          <button onClick={()=>setShowForm(true)} style={{ padding:"10px 20px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>+ 住所を追加</button>
        </div>
      )}

      {!loading && addresses.map(addr => (
        <div key={addr.id} style={{ background:C.white, padding:"14px", borderRadius:12, marginBottom:10, border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:14, fontWeight:800, color:C.dark }}>{addr.label || "住所"}</span>
            {addr.is_default && <span style={{ fontSize:10, padding:"3px 8px", background:C.orange, color:"#fff", borderRadius:6, fontWeight:700 }}>デフォルト</span>}
          </div>
          <div style={{ fontSize:12, color:C.warmGray, lineHeight:1.6, marginBottom:10 }}>
            <div>{addr.recipient_name} 様</div>
            <div>〒{addr.postal_code} {addr.prefecture}{addr.city}</div>
            <div>{addr.address_line}</div>
            <div>📱 {addr.phone}</div>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {!addr.is_default && (
              <button onClick={()=>handleSetDefault(addr)} style={{ padding:"6px 10px", background:C.white, border:`1px solid ${C.orange}`, borderRadius:8, color:C.orange, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>デフォルトに設定</button>
            )}
            <button onClick={()=>handleEdit(addr)} style={{ padding:"6px 10px", background:C.white, border:`1px solid ${C.border}`, borderRadius:8, color:C.warmGray, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✏️ 編集</button>
            <button onClick={()=>handleDelete(addr)} style={{ padding:"6px 10px", background:C.white, border:`1px solid ${C.red}`, borderRadius:8, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🗑️ 削除</button>
          </div>
        </div>
      ))}

      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"flex-end" }} onClick={resetForm}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"24px 20px", width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>{editingId ? "✏️ 住所を編集" : "+ 住所を追加"}</div>
              <button onClick={resetForm} style={{ background:"none", border:"none", fontSize:20, color:C.warmGray, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
              {[
                { k:"label", label:"ラベル", placeholder:"自宅", maxLength:20 },
                { k:"recipient_name", label:"受取人名（本名）*", placeholder:"山田 太郎" },
                { k:"postal_code", label:"郵便番号 *", placeholder:"530-0001", maxLength:8 },
                { k:"prefecture", label:"都道府県 *", placeholder:"大阪府" },
                { k:"city", label:"市区町村 *", placeholder:"大阪市北区梅田" },
                { k:"address_line", label:"番地・建物名 *", placeholder:"1-1-1 〇〇マンション101" },
                { k:"phone", label:"電話番号 *", placeholder:"090-1234-5678", maxLength:13 },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>{f.label}</label>
                  <input
                    value={form[f.k as keyof typeof form] as string}
                    onChange={e=>setForm({...form, [f.k]:e.target.value})}
                    placeholder={f.placeholder}
                    maxLength={f.maxLength}
                    style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              ))}
              <label style={{ display:"flex", alignItems:"center", gap:8, padding:"10px", background:C.lightGray, borderRadius:8, cursor:"pointer" }}>
                <input type="checkbox" checked={form.is_default} onChange={e=>setForm({...form, is_default:e.target.checked})} />
                <span style={{ fontSize:13, color:C.dark }}>デフォルト住所として設定</span>
              </label>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={resetForm} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
              <button onClick={handleSubmit} style={{ flex:2, padding:"13px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>{editingId ? "更新する" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Orders Tab（購入者向け：自分が買った注文一覧） ─────────────────────────
const OrdersTab = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showDispute, setShowDispute] = useState<any>(null);
  const [showReview, setShowReview] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  // 依頼書 #143 TOP1 Step 3 (2026/6/10): 受取確認の連打防止 (二重送金 多層防御のフロント側)
  const [confirming, setConfirming] = useState(false);

  const loadOrders = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, escrow_status, amount, created_at, delivered_at, completed_at, listing_id, seller_id")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) { console.error("orders fetch error:", error); setLoading(false); return; }

    // listing と seller profile を別途取得して付与
    const listingIds = Array.from(new Set((data || []).map(o => o.listing_id).filter(Boolean)));
    const sellerIds = Array.from(new Set((data || []).map(o => o.seller_id).filter(Boolean)));

    const [{ data: listings }, { data: sellers }] = await Promise.all([
      listingIds.length ? supabase.from("listings").select("id, title, image_urls, category").in("id", listingIds) : Promise.resolve({ data: [] }),
      sellerIds.length ? supabase.from("profiles").select("id, display_name").in("id", sellerIds) : Promise.resolve({ data: [] }),
    ]);

    const listingMap = new Map((listings || []).map(l => [l.id, l]));
    const sellerMap = new Map((sellers || []).map(s => [s.id, s]));

    const enriched = (data || []).map(o => ({
      ...o,
      listing: listingMap.get(o.listing_id),
      seller: sellerMap.get(o.seller_id),
    }));

    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => { loadOrders(); }, [user?.id]);

  const filtered = orders.filter(o => filter==="all" || o.status===filter);

  const statusLabel = (s) => {
    const map = { pending:{text:"注文確定",bg:C.orangePale,color:C.orange}, working:{text:"作業中",bg:"#E3F2FD",color:C.blue}, delivered:{text:"納品済み",bg:"#FFF3E0",color:C.orange}, completed:{text:"取引完了",bg:C.greenPale,color:C.green}, disputed:{text:"異議中",bg:"#FFEBEE",color:C.red}, refunded:{text:"返金済み",bg:"#FFEBEE",color:C.red}, cancelled:{text:"キャンセル",bg:C.lightGray,color:C.warmGray} };
    return map[s] || {text:s,bg:C.lightGray,color:C.warmGray};
  };

  const handleConfirm = async (orderId: string) => {
    // 依頼書 #143 TOP1 Step 3: 再入ガード (await 中の連打を物理的に防ぐ)
    if (confirming) return;
    if (!confirm("受取を確定しますか？\nこの操作で出品者へ売上が支払われます。")) return;
    setConfirming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ order_id: orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "受取確認に失敗しました");
      alert("受取を確定しました。出品者へ売上が支払われます。");
      setSelected(null);
      await loadOrders();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (s?: string) => s ? new Date(s).toLocaleDateString("ja-JP").replace(/\//g, ".") : "";
  const photoUrl = (l?: any) => Array.isArray(l?.image_urls) && l.image_urls.length ? l.image_urls[0] : null;

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
        {[["all","すべて"],["working","作業中"],["delivered","納品済み"],["completed","完了"],["disputed","異議中"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            flexShrink:0, padding:"6px 14px", border:`1.5px solid ${filter===v?C.orange:C.border}`,
            borderRadius:10, background:filter===v?C.orangePale:C.white,
            color:filter===v?C.orange:C.warmGray, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"48px 20px", color:C.warmGray, fontSize:13 }}>読み込み中…</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:40, marginBottom:8 }}>📦</div>
          <div style={{ fontWeight:700, color:C.warmGray }}>注文がありません</div>
          <div style={{ fontSize:11, color:C.warmGray, marginTop:6 }}>気になる商品を購入してみましょう</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.map(order => {
            const st = statusLabel(order.status);
            const title = order.listing?.title || "（削除された商品）";
            const sellerName = order.seller?.display_name || "—";
            const img = photoUrl(order.listing);
            return (
              <div key={order.id} onClick={()=>setSelected(selected?.id===order.id?null:order)} style={{
                background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", cursor:"pointer"
              }}>
                <div style={{ padding:"16px", display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:img?`url(${img}) center/cover`:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                    {!img && "📦"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</span>
                      <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6, flexShrink:0 }}>{st.text}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.warmGray }}>{sellerName} · {formatDate(order.created_at)}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginTop:4 }}>¥{Number(order.amount || 0).toLocaleString()}</div>
                  </div>
                </div>

                {selected?.id===order.id && (
                  <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px", background:C.lightGray }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.warmGray, marginBottom:4 }}>注文番号: {order.id.slice(0, 8)}</div>
                    <OrderStatusBar status={order.status}/>

                    {order.status==="disputed" && (
                      <div style={{ background:"#FFEBEE", borderRadius:12, padding:"12px", marginTop:8, fontSize:12, color:C.red }}>
                        <div style={{ fontWeight:700, marginBottom:4 }}>⚠️ 異議申し立て中</div>
                        <div style={{ fontSize:11, color:C.warmGray }}>運営にて対応中です</div>
                      </div>
                    )}

                    {order.status==="refunded" && (
                      <div style={{ background:"#FFEBEE", borderRadius:12, padding:"12px", marginTop:8, fontSize:12, color:C.red }}>
                        <div style={{ fontWeight:700 }}>💸 返金済み</div>
                      </div>
                    )}

                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      {order.status==="delivered" && (
                        <>
                          <button disabled={confirming} onClick={(e)=>{e.stopPropagation();handleConfirm(order.id);}} style={{
                            flex:2, padding:"11px", background:confirming?C.warmGray:C.green, border:"none", borderRadius:10,
                            color:"#fff", fontWeight:800, fontSize:13, cursor:confirming?"not-allowed":"pointer", fontFamily:"inherit"
                          }}>{confirming ? "処理中..." : "✅ 受取完了"}</button>
                          <button onClick={(e)=>{e.stopPropagation();setShowDispute(order);}} style={{
                            flex:1, padding:"11px", background:C.white, border:`1.5px solid ${C.red}`,
                            borderRadius:10, color:C.red, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit"
                          }}>問題を報告</button>
                        </>
                      )}
                      {order.status==="completed" && (
                        <button onClick={(e)=>{e.stopPropagation();setShowReview({...order, item:title, seller:sellerName});}} style={{
                          flex:1, padding:"11px", background:C.orange, border:"none", borderRadius:10,
                          color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit"
                        }}>⭐ レビューを書く</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dispute Modal */}
      {showDispute && <DisputeModal order={{...showDispute, item: showDispute.listing?.title || ""}} onClose={()=>setShowDispute(null)} onSubmit={async (orderId, reason, desc)=>{
        try {
          // status のみ更新（dispute_reason/dispute_status カラムは未実装）
          await supabase.from("orders").update({ status:"disputed", updated_at: new Date().toISOString() }).eq("id", orderId);
          alert("問題を報告しました。運営が確認次第対応いたします。");
          await loadOrders();
        } catch(e: any) { alert("エラー: "+e.message); }
        setShowDispute(null);
      }}/>}
      {showReview && <ReviewModal order={showReview} onClose={()=>setShowReview(null)} onSubmit={()=>setShowReview(null)} />}
    </div>
  );
};

// ── Sales Tab（出品者向け：自分が売った注文一覧、対応操作可） ──────────────
const MyListingsTab = ({ setPage }) => {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [editTarget, setEditTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadListings = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setListings(data || []);
    setLoading(false);
  };

  useEffect(() => { loadListings(); }, [user?.id]);

  const filtered = listings.filter(l => {
    if (filter === "all") return true;
    if (filter === "draft") return l.status === "draft";
    if (filter === "pending") return l.status === "pending";
    if (filter === "approved") return l.status === "approved";
    if (filter === "sold_out") return l.status === "sold_out";
    if (filter === "rejected") return l.status === "rejected";
    return true;
  });

  const statusBadge = (s) => {
    const map = {
      draft:    { text:"💾 下書き",    bg:C.lightGray,    color:C.warmGray },
      pending:  { text:"⏳ 審査中",    bg:C.orangePale,   color:C.orange },
      approved: { text:"✅ 公開中",    bg:"#E8F5E9",      color:C.green },
      sold_out: { text:"🔴 売り切れ",  bg:"#FFEBEE",      color:C.red },
      rejected: { text:"❌ 非承認",    bg:"#FFEBEE",      color:C.red },
    };
    return map[s] || { text:s, bg:C.lightGray, color:C.warmGray };
  };

  const handleStockChange = async (listing, delta) => {
    if (busy) return;
    const current = listing.stock_quantity ?? 0;
    const newStock = Math.max(0, current + delta);
    setBusy(true);
    const { error } = await supabase.from("listings").update({ stock_quantity: newStock }).eq("id", listing.id);
    setBusy(false);
    if (error) { alert("在庫数変更に失敗: " + error.message); return; }
    await loadListings();
  };

  const handleEnableStock = async (listing) => {
    if (busy) return;
    const value = prompt("在庫数を入力してください（数字）", "10");
    if (value === null) return;
    const n = parseInt(value);
    if (isNaN(n) || n < 0) { alert("0以上の数字を入力してください"); return; }
    setBusy(true);
    const { error } = await supabase.from("listings").update({ stock_quantity: n }).eq("id", listing.id);
    setBusy(false);
    if (error) { alert("在庫管理開始に失敗: " + error.message); return; }
    await loadListings();
  };

  const handleDisableStock = async (listing) => {
    if (busy) return;
    if (!confirm("在庫管理を停止します。\n以降「在庫無制限（オーダーメイド型）」として扱われます。よろしいですか？")) return;
    setBusy(true);
    const { error } = await supabase.from("listings").update({ stock_quantity: null }).eq("id", listing.id);
    setBusy(false);
    if (error) { alert("在庫管理停止に失敗: " + error.message); return; }
    await loadListings();
  };

  const handlePublishDraft = async (listing) => {
    if (busy) return;
    if (!confirm("この下書きを公開申請しますか？\n（NGワードチェック・信頼度判定の上で、即時公開 or 審査待ちになります）")) return;
    setBusy(true);
    // status を pending に変更すると、auto_approve_listing トリガーが UPDATE では発火しないため
    // 一度 INSERT 用の関数を再利用するために、ここでは直接 status を pending にする
    const { error } = await supabase.from("listings").update({ status: "pending" }).eq("id", listing.id);
    setBusy(false);
    if (error) { alert("公開申請に失敗: " + error.message); return; }
    alert("公開申請しました。NGワードチェックや信頼度判定の上、近日中に公開されます。");
    await loadListings();
  };

  const handleDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    const { error } = await supabase.from("listings").delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (error) { alert("削除に失敗: " + error.message); return; }
    setDeleteTarget(null);
    await loadListings();
  };

  const counts = {
    all: listings.length,
    draft: listings.filter(l=>l.status==="draft").length,
    pending: listings.filter(l=>l.status==="pending").length,
    approved: listings.filter(l=>l.status==="approved").length,
    sold_out: listings.filter(l=>l.status==="sold_out").length,
    rejected: listings.filter(l=>l.status==="rejected").length,
  };

  return (
    <div>
      <div style={{ background:C.orangePale, borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:11, color:C.dark, lineHeight:1.6 }}>
        🐾 出品した商品の一覧です。下書きの編集・公開、在庫管理、削除ができます。
      </div>

      {/* フィルター */}
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
        {[
          ["all","すべて",counts.all],
          ["draft","💾 下書き",counts.draft],
          ["pending","⏳ 審査中",counts.pending],
          ["approved","✅ 公開中",counts.approved],
          ["sold_out","🔴 売切",counts.sold_out],
          ["rejected","❌ 非承認",counts.rejected],
        ].map(([v,l,c])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            flexShrink:0, padding:"6px 12px", border:`1.5px solid ${filter===v?C.orange:C.border}`,
            borderRadius:10, background:filter===v?C.orangePale:C.white,
            color:filter===v?C.orange:C.warmGray, fontSize:12, fontWeight:700,
            cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4
          }}>{l} <span style={{ fontSize:10, opacity:0.7 }}>({c})</span></button>
        ))}
      </div>

      {/* リスト */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:C.warmGray, fontSize:13 }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background:C.white, borderRadius:16, padding:"40px 20px", textAlign:"center", border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🐾</div>
          <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:6 }}>
            {filter === "all" ? "まだ出品がありません" : "該当する出品がありません"}
          </div>
          {filter === "all" && (
            <button onClick={()=>setPage("sell")} style={{
              marginTop:14, padding:"10px 24px", background:C.orange, border:"none", borderRadius:10,
              color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit"
            }}>＋ 出品する</button>
          )}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(l => {
            const badge = statusBadge(l.status);
            const photo = Array.isArray(l.image_urls) && l.image_urls.length ? l.image_urls[0] : null;
            const stock = l.stock_quantity;
            const stockManaged = stock !== null && stock !== undefined;
            return (
              <div key={l.id} style={{ background:C.white, borderRadius:14, padding:"14px", border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", gap:12 }}>
                  {photo ? (
                    <img src={photo} alt="" style={{ width:64, height:64, borderRadius:10, objectFit:"cover", flexShrink:0 }}/>
                  ) : (
                    <div style={{ width:64, height:64, borderRadius:10, background:C.lightGray, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>🐾</div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:badge.bg, color:badge.color, fontWeight:800 }}>{badge.text}</span>
                      {stockManaged && (
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:stock===0?"#FFEBEE":"#E3F2FD", color:stock===0?C.red:C.blue, fontWeight:800 }}>
                          📦 在庫{stock}
                        </span>
                      )}
                      {!stockManaged && (
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.lightGray, color:C.warmGray, fontWeight:700 }}>
                          ♾ 在庫管理なし
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.orange }}>¥{Number(l.price).toLocaleString()}</div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                  {/* 在庫管理 */}
                  {stockManaged ? (
                    <>
                      <button disabled={busy} onClick={()=>handleStockChange(l, -1)} style={miniBtnStyle(C.white, C.warmGray, busy)}>📦 在庫 −1</button>
                      <button disabled={busy} onClick={()=>handleStockChange(l, +1)} style={miniBtnStyle(C.white, C.green, busy)}>📦 在庫 +1</button>
                      <button disabled={busy} onClick={()=>handleDisableStock(l)} style={miniBtnStyle(C.white, C.warmGray, busy)}>♾ 在庫管理OFF</button>
                    </>
                  ) : (
                    <button disabled={busy} onClick={()=>handleEnableStock(l)} style={miniBtnStyle(C.white, C.blue, busy)}>📦 在庫管理ON</button>
                  )}
                  {/* 下書きの公開申請 (v3.1: 🚀 絵文字 + orange solid → 普通の line CTA) */}
                  {l.status === "draft" && (
                    <button disabled={busy} onClick={()=>handlePublishDraft(l)} style={miniBtnStyle(C.white, C.orange, busy)}>公開申請</button>
                  )}
                  {/* 編集 */}
                  <button disabled={busy} onClick={()=>setEditTarget(l)} style={miniBtnStyle(C.white, C.blue, busy)}>✏️ 編集</button>
                  {/* 削除 */}
                  <button disabled={busy} onClick={()=>setDeleteTarget(l)} style={miniBtnStyle(C.white, C.red, busy)}>🗑 削除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 編集モーダル */}
      {editTarget && (
        <ListingEditModal
          listing={editTarget}
          onClose={()=>setEditTarget(null)}
          onSaved={()=>{ setEditTarget(null); loadListings(); }}
        />
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:380, width:"100%" }}>
            <div style={{ fontSize:40, textAlign:"center", marginBottom:12 }}>🗑</div>
            <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, textAlign:"center", marginBottom:8 }}>本当に削除しますか？</h2>
            <p style={{ fontSize:12, color:C.warmGray, textAlign:"center", marginBottom:14, lineHeight:1.7 }}>
              「{deleteTarget.title}」<br/>
              ⚠️ この操作は取り消せません
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setDeleteTarget(null)} disabled={busy} style={{ flex:1, padding:"12px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit" }}>キャンセル</button>
              <button onClick={handleDelete} disabled={busy} style={{ flex:2, padding:"12px", background:busy?C.warmGray:C.red, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit" }}>{busy ? "削除中..." : "🗑 削除する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── 小さなボタン用スタイル ──
// miniBtnStyle は utils/format.ts へ移動 (Phase 1 ③)

// ── 出品編集モーダル ─────────────────────────────────────────────────
// ListingEditModal は components/ListingEditModal.tsx へ移動 (Phase6 6b Step A 循環import回避)

const SalesTab = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState("active");
  const [busy, setBusy] = useState(false);

  const loadSales = async () => {
    if (!user?.id) return;
    setLoading(true);
    // 依頼書 #104 Phase B-2 (2026/6/3): shipping_fee / shipping_region / shipping_total 追加 (Phase A DDL 完了済)
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, escrow_status, transfer_status, amount, shipping_fee, shipping_region, shipping_total, created_at, delivered_at, completed_at, listing_id, buyer_id, shipping_address_id")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) { console.error("sales fetch error:", error); setLoading(false); return; }

    const listingIds = Array.from(new Set((data || []).map(o => o.listing_id).filter(Boolean)));
    const buyerIds = Array.from(new Set((data || []).map(o => o.buyer_id).filter(Boolean)));

    const [{ data: listings }, { data: buyers }] = await Promise.all([
      listingIds.length ? supabase.from("listings").select("id, title, image_urls, delivery_type").in("id", listingIds) : Promise.resolve({ data: [] }),
      buyerIds.length ? supabase.from("profiles").select("id, display_name").in("id", buyerIds) : Promise.resolve({ data: [] }),
    ]);

    const listingMap = new Map((listings || []).map(l => [l.id, l]));
    const buyerMap = new Map((buyers || []).map(b => [b.id, b]));

    const enriched = (data || []).map(o => ({
      ...o,
      listing: listingMap.get(o.listing_id),
      buyer: buyerMap.get(o.buyer_id),
    }));

    setSales(enriched);
    setLoading(false);
  };

  useEffect(() => { loadSales(); }, [user?.id]);

  // フィルタ：active=対応中(pending+working+delivered+disputed) / completed=完了 / cancelled=キャンセル系
  const filtered = sales.filter(o => {
    if (filter === "active") return ["pending", "working", "delivered", "disputed"].includes(o.status);
    if (filter === "completed") return o.status === "completed";
    if (filter === "cancelled") return ["cancelled", "refunded"].includes(o.status);
    return true;
  });

  const statusLabel = (s) => {
    const map = { pending:{text:"注文確定",bg:C.orangePale,color:C.orange}, working:{text:"作業中",bg:"#E3F2FD",color:C.blue}, delivered:{text:"納品済み",bg:"#FFF3E0",color:C.orange}, completed:{text:"取引完了",bg:C.greenPale,color:C.green}, disputed:{text:"異議中",bg:"#FFEBEE",color:C.red}, refunded:{text:"返金済み",bg:"#FFEBEE",color:C.red}, cancelled:{text:"キャンセル",bg:C.lightGray,color:C.warmGray} };
    return map[s] || {text:s,bg:C.lightGray,color:C.warmGray};
  };

  const startWork = async (orderId: string) => {
    if (!confirm("作業を開始しますか？")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("orders").update({ status: "working", updated_at: new Date().toISOString() }).eq("id", orderId);
      if (error) throw error;
      await loadSales();
    } catch(e: any) { alert("エラー: "+e.message); }
    finally { setBusy(false); }
  };

  const markDelivered = async (orderId: string) => {
    if (!confirm("納品完了として通知しますか？\n購入者が受取確認したら売上が支払われます。")) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("orders").update({ status: "delivered", delivered_at: now, updated_at: now }).eq("id", orderId);
      if (error) throw error;
      await loadSales();
    } catch(e: any) { alert("エラー: "+e.message); }
    finally { setBusy(false); }
  };

  const formatDate = (s?: string) => s ? new Date(s).toLocaleDateString("ja-JP").replace(/\//g, ".") : "";
  const photoUrl = (l?: any) => Array.isArray(l?.image_urls) && l.image_urls.length ? l.image_urls[0] : null;

  return (
    <div>
      <div style={{ background:C.orangePale, borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:11, color:C.dark, lineHeight:1.6 }}>
        💡 受けた注文の管理画面です。作業状況を更新すると購入者に通知されます。
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
        {[["active","対応中"],["completed","完了"],["cancelled","キャンセル"],["all","すべて"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            flexShrink:0, padding:"6px 14px", border:`1.5px solid ${filter===v?C.orange:C.border}`,
            borderRadius:10, background:filter===v?C.orangePale:C.white,
            color:filter===v?C.orange:C.warmGray, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"48px 20px", color:C.warmGray, fontSize:13 }}>読み込み中…</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🛍️</div>
          <div style={{ fontWeight:700, color:C.warmGray }}>該当する販売がありません</div>
          <div style={{ fontSize:11, color:C.warmGray, marginTop:6 }}>注文が入るとここに表示されます</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.map(sale => {
            const st = statusLabel(sale.status);
            const title = sale.listing?.title || "（削除された商品）";
            const buyerName = sale.buyer?.display_name || "—";
            const img = photoUrl(sale.listing);
            const isShipping = sale.listing?.delivery_type === "shipping";
            return (
              <div key={sale.id} onClick={()=>setSelected(selected?.id===sale.id?null:sale)} style={{
                background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", cursor:"pointer"
              }}>
                <div style={{ padding:"16px", display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:img?`url(${img}) center/cover`:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                    {!img && "🛍️"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</span>
                      <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6, flexShrink:0 }}>{st.text}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.warmGray }}>
                      購入者: {buyerName} · {formatDate(sale.created_at)}
                      {sale.shipping_region && <span style={{ marginLeft:6, color:C.orange, fontWeight:700 }}>· 📍 {sale.shipping_region}</span>}
                    </div>
                    {/* 依頼書 #104 Phase B-2 (2026/6/3): 送料込み売上 (shipping_total > 0 なら shipping_fee 内訳表示) */}
                    <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginTop:4 }}>
                      ¥{Number(sale.shipping_total || sale.amount || 0).toLocaleString()}
                      {(sale.shipping_fee || 0) > 0 && (
                        <span style={{ fontSize:11, fontWeight:400, color:C.warmGray, marginLeft:6 }}>(うち送料 ¥{Number(sale.shipping_fee).toLocaleString()})</span>
                      )}
                    </div>
                  </div>
                </div>

                {selected?.id===sale.id && (
                  <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px", background:C.lightGray }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.warmGray, marginBottom:4 }}>注文番号: {sale.id.slice(0, 8)}</div>
                    <OrderStatusBar status={sale.status}/>

                    {isShipping && sale.shipping_address_id && (
                      <div style={{ background:C.orangePale, borderRadius:12, padding:"10px 14px", marginTop:10, fontSize:11, color:C.dark, lineHeight:1.6 }}>
                        🔒 配送先住所が登録されています。<br/>
                        メッセージタブの取引メッセージから詳細を確認できます。<br/>
                        <span style={{ fontSize:10, color:C.warmGray }}>※ 取引完了後30日で自動削除されます</span>
                      </div>
                    )}

                    <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                      {sale.status==="pending" && (
                        <button disabled={busy} onClick={(e)=>{e.stopPropagation();startWork(sale.id);}} style={{
                          flex:1, minWidth:140, padding:"11px", background:C.blue, border:"none", borderRadius:10,
                          color:"#fff", fontWeight:800, fontSize:13, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit", opacity:busy?0.6:1
                        }}>🎨 作業を開始</button>
                      )}
                      {sale.status==="working" && (
                        <button disabled={busy} onClick={(e)=>{e.stopPropagation();markDelivered(sale.id);}} style={{
                          flex:1, minWidth:140, padding:"11px", background:C.orange, border:"none", borderRadius:10,
                          color:"#fff", fontWeight:800, fontSize:13, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit", opacity:busy?0.6:1
                        }}>📦 納品完了として通知</button>
                      )}
                      {sale.status==="delivered" && (
                        <div style={{ flex:1, padding:"11px", background:"#FFF3E0", borderRadius:10, color:C.orange, fontWeight:700, fontSize:12, textAlign:"center" }}>
                          購入者の受取確認待ち（72時間後に自動完了）
                        </div>
                      )}
                      {sale.status==="completed" && (
                        <div style={{ flex:1, padding:"11px", background:C.greenPale, borderRadius:10, color:C.green, fontWeight:700, fontSize:12, textAlign:"center" }}>
                          ✅ 取引完了 · 売上反映済み
                        </div>
                      )}
                      {sale.status==="disputed" && (
                        <div style={{ flex:1, padding:"11px", background:"#FFEBEE", borderRadius:10, color:C.red, fontWeight:700, fontSize:12, textAlign:"center" }}>
                          ⚠️ 異議申し立て中（運営にて対応中）
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Dispute Modal ─────────────────────────────────────────────────────────
const DisputeModal = ({ order, onClose, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [desc, setDesc] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = () => {
    onSubmit(order.id, reason, desc || DISPUTE_REASONS.find(r=>r.id===reason)?.label);
    setDone(true);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:C.white, borderRadius:"24px 24px 0 0", padding:"28px 20px", width:"100%", maxWidth:500, maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        {done ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>異議を受け付けました</div>
            <div style={{ fontSize:13, color:C.warmGray, marginBottom:4 }}>エスクローは保留中です。48時間以内にサポートからご連絡いたします。</div>
            <div style={{ background:C.orangePale, borderRadius:10, padding:"10px", margin:"12px 0", fontSize:12, color:C.orange }}>自動メッセージ: 出品者にも通知が送信されました。</div>
            <button onClick={onClose} style={{ padding:"12px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>閉じる</button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>⚠️ 問題を報告</div>
              <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            <div style={{ background:C.lightGray, borderRadius:12, padding:"12px", marginBottom:16, fontSize:12, color:C.dark }}>
              <div style={{ fontWeight:700 }}>{order.item}</div>
              <div style={{ color:C.warmGray, marginTop:2 }}>{order.id} · ¥{order.price.toLocaleString()}</div>
            </div>

            {step===1 && (
              <>
                <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:12 }}>理由を選択してください</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                  {DISPUTE_REASONS.map(r=>(
                    <button key={r.id} onClick={()=>setReason(r.id)} style={{
                      padding:"12px 14px", border:`2px solid ${reason===r.id?C.orange:C.border}`,
                      borderRadius:12, background:reason===r.id?C.orangePale:C.white,
                      color:reason===r.id?C.orange:C.dark, fontWeight:700, fontSize:13,
                      cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                      display:"flex", alignItems:"center", gap:10
                    }}><span style={{ fontSize:18 }}>{r.icon}</span>{r.label}</button>
                  ))}
                </div>
                <button onClick={()=>reason&&setStep(2)} disabled={!reason} style={{
                  width:"100%", padding:"13px", background:reason?C.orange:C.border,
                  border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14,
                  cursor:reason?"pointer":"not-allowed", fontFamily:"inherit"
                }}>次へ →</button>
              </>
            )}

            {step===2 && (
              <>
                <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:12 }}>詳細を教えてください</div>
                <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={4}
                  placeholder="具体的にどのような問題がありましたか？（写真があれば添付してください）"
                  style={{ width:"100%", padding:"12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:12 }}
                />
                <div style={{ background:C.orangePale, borderRadius:10, padding:"10px", marginBottom:16, fontSize:11, color:C.orange, lineHeight:1.6 }}>
                  🔒 エスクローは自動的に保留されます。出品者に48時間の回答期限が設定されます。回答がない場合は自動的に返金されます。
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>setStep(1)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>← 戻る</button>
                  <button onClick={handleSubmit} style={{ flex:2, padding:"13px", background:C.red, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>⚠️ 異議を申し立てる</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Messages Tab ──────────────────────────────────────────────────────────
// ── 連絡先検出フィルター ──────────────────────────────────────────────────
// 取引前のメッセージで連絡先交換を防ぐ
// detectContacts / detectNGWords は utils/moderation.ts へ移動 (Phase 1 ④) ※決済防御の心臓部

// ── 取引メッセージタブ（OrderMessagesTab） ────────────────────────────────
const OrderMessagesTab = () => {
  const { user } = useAuth();
  const [convos, setConvos] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [shippingAddr, setShippingAddr] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<{ types: string[]; original: string; masked: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConvos = async () => {
    if (!user) return;
    setLoading(true);
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, buyer_id, seller_id, listing_id, created_at")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (!orders) { setLoading(false); return; }
    const partnerIds = [...new Set(orders.map(o => o.buyer_id === user.id ? o.seller_id : o.buyer_id))];
    const listingIds = [...new Set(orders.map(o => o.listing_id).filter(Boolean))];
    const [{ data: profs }, { data: lists }, { data: lastMsgs }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url").in("id", partnerIds),
      listingIds.length ? supabase.from("listings").select("id, title").in("id", listingIds) : Promise.resolve({ data: [] }),
      supabase.from("order_messages").select("order_id, content, created_at, recipient_id, is_read").in("order_id", orders.map(o=>o.id)).order("created_at", { ascending: false }),
    ]);
    const profMap = Object.fromEntries((profs||[]).map(p=>[p.id, p]));
    const listMap = Object.fromEntries((lists||[]).map(l=>[l.id, l]));
    const lastMsgMap: Record<string, any> = {};
    const unreadMap: Record<string, number> = {};
    (lastMsgs || []).forEach((m:any) => {
      if (!lastMsgMap[m.order_id]) lastMsgMap[m.order_id] = m;
      if (m.recipient_id === user.id && !m.is_read) {
        unreadMap[m.order_id] = (unreadMap[m.order_id] || 0) + 1;
      }
    });
    const list = orders.map(o => {
      const partnerId = o.buyer_id === user.id ? o.seller_id : o.buyer_id;
      const partner = profMap[partnerId];
      const listing = listMap[o.listing_id];
      const lastMsg = lastMsgMap[o.id];
      return {
        order_id: o.id,
        status: o.status,
        seller_id: o.seller_id,
        buyer_id: o.buyer_id,
        partner_id: partnerId,
        partner_name: partner?.display_name || "ユーザー",
        partner_avatar: partner?.avatar_url,
        listing_title: listing?.title || "(商品名なし)",
        last_msg: lastMsg?.content || "まだメッセージがありません",
        last_msg_date: lastMsg?.created_at,
        unread: unreadMap[o.id] || 0,
      };
    });
    setConvos(list);
    setLoading(false);
  };

  useEffect(() => { fetchConvos(); }, [user?.id]);

  const fetchMessages = async (orderId:string) => {
    const { data } = await supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
    setMessages(data || []);
    // 配送先住所を取得（出品者向けに表示するため）
    const { data: addr } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("order_id", orderId)
      .is("delete_at", null)
      .maybeSingle();
    if (!addr) {
      // 削除予定があるかも確認（30日以内なら表示）
      const { data: addrWithDelete } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("order_id", orderId)
        .gt("delete_at", new Date().toISOString())
        .maybeSingle();
      setShippingAddr(addrWithDelete);
    } else {
      setShippingAddr(addr);
    }
    if (user) {
      await supabase.from("order_messages").update({ is_read: true }).eq("order_id", orderId).eq("recipient_id", user.id).eq("is_read", false);
    }
  };

  useEffect(() => { if (selected) fetchMessages(selected.order_id); }, [selected?.order_id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || !selected || sending) return;
    const detection = detectContacts(input);
    const isCompleted = selected.status === "completed";
    if (detection.found && !isCompleted) {
      if (warning && warning.original === input) {
        setSending(true);
        await supabase.from("order_messages").insert({
          order_id: selected.order_id, sender_id: user.id, recipient_id: selected.partner_id,
          content: warning.masked, has_warning: true,
        });
        setInput(""); setWarning(null);
        await fetchMessages(selected.order_id);
        setSending(false);
        return;
      }
      setWarning({ types: detection.types, original: input, masked: detection.masked });
      return;
    }
    setSending(true);
    await supabase.from("order_messages").insert({
      order_id: selected.order_id, sender_id: user.id, recipient_id: selected.partner_id,
      content: input, has_warning: false,
    });
    setInput(""); setWarning(null);
    await fetchMessages(selected.order_id);
    setSending(false);
  };

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>読み込み中...</div>;

  return (
    <div>
      {!selected ? (
        convos.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>💬</div>
            <div>取引メッセージはまだありません</div>
            <div style={{ fontSize:11, marginTop:6 }}>商品を購入すると、ここに取引相手とのメッセージが表示されます</div>
          </div>
        ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {convos.map(c=>(
            <button key={c.order_id} onClick={()=>setSelected(c)} style={{
              background:C.white, borderRadius:14, padding:"14px", border:`1px solid ${C.border}`,
              cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:12, width:"100%"
            }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background: c.partner_avatar ? `url(${c.partner_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:C.orange, flexShrink:0 }}>{!c.partner_avatar && (c.partner_name||"?").charAt(0).toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{c.partner_name}</span>
                  <span style={{ fontSize:10, color:C.warmGray }}>{c.last_msg_date ? new Date(c.last_msg_date).toLocaleDateString("ja-JP") : ""}</span>
                </div>
                <div style={{ fontSize:11, color:C.warmGray, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.listing_title} · {c.status === "completed" ? "✅ 取引完了" : c.status === "working" ? "🔧 作業中" : c.status === "delivered" ? "📦 納品済み" : "🛒 取引中"}</div>
                <div style={{ fontSize:12, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.last_msg}</div>
              </div>
              {c.unread>0 && <div style={{ width:20, height:20, borderRadius:"50%", background:C.orange, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{c.unread}</div>}
            </button>
          ))}
        </div>
        )
      ) : (
        <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>{setSelected(null); setShippingAddr(null); setWarning(null); setInput("");}} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.orange }}>←</button>
            <div style={{ width:32, height:32, borderRadius:"50%", background: selected.partner_avatar ? `url(${selected.partner_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:C.orange, flexShrink:0 }}>{!selected.partner_avatar && (selected.partner_name||"?").charAt(0).toUpperCase()}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{selected.partner_name}</div>
              <div style={{ fontSize:10, color:C.warmGray }}>{selected.listing_title}</div>
            </div>
          </div>

          {/* 配送先住所バナー（出品者にのみ表示） */}
          {shippingAddr && selected.seller_id === user?.id && (
            <div style={{ padding:"12px 16px", background:"#FFF8F0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>📦 配送先住所</span>
                {shippingAddr.delete_at && (
                  <span style={{ fontSize:9, padding:"2px 6px", background:"#FFE0B2", color:"#E65100", borderRadius:4, fontWeight:700 }}>
                    {Math.ceil((new Date(shippingAddr.delete_at).getTime() - Date.now()) / (1000*60*60*24))}日後に自動削除
                  </span>
                )}
              </div>
              <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.6 }}>
                <div><strong style={{ color:C.dark }}>{shippingAddr.recipient_name}</strong> 様</div>
                <div>〒{shippingAddr.postal_code}</div>
                <div>{shippingAddr.prefecture}{shippingAddr.city}{shippingAddr.address_line}</div>
                <div>📱 {shippingAddr.phone}</div>
              </div>
              <div style={{ fontSize:10, color:C.warmGray, marginTop:6, padding:"6px 8px", background:"#FFF", borderRadius:6 }}>
                ⚠️ この情報は配送目的のみに使用してください。第三者への漏洩は規約違反となります。
              </div>
            </div>
          )}

          {selected.status !== "completed" && (
            <div style={{ padding:"8px 16px", background:"#FFF8E1", borderBottom:`1px solid ${C.border}`, fontSize:11, color:"#996200", display:"flex", alignItems:"center", gap:6 }}>
              ⚠️ 取引完了前は外部連絡先（電話・メール・SNS等）の交換は禁止されています
            </div>
          )}

          <div style={{ padding:"16px", minHeight:250, maxHeight:400, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, background:"#FAFAF8" }}>
            {messages.length === 0 && (
              <div style={{ textAlign:"center", color:C.warmGray, fontSize:12, padding:"20px 0" }}>まだメッセージがありません<br/>最初のメッセージを送ってみましょう</div>
            )}
            {messages.map((m)=>(
              <div key={m.id} style={{ display:"flex", justifyContent:m.sender_id===user?.id?"flex-end":"flex-start" }}>
                <div style={{
                  maxWidth:"75%", padding:"10px 14px", borderRadius:14,
                  background:m.sender_id===user?.id?C.orange:"#F0EFEC",
                  color:m.sender_id===user?.id?"#fff":C.dark,
                  borderBottomRightRadius:m.sender_id===user?.id?4:14,
                  borderBottomLeftRadius:m.sender_id===user?.id?14:4,
                }}>
                  <div style={{ fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.content}</div>
                  <div style={{ fontSize:9, marginTop:4, opacity:0.5, textAlign:"right" }}>{new Date(m.created_at).toLocaleString("ja-JP", { hour:"2-digit", minute:"2-digit", month:"numeric", day:"numeric" })}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>

          {warning && (
            <div style={{ padding:"12px 16px", background:"#FFE5E5", borderTop:`1px solid #FFB3B3` }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#C62828", marginBottom:6 }}>⚠️ 連絡先が含まれています ({warning.types.join(", ")})</div>
              <div style={{ fontSize:11, color:"#666", marginBottom:8, lineHeight:1.5 }}>取引完了前のサイト外連絡は規約違反です。<br/>取引完了後はそのまま送信できます。</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setWarning(null)} style={{ flex:1, padding:"8px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.dark }}>修正する</button>
                <button onClick={handleSend} style={{ flex:1, padding:"8px", background:"#FFB3B3", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>***でマスク送信</button>
              </div>
            </div>
          )}

          <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
            <input
              value={input}
              onChange={e=>{setInput(e.target.value); if (warning) setWarning(null);}}
              onKeyDown={e=>{ if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); handleSend(); } }}
              placeholder="メッセージを入力..."
              disabled={sending}
              style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            <button onClick={handleSend} disabled={!input.trim() || sending} style={{ padding:"10px 16px", background: !input.trim() || sending ? "#ccc" : C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:13, cursor: !input.trim() || sending ? "not-allowed" : "pointer", fontFamily:"inherit" }}>{sending ? "..." : "送信"}</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── DMタブ（DirectMessagesTab） ─────────────────────────────────────────
const DirectMessagesTab = () => {
  const { user } = useAuth();
  const [convos, setConvos] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<{ types: string[]; original: string; masked: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // DM会話一覧を取得（自分が関わるDM）
  const fetchConvos = async () => {
    if (!user) return;
    setLoading(true);
    // 自分が関わるDMをすべて取得
    const { data: dms } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (!dms) { setLoading(false); return; }

    // 会話相手ごとにグループ化（最新のメッセージだけ残す）
    const convoMap: Record<string, any> = {};
    for (const m of dms) {
      const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      if (!convoMap[partnerId]) {
        convoMap[partnerId] = { partner_id: partnerId, last_msg: m.content, last_msg_date: m.created_at, unread: 0 };
      }
      if (m.recipient_id === user.id && !m.is_read) convoMap[partnerId].unread++;
    }
    const partnerIds = Object.keys(convoMap);
    if (partnerIds.length === 0) { setConvos([]); setLoading(false); return; }

    const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", partnerIds);
    const profMap = Object.fromEntries((profs||[]).map(p=>[p.id, p]));

    // 自分が誰をフォローしているか
    const { data: myFollowing } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    const followingSet = new Set((myFollowing||[]).map((f:any)=>f.following_id));

    const list = partnerIds.map(pid => ({
      ...convoMap[pid],
      partner_name: profMap[pid]?.display_name || "ユーザー",
      partner_avatar: profMap[pid]?.avatar_url,
      is_following: followingSet.has(pid),
    })).sort((a,b) => new Date(b.last_msg_date).getTime() - new Date(a.last_msg_date).getTime());

    setConvos(list);
    setLoading(false);
  };

  useEffect(() => { fetchConvos(); }, [user?.id]);

  // プロフィールページからの「💬 メッセージ」イベントを受信
  useEffect(() => {
    const handleOpenDM = async (e: any) => {
      const partnerId = e.detail?.partnerId;
      if (!partnerId || !user) return;
      // プロフィール取得
      const { data: prof } = await supabase.from("profiles").select("id, display_name, avatar_url").eq("id", partnerId).single();
      // フォロー状況確認
      const { data: fol } = await supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", partnerId).maybeSingle();
      setSelected({
        partner_id: partnerId,
        partner_name: prof?.display_name || "ユーザー",
        partner_avatar: prof?.avatar_url,
        is_following: !!fol,
        last_msg: "",
        last_msg_date: new Date().toISOString(),
        unread: 0,
      });
    };
    window.addEventListener("openDM", handleOpenDM);
    return () => window.removeEventListener("openDM", handleOpenDM);
  }, [user?.id]);

  const fetchMessages = async (partnerId:string) => {
    if (!user) return;
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    await supabase.from("direct_messages").update({ is_read: true }).eq("sender_id", partnerId).eq("recipient_id", user.id).eq("is_read", false);
  };

  useEffect(() => { if (selected) fetchMessages(selected.partner_id); }, [selected?.partner_id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || !selected || sending) return;
    if (!selected.is_following) {
      alert("メッセージを送るには、まず相手をフォローしてください");
      return;
    }
    // 相互フォローか確認
    const { data: mutual } = await supabase.from("follows").select("id").eq("follower_id", selected.partner_id).eq("following_id", user.id).maybeSingle();
    const isMutual = !!mutual;

    const detection = detectContacts(input);
    // 一方フォローのみで連絡先検出 → 警告
    if (detection.found && !isMutual) {
      if (warning && warning.original === input) {
        setSending(true);
        const { error } = await supabase.from("direct_messages").insert({
          sender_id: user.id, recipient_id: selected.partner_id,
          content: warning.masked, has_warning: true, is_mutual: false,
        });
        if (error) alert("送信に失敗しました: " + error.message);
        setInput(""); setWarning(null);
        await fetchMessages(selected.partner_id);
        setSending(false);
        return;
      }
      setWarning({ types: detection.types, original: input, masked: detection.masked });
      return;
    }

    // 通常送信（相互フォローなら連絡先OK）
    setSending(true);
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, recipient_id: selected.partner_id,
      content: input, has_warning: false, is_mutual: isMutual,
    });
    if (error) alert("送信に失敗しました: " + error.message);
    setInput(""); setWarning(null);
    await fetchMessages(selected.partner_id);
    setSending(false);
  };

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>読み込み中...</div>;

  return (
    <div>
      {!selected ? (
        convos.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>✉️</div>
            <div>DMはまだありません</div>
            <div style={{ fontSize:11, marginTop:6 }}>気になる出品者のプロフィールから<br/>「💬 メッセージ」でDMを送れます</div>
          </div>
        ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {convos.map(c=>(
            <button key={c.partner_id} onClick={()=>setSelected(c)} style={{
              background:C.white, borderRadius:14, padding:"14px", border:`1px solid ${C.border}`,
              cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:12, width:"100%"
            }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background: c.partner_avatar ? `url(${c.partner_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:C.orange, flexShrink:0 }}>{!c.partner_avatar && (c.partner_name||"?").charAt(0).toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{c.partner_name}</span>
                  <span style={{ fontSize:10, color:C.warmGray }}>{new Date(c.last_msg_date).toLocaleDateString("ja-JP")}</span>
                </div>
                <div style={{ fontSize:12, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.last_msg}</div>
              </div>
              {c.unread>0 && <div style={{ width:20, height:20, borderRadius:"50%", background:C.orange, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{c.unread}</div>}
            </button>
          ))}
        </div>
        )
      ) : (
        <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>{setSelected(null); setWarning(null); setInput("");}} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.orange }}>←</button>
            <div style={{ width:32, height:32, borderRadius:"50%", background: selected.partner_avatar ? `url(${selected.partner_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:C.orange, flexShrink:0 }}>{!selected.partner_avatar && (selected.partner_name||"?").charAt(0).toUpperCase()}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{selected.partner_name}</div>
              <div style={{ fontSize:10, color:C.warmGray }}>{selected.is_following ? "フォロー中" : "未フォロー"}</div>
            </div>
          </div>

          <div style={{ padding:"16px", minHeight:250, maxHeight:400, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, background:"#FAFAF8" }}>
            {messages.length === 0 && (
              <div style={{ textAlign:"center", color:C.warmGray, fontSize:12, padding:"20px 0" }}>まだメッセージがありません</div>
            )}
            {messages.map((m)=>(
              <div key={m.id} style={{ display:"flex", justifyContent:m.sender_id===user?.id?"flex-end":"flex-start" }}>
                <div style={{
                  maxWidth:"75%", padding:"10px 14px", borderRadius:14,
                  background:m.sender_id===user?.id?C.orange:"#F0EFEC",
                  color:m.sender_id===user?.id?"#fff":C.dark,
                  borderBottomRightRadius:m.sender_id===user?.id?4:14,
                  borderBottomLeftRadius:m.sender_id===user?.id?14:4,
                }}>
                  <div style={{ fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.content}</div>
                  <div style={{ fontSize:9, marginTop:4, opacity:0.5, textAlign:"right" }}>{new Date(m.created_at).toLocaleString("ja-JP", { hour:"2-digit", minute:"2-digit", month:"numeric", day:"numeric" })}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>

          {warning && (
            <div style={{ padding:"12px 16px", background:"#FFE5E5", borderTop:`1px solid #FFB3B3` }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#C62828", marginBottom:6 }}>⚠️ 連絡先が含まれています ({warning.types.join(", ")})</div>
              <div style={{ fontSize:11, color:"#666", marginBottom:8, lineHeight:1.5 }}>相互フォロー（お互いをフォロー）すれば連絡先交換できます。<br/>今は一方フォローなのでマスク送信になります。</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setWarning(null)} style={{ flex:1, padding:"8px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.dark }}>修正する</button>
                <button onClick={handleSend} style={{ flex:1, padding:"8px", background:"#FFB3B3", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>***でマスク送信</button>
              </div>
            </div>
          )}

          {!selected.is_following ? (
            <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, background:"#FFF8E1", textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#996200" }}>このユーザーをフォローするとメッセージを送信できます</div>
            </div>
          ) : (
            <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <input
                value={input}
                onChange={e=>{setInput(e.target.value); if (warning) setWarning(null);}}
                onKeyDown={e=>{ if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); handleSend(); } }}
                placeholder="メッセージを入力..."
                disabled={sending}
                style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              <button onClick={handleSend} disabled={!input.trim() || sending} style={{ padding:"10px 16px", background: !input.trim() || sending ? "#ccc" : C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:13, cursor: !input.trim() || sending ? "not-allowed" : "pointer", fontFamily:"inherit" }}>{sending ? "..." : "送信"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── メッセージタブ（取引メッセージ + DMの切り替え） ──────────────────────
const MessagesTab = () => {
  const [subTab, setSubTab] = useState<"order" | "dm">("order");
  useEffect(() => {
    const handleOpenDM = () => setSubTab("dm");
    window.addEventListener("openDM", handleOpenDM);
    return () => window.removeEventListener("openDM", handleOpenDM);
  }, []);
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14, background:C.lightGray, borderRadius:12, padding:4 }}>
        <button onClick={()=>setSubTab("order")} style={{ flex:1, padding:"8px", background: subTab === "order" ? C.white : "transparent", border:"none", borderRadius:8, fontSize:12, fontWeight:800, color: subTab === "order" ? C.orange : C.warmGray, cursor:"pointer", fontFamily:"inherit", boxShadow: subTab === "order" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}>📦 取引</button>
        <button onClick={()=>setSubTab("dm")} style={{ flex:1, padding:"8px", background: subTab === "dm" ? C.white : "transparent", border:"none", borderRadius:8, fontSize:12, fontWeight:800, color: subTab === "dm" ? C.orange : C.warmGray, cursor:"pointer", fontFamily:"inherit", boxShadow: subTab === "dm" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}>✉️ DM</button>
      </div>
      {subTab === "order" ? <OrderMessagesTab/> : <DirectMessagesTab/>}
    </div>
  );
};


// ── Notifications Tab ─────────────────────────────────────────────────────
const NotificationsTab = () => {
  // 通知DBは未実装。実装までは空状態で運用。
  return (
    <div style={{ textAlign:"center", padding:"48px 20px" }}>
      <div style={{ fontSize:40, marginBottom:8 }}>🔔</div>
      <div style={{ fontWeight:700, color:C.warmGray, marginBottom:6 }}>新しい通知はありません</div>
      <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.6 }}>
        重要なお知らせは登録メールアドレス宛にお送りしています。<br/>
        メッセージタブの取引メッセージ・DMもご確認ください。
      </div>
    </div>
  );
};

// ── Support Tab ───────────────────────────────────────────────────────────
const SupportTab = () => {
  // お問い合わせ表記との整合性確保のためのサポートタブ
  const supportEmail = "support@qocca.pet";
  return (
    <div>
      <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:14 }}>🎧 サポート</div>

      {/* ヘルプセンター */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"20px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>📚 ヘルプセンター</div>
        <div style={{ fontSize:12, color:"#555", lineHeight:1.7, marginBottom:14 }}>
          よくあるご質問や使い方をまとめています。お問い合わせの前にご確認ください。
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:8 }}>
          <a href="/help/getting-started" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.cream, borderRadius:10, textDecoration:"none", color:C.dark, fontSize:12, fontWeight:700 }}>
            <span style={{ fontSize:18 }}>📝</span>
            <span style={{ flex:1 }}>出品の始め方</span>
            <span style={{ color:C.orange }}>→</span>
          </a>
          <a href="/help/stripe-connect" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.cream, borderRadius:10, textDecoration:"none", color:C.dark, fontSize:12, fontWeight:700 }}>
            <span style={{ fontSize:18 }}>💳</span>
            <span style={{ flex:1 }}>Stripe Connect 登録ガイド</span>
            <span style={{ color:C.orange }}>→</span>
          </a>
          <a href="/help/buying" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.cream, borderRadius:10, textDecoration:"none", color:C.dark, fontSize:12, fontWeight:700 }}>
            <span style={{ fontSize:18 }}>🛒</span>
            <span style={{ flex:1 }}>購入ガイド</span>
            <span style={{ color:C.orange }}>→</span>
          </a>
          <a href="/help" style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"8px 14px", color:C.warmGray, fontSize:11, fontWeight:700, textDecoration:"none" }}>
            ヘルプ一覧を見る →
          </a>
        </div>
      </div>

      {/* メッセージ機能（準備中） */}
      <div style={{ background:"#FFF8E7", borderRadius:16, border:`1px solid #F0D898`, padding:"16px 20px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:"#8B6914", marginBottom:6 }}>💬 アプリ内サポートメッセージ</div>
        <div style={{ fontSize:12, color:"#8B6914", lineHeight:1.7 }}>
          現在、こちらの機能は準備中です。<br/>
          お問い合わせは下記の方法でお願いいたします。
        </div>
      </div>

      {/* メールでお問い合わせ */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"20px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>📧 メールでお問い合わせ</div>
        <div style={{ fontSize:12, color:"#555", lineHeight:1.7, marginBottom:14 }}>
          ヘルプで解決しない場合はメールでお問い合わせください。<br/>
          件名に「お問い合わせ」と注文番号（お持ちの場合）をご記入ください。
        </div>
        <a href={`mailto:${supportEmail}?subject=Qocca%20%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B`}
          style={{ display:"inline-block", padding:"10px 18px", background:C.orange, color:"#fff", borderRadius:10, fontWeight:800, fontSize:13, textDecoration:"none" }}>
          {supportEmail}
        </a>
      </div>

      {/* Instagram DM */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"20px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>📷 Instagram DM</div>
        <div style={{ fontSize:12, color:"#555", lineHeight:1.7, marginBottom:14 }}>
          Instagram からもお問い合わせいただけます。
        </div>
        <a href="https://www.instagram.com/qocca_pet/" target="_blank" rel="noopener noreferrer"
          style={{ display:"inline-block", padding:"10px 18px", background:"#E4405F", color:"#fff", borderRadius:10, fontWeight:800, fontSize:13, textDecoration:"none" }}>
          @qocca_pet
        </a>
      </div>

      {/* 対応時間 */}
      <div style={{ background:C.cream, borderRadius:12, padding:"14px 18px", fontSize:12, color:C.warmGray, lineHeight:1.7 }}>
        <strong style={{ color:C.dark }}>📅 対応時間</strong><br/>
        平日 10:00〜18:00（土日祝休み）<br/>
        通常 48 時間以内にご返信いたします。<br/>
        ※ 緊急の不正利用報告は 24 時間受付
      </div>
    </div>
  );
};

// BlogPage は pages/gallery.tsx へ移動 (Phase5 ②gallery)

// ── Pet Facilities (ドッグラン・ペット施設マップ) ──────────────────────────
// FACILITY_CATS / MOOD_TAGS / FACILITY_REPORT_REASONS / FACILITY_NG_WORDS は constants/data.ts へ移動 (Phase 1 ②)

// checkFacilityNGWords は utils/moderation.ts へ移動 (Phase 1 ④)


// PREFS は constants/data.ts へ移動 (Phase 1 ②)

// 施設マップ群 (facilityDisplayDesc/FacilityMapView/FacilitiesPage/FacilityDetailView/FacilityVisitForm/FacilityReportModal/FacilityCorrectionForm) は pages/facilities.tsx へ移動 (Phase5 ④facilities)

// GalleryPage は pages/gallery.tsx へ移動 (Phase5 ②gallery)

// ============================================================================
// PhoneVerificationPage (v3.2 第29-30章: 1人=1アカウント、Stripe JCB違反者再登録防止)
// Twilio Verify API 経由で SMS OTP 認証、住民の任意機能 (出品者推奨)
// ============================================================================
const PhoneVerificationPage = ({ setPage }: any) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phoneNumber, setPhoneNumber] = useState("+81");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // 既に認証済みかチェック (Step 1 初期表示時)
  const [alreadyVerified, setAlreadyVerified] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("account_phone_verification")
        .select("phone_number, verified_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.verified_at) {
        setAlreadyVerified(true);
        setPhoneNumber(data.phone_number);
        setStep(3);
      } else {
        setAlreadyVerified(false);
      }
    })();
  }, [user?.id]);

  const handleSendCode = async () => {
    setError(null);
    if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      setError("国際形式で入力してください (例: +818012345678)");
      return;
    }
    setBusy(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("send-verification-code", {
        body: { phone_number: phoneNumber },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) {
        if (data.error === "rate_limited" && data.retry_after_seconds) {
          setRetryAfter(data.retry_after_seconds);
        }
        setError(data.message || data.error);
        return;
      }
      setStep(2);
    } catch (e: any) {
      setError(e?.message || "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (!/^\d{4,10}$/.test(code)) {
      setError("コードは数字のみで入力してください");
      return;
    }
    setBusy(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("verify-code", {
        body: { phone_number: phoneNumber, code },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) {
        setError(data.message || data.error);
        return;
      }
      if (data?.success && data?.verified) {
        setStep(3);
        setAlreadyVerified(true);
      } else {
        setError(data?.message || "認証に失敗しました");
      }
    } catch (e: any) {
      setError(e?.message || "認証に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleBackToPhone = () => {
    setStep(1);
    setCode("");
    setError(null);
  };

  if (!user) {
    return (
      <div style={{ paddingTop: isMobile ? 60 : 0, minHeight: "100vh", background: C.cream, padding: "80px 16px 40px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 15, color: C.dark, marginBottom: 16 }}>ログインが必要です。</div>
          <button onClick={() => navigate("/login")} style={{
            minHeight: 44, padding: "10px 20px", background: "transparent",
            color: C.orange, border: `1.5px solid ${C.orange}`, borderRadius: 20,
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>ログインへ →</button>
        </div>
      </div>
    );
  }

  // 共通の input スタイル (スマホ第一原則: minHeight 44)
  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 44,
    padding: "12px 14px",
    fontSize: 16,
    fontFamily: "inherit",
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    background: C.white,
    color: C.dark,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ paddingTop: isMobile ? 60 : 0, minHeight: "100vh", background: C.cream, padding: "80px 16px 40px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => navigate("/mypage")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: C.warmGray, fontSize: 13, padding: 0, fontFamily: "inherit",
          }}>← マイページへ戻る</button>
          <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: C.dark, marginTop: 12, marginBottom: 6 }}>
            電話番号の認証
          </h1>
          <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.7, margin: 0 }}>
            出品をはじめる方には認証をおすすめしています。<br/>
            安心して使える街のための、ささやかな手続きです。
          </p>
        </div>

        {/* Step 1: 電話番号入力 */}
        {step === 1 && alreadyVerified === false && (
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "20px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 8 }}>1 / 2 — 電話番号を入力</div>
            <label style={{ display: "block", fontSize: 12, color: C.warmGray, marginBottom: 6 }}>
              国際形式で入力してください (例: +818012345678)
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\+0-9]/g, ""))}
              placeholder="+818012345678"
              style={inputStyle}
              disabled={busy}
            />
            {error && (
              <div style={{ fontSize: 12, color: C.red, marginTop: 8, lineHeight: 1.6 }}>
                {error}
                {retryAfter !== null && ` (約${retryAfter}秒後に再試行可能)`}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 12, lineHeight: 1.7 }}>
              SMS で 6 桁のコードをお送りします。<br/>
              SMS 受信料金が発生する場合があります。
            </div>
            <button
              onClick={handleSendCode}
              disabled={busy || !phoneNumber}
              style={{
                width: "100%", minHeight: 44, marginTop: 16, padding: "12px 20px",
                background: "transparent", color: C.orange,
                border: `1.5px solid ${C.orange}`, borderRadius: 22,
                fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: busy ? 0.5 : 1,
                transition: "background 0.3s ease, color 0.3s ease",
              }}
            >
              {busy ? "送信中..." : "認証コードを送る →"}
            </button>
          </div>
        )}

        {/* Step 2: コード入力 */}
        {step === 2 && (
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "20px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 8 }}>2 / 2 — 受信したコードを入力</div>
            <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.6 }}>
              <span style={{ color: C.dark }}>{phoneNumber}</span> 宛に送ったコードを入力してください。
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
              placeholder="6桁のコード"
              style={{ ...inputStyle, fontSize: 18, letterSpacing: "0.2em", textAlign: "center" }}
              disabled={busy}
            />
            {error && (
              <div style={{ fontSize: 12, color: C.red, marginTop: 8, lineHeight: 1.6 }}>{error}</div>
            )}
            <button
              onClick={handleVerifyCode}
              disabled={busy || !code}
              style={{
                width: "100%", minHeight: 44, marginTop: 16, padding: "12px 20px",
                background: "transparent", color: C.orange,
                border: `1.5px solid ${C.orange}`, borderRadius: 22,
                fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: busy ? 0.5 : 1,
                transition: "background 0.3s ease, color 0.3s ease",
              }}
            >
              {busy ? "確認中..." : "認証する →"}
            </button>
            <button
              onClick={handleBackToPhone}
              disabled={busy}
              style={{
                width: "100%", minHeight: 44, marginTop: 10, padding: "10px 20px",
                background: "transparent", color: C.warmGray,
                border: "none", fontSize: 12, cursor: busy ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              ← 電話番号を変更する
            </button>
          </div>
        )}

        {/* Step 3: 完了 */}
        {step === 3 && (
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "24px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 8 }}>
              {alreadyVerified ? "認証済みです" : "認証が完了しました"}
            </div>
            <div style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.7, marginBottom: 20 }}>
              {phoneNumber}<br/>
              この街への準備が、ひとつ整いました。
            </div>
            <button
              onClick={() => navigate("/mypage")}
              style={{
                minHeight: 44, padding: "10px 24px",
                background: "transparent", color: C.orange,
                border: `1.5px solid ${C.orange}`, borderRadius: 22,
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                transition: "background 0.3s ease, color 0.3s ease",
              }}
            >
              マイページへ戻る →
            </button>
          </div>
        )}

        {/* loading 表示 (alreadyVerified === null) */}
        {alreadyVerified === null && step !== 3 && (
          <div style={{ textAlign: "center", padding: 24, color: C.warmGray, fontSize: 13 }}>読み込み中…</div>
        )}
      </div>
    </div>
  );
};

// ── データ削除リクエスト確認ページ (Phase Threads, 2026/5/24) ────────────────
// Meta threads-deletion-callback が返す url の確認ページ
// 認証不要、シンプル静的、?id=<confirmation_code> クエリで表示
const DeletionStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const confirmationId = params.get("id") || "";

  return (
    <div style={{ minHeight: "70vh", maxWidth: 600, margin: "0 auto", padding: "60px 20px 40px" }}>
      <div style={{ fontSize: 56, textAlign: "center", marginBottom: 16 }}>🗑️</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, textAlign: "center", marginBottom: 16 }}>
        データ削除リクエストを受け付けました
      </h1>
      <p style={{ fontSize: 14, color: "#444", lineHeight: 1.9, textAlign: "center", marginBottom: 24 }}>
        Threads (Meta) 経由でのデータ削除リクエストを受け付けました。<br/>
        Qocca に保存されている Threads 連携情報は順次削除されます。
      </p>

      {confirmationId && (
        <div style={{ background: C.cream, borderRadius: 14, padding: "20px 24px", border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6, textAlign: "center" }}>確認 ID</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: C.dark, textAlign: "center", letterSpacing: "0.08em", wordBreak: "break-all" }}>
            {confirmationId}
          </div>
        </div>
      )}

      <div style={{ background: "#F8F6F2", borderRadius: 12, padding: "16px 20px", fontSize: 12, color: "#666", lineHeight: 1.8, marginBottom: 24 }}>
        <strong style={{ color: C.dark }}>削除される情報:</strong><br/>
        ・Threads アクセストークン<br/>
        ・Threads ユーザー ID<br/>
        ・Threads プロフィール情報のキャッシュ<br/>
        <br/>
        <strong style={{ color: C.dark }}>削除されない情報:</strong><br/>
        ・Qocca アカウント本体 (継続利用可能)<br/>
        ・ペット情報・出品作品・取引履歴等<br/>
        <br/>
        ご質問は <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("/contact"); }} style={{ color: C.orange, fontWeight: 700, textDecoration: "none" }}>お問い合わせフォーム</a> までお願いします。
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={() => navigate("/")} style={{ padding: "12px 28px", background: C.orange, color: "#fff", border: "none", borderRadius: 22, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 44 }}>
          ホームに戻る
        </button>
      </div>
    </div>
  );
};

// ── X (Twitter) 連携ページ (Phase X, 2026/5/24, 案C 移植 5/26) ───────────────
// X API v2 OAuth 2.0 (PKCE) + 投稿テスト + プロフィール + 連携解除
const XConnectionPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<any>(null);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<any>(null);
  const [postError, setPostError] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      const returnTo = encodeURIComponent("/settings/x");
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("x") === "connected") {
      setShowSuccess(true);
      window.history.replaceState(null, "", "/settings/x");
    }
  }, []);

  const loadConnection = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-profile",
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }
      );
      const data = await res.json();
      setConnection(data);
    } catch (e) {
      console.error("Failed to load X profile:", e);
    }
    setLoading(false);
  };

  useEffect(() => { if (user?.id) loadConnection(); }, [user?.id]);

  const startOAuth = async () => {
    if (!user?.id) return;
    setInitLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setInitLoading(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-init-oauth",
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success && data.authorize_url) {
        window.location.href = data.authorize_url;
      } else {
        alert(data.message || data.error || "OAuth 開始に失敗しました");
        setInitLoading(false);
      }
    } catch (e: any) {
      alert(e?.message || "エラー");
      setInitLoading(false);
    }
  };

  const handlePost = async () => {
    if (!postText.trim()) { setPostError("投稿内容を入力してください"); return; }
    setPosting(true); setPostError(""); setPostResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setPostError("認証エラー"); setPosting(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-post",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ text: postText.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setPostResult(data); setPostText("");
      } else {
        setPostError(data.message || data.error || "投稿に失敗しました");
      }
    } catch (e: any) {
      setPostError(e?.message || "投稿エラー");
    }
    setPosting(false);
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    if (!window.confirm("X との連携を解除しますか?")) return;
    setDisconnecting(true);
    try {
      await supabase.from("social_connections").delete().eq("user_id", user.id).eq("platform", "x");
      setConnection({ connected: false });
      setShowSuccess(false);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
    setDisconnecting(false);
  };

  if (!user || loading) {
    return (<div style={{ maxWidth: 600, margin: "0 auto", padding: 24, textAlign: "center", color: C.warmGray }}>読み込み中...</div>);
  }

  const isConnected = connection?.connected === true && !connection?.expired;
  const isExpired = connection?.connected === true && connection?.expired;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 0" }}>
      <button onClick={() => navigate("/mypage")} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 0", fontFamily: "inherit", minHeight: 40 }}>
        ← マイページに戻る
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginTop: 8, marginBottom: 8 }}>🐦 X 連携</h1>
      <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24, lineHeight: 1.7 }}>
        X (旧 Twitter) と連携すると、Qocca から直接 X に投稿できるようになります。<br/>連携はいつでも解除できます。
      </p>

      {showSuccess && (
        <div style={{ background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)", border: "1px solid #4CAF50", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: C.dark }}>
          ✅ X との連携が完了しました!
        </div>
      )}

      {!isConnected && !isExpired && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🐦</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 8 }}>まだ連携されていません</div>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 20, lineHeight: 1.7 }}>
            「X と連携」ボタンを押すと X の認証画面が開きます。<br/>ご自身の X アカウントで承認してください。
          </div>
          <button onClick={startOAuth} disabled={initLoading} style={{ padding: "14px 24px", background: "#000", color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: initLoading ? "wait" : "pointer", fontFamily: "inherit", minHeight: 48, width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            {initLoading ? "認証画面へ移動中..." : "🐦 X と連携する"}
          </button>
        </div>
      )}

      {isExpired && (
        <div style={{ background: "#FFF3E0", border: `1px solid ${C.orange}`, borderRadius: 12, padding: "16px 18px", fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          ⚠️ X のトークンが期限切れです。再連携してください。
          <button onClick={startOAuth} disabled={initLoading} style={{ marginTop: 12, padding: "12px 20px", background: "#000", color: "#fff", border: "none", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: initLoading ? "wait" : "pointer", fontFamily: "inherit", display: "block", width: "100%", minHeight: 40 }}>
            {initLoading ? "..." : "🐦 再連携する"}
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", flexShrink: 0 }}>
                {connection.profile?.profile_image_url ? (
                  <img src={connection.profile.profile_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : "🐦"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>@{connection.platform_username || connection.profile?.username || "X"}</div>
                {connection.profile?.name && (<div style={{ fontSize: 12, color: C.warmGray }}>{connection.profile.name}</div>)}
              </div>
            </div>
            {connection.profile?.description && (
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>
                {connection.profile.description}
              </div>
            )}
            {connection.public_metrics && (
              <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                {Object.entries(connection.public_metrics).map(([k, v]) => (
                  <div key={k} style={{ flex: "1 1 60px", textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.orange }}>{String(v ?? "-")}</div>
                    <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>{k.replace(/_/g, " ").replace(" count", "")}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 12 }}>
              連携日: {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString("ja-JP") : "-"}
              {connection.token_expires_at && (<> ・ トークン期限: {new Date(connection.token_expires_at).toLocaleString("ja-JP")}</>)}
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📝 X 投稿テスト</div>
            <textarea value={postText} onChange={(e) => setPostText(e.target.value)} maxLength={280} placeholder="ツイートする内容を入力してください..." rows={4} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 100, boxSizing: "border-box", outline: "none" }} />
            <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{postText.length} / 280</div>
            {postError && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#FFEBEE", color: "#E57373", borderRadius: 8, fontSize: 13 }}>⚠️ {postError}</div>
            )}
            {postResult?.success && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#E8F5E9", color: "#2E7D32", borderRadius: 8, fontSize: 13 }}>
                ✅ 投稿成功! Tweet ID: {postResult.tweet_id}
                {postResult.permalink && (<> ・ <a href={postResult.permalink} target="_blank" rel="noopener noreferrer" style={{ color: "#2E7D32", textDecoration: "underline" }}>X で見る</a></>)}
              </div>
            )}
            <button onClick={handlePost} disabled={posting || !postText.trim()} style={{ marginTop: 12, padding: "12px 24px", width: "100%", background: posting || !postText.trim() ? C.warmGray : "#000", color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: posting || !postText.trim() ? "wait" : "pointer", fontFamily: "inherit", minHeight: 48 }}>
              {posting ? "投稿中..." : "📤 X に投稿"}
            </button>
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 8, lineHeight: 1.6 }}>
              ℹ️ X API は Pay-Per-Use 課金です (テキスト投稿 約 $0.015/件)
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 8 }}>連携を解除</div>
            <p style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.7 }}>
              連携解除すると、Qocca から X への投稿はできなくなります。<br/>いつでも再連携できます。
            </p>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{ padding: "10px 20px", background: C.white, color: "#E57373", border: "1.5px solid #E57373", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: disconnecting ? "wait" : "pointer", fontFamily: "inherit", width: "100%", minHeight: 40 }}>
              {disconnecting ? "解除中..." : "🔓 連携を解除する"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Threads 連携ページ (Phase Threads, 2026/5/23, 案C 移植 5/27) ───────────
// Meta Threads API OAuth + 投稿テスト + 連携情報 + 連携解除
// App Review 申請の動画デモ用 UI
const ThreadsConnectionPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<any>(null);
  const [postText, setPostText] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<any>(null);
  const [postError, setPostError] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // 依頼書 #124 (2026/6/5): 連携失敗時のエラー表示 (callback v12 が ?threads=error&reason=...&detail=... で戻すよう変更)
  const [errorBanner, setErrorBanner] = useState<{ reason: string; message: string; detail?: string } | null>(null);
  const [oauthStarting, setOauthStarting] = useState(false);

  useEffect(() => {
    if (!user) {
      const returnTo = encodeURIComponent("/settings/threads");
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // 依頼書 #124: 成功 / 失敗 両方の戻り URL を解釈
    const params = new URLSearchParams(window.location.search);
    const status = params.get("threads");
    if (status === "connected") {
      setShowSuccess(true);
      window.history.replaceState(null, "", "/settings/threads");
    } else if (status === "error") {
      const reason = params.get("reason") || "unknown";
      const detail = params.get("detail") || "";
      const reasonMap: Record<string, string> = {
        meta_denied: "Meta 側で認証がキャンセル/拒否されました",
        missing_params: "必要なパラメータが不足しています (callback URL の問題)",
        invalid_state: "セッション (state) が不正です。もう一度連携をお試しください",
        secrets_missing: "サーバー側の設定が未完了です。運営にお問い合わせください",
        token_short_failed: "アクセストークン交換失敗 (Meta App の Threads ユースケース / Redirect URI 設定を確認)",
        token_long_failed: "長期トークン (60日) 交換に失敗しました",
        db_failed: "データベース保存に失敗しました",
        unknown: "予期せぬエラーが発生しました",
      };
      setErrorBanner({ reason, message: reasonMap[reason] || reason, detail });
      window.history.replaceState(null, "", "/settings/threads");
    }
  }, []);

  const loadConnection = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/threads-profile",
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }
      );
      const data = await res.json();
      setConnection(data);
    } catch (e) {
      console.error("Failed to load Threads profile:", e);
    }
    setLoading(false);
  };

  useEffect(() => { if (user?.id) loadConnection(); }, [user?.id]);

  // 依頼書 #124 (2026/6/5): META_APP_ID ハードコードを排除 → threads-init-oauth Edge Function 経由
  //   - Meta App ID は Supabase secrets (META_APP_ID) で一元管理
  //   - フロントは authorize_url を受け取って遷移するだけ → ID 差替時に再 deploy 不要
  //   - 失敗時は callback v12 が ?threads=error&reason=... で戻る (errorBanner で表示)
  const startOAuth = async () => {
    if (!user?.id || oauthStarting) return;
    setErrorBanner(null);
    setOauthStarting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setErrorBanner({ reason: "no_session", message: "ログインセッションが切れています。再ログインしてください。" });
        setOauthStarting(false);
        return;
      }
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/threads-init-oauth",
        { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      const data = await res.json();
      if (!res.ok || !data?.authorize_url) {
        setErrorBanner({
          reason: data?.error || `http_${res.status}`,
          message: data?.message || `連携 URL の取得に失敗しました (${res.status})`,
        });
        setOauthStarting(false);
        return;
      }
      window.location.href = data.authorize_url;
    } catch (e: any) {
      setErrorBanner({ reason: "client_exception", message: `連携開始エラー: ${e?.message || e}` });
      setOauthStarting(false);
    }
  };

  const handlePost = async () => {
    if (!postText.trim()) { setPostError("投稿内容を入力してください"); return; }
    setPosting(true); setPostError(""); setPostResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setPostError("認証エラー"); setPosting(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/threads-post",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ text: postText.trim(), image_url: postImageUrl.trim() || undefined }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setPostResult(data); setPostText(""); setPostImageUrl("");
      } else {
        setPostError(data.message || data.error || "投稿に失敗しました");
      }
    } catch (e: any) {
      setPostError(e?.message || "投稿エラー");
    }
    setPosting(false);
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    if (!window.confirm("Threads との連携を解除しますか?")) return;
    setDisconnecting(true);
    try {
      await supabase.from("social_connections").delete().eq("user_id", user.id).eq("platform", "threads");
      setConnection({ connected: false });
      setShowSuccess(false);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
    setDisconnecting(false);
  };

  if (!user || loading) {
    return (<div style={{ maxWidth: 600, margin: "0 auto", padding: 24, textAlign: "center", color: C.warmGray }}>読み込み中...</div>);
  }

  const isConnected = connection?.connected === true && !connection?.expired;
  const isExpired = connection?.connected === true && connection?.expired;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 0" }}>
      <button onClick={() => navigate("/mypage")} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 0", fontFamily: "inherit", minHeight: 40 }}>
        ← マイページに戻る
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginTop: 8, marginBottom: 8 }}>🧵 Threads 連携</h1>
      <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24, lineHeight: 1.7 }}>
        Threads と連携すると、Qocca から直接 Threads に投稿できるようになります。<br/>連携はいつでも解除できます。
      </p>

      {showSuccess && (
        <div style={{ background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)", border: "1px solid #4CAF50", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: C.dark }}>
          ✅ Threads との連携が完了しました!
        </div>
      )}

      {/* 依頼書 #124 (2026/6/5): 連携失敗時のエラー表示 (callback v12 から ?threads=error で戻った時) */}
      {errorBanner && (
        <div style={{ background: "linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)", border: "1px solid #E57373", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>⚠️ 連携に失敗しました</div>
          <div>{errorBanner.message}</div>
          {errorBanner.detail && (
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6, fontFamily: "monospace", wordBreak: "break-all" }}>詳細: {errorBanner.detail}</div>
          )}
          <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6 }}>理由コード: <code>{errorBanner.reason}</code></div>
          <button onClick={() => setErrorBanner(null)} style={{ marginTop: 8, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>閉じる</button>
        </div>
      )}

      {!isConnected && !isExpired && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🧵</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 8 }}>まだ連携されていません</div>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 20, lineHeight: 1.7 }}>
            「Threads と連携」ボタンを押すと Meta の認証画面が開きます。<br/>ご自身の Threads アカウントで承認してください。
          </div>
          <button onClick={startOAuth} style={{ padding: "14px 24px", background: "#000", color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", minHeight: 48, width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            🧵 Threads と連携する
          </button>
        </div>
      )}

      {isExpired && (
        <div style={{ background: "#FFF3E0", border: `1px solid ${C.orange}`, borderRadius: 12, padding: "16px 18px", fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          ⚠️ Threads のトークンが期限切れです。再連携してください。
          <button onClick={startOAuth} style={{ marginTop: 12, padding: "12px 20px", background: "#000", color: "#fff", border: "none", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "block", width: "100%", minHeight: 40 }}>
            🧵 再連携する
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", flexShrink: 0 }}>
                {connection.profile?.profile_picture_url ? (
                  <img src={connection.profile.profile_picture_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : "🧵"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>@{connection.platform_username || connection.profile?.username || "Threads"}</div>
                {connection.profile?.name && (<div style={{ fontSize: 12, color: C.warmGray }}>{connection.profile.name}</div>)}
              </div>
            </div>
            {connection.profile?.biography && (
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>
                {connection.profile.biography}
              </div>
            )}
            {connection.insights && (
              <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                {Object.entries(connection.insights).map(([k, v]) => (
                  <div key={k} style={{ flex: "1 1 60px", textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.orange }}>{String(v ?? "-")}</div>
                    <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>{k.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 12 }}>
              連携日: {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString("ja-JP") : "-"}
              {connection.token_expires_at && (<> ・ トークン期限: {new Date(connection.token_expires_at).toLocaleDateString("ja-JP")}</>)}
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📝 Threads 投稿テスト</div>
            <textarea value={postText} onChange={(e) => setPostText(e.target.value)} maxLength={500} placeholder="投稿したい内容を入力してください..." rows={4} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 100, boxSizing: "border-box", outline: "none" }} />
            <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{postText.length} / 500</div>
            <input type="url" value={postImageUrl} onChange={(e) => setPostImageUrl(e.target.value)} placeholder="画像 URL (任意・公開アクセス可能なもの)" style={{ width: "100%", padding: "10px 12px", marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
            {postError && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#FFEBEE", color: "#E57373", borderRadius: 8, fontSize: 13 }}>⚠️ {postError}</div>
            )}
            {postResult?.success && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#E8F5E9", color: "#2E7D32", borderRadius: 8, fontSize: 13 }}>
                ✅ 投稿成功! Thread ID: {postResult.thread_id}
              </div>
            )}
            <button onClick={handlePost} disabled={posting || !postText.trim()} style={{ marginTop: 12, padding: "12px 24px", width: "100%", background: posting || !postText.trim() ? C.warmGray : "#000", color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: posting || !postText.trim() ? "wait" : "pointer", fontFamily: "inherit", minHeight: 48 }}>
              {posting ? "投稿中... (画像ありは最大30秒)" : "📤 Threads に投稿"}
            </button>
            {postImageUrl && (
              <div style={{ fontSize: 11, color: C.warmGray, marginTop: 8, lineHeight: 1.6 }}>
                ℹ️ 画像付き投稿は Meta 仕様により 30 秒待機が必要です
              </div>
            )}
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 8 }}>連携を解除</div>
            <p style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.7 }}>
              連携解除すると、Qocca から Threads への投稿はできなくなります。<br/>いつでも再連携できます。
            </p>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{ padding: "10px 20px", background: C.white, color: "#E57373", border: "1.5px solid #E57373", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: disconnecting ? "wait" : "pointer", fontFamily: "inherit", width: "100%", minHeight: 40 }}>
              {disconnecting ? "解除中..." : "🔓 連携を解除する"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Instagram 連携ページ (5/28 #25 Step 2 UI 追加 / X・Threads と同パターン) ─
// Edge Functions (instagram-init-oauth / instagram-oauth-callback / instagram-post / instagram-profile)
// は別 commit でデプロイ予定。UI 側は同パターンで先に main 反映する。
// Instagram Business Account 必須 (Personal は Graph API 非対応)。
const InstagramConnectionPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<any>(null);
  const [postCaption, setPostCaption] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<any>(null);
  const [postError, setPostError] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // 依頼書 #126 Phase 0 (2026/6/5): #124 Threads と同型のエラーバナー導入
  //   callback v10 が ?instagram=error&reason=...&detail=... で戻す
  const [errorBanner, setErrorBanner] = useState<{ reason: string; message: string; detail?: string } | null>(null);

  useEffect(() => {
    if (!user) {
      const returnTo = encodeURIComponent("/settings/instagram");
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // 依頼書 #126 Phase 0: 成功 / 失敗 両方の戻り URL を解釈
    const params = new URLSearchParams(window.location.search);
    const status = params.get("instagram");
    if (status === "connected") {
      setShowSuccess(true);
      window.history.replaceState(null, "", "/settings/instagram");
    } else if (status === "error") {
      const reason = params.get("reason") || "unknown";
      const detail = params.get("detail") || "";
      const reasonMap: Record<string, string> = {
        meta_denied: "Meta 側で認証がキャンセル/拒否されました",
        missing_params: "必要なパラメータが不足しています (callback URL の問題)",
        invalid_state: "セッション (state) が不正です。もう一度連携をお試しください",
        secrets_missing: "サーバー側の設定が未完了です。運営にお問い合わせください",
        token_short_failed: "アクセストークン交換失敗 (Meta App / Instagram Login API 設定を確認)",
        token_long_failed: "長期トークン (60日) 交換に失敗しました",
        db_failed: "データベース保存に失敗しました",
        unknown: "予期せぬエラーが発生しました",
      };
      setErrorBanner({ reason, message: reasonMap[reason] || reason, detail });
      window.history.replaceState(null, "", "/settings/instagram");
    }
  }, []);

  // social_connections から platform='instagram' の連携情報を取得
  // Edge Function instagram-profile が未deploy の場合は DB 直読みでフォールバック
  const loadConnection = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/instagram-profile",
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
      } else {
        // Edge Function 未deploy のフォールバック: DB 直読み
        const { data: row } = await supabase
          .from("social_connections")
          .select("platform_username, connected_at, token_expires_at")
          .eq("user_id", user.id)
          .eq("platform", "instagram")
          .maybeSingle();
        if (row) {
          setConnection({
            connected: true,
            expired: row.token_expires_at ? new Date(row.token_expires_at) < new Date() : false,
            platform_username: row.platform_username,
            connected_at: row.connected_at,
            token_expires_at: row.token_expires_at,
          });
        } else {
          setConnection({ connected: false });
        }
      }
    } catch (e) {
      console.error("Failed to load Instagram profile:", e);
      setConnection({ connected: false });
    }
    setLoading(false);
  };

  useEffect(() => { if (user?.id) loadConnection(); }, [user?.id]);

  // OAuth 開始: Instagram Business Login 新方式 (依頼書 #45 緊急 / 2026/5/31)
  // 旧 Facebook Login (facebook.com + Meta App ID) では「URL を読み込めません」エラー
  // 真因: Instagram には専用の App ID + endpoint 体系がある
  //   - endpoint: https://www.instagram.com/oauth/authorize (NOT facebook.com)
  //   - client_id: Instagram アプリ ID (NOT Meta App ID)
  //   - token 交換: api.instagram.com + graph.instagram.com
  const startOAuth = () => {
    if (!user?.id) return;
    // Instagram アプリ ID (Meta Portal の「Instagram ログインによる API 設定」内 / 公開情報)
    const INSTAGRAM_APP_ID = "1674772637106046";
    const REDIRECT_URI = "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/instagram-oauth-callback";
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.append("client_id", INSTAGRAM_APP_ID);
    url.searchParams.append("redirect_uri", REDIRECT_URI);
    // 依頼書 #41: Meta 新 scope (旧 instagram_basic 等は 2025/1/27 deprecated)
    url.searchParams.append("scope", "instagram_business_basic,instagram_business_content_publish");
    url.searchParams.append("response_type", "code");
    url.searchParams.append("state", user.id);
    window.location.href = url.toString();
  };

  const handlePost = async () => {
    if (!postCaption.trim()) { setPostError("キャプションを入力してください"); return; }
    if (!postImageUrl.trim()) { setPostError("画像 URL は必須です (Instagram は画像なし投稿不可)"); return; }
    setPosting(true); setPostError(""); setPostResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setPostError("認証エラー"); setPosting(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/instagram-post",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ caption: postCaption.trim(), image_url: postImageUrl.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setPostResult(data); setPostCaption(""); setPostImageUrl("");
      } else {
        setPostError(data.message || data.error || "投稿に失敗しました (Edge Function 未deploy の可能性あり)");
      }
    } catch (e: any) {
      setPostError(e?.message || "投稿エラー");
    }
    setPosting(false);
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    if (!window.confirm("Instagram との連携を解除しますか?")) return;
    setDisconnecting(true);
    try {
      await supabase.from("social_connections").delete().eq("user_id", user.id).eq("platform", "instagram");
      setConnection({ connected: false });
      setShowSuccess(false);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
    setDisconnecting(false);
  };

  if (!user || loading) {
    return (<div style={{ maxWidth: 600, margin: "0 auto", padding: 24, textAlign: "center", color: C.warmGray }}>読み込み中...</div>);
  }

  const isConnected = connection?.connected === true && !connection?.expired;
  const isExpired = connection?.connected === true && connection?.expired;

  // Instagram ブランドカラー (ピンク→オレンジ→パープルのグラデ)
  const IG_GRADIENT = "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)";

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 0" }}>
      <button onClick={() => navigate("/mypage")} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 0", fontFamily: "inherit", minHeight: 40 }}>
        ← マイページに戻る
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginTop: 8, marginBottom: 8 }}>📷 Instagram 連携</h1>
      <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 16, lineHeight: 1.7 }}>
        Instagram と連携すると、Qocca から直接 Instagram に投稿できるようになります。<br/>連携はいつでも解除できます。
      </p>

      {/* Business Account 必須注意 */}
      <div style={{ background: "#FFF3E0", border: `1px solid ${C.orange}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: C.dark, lineHeight: 1.7 }}>
        ⚠️ <b>Instagram Business Account 必須</b><br/>
        Personal アカウントでは Graph API 経由の投稿ができません。<br/>
        Instagram アプリの「プロフェッショナルアカウントに切り替える」から Business 化してから連携してください。
      </div>

      {showSuccess && (
        <div style={{ background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)", border: "1px solid #4CAF50", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: C.dark }}>
          ✅ Instagram との連携が完了しました!
        </div>
      )}

      {/* 依頼書 #126 Phase 0 (2026/6/5): 連携失敗時のエラー表示 (callback v10 から ?instagram=error で戻った時) */}
      {errorBanner && (
        <div style={{ background: "linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)", border: "1px solid #E57373", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>⚠️ 連携に失敗しました</div>
          <div>{errorBanner.message}</div>
          {errorBanner.detail && (
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6, fontFamily: "monospace", wordBreak: "break-all" }}>詳細: {errorBanner.detail}</div>
          )}
          <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6 }}>理由コード: <code>{errorBanner.reason}</code></div>
          <button onClick={() => setErrorBanner(null)} style={{ marginTop: 8, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>閉じる</button>
        </div>
      )}

      {!isConnected && !isExpired && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 8 }}>まだ連携されていません</div>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 20, lineHeight: 1.7 }}>
            「Instagram と連携」ボタンを押すと Meta の認証画面が開きます。<br/>Business Account でログインして承認してください。
          </div>
          <button onClick={startOAuth} style={{ padding: "14px 24px", background: IG_GRADIENT, color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", minHeight: 48, width: "100%", boxShadow: "0 2px 8px rgba(221,42,123,0.3)" }}>
            📷 Instagram と連携する
          </button>
        </div>
      )}

      {isExpired && (
        <div style={{ background: "#FFF3E0", border: `1px solid ${C.orange}`, borderRadius: 12, padding: "16px 18px", fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          ⚠️ Instagram のトークンが期限切れです。再連携してください。
          <button onClick={startOAuth} style={{ marginTop: 12, padding: "12px 20px", background: IG_GRADIENT, color: "#fff", border: "none", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "block", width: "100%", minHeight: 40 }}>
            📷 再連携する
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: IG_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", flexShrink: 0 }}>
                {connection.profile?.profile_picture_url ? (
                  <img src={connection.profile.profile_picture_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : "📷"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>@{connection.platform_username || connection.profile?.username || "Instagram"}</div>
                {connection.profile?.name && (<div style={{ fontSize: 12, color: C.warmGray }}>{connection.profile.name}</div>)}
                {connection.profile?.account_type && (
                  <div style={{ fontSize: 10, color: "#DD2A7B", fontWeight: 700, marginTop: 2 }}>{connection.profile.account_type}</div>
                )}
              </div>
            </div>
            {connection.profile?.biography && (
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>
                {connection.profile.biography}
              </div>
            )}
            {connection.insights && (
              <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                {Object.entries(connection.insights).map(([k, v]) => (
                  <div key={k} style={{ flex: "1 1 60px", textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#DD2A7B" }}>{String(v ?? "-")}</div>
                    <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>{k.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 12 }}>
              連携日: {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString("ja-JP") : "-"}
              {connection.token_expires_at && (<> ・ トークン期限: {new Date(connection.token_expires_at).toLocaleDateString("ja-JP")}</>)}
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📝 Instagram 投稿テスト</div>
            <input type="url" value={postImageUrl} onChange={(e) => setPostImageUrl(e.target.value)} placeholder="画像 URL (必須・公開アクセス可能な JPG/PNG)" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
            <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value)} maxLength={2200} placeholder="キャプションを入力してください (最大2200文字)..." rows={4} style={{ width: "100%", padding: "10px 12px", marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 100, boxSizing: "border-box", outline: "none" }} />
            <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{postCaption.length} / 2200</div>
            {postError && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#FFEBEE", color: "#E57373", borderRadius: 8, fontSize: 13 }}>⚠️ {postError}</div>
            )}
            {postResult?.success && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#E8F5E9", color: "#2E7D32", borderRadius: 8, fontSize: 13 }}>
                ✅ 投稿成功! Media ID: {postResult.media_id || postResult.id}
                {postResult.permalink && (<><br/><a href={postResult.permalink} target="_blank" rel="noopener" style={{ color: "#2E7D32", fontWeight: 700 }}>投稿を Instagram で見る →</a></>)}
              </div>
            )}
            <button onClick={handlePost} disabled={posting || !postCaption.trim() || !postImageUrl.trim()} style={{ marginTop: 12, padding: "12px 24px", width: "100%", background: posting || !postCaption.trim() || !postImageUrl.trim() ? C.warmGray : IG_GRADIENT, color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: posting || !postCaption.trim() || !postImageUrl.trim() ? "wait" : "pointer", fontFamily: "inherit", minHeight: 48 }}>
              {posting ? "投稿中... (Instagram は 2段階フローで最大30秒)" : "📤 Instagram に投稿"}
            </button>
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 8, lineHeight: 1.6 }}>
              ℹ️ Instagram Graph API は 2段階フロー (media container 作成 → publish)<br/>
              ℹ️ 画像なし投稿は不可。最低 1枚の画像必須。
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 8 }}>連携を解除</div>
            <p style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.7 }}>
              連携解除すると、Qocca から Instagram への投稿はできなくなります。<br/>いつでも再連携できます。
            </p>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{ padding: "10px 20px", background: C.white, color: "#E57373", border: "1.5px solid #E57373", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: disconnecting ? "wait" : "pointer", fontFamily: "inherit", width: "100%", minHeight: 40 }}>
              {disconnecting ? "解除中..." : "🔓 連携を解除する"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// FoundingCreatorsPage は pages/static.tsx へ移動 (Phase5 ①static)

// ── 依頼書 #36 (2026/5/31): HomePage 初期メンバー紹介セクション ─────────
// アバター 横スクロール + 「もっと見る」リンク
const InitialMembersSection = () => {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<FoundingCreator[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("founding_creators_view")
        .select("id, display_name, avatar_url, bio, creator_intro, is_founding_creator, is_initial_member, approved_count")
        .order("is_founding_creator", { ascending: false })
        .order("approved_count", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(6);
      setCreators((data as any[]) || []);
      setLoaded(true);
    })();
  }, []);

  if (!loaded || creators.length === 0) return null;

  return (
    <div style={{ padding: "36px 20px 28px", background: "#FAFAF7" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>🎨</div>
          {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): h3 Shippori Mincho 700 */}
          <h3 style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: "#3D2E1E", margin: "0 0 8px", letterSpacing: "0.04em" }}>
            想いを込めて、置いていく人たち
          </h3>
          <p style={{ fontSize: 11.5, color: "#8B7355", lineHeight: 1.7, margin: 0 }}>
            Qocca の街で 最初に作品を置いてくださっている方々
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "8px 4px", justifyContent: "center", flexWrap: "wrap" }}>
          {creators.map(c => {
            const name = c.display_name || "—";
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/profile/${c.id}`)}
                style={{ width: 86, textAlign: "center", cursor: "pointer", flexShrink: 0 }}
              >
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt={name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", marginBottom: 6, border: "2px solid #FFF", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 6px" }}>🎨</div>
                )}
                <div style={{ fontSize: 10.5, color: "#5A4A2C", fontWeight: 700, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ fontSize: 9.5, color: "#A07640" }}>🎨 {c.approved_count}件</div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/founding-creators" style={{ fontSize: 12, color: "#A07640", textDecoration: "underline", fontWeight: 700 }}>
            もっと見る →
          </a>
        </div>
      </div>
    </div>
  );
};

// SponsorsPage は pages/static.tsx へ移動 (Phase5 ①static)

// LegalPage は pages/static.tsx へ移動 (Phase5 ①static)

// FAQPage は pages/static.tsx へ移動 (Phase5 ①static)

// ── Shared Footer ─────────────────────────────────────────────────────────
// SharedFooter は components/ui.tsx へ移動 (Phase 4-b)

// ── LIKED ──────────────────────────────────────────────────────────────────
const LikedPage = ({ listings, liked, onLike, onDetail, isPC }) => {
  const items = listings.filter(l => liked[l.id]);
  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream, padding: isPC ? "0 0 40px" : "80px 16px 40px" }}>
      <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:6 }}>❤️ お気に入り</h1>
      <p style={{ color:C.warmGray, marginBottom:20, fontSize:14 }}>{items.length}件</p>
      {items.length===0?(
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🤍</div>
          <div style={{ fontSize:16, fontWeight:800, color:C.dark }}>まだお気に入りがありません</div>
        </div>
      ):(
        <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(3,1fr)" : "1fr 1fr", gap: isPC ? 16 : 12 }}>
          {items.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
        </div>
      )}
    </div>
  );
};

// ── Bottom Tab Bar (Mobile) ───────────────────────────────────────────────
// TabBar は components/ui.tsx へ移動 (Phase 4-b) ※safe-area対応(依頼書スマホUI)も移動済

// PCHeroSection/EventsPage/CreateCommunityModal/CommunitiesPage/CommunityDetailPage/ReportMessageModal は pages/community.tsx へ移動 (Phase5 ③community)


// ── PC用バナー ────────────────────────────────────────────────────────────
// PCBanner は components/ui.tsx へ移動 (Phase 4-b)

// ── APP ────────────────────────────────────────────────────────────────────
// ── Navigation Helper ─────────────────────────────────────────────────────
// useNav は hooks/index.ts へ移動 (Phase 3) ※useNavigate依存=Router内側でのみ呼び出し

// ── Detail Page Wrapper (gets item from state or fetches from DB) ────────
// DetailPageWrapper は pages/marketplace.tsx へ移動 (Phase6 6b)

// ── APP ────────────────────────────────────────────────────────────────────
function QoccaAppInner() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const isPC = useIsPC();
  const { user, loading } = useAuth();
  const { setPage } = useNav();
  const location = useLocation();

  // 依頼書 #24 v2 Phase 0 (2026/5/27): GA4 pageview tracking (React Router SPA 対応)
  // index.html の gtag('config', 'G-CPYH7DKWFO') が初回 pageview を発火、
  // 以降の SPA ルート遷移はこの useEffect が page_path を更新して発火
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag('config', 'G-CPYH7DKWFO', {
        page_path: location.pathname + location.search,
      });
    }
  }, [location.pathname, location.search]);

  // 依頼書 #121 (2026/6/5): Meta Pixel 初期化 (アプリ起動時 1 回のみ、初回 PageView も発火)
  // VITE_META_PIXEL_ID 未設定なら完全 no-op で安全
  useEffect(() => {
    initMetaPixel();
  }, []);

  // 依頼書 #121 (2026/6/5): SPA ルート遷移時の Meta Pixel PageView (初回二重発火防止 ref 利用)
  const mpFirstPageRef = useRef(true);
  useEffect(() => {
    if (mpFirstPageRef.current) {
      // 初回 PageView は initMetaPixel() 内で既に発火済 → スキップ
      mpFirstPageRef.current = false;
      return;
    }
    mpTrackPageView();
  }, [location.pathname, location.search]);

  // 依頼書 #121 (2026/6/5): Stripe 決済成功からの戻り検知 → Purchase 発火 (order_id 単位で重複ガード)
  // create-checkout の success_url = /mypage?order=success&order_id={uuid}
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(location.search);
    if (params.get("order") !== "success") return;
    const orderId = params.get("order_id");
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        // 注文情報を取得 (個人情報は含めず amount + listing_id のみ)
        const { data: order } = await supabase
          .from("orders")
          .select("amount, listing_id")
          .eq("id", orderId)
          .maybeSingle();
        if (cancelled || !order) return;
        mpTrackPurchase(orderId, {
          value: Number(order.amount) || 0,
          currency: "JPY",
          content_ids: order.listing_id ? [order.listing_id] : [],
        });
      } catch (_) {
        /* no-op: 計測失敗で UI を妨げない */
      }
    })();
    return () => { cancelled = true; };
  }, [location.search]);

  // Supabase data hooks
  const { listings: dbListings, dbLoading, refetch } = useListings();
  const { liked, toggleLike } = useFavorites(user?.id);

  // DBにデータがあればDBを使い、なければモックデータをフォールバック
  const listings = dbListings.length > 0 ? dbListings : LISTINGS;

  const onLike = (id) => {
    if (user) { toggleLike(id); }
  };
  const onDetail = (item) => { setPage("detail", item); };
  const [homeEvents, setHomeEvents] = useState<any[]>([]);
  useEffect(()=>{
    (async()=>{
      // 依頼書 #116 (2026/6/5): HomePage 末尾セクション用 4件取得 (旧 limit:3 から拡張)
      const { data } = await supabase.from("events").select("*").eq("status","approved").gte("event_date", new Date().toISOString().slice(0,10)).order("event_date",{ascending:true}).limit(4);
      setHomeEvents(data || []);
    })();
  }, []);

  useEffect(() => { window.scrollTo(0,0); }, [location.pathname]);

  // ページ名を取得（TabBar用）
  const getPageName = () => {
    const p = location.pathname;
    if (p === "/") return "home";
    if (p === "/search") return "search";
    if (p === "/sell") return "sell";
    if (p === "/events") return "events";
    if (p === "/favorites") return "liked";
    if (p === "/mypage") return "mypage";
    if (p === "/login") return "signup";
    if (p.startsWith("/listing/")) return "detail";
    return "home";
  };
  const page = getPageName();
  const showTabBar = !isPC && page !== "detail";

  // ローディング中の表示
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:C.cream }}>
      <div style={{ textAlign:"center" }}>
        <Logo size={48}/>
        <div style={{ marginTop:16, fontSize:13, color:C.warmGray }}>読み込み中...</div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif", background:C.cream, minHeight:"100vh", paddingBottom: showTabBar ? 70 : 0, width:"100%", overflowX:"hidden", margin:0, padding:0 }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet"/>

      {isPC
        ? <PCNavbar setPage={setPage} liked={liked} search={search} setSearch={setSearch}/>
        : <Navbar setPage={setPage} liked={liked} search={search} setSearch={setSearch}/>
      }

      {isPC ? (
        <div style={{ paddingTop:68 }}>
          <Routes>
            <Route path="/about" element={<AboutPage />} />
            <Route path="/tokusho" element={<TokushoPage setPage={setPage} isPC={true}/>} />
            <Route path="/terms" element={<LegalPage type="terms" setPage={setPage}/>} />
            <Route path="/privacy" element={<PrivacyPage setPage={setPage} isPC={true}/>} />
            {/* 依頼書 #35 v2 (5/31): 法人スポンサー一覧 */}
            <Route path="/sponsors" element={<SponsorsPage setPage={setPage}/>} />
            {/* 依頼書 #36 (5/31): 初期メンバー紹介 */}
            <Route path="/founding-creators" element={<FoundingCreatorsPage setPage={setPage}/>} />
            {/* 依頼書 #108 (2026/6/4): ARK 寄付 Admin 管理画面 (規約 v2.0 第11条第5項) */}
            <Route path="/admin/ark-donations" element={<AdminArkDonations />} />
            {/* 依頼書 #109 (2026/6/4): 法人スポンサー Admin 管理画面 (規約 v2.0 第29条) */}
            <Route path="/admin/corporate-sponsors" element={<AdminCorporateSponsors />} />
            {/* 依頼書 #110 (2026/6/4): 商店街 v2.0 リッチ TOP */}
            <Route path="/marketplace" element={<MarketplacePage />} />
            {/* 依頼書 #111 (2026/6/4): 基礎データ分析ダッシュボード (AI 戦略 Phase 1) */}
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            {/* 依頼書 #113 (2026/6/4): イベント自動収集 source 管理 */}
            <Route path="/admin/event-sources" element={<AdminEventSources />} />
            <Route path="/contact" element={<ContactPage setPage={setPage} isPC={true}/>} />
            {/* 依頼書 #128 (2026/6/5): GEO 対策 FAQ ページ (PC) */}
            <Route path="/faq" element={<FAQPage setPage={setPage} isPC={true}/>} />
            {/* 新 PC版 Route (Phase 1.5 リニューアル) - HomePage に統一 */}
            <Route path="/" element={<HomePage setPage={setPage} listings={listings} liked={liked} onLike={onLike} onDetail={onDetail} homeEvents={homeEvents}/>}/>
            <Route path="/search" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <SearchPage listings={listings} liked={liked} onLike={onLike} onDetail={onDetail} search={search} setSearch={setSearch} isPC={true}/>
                </div>
              </div>
            }/>
            <Route path="/listing/:id" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <DetailPageWrapper listings={listings} liked={liked} onLike={onLike}/>
                </div>
              </div>
            }/>
            <Route path="/events" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <EventsPage isPC={true} setPage={setPage}/>
                </div>
              </div>
            }/>
            <Route path="/gallery" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <GalleryPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            <Route path="/gallery/:itemId" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <GalleryPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            <Route path="/facilities" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <FacilitiesPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            <Route path="/blog" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <BlogPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            <Route path="/blog/:postId" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <BlogPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            <Route path="/communities" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <CommunitiesPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            <Route path="/community/:communityId" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <CommunityDetailPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            <Route path="/sell" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <SellPage setPage={setPage}/>
                </div>
              </div>
            }/>
            <Route path="/login" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <SignupPage setPage={setPage}/>
                </div>
              </div>
            }/>
            <Route path="/mypage" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <MyPage setPage={setPage}/>
                </div>
              </div>
            }/>
            {/* 依頼書 #7 Phase A (5/25): /redeem - クラファン引き換え (PC) */}
            <Route path="/redeem" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <RedeemPage setPage={setPage}/>
                </div>
              </div>
            }/>
            <Route path="/settings/phone-verification" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <PhoneVerificationPage setPage={setPage}/>
                </div>
              </div>
            }/>
            {/* Phase X (5/24, 案C 移植 5/26): /settings/x — X 連携 (PC) */}
            <Route path="/settings/x" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <XConnectionPage setPage={setPage}/>
                </div>
              </div>
            }/>
            {/* Phase Threads (5/23, 案C 移植 5/27): /settings/threads — Threads 連携 (PC) */}
            <Route path="/settings/threads" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <ThreadsConnectionPage setPage={setPage}/>
                </div>
              </div>
            }/>
            {/* Phase Instagram (5/28 #25 Step 2): /settings/instagram — Instagram 連携 (PC) */}
            <Route path="/settings/instagram" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <InstagramConnectionPage setPage={setPage}/>
                </div>
              </div>
            }/>
            <Route path="/user/:userId" element={
            <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
              <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
              <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                <UserProfilePage setPage={setPage}/>
              </div>
            </div>
          }/>
            {/* Phase D: 公開プロフィール (King 哲学: 管理ページとは別、みんなに見てもらうページ) */}
            <Route path="/profile/me" element={<ProfileMeRedirect/>}/>
            {/* 依頼書 #138 タスク2 Step 2 (2026/6/9): パスワード再設定 専用ルート */}
            <Route path="/update-password" element={<UpdatePasswordPage/>}/>
            <Route path="/profile/:userId" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <UserProfilePage setPage={setPage}/>
                </div>
              </div>
            }/>
            {/* Phase D Phase 2 (5/22 夜): /pet/:petId — 個別ペット詳細 (King 推奨A案) */}
            <Route path="/pet/:petId" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <PetDetailPage setPage={setPage}/>
                </div>
              </div>
            }/>
            <Route path="/favorites" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <LikedPage listings={listings} liked={liked} onLike={onLike} onDetail={onDetail} isPC={true}/>
                </div>
              </div>
            }/>
            {["terms","privacy","tokusho","contact"].map(t => (
              <Route key={t} path={`/${t}`} element={
                <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                  <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                  <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                    <LegalPage type={t} setPage={setPage}/>
                  </div>
                </div>
              }/>
            ))}
            <Route path="*" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40, textAlign:"center" }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🐾</div>
                  <div style={{ fontSize:20, fontWeight:900, color:C.dark }}>ページが見つかりません</div>
                  <button onClick={()=>setPage("home")} style={{ marginTop:16, padding:"10px 24px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, cursor:"pointer" }}>ホームに戻る</button>
                </div>
              </div>
            }/>
            <Route path="/admin" element={<AdminDashboard/>}/>
            {/* Phase Threads (5/24): /deletion-status — Meta deletion-callback の確認ページ */}
            <Route path="/deletion-status" element={<DeletionStatusPage/>}/>
            <Route path="/help" element={<HelpPage/>}/>
            <Route path="/help/:slug" element={<HelpPage/>}/>
          </Routes>
          <SharedFooter setPage={setPage}/>
        </div>
      ) : (
        <>
          <Routes>
            <Route path="/" element={<HomePage setPage={setPage} listings={listings} liked={liked} onLike={onLike} onDetail={onDetail} homeEvents={homeEvents}/>}/>
            <Route path="/about" element={<AboutPage />} />
            <Route path="/tokusho" element={<TokushoPage setPage={setPage} isPC={false}/>} />
            <Route path="/terms" element={<LegalPage type="terms" setPage={setPage}/>} />
            <Route path="/privacy" element={<PrivacyPage setPage={setPage} isPC={false}/>} />
            {/* 依頼書 #35 v2 (5/31): 法人スポンサー一覧 */}
            <Route path="/sponsors" element={<SponsorsPage setPage={setPage}/>} />
            {/* 依頼書 #36 (5/31): 初期メンバー紹介 */}
            <Route path="/founding-creators" element={<FoundingCreatorsPage setPage={setPage}/>} />
            {/* 依頼書 #108 (2026/6/4): ARK 寄付 Admin 管理画面 (規約 v2.0 第11条第5項) */}
            <Route path="/admin/ark-donations" element={<AdminArkDonations />} />
            {/* 依頼書 #109 (2026/6/4): 法人スポンサー Admin 管理画面 (規約 v2.0 第29条) */}
            <Route path="/admin/corporate-sponsors" element={<AdminCorporateSponsors />} />
            {/* 依頼書 #110 (2026/6/4): 商店街 v2.0 リッチ TOP */}
            <Route path="/marketplace" element={<MarketplacePage />} />
            {/* 依頼書 #111 (2026/6/4): 基礎データ分析ダッシュボード (AI 戦略 Phase 1) */}
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            {/* 依頼書 #113 (2026/6/4): イベント自動収集 source 管理 */}
            <Route path="/admin/event-sources" element={<AdminEventSources />} />
            <Route path="/contact" element={<ContactPage setPage={setPage} isPC={false}/>} />
            {/* 依頼書 #128 (2026/6/5): GEO 対策 FAQ ページ (Mobile) */}
            <Route path="/faq" element={<FAQPage setPage={setPage} isPC={false}/>} />
            <Route path="/search" element={<SearchPage listings={listings} liked={liked} onLike={onLike} onDetail={onDetail} search={search} setSearch={setSearch} isPC={false}/>}/>
            <Route path="/listing/:id" element={<DetailPageWrapper listings={listings} liked={liked} onLike={onLike}/>}/>
            <Route path="/events" element={<EventsPage isPC={false} setPage={setPage}/>}/>
            <Route path="/gallery" element={<GalleryPage setPage={setPage} isPC={false}/>}/>
            <Route path="/gallery/:itemId" element={<GalleryPage setPage={setPage} isPC={false}/>}/>
            <Route path="/facilities" element={<FacilitiesPage setPage={setPage} isPC={false}/>}/>
            <Route path="/blog" element={<BlogPage setPage={setPage} isPC={false}/>}/>
            <Route path="/blog/:postId" element={<BlogPage setPage={setPage} isPC={false}/>}/>
            <Route path="/communities" element={<CommunitiesPage setPage={setPage} isPC={false}/>}/>
            <Route path="/community/:communityId" element={<CommunityDetailPage setPage={setPage} isPC={false}/>}/>
            <Route path="/sell" element={<SellPage setPage={setPage}/>}/>
            <Route path="/login" element={<SignupPage setPage={setPage}/>}/>
            <Route path="/mypage" element={<MyPage setPage={setPage}/>}/>
            {/* 依頼書 #7 Phase A (5/25): /redeem - クラファン引き換え (Mobile) */}
            <Route path="/redeem" element={<RedeemPage setPage={setPage}/>}/>
            <Route path="/settings/phone-verification" element={<PhoneVerificationPage setPage={setPage}/>}/>
            {/* Phase X (5/24, 案C 移植 5/26): /settings/x — X 連携 (Mobile) */}
            <Route path="/settings/x" element={<XConnectionPage setPage={setPage}/>}/>
            {/* Phase Threads (5/23, 案C 移植 5/27): /settings/threads — Threads 連携 (Mobile) */}
            <Route path="/settings/threads" element={<ThreadsConnectionPage setPage={setPage}/>}/>
            {/* Phase Instagram (5/28 #25 Step 2): /settings/instagram — Instagram 連携 (Mobile) */}
            <Route path="/settings/instagram" element={<InstagramConnectionPage setPage={setPage}/>}/>
            <Route path="/admin" element={<AdminDashboard/>}/>
            <Route path="/deletion-status" element={<DeletionStatusPage/>}/>
            <Route path="/help" element={<HelpPage/>}/>
            <Route path="/help/:slug" element={<HelpPage/>}/>
            <Route path="/user/:userId" element={<UserProfilePage setPage={setPage}/>}/>
            {/* Phase D: 公開プロフィール (mobile) */}
            <Route path="/profile/me" element={<ProfileMeRedirect/>}/>
            {/* 依頼書 #138 タスク2 Step 2 (2026/6/9): パスワード再設定 専用ルート */}
            <Route path="/update-password" element={<UpdatePasswordPage/>}/>
            <Route path="/profile/:userId" element={<UserProfilePage setPage={setPage}/>}/>
            {/* Phase D Phase 2 (5/22 夜): /pet/:petId (mobile) */}
            <Route path="/pet/:petId" element={<PetDetailPage setPage={setPage}/>}/>
            <Route path="/favorites" element={<LikedPage listings={listings} liked={liked} onLike={onLike} onDetail={onDetail} isPC={false}/>}/>
            {["terms","privacy","tokusho","contact"].map(t => (
              <Route key={t} path={`/${t}`} element={<LegalPage type={t} setPage={setPage}/>}/>
            ))}
            <Route path="*" element={
              <div style={{ paddingTop:80, textAlign:"center" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🐾</div>
                <div style={{ fontSize:20, fontWeight:900, color:C.dark }}>ページが見つかりません</div>
                <button onClick={()=>setPage("home")} style={{ marginTop:16, padding:"10px 24px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, cursor:"pointer" }}>ホームに戻る</button>
              </div>
            }/>
          </Routes>
          {showTabBar && <TabBar page={page} setPage={setPage}/>}
          <AddToHomeScreenBanner />
        </>
      )}

      <style>{`
        html, body { margin: 0; padding: 0; width: 100%; overflow-x: hidden; }
        @keyframes float1{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        *{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{display:none}
        input:focus,textarea:focus,select:focus{border-color:${C.orange}!important}
        input::placeholder,textarea::placeholder{color:${C.warmGray}}
      `}</style>
    </div>
  );
}

// ── Root Export with AuthProvider + Router ────────────────────────────────
export default function QoccaApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QoccaAppInner/>
      </AuthProvider>
    </BrowserRouter>
  );
}
