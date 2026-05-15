import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from "react-router-dom";
import AboutPage from "./pages/AboutPage";
import AboutSection from "./components/AboutSection";
import HomeNewsSection from "./components/HomeNewsSection";
import QoccaUniverseSection from "./components/QoccaUniverseSection";
import CommunityShowcase from "./components/CommunityShowcase";
import FacilityMapPromo from "./components/FacilityMapPromo";
import CommentModal from "./components/CommentModal";
import ProfileEditModal from "./components/ProfileEditModal";
import AdminDashboard from "./Admin";
import HelpPage from "./HelpPage";
import { ReviewModal } from "./components/ReviewModal";
import AddToHomeScreenBanner from "./components/AddToHomeScreenBanner";
type CommentTargetType = "gallery" | "event" | "blog";
// ── Supabase Client ───────────────────────────────────────────────────────
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const supabase = createClient(
  SUPABASE_URL,
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

// ── Auth Context ──────────────────────────────────────────────────────────
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Auth状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signInWithProvider = async (provider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/?page=reset` : undefined,
    });
    return { data, error };
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithProvider, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// ── Supabase Data Hooks ──────────────────────────────────────────────────

// 出品データをSupabaseから取得（承認済みのみ）
const useListings = () => {
  const [listings, setListings] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  const fetchListings = async () => {
    setDbLoading(true);
    // Phase B: listing_variants を join で取得 (1:N、has_variants=true の listing のみ持つ)
    // 単品出品 (has_variants=false) は listing_variants が空配列のままで挙動完全互換
    const { data, error } = await supabase
      .from("listings")
      .select("*, listing_variants(*)")
      .in("status", ["approved", "sold_out"])
      .order("created_at", { ascending: false });
    if (!error && data && data.length > 0) {
      // 出品者名を取得
      const sellerIds = [...new Set(data.map(l => l.seller_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", sellerIds);
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      setListings(data.map(l => {
        const prof = profileMap[l.seller_id] || {};
        return {
          id: l.id,
          title: l.title,
          seller: prof.display_name || "出品者",
          sellerIcon: "🐾",
          sellerAvatar: prof.avatar_url || "",
          price: l.price,
          rating: 0,
          reviews: 0,
          tag: "",
          category: l.category,
          emoji: CATS.find(c => c.id === l.category)?.icon || "🐾",
          pet: l.pet_type,
          desc: l.description,
          delivery: l.delivery_days || "要相談",
          delivery_type: l.delivery_type || "data_only",
          bg: CAT_COLORS[l.category] || "#FFF3E0",
          imageUrl: l.image_urls?.[0] || "",
          imageUrls: l.image_urls || [],
          seller_id: l.seller_id,
          created_at: l.created_at,
          favorite_count: l.favorite_count || 0,
          options: l.options || [],
          // Phase B: variant 関連 (DetailPage で参照)
          has_variants: l.has_variants === true,
          listing_variants: Array.isArray(l.listing_variants) ? l.listing_variants : [],
        };
      }));
    }
    setDbLoading(false);
  };

  useEffect(() => { fetchListings(); }, []);
  return { listings, dbLoading, refetch: fetchListings };
};

const CAT_COLORS = { illust:"#FFF3E0", clothes:"#F3E5F5", photo:"#E3F2FD", goods:"#E8F5E9", food:"#FCE4EC", training:"#E0F7FA" };
// ── 人気スコア計算（ハイブリッドアルゴリズム）─────────────────────────
// 販売数×5 + お気に入り×1 + 閲覧数×0.1 + 新規ボーナス×30(14日以内) - 経過日数×0.1
const calcPopularityScore = (item) => {
  if (!item) return 0;
  const sales = item.sales_count || 0;
  const favs  = item.favorite_count || 0;
  const views = item.view_count || 0;
  const created = item.created_at ? new Date(item.created_at) : new Date();
  const daysSince = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)));
  const newBonus = daysSince <= 14 ? 30 : 0;
  
  return (sales * 5.0)
       + (favs * 1.0)
       + (views * 0.1)
       + newBonus
       - (daysSince * 0.1);
};

const sortByPopularity = (items) => {
  return [...items].sort((a, b) => calcPopularityScore(b) - calcPopularityScore(a));
};


// お気に入りをSupabaseで管理
const useFavorites = (userId) => {
  const [liked, setLiked] = useState({});

  useEffect(() => {
    if (!userId) { setLiked({}); return; }
    const fetchFavs = async () => {
      const { data } = await supabase.from("favorites").select("listing_id").eq("user_id", userId);
      if (data) {
        const map = {};
        data.forEach(f => { map[f.listing_id] = true; });
        setLiked(map);
      }
    };
    fetchFavs();
  }, [userId]);

  const toggleLike = async (listingId) => {
    if (!userId) return;
    const isLiked = liked[listingId];
    setLiked(p => ({ ...p, [listingId]: !isLiked }));
    if (isLiked) {
      await supabase.from("favorites").delete().eq("user_id", userId).eq("listing_id", listingId);
    } else {
      await supabase.from("favorites").insert({ user_id: userId, listing_id: listingId });
    }
  };

  return { liked, toggleLike };
};

// 出品をSupabaseに保存
// Phase B: variants 対応版
// - isDraft 引数バグ修正 (旧: 関数定義に含まれず、L4051 で渡してたが受け取ってなかった)
// - variants 引数追加 (Phase A の listing_variants テーブルに別途 INSERT)
// - listings.has_variants フラグを variants の有無で自動設定
// - variants INSERT 失敗時は listing も削除して整合性保持
const submitListing = async (userId, form, imageFiles, options = [], isDraft = false, variants = []) => {
  const imageUrls = [];
  for (const file of imageFiles) {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("listing-images").upload(path, file);
    if (!upErr) {
      const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(path);
      imageUrls.push(urlData.publicUrl);
    }
  }

  const stockValue = form.stock !== "" && form.stock !== null && form.stock !== undefined
    ? parseInt(form.stock)
    : null;

  // variants が指定されていれば has_variants = true (Phase A の列を活用)
  const hasVariants = Array.isArray(variants) && variants.length > 0;

  const { data: listing, error: listingErr } = await supabase.from("listings").insert({
    seller_id: userId,
    title: form.title,
    description: form.desc,
    price: parseInt(form.price),
    category: form.cat,
    pet_type: form.pet,
    delivery_days: form.delivery,
    delivery_type: form.delivery_type || 'data_only',
    image_urls: imageUrls,
    options: options.filter(o => o.name && o.price > 0),
    stock_quantity: isNaN(stockValue) ? null : stockValue,
    status: isDraft ? "draft" : "pending",
    has_variants: hasVariants,
  }).select().single();

  if (listingErr || !listing) {
    return { data: null, error: listingErr };
  }

  // variants INSERT (hasVariants = true の時のみ)
  if (hasVariants) {
    const variantInserts = variants
      .filter(v => v.variant_name && v.price && parseInt(v.price) > 0)
      .map((v, idx) => ({
        listing_id: listing.id,
        variant_name: v.variant_name,
        attributes: v.attributes || {},
        price: parseInt(v.price),
        stock: parseInt(v.stock) || 0,
        image_url: v.image_url || null,
        display_order: idx,
        is_active: true,
      }));

    if (variantInserts.length > 0) {
      const { error: variantErr } = await supabase
        .from("listing_variants")
        .insert(variantInserts);

      if (variantErr) {
        // variant INSERT 失敗時は listing も削除 (整合性保持)
        await supabase.from("listings").delete().eq("id", listing.id);
        return { data: null, error: variantErr };
      }
    }
  }

  return { data: listing, error: null };
};

// ── Colors & Constants ────────────────────────────────────────────────────
const C = {
  orange: "#F5A94A", orangeLight: "#FAC97A", orangePale: "#FFF3E0",
  orangeDeep: "#E8903A", cream: "#FAFAF7", dark: "#1A1208",
  darkBrown: "#2D1F0A", warmGray: "#9E9B95", lightGray: "#F5F3F0",
  border: "#EDE9E3", white: "#FFFFFF", green: "#4CAF50",
  greenPale: "#E8F5E9", blue: "#2196F3", bluePale: "#E3F2FD",
  red: "#EF5350", redPale: "#FFEBEE",
};

const CATS = [
  { id:"all", icon:"🐾", label:"すべて" },
  { id:"illust", icon:"🎨", label:"似顔絵" },
  { id:"clothes", icon:"👕", label:"お洋服" },
  { id:"photo", icon:"📸", label:"フォト" },
  { id:"goods", icon:"✨", label:"グッズ" },
  { id:"food", icon:"🍖", label:"フード" },
  { id:"training", icon:"🐕", label:"しつけ" },
];

// listings は useListings hook が DB から取得する。
// フォールバック先は空配列とする (King 判断: Supabase 障害 / RLS ミス / network エラー時に
// 架空 seller + 偽 rating/reviews を出すリスクを永続排除)。
// 詳細: 利用規約 第9条 / ブランド人格 v3 第2章二・第11章・第13章
const LISTINGS: any[] = [];

// レビューはユーザーの実取引完了後に reviews テーブルから取得する設計。
// 運営による架空レビューは一切置かない（利用規約 第9条、ブランド人格 v3 第2章二・第11章・第13章）。
const REVIEWS: any[] = [];

const EVENTS: any[] = [];
const EVENT_PREFS = ["すべて","北海道","東京都","大阪府","愛知県","福岡県"];
const EVENT_CATS = ["すべて","フェスタ","交流会","撮影会","マーケット","体験会","健康"];
const evPetLabel = (p) => p==="dog"?"🐕 犬":p==="cat"?"🐈 猫":"🐾 両方";
const evPetColor = (p) => p==="dog"?C.orange:p==="cat"?"#9C27B0":C.green;
const evPetBg = (p) => p==="dog"?C.orangePale:p==="cat"?"#F3E5F5":C.greenPale;

// ── Mock Orders ───────────────────────────────────────────────────────────
const ORDER_STEPS = [
  { key:"pending", label:"注文確定", icon:"🛒" },
  { key:"working", label:"作業中", icon:"🎨" },
  { key:"delivered", label:"納品済み", icon:"📦" },
  { key:"completed", label:"取引完了", icon:"✅" },
];

const stepIndex = (status) => {
  if (status==="pending") return 0;
  if (status==="working") return 1;
  if (status==="delivered") return 2;
  if (status==="completed") return 3;
  if (status==="disputed") return 2;
  if (status==="refunded") return -1;
  if (status==="cancelled") return -1;
  return 0;
};

const DISPUTE_REASONS = [
  { id:"quality", label:"イメージと違う・品質問題", icon:"😕" },
  { id:"not_delivered", label:"商品が届かない", icon:"📭" },
  { id:"wrong_spec", label:"サイズ・仕様が違う", icon:"📏" },
  { id:"no_show", label:"サービスが提供されなかった", icon:"🚫" },
  { id:"other", label:"その他", icon:"💬" },
];

// ── Logo ─────────────────────────────────────────────────────────────────
const Logo = ({ size = 32 }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flexShrink:0 }}>
    <img src="/logo.png" width={size*1.5} height={size*1.5} style={{ objectFit:"contain" }} alt="Qocca"/>
    <span style={{ fontSize:size*0.72, fontWeight:900, color:C.orange, letterSpacing:"-0.5px", fontFamily:"'Helvetica Neue',Arial,sans-serif" }}>Qocca</span>
  </div>
);

// ── レスポンシブ判定 ──────────────────────────────────────────────────────
const useIsPC = () => {
  const [isPC, setIsPC] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const h = () => setIsPC(window.innerWidth >= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isPC;
};

// ── PC用サイドバー (v3.1 準拠 3層構造) ───────────────────────────────────
// 「街を歩く」「作品を置く」「暮らしの設定」の3階層で "圧を抜く" 設計。
// - カテゴリ7つは SearchPage 内チップに統合 (Sidebar からは削除)
// - "🐾 出品する" 巨大 CTA を「作品を置く」内のテキストリンクに格下げ
// - hover で C.orange に静かに transition (気配レベル)
// - 階層見出しは控えめ (warmGray, weight 400, opacity 0.85)
// 既存呼び出し側との互換性のため activeCat / setActiveCat props は受け取るが未使用
const Sidebar = ({ setPage, activeCat: _activeCat, setActiveCat: _setActiveCat }: any) => {
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // MyPage の特定タブを開く (Sidebar 「管理する」用)
  const openMyPageTab = (tab: string) => {
    setPage("mypage");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("openMyPageTab", { detail: { tab } }));
    }, 100);
  };

  const sections: Array<{ heading: string; items: Array<{ key: string; icon: string; label: string; onClick: () => void }> }> = [
    {
      heading: "街を歩く",
      items: [
        { key: "gallery",     icon: "🐾", label: "ギャラリー",      onClick: () => setPage("gallery") },
        { key: "communities", icon: "💬", label: "広場",            onClick: () => setPage("communities") },
        { key: "events",      icon: "📅", label: "イベント",        onClick: () => setPage("events") },
        { key: "facilities",  icon: "🐕", label: "地図",            onClick: () => setPage("facilities") },
        { key: "blog",        icon: "📝", label: "ブログ",          onClick: () => setPage("blog") },
      ],
    },
    {
      heading: "作品を置く",
      items: [
        { key: "sell",        icon: "✎",  label: "出品する",        onClick: () => setPage("sell") },
        { key: "manage",      icon: "📦", label: "管理する",        onClick: () => openMyPageTab("sales") },
      ],
    },
    {
      heading: "暮らしの設定",
      items: [
        { key: "mypage",      icon: "👤", label: "マイページ",      onClick: () => setPage("mypage") },
        { key: "contact",     icon: "✉️", label: "お問い合わせ",    onClick: () => setPage("contact") },
      ],
    },
  ];

  return (
    <div style={{ width:260, flexShrink:0, alignSelf:"flex-start", position:"sticky", top:92, paddingTop:24 }}>
      {sections.map((section, sIdx) => (
        <div key={section.heading}>
          <div style={{
            fontSize: 12,
            fontWeight: 400,
            color: C.warmGray,
            padding: "12px 18px 8px",
            letterSpacing: "0.08em",
            opacity: 0.85,
          }}>
            {section.heading}
          </div>
          {section.items.map(item => {
            const isHover = hoverKey === item.key;
            return (
              <button
                key={item.key}
                onClick={item.onClick}
                onMouseEnter={() => setHoverKey(item.key)}
                onMouseLeave={() => setHoverKey(null)}
                style={{
                  width: "100%",
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: isHover ? C.orange : C.dark,
                  fontWeight: 400,
                  fontSize: 14,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: "inherit",
                  marginBottom: 1,
                  transition: "color 0.4s ease",
                }}
              >
                <span style={{ fontSize: 18, opacity: 0.85, width: 22, display: "inline-flex", justifyContent: "center" }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
          {sIdx < sections.length - 1 && (
            <div style={{
              margin: "14px 18px",
              height: 1,
              background: C.border,
              opacity: 0.5,
            }} />
          )}
        </div>
      ))}
    </div>
  );
};

// ── User Menu (ログイン後のアイコンメニュー) ──────────────────────────────
const UserMenu = ({ setPage }) => {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; bio?: string; created_at?: string } | null>(null);
 
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio, created_at")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    })();
  }, [user?.id]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "ユーザー";
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    setPage("home");
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={()=>setOpen(!open)} style={{
        width:36, height:36, borderRadius:"50%", background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : C.orange,
        border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:15, fontWeight:800, color:"#fff"
      }}>{!profile?.avatar_url && initial}</button>
      {open && (
        <div style={{
          position:"absolute", top:44, right:0, background:C.white,
          borderRadius:16, border:`1px solid ${C.border}`,
          boxShadow:"0 8px 32px rgba(0,0,0,0.12)", padding:"8px", width:220, zIndex:999
        }}>
          <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}`, marginBottom:4 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{displayName}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2, overflow:"hidden", textOverflow:"ellipsis" }}>{user?.email}</div>
          </div>
          {[
            { icon:"👤", label:"マイページ", action:()=>{ setPage("mypage"); setOpen(false); }},
            { icon:"📦", label:"注文履歴", action:()=>{ setPage("mypage"); setOpen(false); setTimeout(()=>{ window.dispatchEvent(new CustomEvent("openMyPageTab", { detail: { tab: "orders" } })); }, 100); }},
            { icon:"⚙️", label:"設定", action:()=>{ setPage("mypage"); setOpen(false); setTimeout(()=>{ window.dispatchEvent(new CustomEvent("openMyPageTab", { detail: { tab: "addresses" } })); }, 100); }},
          ].map(item=>(
            <button key={item.label} onClick={item.action} style={{
              width:"100%", padding:"10px 14px", border:"none", borderRadius:10,
              background:"transparent", cursor:"pointer", display:"flex", alignItems:"center",
              gap:10, fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.dark, textAlign:"left"
            }}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
          <div style={{ borderTop:`1px solid ${C.border}`, marginTop:4, paddingTop:4 }}>
            <button onClick={handleSignOut} style={{
              width:"100%", padding:"10px 14px", border:"none", borderRadius:10,
              background:"transparent", cursor:"pointer", display:"flex", alignItems:"center",
              gap:10, fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.red, textAlign:"left"
            }}>
              <span>🚪</span>ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── PC用ナビバー ───────────────────────────────────────────────────────────
const PCNavbar = ({ setPage, liked, search, setSearch }) => {
  const { user } = useAuth();
  return (
    <nav style={{
      position:"fixed", top:0, left:0, right:0, zIndex:200,
      background:"rgba(250,250,247,0.97)", backdropFilter:"blur(12px)",
      borderBottom:`1px solid ${C.border}`, height:68,
      display:"flex", alignItems:"center", padding:"0 48px", gap:24, width:"100%", boxSizing:"border-box"
    }}>
      <div onClick={()=>setPage("home")} style={{ flexShrink:0 }}><Logo size={32}/></div>
      <div style={{ flex:1, maxWidth:480, position:"relative" }}>
        <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, color:C.warmGray }}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setPage("search")}
          placeholder="ペット専門サービスを探す..."
          style={{ width:"100%", padding:"10px 14px 10px 42px", borderRadius:12, border:`1.5px solid ${C.border}`,
            fontSize:14, outline:"none", fontFamily:"inherit", background:C.lightGray, color:C.dark, boxSizing:"border-box" }}
        />
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginLeft:"auto" }}>
        {[["home","ホーム"],["search","さがす"],["events","イベント"],["gallery","ギャラリー"],["liked","お気に入り"]].map(([id,label])=>(
          <button key={id} onClick={()=>setPage(id)} style={{
            background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
            fontSize:14, fontWeight:700, color:C.dark, padding:"4px 8px"
          }}>{label}</button>
        ))}
        <button onClick={()=>setPage("sell")} style={{
          padding:"9px 20px", background:C.orange, border:"none", borderRadius:10,
          color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit"
        }}>出品する</button>
        {user ? (
          <UserMenu setPage={setPage}/>
        ) : (
          <button onClick={()=>setPage("signup")} style={{
            padding:"9px 20px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:10,
            color:C.dark, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit"
          }}>ログイン</button>
        )}
      </div>
    </nav>
  );
};

const Stars = ({ rating, size=12 }) => (
  <span style={{ color:C.orange, fontSize:size }}>{"★".repeat(Math.round(rating))}{"☆".repeat(5-Math.round(rating))}</span>
);

const Tag = ({ text }) => (
  <span style={{ background:C.orange, color:"#fff", fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>{text}</span>
);

const Card = ({ item, onClick, liked, onLike }) => (
  <div onClick={() => onClick(item)} style={{
    background:C.white, borderRadius:16, overflow:"hidden",
    cursor:"pointer", border:`1px solid ${C.border}`,
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)", width:"100%"
  }}>
    <div style={{ height:140, background:item.bg || "#FFF3E0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:60, position:"relative", overflow:"hidden" }}>
      {item.imageUrl
        ? <img src={item.imageUrl} alt={item.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
        : item.emoji
      }
      {item.tag && <div style={{ position:"absolute", top:8, left:8 }}><Tag text={item.tag}/></div>}
      <button onClick={e=>{e.stopPropagation();onLike(item.id);}} style={{
        position:"absolute", top:8, right:8, width:30, height:30, borderRadius:"50%",
        background:"rgba(255,255,255,0.92)", border:"none", cursor:"pointer", fontSize:14,
        display:"flex", alignItems:"center", justifyContent:"center"
      }}>{liked?"❤️":"🤍"}</button>
    </div>
    <div style={{ padding:"10px 12px 12px" }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.dark, lineHeight:1.4, marginBottom:4,
        overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
        {item.title}
      </div>
      <div style={{ fontSize:11, color:C.warmGray, marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {item.sellerAvatar
          ? <img src={item.sellerAvatar} alt="" style={{ width:14, height:14, borderRadius:"50%", marginRight:4, verticalAlign:"middle" }}/>
          : <span>{item.sellerIcon} </span>
        }
        {item.seller}
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:15, fontWeight:900, color:C.orange }}>¥{item.price?.toLocaleString()}</span>
        {item.rating > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:3 }}>
            <Stars rating={item.rating} size={11}/>
            <span style={{ fontSize:10, color:C.warmGray }}>({item.reviews})</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

// ── Mobile Navbar (v3.1 準拠 3層構造、PC Sidebar と統一) ──────────────────
// 「街を歩く」「作品を置く」「暮らしの設定」の3階層、PC Sidebar と完全に同じ認知モデル。
// - ホーム / さがす はハンバーガーから削除 (ロゴクリックで Home、検索バーは中央常時表示)
// - "出品する" アイコン: 🐾 (Gallery と重複) → ✎ (識別性向上、PC と統一)
// - 階層見出し: fontSize 11, weight 400, warmGray, letterSpacing
// - 区切り線: opacity 0.5
// - 各リンク: weight 400 (装飾控えめ), タップ可能性 padding 14/20px 維持
// スマホ第一: タップ可能性・読みやすさは現状維持以上
const Navbar = ({ setPage, liked: _liked, search, setSearch }: any) => {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  // MyPage の特定タブを開く (「管理する」用、PC Sidebar と共通)
  const openMyPageTab = (tab: string) => {
    setPage("mypage");
    setMenuOpen(false);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("openMyPageTab", { detail: { tab } }));
    }, 100);
  };

  const navigate = (page: string) => {
    setPage(page);
    setMenuOpen(false);
  };

  // PC Sidebar と完全に同じ3階層構造
  const sections: Array<{
    heading: string;
    items: Array<{ key: string; icon: string; label: string; onClick: () => void; requireAuth?: boolean }>;
  }> = [
    {
      heading: "街を歩く",
      items: [
        { key: "gallery",     icon: "🐾", label: "ギャラリー",      onClick: () => navigate("gallery") },
        { key: "communities", icon: "💬", label: "広場",            onClick: () => navigate("communities") },
        { key: "events",      icon: "📅", label: "イベント",        onClick: () => navigate("events") },
        { key: "facilities",  icon: "🐕", label: "地図",            onClick: () => navigate("facilities") },
        { key: "blog",        icon: "📝", label: "ブログ",          onClick: () => navigate("blog") },
      ],
    },
    {
      heading: "作品を置く",
      items: [
        { key: "sell",        icon: "✎",  label: "出品する",        onClick: () => navigate("sell") },
        { key: "manage",      icon: "📦", label: "管理する",        onClick: () => openMyPageTab("sales"), requireAuth: true },
      ],
    },
    {
      heading: "暮らしの設定",
      items: [
        { key: "mypage",      icon: "👤", label: "マイページ",      onClick: () => navigate("mypage"), requireAuth: true },
        { key: "contact",     icon: "✉️", label: "お問い合わせ",    onClick: () => navigate("contact") },
      ],
    },
  ];

  return (
    <>
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:200,
        background: scrolled ? "rgba(250,250,247,0.97)" : C.white,
        backdropFilter:"blur(12px)",
        borderBottom:`1px solid ${scrolled ? C.border : "transparent"}`,
        padding:"0 16px", height:60,
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
        transition:"all 0.3s"
      }}>
        <div onClick={()=>setMenuOpen(!menuOpen)} style={{ cursor:"pointer", fontSize:22, flexShrink:0, width:32, height:44, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {menuOpen ? "✕" : "☰"}
        </div>
        <div onClick={()=>setPage("home")} style={{ flexShrink:0, cursor:"pointer" }}><Logo size={30}/></div>
        <div style={{ flex:1, maxWidth:280, position:"relative" }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14, color:C.warmGray }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setPage("search")}
            placeholder="サービスを探す..."
            style={{ width:"100%", padding:"8px 10px 8px 30px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, outline:"none", fontFamily:"inherit", background:C.lightGray, color:C.dark, boxSizing:"border-box" }}
          />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {user ? (
            <UserMenu setPage={setPage}/>
          ) : (
            <button onClick={()=>setPage("signup")} style={{
              minHeight:44, padding:"8px 14px", background:"transparent",
              border:`1.5px solid ${C.orange}`, borderRadius:10,
              color:C.orange, fontWeight:700, fontSize:12,
              cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:4,
              transition:"background 0.3s ease, color 0.3s ease",
            }}>ログイン<span style={{ fontSize: 11, opacity: 0.85 }}>→</span></button>
          )}
        </div>
      </nav>

      {/* ハンバーガーメニュー (3 階層) */}
      {menuOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:199 }} onClick={()=>setMenuOpen(false)}>
          <div style={{
            position:"fixed", top:60, left:0, right:0, background:C.white,
            borderBottom:`1px solid ${C.border}`, boxShadow:"0 8px 24px rgba(0,0,0,0.12)",
            padding:"8px 0 12px", maxHeight:"80vh", overflow:"auto"
          }} onClick={e=>e.stopPropagation()}>
            {sections.map((section, sIdx) => {
              // ログイン必要な項目を非ログイン時にフィルタ
              const items = section.items.filter(item => !item.requireAuth || !!user);
              if (items.length === 0) return null;
              return (
                <div key={section.heading}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: C.warmGray,
                    padding: "12px 20px 6px",
                    letterSpacing: "0.08em",
                    opacity: 0.85,
                  }}>
                    {section.heading}
                  </div>
                  {items.map(item => (
                    <button
                      key={item.key}
                      onClick={item.onClick}
                      style={{
                        width: "100%",
                        padding: "14px 20px",
                        border: "none",
                        background: "transparent",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 15,
                        fontWeight: 400,
                        color: C.dark,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 20, opacity: 0.85, width: 24, display: "inline-flex", justifyContent: "center" }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                  {sIdx < sections.length - 1 && (
                    <div style={{
                      margin: "10px 20px",
                      height: 1,
                      background: C.border,
                      opacity: 0.5,
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

// ── ヒーローセクション統計データ取得 ──────────────────────────────────────
// リアル値を取得し、100超えたら「+」表記
const formatStat = (n:number, threshold:number = 100) => {
  if (n >= threshold) {
    // 100以上は切り下げて「+」表記（例: 234 → "200+"）
    if (n >= 1000) {
      const k = Math.floor(n / 1000);
      return `${k},000+`;
    }
    const rounded = Math.floor(n / 100) * 100;
    return `${rounded.toLocaleString()}+`;
  }
  return n.toLocaleString();
};

const useHeroStats = () => {
  const [stats, setStats] = useState<{ listings:string; users:string; communities:string }>({ listings: "0", users: "0", communities: "0" });
  useEffect(()=>{
    (async ()=>{
      const [listingsRes, usersRes, commsRes] = await Promise.all([
        supabase.from("listings").select("id", { count:"exact", head:true }),
        supabase.from("profiles").select("id", { count:"exact", head:true }),
        supabase.from("communities").select("id", { count:"exact", head:true }).eq("is_archived", false),
      ]);
      setStats({
        listings: formatStat(listingsRes.count || 0),
        users: formatStat(usersRes.count || 0),
        communities: formatStat(commsRes.count || 0, 50),
      });
    })();
  }, []);
  return stats;
};

// ── HOME (Mobile) ─────────────────────────────────────────────────────────

// ============================================================================
// 法律系ページ（バグ#1-4 修正）
// ============================================================================

// ── 特定商取引法に基づく表記（法的義務）─────────────────────────────
const TokushoPage = ({ setPage, isPC }) => {
  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:780, margin:"0 auto", padding:"40px 20px 60px" }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16, padding:0, fontFamily:"inherit" }}>← ホームに戻る</button>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>📜 特定商取引法に基づく表記</h1>
        <p style={{ fontSize:11, color:C.warmGray, marginBottom:24 }}>最終更新日: 2026年5月11日</p>

        <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}`, lineHeight:1.8 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <tbody>
              {[
                ["販売事業者", "Qocca運営事務局"],
                ["運営責任者", "正和"],
                ["所在地", "ご請求があれば遅滞なく開示いたします"],
                ["連絡先", "support@qocca.pet（お問い合わせフォームよりご連絡ください）"],
                ["販売価格", "各商品ページに表示の価格"],
                ["商品代金以外の必要料金", "決済手数料（購入者負担・購入時に明示）／配送料（出品者の定めによる）"],
                ["お支払い方法", "クレジットカード決済（Stripe）"],
                ["お支払い時期", "ご注文時に決済"],
                ["商品引渡し時期", "各商品ページに記載の納期に準ずる"],
                ["返品・交換について", "オーダーメイド作品の性質上、原則として返品・交換は受け付けておりません。商品に明らかな瑕疵がある場合は、商品到着後7日以内にお問い合わせフォームよりご連絡ください。"],
                ["事業者の検査済証", "特定商取引法第11条第6号に基づく表記"],
              ].map(([k,v]) => (
                <tr key={k} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"12px 12px 12px 0", fontWeight:800, color:C.dark, verticalAlign:"top", width:"30%", minWidth:120 }}>{k}</td>
                  <td style={{ padding:"12px 0", color:"#444" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize:11, color:C.warmGray, marginTop:24, lineHeight:1.7 }}>
            ※ 本表記は特定商取引法第11条に基づくものです。<br/>
            ※ Qoccaはペットオーナー向けクリエイターマーケットプレイスとして運営されており、各取引はQoccaを通じて出品者と購入者の間で成立します。
          </p>
        </div>
      </div>
    </div>
  );
};

// ── 利用規約 ─────────────────────────────────────────────────────
const TermsPage = ({ setPage, isPC }) => {
  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:780, margin:"0 auto", padding:"40px 20px 60px" }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16, padding:0, fontFamily:"inherit" }}>← ホームに戻る</button>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>📋 利用規約</h1>
        <p style={{ fontSize:11, color:C.warmGray, marginBottom:24 }}>最終更新日: 2026年5月11日</p>

        <div style={{ background:C.white, borderRadius:16, padding:"24px 28px", border:`1px solid ${C.border}`, lineHeight:1.9, fontSize:13, color:"#333" }}>
          <p style={{ marginBottom:20 }}>
            本利用規約（以下「本規約」）は、Qocca運営事務局（以下「当社」）が提供するペットオーナー向けクリエイターマーケットプレイス「Qocca」（以下「本サービス」）の利用条件を定めるものです🐾
          </p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第1条（定義）</h2>
          <p>「ユーザー」とは、本規約に同意の上、本サービスを利用する個人または法人をいいます。「出品者」とは、本サービス上で商品やサービスを販売するユーザーをいいます。「購入者」とは、本サービス上で商品やサービスを購入するユーザーをいいます。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第2条（規約の同意）</h2>
          <p>ユーザーは、本サービスの利用開始時点で本規約に同意したものとみなされます。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第3条（アカウント）</h2>
          <p>ユーザーは、自己の責任においてアカウント情報を管理するものとし、第三者に譲渡・貸与してはなりません。アカウント情報の漏洩により生じた損害について、当社は責任を負いません。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第4条（禁止事項）</h2>
          <p>ユーザーは以下の行為を行ってはなりません：</p>
          <ul style={{ paddingLeft:20, marginTop:6 }}>
            <li>法令または公序良俗に違反する行為</li>
            <li>他者の権利・利益を侵害する行為</li>
            <li>動物の福祉に反する商品・サービスの出品</li>
            <li>偽造品・盗品の出品</li>
            <li>誹謗中傷、嫌がらせ、差別的表現の投稿</li>
            <li>本サービスを介さない取引の誘導</li>
            <li>不正アクセス、システム妨害</li>
            <li>その他、当社が不適切と判断する行為</li>
          </ul>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第5条（取引）</h2>
          <p>本サービス上の取引は、出品者と購入者の間で成立します。当社は決済の代行・エスクローを行いますが、商品の品質・配送等については出品者が責任を負います。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第6条（手数料）</h2>
          <p>当社は出品者から販売手数料を、購入者から決済保証手数料を受領します。手数料率は別途定め、本サービス上で明示します。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第7条（コンテンツ）</h2>
          <p>ユーザーが投稿したコンテンツ（商品画像、ブログ、ギャラリー、コメント等）について、ユーザーは著作権を保持します。当社は本サービスの運営に必要な範囲で、当該コンテンツを利用できるものとします。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第8条（サービスの変更・中止）</h2>
          <p>当社は、本サービスの内容を予告なく変更・追加・中止できるものとします。これによりユーザーに生じた損害について、当社は責任を負いません。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第9条（免責事項）</h2>
          <p>当社は、本サービスに関して、その完全性・正確性・有用性等について保証しません。本サービスの利用により生じた損害について、当社の故意または重過失による場合を除き、責任を負いません。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第10条（規約の変更）</h2>
          <p>当社は、本規約を予告なく変更できるものとします。変更後の規約は、本サービス上に掲載した時点で効力を生じます。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>第11条（準拠法・管轄）</h2>
          <p>本規約は日本法に準拠し、本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>

          <p style={{ marginTop:32, padding:"16px", background:C.cream, borderRadius:10, fontSize:12, color:C.warmGray }}>
            🐾 Qoccaは「ペット好きが集まる温かい街」を目指しています。<br/>
            すべてのユーザーが安心して利用できるよう、本規約の遵守をお願いいたします。
          </p>
        </div>
      </div>
    </div>
  );
};

// ── プライバシーポリシー ────────────────────────────────────────────
const PrivacyPage = ({ setPage, isPC }) => {
  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:780, margin:"0 auto", padding:"40px 20px 60px" }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16, padding:0, fontFamily:"inherit" }}>← ホームに戻る</button>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>🔒 プライバシーポリシー</h1>
        <p style={{ fontSize:11, color:C.warmGray, marginBottom:24 }}>最終更新日: 2026年5月11日</p>

        <div style={{ background:C.white, borderRadius:16, padding:"24px 28px", border:`1px solid ${C.border}`, lineHeight:1.9, fontSize:13, color:"#333" }}>
          <p style={{ marginBottom:20 }}>
            Qocca運営事務局（以下「当社」）は、ユーザーの個人情報の保護を重要な責務と認識し、個人情報保護法および関連法令を遵守して、適切に取り扱います🐾
          </p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>1. 取得する情報</h2>
          <ul style={{ paddingLeft:20 }}>
            <li>氏名、ニックネーム、メールアドレス、プロフィール画像</li>
            <li>取引履歴（出品・購入・決済情報）</li>
            <li>配送先住所（購入時のみ）</li>
            <li>口座情報（出品者のみ・Stripe Connect経由）</li>
            <li>サービス利用ログ（IPアドレス、Cookie、デバイス情報）</li>
          </ul>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>2. 利用目的</h2>
          <ul style={{ paddingLeft:20 }}>
            <li>本サービスの提供・運営</li>
            <li>本人確認、決済処理</li>
            <li>サポート対応、不正利用の防止</li>
            <li>サービスの改善、新機能開発</li>
            <li>マーケティング（同意のある場合のみ）</li>
          </ul>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>3. 第三者への提供</h2>
          <p>当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません：</p>
          <ul style={{ paddingLeft:20, marginTop:6 }}>
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>取引相手への必要最小限の情報提供（出品者から購入者への配送など）</li>
            <li>決済代行業者（Stripe）への取引情報の提供</li>
          </ul>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>4. 情報の管理</h2>
          <p>当社は、取得した個人情報を安全に管理し、不正アクセス・紛失・改ざん・漏洩等が起きないよう適切な措置を講じます。データはSupabase（PostgreSQL）で暗号化保存され、Row Level Security（RLS）により厳格にアクセス制御しています。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>5. Cookieの利用</h2>
          <p>本サービスは、利便性向上のためCookieを利用します。Cookieの受け入れはブラウザ設定で拒否することができますが、その場合一部機能が利用できない可能性があります。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>6. 開示・訂正・削除請求</h2>
          <p>ユーザーは、自己の個人情報について、開示・訂正・削除を請求できます。お問い合わせフォームよりご連絡ください。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>7. アカウント削除</h2>
          <p>退会希望のユーザーは、お問い合わせフォームより削除請求していただけます。一定期間経過後、技術的に可能な範囲で個人情報を削除いたします。なお、取引履歴・法令で保管が義務付けられた情報は、法定期間保管します。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>8. プライバシーポリシーの変更</h2>
          <p>当社は、本ポリシーを必要に応じて変更できるものとします。重要な変更がある場合は、本サービス上で通知します。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>9. お問い合わせ</h2>
          <p>本ポリシーに関するお問い合わせは、お問い合わせフォームよりご連絡ください。</p>

          <p style={{ marginTop:32, padding:"16px", background:C.cream, borderRadius:10, fontSize:12, color:C.warmGray }}>
            🐾 Qoccaは、ペットオーナー様の大切な個人情報を、ペットへの愛情と同じ気持ちで、大切に守ります。
          </p>
        </div>
      </div>
    </div>
  );
};

// ── お問い合わせ ─────────────────────────────────────────────────
const ContactPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !subject.trim() || !message.trim()) {
      setError("すべての項目を入力してください");
      return;
    }
    setSubmitting(true);
    
    // 1. support_tickets にチケット本体を作成
    const ticketNumber = "QC-" + Date.now().toString().slice(-8);
    const { data: ticketData, error: ticketErr } = await supabase
      .from("support_tickets")
      .insert({
        ticket_number: ticketNumber,
        user_id: user?.id || null,
        category,
        subject: subject.trim(),
        priority: "normal",
        status: "open",
      })
      .select()
      .single();
    
    if (ticketErr || !ticketData) {
      setSubmitting(false);
      setError("送信に失敗しました: " + (ticketErr?.message || "ticket creation failed"));
      return;
    }
    
    // 2. support_messages に初回メッセージ（本文 + email 情報）を保存
    const bodyText = `【返信先メールアドレス】\n${email.trim()}\n\n【お問い合わせ内容】\n${message.trim()}`;
    const { error: msgErr } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketData.id,
        sender_type: "user",
        sender_id: user?.id || null,
        body: bodyText,
      });
    
    setSubmitting(false);
    if (msgErr) {
      setError("メッセージ保存に失敗しました: " + msgErr.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center", padding:32, maxWidth:400 }}>
          <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
          <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:10 }}>送信ありがとうございます！</h2>
          <p style={{ color:C.warmGray, fontSize:13, lineHeight:1.7, marginBottom:24 }}>
            お問い合わせを受け付けました🐾<br/>
            運営事務局より、3営業日以内にご返信いたします。
          </p>
          <button onClick={()=>setPage("home")} style={{ padding:"12px 28px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>ホームに戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"40px 20px 60px" }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16, padding:0, fontFamily:"inherit" }}>← ホームに戻る</button>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>🎧 お問い合わせ</h1>
        <p style={{ fontSize:13, color:C.warmGray, marginBottom:24, lineHeight:1.7 }}>
          Qoccaに関するご質問・ご要望はこちらから🐾<br/>
          3営業日以内にメールにてご返信いたします。
        </p>

        <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}` }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>お問い合わせ種別</label>
            <select value={category} onChange={e=>setCategory(e.target.value)} style={{
              width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box"
            }}>
              <option value="general">一般的なご質問</option>
              <option value="account">アカウント・ログインについて</option>
              <option value="order">注文・取引について</option>
              <option value="payment">決済・支払いについて</option>
              <option value="creator">出品者として参加したい</option>
              <option value="bug">不具合の報告</option>
              <option value="feature">機能要望・提案</option>
              <option value="press">取材・メディア掲載依頼</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>返信先メールアドレス *</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={{
              width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
            }}/>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>件名 *</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={100} placeholder="例: 出品方法について" style={{
              width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
            }}/>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>お問い合わせ内容 *</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={6} maxLength={3000} placeholder="お問い合わせの詳細をご記入ください" style={{
              width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
            }}/>
            <div style={{ fontSize:10, color:C.warmGray, textAlign:"right", marginTop:4 }}>{message.length}/3000</div>
          </div>

          {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12 }}>{error}</div>}

          <div style={{ background:C.cream, borderRadius:10, padding:"12px 14px", fontSize:11, color:"#5D4037", lineHeight:1.7, marginBottom:14 }}>
            📋 個人情報の取扱いについては<span onClick={()=>setPage("privacy")} style={{ color:C.orange, fontWeight:700, cursor:"pointer" }}>プライバシーポリシー</span>をご確認ください。<br/>
            🐾 お返事まで通常2-3営業日いただきます。お急ぎの場合はその旨ご記載ください。
          </div>

          <button disabled={submitting} onClick={handleSubmit} style={{
            width:"100%", padding:"14px", background:submitting?C.warmGray:C.orange, border:"none", borderRadius:12,
            color:"#fff", fontWeight:800, fontSize:14, cursor:submitting?"not-allowed":"pointer", fontFamily:"inherit"
          }}>{submitting ? "送信中..." : "📨 送信する"}</button>
        </div>
      </div>
    </div>
  );
};

// ── Qocca Town Guide ("What is Qocca?" 街の機能ガイド)─────────────────
const QoccaTownGuide = ({ setPage }) => {
  const features = [
    { icon:"💬", emoji:"🏞", label:"広場", title:"仲間と話せる広場", desc:"同じ犬種・年齢・お悩みの仲間とつながる。\nペット好き専用のコミュニティ。", to:"communities" },
    { icon:"🛍", emoji:"🏪", label:"商店街", title:"想いを形にした商店街", desc:"似顔絵・ハンドメイド服・写真撮影。\nペット好きクリエイターの一点物が並ぶ。", to:"search" },
    { icon:"🗺", emoji:"🏯", label:"案内所", title:"全国の施設・イベント案内所", desc:"ドッグラン、公園、ペット可カフェ。\n全国の情報がここに集まる。", to:"facilities" },
    { icon:"📷", emoji:"🖼", label:"掲示板", title:"うちの子の写真掲示板", desc:"自慢のうちの子をシェアして、\n他の住民とコメントで盛り上がる。", to:"gallery" },
  ];
  return (
    <section style={{ padding:"50px 20px 40px", background:C.cream }}>
      <div style={{ maxWidth:880, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"inline-block", padding:"4px 14px", background:C.orangePale, color:C.orange, fontSize:11, fontWeight:800, borderRadius:20, marginBottom:14, letterSpacing:0.5 }}>
            🏘 QOCCA TOWN
          </div>
          <h2 style={{ fontSize:24, fontWeight:900, color:C.dark, lineHeight:1.4, marginBottom:10 }}>
            Qoccaは、こんな街です 🐾
          </h2>
          <p style={{ fontSize:13, color:C.warmGray, lineHeight:1.8 }}>
            ペット好きしか住んでいない、温かい街。<br/>
            ここには、4つの場所があります。
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:14 }}>
          {features.map((f,i) => (
            <div key={i} onClick={()=>setPage(f.to)} style={{
              background:C.white, borderRadius:16, padding:"24px 18px", border:`1px solid ${C.border}`,
              cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s",
              boxShadow:"0 2px 8px rgba(0,0,0,0.04)"
            }} onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 8px 20px rgba(245,169,74,0.15)"; }} onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"; }}>
              <div style={{ fontSize:42, marginBottom:10, lineHeight:1 }}>{f.emoji}</div>
              <div style={{ fontSize:10, color:C.orange, fontWeight:800, letterSpacing:1, marginBottom:6 }}>{f.icon} {f.label.toUpperCase()}</div>
              <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>{f.title}</div>
              <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.7, whiteSpace:"pre-line" }}>{f.desc}</div>
              <div style={{ fontSize:11, color:C.orange, fontWeight:700, marginTop:12 }}>のぞいてみる →</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:28, padding:"18px 20px", background:`linear-gradient(135deg, ${C.orangePale} 0%, ${C.cream} 100%)`, borderRadius:14, textAlign:"center", border:`1px dashed ${C.orange}` }}>
          <p style={{ fontSize:13, color:C.dark, fontWeight:700, lineHeight:1.7, margin:0 }}>
            🐨 「動物を飼ったら、まずQocca」
          </p>
          <p style={{ fontSize:11, color:C.warmGray, marginTop:6, lineHeight:1.7 }}>
            そんな"当たり前"を目指して、街を育てています。
          </p>
        </div>
      </div>
    </section>
  );
};

// ── First Step Guide ("はじめての方へ" 3ステップ)────────────────────
const FirstStepGuide = ({ setPage }) => {
  const steps = [
    { num:"1", emoji:"🐾", title:"住民になる(30秒)", desc:"うちの子のプロフィールを登録。\n街の住民として歓迎されます。", action:"アカウント作成", to:"signup" },
    { num:"2", emoji:"💬", title:"広場で挨拶する(1分)", desc:"同じ犬種・地域の仲間がいる\nコミュニティに参加してみよう。", action:"広場をのぞく", to:"communities" },
    { num:"3", emoji:"🏘", title:"街を散歩する", desc:"商店街でお気に入りを探したり、\n近所の施設を案内所でチェック。", action:"街を歩く", to:"search" },
  ];
  return (
    <section style={{ padding:"40px 20px 50px", background:C.white }}>
      <div style={{ maxWidth:780, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ display:"inline-block", padding:"4px 14px", background:"#E8F5E9", color:"#2E7D32", fontSize:11, fontWeight:800, borderRadius:20, marginBottom:14, letterSpacing:0.5 }}>
            👋 FIRST STEP
          </div>
          <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, lineHeight:1.4, marginBottom:8 }}>
            はじめての方へ
          </h2>
          <p style={{ fontSize:13, color:C.warmGray, lineHeight:1.8 }}>
            3ステップで、Qoccaの住民デビュー 🐨
          </p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {steps.map((s,i)=>(
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:16, padding:"18px 20px",
              background:C.cream, borderRadius:16, border:`1px solid ${C.border}`
            }}>
              <div style={{
                width:48, height:48, borderRadius:"50%",
                background:`linear-gradient(135deg, ${C.orange} 0%, ${C.orangeLight} 100%)`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18, fontWeight:900, color:"#fff", flexShrink:0,
                boxShadow:"0 4px 10px rgba(245,169,74,0.3)"
              }}>{s.num}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:18 }}>{s.emoji}</span>
                  <span style={{ fontSize:14, fontWeight:900, color:C.dark }}>{s.title}</span>
                </div>
                <div style={{ fontSize:12, color:C.warmGray, lineHeight:1.7, whiteSpace:"pre-line", marginBottom:8 }}>{s.desc}</div>
                <button onClick={()=>setPage(s.to)} style={{
                  padding:"6px 14px", background:C.white, border:`1.5px solid ${C.orange}`,
                  borderRadius:20, color:C.orange, fontWeight:800, fontSize:11,
                  cursor:"pointer", fontFamily:"inherit"
                }}>{s.action} →</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:24, textAlign:"center" }}>
          <p style={{ fontSize:12, color:C.warmGray, lineHeight:1.7 }}>
            迷ったら、まずは <span onClick={()=>setPage("communities")} style={{ color:C.orange, fontWeight:800, cursor:"pointer", textDecoration:"underline" }}>広場をのぞいてみる</span> のがおすすめ 🐾
          </p>
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// Qocca リニューアル用デザイントークン
// ============================================================================
const QC = {
  warmWhite: '#FAF7F2',
  cream: '#F5EFE6',
  lightSand: '#EEE6D9',
  charcoal: '#2C2926',
  warmGray: '#6B6259',
  softBrown: '#8B6F5C',
  mutedGreen: '#7A8B6E',
  sage: '#A8B59E',
  terracotta: '#C97B5F',
};

const QC_FONT_JP = '"Zen Kaku Gothic New", "LINE Seed JP", "Noto Sans JP", sans-serif';
const QC_FONT_EN = '"Instrument Serif", "Manrope", serif';

// CSS keyframes（インライン用）- 静けさ Redesign 版
const QC_KEYFRAMES = `
  @keyframes qocca-fadeInSlow {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes qocca-fadeInSlowUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes qocca-breathe-slow {
    0%, 100% { opacity: 0.2; transform: translateX(-50%) translateY(0); }
    50%      { opacity: 0.6; transform: translateX(-50%) translateY(4px); }
  }

  @keyframes qocca-ken-burns-1 {
    0%   { transform: scale(1.0) translate(0, 0); }
    100% { transform: scale(1.08) translate(-1%, -1%); }
  }

  @keyframes qocca-ken-burns-2 {
    0%   { transform: scale(1.05) translate(1%, 0); }
    100% { transform: scale(1.0) translate(0, -1%); }
  }

  @keyframes qocca-ken-burns-3 {
    0%   { transform: scale(1.0) translate(0, 1%); }
    100% { transform: scale(1.08) translate(1%, 0); }
  }
`;

// タイミング定数
const QC_TIMING = {
  hoverDuration: '0.8s',
  hoverEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sectionFadeIn: '1.2s',
  sectionFadeInEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  heroCrossFade: 1500,
  pageTransition: '0.8s',
  buttonHover: '0.6s',
  microMotion: '1.0s',
  staggerDelay: 200,
};

// ============================================================================
// SECTION 1: ファーストビュー (SectionHero)
// ============================================================================

// 各画像の表示時間（秒）- display_priority 1〜7 に対応
// 静けさ Redesign: 各 +40% で時間をゆっくり流す
const QC_HERO_DURATIONS = [14, 10, 10, 10, 10, 10, 14];
const QC_HERO_TRANSITION_MS = 1500;
const QC_PC_BREAKPOINT = 768;

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
            <p style={{
              fontSize: "clamp(24px, 4vw, 48px)",
              fontFamily: QC_FONT_JP,
              fontWeight: 300,
              color: QC.warmWhite,
              letterSpacing: "0.08em",
              lineHeight: 1.6,
              opacity: 0.95,
              margin: 0,
              textShadow: "0 2px 24px rgba(44, 41, 38, 0.5), 0 1px 4px rgba(44, 41, 38, 0.3)",
            }}>
              うちの子との時間を、
              <br />
              ちゃんと残せる場所。
            </p>
            <p style={{
              fontSize: "clamp(12px, 1.2vw, 16px)",
              fontFamily: QC_FONT_JP,
              fontWeight: 300,
              color: QC.warmWhite,
              letterSpacing: "0.08em",
              lineHeight: 1.9,
              opacity: 0.75,
              margin: "24px 0 0 0",
              textShadow: "0 2px 16px rgba(44, 41, 38, 0.5)",
            }}>
              ペットを愛する人たちが集まる、
              <br />
              コミュニティ＆マーケットプレイス。
            </p>
          </>
        ) : (
          <p style={{
            fontSize: "clamp(18px, 4vw, 28px)",
            fontFamily: QC_FONT_JP,
            fontWeight: 300,
            color: QC.warmWhite,
            letterSpacing: "0.08em",
            lineHeight: 1.8,
            opacity: 0.92,
            margin: 0,
            textShadow: "0 2px 24px rgba(44, 41, 38, 0.5), 0 1px 4px rgba(44, 41, 38, 0.3)",
          }}>
            うちの子を愛してる人が
            <br />
            集まる街。
          </p>
        )}
      </div>

      {/* 右上ロゴ (フェードイン 0.5s遅延 + 2s) */}
      <div style={{
        position: "absolute",
        top: 32,
        right: 32,
        fontFamily: QC_FONT_EN,
        fontSize: 20,
        color: QC.warmWhite,
        opacity: 0,
        letterSpacing: 0.8,
        zIndex: 20,
        fontWeight: 300,
        fontStyle: "italic",
        textShadow: "0 1px 6px rgba(44, 41, 38, 0.4)",
        animation: "qocca-fadeInSlow 2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards",
      }}>
        Qocca
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

const QC_REACTIONS: { key: string; label: string }[] = [
  { key: "precious", label: "尊い" },
  { key: "healed", label: "癒された" },
  { key: "glad_met", label: "出会えてよかった" },
  { key: "want_see", label: "ずっと見てたい" },
];

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

  return (
    <section style={{
      padding: isMobile ? '80px 16px' : '120px 24px',
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

        {/* ブロック1: 7月開店 */}
        <div style={{
          fontSize: isMobile ? 18 : 20,
          fontWeight: 400,
          color: C.dark,
          lineHeight: 1.7,
          letterSpacing: '0.02em',
        }}>
          7月から、少しずつ始まります。
        </div>
        <div style={{
          fontSize: isMobile ? 14 : 15,
          fontWeight: 300,
          color: C.warmGray,
          marginTop: 14,
          letterSpacing: '0.05em',
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

        {/* ブロック3: クラファン + 詩的招待 */}
        <div style={{
          fontSize: isMobile ? 13 : 14,
          fontWeight: 400,
          color: C.dark,
          lineHeight: 1.8,
        }}>
          6月、<br />
          クラウドファンディングを始めます。
        </div>
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
      quote: '"あの瞬間を、永遠の形に"',
      desc: '似顔絵、羊毛作品、記念グッズ。\n街の作家たちが、心を込めて。',
      linkText: '商店街を覗いてみる',
      onClick: () => setPage("search"),
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
      padding: '160px 0 160px',
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
          <h2 style={{
            fontFamily: QC_FONT_JP,
            fontSize: 'clamp(20px, 4vw, 24px)',
            fontWeight: 500,
            color: QC.softBrown,
            letterSpacing: 0.8,
            lineHeight: 1.5,
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
                {/* タイトル (詩的・大きく) */}
                <h3 style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: 17,
                  fontWeight: 400,
                  color: QC.softBrown,
                  margin: '0 0 16px 0',
                  letterSpacing: 0.8,
                  lineHeight: 1.6,
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
        <div style={{ marginTop: 80, textAlign: 'center' }}>
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
        padding: "200px 0 200px",
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
            <h2 style={{
              fontFamily: QC_FONT_JP,
              fontSize: 24,
              fontWeight: 500,
              color: QC.softBrown,
              letterSpacing: 0.8,
              lineHeight: 1.5,
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
        maxHeight: "90vh",
        overflowY: "auto",
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
      onClick: () => setPage("search"),
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
      padding: "200px 0 200px",
      background: "rgba(245, 239, 230, 0.5)",
      borderTop: `1px solid ${QC.lightSand}`,
      borderBottom: `1px solid ${QC.lightSand}`,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>

        {/* セクションヘッダー */}
        <div style={{ marginBottom: 80, textAlign: "center" }}>
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
          <h2 style={{
            fontFamily: QC_FONT_JP,
            fontSize: "clamp(20px, 4vw, 24px)",
            fontWeight: 500,
            color: QC.softBrown,
            letterSpacing: 0.8,
            lineHeight: 1.6,
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
      padding: '200px 0',
      background: 'transparent',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>

        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 100 }}>
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
          <h2 style={{
            fontFamily: QC_FONT_JP,
            fontSize: 'clamp(20px, 4vw, 26px)',
            fontWeight: 500,
            color: QC.softBrown,
            letterSpacing: 0.8,
            lineHeight: 1.5,
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
        <div style={{ marginTop: 100, textAlign: 'center', padding: '0 32px' }}>
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
      padding: '200px 0',
      background: 'transparent',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>

        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 100 }}>
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
          <h2 style={{
            fontFamily: QC_FONT_JP,
            fontSize: 'clamp(20px, 4vw, 26px)',
            fontWeight: 500,
            color: QC.softBrown,
            letterSpacing: 0.8,
            lineHeight: 1.5,
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
          gap: 80,
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
        <div style={{ marginTop: 120, textAlign: 'center', padding: '0 32px' }}>
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
      padding: "200px 0 200px",
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
          <h2 style={{
            fontFamily: QC_FONT_JP,
            fontSize: "clamp(20px, 4vw, 24px)",
            fontWeight: 500,
            color: QC.softBrown,
            letterSpacing: 0.8,
            lineHeight: 1.5,
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
      padding: "240px 0 240px",
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

        <h2 style={{
          fontFamily: QC_FONT_JP,
          fontSize: "clamp(20px, 4vw, 26px)",
          fontWeight: 400,
          color: QC.softBrown,
          letterSpacing: 1,
          lineHeight: 1.8,
          margin: "0 0 40px 0",
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
const HomePage = ({ setPage, listings, liked, onLike, onDetail }) => {
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
      <SectionWhatIsQocca setPage={setPage} />
      <SectionQuietlyLoved listings={listings} onDetail={onDetail} setPage={setPage} />
      <SectionTodaysMoments setPage={setPage} />
      <SectionTownMap setPage={setPage} />
      <SectionResidentArtisans listings={listings} onDetail={onDetail} setPage={setPage} />
      <SectionVoices setPage={setPage} />
      <SectionJoinTown setPage={setPage} />
      <SharedFooter setPage={setPage}/>
    </div>
  );
};

// ── SEARCH ─────────────────────────────────────────────────────────────────
const SearchPage = ({ listings, liked, onLike, onDetail, search, setSearch, isPC }) => {
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("popular");

  let results = listings.filter(l => {
    if (cat !== "all" && l.category !== cat) return false;
    if (search && !l.title.includes(search) && !l.seller.includes(search)) return false;
    return true;
  });
  if (sort === "popular") results = sortByPopularity(results);
  if (sort === "cheap") results = [...results].sort((a,b) => a.price - b.price);
  if (sort === "rating") results = [...results].sort((a,b) => b.rating - a.rating);

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      {!isPC && (
        <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14 }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="キーワードで検索..."
              style={{ width:"100%", padding:"10px 10px 10px 32px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, outline:"none", fontFamily:"inherit", background:C.lightGray, boxSizing:"border-box" }}
            />
          </div>
        </div>
      )}
      <div style={{ padding:"10px 0", background: isPC ? "transparent" : C.white, borderBottom: isPC ? "none" : `1px solid ${C.border}`, display:"flex", gap:8, overflowX:"auto", paddingLeft: isPC ? 0 : 16, paddingRight: isPC ? 0 : 16 }}>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            flexShrink:0, minHeight:44, padding:"8px 16px",
            background: cat===c.id ? C.orangePale : C.white,
            color: cat===c.id ? C.orange : C.warmGray,
            border:`1.5px solid ${cat===c.id ? C.orange : C.border}`,
            borderRadius:22, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:6,
            transition:"background 0.3s ease, color 0.3s ease, border-color 0.3s ease"
          }}>
            <span>{c.icon}</span><span style={{ whiteSpace:"nowrap" }}>{c.label}</span>
          </button>
        ))}
      </div>
      <div style={{ padding:"10px 0", paddingLeft: isPC ? 0 : 16, paddingRight: isPC ? 0 : 16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:13, color:C.warmGray }}>{results.length}件</span>
        <div style={{ display:"flex", gap:6 }}>
          {[["popular","人気"],["rating","評価"],["cheap","価格"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSort(v)} style={{
              padding:"5px 12px", border:`1.5px solid ${sort===v?C.orange:C.border}`,
              borderRadius:16, background: sort===v ? C.orangePale : C.white,
              color: sort===v ? C.orange : C.warmGray, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: isPC ? "0 0 24px" : "0 16px 24px" }}>
        {results.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🐾</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.dark }}>見つかりませんでした</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(3,1fr)" : "1fr 1fr", gap: isPC ? 16 : 12 }}>
            {results.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
          </div>
        )}
      </div>
    </div>
  );
};

// ── DETAIL ─────────────────────────────────────────────────────────────────
const DetailPage = ({ item, onBack, liked, onLike, setPage }) => {
  const { user } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [showAddressStep, setShowAddressStep] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string|null>(null);
  const [addressForm, setAddressForm] = useState({ recipient_name:"", postal_code:"", prefecture:"", city:"", address_line:"", phone:"", label:"自宅" });
  const [addressMode, setAddressMode] = useState<"select"|"new">("select");
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportDone, setReportDone] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  // Phase B: Variant 選択 state
  // - selectedAttrs: 軸ごとの選択値 (例: { 構図: "マズルアップ", サイズ: "小" })
  // - selectedVariant: selectedAttrs に完全一致する listing_variants の row
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  if (!item) return null;

  // Phase B: variant 導出ロジック
  const hasVariants = item.has_variants === true;
  const variants = Array.isArray(item.listing_variants) ? item.listing_variants : [];
  // 軸キーを variants から抽出 (例: ["構図", "サイズ"])
  const variantOptionKeys = hasVariants && variants.length > 0
    ? Array.from(new Set(variants.flatMap(v => Object.keys(v.attributes || {}))))
    : [];
  // 各軸の選択肢一覧
  const variantOptionValues: Record<string, string[]> = variantOptionKeys.reduce((acc, key) => {
    acc[key] = Array.from(new Set(variants.map(v => v.attributes?.[key]).filter(Boolean)));
    return acc;
  }, {} as Record<string, string[]>);

  // selectedAttrs が変化したら一致する variant を探す
  useEffect(() => {
    if (!hasVariants || variantOptionKeys.length === 0) return;
    const allSelected = variantOptionKeys.every(key => selectedAttrs[key]);
    if (!allSelected) {
      setSelectedVariant(null);
      return;
    }
    const matched = variants.find(v =>
      variantOptionKeys.every(key => v.attributes?.[key] === selectedAttrs[key])
    );
    setSelectedVariant(matched || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAttrs, hasVariants]);

  const itemOptions = item.options || [];
  const optionsTotal = itemOptions.reduce((sum, o, i) => sum + (selectedOptions[i] ? (o.price||0) : 0), 0);
  // Phase B: variant 優先の価格計算 (variant 未選択時は item.price)
  const basePrice = hasVariants ? (selectedVariant?.price || 0) : (item.price || 0);
  const totalPrice = basePrice + optionsTotal;

  const toggleOption = (idx) => setSelectedOptions(prev => ({...prev, [idx]: !prev[idx]}));

  const handleOrder = async () => {
    if (!user) { setPage("signup"); return; }
    // Phase B: variant 必須チェック (種類のある商品で未選択時はブロック)
    if (hasVariants && !selectedVariant) {
      alert("種類を選んでください");
      return;
    }
    if (item.delivery_type === "shipping") {
      const { data } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("user_id", user.id)
        .is("delete_at", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      const addrs = data || [];
      setSavedAddresses(addrs);
      if (addrs.length > 0) {
        setSelectedAddressId(addrs[0].id);
        setAddressMode("select");
      } else {
        setAddressMode("new");
      }
      setShowAddressStep(true);
      return;
    }
    setShowConfirm(true);
  };

 const handleConfirmOrder = async () => {
    if (!user?.id) { alert("ログインしてください"); setPage("signup"); return; }
    if (!item.seller_id) { alert("商品情報に問題があります"); return; }

    setOrdering(true);
    try {
      const selectedOpts = itemOptions.filter((_, i) => selectedOptions[i]).map(o => ({ name: o.name, price: o.price }));

      let shippingAddressId = null;
      if (item.delivery_type === "shipping") {
        if (addressMode === "new") {
          const { data: newAddr, error: addrErr } = await supabase
            .from("shipping_addresses")
            .insert({
              user_id: user.id,
              recipient_name: addressForm.recipient_name,
              postal_code: addressForm.postal_code,
              prefecture: addressForm.prefecture,
              city: addressForm.city,
              address_line: addressForm.address_line,
              phone: addressForm.phone,
              label: addressForm.label || "自宅",
              is_default: savedAddresses.length === 0,
            })
            .select()
            .single();
          if (addrErr) {
            alert("住所の保存に失敗: " + addrErr.message);
            setOrdering(false);
            return;
          }
          shippingAddressId = newAddr.id;
        } else {
          shippingAddressId = selectedAddressId;
        }
      }

      const res = await fetch("https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: item.id,
          listing_title: item.title,
          // Phase B: variant 選択時はその価格、未選択時 (単品) は listing.price
          // ⚠️ Edge Function (Phase C) でサーバー側再計算が前提、クライアント値は参考のみ
          price: hasVariants && selectedVariant ? selectedVariant.price : item.price,
          options: selectedOpts,
          buyer_id: user.id,
          seller_id: item.seller_id,
          shipping_address_id: shippingAddressId,
          // Phase B: variant_id を Edge Function に渡す (Phase C で受信処理)
          variant_id: hasVariants && selectedVariant ? selectedVariant.id : null,
        })
      });

      const result = await res.json();
      console.log("Checkout result:", result);

      if (!res.ok) {
        alert("エラー: " + (result.error || result.insertError_message || "不明なエラー"));
        setOrdering(false);
        return;
      }

      if (result.url) {
        window.location.href = result.url;
      } else {
        alert("決済URLが取得できませんでした");
      }
    } catch (e) {
      console.error("Checkout error:", e);
      alert("エラーが発生しました: " + e.message);
    }
    setOrdering(false);
  };

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.orange, fontWeight:700 }}>←</button>
        <span style={{ fontSize:14, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</span>
      </div>
      <div style={{ height:240, background:item.bg || "#FFF3E0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:100, position:"relative", overflow:"hidden" }}>
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          : item.emoji
        }
        <button onClick={() => onLike(item.id)} style={{
          position:"absolute", top:12, right:12, width:40, height:40, borderRadius:"50%",
          background:"rgba(255,255,255,0.92)", border:"none", cursor:"pointer", fontSize:20,
          display:"flex", alignItems:"center", justifyContent:"center"
        }}>{liked ? "❤️" : "🤍"}</button>
      </div>
      <div style={{ padding:"16px" }}>
        {item.tag && <div style={{ marginBottom:8 }}><Tag text={item.tag}/></div>}
        <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.3 }}>{item.title}</h1>
        {item.reviews > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <Stars rating={item.rating} size={14}/>
            <span style={{ color:C.warmGray, fontSize:13 }}>{item.rating} ({item.reviews}件)</span>
          </div>
        )}
        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{item.sellerIcon}</div>
          <div>
            <div style={{ fontWeight:800, color:C.dark, fontSize:15 }}>{item.seller}</div>
            {item.reviews > 0 && (
              <div style={{ fontSize:12, color:C.warmGray }}>評価 {item.rating} · {item.reviews}件</div>
            )}
          </div>
        </div>
        {item.seller_id && (
          <button onClick={()=>setPage(`user/${item.seller_id}`)} style={{ width:"100%", padding:"12px", marginBottom:14, background:C.white, color:C.orange, border:`1.5px solid ${C.orange}`, borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            👤 出品者のプロフィールを見る
          </button>
        )}
        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:8 }}>サービス詳細</div>
          <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>{item.desc}</div>
        </div>

        {/* Phase B: 種類 (Variant) 選択 UI
            ブランド v3 第7章: "翻訳しすぎない"。「種類を選ぶ」普通の言葉、控えめ。
            ブランド v3 第6章: NG "在庫切れ" → "売り切れ"、"残り○点" は controlled 表示OK */}
        {hasVariants && variantOptionKeys.length > 0 && (
          <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:12 }}>
              種類を選ぶ
            </div>
            {variantOptionKeys.map(key => (
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.warmGray, marginBottom:6 }}>
                  {key}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {variantOptionValues[key].map(val => {
                    // この値を含む variants で、在庫があるものがあるか
                    const hasStock = variants.some(v =>
                      v.attributes?.[key] === val && v.stock > 0 && v.is_active
                    );
                    const isSelected = selectedAttrs[key] === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setSelectedAttrs(prev => ({ ...prev, [key]: val }))}
                        disabled={!hasStock}
                        style={{
                          padding:"8px 14px",
                          borderRadius:10,
                          border: isSelected
                            ? `2px solid ${C.orange}`
                            : `1.5px solid ${hasStock ? C.border : "#E0E0E0"}`,
                          background: isSelected
                            ? C.orangePale
                            : hasStock ? C.white : "#F5F5F5",
                          color: isSelected
                            ? C.orange
                            : hasStock ? C.dark : "#BDBDBD",
                          cursor: hasStock ? "pointer" : "not-allowed",
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          textDecoration: hasStock ? "none" : "line-through",
                        }}
                      >
                        {val}
                        {!hasStock && "（売り切れ）"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 選択結果表示 (全軸選択済みで variant が確定した時) */}
            {selectedVariant && (
              <div style={{ marginTop:12, padding:"10px 12px", background:C.cream, borderRadius:10 }}>
                <div style={{ fontSize:12, color:C.warmGray, marginBottom:4 }}>
                  選んだ種類
                </div>
                <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:4 }}>
                  {selectedVariant.variant_name}
                </div>
                <div style={{ fontSize:13, color:C.orange, fontWeight:700 }}>
                  ¥{(selectedVariant.price || 0).toLocaleString()}
                  {selectedVariant.stock > 0 && selectedVariant.stock <= 3 && (
                    <span style={{ fontSize:11, color:C.warmGray, marginLeft:8, fontWeight:500 }}>
                      （残り{selectedVariant.stock}点）
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 未選択時のヒント */}
            {!selectedVariant && (
              <div style={{ marginTop:8, fontSize:11, color:C.warmGray }}>
                {variantOptionKeys.filter(k => !selectedAttrs[k]).join("、")} を選んでください
              </div>
            )}
          </div>
        )}

        {/* 有料オプション */}
        {itemOptions.length > 0 && (
          <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:10 }}>🔧 有料オプション</div>
            {itemOptions.map((opt, i) => (
              <div key={i} onClick={()=>toggleOption(i)} style={{
                display:"flex", alignItems:"center", gap:10, padding:"10px", marginBottom:6,
                background:selectedOptions[i]?C.orangePale:C.lightGray, borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${selectedOptions[i]?C.orange:C.border}`
              }}>
                <div style={{
                  width:22, height:22, borderRadius:6, border:`2px solid ${selectedOptions[i]?C.orange:C.border}`,
                  background:selectedOptions[i]?C.orange:"transparent", display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0
                }}>
                  {selectedOptions[i] && <span style={{ color:"#fff", fontSize:14, fontWeight:900 }}>✓</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{opt.name}</div>
                </div>
                <div style={{ fontSize:14, fontWeight:900, color:C.orange, flexShrink:0 }}>+¥{opt.price?.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
          {[["⏱️ 納期", item.delivery],["📬 受け渡し", item.delivery_type==="shipping"?"📦 配送":item.delivery_type==="visit"?"📍 訪問":"💻 データ"],["🐾 対象", item.pet==="dog"?"🐕 犬向け":item.pet==="cat"?"🐈 猫向け":"🐾 両対応"],["🔒 保証","エスクロー決済"]].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:13, color:C.warmGray }}>{k}</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{v}</span>
            </div>
          ))}
        </div>

        {/* エスクロー説明 */}
        <div style={{ background:"#E3F2FD", borderRadius:14, padding:"14px", marginBottom:14, border:"1px solid #BBDEFB" }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.blue, marginBottom:6 }}>🔒 安心のエスクロー決済</div>
          <div style={{ fontSize:12, color:"#555", lineHeight:1.7 }}>
            お支払いはQoccaが一時お預かりし、取引完了後に出品者へ支払われます。万が一トラブルがあった場合も返金対応いたします。
          </div>
        </div>

        {/* キャンセルポリシー */}
        <div style={{ background:C.lightGray, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:6 }}>📋 キャンセルポリシー</div>
          <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.7 }}>
            ・作業開始前（購入者都合）：決済手数料を差し引いて返金{"\n"}
            ・作業開始前（出品者都合）：全額返金{"\n"}
            ・納品後72時間以内：異議申し立て可能{"\n"}
            ・納品後72時間経過：自動的に取引完了（返金不可）
          </div>
        </div>

        {REVIEWS.length > 0 && (
          <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:80, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:12 }}>レビュー ({item.reviews}件)</div>
            {REVIEWS.map((r,i)=>(
              <div key={i} style={{ marginBottom:12, paddingBottom:12, borderBottom:i<REVIEWS.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <div style={{ width:30, height:30, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>{r.pet}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:C.dark }}>{r.user}</div>
                    <Stars rating={r.rating} size={11}/>
                  </div>
                  <span style={{ marginLeft:"auto", fontSize:11, color:C.warmGray }}>{r.date}</span>
                </div>
                <div style={{ fontSize:13, color:"#555", lineHeight:1.6 }}>{r.comment}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign:"center", marginBottom:80 }}>
          <button onClick={()=>setShowReport(true)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#ccc", textDecoration:"underline", fontFamily:"inherit" }}>🚨 このサービスを通報する</button>
        </div>
      </div>

      {/* 通報モーダル */}
      {showReport && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={()=>setShowReport(false)}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 20px", width:"100%" }} onClick={e=>e.stopPropagation()}>
            {reportDone ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>通報を受け付けました</div>
                <div style={{ fontSize:13, color:C.warmGray, marginBottom:20 }}>管理者が確認次第、対応いたします。</div>
                <button onClick={()=>{setShowReport(false);setReportDone(false);}} style={{ padding:"12px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>閉じる</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:4 }}>🚨 通報する</div>
                <div style={{ fontSize:12, color:C.warmGray, marginBottom:20 }}>通報内容を選択してください</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
                  {["🐾 生体動物の売買","💬 プラットフォーム外への誘導","🎭 なりすまし・偽サービス","⚠️ 著作権侵害","🔞 不適切なコンテンツ","💰 詐欺・虚偽の内容","その他"].map(type => (
                    <button key={type} onClick={()=>setReportType(type)} style={{
                      padding:"12px 16px", border:`2px solid ${reportType===type?C.red:C.border}`,
                      borderRadius:12, background:reportType===type?C.redPale:"#fff",
                      color:reportType===type?C.red:"#3D3B38",
                      fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left", fontFamily:"inherit"
                    }}>{type}</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>setShowReport(false)} style={{ flex:1, padding:"13px", background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
                  <button onClick={()=>reportType&&setReportDone(true)} disabled={!reportType} style={{ flex:2, padding:"13px", background:reportType?C.red:C.border, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:reportType?"pointer":"not-allowed", fontFamily:"inherit" }}>通報する</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 配送先住所選択モーダル */}
      {showAddressStep && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:201, display:"flex", alignItems:"flex-end" }} onClick={()=>setShowAddressStep(false)}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"24px 20px", width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>📦 配送先を選択</div>
              <button onClick={()=>setShowAddressStep(false)} style={{ background:"none", border:"none", fontSize:20, color:C.warmGray, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ background:"#FFF8F0", padding:"10px 12px", borderRadius:10, fontSize:11, color:C.warmGray, marginBottom:14, lineHeight:1.5 }}>
              🔒 配送先情報は出品者に共有され、配送目的のみに使用されます。取引完了後30日で自動削除されます。
            </div>

            {savedAddresses.length > 0 && (
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <button onClick={()=>setAddressMode("select")} style={{
                  flex:1, padding:"10px", border:`1.5px solid ${addressMode==="select"?C.orange:C.border}`,
                  borderRadius:10, background:addressMode==="select"?C.orangePale:C.white,
                  color:addressMode==="select"?C.orange:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
                }}>📋 保存済みから選択</button>
                <button onClick={()=>setAddressMode("new")} style={{
                  flex:1, padding:"10px", border:`1.5px solid ${addressMode==="new"?C.orange:C.border}`,
                  borderRadius:10, background:addressMode==="new"?C.orangePale:C.white,
                  color:addressMode==="new"?C.orange:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
                }}>➕ 新規入力</button>
              </div>
            )}

            {addressMode === "select" && savedAddresses.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                {savedAddresses.map(addr => (
                  <button key={addr.id} onClick={()=>setSelectedAddressId(addr.id)} style={{
                    padding:"12px 14px", border:`2px solid ${selectedAddressId===addr.id?C.orange:C.border}`,
                    borderRadius:10, background:selectedAddressId===addr.id?C.orangePale:C.white,
                    cursor:"pointer", fontFamily:"inherit", textAlign:"left"
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{addr.label || "住所"}</span>
                      {addr.is_default && <span style={{ fontSize:10, padding:"2px 8px", background:C.orange, color:"#fff", borderRadius:6, fontWeight:700 }}>デフォルト</span>}
                      {selectedAddressId===addr.id && <span style={{ marginLeft:"auto", color:C.orange, fontSize:18 }}>✓</span>}
                    </div>
                    <div style={{ fontSize:12, color:C.warmGray, lineHeight:1.5 }}>
                      <div>{addr.recipient_name} 様</div>
                      <div>〒{addr.postal_code} {addr.prefecture}{addr.city}</div>
                      <div>{addr.address_line}</div>
                      <div>📱 {addr.phone}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {addressMode === "new" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
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
                      value={addressForm[f.k as keyof typeof addressForm] as string}
                      onChange={e=>setAddressForm({...addressForm, [f.k]:e.target.value})}
                      placeholder={f.placeholder}
                      maxLength={f.maxLength}
                      style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setShowAddressStep(false)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
              <button onClick={()=>{
                if (addressMode === "new") {
                  if (!addressForm.recipient_name || !addressForm.postal_code || !addressForm.prefecture || !addressForm.city || !addressForm.address_line || !addressForm.phone) {
                    alert("必須項目をすべて入力してください");
                    return;
                  }
                } else {
                  if (!selectedAddressId) { alert("住所を選択してください"); return; }
                }
                setShowAddressStep(false);
                setShowConfirm(true);
              }} style={{ flex:2, padding:"13px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>
                次へ進む →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 購入確認モーダル */}
      {showConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={()=>!ordering&&setShowConfirm(false)}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 20px", width:"100%" }} onClick={e=>e.stopPropagation()}>
            <>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:16 }}>🛒 注文内容の確認</div>
              <div style={{ background:C.lightGray, borderRadius:14, padding:"14px", marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:4 }}>{item.title}</div>
                <div style={{ fontSize:12, color:C.warmGray, marginBottom:8 }}>{item.seller} · 納期 {item.delivery}</div>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.warmGray }}>基本料金</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>¥{item.price.toLocaleString()}</span>
                </div>
                {itemOptions.filter((_, i) => selectedOptions[i]).map((o, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.warmGray }}>🔧 {o.name}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:C.orange }}>+¥{o.price.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:12, color:C.warmGray }}>🛡️ バイヤープロテクション(4%)</span>
                  <span style={{ fontSize:12, fontWeight:700, color:C.warmGray }}>+¥{Math.floor(totalPrice * 0.04).toLocaleString()}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0", borderTop:`2px solid ${C.dark}`, marginTop:4 }}>
                  <span style={{ fontSize:14, fontWeight:800, color:C.dark }}>お支払い合計</span>
                  <span style={{ fontSize:20, fontWeight:900, color:C.orange }}>¥{(totalPrice + Math.floor(totalPrice * 0.04)).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ background:"#E3F2FD", borderRadius:10, padding:"10px", marginBottom:12, fontSize:11, color:C.blue, lineHeight:1.6 }}>
                🔒 Stripe安全決済：クレジットカード情報はStripeが安全に処理します。Qoccaにカード情報は保存されません。
              </div>
              <div style={{ fontSize:10, color:C.warmGray, lineHeight:1.6, marginBottom:16 }}>
                「決済に進む」をクリックすると、Stripeの決済ページに移動します。<span style={{ color:C.orange, fontWeight:700 }}>利用規約</span>・<span style={{ color:C.orange, fontWeight:700 }}>キャンセルポリシー</span>に同意したものとみなされます。
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button disabled={ordering} onClick={()=>setShowConfirm(false)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
                <button disabled={ordering} onClick={handleConfirmOrder} style={{ flex:2, padding:"13px", background:ordering?C.warmGray:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:ordering?"not-allowed":"pointer", fontFamily:"inherit" }}>
                  {ordering ? "処理中..." : "💳 決済に進む"}
                </button>
              </div>
            </>
          </div>
        </div>
      )}

      {/* Fixed bottom order bar */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:C.white, borderTop:`1px solid ${C.border}`,
        padding:"12px 16px", display:"flex", alignItems:"center", gap:12,
        boxShadow:"0 -4px 20px rgba(0,0,0,0.08)"
      }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:C.warmGray }}>お支払い金額(BP込)</div>
          <div style={{ fontSize:24, fontWeight:900, color:C.orange }}>¥{(totalPrice + Math.floor(totalPrice * 0.04)).toLocaleString()}</div>
          <div style={{ fontSize:10, color:C.warmGray }}>
            {/* Phase B: variant 選択時はその価格、未選択時 (単品 or variant 未確定) は item.price */}
            商品 ¥{(basePrice || item.price || 0).toLocaleString()}{optionsTotal > 0 ? ` + オプション ¥${optionsTotal.toLocaleString()}` : ""} + BP ¥{Math.floor(totalPrice * 0.04).toLocaleString()}
          </div>
        </div>
        {ordered ? (
          <div style={{ flex:2, textAlign:"center", padding:"12px", background:C.green, borderRadius:12, color:"#fff", fontWeight:800 }}>🎉 注文完了！</div>
        ) : (
          /* Phase B: hasVariants で variant 未選択時は無効化、ラベルも変化 */
          <button
            onClick={handleOrder}
            disabled={hasVariants && !selectedVariant}
            style={{
              flex:2,
              padding:"14px",
              background: (hasVariants && !selectedVariant) ? C.warmGray : C.orange,
              border:"none",
              borderRadius:12,
              color:"#fff",
              fontWeight:800,
              fontSize:16,
              cursor: (hasVariants && !selectedVariant) ? "not-allowed" : "pointer",
              fontFamily: "inherit"
            }}
          >
            {hasVariants && !selectedVariant
              ? "種類を選んでください"
              : (user ? "🐾 注文する" : "🔒 ログインして注文")}
          </button>
        )}
      </div>
    </div>
  );
};

// ── SELL ───────────────────────────────────────────────────────────────────
const SellPage = ({ setPage }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ cat:"", pet:"both", title:"", desc:"", price:"", delivery:"", delivery_type:"data_only", stock:"" });
  const [images, setImages] = useState([]);
  const [options, setOptions] = useState([]);
  // Phase B: Variant (種類) state
  // - hasVariants: チェックON で variant モード
  // - variantOptions: 軸の定義 (例: [{name: "構図", values: ["マズルアップ", "全身"]}]) max 2 項目
  // - variants: 組合せの実体 [{variant_name, attributes, price, stock, image_url}]
  const [hasVariants, setHasVariants] = useState(false);
  const [variantOptions, setVariantOptions] = useState<Array<{ name: string; values: string[] }>>([]);
  const [variants, setVariants] = useState<Array<any>>([]);
  const up = (k,v) => setForm(p=>({...p,[k]:v}));
  const fileRef = useRef(null);
  const addOption = () => setOptions(prev => [...prev, { name:"", price:"" }]);
  const updateOption = (idx, key, val) => setOptions(prev => prev.map((o,i) => i===idx ? {...o, [key]:val} : o));
  const removeOption = (idx) => setOptions(prev => prev.filter((_,i) => i!==idx));

  // Phase B: Variant 操作関数群
  const addVariantOption = () => {
    if (variantOptions.length >= 2) return; // 最大2項目 (例: 色 × サイズ)
    setVariantOptions(prev => [...prev, { name: "", values: [""] }]);
  };
  const removeVariantOption = (idx) => {
    setVariantOptions(prev => prev.filter((_, i) => i !== idx));
  };
  const updateVariantOptionName = (idx, name) => {
    setVariantOptions(prev => prev.map((o, i) => i === idx ? { ...o, name } : o));
  };
  const addVariantOptionValue = (optIdx) => {
    setVariantOptions(prev => prev.map((o, i) =>
      i === optIdx ? { ...o, values: [...o.values, ""] } : o
    ));
  };
  const updateVariantOptionValue = (optIdx, valIdx, value) => {
    setVariantOptions(prev => prev.map((o, i) =>
      i === optIdx ? { ...o, values: o.values.map((v, j) => j === valIdx ? value : v) } : o
    ));
  };
  const removeVariantOptionValue = (optIdx, valIdx) => {
    setVariantOptions(prev => prev.map((o, i) =>
      i === optIdx ? { ...o, values: o.values.filter((_, j) => j !== valIdx) } : o
    ));
  };

  // 組合せ自動生成 (variantOptions の値リストからすべての組合せを生成)
  // 既存 variant の価格・在庫・画像情報は保持 (attributes 完全一致で照合)
  const regenerateVariants = React.useCallback(() => {
    if (variantOptions.length === 0) {
      setVariants([]);
      return;
    }
    const combinations: any[] = [];
    const generate = (currentIdx: number, currentAttrs: any, currentName: string) => {
      if (currentIdx >= variantOptions.length) {
        combinations.push({
          variant_name: currentName.trim() || "デフォルト",
          attributes: currentAttrs,
          price: form.price || "",
          stock: 1,
          image_url: null,
        });
        return;
      }
      const opt = variantOptions[currentIdx];
      const validValues = opt.values.filter(v => v && v.trim());
      for (const val of validValues) {
        const newAttrs = { ...currentAttrs, [opt.name]: val };
        const separator = currentName ? " × " : "";
        generate(currentIdx + 1, newAttrs, currentName + separator + val);
      }
    };
    generate(0, {}, "");
    // 既存の variant 情報を保持
    setVariants(prev => {
      return combinations.map(c => {
        const existing = prev.find(p =>
          JSON.stringify(p.attributes) === JSON.stringify(c.attributes)
        );
        return existing
          ? { ...c, price: existing.price, stock: existing.stock, image_url: existing.image_url }
          : c;
      });
    });
  }, [variantOptions, form.price]);

  const updateVariant = (idx, key, value) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [key]: value } : v));
  };

  // variantOptions が変更されたら variants を再生成
  useEffect(() => {
    if (hasVariants) {
      regenerateVariants();
    }
  }, [variantOptions, hasVariants, regenerateVariants]);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) { setError("画像は最大5枚までです"); return; }
    setImages(prev => [...prev, ...files].slice(0, 5));
    setError("");
  };
  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (isDraft = false) => {
    setSubmitting(true);
    setError("");
    // Phase B: variants が有効な時のみ price>0 のものを採用 (バリデーション)
    const validVariants = hasVariants
      ? variants.filter(v => v.price && parseInt(v.price) > 0)
      : [];
    const { error: err } = await submitListing(
      user.id,
      form,
      images,
      options.map(o => ({ name:o.name, price:parseInt(o.price)||0 })),
      isDraft,
      validVariants
    );
    setSubmitting(false);
    if (err) { setError((isDraft ? "下書き保存" : "出品") + "に失敗しました: " + err.message); return; }
    setDone({ isDraft });
  };

  if (!user) return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", padding:32, maxWidth:360 }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🔒</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:10 }}>ログインが必要です</h2>
        <p style={{ color:C.warmGray, fontSize:14, lineHeight:1.7, marginBottom:24 }}>出品するにはアカウントが必要です。</p>
        <button onClick={()=>setPage("signup")} style={{ padding:"14px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>ログイン / 新規登録</button>
      </div>
    </div>
  );

  if (done) {
    const isDraftDone = done && done.isDraft;
    return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", padding:32, maxWidth:400 }}>
        <div style={{ fontSize:64, marginBottom:16 }}>{isDraftDone ? "💾" : "🎉"}</div>
        <h2 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:10 }}>{isDraftDone ? "下書き保存しました！" : "出品完了！"}</h2>
        <p style={{ color:C.warmGray, fontSize:14, lineHeight:1.7, marginBottom:24 }}>
          {isDraftDone ? "マイページの「下書き一覧」から、いつでも編集して投稿できます🐾" : "審査後（最大24時間）に公開されます🐾"}
        </p>
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={()=>{setDone(false);setStep(1);setForm({cat:"",pet:"both",title:"",desc:"",price:"",delivery:"",delivery_type:"data_only",stock:""});setImages([]);setOptions([]);setHasVariants(false);setVariantOptions([]);setVariants([]);}} style={{ padding:"12px 24px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>続けて出品する</button>
          <button onClick={()=>setPage("mypage")} style={{ padding:"12px 24px", background:C.white, border:`1.5px solid ${C.orange}`, borderRadius:12, color:C.orange, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>マイページへ</button>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:500, margin:"0 auto", padding:"20px 16px" }}>
        <div style={{ display:"flex", gap:6, marginBottom:6 }}>
          {[1,2,3].map(s=>(<div key={s} style={{ flex:1, height:4, borderRadius:2, background:step>=s?C.orange:C.border }}/>))}
        </div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:20 }}>STEP {step} / 3</div>
        {error && <div style={{ background:C.redPale, color:C.red, padding:"10px 14px", borderRadius:10, fontSize:13, marginBottom:16, fontWeight:700 }}>{error}</div>}
        <div style={{ background:C.white, borderRadius:20, padding:"24px 16px", border:`1px solid ${C.border}` }}>
          {step===1&&<>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:20 }}>カテゴリを選ぶ</h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              {CATS.filter(c=>c.id!=="all").map(c=>(
                <button key={c.id} onClick={()=>up("cat",c.id)} style={{
                  padding:"14px 10px", border:`2px solid ${form.cat===c.id?C.orange:C.border}`,
                  borderRadius:12, background:form.cat===c.id?C.orangePale:C.white,
                  cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit"
                }}>
                  <span style={{ fontSize:24 }}>{c.icon}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:form.cat===c.id?C.orange:C.dark }}>{c.label}</span>
                </button>
              ))}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:10 }}>対象ペット</div>
              <div style={{ display:"flex", gap:8 }}>
                {[["dog","🐕 犬"],["cat","🐈 猫"],["both","🐾 両方"]].map(([v,l])=>(
                  <button key={v} onClick={()=>up("pet",v)} style={{
                    flex:1, padding:"10px 6px", border:`2px solid ${form.pet===v?C.orange:C.border}`,
                    borderRadius:10, background:form.pet===v?C.orangePale:C.white,
                    cursor:"pointer", fontSize:13, fontWeight:700, color:form.pet===v?C.orange:C.warmGray, fontFamily:"inherit"
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </>}
          {step===2&&<>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:20 }}>サービス内容</h2>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>タイトル</label>
              <input value={form.title} onChange={e=>up("title",e.target.value)} placeholder="例：愛犬の水彩似顔絵を描きます"
                style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>詳細説明</label>
              <textarea value={form.desc} onChange={e=>up("desc",e.target.value)} rows={4} placeholder="サービスの内容、こだわり、注意事項など..."
                style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>料金（円）</label>
                <input type="number" value={form.price} onChange={e=>up("price",e.target.value)} placeholder="3000"
                  style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>納期</label>
                <select value={form.delivery} onChange={e=>up("delivery",e.target.value)}
                  style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box" }}>
                  <option value="">選択</option>
                  {["即日","3日以内","1週間以内","2週間以内","要相談"].map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            {/* 配送タイプ選択 */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>受け渡し方法</label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:8 }}>サービスの提供方法を選択してください（プライバシー保護のため正確に選んでください）</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  { v:"data_only", icon:"💻", label:"データのみ", desc:"似顔絵・写真データなど、メッセージで納品（住所不要）" },
                  { v:"shipping", icon:"📦", label:"配送あり", desc:"洋服・グッズ・フードなど、購入者の住所へ郵送" },
                  { v:"visit", icon:"📍", label:"訪問あり", desc:"しつけ・撮影など、対面で提供（場所はDMで調整）" },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={()=>up("delivery_type", opt.v)} style={{
                    padding:"12px 14px", border:`2px solid ${form.delivery_type===opt.v ? C.orange : C.border}`,
                    borderRadius:10, background:form.delivery_type===opt.v ? C.orangePale : C.white,
                    cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", gap:12, alignItems:"center"
                  }}>
                    <span style={{ fontSize:24, flexShrink:0 }}>{opt.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:2 }}>{opt.label}</div>
                      <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.4 }}>{opt.desc}</div>
                    </div>
                    {form.delivery_type===opt.v && <span style={{ color:C.orange, fontSize:18 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
            {/* 画像アップロード */}
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>画像（最大5枚）</label>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display:"none" }}/>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {images.map((img, i) => (
                  <div key={i} style={{ width:72, height:72, borderRadius:10, overflow:"hidden", position:"relative", border:`1px solid ${C.border}` }}>
                    <img src={URL.createObjectURL(img)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                    <button onClick={()=>removeImage(i)} style={{ position:"absolute", top:2, right:2, width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.5)", border:"none", color:"#fff", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button onClick={()=>fileRef.current?.click()} style={{ width:72, height:72, borderRadius:10, border:`2px dashed ${C.border}`, background:C.lightGray, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, color:C.warmGray }}>+</button>
                )}
              </div>
            </div>
            {/* 在庫数 */}
            <div style={{ marginTop:16 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>在庫数（任意）</label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:8, lineHeight:1.6 }}>
                物販で在庫管理が必要な場合のみ入力してください。<br/>
                未入力（オーダーメイド・受注生産など）= 在庫管理しない<br/>
                数字を入力すると、売れるたびに自動で減算され、0になると「売り切れ」表示になります。
              </p>
              <div style={{ position:"relative", maxWidth:160 }}>
                <input type="number" value={form.stock} onChange={e=>up("stock", e.target.value)} placeholder="例: 10" min="0"
                  style={{ width:"100%", padding:"10px 32px 10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:C.warmGray }}>個</span>
              </div>
            </div>
            {/* 有料オプション */}
            <div style={{ marginTop:16 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>有料オプション（任意）</label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:10 }}>購入者が注文時に追加できるオプションを設定できます</p>
              {options.map((opt, i) => (
                <div key={i} style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center" }}>
                  <input value={opt.name} onChange={e=>updateOption(i,"name",e.target.value)} placeholder="例：急ぎ対応（3日以内）"
                    style={{ flex:2, padding:"9px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                  <div style={{ position:"relative", flex:1 }}>
                    <input type="number" value={opt.price} onChange={e=>updateOption(i,"price",e.target.value)} placeholder="500"
                      style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                    <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.warmGray }}>円</span>
                  </div>
                  <button onClick={()=>removeOption(i)} style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.lightGray, cursor:"pointer", fontSize:14, color:C.warmGray, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
                </div>
              ))}
              {options.length < 5 && (
                <button onClick={addOption} style={{ padding:"8px 14px", background:C.orangePale, border:`1.5px dashed ${C.orange}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.orange, cursor:"pointer", fontFamily:"inherit" }}>＋ オプションを追加</button>
              )}
            </div>

            {/* Phase B: 種類 (Variant) セクション
                ブランド v3「翻訳しすぎない」原則: 機能ラベルは普通の言葉でOK
                NG 語彙 (バリエーション/オプション/選択肢) を回避し「種類」で統一 */}
            <div style={{ marginTop:16, paddingTop:16, borderTop:`1px dashed ${C.border}` }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, fontWeight:700, color:C.dark, cursor:"pointer", marginBottom:6 }}>
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={e => {
                    setHasVariants(e.target.checked);
                    if (!e.target.checked) {
                      setVariantOptions([]);
                      setVariants([]);
                    } else if (variantOptions.length === 0) {
                      setVariantOptions([{ name: "", values: [""] }]);
                    }
                  }}
                  style={{ width:16, height:16, accentColor:C.orange }}
                />
                <span>種類を増やす（色違い・サイズ違いなど）</span>
              </label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:10, paddingLeft:24, lineHeight:1.6 }}>
                1つの作品で、構図やサイズの種類を選んでもらえます。<br/>
                それぞれに価格と在庫を設定できます。
              </p>

              {hasVariants && (
                <div>
                  {/* 軸 (オプション項目) max 2 */}
                  {variantOptions.map((opt, optIdx) => (
                    <div key={optIdx} style={{ marginBottom:12, padding:12, background:C.lightGray, borderRadius:10 }}>
                      <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8 }}>
                        <input
                          value={opt.name}
                          onChange={e => updateVariantOptionName(optIdx, e.target.value)}
                          placeholder={optIdx === 0 ? "例：構図" : "例：サイズ"}
                          style={{ flex:1, padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                        />
                        <button
                          onClick={() => removeVariantOption(optIdx)}
                          style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.white, cursor:"pointer", fontSize:14, color:C.warmGray }}
                        >×</button>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {opt.values.map((val, valIdx) => (
                          <div key={valIdx} style={{ display:"flex", alignItems:"center", gap:4, background:C.white, borderRadius:8, padding:"4px 4px 4px 8px", border:`1px solid ${C.border}` }}>
                            <input
                              value={val}
                              onChange={e => updateVariantOptionValue(optIdx, valIdx, e.target.value)}
                              placeholder={optIdx === 0 ? "マズルアップ" : "小"}
                              style={{ width:90, padding:"4px 6px", borderRadius:6, border:"none", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                            />
                            {opt.values.length > 1 && (
                              <button
                                onClick={() => removeVariantOptionValue(optIdx, valIdx)}
                                style={{ width:18, height:18, borderRadius:"50%", border:"none", background:C.lightGray, cursor:"pointer", fontSize:10, color:C.warmGray }}
                              >×</button>
                            )}
                          </div>
                        ))}
                        {opt.values.length < 10 && (
                          <button
                            onClick={() => addVariantOptionValue(optIdx)}
                            style={{ padding:"4px 10px", background:C.orangePale, border:`1px dashed ${C.orange}`, borderRadius:6, fontSize:11, color:C.orange, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}
                          >＋ 追加</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 軸追加ボタン (max 2) */}
                  {variantOptions.length < 2 && (
                    <button
                      onClick={addVariantOption}
                      style={{ padding:"8px 14px", background:C.white, border:`1.5px dashed ${C.orange}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.orange, cursor:"pointer", fontFamily:"inherit", marginBottom:12 }}
                    >＋ {variantOptions.length === 0 ? "種類の項目を追加" : "もう1項目（サイズなど）"}</button>
                  )}

                  {/* 自動生成された variants の価格・在庫入力 */}
                  {variants.length > 0 && (
                    <div style={{ marginTop:12 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:8 }}>
                        それぞれの種類（{variants.length}通り）
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {variants.map((v, idx) => (
                          <div key={idx} style={{ padding:10, background:C.white, border:`1px solid ${C.border}`, borderRadius:10 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:6 }}>
                              {v.variant_name}
                            </div>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                              <div style={{ position:"relative" }}>
                                <input
                                  type="number"
                                  value={v.price}
                                  onChange={e => updateVariant(idx, "price", e.target.value)}
                                  placeholder="3000"
                                  style={{ width:"100%", padding:"7px 26px 7px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                                />
                                <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:C.warmGray }}>円</span>
                              </div>
                              <div style={{ position:"relative" }}>
                                <input
                                  type="number"
                                  value={v.stock}
                                  onChange={e => updateVariant(idx, "stock", e.target.value)}
                                  placeholder="1"
                                  min="0"
                                  style={{ width:"100%", padding:"7px 26px 7px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                                />
                                <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:C.warmGray }}>個</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>}
          {step===3&&<>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:20 }}>確認して出品</h2>
            <div style={{ background:C.lightGray, borderRadius:14, padding:"16px", marginBottom:20 }}>
              {[
                ["カテゴリ", CATS.find(c=>c.id===form.cat)?.label||"未設定"],
                ["タイトル", form.title||"未入力"],
                ["料金", form.price?`¥${Number(form.price).toLocaleString()}`:"未設定"],
                ["納期", form.delivery||"未設定"],
                ["受け渡し方法", form.delivery_type==="shipping"?"📦 配送あり":form.delivery_type==="visit"?"📍 訪問あり":"💻 データのみ"],
                ["在庫数", form.stock!==""&&form.stock!==null?`${form.stock}個`:"管理しない"],
                ["画像", `${images.length}枚`],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.warmGray }}>{k}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{v}</span>
                </div>
              ))}
              {options.filter(o=>o.name&&o.price).length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.warmGray, marginBottom:6 }}>有料オプション</div>
                  {options.filter(o=>o.name&&o.price).map((o,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:12, color:C.dark }}>🔧 {o.name}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:C.orange }}>+¥{Number(o.price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {form.price && Number(form.price) > 0 && (
              <div style={{ background:C.orangePale, borderRadius:14, padding:"14px", marginBottom:16, border:`1px solid ${C.orange}` }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.orange, marginBottom:8 }}>💰 あなたの手取り目安</div>
                {(() => {
                  const basePrice = Number(form.price) + options.filter(o=>o.name&&o.price).reduce((sum, o) => sum + Number(o.price||0), 0);
                  const firstNet = basePrice;
                  const within3M = basePrice - Math.floor(basePrice * 0.05);
                  const stdNet = basePrice - Math.floor(basePrice * 0.10);
                  return (
                    <>
                      <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                        <span style={{ color:C.dark }}>初回取引(0%)</span>
                        <span style={{ fontWeight:700, color:C.green }}>¥{firstNet.toLocaleString()}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                        <span style={{ color:C.dark }}>3ヶ月以内(5%)</span>
                        <span style={{ fontWeight:700, color:C.dark }}>¥{within3M.toLocaleString()}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                        <span style={{ color:C.dark }}>通常期(10%)</span>
                        <span style={{ fontWeight:700, color:C.dark }}>¥{stdNet.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize:10, color:C.warmGray, marginTop:6, lineHeight:1.5 }}>
                        ※出品価格がそのまま手取りとして反映されます
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            {images.length > 0 && (
              <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
                {images.map((img, i) => (
                  <img key={i} src={URL.createObjectURL(img)} alt="" style={{ width:60, height:60, borderRadius:8, objectFit:"cover" }}/>
                ))}
              </div>
            )}
            <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 14px", fontSize:12, color:C.orange, lineHeight:1.6, fontWeight:600 }}>
              🐾 出品後、審査（最大24時間）を経て公開されます。
            </div>
          </>}
          <div style={{ display:"flex", gap:10, marginTop:24 }}>
            {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer", color:C.warmGray, fontFamily:"inherit" }}>← 戻る</button>}
            <button disabled={submitting} onClick={()=>step<3?setStep(s=>s+1):handleSubmit(false)} style={{ flex:2, padding:"13px", background:submitting?C.warmGray:C.orange, border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:submitting?"not-allowed":"pointer", color:"#fff", fontFamily:"inherit" }}>
              {submitting ? "送信中..." : step<3 ? "次へ →" : "🐾 出品する！"}
            </button>
          </div>
          {step===3 && (
            <button disabled={submitting} onClick={()=>handleSubmit(true)} style={{
              width:"100%", marginTop:10, padding:"12px", background:C.white, border:`1.5px solid ${C.border}`,
              borderRadius:12, fontWeight:700, fontSize:13, cursor:submitting?"not-allowed":"pointer",
              color:C.warmGray, fontFamily:"inherit"
            }}>💾 下書き保存（後で編集して投稿できます）</button>
          )}
        </div>
      </div>
    </div>
  );
};

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
const UserProfilePage = ({ setPage }:{ setPage:(p:string)=>void }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; bio?: string; created_at?: string } | null>(null);
  const [stats, setStats] = useState<{ listings: number; completed: number; avgRating: number | null }>({ listings: 0, completed: 0, avgRating: null });
  const [loading, setLoading] = useState(true);
  const [userListings, setUserListings] = useState<Array<{ id:string; title:string; price:number; image_urls?:string[] }>>([]);
  const [reviews, setReviews] = useState<Array<{ id:string; rating:number; comment:string; created_at:string; reviewer_id:string; reviewer_name?:string; reviewer_avatar?:string }>>([]);
  const [isFollowing, setIsFollowing] = useState(false);
const [followCount, setFollowCount] = useState(0);

  useEffect(()=>{
  if (!userId) return;
  (async ()=>{
    const { data: { user } } = await supabase.auth.getUser();
    const [{ count: fc }, { data: fol }] = await Promise.all([
      supabase.from("follows").select("*", { count:"exact", head:true }).eq("following_id", userId),
      user ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).single() : Promise.resolve({ data: null }),
    ]);
    setFollowCount(fc || 0);
    setIsFollowing(!!fol);
  })();
}, [userId]);

const handleFollow = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (isFollowing) {
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
    setIsFollowing(false);
    setFollowCount(c => c - 1);
  } else {
    await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
    setIsFollowing(true);
    setFollowCount(c => c + 1);
  }
};
  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      setLoading(true);
      const { data } = await supabase.from("profiles").select("display_name, avatar_url, bio, created_at").eq("id", userId).single();
      if (data) setProfile(data);
      setLoading(false);
    })();
  }, [userId]);

  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      const [listingsRes, ordersRes, reviewsRes] = await Promise.all([
        supabase.from("listings").select("id", { count:"exact", head:true }).eq("seller_id", userId),
        supabase.from("orders").select("id", { count:"exact", head:true }).eq("seller_id", userId).eq("status", "completed"),
        supabase.from("reviews").select("rating").eq("seller_id", userId),
      ]);
      const ratings = (reviewsRes.data || []).map((r:{rating:number})=>r.rating);
      const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;
      setStats({
        listings: listingsRes.count || 0,
        completed: ordersRes.count || 0,
        avgRating: avg,
      });
    })();
  }, [userId]);
  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, image_urls")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      setUserListings(data || []);
    })();
  }, [userId]);
  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      const { data: revs } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_id")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      if (!revs) return setReviews([]);
      const ids = [...new Set(revs.map(r=>r.reviewer_id))];
      const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      const profMap = Object.fromEntries((profs||[]).map(p=>[p.id, p]));
      setReviews(revs.map(r=>({ ...r, reviewer_name: profMap[r.reviewer_id]?.display_name || "ユーザー", reviewer_avatar: profMap[r.reviewer_id]?.avatar_url })));
    })();
  }, [userId]);

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.warmGray }}>読み込み中...</div>;
  if (!profile) return <div style={{ padding:40, textAlign:"center", color:C.warmGray }}>ユーザーが見つかりません</div>;

  const displayName = profile.display_name || "ユーザー";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div style={{ maxWidth:600, margin:"0 auto" }}>
      <div style={{ background:C.white, borderRadius:20, padding:"28px 20px", border:`1px solid ${C.border}`, textAlign:"center", marginBottom:16 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background: profile.avatar_url ? `url(${profile.avatar_url}) center/cover` : C.orange, margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:800, color:"#fff" }}>{!profile.avatar_url && initial}</div>
        <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:4 }}>{displayName}</div>
        {profile.bio && (
          <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 16px", marginTop:16, marginBottom:4, textAlign:"left", fontSize:14, color:C.dark, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{profile.bio}</div>
        )}
        <div style={{ display:"flex", gap:0, marginTop:16, background:"#FFF9F0", borderRadius:12, padding:"12px 0", border:`1px solid ${C.border}` }}>
          <div style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}` }}>
            <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.listings}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>出品</div>
          </div>
          <div style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}` }}>
            <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.completed}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>取引完了</div>
          </div>
          <div style={{ flex:1, textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.avgRating !== null ? stats.avgRating.toFixed(1) : "-"}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>⭐ 評価</div>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:16, justifyContent:"center", flexWrap:"wrap" }}>
          <div style={{ fontSize:13, color:C.warmGray }}><span style={{ fontWeight:800, color:C.dark }}>{followCount}</span> フォロワー</div>
          <button onClick={handleFollow} style={{ padding:"8px 20px", background: isFollowing ? C.white : C.orange, border: isFollowing ? `1.5px solid ${C.orange}` : "none", borderRadius:20, color: isFollowing ? C.orange : C.white, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            {isFollowing ? "フォロー中" : "フォローする"}
          </button>
          {isFollowing && (
            <button onClick={()=>{ navigate("/mypage"); setTimeout(()=>{ const evt = new CustomEvent("openDM", { detail: { partnerId: userId } }); window.dispatchEvent(evt); }, 100); }} style={{ padding:"8px 20px", background:C.white, border:`1.5px solid ${C.orange}`, borderRadius:20, color:C.orange, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              💬 メッセージ
            </button>
          )}
        </div>
      {userListings.length > 0 && (
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.dark, marginBottom:12, paddingLeft:4 }}>出品中の商品 ({userListings.length})</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:12 }}>
            {userListings.map((item)=>(
              <div key={item.id} onClick={()=>navigate(`/listing/${item.id}`)} style={{ background:C.white, borderRadius:12, overflow:"hidden", border:`1px solid ${C.border}`, cursor:"pointer", transition:"transform 0.2s" }}>
                <div style={{ width:"100%", aspectRatio:"1", background: item.image_urls && item.image_urls[0] ? `url(${item.image_urls[0]}) center/cover` : C.orangePale }}/>
                <div style={{ padding:"8px 10px" }}>
                  <div style={{ fontSize:12, color:C.dark, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:4 }}>{item.title}</div>
                  <div style={{ fontSize:14, color:C.orange, fontWeight:800 }}>¥{item.price.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
const MyPage = ({ setPage }) => {
  const { user, signOut } = useAuth();
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
  const [editOpen, setEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; bio?: string; created_at?: string } | null>(null);
  const [stats, setStats] = useState<{ listings: number; completed: number; avgRating: number | null }>({ listings: 0, completed: 0, avgRating: null });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio, created_at")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    })();
  }, [user?.id, refreshKey]);
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
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, padding:"80px 16px 40px" }}>
      <div style={{ maxWidth:600, margin:"0 auto" }}>
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
              <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:4 }}>{displayName}</div>
              <div style={{ fontSize:13, color:C.warmGray, marginBottom:8 }}>{user?.email}</div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", background:C.orangePale, borderRadius:20, fontSize:11, fontWeight:700, color:C.orange }}>{providerLabel}でログイン中</div>
            </div>
            {profile?.bio && (
                <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 16px", marginTop:16, marginBottom:4, textAlign:"left", fontSize:14, color:C.dark, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{profile.bio}</div>
              )}
            <div style={{ display:"flex", gap:0, marginTop:16, background:"#FFF9F0", borderRadius:12, padding:"12px 0", border:`1px solid ${C.border}` }}>
                <button onClick={()=>setActivityModal("listings")} style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}`, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.listings}</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>出品</div>
                </button>
                <button onClick={()=>setActivityModal("completed")} style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}`, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.completed}</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>取引完了</div>
                </button>
                <button onClick={()=>setActivityModal("reviews")} style={{ flex:1, textAlign:"center", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.avgRating !== null ? stats.avgRating.toFixed(1) : "-"}</div>
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

            {/* マイ活動セクション */}
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.warmGray, marginBottom:8, paddingLeft:4 }}>🎯 マイ活動</div>
              <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                {[
                  { id:"communities", icon:"💬", label:"参加中のコミュニティ", count:activity.communities, color:"#9C27B0" },
                  { id:"events", icon:"📅", label:"投稿したイベント", count:activity.events, color:"#2196F3" },
                  { id:"gallery", icon:"🐾", label:"投稿したギャラリー", count:activity.gallery, color:"#4CAF50" },
                  { id:"blog", icon:"📝", label:"投稿したブログ", count:activity.blog, color:"#FF9800" },
                ].map((item, i) => (
                  <button key={item.id} onClick={()=>setActivityModal(item.id)} style={{
                    width:"100%", padding:"14px 16px", border:"none", borderBottom: i < 3 ? `1px solid ${C.border}` : "none",
                    background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", gap:12, fontFamily:"inherit", textAlign:"left"
                  }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${item.color}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{item.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{item.label}</div>
                    </div>
                    <div style={{ fontSize:14, fontWeight:800, color:item.color, marginRight:6 }}>{item.count}</div>
                    <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
       
            <button onClick={()=>setEditOpen(true)} style={{ marginTop:16, background:C.orange, color:C.white, border:"none", borderRadius:20, padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✏️ プロフィールを編集</button>
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
      </div>
          <ProfileEditModal
        open={editOpen}
        onClose={()=>setEditOpen(false)}
        userId={user?.id}
        onSaved={()=>setRefreshKey(k=>k+1)}
      />
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
        const { data: d } = await supabase.from("gallery_posts").select("id, image_url, caption, created_at").eq("user_id", userId).order("created_at", { ascending: false });
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
      return (
        <button key={item.id} onClick={()=>handleNavigate(`gallery/${item.id}`)} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", cursor:"pointer", padding:0, fontFamily:"inherit", textAlign:"left" }}>
          <div style={{ width:"100%", aspectRatio:"1", background: `url(${item.image_url}) center/cover` }}/>
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
const OrderStatusBar = ({ status }) => {
  const idx = stepIndex(status);
  if (idx < 0) return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:status==="refunded"?"#FFEBEE":"#FFF3E0", borderRadius:12 }}>
      <span style={{ fontSize:18 }}>{status==="refunded"?"💸":"❌"}</span>
      <span style={{ fontSize:13, fontWeight:700, color:status==="refunded"?C.red:C.orange }}>{status==="refunded"?"返金済み":"キャンセル"}</span>
    </div>
  );
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, padding:"12px 0" }}>
      {ORDER_STEPS.map((step, i) => {
        const isActive = i <= idx;
        const isCurrent = i === idx;
        const isDisputed = status==="disputed" && i===2;
        return (
          <div key={step.key} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", position:"relative" }}>
            {i > 0 && <div style={{ position:"absolute", top:16, left:"-50%", right:"50%", height:3, background:isActive?C.orange:C.border, borderRadius:2, zIndex:0 }}/>}
            <div style={{
              width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, zIndex:1, position:"relative",
              background:isDisputed?"#FFEBEE":isActive?C.orange:C.lightGray,
              color:isDisputed?C.red:isActive?"#fff":C.warmGray,
              border:isCurrent?`3px solid ${isDisputed?C.red:C.orange}`:"3px solid transparent",
              fontWeight:800
            }}>{isDisputed?"⚠️":step.icon}</div>
            <div style={{ fontSize:9, fontWeight:700, color:isDisputed?C.red:isActive?C.orange:C.warmGray, marginTop:4, textAlign:"center", whiteSpace:"nowrap" }}>
              {isDisputed?"異議中":step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

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
      {/* Stripe Connect 連携状況 */}
      {!isConnected && (
        <div style={{ background:"#FFF3E0", border:`2px solid ${C.orange}`, borderRadius:16, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <span style={{ fontSize:24 }}>🏦</span>
            <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:C.orange }}>銀行口座を設定してください</h3>
          </div>
          <p style={{ margin:"8px 0 12px", fontSize:13, color:C.text, lineHeight:1.6 }}>
            売上を受け取るには、Stripe で銀行口座を連携する必要があります。<br/>
            セキュアな本人確認を経て、安全に振込が可能になります。
          </p>
          <button
            onClick={handleStartOnboarding}
            disabled={actionLoading}
            style={{ background:C.orange, color:C.white, border:"none", borderRadius:12, padding:"12px 24px", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", opacity: actionLoading ? 0.6 : 1 }}
          >
            {actionLoading ? "処理中..." : "🏦 銀行口座を設定する"}
          </button>
        </div>
      )}

      {/* 残高サマリー */}
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:20 }}>
        <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:800, color:C.text }}>💰 残高サマリー</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <div style={{ background:C.orangePale, padding:14, borderRadius:12, textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>取引中</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.text }}>¥{(balance?.in_escrow || 0).toLocaleString()}</div>
          </div>
          <div style={{ background:"#FFF8F0", padding:14, borderRadius:12, textAlign:"center", border:`2px solid ${C.orange}` }}>
            <div style={{ fontSize:11, color:C.orange, fontWeight:700, marginBottom:4 }}>受取可能</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.orange }}>¥{(balance?.pending_balance || 0).toLocaleString()}</div>
          </div>
          <div style={{ background:"#F0F9FF", padding:14, borderRadius:12, textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>累計売上</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.text }}>¥{(balance?.total_earned || 0).toLocaleString()}</div>
          </div>
        </div>
        <div style={{ marginTop:12, fontSize:11, color:C.textMuted, lineHeight:1.6 }}>
          完了取引数: {balance?.completed_orders_count || 0}件
        </div>
      </div>

      {/* 振込スケジュール案内 */}
      <div style={{ background:"#F8F9FA", borderRadius:16, padding:16, fontSize:12, lineHeight:1.7, color:C.text }}>
        <div style={{ fontWeight:800, marginBottom:6 }}>📅 振込について</div>
        <div>• <strong>月末自動振込</strong>: ¥{monthlyThreshold.toLocaleString()}以上は手数料無料、未満は¥275(税込)</div>
        <div>• <strong>即時受け取り</strong>: 一律¥275(税込) / 数分で着金</div>
      </div>

      {/* 即時受け取りボタン */}
      {isConnected && (balance?.pending_balance || 0) > 0 && (
        <button
          onClick={() => setShowInstantModal(true)}
          style={{ background:C.orange, color:C.white, border:"none", borderRadius:14, padding:"14px 24px", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}
        >
          ⚡ 今すぐ受け取る（手数料あり）
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
          <div style={{ background:C.white, borderRadius:16, padding:24, maxWidth:400, width:"90%", maxHeight:"90vh", overflowY:"auto" }}>
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
    if (!confirm("受取を確定しますか？\nこの操作で出品者へ売上が支払われます。")) return;
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
                    <div style={{ fontSize:15, fontWeight:900, color:C.orange, marginTop:4 }}>¥{Number(order.amount || 0).toLocaleString()}</div>
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
                          <button onClick={(e)=>{e.stopPropagation();handleConfirm(order.id);}} style={{
                            flex:2, padding:"11px", background:C.green, border:"none", borderRadius:10,
                            color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit"
                          }}>✅ 受取完了</button>
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
                  {/* 下書きの公開申請 */}
                  {l.status === "draft" && (
                    <button disabled={busy} onClick={()=>handlePublishDraft(l)} style={miniBtnStyle(C.orange, "#fff", busy)}>🚀 公開申請</button>
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
const miniBtnStyle = (bg, color, disabled) => ({
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 8,
  background: bg,
  color,
  border: `1.5px solid ${color === "#fff" ? bg : color}`,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontFamily: "inherit",
});

// ── 出品編集モーダル ─────────────────────────────────────────────────
const ListingEditModal = ({ listing, onClose, onSaved }) => {
  const [title, setTitle] = useState(listing.title || "");
  const [description, setDescription] = useState(listing.description || "");
  const [price, setPrice] = useState(listing.price?.toString() || "");
  const [delivery, setDelivery] = useState(listing.delivery_days || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    if (!title.trim()) { setError("タイトルを入力してください"); return; }
    if (!description.trim()) { setError("説明を入力してください"); return; }
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) { setError("価格は1円以上の数字を入力してください"); return; }
    setSaving(true);
    const { error: updErr } = await supabase
      .from("listings")
      .update({
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        delivery_days: delivery,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);
    setSaving(false);
    if (updErr) { setError("保存に失敗しました: " + updErr.message); return; }
    onSaved();
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:480, width:"100%", maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>✏️ 出品を編集</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
        </div>
        <p style={{ fontSize:11, color:C.warmGray, marginBottom:14, lineHeight:1.6 }}>
          ※ 大きな変更は再審査の対象になる場合があります。<br/>
          画像・カテゴリの変更は現状未対応です（後日追加予定）。
        </p>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>タイトル</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80} style={{
            width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
          }}/>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>説明</label>
          <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={5} maxLength={2000} style={{
            width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
          }}/>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>価格（円）</label>
          <input type="number" value={price} onChange={e=>setPrice(e.target.value)} min="1" style={{
            width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
          }}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>納期</label>
          <input value={delivery} onChange={e=>setDelivery(e.target.value)} placeholder="例: 2〜5営業日" style={{
            width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
          }}/>
        </div>

        {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12 }}>{error}</div>}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} disabled={saving} style={{ flex:1, padding:"12px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit" }}>キャンセル</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:"12px", background:saving?C.warmGray:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit" }}>{saving ? "保存中..." : "💾 保存する"}</button>
        </div>
      </div>
    </div>
  );
};

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
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, escrow_status, transfer_status, amount, created_at, delivered_at, completed_at, listing_id, buyer_id, shipping_address_id")
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
                    <div style={{ fontSize:11, color:C.warmGray }}>購入者: {buyerName} · {formatDate(sale.created_at)}</div>
                    <div style={{ fontSize:15, fontWeight:900, color:C.orange, marginTop:4 }}>¥{Number(sale.amount || 0).toLocaleString()}</div>
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
const CONTACT_PATTERNS = [
  // 電話番号
  { regex: /0\d{1,4}[-－‐ーｰ\s]?\d{1,4}[-－‐ーｰ\s]?\d{3,4}/g, label: "電話番号" },
  { regex: /0\d{9,10}/g, label: "電話番号" },
  // メールアドレス
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "メールアドレス" },
  { regex: /[a-zA-Z0-9._%+-]+\s*[＠@]\s*[a-zA-Z0-9.-]+\s*[\.。]\s*[a-zA-Z]{2,}/g, label: "メールアドレス" },
  // URL
  { regex: /https?:\/\/[^\s]+/gi, label: "URL" },
  { regex: /[a-zA-Z0-9-]+\.(com|jp|net|org|io|co|me|app|shop|store|tv|ne)\b/gi, label: "URL" },
  // LINE
  { regex: /(LINE|line|Line|ライン|らいん|ﾗｲﾝ|raɪn)/gi, label: "LINE" },
  // Twitter/X
  { regex: /(Twitter|twitter|ツイッター|ついったー|ﾂｲｯﾀｰ|つぶやき)/gi, label: "Twitter/X" },
  { regex: /(\bX\b|エックス)\s*(id|ID|アカウント|あかうんと)/gi, label: "Twitter/X" },
  // Instagram
  { regex: /(Instagram|instagram|insta|Insta|インスタ|いんすた|ｲﾝｽﾀ|インスタグラム|いんすたぐらむ|ｲﾝｽﾀｸﾞﾗﾑ|IG)/gi, label: "Instagram" },
  // Facebook
  { regex: /(Facebook|facebook|フェイスブック|ふぇいすぶっく|ﾌｪｲｽﾌﾞｯｸ|フェースブック|FB|ｴﾌﾋﾞｰ)/gi, label: "Facebook" },
  // TikTok
  { regex: /(TikTok|tiktok|ティックトック|てぃっくとっく|ﾃｨｯｸﾄｯｸ|tt)/gi, label: "TikTok" },
  // WhatsApp
  { regex: /(WhatsApp|whatsapp|ワッツアップ|わっつあっぷ|ﾜｯﾂｱｯﾌﾟ)/gi, label: "WhatsApp" },
  // Telegram
  { regex: /(Telegram|telegram|テレグラム|てれぐらむ|ﾃﾚｸﾞﾗﾑ)/gi, label: "Telegram" },
  // Discord
  { regex: /(Discord|discord|ディスコード|でぃすこーど|ﾃﾞｨｽｺｰﾄﾞ|ディスコ|でぃすこ|ﾃﾞｨｽｺ)/gi, label: "Discord" },
  // YouTube
  { regex: /(YouTube|youtube|ユーチューブ|ゆーちゅーぶ|ﾕｰﾁｭｰﾌﾞ|ようつべ|ﾖｳﾂﾍﾞ)/gi, label: "YouTube" },
  // Skype
  { regex: /(Skype|skype|スカイプ|すかいぷ|ｽｶｲﾌﾟ)/gi, label: "Skype" },
  // Kakao Talk
  { regex: /(KakaoTalk|kakao|カカオトーク|かかおとーく|ｶｶｵﾄｰｸ|カカオ|かかお|ｶｶｵ)/gi, label: "KakaoTalk" },
  // Signal
  { regex: /(Signal|signal|シグナル|しぐなる|ｼｸﾞﾅﾙ)/gi, label: "Signal" },
  // 一般的な連絡関連キーワード
  { regex: /(連絡先|れんらくさき|ﾚﾝﾗｸｻｷ)\s*[:：はを]?\s*[\w@＠\-_.]+/gi, label: "連絡先" },
  { regex: /(直接|ちょくせつ|ﾁｮｸｾﾂ)(連絡|連絡先|やりとり|取引|送金|振込)/gi, label: "サイト外取引" },
  { regex: /(サイト外|外部|別|他|ほか)で\s*(連絡|やりとり|取引|送金|振込|決済)/gi, label: "サイト外取引" },
  { regex: /(振込|ふりこみ|銀行|ぎんこう|口座|こうざ)/gi, label: "銀行振込" },
];

const detectContacts = (text:string): { found: boolean; types: string[]; masked: string } => {
  const types: string[] = [];
  let masked = text;
  for (const { regex, label } of CONTACT_PATTERNS) {
    const newRegex = new RegExp(regex.source, regex.flags);
    if (newRegex.test(text)) {
      if (!types.includes(label)) types.push(label);
      const replaceRegex = new RegExp(regex.source, regex.flags);
      masked = masked.replace(replaceRegex, "***");
    }
  }
  return { found: types.length > 0, types, masked };
};

// ── NGワードフィルター（喧嘩・誹謗中傷防止） ──────────────────────────────
const NG_WORDS = [
  // 暴言・侮辱
  "死ね","しね","シネ","ｼﾈ","殺す","ころす","コロス","ｺﾛｽ","殺して","しんで","死んで",
  "ばか","バカ","馬鹿","ｱﾎ","あほ","アホ","阿呆","間抜け","まぬけ","低能","低脳","無能",
  "クソ","くそ","糞","クズ","くず","屑","ゴミ","ごみ","カス","かす","滓",
  "ブス","ぶす","醜い","キモい","きもい","気持ち悪い","うざい","ウザい","ウザ","邪魔",
  "雑魚","ザコ","ざこ","負け犬","負け組","役立たず","やくたたず",
  // 差別・ヘイト
  "ガイジ","がいじ","池沼","ちしょう","知障","精神病","キチガイ","きちがい","気違い","発達障害者",
  "在日","ザイニチ","チョン","支那","シナ人","土人","部落",
  // 性的・下品
  "セックス","ｾｯｸｽ","ヤリマン","やりまん","ビッチ","びっち","売女","淫売",
  "ち〇ぽ","ま〇こ","おまんこ","チンコ","ﾁﾝｺ","マンコ","ﾏﾝｺ",
  // 脅迫
  "潰す","ぶっ殺","ぶっころ","殴る","なぐる","刺す","さす","ぶん殴","ボコる","ぼこる",
  "晒す","さらす","特定する","個人情報","住所教えろ","住所さらす",
  "訴える","訴訟","裁判","慰謝料","賠償",
  // ペット関連の悪質ワード（Qocca特有）
  "虐待","ぎゃくたい","ギャクタイ","殺処分","保健所送り","捨てろ","捨てる",
];

const detectNGWords = (text:string): { found: boolean; words: string[] } => {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const ng of NG_WORDS) {
    if (lower.includes(ng.toLowerCase()) && !found.includes(ng)) {
      found.push(ng);
    }
  }
  return { found: found.length > 0, words: found };
};

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

// ── Blog (ペットブログ) ────────────────────────────────────────────────────
const BLOG_CATS = [
  { id:"all", icon:"📝", label:"すべて" },
  { id:"tips", icon:"💡", label:"豆知識" },
  { id:"health", icon:"🏥", label:"健康" },
  { id:"food", icon:"🍖", label:"ごはん" },
  { id:"training", icon:"🎓", label:"しつけ" },
  { id:"goods", icon:"🛍", label:"グッズ" },
  { id:"story", icon:"📖", label:"うちの子物語" },
  { id:"creator", icon:"🎨", label:"クリエイター" },
];

const BlogPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const { postId } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [showWrite, setShowWrite] = useState(false);
  const [viewPost, setViewPost] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ type: CommentTargetType; id: string; ownerId: string } | null>(null);
  const [form, setForm] = useState({ title:"", content:"", category:"general", tags:"" });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const coverRef = useRef(null);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const authorIds = [...new Set(data.map(p => p.author_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", authorIds);
      const profMap = {};
      (profiles || []).forEach(p => { profMap[p.id] = p; });
      setPosts(data.map(p => ({
        ...p,
        authorName: profMap[p.author_id]?.display_name || "ユーザー",
        authorAvatar: profMap[p.author_id]?.avatar_url || "",
      })));
    }
    if (user) {
      const { data: likes } = await supabase.from("blog_likes").select("post_id").eq("user_id", user.id);
      const likeMap = {};
      (likes || []).forEach(l => { likeMap[l.post_id] = true; });
      setLikedPosts(likeMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  // URL から postId を取得して、該当記事を自動的に詳細表示
  useEffect(() => {
    if (!postId) {
      setViewPost(null);
      return;
    }
    if (posts.length === 0) return;
    const target = posts.find(p => p.id === postId);
    if (target) {
      setViewPost(target);
      // 閲覧数 +1
      supabase.from("blog_posts").update({ views_count: (target.views_count || 0) + 1 }).eq("id", target.id).then(()=>{});
    } else {
      // 一覧に無い記事 → 単独取得
      supabase.from("blog_posts").select("*").eq("id", postId).eq("published", true).single().then(async ({ data }) => {
        if (data) {
          const { data: prof } = await supabase.from("profiles").select("id, display_name, avatar_url").eq("id", data.author_id).single();
          setViewPost({
            ...data,
            authorName: prof?.display_name || "ユーザー",
            authorAvatar: prof?.avatar_url || "",
          });
          await supabase.from("blog_posts").update({ views_count: (data.views_count || 0) + 1 }).eq("id", data.id);
        }
      });
    }
  }, [postId, posts]);

  // 詳細表示を閉じた時に URL を /blog に戻す
  const closeViewPost = () => {
    setViewPost(null);
    if (postId) navigate("/blog");
  };

  // 一覧記事クリック時に URL を /blog/:id にする
  const openViewPost = (post) => {
    setViewPost(post);
    navigate(`/blog/${post.id}`);
    // 閲覧数 +1
    supabase.from("blog_posts").update({ views_count: (post.views_count || 0) + 1 }).eq("id", post.id).then(()=>{});
  };

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  };

  const handlePublish = async () => {
    if (!user || !form.title || !form.content) return;
    setSubmitting(true);
    let coverUrl = "";
    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("blog-images").upload(path, coverFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(path);
        coverUrl = urlData.publicUrl;
      }
    }
    await supabase.from("blog_posts").insert({
      author_id: user.id,
      title: form.title,
      content: form.content,
      category: form.category,
      cover_image_url: coverUrl,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      published: true,
    });
    setShowWrite(false);
    setForm({ title:"", content:"", category:"general", tags:"" });
    setCoverFile(null);
    setCoverPreview("");
    setSubmitting(false);
    fetchPosts();
  };

  const toggleLike = async (postId) => {
    if (!user) { setPage("signup"); return; }
    if (likedPosts[postId]) {
      await supabase.from("blog_likes").delete().eq("user_id", user.id).eq("post_id", postId);
      setLikedPosts(prev => { const n = {...prev}; delete n[postId]; return n; });
      setPosts(prev => prev.map(p => p.id === postId ? {...p, likes_count: Math.max(0,(p.likes_count||0)-1)} : p));
    } else {
      await supabase.from("blog_likes").insert({ user_id: user.id, post_id: postId });
      setLikedPosts(prev => ({...prev, [postId]: true}));
      setPosts(prev => prev.map(p => p.id === postId ? {...p, likes_count: (p.likes_count||0)+1} : p));
    }
  };

  const openPost = openViewPost;

  const filtered = posts.filter(p => cat === "all" || p.category === cat);
  const blogCatLabel = (c) => BLOG_CATS.find(bc => bc.id === c)?.label || c;
  const blogCatIcon = (c) => BLOG_CATS.find(bc => bc.id === c)?.icon || "📝";

  // 記事詳細ビュー
  if (viewPost) return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={closeViewPost} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.orange, fontWeight:700 }}>←</button>
        <span style={{ fontSize:14, fontWeight:700, color:C.dark }}>ブログ</span>
      </div>
      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 16px 80px" }}>
        {viewPost.cover_image_url && (
          <div style={{ borderRadius:16, overflow:"hidden", marginBottom:20, maxHeight:300 }}>
            <img src={viewPost.cover_image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          </div>
        )}
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          <span style={{ fontSize:11, padding:"3px 10px", borderRadius:8, background:C.orangePale, color:C.orange, fontWeight:700 }}>{blogCatIcon(viewPost.category)} {blogCatLabel(viewPost.category)}</span>
        </div>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, lineHeight:1.4, marginBottom:12 }}>{viewPost.title}</h1>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", fontSize:14 }}>
            {viewPost.authorAvatar ? <img src={viewPost.authorAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : "🐾"}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{viewPost.authorName}</div>
            <div style={{ fontSize:11, color:C.warmGray }}>{new Date(viewPost.created_at).toLocaleDateString("ja-JP")} · 👁 {viewPost.views_count||0}</div>
          </div>
        </div>
        <div style={{ fontSize:15, color:"#333", lineHeight:2, whiteSpace:"pre-wrap" }}>{viewPost.content}</div>
        {viewPost.tags?.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:20 }}>
            {viewPost.tags.map(t => <span key={t} style={{ fontSize:11, padding:"3px 10px", borderRadius:8, background:C.lightGray, color:C.warmGray }}>#{t}</span>)}
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
          <button onClick={()=>toggleLike(viewPost.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20 }}>{likedPosts[viewPost.id]?"❤️":"🤍"}</button>
          <span style={{ fontSize:13, color:C.warmGray }}>{viewPost.likes_count||0} いいね</span>
          <button onClick={()=>{ setCommentTarget({ type:"blog", id: viewPost.id, ownerId: viewPost.author_id }); setCommentOpen(true); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.warmGray, marginLeft:8, fontFamily:"inherit" }}>💬 コメント</button>
        </div>
      </div>
    {commentTarget && (
        <CommentModal
          open={commentOpen}
          onClose={()=>setCommentOpen(false)}
          targetType={commentTarget.type}
          targetId={commentTarget.id}
          postOwnerId={commentTarget.ownerId}
          currentUserId={user?.id}
          onRequireLogin={()=>{ setCommentOpen(false); setPage("login"); }}
          title="コメント"
        />
      )}
          </div>
  );

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      {/* ヘッダー */}
      <div style={{ padding:"20px 16px 12px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:4 }}>📝 ペットブログ</h1>
            <p style={{ fontSize:12, color:C.warmGray }}>ペットの豆知識やクリエイターの裏側をチェック</p>
          </div>
          {user && (
            <button onClick={()=>setShowWrite(true)} style={{
              padding:"10px 14px", background:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer"
            }}>✍️ 書く</button>
          )}
        </div>
      </div>

      {/* カテゴリフィルター */}
      <div style={{ padding:"10px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", gap:8, overflowX:"auto" }}>
        {BLOG_CATS.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            flexShrink:0, padding:"6px 12px", display:"flex", alignItems:"center", gap:4,
            background:cat===c.id?C.orange:C.white, color:cat===c.id?"#fff":C.warmGray,
            border:`1.5px solid ${cat===c.id?C.orange:C.border}`, borderRadius:20,
            fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}><span>{c.icon}</span><span style={{ whiteSpace:"nowrap" }}>{c.label}</span></button>
        ))}
      </div>

      {/* 執筆モーダル */}
      {showWrite && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:520, width:"100%", maxHeight:"90vh", overflow:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>✍️ ブログを書く</h2>
              <button onClick={()=>setShowWrite(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverSelect} style={{ display:"none" }}/>
            {coverPreview ? (
              <div style={{ marginBottom:14 }}>
                <img src={coverPreview} alt="" style={{ width:"100%", borderRadius:12, maxHeight:200, objectFit:"cover" }}/>
                <button onClick={()=>{setCoverFile(null);setCoverPreview("");}} style={{ marginTop:6, fontSize:11, color:C.red, background:"none", border:"none", cursor:"pointer" }}>画像を変更</button>
              </div>
            ) : (
              <button onClick={()=>coverRef.current?.click()} style={{
                width:"100%", padding:"24px", border:`2px dashed ${C.border}`, borderRadius:12,
                background:C.lightGray, cursor:"pointer", marginBottom:14, textAlign:"center"
              }}>
                <div style={{ fontSize:28, marginBottom:4 }}>🖼</div>
                <div style={{ fontSize:12, color:C.warmGray }}>カバー画像を追加（任意）</div>
              </button>
            )}
            <div style={{ marginBottom:12 }}>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="タイトル"
                style={{ width:"100%", padding:"12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:16, fontWeight:700, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", background:C.white }}>
                {BLOG_CATS.filter(c=>c.id!=="all").map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <input value={form.tags} onChange={e=>setForm(p=>({...p,tags:e.target.value}))} placeholder="タグ（カンマ区切り）"
                style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div style={{ marginBottom:16 }}>
              <textarea value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} rows={10} placeholder="記事の内容を書いてください..."
                style={{ width:"100%", padding:"12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.8 }}/>
            </div>
            <button disabled={!form.title||!form.content||submitting} onClick={handlePublish} style={{
              width:"100%", padding:"14px", background:(!form.title||!form.content||submitting)?C.warmGray:C.orange,
              border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:(!form.title||!form.content||submitting)?"not-allowed":"pointer"
            }}>{submitting ? "投稿中..." : "📝 公開する"}</button>
          </div>
        </div>
      )}

      {/* 記事リスト */}
      <div style={{ padding:"16px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:C.warmGray }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontSize:64, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>まだ記事がありません</div>
            <p style={{ fontSize:13, color:C.warmGray, marginBottom:20 }}>最初のブロガーになりませんか？</p>
            {user && <button onClick={()=>setShowWrite(true)} style={{ padding:"12px 24px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer" }}>✍️ 記事を書く</button>}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap:16 }}>
            {filtered.map(post => (
              <div key={post.id} onClick={()=>openPost(post)} style={{
                background:C.white, borderRadius:16, overflow:"hidden", border:`1px solid ${C.border}`,
                cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.04)"
              }}>
                {post.cover_image_url && (
                  <div style={{ width:"100%", height:160, overflow:"hidden" }}>
                    <img src={post.cover_image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  </div>
                )}
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.orangePale, color:C.orange, fontWeight:700 }}>{blogCatIcon(post.category)} {blogCatLabel(post.category)}</span>
                  </div>
                  <h3 style={{ fontSize:16, fontWeight:800, color:C.dark, lineHeight:1.4, marginBottom:8, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{post.title}</h3>
                  <div style={{ fontSize:12, color:"#666", lineHeight:1.6, marginBottom:10, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{post.content}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", fontSize:10 }}>
                        {post.authorAvatar ? <img src={post.authorAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : "🐾"}
                      </div>
                      <span style={{ fontSize:11, fontWeight:600, color:C.dark }}>{post.authorName}</span>
                      <span style={{ fontSize:10, color:C.warmGray }}>{new Date(post.created_at).toLocaleDateString("ja-JP")}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:11, color:C.warmGray }}>
                      <span>❤️ {post.likes_count||0}</span>
                      <span>👁 {post.views_count||0}</span>
                      <button onClick={(e)=>{ e.stopPropagation(); setCommentTarget({ type:"blog", id: post.id, ownerId: post.author_id }); setCommentOpen(true); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, padding:0, color:C.warmGray }}>💬 コメント</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    {commentTarget && (
        <CommentModal
          open={commentOpen}
          onClose={()=>setCommentOpen(false)}
          targetType={commentTarget.type}
          targetId={commentTarget.id}
          postOwnerId={commentTarget.ownerId}
          currentUserId={user?.id}
          onRequireLogin={()=>{ setCommentOpen(false); setPage("login"); }}
          title="コメント"
        />
      )}
      </div>
  );
};

// ── Pet Facilities (ドッグラン・ペット施設マップ) ──────────────────────────
const FACILITY_CATS = [
  { id:"all", icon:"🐾", label:"すべて" },
  { id:"dogrun", icon:"🐕", label:"ドッグラン" },
  { id:"cafe", icon:"☕", label:"ペットカフェ" },
  { id:"hospital", icon:"🏥", label:"動物病院" },
  { id:"salon", icon:"✂️", label:"トリミング" },
  { id:"hotel", icon:"🏨", label:"ペットホテル" },
  { id:"park", icon:"🌳", label:"公園" },
  { id:"shop", icon:"🛍", label:"ペットショップ" },
];

// 気分タグ（ポジティブ・ファクトベース型）
const MOOD_TAGS = [
  { id:"fun", icon:"🐕", label:"楽しく遊べた" },
  { id:"clean", icon:"✨", label:"きれいで快適" },
  { id:"empty", icon:"☀️", label:"空いていた" },
  { id:"moderate", icon:"🌤", label:"適度な人出" },
  { id:"busy", icon:"⛅", label:"少し混んでいた" },
  { id:"water", icon:"💧", label:"水道・足洗い場あり" },
  { id:"parking", icon:"🚗", label:"駐車場が便利" },
  { id:"shade", icon:"🌳", label:"日陰・木陰あり" },
  { id:"roof", icon:"🏠", label:"屋根あり" },
  { id:"small_dog", icon:"🐕‍🦺", label:"小型犬向け" },
  { id:"large_dog", icon:"🦮", label:"大型犬向け" },
  { id:"agility", icon:"🎯", label:"アジリティあり" },
];

const FACILITY_REPORT_REASONS = [
  { id:"inappropriate", label:"不適切な内容" },
  { id:"spam", label:"スパム・宣伝" },
  { id:"misinformation", label:"誤った情報" },
  { id:"defamation", label:"誹謗中傷・名誉毀損" },
  { id:"privacy", label:"プライバシー侵害" },
  { id:"other", label:"その他" },
];

// 名誉毀損リスクを下げるためのNGワード（コメント投稿時のチェック）
const FACILITY_NG_WORDS = [
  "最悪","ひどい","クソ","くそ","死ね","殺","ゴミ","汚い","汚れすぎ",
  "詐欺","二度と行かない","潰れろ","訴え","営業停止","違法",
  "店員がムカつく","スタッフが最悪","オーナーが","○○さん",
];

// NGワードチェック関数
const checkFacilityNGWords = (text) => {
  if (!text) return null;
  for (const word of FACILITY_NG_WORDS) {
    if (text.includes(word)) return word;
  }
  return null;
};


const PREFS = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"];

const FacilitiesPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [pref, setPref] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name:"", category:"dogrun", address:"", prefecture:"大阪", phone:"", website:"", hours:"", description:"" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);

  const fetchFacilities = async () => {
    setLoading(true);
    let query = supabase.from("pet_facilities").select("*").eq("approved", true).order("review_count", { ascending: false });
    const { data, error } = await query;
    if (!error) setFacilities(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFacilities(); }, []);

  const filtered = facilities.filter(f => {
    if (cat !== "all" && f.category !== cat) return false;
    if (pref && f.prefecture !== pref) return false;
    return true;
  });

  const handleSubmitFacility = async () => {
    if (!user || !addForm.name || !addForm.address) return;
    setSubmitting(true);
    await supabase.from("pet_facilities").insert({
      ...addForm,
      submitted_by: user.id,
      approved: false,
    });
    setSubmitting(false);
    setSubmitted(true);
    setShowAdd(false);
    setAddForm({ name:"", category:"dogrun", address:"", prefecture:"大阪", phone:"", website:"", hours:"", description:"" });
  };

  const catIcon = (c) => FACILITY_CATS.find(fc => fc.id === c)?.icon || "🐾";
  const catLabel = (c) => FACILITY_CATS.find(fc => fc.id === c)?.label || c;

  if (selectedFacility) {
    return <FacilityDetailView facility={selectedFacility} onBack={()=>{ setSelectedFacility(null); fetchFacilities(); }} isPC={isPC} setPage={setPage} catIcon={catIcon} catLabel={catLabel}/>;
  }

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"20px 16px 12px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:4 }}>🐕 ペット施設マップ</h1>
            <p style={{ fontSize:12, color:C.warmGray }}>みんなのリアルな訪問レポートをチェック</p>
          </div>
          {user && (
            <button onClick={()=>setShowAdd(true)} style={{
              padding:"10px 14px", background:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer"
            }}>＋ 施設を追加</button>
          )}
        </div>
      </div>

      <div style={{ padding:"10px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", gap:8, overflowX:"auto" }}>
        {FACILITY_CATS.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            flexShrink:0, padding:"6px 12px", display:"flex", alignItems:"center", gap:4,
            background:cat===c.id?C.orange:C.white, color:cat===c.id?"#fff":C.warmGray,
            border:`1.5px solid ${cat===c.id?C.orange:C.border}`, borderRadius:20,
            fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}><span>{c.icon}</span><span style={{ whiteSpace:"nowrap" }}>{c.label}</span></button>
        ))}
      </div>
      <div style={{ padding:"8px 16px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
        <select value={pref} onChange={e=>setPref(e.target.value)} style={{
          padding:"8px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13,
          fontFamily:"inherit", outline:"none", background:C.white, color:C.dark
        }}>
          <option value="">📍 全国</option>
          {PREFS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ marginLeft:12, fontSize:12, color:C.warmGray }}>{filtered.length}件の施設</span>
      </div>

      {showAdd && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:440, width:"100%", maxHeight:"90vh", overflow:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>🐕 施設を追加</h2>
              <button onClick={()=>setShowAdd(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            <p style={{ fontSize:11, color:C.warmGray, marginBottom:16 }}>投稿後、運営の審査を経て公開されます</p>
            {[
              ["施設名", "name", "text", "例：わんわんパーク大阪"],
              ["住所", "address", "text", "例：大阪市北区..."],
              ["電話番号", "phone", "tel", "06-1234-5678"],
              ["公式サイト", "website", "url", "https://..."],
              ["営業時間", "hours", "text", "10:00〜18:00"],
            ].map(([label, key, type, ph]) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>{label}</label>
                <input type={type} value={addForm[key]} onChange={e=>setAddForm({...addForm, [key]: e.target.value})} placeholder={ph} style={{
                  width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                  fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
                }}/>
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>カテゴリ</label>
              <select value={addForm.category} onChange={e=>setAddForm({...addForm, category: e.target.value})} style={{
                width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box"
              }}>
                {FACILITY_CATS.filter(c=>c.id!=="all").map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>都道府県</label>
              <select value={addForm.prefecture} onChange={e=>setAddForm({...addForm, prefecture: e.target.value})} style={{
                width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box"
              }}>
                {PREFS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>説明</label>
              <textarea value={addForm.description} onChange={e=>setAddForm({...addForm, description: e.target.value})} rows={3} placeholder="施設の特徴や魅力を教えてください" style={{
                width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
              }}/>
            </div>
            <button disabled={!user || !addForm.name || !addForm.address || submitting} onClick={handleSubmitFacility} style={{
              width:"100%", padding:"13px", background:(!user || !addForm.name || !addForm.address || submitting)?C.warmGray:C.orange,
              border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14,
              cursor:(!user || !addForm.name || !addForm.address || submitting)?"not-allowed":"pointer", fontFamily:"inherit"
            }}>{submitting ? "送信中..." : "🐕 投稿する"}</button>
          </div>
        </div>
      )}

      {submitted && (
        <div style={{ position:"fixed", top:80, left:"50%", transform:"translateX(-50%)", background:C.green, color:"#fff", padding:"12px 24px", borderRadius:12, zIndex:400, fontWeight:800, fontSize:13 }}>
          ✅ 投稿ありがとうございます！審査後に公開されます
        </div>
      )}

      <div style={{ padding:"16px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:C.warmGray }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontSize:64, marginBottom:12 }}>🐕</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>
              {facilities.length === 0 ? "まだ施設が登録されていません" : "該当する施設がありません"}
            </div>
            <p style={{ fontSize:13, color:C.warmGray, marginBottom:20 }}>
              {facilities.length === 0 ? "最初の投稿者になりませんか？" : "フィルターを変更してみてください"}
            </p>
            {user && facilities.length === 0 && <button onClick={()=>setShowAdd(true)} style={{ padding:"12px 24px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer" }}>＋ 施設を追加</button>}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap:12 }}>
            {filtered.map(f => (
              <div key={f.id} onClick={()=>setSelectedFacility(f)} style={{
                background:C.white, borderRadius:16, padding:"16px", border:`1px solid ${C.border}`,
                boxShadow:"0 2px 8px rgba(0,0,0,0.04)", cursor:"pointer", transition:"transform 0.15s"
              }} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                    {catIcon(f.category)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:4 }}>{f.name}</div>
                    <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>📍 {f.address}</div>
                    {f.hours && <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>🕐 {f.hours}</div>}
                    <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.orangePale, color:C.orange, fontWeight:700 }}>{catLabel(f.category)}</span>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.lightGray, color:C.warmGray, fontWeight:700 }}>{f.prefecture}</span>
                      {(f.review_count > 0) && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:"#E8F5E9", color:C.green, fontWeight:700 }}>📝 {f.review_count}件のレポート</span>}
                    </div>
                  </div>
                </div>
                {f.description && <div style={{ fontSize:12, color:"#666", lineHeight:1.6, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>{f.description.length > 80 ? f.description.slice(0,80)+"..." : f.description}</div>}
                <div style={{ marginTop:10, fontSize:11, color:C.orange, fontWeight:700 }}>タップして詳細を見る →</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FacilityDetailView = ({ facility, onBack, isPC, setPage, catIcon, catLabel }) => {
  const { user } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  const fetchVisits = async () => {
    setLoadingVisits(true);
    const { data, error } = await supabase
      .from("facility_visits")
      .select("*")
      .eq("facility_id", facility.id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      const userIds = [...new Set(data.map(v => v.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
        const profMap = {};
        (profs || []).forEach(p => { profMap[p.id] = p; });
        const enriched = data.map(v => ({
          ...v,
          authorName: profMap[v.user_id]?.display_name || "匿名",
          authorAvatar: profMap[v.user_id]?.avatar_url || "",
        }));
        setVisits(enriched);
      } else {
        setVisits(data);
      }
    }
    setLoadingVisits(false);
  };

  useEffect(() => { fetchVisits(); }, [facility.id]);

  const moodLabel = (id) => MOOD_TAGS.find(m => m.id === id)?.label || id;
  const moodIcon = (id) => MOOD_TAGS.find(m => m.id === id)?.icon || "🐾";

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"16px", background:C.white, borderBottom:`1px solid ${C.border}`, position:"sticky", top:isPC?0:60, zIndex:50 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:8, padding:0, fontFamily:"inherit" }}>← 一覧に戻る</button>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>
            {catIcon(facility.category)}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:4 }}>{facility.name}</h1>
            <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>📍 {facility.address}</div>
            {facility.hours && <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>🕐 {facility.hours}</div>}
            {facility.phone && <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>📞 {facility.phone}</div>}
            <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.orangePale, color:C.orange, fontWeight:700 }}>{catLabel(facility.category)}</span>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.lightGray, color:C.warmGray, fontWeight:700 }}>{facility.prefecture}</span>
              {(facility.review_count > 0) && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:"#E8F5E9", color:C.green, fontWeight:700 }}>📝 {facility.review_count}件のレポート</span>}
            </div>
          </div>
        </div>
        {facility.description && <div style={{ fontSize:12, color:"#666", lineHeight:1.7, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>{facility.description}</div>}
        {facility.website && <a href={facility.website} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block", marginTop:8, fontSize:12, color:C.blue, fontWeight:700 }}>🔗 ウェブサイトを見る</a>}
        <button onClick={()=>setShowCorrectionForm(true)} style={{ display:"block", marginTop:8, fontSize:11, color:C.warmGray, background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"underline", fontFamily:"inherit" }}>この情報を訂正する</button>
      </div>

      <div style={{ padding:"16px" }}>
        {user ? (
          <button onClick={()=>setShowVisitForm(true)} style={{
            width:"100%", padding:"14px", background:C.orange, border:"none", borderRadius:12,
            color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit",
            boxShadow:"0 4px 12px rgba(245, 169, 74, 0.3)"
          }}>📝 訪問レポートを投稿する</button>
        ) : (
          <button onClick={()=>setPage("login")} style={{
            width:"100%", padding:"14px", background:C.white, border:`1.5px solid ${C.orange}`, borderRadius:12,
            color:C.orange, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit"
          }}>🔒 ログインしてレポートを投稿</button>
        )}
      </div>

      <div style={{ padding:"0 16px 80px" }}>
        <h2 style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:12 }}>🐾 みんなの訪問レポート</h2>
        {loadingVisits ? (
          <div style={{ textAlign:"center", padding:40, color:C.warmGray }}>読み込み中...</div>
        ) : visits.length === 0 ? (
          <div style={{ background:C.white, borderRadius:16, padding:"40px 20px", border:`1px dashed ${C.border}`, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🐾</div>
            <div style={{ fontSize:13, color:C.warmGray, lineHeight:1.7 }}>まだレポートがありません<br/>最初のレポート投稿者になりませんか？</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {visits.map(v => (
              <div key={v.id} style={{ background:C.white, borderRadius:16, padding:"14px 16px", border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", fontSize:14 }}>
                    {v.authorAvatar ? <img src={v.authorAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : "🐾"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.dark }}>{v.authorName}</div>
                    <div style={{ fontSize:10, color:C.warmGray }}>
                      {v.visited_at ? `${new Date(v.visited_at).toLocaleDateString("ja-JP")}に訪問` : new Date(v.created_at).toLocaleDateString("ja-JP")}
                    </div>
                  </div>
                  {user && user.id !== v.user_id && (
                    <button onClick={()=>setReportTarget(v)} style={{ background:"none", border:"none", color:C.warmGray, fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"4px 8px" }}>⚠ 通報</button>
                  )}
                </div>
                {Array.isArray(v.mood_tags) && v.mood_tags.length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:v.comment?8:0 }}>
                    {v.mood_tags.map(t => (
                      <span key={t} style={{ fontSize:11, padding:"4px 10px", borderRadius:12, background:C.cream, color:C.dark, fontWeight:700 }}>
                        {moodIcon(t)} {moodLabel(t)}
                      </span>
                    ))}
                  </div>
                )}
                {v.comment && (
                  <div style={{ fontSize:13, color:C.dark, lineHeight:1.7, whiteSpace:"pre-wrap" }}>{v.comment}</div>
                )}
                {Array.isArray(v.photo_urls) && v.photo_urls.length > 0 && (
                  <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(v.photo_urls.length, 3)}, 1fr)`, gap:6, marginTop:10 }}>
                    {v.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" style={{ width:"100%", aspectRatio:"1/1", objectFit:"cover", borderRadius:10 }}/>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showVisitForm && (
        <FacilityVisitForm
          facility={facility}
          user={user}
          onClose={()=>setShowVisitForm(false)}
          onSubmitted={()=>{ setShowVisitForm(false); fetchVisits(); }}
        />
      )}

      {reportTarget && (
        <FacilityReportModal
          visit={reportTarget}
          user={user}
          onClose={()=>setReportTarget(null)}
          onSubmitted={()=>{ setReportTarget(null); fetchVisits(); }}
        />
      )}

      {showCorrectionForm && (
        <FacilityCorrectionForm
          facility={facility}
          user={user}
          onClose={()=>setShowCorrectionForm(false)}
        />
      )}
    </div>
  );
};

const FacilityVisitForm = ({ facility, user, onClose, onSubmitted }) => {
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [comment, setComment] = useState("");
  const [visitedAt, setVisitedAt] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef(null);

  const toggleMood = (id) => {
    setSelectedMoods(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - photoFiles.length);
    if (files.length === 0) return;
    const newFiles = [...photoFiles, ...files].slice(0, 3);
    setPhotoFiles(newFiles);
    const previews = newFiles.map(f => URL.createObjectURL(f));
    setPhotoPreviews(previews);
  };

  const removePhoto = (idx) => {
    const newFiles = photoFiles.filter((_, i) => i !== idx);
    const newPreviews = photoPreviews.filter((_, i) => i !== idx);
    setPhotoFiles(newFiles);
    setPhotoPreviews(newPreviews);
  };

  const handleSubmitClick = () => {
    setError("");
    if (selectedMoods.length === 0 && !comment.trim() && photoFiles.length === 0) {
      setError("気分タグ・コメント・写真のいずれかを入力してください");
      return;
    }
    const ngWord = checkFacilityNGWords(comment);
    if (ngWord) {
      setError(`不適切な表現が含まれています: 「${ngWord}」\n他の方を傷つけない表現でお願いします`);
      return;
    }
    if (comment.length > 1000) {
      setError("コメントは1000文字以内でお願いします");
      return;
    }
    setConfirming(true);
  };

  const handleConfirmSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError("");

    let photoUrls = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const f = photoFiles[i];
      const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${facility.id}_${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("facility-photos").upload(path, f);
      if (upErr) {
        setError(`写真のアップロードに失敗しました: ${upErr.message}`);
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("facility-photos").getPublicUrl(path);
      photoUrls.push(urlData.publicUrl);
    }

    const { error: insErr } = await supabase.from("facility_visits").insert({
      facility_id: facility.id,
      user_id: user.id,
      mood_tags: selectedMoods,
      comment: comment.trim() || null,
      visited_at: visitedAt || null,
      photo_urls: photoUrls,
    });

    if (insErr) {
      setError(`投稿に失敗しました: ${insErr.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSubmitted();
  };

  if (confirming) {
    return (
      <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:400, width:"100%" }}>
          <div style={{ fontSize:40, textAlign:"center", marginBottom:12 }}>🐾</div>
          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, textAlign:"center", marginBottom:12 }}>投稿前に最終確認</h2>
          <div style={{ background:C.cream, borderRadius:12, padding:"14px", fontSize:12, color:C.dark, lineHeight:1.7, marginBottom:16 }}>
            ✅ 他の人を傷つけない内容ですか？<br/>
            ✅ 個人を特定できる情報は含まれていませんか？<br/>
            ✅ 事実に基づいた内容ですか？<br/>
            <br/>
            <span style={{ color:C.warmGray, fontSize:11 }}>※ 通報が3件以上集まると自動的に非表示になります</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setConfirming(false)} disabled={submitting} style={{ flex:1, padding:"12px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:submitting?"not-allowed":"pointer", fontFamily:"inherit" }}>戻って修正</button>
            <button onClick={handleConfirmSubmit} disabled={submitting} style={{ flex:2, padding:"12px", background:submitting?C.warmGray:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:submitting?"not-allowed":"pointer", fontFamily:"inherit" }}>{submitting ? "投稿中..." : "🐾 投稿する"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:480, width:"100%", maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>📝 訪問レポート</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
        </div>
        <p style={{ fontSize:11, color:C.warmGray, marginBottom:14 }}>{facility.name} のレポート</p>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:8 }}>あなたの体験は？(複数選択可)</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {MOOD_TAGS.map(t => (
              <button key={t.id} onClick={()=>toggleMood(t.id)} style={{
                padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                background: selectedMoods.includes(t.id) ? C.orange : C.white,
                color: selectedMoods.includes(t.id) ? "#fff" : C.dark,
                border:`1.5px solid ${selectedMoods.includes(t.id) ? C.orange : C.border}`,
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>訪問日(任意)</label>
          <input type="date" value={visitedAt} onChange={e=>setVisitedAt(e.target.value)} max={new Date().toISOString().split("T")[0]} style={{
            padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none"
          }}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>コメント(任意・1000文字以内)</label>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4} placeholder="うちの子の様子、おすすめポイントを教えてね 🐾" maxLength={1000} style={{
            width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
          }}/>
          <div style={{ fontSize:10, color:C.warmGray, textAlign:"right", marginTop:4 }}>{comment.length}/1000</div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>写真(任意・最大3枚)</label>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoSelect} style={{ display:"none" }}/>
          {photoPreviews.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:6, marginBottom:8 }}>
              {photoPreviews.map((src, i) => (
                <div key={i} style={{ position:"relative" }}>
                  <img src={src} alt="" style={{ width:"100%", aspectRatio:"1/1", objectFit:"cover", borderRadius:10 }}/>
                  <button onClick={()=>removePhoto(i)} style={{ position:"absolute", top:4, right:4, width:24, height:24, borderRadius:"50%", background:"rgba(0,0,0,0.6)", color:"#fff", border:"none", cursor:"pointer", fontSize:12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {photoFiles.length < 3 && (
            <button onClick={()=>fileRef.current?.click()} style={{
              width:"100%", padding:"20px", border:`2px dashed ${C.border}`, borderRadius:12,
              background:C.lightGray, cursor:"pointer", color:C.warmGray, fontSize:13, fontFamily:"inherit"
            }}>📷 写真を追加(残り{3 - photoFiles.length}枚)</button>
          )}
        </div>

        {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12, whiteSpace:"pre-wrap" }}>{error}</div>}

        <div style={{ background:"#FFF8E1", borderRadius:10, padding:"10px 12px", fontSize:11, color:"#5D4037", lineHeight:1.7, marginBottom:14 }}>
          📜 投稿は<a href="https://qocca.pet/terms" target="_blank" rel="noopener noreferrer" style={{ color:C.orange, fontWeight:700 }}>利用規約</a>に従い、誹謗中傷や個人を特定できる情報は禁止です
        </div>

        <button onClick={handleSubmitClick} style={{
          width:"100%", padding:"14px", background:C.orange, border:"none", borderRadius:12,
          color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit"
        }}>確認画面へ →</button>
      </div>
    </div>
  );
};

const FacilityReportModal = ({ visit, user, onClose, onSubmitted }) => {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setSubmitting(true);
    setError("");
    const { error: insErr } = await supabase.from("facility_visit_reports").insert({
      visit_id: visit.id,
      reporter_id: user.id,
      reason,
      detail: detail.trim() || null,
    });
    if (insErr) {
      if (insErr.message.includes("duplicate") || insErr.code === "23505") {
        setError("この投稿は既に通報済みです");
      } else {
        setError(`通報に失敗しました: ${insErr.message}`);
      }
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    alert("通報を受け付けました。確認後、運営が対応します。");
    onSubmitted();
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:400, width:"100%" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark }}>⚠ 通報する</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:8 }}>通報理由</label>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {FACILITY_REPORT_REASONS.map(r => (
              <label key={r.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:`1.5px solid ${reason===r.id?C.orange:C.border}`, borderRadius:10, cursor:"pointer", background:reason===r.id?C.orangePale:C.white }}>
                <input type="radio" name="reason" value={r.id} checked={reason===r.id} onChange={e=>setReason(e.target.value)}/>
                <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{r.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>詳細(任意)</label>
          <textarea value={detail} onChange={e=>setDetail(e.target.value)} rows={3} maxLength={500} placeholder="補足情報があれば記入してください" style={{
            width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
          }}/>
        </div>
        {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12 }}>{error}</div>}
        <button onClick={handleSubmit} disabled={!reason || submitting} style={{
          width:"100%", padding:"12px", background:(!reason||submitting)?C.warmGray:C.red, border:"none", borderRadius:12,
          color:"#fff", fontWeight:800, fontSize:14, cursor:(!reason||submitting)?"not-allowed":"pointer", fontFamily:"inherit"
        }}>{submitting ? "送信中..." : "通報する"}</button>
      </div>
    </div>
  );
};

const FacilityCorrectionForm = ({ facility, user, onClose }) => {
  const [fieldName, setFieldName] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const FIELDS = [
    { id:"address", label:"住所" },
    { id:"phone", label:"電話番号" },
    { id:"hours", label:"営業時間" },
    { id:"website", label:"公式サイト" },
    { id:"closed", label:"閉店・移転している" },
    { id:"other", label:"その他" },
  ];

  const handleSubmit = async () => {
    if (!fieldName) return;
    setSubmitting(true);
    setError("");
    const { error: insErr } = await supabase.from("facility_corrections").insert({
      facility_id: facility.id,
      user_id: user?.id || null,
      field_name: fieldName,
      current_value: facility[fieldName] || null,
      proposed_value: proposedValue.trim() || null,
    });
    if (insErr) {
      setError(`送信に失敗しました: ${insErr.message}`);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setDone(true);
    setTimeout(()=>onClose(), 2000);
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:400, width:"100%" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark }}>📝 情報を訂正</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
        </div>
        {done ? (
          <div style={{ textAlign:"center", padding:"30px 10px" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:6 }}>送信ありがとうございます</div>
            <div style={{ fontSize:12, color:C.warmGray }}>運営が確認後、情報を更新します</div>
          </div>
        ) : (
          <>
            <p style={{ fontSize:11, color:C.warmGray, marginBottom:14, lineHeight:1.6 }}>※ この内容は公開されません。運営のみが確認します</p>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:8 }}>訂正する項目</label>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {FIELDS.map(f => (
                  <label key={f.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:`1.5px solid ${fieldName===f.id?C.orange:C.border}`, borderRadius:10, cursor:"pointer", background:fieldName===f.id?C.orangePale:C.white }}>
                    <input type="radio" name="field" value={f.id} checked={fieldName===f.id} onChange={e=>setFieldName(e.target.value)}/>
                    <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>正しい情報・詳細</label>
              <textarea value={proposedValue} onChange={e=>setProposedValue(e.target.value)} rows={3} maxLength={500} placeholder="正しい情報を教えてください" style={{
                width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
              }}/>
            </div>
            {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12 }}>{error}</div>}
            <button onClick={handleSubmit} disabled={!fieldName || submitting} style={{
              width:"100%", padding:"12px", background:(!fieldName||submitting)?C.warmGray:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:14, cursor:(!fieldName||submitting)?"not-allowed":"pointer", fontFamily:"inherit"
            }}>{submitting ? "送信中..." : "送信する"}</button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Gallery (うちの子ギャラリー) ──────────────────────────────────────────
const GalleryPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const { itemId: galleryItemId } = useParams();
  const galleryNavigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [likedPosts, setLikedPosts] = useState({});
  const fileRef = useRef(null);
  const [commentOpen, setCommentOpen] = useState(false);
const [commentTarget, setCommentTarget] = useState<{ type: CommentTargetType; id: string; ownerId: string } | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gallery_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
      const profMap = {};
      (profiles || []).forEach(p => { profMap[p.id] = p; });

      const petIds = [...new Set(data.filter(p => p.pet_id).map(p => p.pet_id))];
      let petMap = {};
      if (petIds.length > 0) {
        const { data: pets } = await supabase.from("pets").select("id, name, species").in("id", petIds);
        (pets || []).forEach(p => { petMap[p.id] = p; });
      }

      setPosts(data.map(p => ({
        ...p,
        userName: profMap[p.user_id]?.display_name || "ユーザー",
        userAvatar: profMap[p.user_id]?.avatar_url || "",
        petName: petMap[p.pet_id]?.name || "",
        petSpecies: petMap[p.pet_id]?.species || "",
      })));
    }
    // いいね状態を取得
    if (user) {
      const { data: likes } = await supabase.from("gallery_likes").select("post_id").eq("user_id", user.id);
      const likeMap = {};
      (likes || []).forEach(l => { likeMap[l.post_id] = true; });
      setLikedPosts(likeMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setUploading(true);
    const ext = selectedFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("gallery-images").upload(path, selectedFile);
    if (upErr) { alert("アップロードに失敗しました"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("gallery-images").getPublicUrl(path);

    await supabase.from("gallery_posts").insert({
      user_id: user.id,
      image_url: urlData.publicUrl,
      caption: caption,
    });

    setShowUpload(false);
    setSelectedFile(null);
    setPreview("");
    setCaption("");
    setUploading(false);
    fetchPosts();
  };

  const toggleLike = async (postId) => {
    if (!user) { setPage("signup"); return; }
    if (likedPosts[postId]) {
      await supabase.from("gallery_likes").delete().eq("user_id", user.id).eq("post_id", postId);
      setLikedPosts(prev => { const n = {...prev}; delete n[postId]; return n; });
      setPosts(prev => prev.map(p => p.id === postId ? {...p, likes_count: Math.max(0, (p.likes_count||0)-1)} : p));
    } else {
      await supabase.from("gallery_likes").insert({ user_id: user.id, post_id: postId });
      setLikedPosts(prev => ({...prev, [postId]: true}));
      setPosts(prev => prev.map(p => p.id === postId ? {...p, likes_count: (p.likes_count||0)+1} : p));
    }
  };

  const gridCols = isPC ? "repeat(3, 1fr)" : "repeat(2, 1fr)";

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      {/* ヘッダー */}
      <div style={{ padding:"20px 16px 12px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:4 }}>🐾 うちの子ギャラリー</h1>
            <p style={{ fontSize:12, color:C.warmGray }}>みんなの「うちの子」自慢を見てみよう</p>
          </div>
          {user && (
            <button onClick={()=>setShowUpload(true)} style={{
              padding:"10px 18px", background:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer"
            }}>📸 投稿する</button>
          )}
        </div>
      </div>

      {/* 投稿モーダル */}
      {showUpload && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:400, width:"100%", maxHeight:"90vh", overflow:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>📸 写真を投稿</h2>
              <button onClick={()=>{setShowUpload(false);setSelectedFile(null);setPreview("");setCaption("");}} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display:"none" }}/>
            {preview ? (
              <div style={{ marginBottom:16 }}>
                <img src={preview} alt="" style={{ width:"100%", borderRadius:14, maxHeight:300, objectFit:"cover" }}/>
                <button onClick={()=>{setSelectedFile(null);setPreview("");}} style={{ marginTop:8, fontSize:12, color:C.red, background:"none", border:"none", cursor:"pointer" }}>写真を変更</button>
              </div>
            ) : (
              <button onClick={()=>fileRef.current?.click()} style={{
                width:"100%", padding:"40px 20px", border:`2px dashed ${C.border}`, borderRadius:14,
                background:C.lightGray, cursor:"pointer", marginBottom:16, textAlign:"center"
              }}>
                <div style={{ fontSize:40, marginBottom:8 }}>📷</div>
                <div style={{ fontSize:13, color:C.warmGray }}>タップして写真を選ぶ</div>
              </button>
            )}
            <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="うちの子の紹介やエピソードを書いてね🐾" rows={3}
              style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:16 }}/>
            <button disabled={!selectedFile||uploading} onClick={handleUpload} style={{
              width:"100%", padding:"14px", background:(!selectedFile||uploading)?C.warmGray:C.orange,
              border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:(!selectedFile||uploading)?"not-allowed":"pointer"
            }}>{uploading ? "投稿中..." : "🐾 投稿する"}</button>
          </div>
        </div>
      )}

      {/* 投稿グリッド */}
      <div style={{ padding:"16px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:C.warmGray }}>読み込み中...</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontSize:64, marginBottom:12 }}>🐾</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>まだ投稿がありません</div>
            <p style={{ fontSize:13, color:C.warmGray, marginBottom:20 }}>最初の投稿者になりませんか？</p>
            {user && <button onClick={()=>setShowUpload(true)} style={{ padding:"12px 24px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer" }}>📸 投稿する</button>}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:12 }}>
            {posts.map(post => (
              <div key={post.id} style={{ background:C.white, borderRadius:16, overflow:"hidden", border:`1px solid ${C.border}`, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ width:"100%", aspectRatio:"1", overflow:"hidden" }}>
                  <img src={post.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                </div>
                <div style={{ padding:"10px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <div style={{ width:24, height:24, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, overflow:"hidden", flexShrink:0 }}>
                      {post.userAvatar ? <img src={post.userAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : "🐾"}
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{post.userName}</span>
                    {post.petName && <span style={{ fontSize:10, color:C.warmGray }}>· {post.petName}</span>}
                  </div>
                  {post.caption && <div style={{ fontSize:12, color:"#555", lineHeight:1.5, marginBottom:6, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{post.caption}</div>}
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <button onClick={()=>toggleLike(post.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:0 }}>
                      {likedPosts[post.id] ? "❤️" : "🤍"}
                    </button>
                    <span style={{ fontSize:11, color:C.warmGray }}>{post.likes_count || 0}</span>
                    <button onClick={()=>{ setCommentTarget({ type:"gallery", id: post.id, ownerId: post.user_id }); setCommentOpen(true); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:0, marginLeft:12 }}>
            💬
          </button>
          <span style={{ fontSize:11, color:C.warmGray }}>コメント</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {commentTarget && (
  <CommentModal
    open={commentOpen}
    onClose={()=>setCommentOpen(false)}
    targetType={commentTarget.type}
    targetId={commentTarget.id}
    postOwnerId={commentTarget.ownerId}
    currentUserId={user?.id}
    onRequireLogin={()=>{ setCommentOpen(false); setPage("login"); }}
    title="コメント"
  />
)}
      </div>
    </div>
  );
};

// ── Legal Pages ───────────────────────────────────────────────────────────
const LegalPage = ({ type, setPage }) => {
  const pages = {
    terms: {
      title: "利用規約",
      updated: "2026年5月16日",
      sections: [
        { h:"第1条（適用）", p:"本規約は、Qocca（以下「当サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意した上で当サービスを利用するものとします。" },
        { h:"第2条（定義）", p:"「ユーザー」とは当サービスに登録した個人または法人を指します。「出品者」とはサービスを出品するユーザー、「購入者」とはサービスを購入するユーザーを指します。「取引」とは出品者と購入者の間で行われるサービスの売買を指します。" },
        { h:"第3条（登録）", p:"ユーザーは正確な情報を登録し、虚偽の情報を提供してはなりません。18歳未満の方は保護者の同意を得た上でご利用ください。1人につき1アカウントの登録に限ります。" },
        { h:"第4条（エスクロー決済）", p:"当サービスはエスクロー方式を採用しています。購入者の支払いは当サービスが一時預かり、取引完了後に出品者へ支払います。納品後72時間以内に購入者が受取確認も異議申し立ても行わない場合、自動的に取引完了となります。" },
        { h:"第5条（手数料）", p:"出品者は取引成立時に以下の手数料を負担します。初回取引：0%、登録後3ヶ月以内：5%＋決済手数料3.6%、通常：10%＋決済手数料3.6%。すべての手数料は出品者の売上から差し引かれます。購入者が支払う金額は出品ページに表示された価格のみです。売上金の振込には振込手数料（1回あたり275円・税込）がかかります。最低振込申請額は3,000円です。" },
        { h:"第6条（禁止事項）", p:"以下の行為を禁止します。(1)生体動物の売買 (2)プラットフォーム外への取引誘導（LINE、メール等での直接取引） (3)著作権・知的財産権を侵害する出品 (4)虚偽の情報・なりすまし (5)他のユーザーへの嫌がらせ・誹謗中傷 (6)法令に違反する行為 (7)当サービスのシステムに対する不正アクセス (8)サクラ行為（自作自演レビュー、報酬を伴う偽レビュー、未購入での評価投稿、なりすましアカウントによる評価操作 等）" },
        { h:"第7条（キャンセル・返金）", p:"作業開始前のキャンセルは購入者へ全額返金されます。納品後72時間以内に異議申し立てが可能です。出品者都合による返金の場合、購入者へ全額返金され、決済手数料は出品者が負担します。購入者都合による納品前キャンセルの場合、決済手数料（商品代金の3.6%）を差し引いた金額が返金されます。納品済み・受取確認後のキャンセルは原則不可です。商品にバリエーション（色違い・サイズ違い等）がある場合も、上記の規定はバリエーションごとに適用されます。" },
        { h:"第8条（異議申し立て）", p:"購入者は納品後72時間以内に異議を申し立てることができます。異議申し立て後、出品者に48時間の回答期限が設定されます。回答がない場合、自動的に購入者へ返金されます。当サービスは両者の主張を確認し、公正に判断します。" },
        { h:"第9条（レビュー・評価の真正性）", p:"Qoccaは、レビュー・評価を住民の暮らしの記録として大切にします。そのため、以下を運営の永続的な約束として明示します。(1)当サービスは、運営側による架空のレビュー・評価（いわゆる「サクラ」）を一切行いません。(2)ユーザーによるサクラ行為（報酬を伴う偽レビュー、自作自演レビュー、なりすましによる評価等）を禁止し、発見次第アカウント停止等の措置を取ります。(3)レビューは実際に取引を完了した購入者のみが投稿できる仕様としています。(4)この方針はQoccaの創業からの永続的な約束であり、将来にわたって運営側もユーザーも遵守します。" },
        { h:"第10条（ペナルティ）", p:"禁止事項に該当する行為が確認された場合、警告、出品停止、アカウント停止等の措置を取ることがあります。特に重大な違反（生体売買・詐欺）については即時アカウント停止となります。" },
        { h:"第11条（免責事項）", p:"当サービスはユーザー間の取引の仲介プラットフォームであり、出品されたサービスの品質・安全性を保証するものではありません。天災、システム障害等の不可抗力による損害について、当サービスは責任を負いません。" },
        { h:"第12条（規約の変更）", p:"当サービスは本規約を随時変更できるものとします。変更後の規約は当サービス上に掲載した時点で効力を生じます。重要な変更の場合はメールまたはアプリ内通知でお知らせします。" },
        { h:"第13条（準拠法・管轄）", p:"本規約の解釈は日本法に準拠します。本規約に関連する紛争については、大阪地方裁判所を第一審の専属的合意管轄裁判所とします。" },
      ]
    },
    privacy: {
      title: "プライバシーポリシー",
      updated: "2026年5月16日",
      sections: [
        { h:"1. 収集する情報", p:"当サービスは以下の情報を収集します。(1)アカウント情報（メールアドレス、表示名、パスワードのハッシュ値） (2)プロフィール情報（プロフィール画像、自己紹介文） (3)取引情報（注文履歴、メッセージ内容、レビュー、商品バリエーション選択履歴） (4)決済情報（Stripeが処理。当サービスはクレジットカード番号を保持しません） (5)利用情報（アクセスログ、IPアドレス、ブラウザ情報）" },
        { h:"2. 情報の利用目的", p:"収集した情報は以下の目的で利用します。(1)サービスの提供・運営 (2)ユーザーサポート (3)不正利用の防止・検出 (4)サービスの改善・新機能の開発 (5)お知らせ・マーケティング情報の送信（オプトアウト可能）" },
        { h:"3. 情報の第三者提供", p:"法令に基づく場合、ユーザーの同意がある場合、または以下の業務委託先を除き、個人情報を第三者に提供しません。決済処理：Stripe, Inc.、ホスティング：Vercel Inc.、データベース：Supabase Inc." },
        { h:"4. 情報の保管・セキュリティ", p:"個人情報はSupabaseの暗号化されたデータベースに保管されます。パスワードはbcryptによりハッシュ化されます。SSL/TLSによる通信の暗号化を実施しています。" },
        { h:"5. Cookie", p:"当サービスはセッション管理のためにCookieを使用します。ブラウザの設定でCookieを無効にできますが、一部の機能が利用できなくなる場合があります。" },
        { h:"6. ユーザーの権利", p:"ユーザーは自身の個人情報について、開示・訂正・削除・利用停止を請求できます。アカウント設定ページから、またはお問い合わせフォームからご連絡ください。" },
        { h:"7. 未成年者の利用", p:"18歳未満のユーザーは保護者の同意を得た上でご利用ください。13歳未満のお子様の個人情報を意図的に収集することはありません。" },
        { h:"8. 改定", p:"本ポリシーは随時改定される場合があります。重要な変更はメールまたはアプリ内通知でお知らせします。" },
        { h:"9. お問い合わせ", p:"プライバシーに関するお問い合わせは、アプリ内サポートまたは support@qocca.pet までご連絡ください。" },
      ]
    },
    tokusho: {
      title: "特定商取引法に基づく表記",
      updated: "2026年5月16日",
      sections: [
        { h:"事業者名", p:"Qocca（個人事業）" },
        { h:"代表者", p:"正和1204（開業届提出後に本名を記載）" },
        { h:"所在地", p:"大阪府（詳細住所は請求があった場合に遅滞なく開示いたします）" },
        { h:"連絡先", p:"support@qocca.pet（お問い合わせはアプリ内サポートをご利用ください）\n電話番号は請求があった場合に遅滞なく開示いたします。" },
        { h:"販売価格", p:"各出品ページに表示された金額（税込）。商品にバリエーション（色違い・サイズ違い等）がある場合、選択したバリエーションごとに価格が異なる場合があります。購入者が支払う金額は表示価格のみです。決済手数料・サービス手数料はすべて出品者が負担します。" },
        { h:"支払方法", p:"クレジットカード決済（Stripe経由：VISA、Mastercard、JCB、American Express対応）" },
        { h:"支払時期", p:"注文確定時に決済されます。エスクロー方式により、取引完了まで当サービスがお預かりします。" },
        { h:"サービス提供時期", p:"注文確定後、出品者が設定した納期内に提供されます。" },
        { h:"返品・キャンセル", p:"作業開始前（購入者都合）：決済手数料（3.6%）を差し引いた金額を返金。\n作業開始前（出品者都合）：全額返金。\n納品後72時間以内：異議申し立て可能（出品者都合の場合は全額返金）。\n納品後72時間経過：取引完了（返金不可）。\n詳細は利用規約第7条をご確認ください。" },
        { h:"動作環境", p:"Google Chrome、Safari、Firefox、Edgeの最新版を推奨。\nスマートフォンはiOS 15以降、Android 10以降を推奨。" },
        { h:"役務の対価以外の必要料金", p:"インターネット接続料金、通信料はユーザー負担となります。" },
      ]
    },
    contact: {
      title: "お問い合わせ",
      updated: "",
      sections: [
        { h:"お問い合わせ方法", p:"Qoccaへのお問い合わせは、以下の方法で受け付けています。" },
        { h:"アプリ内サポート（推奨）", p:"ログイン後、マイページ → サポート からメッセージをお送りください。通常48時間以内にご回答いたします。緊急の場合は「緊急」とご記入ください。" },
        { h:"メール", p:"support@qocca.pet 宛にお送りください。件名に「お問い合わせ」と注文番号（お持ちの場合）をご記入ください。" },
        { h:"Instagram DM", p:"@qocca_pet 宛にダイレクトメッセージをお送りください。" },
        { h:"対応時間", p:"平日 10:00〜18:00（土日祝休み）。緊急の不正利用報告は24時間受付。" },
      ]
    }
  };

  const pg = pages[type];
  if (!pg) return null;

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.orange, fontWeight:700 }}>←</button>
        <span style={{ fontSize:14, fontWeight:700, color:C.dark }}>{pg.title}</span>
      </div>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"24px 16px 80px" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8 }}>{pg.title}</h1>
        {pg.updated && <div style={{ fontSize:12, color:C.warmGray, marginBottom:24 }}>最終更新日：{pg.updated}</div>}
        {pg.sections.map((s,i) => (
          <div key={i} style={{ marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:6 }}>{s.h}</div>
            <div style={{ fontSize:13, color:"#555", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{s.p}</div>
          </div>
        ))}
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16, marginTop:24, fontSize:11, color:C.warmGray }}>
          © 2026 Qocca. All rights reserved.
        </div>
      </div>
    </div>
  );
};

// ── Shared Footer ─────────────────────────────────────────────────────────
const SharedFooter = ({ setPage }) => (
  <footer style={{ background:"#0D0A05", padding:"24px 16px" }}>
    <Logo size={24}/>
    <div style={{ display:"flex", flexWrap:"wrap", gap:16, marginTop:16 }}>
      {[["help","ヘルプ"],["terms","利用規約"],["privacy","プライバシー"],["tokusho","特定商取引法"],["contact","お問い合わせ"]].map(([id,l])=>(
        <span key={id} onClick={()=>setPage(id)} style={{ fontSize:11, color:"rgba(255,255,255,0.3)", cursor:"pointer" }}>{l}</span>
      ))}
    </div>
    <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:12 }}>© 2026 Qocca Inc.</div>
  </footer>
);

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
const TabBar = ({ page, setPage }) => {
  const { user } = useAuth();
  const tabs = [
    { id:"home", icon:"🏠", label:"ホーム" },
    { id:"communities", icon:"💬", label:"コミュニティ" },
    { id:"sell", icon:"➕", label:"" },
    { id:"events", icon:"📅", label:"イベント" },
    { id: user ? "mypage" : "signup", icon:"👤", label: user ? "マイページ" : "ログイン" },
  ];
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:200,
      background:C.white, borderTop:`1px solid ${C.border}`,
      display:"flex", paddingBottom:"env(safe-area-inset-bottom, 8px)",
      boxShadow:"0 -4px 20px rgba(0,0,0,0.06)"
    }}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setPage(t.id)} style={{
          flex:1, background:"none", border:"none", padding:"10px 0 4px",
          cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2
        }}>
          {t.id==="sell" ? (
            <div style={{
              width:46, height:46, borderRadius:"50%", background:C.orange,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, marginTop:-20, boxShadow:`0 4px 14px rgba(245,169,74,0.45)`
            }}>➕</div>
          ) : (
            <>
              <span style={{ fontSize:20 }}>{t.icon}</span>
              <span style={{ fontSize:9, fontWeight:700, color: page===t.id ? C.orange : C.warmGray, whiteSpace:"nowrap" }}>{t.label}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
};

// ── PC Hero ──────────────────────────────────────────────────────────────
const PCHeroSection = ({ setPage }) => {
  const heroStats = useHeroStats();
  return (
  <section style={{
    background:`linear-gradient(145deg, ${C.dark} 0%, ${C.darkBrown} 55%, #3D2810 100%)`,
    position:"relative", overflow:"hidden"
  }}>
    <div style={{ position:"absolute", left:-60, top:-40, fontSize:280, opacity:0.03, pointerEvents:"none" }}>🐾</div>
    <div style={{ position:"absolute", right:-40, bottom:-60, fontSize:200, opacity:0.03, pointerEvents:"none" }}>🏘</div>
    <div style={{ maxWidth:1280, margin:"0 auto", padding:"80px 48px", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 16px", background:"rgba(245,169,74,0.15)", borderRadius:20, border:"1px solid rgba(245,169,74,0.3)", marginBottom:24 }}>
        <span>🐨</span><span style={{ fontSize:13, color:C.orange, fontWeight:700 }}>ペット好きが集まる、温かい街 · 住民募集中</span>
      </div>
      <h1 style={{ fontSize:52, fontWeight:900, color:"#fff", lineHeight:1.15, marginBottom:18, letterSpacing:"-1px" }}>
        うちの子の話で、<span style={{ color:C.orange }}>つながる場所。</span>
      </h1>
      <p style={{ fontSize:16, color:"rgba(255,255,255,0.65)", lineHeight:1.9, marginBottom:32, maxWidth:620 }}>
        同じ犬種の仲間と話せる広場、想いのこもった一点物が並ぶ商店街、<br/>
        全国のドッグランや施設の案内所。ぜんぶ、ここにある街です 🐾
      </p>
      <div style={{ display:"flex", gap:12, marginBottom:36 }}>
        <button onClick={()=>setPage("communities")} style={{ padding:"14px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer" }}>👋 仲間と話す</button>
        <button onClick={()=>setPage("search")} style={{ padding:"14px 28px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>街を歩く →</button>
      </div>
      <div style={{ display:"flex", gap:40 }}>
        {[[heroStats.users,"住民"],[heroStats.listings,"出品"],[heroStats.communities,"💬 広場"],["¥0","初回手数料"]].map(([v,l])=>(
          <div key={l}><div style={{ fontSize:24, fontWeight:900, color:C.orange }}>{v}</div><div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:4 }}>{l}</div></div>
        ))}
      </div>
    </div>
  </section>
  );
};

// ── EVENTS PAGE ───────────────────────────────────────────────────────────
const EventsPage = ({ isPC, setPage }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pref, setPref] = useState("すべて");
  const [cat, setCat] = useState("すべて");
  const [pet, setPet] = useState("すべて");
  const [evLiked, setEvLiked] = useState({});
  const [joined, setJoined] = useState({});
  const [selected, setSelected] = useState(null);
  const [showPost, setShowPost] = useState(false);
  const [form, setForm] = useState({ title:"", event_date:"", event_time:"", place:"", prefecture:"東京都", pet_type:"both", fee:"", category:"フェスタ", description:"" });
  const [submitting, setSubmitting] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ type: CommentTargetType; id: string; ownerId: string } | null>(null);

  // DB からイベントを取得
  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("status", ["approved", "sold_out"])
      .order("event_date", { ascending: true });
    if (!error && data) {
      // モックデータの形式に合わせて変換
      const converted = data.map(e => ({
        id: e.id,
        title: e.title,
        date: e.event_date,
        time: e.event_time || "",
        place: e.place,
        pref: e.prefecture,
        pet: e.pet_type,
        fee: e.fee || "無料",
        image: e.image_url || "🐾",
        organizer: "",
        url: e.url || "",
        desc: e.description,
        likes: e.like_count || 0,
        joins: 0,
        comments: 0,
        category: e.category || "フェスタ",
        bg: e.pet_type === "dog" ? "#FFF3E0" : e.pet_type === "cat" ? "#F3E5F5" : "#E8F5E9",
        organizer_id: e.organizer_id,
      }));
      setEvents(converted);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  // イベント投稿
  const handleSubmitEvent = async () => {
    if (!user || !form.title || !form.event_date) return;
    setSubmitting(true);
    const { error } = await supabase.from("events").insert({
      organizer_id: user.id,
      title: form.title,
      description: form.description,
      event_date: form.event_date,
      event_time: form.event_time,
      place: form.place,
      prefecture: form.prefecture,
      pet_type: form.pet_type,
      fee: form.fee,
      category: form.category,
      image_url: form.image_url || "",
      status: "pending",
    });
    setSubmitting(false);
    if (!error) {
      setShowPost(false);
      setForm({ title:"", event_date:"", event_time:"", place:"", prefecture:"東京都", pet_type:"both", fee:"", category:"フェスタ", description:"", image_url:"" });
      alert("投稿ありがとうございます！審査後に公開されます🐾");
    } else {
      alert("投稿に失敗しました: " + error.message);
    }
  };

  const filtered = events.filter(e => {
    if (pref !== "すべて" && e.pref !== pref) return false;
    if (cat !== "すべて" && e.category !== cat) return false;
    if (pet !== "すべて" && e.pet !== pet) return false;
    return true;
  });

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ background:`linear-gradient(135deg, ${C.dark}, ${C.darkBrown})`, padding: isPC ? "24px 0 0" : "20px 16px 0", borderRadius: isPC ? 16 : 0, marginBottom:16, overflow:"hidden" }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900, color:C.white, marginBottom:4 }}>🐾 ペットイベント</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:16 }}>全国のペットイベントを探そう・投稿しよう</div>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          <button style={{ padding:"10px 16px", border:"none", borderRadius:"10px 10px 0 0", background:C.cream, color:C.orange, fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>📋 一覧</button>
          <button onClick={()=>{ if(!user){ setPage&&setPage("login"); return; } setShowPost(true); }} style={{ padding:"10px 16px", border:"none", borderRadius:"10px 10px 0 0", background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>✏️ 投稿する</button>
        </div>
      </div>
      <div style={{ marginBottom:16, padding: isPC ? 0 : "0 16px" }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.warmGray, marginBottom:8 }}>都道府県</div>
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
          {EVENT_PREFS.map(p=>(
            <button key={p} onClick={()=>setPref(p)} style={{ flexShrink:0, padding:"6px 14px", border:`1.5px solid ${pref===p?C.orange:C.border}`, borderRadius:20, background:pref===p?C.orangePale:C.white, color:pref===p?C.orange:C.warmGray, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{p}</button>
          ))}
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:C.warmGray, margin:"10px 0 8px" }}>カテゴリ</div>
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
          {EVENT_CATS.map(c2=>(
            <button key={c2} onClick={()=>setCat(c2)} style={{ flexShrink:0, padding:"6px 14px", border:`1.5px solid ${cat===c2?C.orange:C.border}`, borderRadius:20, background:cat===c2?C.orangePale:C.white, color:cat===c2?C.orange:C.warmGray, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{c2}</button>
          ))}
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:C.warmGray, margin:"10px 0 8px" }}>対象ペット</div>
        <div style={{ display:"flex", gap:6 }}>
          {[["すべて","🐾 すべて"],["dog","🐕 犬"],["cat","🐈 猫"],["both","🐾 両方"]].map(([v,l])=>(
            <button key={v} onClick={()=>setPet(v)} style={{ flexShrink:0, padding:"6px 14px", border:`1.5px solid ${pet===v?C.orange:C.border}`, borderRadius:20, background:pet===v?C.orangePale:C.white, color:pet===v?C.orange:C.warmGray, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize:13, color:C.warmGray, marginBottom:12, padding: isPC ? 0 : "0 16px" }}>
        {loading ? "読み込み中..." : `${filtered.length}件のイベント`}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:14, padding: isPC ? "0 0 24px" : "0 16px 24px" }}>
        {filtered.map(ev=>(
          <div key={ev.id} onClick={()=>setSelected(ev)} style={{ background:C.white, borderRadius:18, overflow:"hidden", border:`1px solid ${C.border}`, cursor:"pointer", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", display: isPC ? "flex" : "block" }}>
            <div style={{ height: isPC ? "auto" : 120, width: isPC ? 200 : "auto", flexShrink:0, background:ev.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize: isPC ? 48 : 60, position:"relative", minHeight: isPC ? 160 : "auto" }}>
              {ev.image && ev.image.startsWith("http") 
  ? <img src={ev.image} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> 
  : ev.image}
              <div style={{ position:"absolute", top:10, left:10 }}><span style={{ background:C.orange, color:"#fff", fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:10 }}>{ev.category}</span></div>
              <div style={{ position:"absolute", top:10, right:10 }}><span style={{ background:evPetBg(ev.pet), color:evPetColor(ev.pet), fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:10 }}>{evPetLabel(ev.pet)}</span></div>
            </div>
            <div style={{ padding:"14px", flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:8, lineHeight:1.4 }}>{ev.title}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.warmGray }}><span>📅</span><span>{ev.date} {ev.time}</span></div>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.warmGray }}><span>📍</span><span>{ev.pref} {ev.place}</span></div>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.warmGray }}><span>💰</span><span>参加費:{ev.fee}</span></div>
              </div>
              <div style={{ fontSize:12, color:"#555", lineHeight:1.6, marginBottom:12, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{ev.desc}</div>
              <div style={{ display:"flex", gap:8, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                <button onClick={e2=>{e2.stopPropagation();setEvLiked(p=>({...p,[ev.id]:!p[ev.id]}));}} style={{ flex:1, padding:"8px", border:`1.5px solid ${evLiked[ev.id]?C.orange:C.border}`, borderRadius:10, background:evLiked[ev.id]?C.orangePale:C.white, color:evLiked[ev.id]?C.orange:C.warmGray, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>❤️ {ev.likes+(evLiked[ev.id]?1:0)}</button>
                <button onClick={e2=>{e2.stopPropagation();setJoined(p=>({...p,[ev.id]:!p[ev.id]}));}} style={{ flex:2, padding:"8px", border:"none", borderRadius:10, background:joined[ev.id]?C.green:C.orange, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>{joined[ev.id]?"✅ 参加予定":"🐾 参加する"}</button>
                <button onClick={e2=>{ e2.stopPropagation(); setCommentTarget({ type:"event", id: ev.id, ownerId: ev.organizer_id || "" }); setCommentOpen(true); }} style={{ padding:"8px 12px", border:`1.5px solid ${C.border}`, borderRadius:10, background:C.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.warmGray }}>💬</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, overflowY:"auto" }} onClick={()=>setSelected(null)}>
          <div style={{ background:C.white, margin: isPC ? "60px auto" : "40px 16px", maxWidth:600, borderRadius:24, overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
            <div style={{ height:180, background:selected.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:80, position:"relative" }}>
              {selected.image && selected.image.startsWith("http")
  ? <img src={selected.image} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
  : selected.image}
              <button onClick={()=>setSelected(null)} style={{ position:"absolute", top:12, right:12, width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.9)", border:"none", cursor:"pointer", fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:"20px 16px" }}>
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                <span style={{ background:C.orangePale, color:C.orange, fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:10 }}>{selected.category}</span>
                <span style={{ background:evPetBg(selected.pet), color:evPetColor(selected.pet), fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:10 }}>{evPetLabel(selected.pet)}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:14, lineHeight:1.4 }}>{selected.title}</div>
              {[["📅 日時",`${selected.date} ${selected.time}`],["📍 場所",`${selected.pref} ${selected.place}`],["💰 参加費",selected.fee]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", gap:10, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.warmGray, minWidth:80 }}>{k}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{v}</span>
                </div>
              ))}
              <div style={{ margin:"14px 0", fontSize:14, color:"#555", lineHeight:1.8 }}>{selected.desc}</div>
              {selected.url && (
  <a href={selected.url} target="_blank" rel="noopener noreferrer" style={{ display:"block", marginTop:12, padding:"10px 16px", background:"#F5A94A", borderRadius:10, color:"#fff", fontWeight:700, fontSize:13, textAlign:"center", textDecoration:"none" }}>🔗 公式サイトで詳細を見る</a>
)}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>setEvLiked(p=>({...p,[selected.id]:!p[selected.id]}))} style={{ flex:1, padding:"12px", border:`1.5px solid ${evLiked[selected.id]?C.orange:C.border}`, borderRadius:12, background:evLiked[selected.id]?C.orangePale:C.white, color:evLiked[selected.id]?C.orange:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>❤️ {selected.likes+(evLiked[selected.id]?1:0)}</button>
                <button onClick={()=>setJoined(p=>({...p,[selected.id]:!p[selected.id]}))} style={{ flex:2, padding:"12px", border:"none", borderRadius:12, background:joined[selected.id]?C.green:C.orange, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>{joined[selected.id]?"✅ 参加予定!":"🐾 参加する"}</button>
                <button onClick={()=>{ setCommentTarget({ type:"event", id: selected.id, ownerId: selected.organizer_id || "" }); setCommentOpen(true); }} style={{ padding:"12px", border:`1.5px solid ${C.border}`, borderRadius:12, background:"#fff", color:C.dark, fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>💬 コメント</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPost && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, overflowY:"auto" }}>
          <div style={{ background:C.white, margin: isPC ? "60px auto" : "40px 16px", maxWidth:500, borderRadius:24, padding:"24px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>✏️ イベントを投稿</div>
              <button onClick={()=>setShowPost(false)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            {[["イベント名","title","例:わんわんフェスタ in 東京"],["日付","event_date","例:2026-05-01"],["時間","event_time","例:10:00〜17:00"],["会場名","place","例:代々木公園"],["都道府県","prefecture","例:東京都"],["参加費","fee","例:無料 / 500円"]].map(([label,key,ph])=>(
              <div key={key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:5 }}>{label}</label>
                <input value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} placeholder={ph}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:5 }}>対象ペット</label>
              <div style={{ display:"flex", gap:8 }}>
                {[["dog","🐕 犬"],["cat","🐈 猫"],["both","🐾 両方"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setForm(p=>({...p,pet_type:v}))} style={{ flex:1, padding:"10px", border:`2px solid ${form.pet_type===v?C.orange:C.border}`, borderRadius:10, background:form.pet_type===v?C.orangePale:C.white, color:form.pet_type===v?C.orange:C.warmGray, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:5 }}>カテゴリ</label>
              <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box" }}>
                {EVENT_CATS.filter(c=>c!=="すべて").map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:5 }}>イベント詳細</label>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={4} placeholder="イベントの詳細・見どころ..."
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
            </div>
            <div style={{ marginBottom:12 }}>
  <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:5 }}>イベント画像</label>
  <input type="file" accept="image/*" onChange={async(e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `events/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-images").upload(path, file, { upsert:true });
    if (!error) {
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      setForm(p=>({...p, image_url: data.publicUrl}));
    }
  }} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", cursor:"pointer" }}/>
  {form.image_url && (
    <img src={form.image_url} style={{ width:"100%", height:120, objectFit:"cover", borderRadius:10, marginTop:8 }}/>
  )}
</div>
            <div style={{ marginBottom:12 }}>
  <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:5 }}>イベント画像</label>
  <input type="file" accept="image/*" onChange={async(e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `events/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-images").upload(path, file, { upsert:true });
    if (!error) {
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      setForm(p=>({...p, image_url: data.publicUrl}));
    }
  }} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", cursor:"pointer" }}/>
  {form.image_url && form.image_url !== "🐾" && (
    <img src={form.image_url} style={{ width:"100%", height:120, objectFit:"cover", borderRadius:10, marginTop:8 }}/>
  )}
</div>
            <div style={{ background:C.orangePale, borderRadius:12, padding:"12px", fontSize:12, color:C.orange, marginBottom:16 }}>🐾 投稿後、管理者が審査(最大24時間)してから公開されます。</div>
            <button disabled={submitting||!form.title||!form.event_date} onClick={handleSubmitEvent} style={{ width:"100%", padding:"14px", background:(submitting||!form.title||!form.event_date)?C.warmGray:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:(submitting||!form.title||!form.event_date)?"not-allowed":"pointer", fontFamily:"inherit" }}>
              {submitting ? "送信中..." : "🐾 投稿する"}
            </button>
          </div>
        </div>
      )}

      {commentTarget && (
        <CommentModal
          open={commentOpen}
          onClose={()=>setCommentOpen(false)}
          targetType={commentTarget.type}
          targetId={commentTarget.id}
          postOwnerId={commentTarget.ownerId}
          currentUserId={user?.id}
          onRequireLogin={()=>{ setCommentOpen(false); setPage && setPage("login"); }}
          title="コメント"
        />
      )}
    </div>
  );
};


// ── コミュニティカテゴリ ──────────────────────────────────────────────────
const COMMUNITY_CATEGORIES = ["すべて","犬種別","猫種別","エリア別","しつけ・お悩み","お散歩仲間","多頭飼い","シニアペット","保護犬・保護猫","その他"];

// ── コミュニティ作成モーダル ──────────────────────────────────────────────
const CreateCommunityModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: (id:string) => void }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("犬種別");
  const [icon, setIcon] = useState("🐶");
  const [submitting, setSubmitting] = useState(false);
  const ICON_CHOICES = ["🐶","🐕","🐩","🐕‍🦺","🐈","🐈‍⬛","🐾","🦴","🏠","🌸","💕","✨","🎀","🎂","🎉","📷","🎨","🍖","🐦","🐰","🦜","🐢"];

  const handleCreate = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("ログインが必要です"); setSubmitting(false); return; }
    const { data, error } = await supabase.from("communities").insert({
      name: name.trim(), description: description.trim(), category, icon, creator_id: user.id,
    }).select().single();
    setSubmitting(false);
    if (error) { alert("作成に失敗しました: " + error.message); return; }
    if (data) onCreated(data.id);
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white, borderRadius:20, padding:"24px 20px", width:"100%", maxWidth:480, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:17, fontWeight:900, color:C.dark }}>💬 コミュニティを作成</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.warmGray }}>×</button>
        </div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:6 }}>アイコン</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
          {ICON_CHOICES.map(ic => (
            <button key={ic} onClick={()=>setIcon(ic)} style={{ width:36, height:36, borderRadius:8, background: icon === ic ? C.orangePale : C.lightGray, border: icon === ic ? `2px solid ${C.orange}` : "2px solid transparent", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{ic}</button>
          ))}
        </div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:6 }}>コミュニティ名 <span style={{ color:C.orange }}>*</span></div>
        <input value={name} onChange={e=>setName(e.target.value)} maxLength={40} placeholder="例: シーズー大好き集まれ！" style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", boxSizing:"border-box", marginBottom:14, outline:"none" }}/>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:6 }}>カテゴリ</div>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", boxSizing:"border-box", marginBottom:14, outline:"none", background:C.white }}>
          {COMMUNITY_CATEGORIES.filter(c=>c!=="すべて").map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:6 }}>説明（任意）</div>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={200} placeholder="どんなコミュニティか紹介してください" style={{ width:"100%", minHeight:80, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", boxSizing:"border-box", marginBottom:6, outline:"none", resize:"vertical" }}/>
        <div style={{ fontSize:11, color:C.gray, textAlign:"right", marginBottom:16 }}>{description.length}/200</div>
        <div style={{ background:C.orangePale, borderRadius:10, padding:"10px 12px", marginBottom:16, fontSize:11, color:C.dark, lineHeight:1.5 }}>
          📌 ルール: Qocca内の商品紹介はOK。外部サイト誘導や個人連絡先交換は禁止です。
        </div>
        <button onClick={handleCreate} disabled={!name.trim() || submitting} style={{ width:"100%", padding:"14px", background: !name.trim() || submitting ? "#ccc" : C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor: !name.trim() || submitting ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
          {submitting ? "作成中..." : "コミュニティを作成"}
        </button>
      </div>
    </div>
  );
};

// ── コミュニティ一覧ページ ──────────────────────────────────────────────
const CommunitiesPage = ({ isPC, setPage }: { isPC?: boolean; setPage:(p:string,d?:any)=>void }) => {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<any[]>([]);
  const [myCommunityIds, setMyCommunityIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("すべて");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCommunities = async () => {
    setLoading(true);
    const { data: comms } = await supabase
      .from("communities")
      .select("*")
      .eq("is_archived", false)
      .order("member_count", { ascending: false });
    setCommunities(comms || []);
    if (user) {
      const { data: mems } = await supabase.from("community_members").select("community_id").eq("user_id", user.id);
      setMyCommunityIds(new Set((mems||[]).map((m:any)=>m.community_id)));
    }
    setLoading(false);
  };

  useEffect(() => { fetchCommunities(); }, [user?.id]);

  const filtered = activeCategory === "すべて" ? communities : communities.filter(c => c.category === activeCategory);

  const handleJoin = async (e:React.MouseEvent, communityId:string) => {
    e.stopPropagation();
    if (!user) { setPage("signup"); return; }
    if (myCommunityIds.has(communityId)) {
      // 退出
      await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", user.id);
      setMyCommunityIds(prev => { const next = new Set(prev); next.delete(communityId); return next; });
      setCommunities(prev => prev.map(c => c.id === communityId ? {...c, member_count: Math.max((c.member_count||1)-1, 0)} : c));
    } else {
      // 参加
      await supabase.from("community_members").insert({ community_id: communityId, user_id: user.id });
      setMyCommunityIds(prev => new Set(prev).add(communityId));
      setCommunities(prev => prev.map(c => c.id === communityId ? {...c, member_count: (c.member_count||0)+1} : c));
    }
  };

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, padding: isPC ? 0 : "60px 16px 80px", maxWidth: 800, margin:"0 auto" }}>
      <div style={{ background:`linear-gradient(135deg, ${C.dark}, ${C.darkBrown})`, padding: isPC ? "24px 28px" : "20px 16px", borderRadius: isPC ? 16 : 14, marginBottom:16, color:C.white }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>💬 コミュニティ</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>同じペット・趣味のなかまとつながろう</div>
          </div>
          <button onClick={()=>{ if(!user){setPage("signup"); return;} setShowCreate(true); }} style={{ padding:"10px 18px", background:C.orange, border:"none", borderRadius:10, color:C.white, fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>+ 作成</button>
        </div>
      </div>
      <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:6, marginBottom:16 }}>
        {COMMUNITY_CATEGORIES.map(cat => (
          <button key={cat} onClick={()=>setActiveCategory(cat)} style={{ flexShrink:0, padding:"6px 14px", border:`1.5px solid ${activeCategory===cat?C.orange:C.border}`, borderRadius:20, background:activeCategory===cat?C.orangePale:C.white, color:activeCategory===cat?C.orange:C.warmGray, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{cat}</button>
        ))}
      </div>
      {loading ? (
        <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>💬</div>
          <div>このカテゴリのコミュニティはまだありません</div>
          <div style={{ fontSize:11, marginTop:6 }}>最初のコミュニティを作成してみましょう！</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap:12 }}>
          {filtered.map(c => {
            const isMember = myCommunityIds.has(c.id);
            return (
              <div key={c.id} onClick={()=>setPage(`community/${c.id}`)} style={{ background:C.white, borderRadius:14, padding:"14px", border:`1px solid ${C.border}`, cursor:"pointer", display:"flex", gap:12, alignItems:"flex-start" }}>
                <div style={{ width:48, height:48, borderRadius:12, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{c.icon || "🐾"}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</div>
                    {c.is_official && <span style={{ fontSize:9, padding:"1px 6px", borderRadius:4, background:C.orange, color:"#fff", fontWeight:800 }}>公式</span>}
                  </div>
                  <div style={{ fontSize:11, color:C.warmGray, marginBottom:6 }}>{c.category} · 👥 {c.member_count || 0}人</div>
                  {c.description && <div style={{ fontSize:12, color:"#555", marginBottom:8, lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{c.description}</div>}
                  <button onClick={(e)=>handleJoin(e, c.id)} style={{ padding:"6px 14px", background: isMember ? C.white : C.orange, border: isMember ? `1.5px solid ${C.orange}` : "none", borderRadius:16, color: isMember ? C.orange : "#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    {isMember ? "参加中" : "+ 参加する"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showCreate && <CreateCommunityModal onClose={()=>setShowCreate(false)} onCreated={(id)=>{ setShowCreate(false); fetchCommunities(); setPage(`community/${id}`); }} />}
    </div>
  );
};

// ── コミュニティ詳細・チャットページ ─────────────────────────────────────
const CommunityDetailPage = ({ isPC, setPage }: { isPC?: boolean; setPage:(p:string,d?:any)=>void }) => {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [community, setCommunity] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<{ types: string[]; original: string; masked: string } | null>(null);
  const [ngError, setNgError] = useState<string[] | null>(null);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchCommunity = async () => {
    if (!communityId) return;
    setLoading(true);
    const { data: comm } = await supabase.from("communities").select("*").eq("id", communityId).single();
    setCommunity(comm);
    if (user) {
      const { data: mem } = await supabase.from("community_members").select("id").eq("community_id", communityId).eq("user_id", user.id).maybeSingle();
      setIsMember(!!mem);
      if (mem) {
        const { data: msgs } = await supabase
          .from("community_messages")
          .select("*")
          .eq("community_id", communityId)
          .order("created_at", { ascending: true })
          .limit(100);
        // 送信者プロフィール
        const senderIds = [...new Set((msgs||[]).map((m:any)=>m.sender_id))];
        const { data: profs } = senderIds.length ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", senderIds) : { data: [] };
        const profMap = Object.fromEntries((profs||[]).map((p:any)=>[p.id, p]));
        setMessages((msgs||[]).map((m:any) => ({ ...m, sender_name: profMap[m.sender_id]?.display_name || "ユーザー", sender_avatar: profMap[m.sender_id]?.avatar_url })));
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchCommunity(); }, [communityId, user?.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleJoin = async () => {
    if (!user || !communityId) { setPage("signup"); return; }
    await supabase.from("community_members").insert({ community_id: communityId, user_id: user.id });
    setIsMember(true);
    fetchCommunity();
  };

  const handleLeave = async () => {
    if (!user || !communityId) return;
    if (!confirm("このコミュニティから退出しますか？")) return;
    await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", user.id);
    setIsMember(false);
    setMessages([]);
  };

  const handleReport = async (reason:string, detail:string) => {
    if (!user || !reportTarget) return;
    const { error } = await supabase.from("community_message_reports").insert({
      message_id: reportTarget.id, reporter_id: user.id, reason, detail,
    });
    if (error) {
      if (error.code === "23505") {
        alert("このメッセージは既に通報済みです");
      } else {
        alert("通報に失敗しました: " + error.message);
      }
    } else {
      alert("通報を受け付けました。運営が確認します。");
      setReportedIds(prev => new Set(prev).add(reportTarget.id));
    }
    setReportTarget(null);
  };

  const handleSend = async () => {
    if (!input.trim() || !user || !communityId || sending) return;

    // NGワード検出（暴言・誹謗中傷など）
    const ng = detectNGWords(input);
    if (ng.found) {
      setNgError(ng.words);
      return;
    }

    const detection = detectContacts(input);
    if (detection.found) {
      if (warning && warning.original === input) {
        setSending(true);
        await supabase.from("community_messages").insert({
          community_id: communityId, sender_id: user.id, content: warning.masked, has_warning: true,
        });
        setInput(""); setWarning(null);
        await fetchCommunity();
        setSending(false);
        return;
      }
      setWarning({ types: detection.types, original: input, masked: detection.masked });
      return;
    }
    setSending(true);
    await supabase.from("community_messages").insert({
      community_id: communityId, sender_id: user.id, content: input, has_warning: false,
    });
    setInput(""); setWarning(null);
    await fetchCommunity();
    setSending(false);
  };

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.warmGray }}>読み込み中...</div>;
  if (!community) return <div style={{ padding:40, textAlign:"center", color:C.warmGray }}>コミュニティが見つかりません</div>;

  const pinnedMsg = `📌 ようこそ「${community.name}」へ！\nイベント開催の方は「イベント」ページから投稿をお願いします。\nQocca内の商品紹介はOK！外部サイト誘導・個人連絡先交換は禁止です。`;

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, padding: isPC ? 0 : "60px 0 80px", maxWidth: 800, margin:"0 auto" }}>
      {/* ヘッダー */}
      <div style={{ background:`linear-gradient(135deg, ${C.dark}, ${C.darkBrown})`, padding: isPC ? "24px 28px" : "16px", borderRadius: isPC ? 16 : 0, marginBottom:0, color:C.white, display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={()=>navigate("/communities")} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:8, width:32, height:32, color:"#fff", fontSize:16, cursor:"pointer", flexShrink:0 }}>←</button>
        <div style={{ width:48, height:48, borderRadius:12, background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>{community.icon || "🐾"}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ fontSize:16, fontWeight:900, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{community.name}</div>
            {community.is_official && <span style={{ fontSize:9, padding:"1px 6px", borderRadius:4, background:C.orange, color:"#fff", fontWeight:800 }}>公式</span>}
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)" }}>{community.category} · 👥 {community.member_count || 0}人</div>
        </div>
        {isMember && (
          <button onClick={handleLeave} style={{ padding:"6px 12px", background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:14, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>退出</button>
        )}
      </div>

      {community.description && (
        <div style={{ background:C.white, padding:"12px 16px", borderBottom:`1px solid ${C.border}`, fontSize:12, color:"#555", lineHeight:1.6 }}>{community.description}</div>
      )}

      {!isMember ? (
        <div style={{ padding:"40px 20px", textAlign:"center", background:C.white, borderRadius: isPC ? 16 : 0, marginTop: isPC ? 12 : 0 }}>
          <div style={{ fontSize:14, color:C.warmGray, marginBottom:14 }}>このコミュニティに参加するとチャットに参加できます</div>
          <button onClick={handleJoin} style={{ padding:"12px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>+ 参加する</button>
        </div>
      ) : (
        <>
          {/* ピン留め固定メッセージ */}
          <div style={{ background:"#FFF8E1", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, fontSize:11, color:"#996200", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{pinnedMsg}</div>

          {/* メッセージ一覧 */}
          <div style={{ padding:"16px", minHeight:300, maxHeight: isPC ? 500 : "60vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:12, background:"#FAFAF8" }}>
            {messages.length === 0 ? (
              <div style={{ textAlign:"center", color:C.warmGray, fontSize:12, padding:"30px 0" }}>まだメッセージがありません<br/>最初のメッセージを送ってみましょう</div>
            ) : messages.map(m => (
              <div key={m.id} style={{ display:"flex", justifyContent: m.sender_id === user?.id ? "flex-end" : "flex-start", gap:8 }}>
                {m.sender_id !== user?.id && (
                  <div onClick={()=>setPage(`user/${m.sender_id}`)} style={{ width:32, height:32, borderRadius:"50%", background: m.sender_avatar ? `url(${m.sender_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:C.orange, flexShrink:0, cursor:"pointer" }}>{!m.sender_avatar && (m.sender_name||"?").charAt(0).toUpperCase()}</div>
                )}
                <div style={{ maxWidth:"75%" }}>
                  {m.sender_id !== user?.id && <div style={{ fontSize:10, color:C.warmGray, marginBottom:2, marginLeft:2 }}>{m.sender_name}</div>}
                  <div style={{
                    padding:"10px 14px", borderRadius:14,
                    background: m.sender_id === user?.id ? C.orange : C.white,
                    color: m.sender_id === user?.id ? "#fff" : C.dark,
                    border: m.sender_id !== user?.id ? `1px solid ${C.border}` : "none",
                    borderBottomRightRadius: m.sender_id === user?.id ? 4 : 14,
                    borderBottomLeftRadius: m.sender_id === user?.id ? 14 : 4,
                    position:"relative",
                  }}>
                    <div style={{ fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.content}</div>
                    <div style={{ fontSize:9, marginTop:4, opacity:0.5, textAlign:"right" }}>{new Date(m.created_at).toLocaleString("ja-JP", { hour:"2-digit", minute:"2-digit", month:"numeric", day:"numeric" })}</div>
                  </div>
                  {m.sender_id !== user?.id && (
                    <div style={{ marginTop:2, marginLeft:2 }}>
                      {reportedIds.has(m.id) ? (
                        <span style={{ fontSize:10, color:C.warmGray }}>✓ 通報済み</span>
                      ) : (
                        <button onClick={()=>setReportTarget(m)} style={{ background:"none", border:"none", color:C.warmGray, fontSize:10, cursor:"pointer", padding:"2px 0", fontFamily:"inherit", textDecoration:"underline" }}>⚠️ 通報</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>

          {/* NGワード警告（送信ブロック） */}
          {ngError && (
            <div style={{ padding:"12px 16px", background:"#FFCDD2", borderTop:`1px solid #E57373` }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#B71C1C", marginBottom:6 }}>🚫 不適切な表現が含まれています</div>
              <div style={{ fontSize:11, color:"#666", marginBottom:8, lineHeight:1.5 }}>暴言・誹謗中傷・差別的な発言はコミュニティガイドラインに違反します。表現を変更してください。</div>
              <button onClick={()=>setNgError(null)} style={{ width:"100%", padding:"8px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.dark }}>修正する</button>
            </div>
          )}

          {/* 警告 */}
          {warning && (
            <div style={{ padding:"12px 16px", background:"#FFE5E5", borderTop:`1px solid #FFB3B3` }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#C62828", marginBottom:6 }}>⚠️ 連絡先・外部誘導が含まれています ({warning.types.join(", ")})</div>
              <div style={{ fontSize:11, color:"#666", marginBottom:8, lineHeight:1.5 }}>コミュニティでの個人連絡先交換は禁止です。<br/>取引はQocca内で完結してください。</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setWarning(null)} style={{ flex:1, padding:"8px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.dark }}>修正する</button>
                <button onClick={handleSend} style={{ flex:1, padding:"8px", background:"#FFB3B3", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>***でマスク送信</button>
              </div>
            </div>
          )}

          {/* 入力欄 */}
          <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8, background:C.white }}>
            <input
              value={input}
              onChange={e=>{setInput(e.target.value); if (warning) setWarning(null); if (ngError) setNgError(null);}}
              onKeyDown={e=>{ if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); handleSend(); } }}
              placeholder="メッセージを入力..."
              disabled={sending}
              style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            <button onClick={handleSend} disabled={!input.trim() || sending} style={{ padding:"10px 16px", background: !input.trim() || sending ? "#ccc" : C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:13, cursor: !input.trim() || sending ? "not-allowed" : "pointer", fontFamily:"inherit" }}>{sending ? "..." : "送信"}</button>
          </div>
        </>
      )}
      {reportTarget && <ReportMessageModal target={reportTarget} onClose={()=>setReportTarget(null)} onReport={handleReport}/>}
    </div>
  );
};

// ── 通報モーダル ──────────────────────────────────────────────────────────
const ReportMessageModal = ({ target, onClose, onReport }: { target:any; onClose:()=>void; onReport:(reason:string, detail:string)=>void }) => {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const REASONS = [
    { id: "harassment", label: "暴言・誹謗中傷" },
    { id: "spam", label: "スパム・宣伝" },
    { id: "external", label: "外部誘導・連絡先交換" },
    { id: "inappropriate", label: "不適切な内容" },
    { id: "fraud", label: "詐欺・なりすまし" },
    { id: "other", label: "その他" },
  ];
  const handleSubmit = () => {
    if (!reason) return;
    onReport(reason, detail);
  };
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white, borderRadius:20, padding:"24px 20px", width:"100%", maxWidth:440, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:17, fontWeight:900, color:C.dark }}>⚠️ メッセージを通報</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.warmGray }}>×</button>
        </div>
        <div style={{ background:C.lightGray, borderRadius:10, padding:"10px 12px", marginBottom:16, fontSize:12, color:"#555", lineHeight:1.5, maxHeight:120, overflowY:"auto" }}>
          {target.content}
        </div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:8 }}>通報の理由 <span style={{ color:C.orange }}>*</span></div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
          {REASONS.map(r => (
            <button key={r.id} onClick={()=>setReason(r.id)} style={{ padding:"10px 12px", background: reason === r.id ? C.orangePale : C.white, border: reason === r.id ? `1.5px solid ${C.orange}` : `1.5px solid ${C.border}`, borderRadius:10, fontSize:13, fontWeight:700, color: reason === r.id ? C.orange : C.dark, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>{r.label}</button>
          ))}
        </div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:6 }}>詳細（任意）</div>
        <textarea value={detail} onChange={e=>setDetail(e.target.value)} maxLength={300} placeholder="状況を詳しく教えてください" style={{ width:"100%", minHeight:70, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", boxSizing:"border-box", marginBottom:6, outline:"none", resize:"vertical" }}/>
        <div style={{ fontSize:11, color:C.gray, textAlign:"right", marginBottom:14 }}>{detail.length}/300</div>
        <div style={{ background:"#FFF8E1", borderRadius:8, padding:"10px 12px", marginBottom:14, fontSize:11, color:"#996200", lineHeight:1.5 }}>
          📌 通報内容は運営が確認します。同じメッセージが3人以上から通報されると自動的に非表示になります。虚偽の通報は禁止です。
        </div>
        <button onClick={handleSubmit} disabled={!reason} style={{ width:"100%", padding:"14px", background: !reason ? "#ccc" : "#E57373", border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor: !reason ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
          通報する
        </button>
      </div>
    </div>
  );
};


// ── PC用バナー ────────────────────────────────────────────────────────────
const PCBanner = ({ setPage }) => (
  <div style={{
    background:`linear-gradient(135deg, ${C.orange}, ${C.orangeLight})`,
    borderRadius:20, padding:"32px 36px", position:"relative", overflow:"hidden",
    display:"flex", alignItems:"center", justifyContent:"space-between",
    marginTop:32, marginBottom:8
  }}>
    <div style={{ position:"absolute", right:-10, top:-10, fontSize:120, opacity:0.1, pointerEvents:"none" }}>🐾</div>
    <div style={{ position:"relative", zIndex:1 }}>
      <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.8)", marginBottom:4 }}>CREATOR WANTED</div>
      <h3 style={{ fontSize:22, fontWeight:900, color:"#fff", lineHeight:1.3 }}>あなたのスキルをペット好きに届けよう</h3>
      <p style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:6 }}>初回出品は手数料0%！購入者は表示価格のみ</p>
    </div>
    <button onClick={()=>setPage("sell")} style={{ padding:"12px 28px", background:"#fff", border:"none", borderRadius:12, color:C.orange, fontWeight:800, fontSize:14, cursor:"pointer", flexShrink:0, position:"relative", zIndex:1 }}>🐾 無料で出品を始める</button>
  </div>
);

// ── APP ────────────────────────────────────────────────────────────────────
// ── Navigation Helper ─────────────────────────────────────────────────────
const useNav = () => {
  const navigate = useNavigate();
  const setPage = (page, data) => {
    if (page === "detail" && data) {
      navigate(`/listing/${data.id}`, { state: { item: data } });
    } else if (page === "home") navigate("/");
    else if (page === "search") navigate("/search");
    else if (page === "sell") navigate("/sell");
    else if (page === "signup") navigate("/login");
    else if (page === "mypage") navigate("/mypage");
    else if (page === "liked") navigate("/favorites");
    else if (page === "events") navigate("/events");
    else if (page === "gallery") navigate("/gallery");
    else if (typeof page === "string" && page.startsWith("gallery/")) navigate("/" + page);
    else if (page === "facilities") navigate("/facilities");
    else if (page === "blog") navigate("/blog");
    else if (typeof page === "string" && page.startsWith("blog/")) navigate("/" + page);
    else if (page === "communities") navigate("/communities");
    else if (typeof page === "string" && page.startsWith("community/")) navigate("/" + page);
    else if (page === "tokusho") navigate("/tokusho");
    else if (page === "terms") navigate("/terms");
    else if (page === "privacy") navigate("/privacy");
    else if (page === "contact") navigate("/contact");
    else if (page === "terms") navigate("/terms");
    else if (page === "privacy") navigate("/privacy");
    else if (page === "tokusho") navigate("/tokusho");
    else if (page === "contact") navigate("/contact");
    else navigate("/" + page);
  };
  return { setPage, navigate };
};

// ── Detail Page Wrapper (gets item from state or fetches from DB) ────────
const DetailPageWrapper = ({ listings, liked, onLike }) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setPage } = useNav();
  const [item, setItem] = useState(location.state?.item || null);

  useEffect(() => {
    if (!item && id) {
      const found = listings.find(l => l.id === id);
      if (found) setItem(found);
    }
  }, [id, listings]);

  if (!item) return (
    <div style={{ paddingTop:80, textAlign:"center", color:C.warmGray }}>
      <div style={{ fontSize:40, marginBottom:8 }}>🔍</div>
      <div>読み込み中...</div>
    </div>
  );

  return <DetailPage item={item} onBack={() => navigate(-1)} liked={liked[item?.id]} onLike={onLike} setPage={setPage}/>;
};

// ── APP ────────────────────────────────────────────────────────────────────
function QoccaAppInner() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const isPC = useIsPC();
  const { user, loading } = useAuth();
  const { setPage } = useNav();
  const location = useLocation();

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
      const { data } = await supabase.from("events").select("*").eq("status","approved").gte("event_date", new Date().toISOString().slice(0,10)).order("event_date",{ascending:true}).limit(3);
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
            <Route path="/terms" element={<TermsPage setPage={setPage} isPC={true}/>} />
            <Route path="/privacy" element={<PrivacyPage setPage={setPage} isPC={true}/>} />
            <Route path="/contact" element={<ContactPage setPage={setPage} isPC={true}/>} />
            {/* 新 PC版 Route (Phase 1.5 リニューアル) - HomePage に統一 */}
            <Route path="/" element={<HomePage setPage={setPage} listings={listings} liked={liked} onLike={onLike} onDetail={onDetail}/>}/>
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
            <Route path="/user/:userId" element={
            <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
              <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
              <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                <UserProfilePage setPage={setPage}/>
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
            <Route path="/help" element={<HelpPage/>}/>
            <Route path="/help/:slug" element={<HelpPage/>}/>
          </Routes>
          <SharedFooter setPage={setPage}/>
        </div>
      ) : (
        <>
          <Routes>
            <Route path="/" element={<HomePage setPage={setPage} listings={listings} liked={liked} onLike={onLike} onDetail={onDetail}/>}/>
            <Route path="/about" element={<AboutPage />} />
            <Route path="/tokusho" element={<TokushoPage setPage={setPage} isPC={false}/>} />
            <Route path="/terms" element={<TermsPage setPage={setPage} isPC={false}/>} />
            <Route path="/privacy" element={<PrivacyPage setPage={setPage} isPC={false}/>} />
            <Route path="/contact" element={<ContactPage setPage={setPage} isPC={false}/>} />
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
            <Route path="/admin" element={<AdminDashboard/>}/>
            <Route path="/help" element={<HelpPage/>}/>
            <Route path="/help/:slug" element={<HelpPage/>}/>
            <Route path="/user/:userId" element={<UserProfilePage setPage={setPage}/>}/>
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
