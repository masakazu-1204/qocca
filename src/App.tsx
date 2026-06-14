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
import { SearchPage, UserProfilePage, SellPage, DetailPageWrapper } from "./pages/marketplace";
import { MyPage } from "./pages/mypage";
import { HomePage } from "./pages/home";
import { FacilitiesPage } from "./pages/facilities";
import AdminDashboard from "./Admin";
import HelpPage from "./HelpPage";
import AddToHomeScreenBanner from "./components/AddToHomeScreenBanner";
import type { FoundingCreator } from "./types";
import { TokushoPage, TermsPage, PrivacyPage, ContactPage, QoccaTownGuide, FirstStepGuide, FoundingCreatorsPage, SponsorsPage, LegalPage, FAQPage } from "./pages/static";
import { C, QC_FONT_DISPLAY } from "./constants/theme";
import { LISTINGS, REDEEM_TIER_THEME } from "./constants/data";
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
// Homeセクション群 (HERO_IMAGES_CINEMA/Section*/Moment*/HomePage 他) は pages/home.tsx へ移動 (Phase8 8a)

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

// InitialMembersSection は pages/home.tsx へ移動 (Phase8 8a / HomePage が render)

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
