// ホーム ページ群 (App.tsx 分割 Phase8 8a・最後)
// HomePage + 全セクション(Hero/Announcement/WhatIsQocca/TodaysMoments/TownMap/QuietlyLoved/ResidentArtisans/Voices/JoinTown)
//   + Moment系/LoginPromptModal/Founding/Ark/HomeEvents/InitialMembersSection + Hero画像/スクロール系hook
// ⚠️ ロジック・参照名・静けさデザイン(フォント/余白/0.8sアニメ)は App.tsx 時点から1文字も改変なし (切り取って移動)。
// export: HomePage のみ (他は intra)。

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { C, QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY, QC_KEYFRAMES, QC_HERO_DURATIONS, QC_HERO_TRANSITION_MS, QC_PC_BREAKPOINT } from "../constants/theme";
import { QC_REACTIONS, CROWDFUNDING_ACTIVE, CAMPFIRE_PROJECT_URL_WITH_UTM } from "../constants/data";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useListings } from "../hooks";
import { CrowdfundingBanner } from "../components/CrowdfundingBanner";
import { SharedFooter } from "../components/ui";
import type { FoundingCreator } from "../types";

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

export const HomePage = ({ setPage, listings, liked, onLike, onDetail, homeEvents = [] }) => {
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

