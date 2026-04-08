import { useState, useEffect, useRef } from "react";

// ── Brand ────────────────────────────────────────────────────────────────────
const C = {
  orange: "#F5A94A", orangeLight: "#FAC97A", orangePale: "#FFF3E0",
  orangeDeep: "#E8903A", cream: "#FAFAF7", dark: "#1A1208",
  darkBrown: "#2D1F0A", warmGray: "#9E9B95", lightGray: "#F5F3F0",
  border: "#EDE9E3", white: "#FFFFFF", green: "#4CAF50",
};

// ── Data ─────────────────────────────────────────────────────────────────────
const CATS = [
  { id:"all", icon:"🐾", label:"すべて" },
  { id:"illust", icon:"🎨", label:"似顔絵・イラスト" },
  { id:"clothes", icon:"👕", label:"ハンドメイド服" },
  { id:"photo", icon:"📸", label:"フォト撮影" },
  { id:"goods", icon:"✨", label:"グッズ制作" },
  { id:"food", icon:"🍖", label:"手作りフード" },
  { id:"training", icon:"🐕", label:"しつけ相談" },
];

const LISTINGS = [
  { id:1, title:"愛犬の水彩似顔絵", seller:"みかん工房", sellerIcon:"🎨", price:3800, rating:4.9, reviews:128, tag:"人気", category:"illust", emoji:"🎨", pet:"dog", desc:"大切なわんちゃんの特徴を丁寧に捉えた水彩画。A4サイズ・データ納品も可能です。注文後にお写真をお送りください。通常3〜5日で納品いたします。", delivery:"5日以内", bg:"#FFF3E0" },
  { id:2, title:"猫ちゃん専用ニット服", seller:"てづくり屋さん", sellerIcon:"🧶", price:5200, rating:4.8, reviews:64, tag:"新着", category:"clothes", emoji:"🧶", pet:"cat", desc:"猫ちゃんのサイズに合わせてオーダーメイドで制作します。素材は柔らかいウール混です。首回り・胴回り・着丈をお知らせください。", delivery:"2週間以内", bg:"#F3E5F5" },
  { id:3, title:"ペットの記念日フォト", seller:"ぽちフォト", sellerIcon:"📸", price:12000, rating:5.0, reviews:42, tag:"人気", category:"photo", emoji:"📸", pet:"dog", desc:"出張撮影対応。大切な記念日を最高の一枚に残します。データ50枚以上お渡し。東京・神奈川エリア対応。", delivery:"要相談", bg:"#E3F2FD" },
  { id:4, title:"アクリルキーホルダー", seller:"クリエイトパレット", sellerIcon:"✨", price:2200, rating:4.7, reviews:93, tag:"", category:"goods", emoji:"✨", pet:"both", desc:"写真からデザインしたオリジナルキーホルダー。名前入れも対応します。両面印刷・カラビナ付き。", delivery:"1週間以内", bg:"#E8F5E9" },
  { id:5, title:"デジタル似顔絵（即日）", seller:"イラスト工房ハル", sellerIcon:"💻", price:1500, rating:4.6, reviews:211, tag:"即日", category:"illust", emoji:"💻", pet:"both", desc:"注文当日に納品します。SNSアイコンや年賀状にも最適です。高解像度PNGデータ納品。", delivery:"即日", bg:"#FFF8E1" },
  { id:6, title:"犬用バースデーケーキ", seller:"わんこベーカリー", sellerIcon:"🎂", price:4800, rating:4.9, reviews:55, tag:"新着", category:"food", emoji:"🎂", pet:"dog", desc:"犬が食べても安心な素材だけで作るバースデーケーキ。写真付きメッセージカード付き。サイズS/M/Lから選択可。", delivery:"3日前要注文", bg:"#FCE4EC" },
  { id:7, title:"猫の刺繍ポーチ", seller:"ぬい工房まり", sellerIcon:"🪡", price:3200, rating:4.8, reviews:37, tag:"", category:"goods", emoji:"🪡", pet:"cat", desc:"うちの子の顔を刺繍したオリジナルポーチ。プレゼントにも喜ばれます。写真をお送りいただければデザインします。", delivery:"10日以内", bg:"#E8EAF6" },
  { id:8, title:"しつけ個別相談60分", seller:"ドッグトレーナー山本", sellerIcon:"🎓", price:6000, rating:4.9, reviews:89, tag:"人気", category:"training", emoji:"🎓", pet:"dog", desc:"プロトレーナーによるオンライン相談。吠え・噛み・トイレトラブルなど何でも。Zoom使用、録画データもお渡しします。", delivery:"3日以内", bg:"#E0F7FA" },
  { id:9, title:"猫用おもちゃセット", seller:"ねこてぃ", sellerIcon:"🐱", price:2800, rating:4.7, reviews:61, tag:"", category:"goods", emoji:"🐱", pet:"cat", desc:"猫が夢中になる手作りおもちゃ5点セット。天然素材のみ使用。猫草付き。", delivery:"5日以内", bg:"#FFF3E0" },
  { id:10, title:"犬の手作りおやつ定期便", seller:"わんこベーカリー", sellerIcon:"🦴", price:3500, rating:4.8, reviews:44, tag:"", category:"food", emoji:"🦴", pet:"dog", desc:"毎月届く手作りおやつ定期便。国産・無添加素材のみ。アレルギー対応も相談可。", delivery:"毎月発送", bg:"#F9FBE7" },
  { id:11, title:"ペット用バンダナ刺繍", seller:"てづくり屋さん", sellerIcon:"🎀", price:1800, rating:4.6, reviews:28, tag:"", category:"clothes", emoji:"🎀", pet:"both", desc:"名前刺繍入りのオリジナルバンダナ。綿100%で肌に優しい。サイズS〜XL対応。", delivery:"1週間以内", bg:"#F3E5F5" },
  { id:12, title:"ペットのLINEスタンプ制作", seller:"イラスト工房ハル", sellerIcon:"💬", price:8000, rating:4.7, reviews:33, tag:"", category:"illust", emoji:"💬", pet:"both", desc:"うちの子が主役のオリジナルLINEスタンプを制作。8種類のポーズ込み。申請代行も可能。", delivery:"2週間以内", bg:"#FFF8E1" },
];

const REVIEWS = [
  { user:"ゆきさん", pet:"🐕", rating:5, comment:"本当にそっくりで感動しました！額に入れて飾ってます🥺", date:"2026.3.15" },
  { user:"まるこさん", pet:"🐈", rating:5, comment:"丁寧な対応で安心できました。また依頼したいです！", date:"2026.3.10" },
  { user:"けんたさん", pet:"🐕", rating:4, comment:"クオリティ高い！少し時間かかりましたが満足です。", date:"2026.2.28" },
];

// ── Components ───────────────────────────────────────────────────────────────
const Logo = ({ size = 32, dark = false }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="47" r="38" fill={C.orange}/>
      <ellipse cx="33" cy="27" rx="11" ry="15" fill={C.orange} transform="rotate(-20 33 27)"/>
      <ellipse cx="67" cy="27" rx="11" ry="15" fill={C.orange} transform="rotate(20 67 27)"/>
      <ellipse cx="50" cy="50" rx="26" ry="24" fill={C.cream}/>
      <ellipse cx="50" cy="52" rx="18" ry="16" fill={C.orange}/>
      <circle cx="43" cy="48" r="3.5" fill={C.cream}/>
      <circle cx="57" cy="48" r="3.5" fill={C.cream}/>
      <ellipse cx="50" cy="57" rx="4.5" ry="3.5" fill={C.cream}/>
      <path d="M46 60 Q50 64 54 60" stroke={C.cream} strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M15 72 Q50 95 85 72" stroke={C.orange} strokeWidth="8" strokeLinecap="round" fill="none"/>
    </svg>
    <span style={{ fontSize:size*0.72, fontWeight:900, color: dark ? C.dark : C.orange, letterSpacing:"-0.5px" }}>Qocca</span>
  </div>
);

const Stars = ({ rating, size=14 }) => (
  <span style={{ color:C.orange, fontSize:size }}>{"★".repeat(Math.round(rating))}{"☆".repeat(5-Math.round(rating))}</span>
);

const Tag = ({ text, color=C.orange }) => (
  <span style={{ background:color, color:"#fff", fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:10 }}>{text}</span>
);

const Btn = ({ children, onClick, variant="primary", size="md", full=false, style:s={} }) => {
  const base = { border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:800, borderRadius:12, transition:"all 0.15s", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, ...(full?{width:"100%"}:{}) };
  const sizes = { sm:{ padding:"8px 16px", fontSize:13 }, md:{ padding:"12px 24px", fontSize:15 }, lg:{ padding:"16px 36px", fontSize:17 } };
  const variants = {
    primary:{ background:C.orange, color:"#fff", boxShadow:`0 4px 14px rgba(245,169,74,0.35)` },
    secondary:{ background:C.orangePale, color:C.orange, border:`1.5px solid ${C.orange}30` },
    ghost:{ background:"transparent", color:C.warmGray, border:`1.5px solid ${C.border}` },
    dark:{ background:C.dark, color:"#fff" },
  };
  return <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...s }}>{children}</button>;
};

const Card = ({ item, onClick, liked, onLike }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={() => onClick(item)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:C.white, borderRadius:20, overflow:"hidden", cursor:"pointer", border:`1px solid ${C.border}`,
        boxShadow: hov ? "0 12px 40px rgba(245,169,74,0.15)" : "0 2px 10px rgba(0,0,0,0.04)",
        transform: hov ? "translateY(-3px)" : "none", transition:"all 0.2s" }}>
      <div style={{ height:180, background:item.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:72, position:"relative" }}>
        {item.emoji}
        {item.tag && <div style={{ position:"absolute", top:12, left:12 }}><Tag text={item.tag}/></div>}
        <button onClick={e=>{e.stopPropagation();onLike(item.id);}} style={{
          position:"absolute", top:10, right:10, width:34, height:34, borderRadius:"50%",
          background:"rgba(255,255,255,0.92)", border:"none", cursor:"pointer", fontSize:16,
          display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 6px rgba(0,0,0,0.1)"
        }}>{liked?"❤️":"🤍"}</button>
      </div>
      <div style={{ padding:"14px 16px 16px" }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.dark, lineHeight:1.4, marginBottom:6, minHeight:40 }}>{item.title}</div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
          <span style={{ fontSize:13 }}>{item.sellerIcon}</span>
          <span style={{ fontSize:12, color:C.warmGray }}>{item.seller}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:18, fontWeight:900, color:C.orange }}>¥{item.price.toLocaleString()}</span>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <Stars rating={item.rating} size={12}/>
            <span style={{ fontSize:11, color:C.warmGray }}>({item.reviews})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Navbar ────────────────────────────────────────────────────────────────────
const Navbar = ({ page, setPage, liked, search, setSearch }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav style={{
      position:"fixed", top:0, left:0, right:0, zIndex:200,
      background: scrolled ? "rgba(250,250,247,0.97)" : C.white,
      backdropFilter:"blur(12px)",
      borderBottom:`1px solid ${scrolled ? C.border : "transparent"}`,
      padding:"0 40px", height:68,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      transition:"all 0.3s", boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.06)" : "none"
    }}>
      <div onClick={()=>setPage("home")}><Logo size={30}/></div>
      {/* Search */}
      <div style={{ flex:1, maxWidth:480, margin:"0 32px", position:"relative" }}>
        <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, color:C.warmGray }}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setPage("search")}
          placeholder="似顔絵、ハンドメイド服、フォト撮影..."
          style={{ width:"100%", padding:"10px 14px 10px 40px", borderRadius:12, border:`1.5px solid ${C.border}`,
            fontSize:14, outline:"none", fontFamily:"inherit", background:C.lightGray, color:C.dark, boxSizing:"border-box" }}
        />
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <span onClick={()=>setPage("liked")} style={{ cursor:"pointer", fontSize:22, position:"relative" }}>
          🤍
          {Object.values(liked).filter(Boolean).length > 0 && (
            <span style={{ position:"absolute", top:-4, right:-4, width:16, height:16, background:C.orange, borderRadius:"50%", fontSize:9, color:"#fff", fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {Object.values(liked).filter(Boolean).length}
            </span>
          )}
        </span>
        <Btn onClick={()=>setPage("sell")} variant="secondary" size="sm">出品する</Btn>
        <Btn onClick={()=>setPage("signup")} variant="primary" size="sm">登録 / ログイン</Btn>
      </div>
    </nav>
  );
};

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
const HomePage = ({ setPage, listings, liked, onLike, onDetail }) => {
  const [activeCat, setActiveCat] = useState("all");
  const popular = listings.filter(l => l.tag === "人気").slice(0, 4);
  const newItems = listings.filter(l => l.tag === "新着").slice(0, 4);
  const filtered = activeCat === "all" ? listings : listings.filter(l => l.category === activeCat);

  return (
    <div>
      {/* Hero */}
      <section style={{
        background:`linear-gradient(145deg, ${C.dark} 0%, ${C.darkBrown} 55%, #3D2810 100%)`,
        padding:"140px 80px 80px", position:"relative", overflow:"hidden"
      }}>
        {[700,450,280].map((s,i)=>(
          <div key={i} style={{ position:"absolute", width:s, height:s, borderRadius:"50%", border:`1px solid rgba(245,169,74,${0.07-i*0.02})`, top:"50%", left:"50%", transform:"translate(-50%,-50%)" }}/>
        ))}
        <div style={{ position:"absolute", right:"8%", top:"20%", fontSize:120, opacity:0.05 }}>🐾</div>
        <div style={{ maxWidth:700, position:"relative", zIndex:1 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 16px", background:"rgba(245,169,74,0.15)", borderRadius:20, border:"1px solid rgba(245,169,74,0.3)", marginBottom:28 }}>
            <span style={{ fontSize:14 }}>🐨</span>
            <span style={{ fontSize:13, color:C.orange, fontWeight:700 }}>ペットオーナー専門マーケット — 出品者募集中</span>
          </div>
          <h1 style={{ fontSize:64, fontWeight:900, color:C.white, lineHeight:1.1, marginBottom:20, letterSpacing:"-2px" }}>
            うちの子のための<br/><span style={{ color:C.orange }}>特別なもの</span>を。
          </h1>
          <p style={{ fontSize:18, color:"rgba(255,255,255,0.6)", lineHeight:1.8, marginBottom:36, maxWidth:540 }}>
            似顔絵・ハンドメイド服・フォト撮影・グッズ制作。ペット専門クリエイターが作る、世界にひとつだけの作品。
          </p>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
            <Btn onClick={()=>setPage("search")} variant="primary" size="lg">🔍 サービスを探す</Btn>
            <Btn onClick={()=>setPage("sell")} size="lg" style={{ background:"rgba(255,255,255,0.1)", color:"#fff", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12 }}>出品者になる →</Btn>
          </div>
          <div style={{ display:"flex", gap:28, marginTop:28 }}>
            {[["1,200+","出品サービス"],["8,400+","オーナー登録"],["4.8","平均評価"]].map(([v,l])=>(
              <div key={l}>
                <div style={{ fontSize:24, fontWeight:900, color:C.orange }}>{v}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Floating cards */}
        <div style={{ position:"absolute", right:"6%", top:"28%", background:"rgba(255,255,255,0.07)", backdropFilter:"blur(10px)", borderRadius:18, padding:"16px 20px", border:"1px solid rgba(255,255,255,0.1)", animation:"float1 4s ease-in-out infinite" }}>
          <div style={{ fontSize:28, marginBottom:6 }}>🎨</div>
          <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>新規注文！</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>愛犬の似顔絵 ¥3,800</div>
        </div>
        <div style={{ position:"absolute", right:"18%", bottom:"15%", background:"rgba(255,255,255,0.07)", backdropFilter:"blur(10px)", borderRadius:18, padding:"16px 20px", border:"1px solid rgba(255,255,255,0.1)", animation:"float2 5s ease-in-out infinite" }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginBottom:2 }}>⭐ 5つ星レビュー</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.orange }}>"本当にそっくり！感動"</div>
        </div>
      </section>

      {/* Categories */}
      <section style={{ padding:"60px 80px 0", background:C.cream }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <h2 style={{ fontSize:32, fontWeight:900, color:C.dark, marginBottom:28 }}>カテゴリから探す</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:12 }}>
            {CATS.map(c=>(
              <div key={c.id} onClick={()=>{setActiveCat(c.id); setPage("search");}}
                style={{ background:C.white, borderRadius:16, padding:"20px 12px", textAlign:"center", cursor:"pointer", border:`1.5px solid ${activeCat===c.id?C.orange:C.border}`, transition:"all 0.2s" }}
              >
                <div style={{ fontSize:32, marginBottom:8 }}>{c.icon}</div>
                <div style={{ fontSize:12, fontWeight:700, color:C.dark, lineHeight:1.3 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular */}
      <section style={{ padding:"60px 80px", background:C.cream }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
            <h2 style={{ fontSize:28, fontWeight:900, color:C.dark }}>🔥 人気のサービス</h2>
            <Btn onClick={()=>setPage("search")} variant="ghost" size="sm">すべて見る →</Btn>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 }}>
            {popular.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
          </div>
        </div>
      </section>

      {/* Banner */}
      <section style={{ padding:"0 80px 60px", background:C.cream }}>
        <div style={{ maxWidth:1200, margin:"0 auto", background:`linear-gradient(135deg, ${C.orange}, ${C.orangeLight})`, borderRadius:28, padding:"48px 60px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", right:-30, top:-30, fontSize:160, opacity:0.1 }}>🐾</div>
          <div style={{ zIndex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.8)", marginBottom:8, letterSpacing:"0.1em" }}>CREATOR WANTED</div>
            <h3 style={{ fontSize:36, fontWeight:900, color:"#fff", marginBottom:12, lineHeight:1.2 }}>あなたのスキルを<br/>ペット好きに届けよう</h3>
            <p style={{ color:"rgba(255,255,255,0.8)", fontSize:15, marginBottom:24 }}>先着100名は手数料5%の特別優遇。今すぐ登録を。</p>
            <Btn onClick={()=>setPage("sell")} size="lg" style={{ background:"#fff", color:C.orange, borderRadius:14 }}>🐾 無料で出品を始める</Btn>
          </div>
        </div>
      </section>

      {/* New */}
      <section style={{ padding:"0 80px 60px", background:C.cream }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
            <h2 style={{ fontSize:28, fontWeight:900, color:C.dark }}>🆕 新着サービス</h2>
            <Btn onClick={()=>setPage("search")} variant="ghost" size="sm">すべて見る →</Btn>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 }}>
            {newItems.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding:"80px", background:C.dark }}>
        <div style={{ maxWidth:1000, margin:"0 auto", textAlign:"center" }}>
          <h2 style={{ fontSize:36, fontWeight:900, color:C.white, marginBottom:8 }}>使い方はかんたん</h2>
          <p style={{ color:"rgba(255,255,255,0.5)", marginBottom:52, fontSize:16 }}>3ステップでうちの子のための特別な作品を</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:32 }}>
            {[
              { step:"01", icon:"🔍", title:"サービスを探す", desc:"カテゴリやキーワードで検索。似顔絵・服・フォトなどペット専門クリエイターが揃っています。" },
              { step:"02", icon:"💬", title:"クリエイターに依頼", desc:"気に入ったクリエイターにメッセージ。詳細を相談してからオーダー。安心のエスクロー決済。" },
              { step:"03", icon:"🎁", title:"作品を受け取る", desc:"完成した作品を受け取ったら取引完了。レビューを書いてクリエイターを応援しよう。" },
            ].map(s=>(
              <div key={s.step} style={{ textAlign:"center" }}>
                <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:72, height:72, borderRadius:"50%", background:`${C.orange}20`, border:`1px solid ${C.orange}40`, fontSize:36, marginBottom:20 }}>{s.icon}</div>
                <div style={{ fontSize:11, fontWeight:800, color:C.orange, letterSpacing:"0.15em", marginBottom:8 }}>STEP {s.step}</div>
                <div style={{ fontSize:18, fontWeight:800, color:C.white, marginBottom:10 }}>{s.title}</div>
                <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background:"#0D0A05", padding:"40px 80px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:20 }}>
        <Logo size={28}/>
        <div style={{ display:"flex", gap:28, flexWrap:"wrap" }}>
          {["利用規約","プライバシーポリシー","特定商取引法","お問い合わせ","会社概要"].map(l=>(
            <span key={l} style={{ fontSize:12, color:"rgba(255,255,255,0.3)", cursor:"pointer" }}>{l}</span>
          ))}
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.2)" }}>© 2026 Qocca Inc.</div>
      </footer>
    </div>
  );
};

// ── SEARCH PAGE ───────────────────────────────────────────────────────────────
const SearchPage = ({ listings, liked, onLike, onDetail, search, setSearch }) => {
  const [cat, setCat] = useState("all");
  const [pet, setPet] = useState("all");
  const [sort, setSort] = useState("popular");
  const [priceMax, setPriceMax] = useState(30000);

  let results = listings.filter(l => {
    if (cat !== "all" && l.category !== cat) return false;
    if (pet !== "all" && l.pet !== pet && l.pet !== "both") return false;
    if (l.price > priceMax) return false;
    if (search && !l.title.includes(search) && !l.seller.includes(search) && !l.desc.includes(search)) return false;
    return true;
  });
  if (sort === "popular") results = [...results].sort((a,b) => b.reviews - a.reviews);
  if (sort === "cheap") results = [...results].sort((a,b) => a.price - b.price);
  if (sort === "rating") results = [...results].sort((a,b) => b.rating - a.rating);

  return (
    <div style={{ display:"flex", minHeight:"100vh", paddingTop:68 }}>
      {/* Sidebar */}
      <aside style={{ width:240, flexShrink:0, borderRight:`1px solid ${C.border}`, padding:"28px 24px", background:C.white, position:"sticky", top:68, height:"calc(100vh - 68px)", overflowY:"auto" }}>
        <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:16 }}>カテゴリ</div>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 12px",
            background: cat===c.id ? C.orangePale : "transparent",
            border:"none", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
            color: cat===c.id ? C.orange : C.warmGray, fontWeight: cat===c.id ? 800 : 600, fontSize:13,
            marginBottom:2
          }}><span>{c.icon}</span>{c.label}</button>
        ))}

        <div style={{ borderTop:`1px solid ${C.border}`, marginTop:20, paddingTop:20 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:12 }}>ペットの種類</div>
          {[["all","🐾 すべて"],["dog","🐕 犬"],["cat","🐈 猫"],["both","🐾 両対応"]].map(([v,l])=>(
            <button key={v} onClick={()=>setPet(v)} style={{
              display:"block", width:"100%", padding:"8px 12px",
              background: pet===v ? C.orangePale : "transparent",
              border:"none", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
              color: pet===v ? C.orange : C.warmGray, fontWeight: pet===v ? 800 : 600,
              fontSize:13, textAlign:"left", marginBottom:2
            }}>{l}</button>
          ))}
        </div>

        <div style={{ borderTop:`1px solid ${C.border}`, marginTop:20, paddingTop:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:14, fontWeight:800, color:C.dark }}>価格上限</span>
            <span style={{ fontSize:14, fontWeight:800, color:C.orange }}>¥{priceMax.toLocaleString()}</span>
          </div>
          <input type="range" min={500} max={30000} step={500} value={priceMax} onChange={e=>setPriceMax(Number(e.target.value))}
            style={{ width:"100%", accentColor:C.orange }}/>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, padding:"28px 40px", background:C.cream }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:C.dark }}>
              {search ? `「${search}」の検索結果` : cat==="all" ? "すべてのサービス" : CATS.find(c=>c.id===cat)?.label}
            </div>
            <div style={{ fontSize:13, color:C.warmGray, marginTop:2 }}>{results.length}件のサービス</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[["popular","人気順"],["rating","評価順"],["cheap","価格順"]].map(([v,l])=>(
              <button key={v} onClick={()=>setSort(v)} style={{
                padding:"7px 16px", border:`1.5px solid ${sort===v?C.orange:C.border}`,
                borderRadius:20, background: sort===v ? C.orangePale : C.white,
                color: sort===v ? C.orange : C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
              }}>{l}</button>
            ))}
          </div>
        </div>

        {results.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 20px" }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🐾</div>
            <div style={{ fontSize:20, fontWeight:800, color:C.dark, marginBottom:8 }}>見つかりませんでした</div>
            <div style={{ color:C.warmGray }}>条件を変えて検索してみてください</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
            {results.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
          </div>
        )}
      </main>
    </div>
  );
};

// ── DETAIL PAGE ───────────────────────────────────────────────────────────────
const DetailPage = ({ item, onBack, liked, onLike }) => {
  const [ordered, setOrdered] = useState(false);
  const [msg, setMsg] = useState("");
  if (!item) return null;
  return (
    <div style={{ paddingTop:68, minHeight:"100vh", background:C.cream }}>
      {/* Breadcrumb */}
      <div style={{ padding:"16px 80px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
        <span onClick={onBack} style={{ color:C.orange, cursor:"pointer", fontWeight:700, fontSize:14 }}>← 一覧に戻る</span>
      </div>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"40px 80px", display:"grid", gridTemplateColumns:"1fr 400px", gap:40 }}>
        {/* Left */}
        <div>
          <div style={{ background:item.bg, borderRadius:24, height:360, display:"flex", alignItems:"center", justifyContent:"center", fontSize:140, marginBottom:28 }}>{item.emoji}</div>
          <div style={{ display:"flex", gap:10, marginBottom:28 }}>
            {[item.emoji, "📷", "📷"].map((e,i)=>(
              <div key={i} style={{ width:80, height:80, background:item.bg, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, cursor:"pointer", border:`2px solid ${i===0?C.orange:C.border}` }}>{e}</div>
            ))}
          </div>

          <h1 style={{ fontSize:28, fontWeight:900, color:C.dark, marginBottom:12 }}>{item.title}</h1>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
            {item.tag && <Tag text={item.tag}/>}
            <Stars rating={item.rating}/>
            <span style={{ color:C.warmGray, fontSize:14 }}>{item.rating} ({item.reviews}件のレビュー)</span>
          </div>

          <div style={{ background:C.white, borderRadius:18, padding:"24px", marginBottom:20, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:10 }}>サービス詳細</div>
            <div style={{ fontSize:15, color:"#555", lineHeight:1.9 }}>{item.desc}</div>
          </div>

          <div style={{ background:C.white, borderRadius:18, padding:"24px", marginBottom:20, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:14 }}>サービス情報</div>
            {[["⏱️ 納期", item.delivery],["🐾 対象", item.pet==="dog"?"🐕 犬向け":item.pet==="cat"?"🐈 猫向け":"🐾 犬・猫両対応"],["💳 決済", "クレカ・銀行振込・PayPay"],["🔒 保証", "エスクロー決済で安心"]].map(([k,v])=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:14, color:C.warmGray }}>{k}</span>
                <span style={{ fontSize:14, fontWeight:700, color:C.dark }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Reviews */}
          <div style={{ background:C.white, borderRadius:18, padding:"24px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:16 }}>レビュー ({item.reviews}件)</div>
            {REVIEWS.map((r,i)=>(
              <div key={i} style={{ marginBottom:16, paddingBottom:16, borderBottom:i<REVIEWS.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{r.pet}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:C.dark }}>{r.user}</div>
                    <Stars rating={r.rating} size={12}/>
                  </div>
                  <span style={{ marginLeft:"auto", fontSize:12, color:C.warmGray }}>{r.date}</span>
                </div>
                <div style={{ fontSize:14, color:"#555", lineHeight:1.7 }}>{r.comment}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Order card */}
        <div>
          <div style={{ position:"sticky", top:88 }}>
            <div style={{ background:C.white, borderRadius:24, padding:"28px", border:`2px solid ${C.border}`, boxShadow:"0 8px 32px rgba(0,0,0,0.08)" }}>
              {ordered ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div style={{ fontSize:56, marginBottom:12 }}>🎉</div>
                  <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:8 }}>注文完了！</div>
                  <div style={{ fontSize:14, color:C.warmGray, lineHeight:1.7, marginBottom:20 }}>クリエイターからの連絡をお待ちください。マイページで注文状況を確認できます。</div>
                  <Btn onClick={()=>setOrdered(false)} variant="ghost" full>注文を取り消す</Btn>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:32, fontWeight:900, color:C.orange, marginBottom:4 }}>¥{item.price.toLocaleString()}</div>
                  <div style={{ fontSize:13, color:C.warmGray, marginBottom:20 }}>税込 · 手数料込み</div>
                  <Btn onClick={()=>setOrdered(true)} variant="primary" size="lg" full>🐾 注文する</Btn>
                  <button onClick={()=>onLike(item.id)} style={{ width:"100%", marginTop:10, padding:"12px", background:"transparent", border:`1.5px solid ${C.border}`, borderRadius:12, cursor:"pointer", fontSize:15, fontFamily:"inherit", fontWeight:700, color:C.warmGray }}>
                    {liked ? "❤️ お気に入り済み" : "🤍 お気に入りに追加"}
                  </button>

                  <div style={{ margin:"20px 0", borderTop:`1px solid ${C.border}`, paddingTop:20 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:8 }}>クリエイターに質問する</div>
                    <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="サイズや納期について相談したい..." rows={3}
                      style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", resize:"vertical", outline:"none", boxSizing:"border-box" }}/>
                    <Btn onClick={()=>setMsg("")} variant="secondary" size="sm" full style={{ marginTop:8 }}>💬 メッセージを送る</Btn>
                  </div>

                  <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 14px" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.orange, marginBottom:4 }}>🔒 安心保証</div>
                    <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.6 }}>エスクロー決済採用。作品受け取り確認後に代金が支払われます。万が一の場合はQoccaが対応します。</div>
                  </div>
                </>
              )}
            </div>

            {/* Seller card */}
            <div style={{ background:C.white, borderRadius:20, padding:"20px", border:`1px solid ${C.border}`, marginTop:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>{item.sellerIcon}</div>
                <div>
                  <div style={{ fontWeight:800, color:C.dark, fontSize:15 }}>{item.seller}</div>
                  <div style={{ fontSize:12, color:C.warmGray }}>⭐{item.rating} · {item.reviews}件の実績</div>
                </div>
              </div>
              <Btn variant="ghost" size="sm" full>プロフィールを見る</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── SELL PAGE ─────────────────────────────────────────────────────────────────
const SellPage = () => {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ cat:"", pet:"both", title:"", desc:"", price:"", delivery:"", name:"", email:"" });
  const up = (k,v) => setForm(p=>({...p,[k]:v}));

  if (done) return (
    <div style={{ paddingTop:68, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", maxWidth:480, padding:40 }}>
        <div style={{ fontSize:80, marginBottom:20 }}>🎉</div>
        <h2 style={{ fontSize:32, fontWeight:900, color:C.dark, marginBottom:12 }}>出品完了！</h2>
        <p style={{ color:C.warmGray, fontSize:16, lineHeight:1.7, marginBottom:28 }}>「{form.title}」を出品しました。審査後（最大24時間）に公開されます。ペットオーナーからの注文をお待ちください🐾</p>
        <Btn onClick={()=>{setDone(false);setStep(1);setForm({cat:"",pet:"both",title:"",desc:"",price:"",delivery:"",name:"",email:""});}} variant="primary" size="lg">続けて出品する</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop:68, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:680, margin:"0 auto", padding:"48px 24px" }}>
        {/* Progress */}
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          {[1,2,3,4].map(s=>(
            <div key={s} style={{ flex:1, height:5, borderRadius:3, background:step>=s?C.orange:C.border, transition:"background 0.3s" }}/>
          ))}
        </div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:28 }}>STEP {step} / 4</div>

        <div style={{ background:C.white, borderRadius:24, padding:"36px", border:`1px solid ${C.border}` }}>
          {step===1&&<>
            <h2 style={{ fontSize:26, fontWeight:900, color:C.dark, marginBottom:24 }}>📦 サービスのカテゴリ</h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
              {CATS.filter(c=>c.id!=="all").map(c=>(
                <button key={c.id} onClick={()=>up("cat",c.id)} style={{
                  padding:"16px", border:`2px solid ${form.cat===c.id?C.orange:C.border}`,
                  borderRadius:14, background:form.cat===c.id?C.orangePale:C.white,
                  cursor:"pointer", display:"flex", alignItems:"center", gap:12, fontFamily:"inherit"
                }}>
                  <span style={{ fontSize:28 }}>{c.icon}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:form.cat===c.id?C.orange:C.dark }}>{c.label}</span>
                </button>
              ))}
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:10 }}>対象ペット</div>
              <div style={{ display:"flex", gap:10 }}>
                {[["dog","🐕 犬向け"],["cat","🐈 猫向け"],["both","🐾 両対応"]].map(([v,l])=>(
                  <button key={v} onClick={()=>up("pet",v)} style={{
                    flex:1, padding:"12px", border:`2px solid ${form.pet===v?C.orange:C.border}`,
                    borderRadius:12, background:form.pet===v?C.orangePale:C.white,
                    cursor:"pointer", fontSize:14, fontWeight:700, color:form.pet===v?C.orange:C.warmGray, fontFamily:"inherit"
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </>}

          {step===2&&<>
            <h2 style={{ fontSize:26, fontWeight:900, color:C.dark, marginBottom:24 }}>📝 サービスの内容</h2>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>サービスタイトル *</label>
              <input value={form.title} onChange={e=>up("title",e.target.value)} placeholder="例：愛犬の水彩似顔絵を描きます"
                style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>サービス詳細 *</label>
              <textarea value={form.desc} onChange={e=>up("desc",e.target.value)} rows={5} placeholder="サービスの内容、こだわり、注意事項などを詳しく書いてください"
                style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>料金（円）*</label>
                <input type="number" value={form.price} onChange={e=>up("price",e.target.value)} placeholder="3000"
                  style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>納期</label>
                <select value={form.delivery} onChange={e=>up("delivery",e.target.value)}
                  style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", background:C.white }}>
                  <option value="">選択してください</option>
                  {["即日","3日以内","1週間以内","2週間以内","要相談"].map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </>}

          {step===3&&<>
            <h2 style={{ fontSize:26, fontWeight:900, color:C.dark, marginBottom:24 }}>🖼️ サービス画像</h2>
            <div style={{ border:`2px dashed ${C.orangeLight}`, borderRadius:20, padding:"60px 40px", textAlign:"center", background:C.orangePale, cursor:"pointer", marginBottom:20 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📷</div>
              <div style={{ fontSize:15, fontWeight:700, color:C.orange, marginBottom:4 }}>クリックして画像をアップロード</div>
              <div style={{ fontSize:12, color:C.warmGray }}>PNG・JPG対応 · 最大5枚 · 1枚10MB以下</div>
            </div>
            <div style={{ background:C.lightGray, borderRadius:14, padding:"16px 18px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:6 }}>💡 画像のコツ</div>
              <div style={{ fontSize:12, color:C.warmGray, lineHeight:1.7 }}>・実際の作品の写真を使いましょう<br/>・明るく清潔感のある背景がおすすめ<br/>・複数枚アップすると購入率が上がります</div>
            </div>
          </>}

          {step===4&&<>
            <h2 style={{ fontSize:26, fontWeight:900, color:C.dark, marginBottom:24 }}>👤 出品者情報</h2>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>お名前（屋号）*</label>
              <input value={form.name} onChange={e=>up("name",e.target.value)} placeholder="みかん工房"
                style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>メールアドレス *</label>
              <input type="email" value={form.email} onChange={e=>up("email",e.target.value)} placeholder="your@email.com"
                style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            {/* Summary */}
            <div style={{ background:C.lightGray, borderRadius:16, padding:"20px" }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:12 }}>出品内容の確認</div>
              {[
                ["カテゴリ", CATS.find(c=>c.id===form.cat)?.label||"未設定"],
                ["タイトル", form.title||"未入力"],
                ["料金", form.price?`¥${Number(form.price).toLocaleString()}`:"未設定"],
                ["納期", form.delivery||"未設定"],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.warmGray }}>{k}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{v}</span>
                </div>
              ))}
            </div>
          </>}

          {/* Navigation */}
          <div style={{ display:"flex", gap:10, marginTop:28 }}>
            {step>1&&<Btn onClick={()=>setStep(s=>s-1)} variant="ghost" size="md" style={{ flex:1 }}>← 戻る</Btn>}
            <Btn onClick={()=>step<4?setStep(s=>s+1):setDone(true)} variant="primary" size="md" style={{ flex:2 }}>
              {step<4?"次へ →":"🐾 出品する！"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── SIGNUP PAGE ───────────────────────────────────────────────────────────────
const SignupPage = () => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [done, setDone] = useState(false);

  if (done) return (
    <div style={{ paddingTop:68, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🐨</div>
        <div style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8 }}>ようこそQoccaへ！</div>
        <div style={{ color:C.warmGray }}>アカウントが作成されました🐾</div>
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop:68, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", padding:"100px 24px" }}>
      <div style={{ width:"100%", maxWidth:440 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <Logo size={40}/>
          <h1 style={{ fontSize:26, fontWeight:900, color:C.dark, marginTop:16 }}>{mode==="login"?"ログイン":"新規登録"}</h1>
        </div>
        <div style={{ background:C.white, borderRadius:24, padding:"36px", border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", background:C.lightGray, borderRadius:12, padding:4, marginBottom:24 }}>
            {[["login","ログイン"],["register","新規登録"]].map(([v,l])=>(
              <button key={v} onClick={()=>setMode(v)} style={{
                flex:1, padding:"10px", border:"none", borderRadius:9, cursor:"pointer",
                background:mode===v?C.white:"transparent", fontWeight:800, fontSize:14, fontFamily:"inherit",
                color:mode===v?C.dark:C.warmGray, boxShadow:mode===v?"0 2px 6px rgba(0,0,0,0.08)":"none"
              }}>{l}</button>
            ))}
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>メールアドレス</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
              style={{ width:"100%", padding:"13px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>パスワード</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
              style={{ width:"100%", padding:"13px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
          </div>
          <Btn onClick={()=>setDone(true)} variant="primary" size="lg" full>{mode==="login"?"ログイン":"アカウントを作成"}</Btn>

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"20px 0" }}>
            <div style={{ flex:1, height:1, background:C.border }}/>
            <span style={{ fontSize:12, color:C.warmGray }}>または</span>
            <div style={{ flex:1, height:1, background:C.border }}/>
          </div>

          {[["🐦 Twitterで続ける"],["📘 Googleで続ける"],["🍎 Appleで続ける"]].map(([l])=>(
            <button key={l} style={{ width:"100%", padding:"12px", marginBottom:10, border:`1.5px solid ${C.border}`, borderRadius:12, background:C.white, cursor:"pointer", fontSize:14, fontWeight:700, fontFamily:"inherit", color:C.dark }}>{l}</button>
          ))}
        </div>
        <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:C.warmGray }}>
          ログインすることで<span style={{ color:C.orange }}>利用規約</span>および<span style={{ color:C.orange }}>プライバシーポリシー</span>に同意したことになります
        </div>
      </div>
    </div>
  );
};

// ── LIKED PAGE ────────────────────────────────────────────────────────────────
const LikedPage = ({ listings, liked, onLike, onDetail }) => {
  const items = listings.filter(l => liked[l.id]);
  return (
    <div style={{ paddingTop:68, minHeight:"100vh", background:C.cream, padding:"88px 80px 60px" }}>
      <h1 style={{ fontSize:28, fontWeight:900, color:C.dark, marginBottom:8 }}>❤️ お気に入り</h1>
      <p style={{ color:C.warmGray, marginBottom:32 }}>{items.length}件のサービス</p>
      {items.length===0?(
        <div style={{ textAlign:"center", padding:"80px 20px" }}>
          <div style={{ fontSize:64, marginBottom:16 }}>🤍</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.dark, marginBottom:8 }}>まだお気に入りがありません</div>
          <div style={{ color:C.warmGray }}>気になるサービスのハートをタップして保存しよう</div>
        </div>
      ):(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 }}>
          {items.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
        </div>
      )}
    </div>
  );
};

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function QoccaWeb() {
  const [page, setPage] = useState("home");
  const [detail, setDetail] = useState(null);
  const [liked, setLiked] = useState({});
  const [search, setSearch] = useState("");

  const onLike = (id) => setLiked(p=>({...p,[id]:!p[id]}));
  const onDetail = (item) => { setDetail(item); setPage("detail"); };
  const goBack = () => { setDetail(null); setPage("search"); };

  useEffect(() => { window.scrollTo(0,0); }, [page]);

  return (
    <div style={{ fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif", background:C.cream, minHeight:"100vh", color:C.dark }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet"/>
      <Navbar page={page} setPage={setPage} liked={liked} search={search} setSearch={setSearch}/>

      {page==="home" && <HomePage setPage={setPage} listings={LISTINGS} liked={liked} onLike={onLike} onDetail={onDetail}/>}
      {page==="search" && <SearchPage listings={LISTINGS} liked={liked} onLike={onLike} onDetail={onDetail} search={search} setSearch={setSearch}/>}
      {page==="detail" && <DetailPage item={detail} onBack={goBack} liked={liked[detail?.id]} onLike={onLike}/>}
      {page==="sell" && <SellPage/>}
      {page==="signup" && <SignupPage/>}
      {page==="liked" && <LikedPage listings={LISTINGS} liked={liked} onLike={onLike} onDetail={onDetail}/>}

      <style>{`
        @keyframes float1{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:#f1f1f1}
        ::-webkit-scrollbar-thumb{background:${C.orangeLight};border-radius:3px}
        input,textarea,select{transition:border-color 0.2s}
        input:focus,textarea:focus,select:focus{border-color:${C.orange}!important}
      `}</style>
    </div>
  );
}
