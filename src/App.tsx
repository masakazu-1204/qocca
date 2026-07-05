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
import { BlogPage, GalleryPage } from "./pages/gallery";
import { EventsPage, CommunitiesPage, CommunityDetailPage } from "./pages/community";
import { SearchPage, UserProfilePage, SellPage, DetailPageWrapper, LikedPage } from "./pages/marketplace";
import { MyPage } from "./pages/mypage";
import { HomePage } from "./pages/home";
import { FacilitiesPage } from "./pages/facilities";
import { PetWalkerPage } from "./pages/petwalker";
import { PetGalleryPage } from "./pages/pet_gallery";
import AdminDashboard from "./Admin";
import HelpPage from "./HelpPage";
import AddToHomeScreenBanner from "./components/AddToHomeScreenBanner";
import { TokushoPage, TermsPage, PrivacyPage, ContactPage, QoccaTownGuide, FirstStepGuide, FoundingCreatorsPage, SponsorsPage, LegalPage, FAQPage } from "./pages/static";
import { C } from "./constants/theme";
import { LISTINGS } from "./constants/data";
// ── Supabase Client ───────────────────────────────────────────────────────
// 依頼書 #119 Phase C (2026/6/5): 全ページ共有の唯一 client に統一 (RLS 認証問題解消)
import { supabase } from "./supabaseClient";
// 依頼書 #121 (2026/6/5): Meta Pixel + コンバージョン計測 (7/1 Meta 広告稼働準備)
// ID 未設定で完全 no-op、localhost で発火しない fail-safe 設計
import { initMetaPixel, trackPageView as mpTrackPageView, trackPurchaseOnce as mpTrackPurchase } from "./lib/metaPixel";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useListings, useFavorites, useIsPC, useNav } from "./hooks";
import { Logo, Sidebar, PCNavbar, Navbar, SharedFooter, TabBar } from "./components/ui";
// 2026/7/4 あしあとUI第1弾: デイリー付与トースト (自己完結・起動時1回grant→新規付与時のみ表示)
import { AshiatoDailyGrant } from "./components/AshiatoGrantToast";
// あしあとUI第2弾 (2026/7/5): ショップ画面 (/ashiato-shop)
import { AshiatoShopPage } from "./pages/ashiato_shop";
import { SignupPage, PetDetailPage, ProfileMeRedirect, UpdatePasswordPage, RedeemPage, PhoneVerificationPage, DeletionStatusPage } from "./pages/account";
import { XConnectionPage, ThreadsConnectionPage, InstagramConnectionPage } from "./pages/connections";

// ============================================================================
// Phase8 8b: 独立ページ群を分割
//   account 系7ページ        -> pages/account.tsx
//   SNS連携3ページ           -> pages/connections.tsx
//   LikedPage                -> pages/marketplace.tsx
//   SUPABASE_URL(未使用)      -> 削除
// 以下は QoccaAppInner / QoccaApp (Router本体) のみ
// ============================================================================

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

  // トラクション計測 (2026/6/22): ログインユーザーの当日アクティブを1日1行記録。
  // DAU/MAU/リテンション/コホートの器 (daily_active_log)。共有supabase使用・新規clientは作らない。
  // 未ログインは何もしない (user_idなし=対象外)。PK(user_id,active_date)で同日重複は自動排除。
  // ⚠️ 計測の失敗はUXを一切ブロックしない (握り潰し・決済等の既存挙動に無影響)。
  useEffect(() => {
    if (!user?.id) return;
    const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // JST基準の当日
    (async () => {
      try {
        await supabase
          .from("daily_active_log")
          .upsert({ user_id: user.id, active_date: jstDate }, { onConflict: "user_id,active_date", ignoreDuplicates: true });
      } catch { /* 計測失敗は無視 (アプリ動作に影響させない) */ }
    })();
  }, [user?.id]);

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

  // ⚠️ padding は shorthand 一本に統一 (旧: paddingBottom + padding:0 が混在 → padding:0 が下余白を上書きし TabBar 裏にコンテンツが潜っていた)。
  //    showTabBar 時のみ下に TabBar高(70)+safe-area を確保 (ノッチ機のホームインジケータ対応)。
  return (
    <div style={{ fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif", background:C.cream, minHeight:"100vh", width:"100%", overflowX:"hidden", margin:0, padding: showTabBar ? "0 0 calc(70px + env(safe-area-inset-bottom, 0px)) 0" : 0 }}>
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
            {/* ペットウォーカー: ペットと行きたくなる場所(宿/カフェ/観光) の情報ページ (商店街メイン機能・施設マップとは別) */}
            <Route path="/petwalker" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <PetWalkerPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            {/* うちの子ギャラリー: 全ユーザーの公開うちの子を集約表示。各カードから飼い主の公開プロフィール /user/:owner_id へ */}
            <Route path="/petgallery" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <PetGalleryPage setPage={setPage} isPC={true}/>
                </div>
              </div>
            }/>
            {/* あしあとUI第2弾 (2026/7/5): あしあとショップ (装飾交換・equipは第3弾) */}
            <Route path="/ashiato-shop" element={
              <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                  <AshiatoShopPage setPage={setPage} isPC={true}/>
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
          {/* 2026/7/4 あしあとUI第1弾: デイリー付与トースト (PC branch) */}
          <AshiatoDailyGrant />
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
            <Route path="/petwalker" element={<PetWalkerPage setPage={setPage} isPC={false}/>}/>
            <Route path="/petgallery" element={<PetGalleryPage setPage={setPage} isPC={false}/>}/>
            {/* あしあとUI第2弾 (2026/7/5): あしあとショップ (装飾交換・equipは第3弾) */}
            <Route path="/ashiato-shop" element={<AshiatoShopPage setPage={setPage} isPC={false}/>}/>
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
          {/* 2026/6/28 案A: モバイル branch にも全ページ共通 SharedFooter を1行追加 (従来PCのみ・モバイルは無かった)。
              TabBar(fixed bottom 70px) の重なりは外側 wrapper の padding-bottom で既に確保されてるため Footer はその上に自然配置。 */}
          <SharedFooter setPage={setPage}/>
          {showTabBar && <TabBar page={page} setPage={setPage}/>}
          <AddToHomeScreenBanner />
          {/* 2026/7/4 あしあとUI第1弾: デイリーログイン付与 (冪等・新規付与時のみトースト) */}
          <AshiatoDailyGrant />
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

