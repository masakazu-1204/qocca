// 葉UI部品集 (App.tsx 分割 Phase 4-b)
// Logo / Stars / Tag / Card / UserMenu / Sidebar / PCNavbar / Navbar /
// OrderStatusBar / SharedFooter / TabBar / PCBanner
// 相互依存 (Navbar→Logo/UserMenu, Card→Tag/Stars 等) は同一ファイル内で完結=循環import無し。
// ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。

import { useState, useEffect, useRef } from "react";
import { C, QC_FONT_DISPLAY } from "../constants/theme";
import { ORDER_STEPS } from "../constants/data";
import { resolveFontFamily } from "../constants/fonts";
import { stepIndex } from "../utils/format";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabaseClient";

// ── Logo ─────────────────────────────────────────────────────────────────
export const Logo = ({ size = 32 }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flexShrink:0 }}>
    <img src="/logo.png" width={size*1.5} height={size*1.5} style={{ objectFit:"contain" }} alt="Qocca"/>
    <span style={{ fontSize:size*0.78, fontWeight:700, color:C.orange, letterSpacing:"0.02em", fontFamily:QC_FONT_DISPLAY }}>Qocca</span>
  </div>
);

export const Stars = ({ rating, size=12 }) => (
  <span style={{ color:C.orange, fontSize:size }}>{"★".repeat(Math.round(rating))}{"☆".repeat(5-Math.round(rating))}</span>
);

export const Tag = ({ text }) => (
  <span style={{ background:C.orangePale, color:C.orange, border:`1px solid ${C.orange}`, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>{text}</span>
);

export const Card = ({ item, onClick, liked, onLike }) => (
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
        <span style={{ fontSize:15, fontWeight:700, color:C.dark }}>¥{item.price?.toLocaleString()}</span>
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

// ── User Menu (ログイン後のアイコンメニュー) ──────────────────────────────
export const UserMenu = ({ setPage }) => {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; bio?: string; created_at?: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio, created_at, font_display_name")
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
            <div style={{ fontSize:14, fontWeight:800, color:C.dark, fontFamily: resolveFontFamily(profile?.font_display_name) }}>{displayName}</div>
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

// ── PC用サイドバー (v3.1 準拠 3層構造) ───────────────────────────────────
// 既存呼び出し側との互換性のため activeCat / setActiveCat props は受け取るが未使用
export const Sidebar = ({ setPage, activeCat: _activeCat, setActiveCat: _setActiveCat }: any) => {
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
        { key: "petgallery",  icon: "🏡", label: "うちの子たち",    onClick: () => setPage("petgallery") },
        { key: "communities", icon: "💬", label: "広場",            onClick: () => setPage("communities") },
        { key: "events",      icon: "📅", label: "イベント",        onClick: () => setPage("events") },
        { key: "facilities",  icon: "🐕", label: "地図",            onClick: () => setPage("facilities") },
        { key: "petwalker",   icon: "🧭", label: "おでかけ",        onClick: () => setPage("petwalker") },
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

// ── PC用ナビバー ───────────────────────────────────────────────────────────
export const PCNavbar = ({ setPage, liked, search, setSearch }) => {
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
      {/* 依頼書 #134 Phase 2 後追い (2026/6/6): 中間幅 (~960px) で折り返す問題を nowrap + clamp gap で解消 */}
      <div style={{ display:"flex", alignItems:"center", gap:"clamp(6px, 1.2vw, 16px)", marginLeft:"auto", flexWrap:"nowrap", minWidth:0 }}>
        {[["home","ホーム"],["search","さがす"],["events","イベント"],["gallery","ギャラリー"],["petwalker","おでかけ"],["liked","お気に入り"]].map(([id,label])=>(
          <button key={id} onClick={()=>setPage(id)} style={{
            background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
            fontSize:14, fontWeight:700, color:C.dark, padding:"4px clamp(4px, 0.6vw, 8px)",
            whiteSpace:"nowrap", flexShrink:0
          }}>{label}</button>
        ))}
        <button onClick={()=>setPage("sell")} style={{
          padding:"9px clamp(12px, 1.6vw, 20px)", background:C.orange, border:"none", borderRadius:10,
          color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit",
          whiteSpace:"nowrap", flexShrink:0
        }}>出品する</button>
        {user ? (
          <UserMenu setPage={setPage}/>
        ) : (
          <button onClick={()=>setPage("signup")} style={{
            padding:"9px clamp(12px, 1.6vw, 20px)", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:10,
            color:C.dark, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit",
            whiteSpace:"nowrap", flexShrink:0
          }}>ログイン</button>
        )}
      </div>
    </nav>
  );
};

// ── Mobile Navbar (v3.1 準拠 3層構造、PC Sidebar と統一) ──────────────────
export const Navbar = ({ setPage, liked: _liked, search, setSearch }: any) => {
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
        { key: "petgallery",  icon: "🏡", label: "うちの子たち",    onClick: () => navigate("petgallery") },
        { key: "communities", icon: "💬", label: "広場",            onClick: () => navigate("communities") },
        { key: "events",      icon: "📅", label: "イベント",        onClick: () => navigate("events") },
        { key: "facilities",  icon: "🐕", label: "地図",            onClick: () => navigate("facilities") },
        { key: "petwalker",   icon: "🧭", label: "おでかけ",        onClick: () => navigate("petwalker") },
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

export const OrderStatusBar = ({ status }) => {
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

export const SharedFooter = ({ setPage }) => (
  <footer style={{ background:"#0D0A05", padding:"24px 16px" }}>
    <Logo size={24}/>
    <div style={{ display:"flex", flexWrap:"wrap", gap:16, marginTop:16 }}>
      {[["help","ヘルプ"],["faq","FAQ"],["terms","利用規約"],["privacy","プライバシー"],["tokusho","特定商取引法"],["contact","お問い合わせ"]].map(([id,l])=>(
        <span key={id} onClick={()=>setPage(id)} style={{ fontSize:11, color:"rgba(255,255,255,0.3)", cursor:"pointer" }}>{l}</span>
      ))}
    </div>
    <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:12 }}>© 2026 Qocca Inc.</div>
  </footer>
);

// ── Bottom Tab Bar (Mobile) ───────────────────────────────────────────────
export const TabBar = ({ page, setPage }) => {
  const { user } = useAuth();
  const tabs = [
    { id:"home", icon:"🏠", label:"ホーム" },
    { id:"communities", icon:"💬", label:"コミュニティ" },
    { id:"sell", icon:"➕", label:"" },
    { id:"events", icon:"📅", label:"イベント" },
    { id:"petwalker", icon:"🧭", label:"おでかけ" },
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

export const PCBanner = ({ setPage }) => (
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
