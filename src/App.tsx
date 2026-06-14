import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { BlogPage, GalleryPage } from "./pages/gallery";
import { EventsPage, CommunitiesPage, CommunityDetailPage } from "./pages/community";
import { SearchPage, UserProfilePage, SellPage, DetailPageWrapper } from "./pages/marketplace";
import { MyPage } from "./pages/mypage";
import { FacilitiesPage } from "./pages/facilities";
import AdminDashboard from "./Admin";
import HelpPage from "./HelpPage";
import AddToHomeScreenBanner from "./components/AddToHomeScreenBanner";
import type { FoundingCreator } from "./types";
import { TokushoPage, TermsPage, PrivacyPage, ContactPage, QoccaTownGuide, FirstStepGuide, FoundingCreatorsPage, SponsorsPage, LegalPage, FAQPage } from "./pages/static";
import { C, CAT_COLORS, QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY, QC_KEYFRAMES, QC_HERO_DURATIONS, QC_TIMING, QC_HERO_TRANSITION_MS, QC_PC_BREAKPOINT } from "./constants/theme";
import { CATS, LISTINGS, EVENTS, ORDER_STEPS, QC_REACTIONS, CONTACT_PATTERNS, NG_WORDS, CROWDFUNDING_ACTIVE, CAMPFIRE_PROJECT_URL_WITH_UTM, REDEEM_TIER_THEME } from "./constants/data";
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
import { Logo, Card, Sidebar, PCNavbar, Navbar, SharedFooter, TabBar, PCBanner } from "./components/ui";
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

// 暮らしの空気 (AtmospherePreset/ATMOSPHERE_PRESETS/DEFAULT_ATMOSPHERE/findAtmosphere) は MyPage 専用のため pages/mypage.tsx へ移動 (Phase7)

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
// REDEEM_TIER_THEME は constants/data.ts へ移動 (Phase7 / RedeemPage+MyPage 共有のため中立化)

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
// MyPage クラスタ(15部品+PetCategory型: MyPage/各タブ/ActivityDetailModal/DisputeModal/compose群) は pages/mypage.tsx へ移動 (Phase7)

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
