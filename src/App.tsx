import { useState, useEffect, useRef } from "react";

const C = {
  orange: "#F5A94A", orangeLight: "#FAC97A", orangePale: "#FFF3E0",
  orangeDeep: "#E8903A", cream: "#FAFAF7", dark: "#1A1208",
  darkBrown: "#2D1F0A", warmGray: "#9E9B95", lightGray: "#F5F3F0",
  border: "#EDE9E3", white: "#FFFFFF", green: "#4CAF50",
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

const LISTINGS = [
  { id:1, title:"愛犬の水彩似顔絵", seller:"みかん工房", sellerIcon:"🎨", price:3800, rating:4.9, reviews:128, tag:"人気", category:"illust", emoji:"🎨", pet:"dog", desc:"大切なわんちゃんの特徴を丁寧に捉えた水彩画。A4サイズ・データ納品も可能です。注文後にお写真をお送りください。通常3〜5日で納品いたします。", delivery:"5日以内", bg:"#FFF3E0" },
  { id:2, title:"猫ちゃん専用ニット服", seller:"てづくり屋さん", sellerIcon:"🧶", price:5200, rating:4.8, reviews:64, tag:"新着", category:"clothes", emoji:"🧶", pet:"cat", desc:"猫ちゃんのサイズに合わせてオーダーメイドで制作します。素材は柔らかいウール混です。", delivery:"2週間以内", bg:"#F3E5F5" },
  { id:3, title:"ペットの記念日フォト", seller:"ぽちフォト", sellerIcon:"📸", price:12000, rating:5.0, reviews:42, tag:"人気", category:"photo", emoji:"📸", pet:"dog", desc:"出張撮影対応。大切な記念日を最高の一枚に残します。データ50枚以上お渡し。東京・神奈川エリア対応。", delivery:"要相談", bg:"#E3F2FD" },
  { id:4, title:"アクリルキーホルダー", seller:"クリエイトパレット", sellerIcon:"✨", price:2200, rating:4.7, reviews:93, tag:"", category:"goods", emoji:"✨", pet:"both", desc:"写真からデザインしたオリジナルキーホルダー。名前入れも対応します。両面印刷・カラビナ付き。", delivery:"1週間以内", bg:"#E8F5E9" },
  { id:5, title:"デジタル似顔絵（即日）", seller:"イラスト工房ハル", sellerIcon:"💻", price:1500, rating:4.6, reviews:211, tag:"即日", category:"illust", emoji:"💻", pet:"both", desc:"注文当日に納品します。SNSアイコンや年賀状にも最適です。高解像度PNGデータ納品。", delivery:"即日", bg:"#FFF8E1" },
  { id:6, title:"犬用バースデーケーキ", seller:"わんこベーカリー", sellerIcon:"🎂", price:4800, rating:4.9, reviews:55, tag:"新着", category:"food", emoji:"🎂", pet:"dog", desc:"犬が食べても安心な素材だけで作るバースデーケーキ。写真付きメッセージカード付き。サイズS/M/Lから選択可。", delivery:"3日前要注文", bg:"#FCE4EC" },
  { id:7, title:"猫の刺繍ポーチ", seller:"ぬい工房まり", sellerIcon:"🪡", price:3200, rating:4.8, reviews:37, tag:"", category:"goods", emoji:"🪡", pet:"cat", desc:"うちの子の顔を刺繍したオリジナルポーチ。プレゼントにも喜ばれます。", delivery:"10日以内", bg:"#E8EAF6" },
  { id:8, title:"しつけ個別相談60分", seller:"ドッグトレーナー山本", sellerIcon:"🎓", price:6000, rating:4.9, reviews:89, tag:"人気", category:"training", emoji:"🎓", pet:"dog", desc:"プロトレーナーによるオンライン相談。吠え・噛み・トイレトラブルなど何でも。Zoom使用。", delivery:"3日以内", bg:"#E0F7FA" },
  { id:9, title:"猫用おもちゃセット", seller:"ねこてぃ", sellerIcon:"🐱", price:2800, rating:4.7, reviews:61, tag:"", category:"goods", emoji:"🐱", pet:"cat", desc:"猫が夢中になる手作りおもちゃ5点セット。天然素材のみ使用。猫草付き。", delivery:"5日以内", bg:"#FFF3E0" },
  { id:10, title:"手作りおやつ定期便", seller:"わんこベーカリー", sellerIcon:"🦴", price:3500, rating:4.8, reviews:44, tag:"", category:"food", emoji:"🦴", pet:"dog", desc:"毎月届く手作りおやつ定期便。国産・無添加素材のみ。アレルギー対応も相談可。", delivery:"毎月発送", bg:"#F9FBE7" },
  { id:11, title:"ペット用バンダナ刺繍", seller:"てづくり屋さん", sellerIcon:"🎀", price:1800, rating:4.6, reviews:28, tag:"", category:"clothes", emoji:"🎀", pet:"both", desc:"名前刺繍入りのオリジナルバンダナ。綿100%で肌に優しい。サイズS〜XL対応。", delivery:"1週間以内", bg:"#F3E5F5" },
  { id:12, title:"LINEスタンプ制作", seller:"イラスト工房ハル", sellerIcon:"💬", price:8000, rating:4.7, reviews:33, tag:"", category:"illust", emoji:"💬", pet:"both", desc:"うちの子が主役のオリジナルLINEスタンプを制作。8種類のポーズ込み。申請代行も可能。", delivery:"2週間以内", bg:"#FFF8E1" },
];

const REVIEWS = [
  { user:"ゆきさん", pet:"🐕", rating:5, comment:"本当にそっくりで感動しました！額に入れて飾ってます🥺", date:"2026.3.15" },
  { user:"まるこさん", pet:"🐈", rating:5, comment:"丁寧な対応で安心できました。また依頼したいです！", date:"2026.3.10" },
  { user:"けんたさん", pet:"🐕", rating:4, comment:"クオリティ高い！少し時間かかりましたが満足です。", date:"2026.2.28" },
];

// ── Logo ─────────────────────────────────────────────────────────────────
const Logo = ({ size = 32 }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flexShrink:0 }}>
    <img src="/logo.png" width={size*1.5} height={size*1.5} style={{ objectFit:"contain" }} alt="Qocca"/>
    <span style={{ fontSize:size*0.72, fontWeight:900, color:C.orange, letterSpacing:"-0.5px" }}>Qocca</span>
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

// ── PC用サイドバー（幅を220に縮小） ──────────────────────────────────────
const Sidebar = ({ setPage, activeCat, setActiveCat }) => (
  <div style={{ width:220, flexShrink:0, paddingTop:24, paddingLeft:0 }}>
    <div style={{ position:"sticky", top:92 }}>
      <div style={{ fontSize:13, fontWeight:800, color:C.warmGray, marginBottom:12, padding:"0 8px" }}>カテゴリ</div>
      {CATS.map(c=>(
        <button key={c.id} onClick={()=>{ setActiveCat(c.id); setPage("search"); }} style={{
          width:"100%", padding:"10px 16px", border:"none", borderRadius:10,
          background: activeCat===c.id ? C.orangePale : "transparent",
          color: activeCat===c.id ? C.orange : C.dark,
          fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left",
          display:"flex", alignItems:"center", gap:10, fontFamily:"inherit",
          marginBottom:2
        }}>
          <span style={{ fontSize:20 }}>{c.icon}</span>
          <span>{c.label}</span>
        </button>
      ))}
      <div style={{ margin:"20px 8px", borderTop:`1px solid ${C.border}` }}/>
      <button onClick={()=>setPage("sell")} style={{
        width:"100%", padding:"12px 16px", border:"none", borderRadius:12,
        background:C.orange, color:"#fff", fontWeight:800, fontSize:14,
        cursor:"pointer", fontFamily:"inherit"
      }}>🐾 出品する</button>
    </div>
  </div>
);

// ── PC用ナビバー ───────────────────────────────────────────────────────────
const PCNavbar = ({ setPage, liked, search, setSearch }) => (
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
      {[["home","ホーム"],["search","さがす"],["liked","お気に入り"]].map(([id,label])=>(
        <button key={id} onClick={()=>setPage(id)} style={{
          background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
          fontSize:14, fontWeight:700, color:C.dark, padding:"4px 8px"
        }}>{label}</button>
      ))}
      <button onClick={()=>setPage("sell")} style={{
        padding:"9px 20px", background:C.orange, border:"none", borderRadius:10,
        color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit"
      }}>出品する</button>
      <button onClick={()=>setPage("signup")} style={{
        padding:"9px 20px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:10,
        color:C.dark, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit"
      }}>ログイン</button>
    </div>
  </nav>
);

const Stars = ({ rating, size=12 }) => (
  <span style={{ color:C.orange, fontSize:size }}>{"★".repeat(Math.round(rating))}{"☆".repeat(5-Math.round(rating))}</span>
);

const Tag = ({ text }) => (
  <span style={{ background:C.orange, color:"#fff", fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>{text}</span>
);

// ── Card ──────────────────────────────────────────────────────────────────
const Card = ({ item, onClick, liked, onLike }) => (
  <div onClick={() => onClick(item)} style={{
    background:C.white, borderRadius:16, overflow:"hidden",
    cursor:"pointer", border:`1px solid ${C.border}`,
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)", width:"100%"
  }}>
    <div style={{ height:140, background:item.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:60, position:"relative" }}>
      {item.emoji}
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
        {item.sellerIcon} {item.seller}
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:15, fontWeight:900, color:C.orange }}>¥{item.price.toLocaleString()}</span>
        <div style={{ display:"flex", alignItems:"center", gap:3 }}>
          <Stars rating={item.rating} size={11}/>
          <span style={{ fontSize:10, color:C.warmGray }}>({item.reviews})</span>
        </div>
      </div>
    </div>
  </div>
);

// ── Mobile Navbar ─────────────────────────────────────────────────────────
const Navbar = ({ setPage, liked, search, setSearch }) => {
  const [scrolled, setScrolled] = useState(false);
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
      padding:"0 16px", height:60,
      display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
      transition:"all 0.3s"
    }}>
      <div onClick={()=>setPage("home")} style={{ flexShrink:0 }}><Logo size={30}/></div>
      <div style={{ flex:1, maxWidth:340, position:"relative" }}>
        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14, color:C.warmGray }}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setPage("search")}
          placeholder="サービスを探す..."
          style={{ width:"100%", padding:"8px 10px 8px 30px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, outline:"none", fontFamily:"inherit", background:C.lightGray, color:C.dark, boxSizing:"border-box" }}
        />
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <span onClick={()=>setPage("liked")} style={{ cursor:"pointer", fontSize:20, position:"relative" }}>
          🤍
          {Object.values(liked).filter(Boolean).length > 0 && (
            <span style={{ position:"absolute", top:-4, right:-4, width:14, height:14, background:C.orange, borderRadius:"50%", fontSize:9, color:"#fff", fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {Object.values(liked).filter(Boolean).length}
            </span>
          )}
        </span>
        <button onClick={()=>setPage("signup")} style={{
          padding:"7px 14px", background:C.orange, border:"none", borderRadius:10,
          color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer", whiteSpace:"nowrap"
        }}>ログイン</button>
      </div>
    </nav>
  );
};

// ── HOME (Mobile) ─────────────────────────────────────────────────────────
const HomePage = ({ setPage, listings, liked, onLike, onDetail }) => {
  const [activeCat, setActiveCat] = useState("all");
  const popular = listings.filter(l => l.tag === "人気").slice(0,4);
  const newItems = listings.filter(l => l.tag === "新着").slice(0,4);

  return (
    <div>
      {/* Hero */}
      <section style={{
        background:`linear-gradient(145deg, ${C.dark} 0%, ${C.darkBrown} 55%, #3D2810 100%)`,
        padding:"80px 20px 60px", position:"relative", overflow:"hidden"
      }}>
        <div style={{ position:"absolute", right:-20, top:"10%", fontSize:100, opacity:0.05 }}>🐾</div>
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 14px", background:"rgba(245,169,74,0.15)", borderRadius:20, border:"1px solid rgba(245,169,74,0.3)", marginBottom:20 }}>
            <span style={{ fontSize:13 }}>🐨</span>
            <span style={{ fontSize:12, color:C.orange, fontWeight:700 }}>ペットオーナー専門マーケット</span>
          </div>
          <h1 style={{ fontSize:40, fontWeight:900, color:C.white, lineHeight:1.15, marginBottom:16, letterSpacing:"-1px" }}>
            うちの子のための<br/><span style={{ color:C.orange }}>特別なもの</span>を。
          </h1>
          <p style={{ fontSize:15, color:"rgba(255,255,255,0.65)", lineHeight:1.7, marginBottom:28 }}>
            似顔絵・ハンドメイド服・フォト撮影・グッズ制作。世界にひとつだけの作品。
          </p>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button onClick={()=>setPage("search")} style={{
              padding:"13px 24px", background:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer"
            }}>🔍 サービスを探す</button>
            <button onClick={()=>setPage("sell")} style={{
              padding:"13px 20px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)",
              borderRadius:12, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer"
            }}>出品者になる →</button>
          </div>
          <div style={{ display:"flex", gap:24, marginTop:24 }}>
            {[["1,200+","出品"],["8,400+","登録者"],["4.8","評価"]].map(([v,l])=>(
              <div key={l}>
                <div style={{ fontSize:20, fontWeight:900, color:C.orange }}>{v}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section style={{ padding:"24px 16px 0", background:C.cream }}>
        <h2 style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:14 }}>カテゴリから探す</h2>
        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
          {CATS.map(c=>(
            <button key={c.id} onClick={()=>{ setActiveCat(c.id); setPage("search"); }} style={{
              flexShrink:0, background:C.white, borderRadius:12, padding:"10px 14px",
              border:`1.5px solid ${C.border}`, cursor:"pointer", textAlign:"center", fontFamily:"inherit"
            }}>
              <div style={{ fontSize:24 }}>{c.icon}</div>
              <div style={{ fontSize:11, fontWeight:700, color:C.dark, marginTop:4, whiteSpace:"nowrap" }}>{c.label}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Popular */}
      <section style={{ padding:"24px 16px", background:C.cream }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>🔥 人気のサービス</h2>
          <button onClick={()=>setPage("search")} style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, color:C.warmGray, cursor:"pointer" }}>すべて →</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {popular.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
        </div>
      </section>

      {/* Banner */}
      <section style={{ padding:"0 16px 24px", background:C.cream }}>
        <div style={{ background:`linear-gradient(135deg, ${C.orange}, ${C.orangeLight})`, borderRadius:20, padding:"28px 20px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", right:-10, top:-10, fontSize:100, opacity:0.1 }}>🐾</div>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.8)", marginBottom:6 }}>CREATOR WANTED</div>
          <h3 style={{ fontSize:22, fontWeight:900, color:"#fff", marginBottom:10, lineHeight:1.3 }}>あなたのスキルを<br/>ペット好きに届けよう</h3>
          <p style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginBottom:18 }}>先着100名は手数料5%の特別優遇！</p>
          <button onClick={()=>setPage("sell")} style={{
            padding:"12px 24px", background:"#fff", border:"none",
            borderRadius:12, color:C.orange, fontWeight:800, fontSize:14, cursor:"pointer"
          }}>🐾 無料で出品を始める</button>
        </div>
      </section>

      {/* New */}
      <section style={{ padding:"0 16px 24px", background:C.cream }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>🆕 新着サービス</h2>
          <button onClick={()=>setPage("search")} style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, color:C.warmGray, cursor:"pointer" }}>すべて →</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {newItems.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding:"32px 16px", background:C.dark }}>
        <h2 style={{ fontSize:22, fontWeight:900, color:C.white, marginBottom:6, textAlign:"center" }}>使い方はかんたん</h2>
        <p style={{ color:"rgba(255,255,255,0.5)", marginBottom:28, fontSize:14, textAlign:"center" }}>3ステップでうちの子のための特別な作品を</p>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {[
            { step:"01", icon:"🔍", title:"サービスを探す", desc:"カテゴリやキーワードで検索。ペット専門クリエイターが揃っています。" },
            { step:"02", icon:"💬", title:"クリエイターに依頼", desc:"メッセージで詳細を相談。安心のエスクロー決済。" },
            { step:"03", icon:"🎁", title:"作品を受け取る", desc:"完成した作品を受け取ったら取引完了。レビューを書こう。" },
          ].map(s=>(
            <div key={s.step} style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
              <div style={{ width:52, height:52, borderRadius:"50%", background:`${C.orange}20`, border:`1px solid ${C.orange}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:C.orange, letterSpacing:"0.1em", marginBottom:4 }}>STEP {s.step}</div>
                <div style={{ fontSize:15, fontWeight:800, color:C.white, marginBottom:4 }}>{s.title}</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background:"#0D0A05", padding:"24px 16px" }}>
        <Logo size={24}/>
        <div style={{ display:"flex", flexWrap:"wrap", gap:16, marginTop:16 }}>
          {["利用規約","プライバシー","特定商取引法","お問い合わせ"].map(l=>(
            <span key={l} style={{ fontSize:11, color:"rgba(255,255,255,0.3)", cursor:"pointer" }}>{l}</span>
          ))}
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:12 }}>© 2026 Qocca Inc.</div>
      </footer>
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
  if (sort === "popular") results = [...results].sort((a,b) => b.reviews - a.reviews);
  if (sort === "cheap") results = [...results].sort((a,b) => a.price - b.price);
  if (sort === "rating") results = [...results].sort((a,b) => b.rating - a.rating);

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      {/* Search bar (モバイルのみ) */}
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

      {/* Category tabs */}
      <div style={{ padding:"10px 0", background: isPC ? "transparent" : C.white, borderBottom: isPC ? "none" : `1px solid ${C.border}`, display:"flex", gap:8, overflowX:"auto", paddingLeft: isPC ? 0 : 16, paddingRight: isPC ? 0 : 16 }}>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            flexShrink:0, padding:"6px 14px",
            background: cat===c.id ? C.orange : C.white,
            color: cat===c.id ? "#fff" : C.warmGray,
            border:`1.5px solid ${cat===c.id ? C.orange : C.border}`,
            borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:4
          }}>
            <span>{c.icon}</span><span style={{ whiteSpace:"nowrap" }}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Sort */}
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
const DetailPage = ({ item, onBack, liked, onLike }) => {
  const [ordered, setOrdered] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportDone, setReportDone] = useState(false);
  if (!item) return null;
  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.orange, fontWeight:700 }}>←</button>
        <span style={{ fontSize:14, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</span>
      </div>

      <div style={{ height:240, background:item.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:100, position:"relative" }}>
        {item.emoji}
        <button onClick={() => onLike(item.id)} style={{
          position:"absolute", top:12, right:12, width:40, height:40, borderRadius:"50%",
          background:"rgba(255,255,255,0.92)", border:"none", cursor:"pointer", fontSize:20,
          display:"flex", alignItems:"center", justifyContent:"center"
        }}>{liked ? "❤️" : "🤍"}</button>
      </div>

      <div style={{ padding:"16px" }}>
        {item.tag && <div style={{ marginBottom:8 }}><Tag text={item.tag}/></div>}
        <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.3 }}>{item.title}</h1>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <Stars rating={item.rating} size={14}/>
          <span style={{ color:C.warmGray, fontSize:13 }}>{item.rating} ({item.reviews}件)</span>
        </div>

        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{item.sellerIcon}</div>
          <div>
            <div style={{ fontWeight:800, color:C.dark, fontSize:15 }}>{item.seller}</div>
            <div style={{ fontSize:12, color:C.warmGray }}>評価 {item.rating} · {item.reviews}件</div>
          </div>
        </div>

        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:8 }}>サービス詳細</div>
          <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>{item.desc}</div>
        </div>

        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:20, border:`1px solid ${C.border}` }}>
          {[["⏱️ 納期", item.delivery],["🐾 対象", item.pet==="dog"?"🐕 犬向け":item.pet==="cat"?"🐈 猫向け":"🐾 両対応"],["🔒 保証","エスクロー決済"]].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:13, color:C.warmGray }}>{k}</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{v}</span>
            </div>
          ))}
        </div>

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

        <div style={{ textAlign:"center", marginBottom:80 }}>
          <button onClick={()=>setShowReport(true)} style={{
            background:"none", border:"none", cursor:"pointer",
            fontSize:12, color:"#ccc", textDecoration:"underline", fontFamily:"inherit"
          }}>🚨 このサービスを通報する</button>
        </div>
      </div>

      {/* 通報モーダル */}
      {showReport && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"flex-end" }}
          onClick={()=>setShowReport(false)}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 20px", width:"100%" }} onClick={e=>e.stopPropagation()}>
            {reportDone ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:18, fontWeight:900, color:"#1A1208", marginBottom:8 }}>通報を受け付けました</div>
                <div style={{ fontSize:13, color:"#9E9B95", marginBottom:20 }}>管理者が確認次第、対応いたします。</div>
                <button onClick={()=>{setShowReport(false);setReportDone(false);}} style={{
                  padding:"12px 32px", background:"#F5A94A", border:"none", borderRadius:12,
                  color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit"
                }}>閉じる</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize:18, fontWeight:900, color:"#1A1208", marginBottom:4 }}>🚨 通報する</div>
                <div style={{ fontSize:12, color:"#9E9B95", marginBottom:20 }}>通報内容を選択してください</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
                  {["🐾 生体動物の売買","💬 プラットフォーム外への誘導","🎭 なりすまし・偽サービス","⚠️ 著作権侵害","🔞 不適切なコンテンツ","💰 詐欺・虚偽の内容","その他"].map(type => (
                    <button key={type} onClick={()=>setReportType(type)} style={{
                      padding:"12px 16px", border:`2px solid ${reportType===type?"#EF5350":"#EDE9E3"}`,
                      borderRadius:12, background:reportType===type?"#FFEBEE":"#fff",
                      color:reportType===type?"#EF5350":"#3D3B38",
                      fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left", fontFamily:"inherit"
                    }}>{type}</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>setShowReport(false)} style={{
                    flex:1, padding:"13px", background:"#fff", border:"1.5px solid #EDE9E3",
                    borderRadius:12, color:"#9E9B95", fontWeight:700, cursor:"pointer", fontFamily:"inherit"
                  }}>キャンセル</button>
                  <button onClick={()=>reportType&&setReportDone(true)} disabled={!reportType} style={{
                    flex:2, padding:"13px", background:reportType?"#EF5350":"#EDE9E3",
                    border:"none", borderRadius:12, color:"#fff",
                    fontWeight:800, fontSize:15, cursor:reportType?"pointer":"not-allowed", fontFamily:"inherit"
                  }}>通報する</button>
                </div>
              </>
            )}
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
          <div style={{ fontSize:11, color:C.warmGray }}>料金</div>
          <div style={{ fontSize:24, fontWeight:900, color:C.orange }}>¥{item.price.toLocaleString()}</div>
        </div>
        {ordered ? (
          <div style={{ flex:2, textAlign:"center", padding:"12px", background:C.green, borderRadius:12, color:"#fff", fontWeight:800 }}>🎉 注文完了！</div>
        ) : (
          <button onClick={()=>setOrdered(true)} style={{
            flex:2, padding:"14px", background:C.orange, border:"none",
            borderRadius:12, color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer"
          }}>🐾 注文する</button>
        )}
      </div>
    </div>
  );
};

// ── SELL ───────────────────────────────────────────────────────────────────
const SellPage = () => {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ cat:"", pet:"both", title:"", desc:"", price:"", delivery:"" });
  const up = (k,v) => setForm(p=>({...p,[k]:v}));

  if (done) return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", padding:32 }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
        <h2 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:10 }}>出品完了！</h2>
        <p style={{ color:C.warmGray, fontSize:14, lineHeight:1.7, marginBottom:24 }}>審査後（最大24時間）に公開されます🐾</p>
        <button onClick={()=>{setDone(false);setStep(1);setForm({cat:"",pet:"both",title:"",desc:"",price:"",delivery:"" });}} style={{ padding:"12px 28px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>続けて出品する</button>
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:500, margin:"0 auto", padding:"20px 16px" }}>
        <div style={{ display:"flex", gap:6, marginBottom:6 }}>
          {[1,2,3].map(s=>(
            <div key={s} style={{ flex:1, height:4, borderRadius:2, background:step>=s?C.orange:C.border }}/>
          ))}
        </div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:20 }}>STEP {step} / 3</div>

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
            <div style={{ marginBottom:0 }}>
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
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
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
          </>}

          {step===3&&<>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:20 }}>確認して出品</h2>
            <div style={{ background:C.lightGray, borderRadius:14, padding:"16px", marginBottom:20 }}>
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
            <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 14px", fontSize:12, color:C.orange, lineHeight:1.6, fontWeight:600 }}>
              🐾 出品後、審査（最大24時間）を経て公開されます。
            </div>
          </>}

          <div style={{ display:"flex", gap:10, marginTop:24 }}>
            {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer", color:C.warmGray, fontFamily:"inherit" }}>← 戻る</button>}
            <button onClick={()=>step<3?setStep(s=>s+1):setDone(true)} style={{ flex:2, padding:"13px", background:C.orange, border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer", color:"#fff", fontFamily:"inherit" }}>
              {step<3?"次へ →":"🐾 出品する！"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── SIGNUP ─────────────────────────────────────────────────────────────────
const SignupPage = () => {
  const [mode, setMode] = useState("login");
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  if (done) return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🐨</div>
        <div style={{ fontSize:22, fontWeight:900, color:C.dark }}>ようこそQoccaへ！</div>
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 16px" }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <Logo size={36}/>
          <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginTop:14 }}>{mode==="login"?"ログイン":"新規登録"}</h1>
        </div>
        <div style={{ background:C.white, borderRadius:20, padding:"24px 16px", border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", background:C.lightGray, borderRadius:10, padding:4, marginBottom:20 }}>
            {[["login","ログイン"],["register","新規登録"]].map(([v,l])=>(
              <button key={v} onClick={()=>setMode(v)} style={{
                flex:1, padding:"9px", border:"none", borderRadius:8, cursor:"pointer",
                background:mode===v?C.white:"transparent", fontWeight:800, fontSize:13, fontFamily:"inherit",
                color:mode===v?C.dark:C.warmGray
              }}>{l}</button>
            ))}
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>メールアドレス</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
              style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>パスワード</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
              style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
          </div>
          <button onClick={()=>setDone(true)} style={{ width:"100%", padding:"14px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>
            {mode==="login"?"ログイン":"アカウントを作成"}
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8, margin:"16px 0" }}>
            <div style={{ flex:1, height:1, background:C.border }}/>
            <span style={{ fontSize:12, color:C.warmGray }}>または</span>
            <div style={{ flex:1, height:1, background:C.border }}/>
          </div>
          {[["🐦 Twitterで続ける"],["📘 Googleで続ける"]].map(([l])=>(
            <button key={l} style={{ width:"100%", padding:"11px", marginBottom:8, border:`1.5px solid ${C.border}`, borderRadius:10, background:C.white, cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit", color:C.dark }}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

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
  const tabs = [
    { id:"home", icon:"🏠", label:"ホーム" },
    { id:"search", icon:"🔍", label:"さがす" },
    { id:"sell", icon:"➕", label:"" },
    { id:"liked", icon:"❤️", label:"お気に入り" },
    { id:"signup", icon:"👤", label:"アカウント" },
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

// ── PC Hero（flexboxで左右バランス修正） ──────────────────────────────────
const PCHeroSection = ({ setPage }) => (
  <section style={{
    background:`linear-gradient(145deg, ${C.dark} 0%, ${C.darkBrown} 55%, #3D2810 100%)`,
    padding:"72px 48px", display:"flex", alignItems:"center", gap:48,
    position:"relative", overflow:"hidden"
  }}>
    {/* 背景装飾 */}
    <div style={{ position:"absolute", right:40, bottom:-20, fontSize:200, opacity:0.03, pointerEvents:"none" }}>🐾</div>

    {/* 左：テキスト (flex: 1.2) */}
    <div style={{ flex:"1.2", position:"relative", zIndex:1, minWidth:0 }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 16px", background:"rgba(245,169,74,0.15)", borderRadius:20, border:"1px solid rgba(245,169,74,0.3)", marginBottom:20 }}>
        <span>🐨</span><span style={{ fontSize:13, color:C.orange, fontWeight:700 }}>ペットオーナー専門マーケット · 出品者募集中</span>
      </div>
      <h1 style={{ fontSize:48, fontWeight:900, color:"#fff", lineHeight:1.15, marginBottom:16, letterSpacing:"-1px" }}>
        うちの子のための<br/><span style={{ color:C.orange }}>特別なもの</span>を。
      </h1>
      <p style={{ fontSize:16, color:"rgba(255,255,255,0.6)", lineHeight:1.8, marginBottom:28, maxWidth:480 }}>
        似顔絵・ハンドメイド服・フォト撮影・グッズ制作。<br/>ペット専門クリエイターが作る、世界にひとつだけの作品。
      </p>
      <div style={{ display:"flex", gap:12, marginBottom:32 }}>
        <button onClick={()=>setPage("search")} style={{ padding:"14px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer" }}>🔍 サービスを探す</button>
        <button onClick={()=>setPage("sell")} style={{ padding:"14px 24px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>出品者になる →</button>
      </div>
      <div style={{ display:"flex", gap:32 }}>
        {[["1,200+","出品"],["8,400+","登録者"],["4.8","評価"],["¥0","初回手数料"]].map(([v,l])=>(
          <div key={l}><div style={{ fontSize:22, fontWeight:900, color:C.orange }}>{v}</div><div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{l}</div></div>
        ))}
      </div>
    </div>

    {/* 右：カード2x2 (flex: 0.8, 最大幅を制限) */}
    <div style={{ flex:"0.8", maxWidth:380, display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {LISTINGS.slice(0,4).map(item=>(
        <div key={item.id} style={{
          aspectRatio:"1", background:item.bg, borderRadius:18,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:56, boxShadow:"0 8px 28px rgba(0,0,0,0.25)"
        }}>
          {item.emoji}
        </div>
      ))}
    </div>
  </section>
);

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
      <p style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:6 }}>先着100名は手数料5%の特別優遇！</p>
    </div>
    <button onClick={()=>setPage("sell")} style={{
      padding:"12px 28px", background:"#fff", border:"none",
      borderRadius:12, color:C.orange, fontWeight:800, fontSize:14, cursor:"pointer",
      flexShrink:0, position:"relative", zIndex:1
    }}>🐾 無料で出品を始める</button>
  </div>
);

// ── APP ────────────────────────────────────────────────────────────────────
export default function QoccaApp() {
  const [page, setPage] = useState("home");
  const [detail, setDetail] = useState(null);
  const [liked, setLiked] = useState({});
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const isPC = useIsPC();

  const onLike = (id) => setLiked(p=>({...p,[id]:!p[id]}));
  const onDetail = (item) => { setDetail(item); setPage("detail"); };
  const goBack = () => { setDetail(null); setPage("search"); };

  useEffect(() => { window.scrollTo(0,0); }, [page]);

  const showTabBar = !isPC && page !== "detail";

  return (
    <div style={{ fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif", background:C.cream, minHeight:"100vh", paddingBottom: showTabBar ? 70 : 0, width:"100%", overflowX:"hidden", margin:0, padding:0 }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet"/>

      {isPC
        ? <PCNavbar setPage={setPage} liked={liked} search={search} setSearch={setSearch}/>
        : <Navbar setPage={setPage} liked={liked} search={search} setSearch={setSearch}/>
      }

      {isPC ? (
        <div style={{ paddingTop:68 }}>
          {/* ヒーローはフル幅 */}
          {page==="home" && <PCHeroSection setPage={setPage}/>}

          {/* サイドバー + メインコンテンツ */}
          <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
            <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
            <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
              {page==="home" && (
                <>
                  {/* 人気のサービス */}
                  <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:16 }}>🔥 人気のサービス</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                    {LISTINGS.filter(l=>l.tag==="人気").slice(0,3).map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
                  </div>

                  {/* バナー */}
                  <PCBanner setPage={setPage}/>

                  {/* 新着サービス */}
                  <div style={{ fontSize:20, fontWeight:900, color:C.dark, margin:"24px 0 16px" }}>🆕 新着サービス</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                    {LISTINGS.filter(l=>l.tag==="新着").map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
                  </div>

                  {/* すべてのサービス */}
                  <div style={{ fontSize:20, fontWeight:900, color:C.dark, margin:"32px 0 16px" }}>📦 すべてのサービス</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                    {LISTINGS.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
                  </div>
                </>
              )}
              {page==="search" && <SearchPage listings={LISTINGS} liked={liked} onLike={onLike} onDetail={onDetail} search={search} setSearch={setSearch} isPC={true}/>}
              {page==="detail" && <DetailPage item={detail} onBack={goBack} liked={liked[detail?.id]} onLike={onLike}/>}
              {page==="sell" && <SellPage/>}
              {page==="signup" && <SignupPage/>}
              {page==="liked" && <LikedPage listings={LISTINGS} liked={liked} onLike={onLike} onDetail={onDetail} isPC={true}/>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {page==="home" && <HomePage setPage={setPage} listings={LISTINGS} liked={liked} onLike={onLike} onDetail={onDetail}/>}
          {page==="search" && <SearchPage listings={LISTINGS} liked={liked} onLike={onLike} onDetail={onDetail} search={search} setSearch={setSearch} isPC={false}/>}
          {page==="detail" && <DetailPage item={detail} onBack={goBack} liked={liked[detail?.id]} onLike={onLike}/>}
          {page==="sell" && <SellPage/>}
          {page==="signup" && <SignupPage/>}
          {page==="liked" && <LikedPage listings={LISTINGS} liked={liked} onLike={onLike} onDetail={onDetail} isPC={false}/>}
          {showTabBar && <TabBar page={page} setPage={setPage}/>}
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
