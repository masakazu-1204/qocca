import { useState, useEffect, useRef, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from "react-router-dom";

// ── Supabase Client ───────────────────────────────────────────────────────
const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
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
        redirectTo: window.location.origin,
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
      redirectTo: `${window.location.origin}/?page=reset`,
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
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "approved")
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
          bg: CAT_COLORS[l.category] || "#FFF3E0",
          imageUrl: l.image_urls?.[0] || "",
          imageUrls: l.image_urls || [],
          seller_id: l.seller_id,
          created_at: l.created_at,
          favorite_count: l.favorite_count || 0,
          options: l.options || [],
        };
      }));
    }
    setDbLoading(false);
  };

  useEffect(() => { fetchListings(); }, []);
  return { listings, dbLoading, refetch: fetchListings };
};

const CAT_COLORS = { illust:"#FFF3E0", clothes:"#F3E5F5", photo:"#E3F2FD", goods:"#E8F5E9", food:"#FCE4EC", training:"#E0F7FA" };

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
const submitListing = async (userId, form, imageFiles, options = []) => {
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

  const { data, error } = await supabase.from("listings").insert({
    seller_id: userId,
    title: form.title,
    description: form.desc,
    price: parseInt(form.price),
    category: form.cat,
    pet_type: form.pet,
    delivery_days: form.delivery,
    image_urls: imageUrls,
    options: options.filter(o => o.name && o.price > 0),
    status: "pending",
  }).select().single();

  return { data, error };
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

const EVENTS = [
  { id:1, title:"第15回 わんわんフェスタ in 東京", date:"2026.04.20", time:"10:00〜17:00", place:"代々木公園イベント広場", pref:"東京都", pet:"dog", fee:"無料", image:"🐕", organizer:"東京ペット愛好会", url:"https://example.com", desc:"都内最大級のわんちゃんイベント！ドッグランや写真撮影、グルメブースなど盛りだくさん。", likes:128, joins:89, comments:23, category:"フェスタ", bg:"#FFF3E0" },
  { id:2, title:"猫カフェオーナーズミート", date:"2026.04.25", time:"13:00〜16:00", place:"渋谷区文化センター", pref:"東京都", pet:"cat", fee:"500円", image:"🐈", organizer:"ねこ部", url:"https://example.com", desc:"猫オーナー同士の交流会。猫の健康管理や最新グッズの情報交換をしましょう！", likes:64, joins:42, comments:15, category:"交流会", bg:"#F3E5F5" },
  { id:3, title:"ペット写真撮影会 春の部", date:"2026.05.03", time:"11:00〜15:00", place:"大阪城公園", pref:"大阪府", pet:"both", fee:"1,000円", image:"📸", organizer:"ぽちフォト", url:"https://example.com", desc:"プロカメラマンによるペット撮影会。春の花をバックに最高の一枚を残しましょう！", likes:95, joins:67, comments:31, category:"撮影会", bg:"#E3F2FD" },
  { id:4, title:"ハンドメイドペットグッズマーケット", date:"2026.05.10", time:"10:00〜16:00", place:"名古屋市中区栄", pref:"愛知県", pet:"both", fee:"無料", image:"🎨", organizer:"てづくり屋", url:"https://example.com", desc:"全国のハンドメイド作家が集まるペット用品マーケット。世界に一つだけのグッズに出会えます。", likes:77, joins:55, comments:18, category:"マーケット", bg:"#E8F5E9" },
  { id:5, title:"ドッグトレーニング体験会", date:"2026.05.15", time:"09:00〜12:00", place:"福岡市西区室見川河川敷", pref:"福岡県", pet:"dog", fee:"2,000円", image:"🎓", organizer:"ドッグトレーナー山本", url:"https://example.com", desc:"プロトレーナーによるしつけ体験会。吠え・引っ張り・トイレトラブルなど何でも相談可！", likes:43, joins:28, comments:9, category:"体験会", bg:"#E0F7FA" },
  { id:6, title:"わんにゃん健康フェア", date:"2026.05.22", time:"10:00〜17:00", place:"札幌市中島公園", pref:"北海道", pet:"both", fee:"無料", image:"🏥", organizer:"北海道獣医師会", url:"https://example.com", desc:"獣医師による無料健康相談、ワクチン割引、フードサンプル配布など盛りだくさん！", likes:112, joins:93, comments:27, category:"健康", bg:"#FCE4EC" },
];
const EVENT_PREFS = ["すべて","北海道","東京都","大阪府","愛知県","福岡県"];
const EVENT_CATS = ["すべて","フェスタ","交流会","撮影会","マーケット","体験会","健康"];
const evPetLabel = (p) => p==="dog"?"🐕 犬":p==="cat"?"🐈 猫":"🐾 両方";
const evPetColor = (p) => p==="dog"?C.orange:p==="cat"?"#9C27B0":C.green;
const evPetBg = (p) => p==="dog"?C.orangePale:p==="cat"?"#F3E5F5":C.greenPale;

// ── Mock Orders ───────────────────────────────────────────────────────────
const MOCK_ORDERS = [
  { id:"QOC-2026-0501", item:"愛犬の水彩似顔絵", seller:"みかん工房", price:3800, status:"completed", date:"2026.03.15", deliveredAt:"2026.03.20", completedAt:"2026.03.21", emoji:"🎨", bg:"#FFF3E0" },
  { id:"QOC-2026-0512", item:"猫ちゃん専用ニット服", seller:"てづくり屋さん", price:5200, status:"delivered", date:"2026.04.08", deliveredAt:"2026.04.11", emoji:"🧶", bg:"#F3E5F5" },
  { id:"QOC-2026-0520", item:"デジタル似顔絵（即日）", seller:"イラスト工房ハル", price:1500, status:"working", date:"2026.04.12", emoji:"💻", bg:"#FFF8E1" },
  { id:"QOC-2026-0489", item:"しつけ個別相談60分", seller:"ドッグトレーナー山本", price:6000, status:"disputed", date:"2026.04.07", deliveredAt:"2026.04.10", emoji:"🎓", bg:"#E0F7FA", disputeReason:"予約時間にトレーナーが現れなかった", disputeStatus:"investigating" },
  { id:"QOC-2026-0410", item:"アクリルキーホルダー", seller:"クリエイトパレット", price:2200, status:"refunded", date:"2026.03.25", emoji:"✨", bg:"#E8F5E9", disputeReason:"商品が届かない（配送事故）" },
];

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

// ── Mock Notifications ────────────────────────────────────────────────────
const MOCK_NOTIFICATIONS = [
  { id:1, type:"order", title:"納品がありました", body:"「猫ちゃん専用ニット服」が納品されました。内容をご確認ください。", link:"orders", isRead:false, date:"2026.04.11 14:30" },
  { id:2, type:"order", title:"作業が開始されました", body:"「デジタル似顔絵（即日）」の作業が開始されました。", link:"orders", isRead:false, date:"2026.04.12 10:00" },
  { id:3, type:"dispute", title:"異議の調査を開始しました", body:"「しつけ個別相談60分」の異議について調査を開始しました。", link:"orders", isRead:true, date:"2026.04.10 16:00" },
  { id:4, type:"system", title:"レビューをお願いします", body:"「愛犬の水彩似顔絵」のレビューを書いてみませんか？", link:"orders", isRead:true, date:"2026.03.22 09:00" },
  { id:5, type:"support", title:"サポートから返信がありました", body:"お問い合わせ TKT-0012 に返信がありました。", link:"support", isRead:false, date:"2026.04.11 13:00" },
];

// ── Mock Messages ─────────────────────────────────────────────────────────
const MOCK_CONVERSATIONS = [
  { id:1, orderId:"QOC-2026-0512", partner:"てづくり屋さん", partnerIcon:"🧶", lastMsg:"サイズの件、確認しますね！", date:"2026.04.11", unread:1, messages:[
    { from:"me", text:"Mサイズで注文したのですが、確認お願いします！", time:"2026.04.10 15:00" },
    { from:"partner", text:"サイズの件、確認しますね！少々お待ちください。", time:"2026.04.11 09:30" },
  ]},
  { id:2, orderId:"QOC-2026-0520", partner:"イラスト工房ハル", partnerIcon:"💻", lastMsg:"写真ありがとうございます！本日中に納品します。", date:"2026.04.12", unread:0, messages:[
    { from:"me", text:"よろしくお願いします！こちらが愛犬の写真です。", time:"2026.04.12 10:05" },
    { from:"partner", text:"写真ありがとうございます！本日中に納品します。", time:"2026.04.12 10:20" },
  ]},
];

const MOCK_SUPPORT_MSGS = [
  { from:"me", text:"しつけ相談の件で、予約時間にトレーナーが現れませんでした。返金をお願いしたいです。", time:"2026.04.10 11:00" },
  { from:"support", text:"お問い合わせありがとうございます。受付番号: TKT-0012。内容を確認し、48時間以内にご回答いたします。", time:"2026.04.10 11:00" },
  { from:"support", text:"出品者に確認したところ、体調不良で連絡が遅れたとのことです。現在、対応方法を検討中です。", time:"2026.04.11 13:00" },
];

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

// ── PC用サイドバー ────────────────────────────────────────────────────────
const Sidebar = ({ setPage, activeCat, setActiveCat }) => (
  <div style={{ width:260, flexShrink:0, alignSelf:"flex-start", position:"sticky", top:92, paddingTop:24 }}>
    <div style={{ fontSize:13, fontWeight:800, color:C.warmGray, marginBottom:12, padding:"0 8px" }}>カテゴリ</div>
    {CATS.map(c=>(
      <button key={c.id} onClick={()=>{ setActiveCat(c.id); setPage("search"); }} style={{
        width:"100%", padding:"12px 18px", border:"none", borderRadius:12,
        background: activeCat===c.id ? C.orangePale : "transparent",
        color: activeCat===c.id ? C.orange : C.dark,
        fontWeight:700, fontSize:15, cursor:"pointer", textAlign:"left",
        display:"flex", alignItems:"center", gap:12, fontFamily:"inherit",
        marginBottom:2, transition:"background 0.15s"
      }}>
        <span style={{ fontSize:22 }}>{c.icon}</span>
        <span>{c.label}</span>
      </button>
    ))}
    <div style={{ margin:"20px 8px", borderTop:`1px solid ${C.border}` }}/>
    <button onClick={()=>setPage("events")} style={{
      width:"100%", padding:"12px 18px", border:"none", borderRadius:12,
      background: "transparent", color:C.dark,
      fontWeight:700, fontSize:15, cursor:"pointer", textAlign:"left",
      display:"flex", alignItems:"center", gap:12, fontFamily:"inherit",
      marginBottom:2
    }}>
      <span style={{ fontSize:22 }}>📅</span>
      <span>イベント</span>
    </button>
    <div style={{ margin:"12px 8px", borderTop:`1px solid ${C.border}` }}/>
    <button onClick={()=>setPage("sell")} style={{
      width:"100%", padding:"14px 18px", border:"none", borderRadius:12,
      background:C.orange, color:"#fff", fontWeight:800, fontSize:15,
      cursor:"pointer", fontFamily:"inherit"
    }}>🐾 出品する</button>
  </div>
);

// ── User Menu (ログイン後のアイコンメニュー) ──────────────────────────────
const UserMenu = ({ setPage }) => {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "ユーザー";
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    setPage("home");
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={()=>setOpen(!open)} style={{
        width:36, height:36, borderRadius:"50%", background:C.orange,
        border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:15, fontWeight:800, color:"#fff"
      }}>{initial}</button>
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
            { icon:"📦", label:"注文履歴", action:()=>{ setPage("mypage"); setOpen(false); }},
            { icon:"⚙️", label:"設定", action:()=>{ setPage("mypage"); setOpen(false); }},
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

// ── Mobile Navbar ─────────────────────────────────────────────────────────
const Navbar = ({ setPage, liked, search, setSearch }) => {
  const { user } = useAuth();
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
        {user && (
          <span onClick={()=>setPage("mypage")} style={{ cursor:"pointer", fontSize:20, position:"relative" }}>
            🔔
            {MOCK_NOTIFICATIONS.filter(n=>!n.isRead).length > 0 && (
              <span style={{ position:"absolute", top:-4, right:-4, width:14, height:14, background:C.red, borderRadius:"50%", fontSize:9, color:"#fff", fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {MOCK_NOTIFICATIONS.filter(n=>!n.isRead).length}
              </span>
            )}
          </span>
        )}
        {user ? (
          <UserMenu setPage={setPage}/>
        ) : (
          <button onClick={()=>setPage("signup")} style={{
            padding:"7px 14px", background:C.orange, border:"none", borderRadius:10,
            color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer", whiteSpace:"nowrap"
          }}>ログイン</button>
        )}
      </div>
    </nav>
  );
};

// ── HOME (Mobile) ─────────────────────────────────────────────────────────
const HomePage = ({ setPage, listings, liked, onLike, onDetail }) => {
  const [activeCat, setActiveCat] = useState("all");
  // 人気 = お気に入り数順（fallback: レビュー数順）
  const popular = [...listings].sort((a,b) => (b.favorite_count||b.reviews||0) - (a.favorite_count||a.reviews||0)).slice(0,4);
  // 新着 = 作成日順（DBデータはcreated_at、モックデータはid逆順）
  const newItems = [...listings].sort((a,b) => {
    if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at);
    return (b.id > a.id) ? 1 : -1;
  }).slice(0,4);

  return (
    <div>
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
            <button onClick={()=>setPage("search")} style={{ padding:"13px 24px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>🔍 サービスを探す</button>
            <button onClick={()=>setPage("sell")} style={{ padding:"13px 20px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>出品者になる →</button>
          </div>
          <div style={{ display:"flex", gap:24, marginTop:24 }}>
            {[["1,200+","出品"],["8,400+","登録者"],["4.8","評価"]].map(([v,l])=>(
              <div key={l}><div style={{ fontSize:20, fontWeight:900, color:C.orange }}>{v}</div><div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{l}</div></div>
            ))}
          </div>
        </div>
      </section>

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

      <section style={{ padding:"24px 16px", background:C.cream }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>🔥 人気のサービス</h2>
          <button onClick={()=>setPage("search")} style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, color:C.warmGray, cursor:"pointer" }}>すべて →</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {popular.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
        </div>
      </section>

      <section style={{ padding:"0 16px 24px", background:C.cream }}>
        <div style={{ background:`linear-gradient(135deg, ${C.orange}, ${C.orangeLight})`, borderRadius:20, padding:"28px 20px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", right:-10, top:-10, fontSize:100, opacity:0.1 }}>🐾</div>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.8)", marginBottom:6 }}>CREATOR WANTED</div>
          <h3 style={{ fontSize:22, fontWeight:900, color:"#fff", marginBottom:10, lineHeight:1.3 }}>あなたのスキルを<br/>ペット好きに届けよう</h3>
          <p style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginBottom:18 }}>初回出品は手数料0%！購入者は表示価格のみ</p>
          <button onClick={()=>setPage("sell")} style={{ padding:"12px 24px", background:"#fff", border:"none", borderRadius:12, color:C.orange, fontWeight:800, fontSize:14, cursor:"pointer" }}>🐾 無料で出品を始める</button>
        </div>
      </section>

      <section style={{ padding:"0 16px 24px", background:C.cream }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>🆕 新着サービス</h2>
          <button onClick={()=>setPage("search")} style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, color:C.warmGray, cursor:"pointer" }}>すべて →</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {newItems.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
        </div>
      </section>

      {/* ── ランキングセクション ── */}
      <section style={{ padding:"24px 16px", background:C.white, borderTop:`1px solid ${C.border}` }}>
        <h2 style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:4 }}>🏆 人気サービスランキング</h2>
        <p style={{ fontSize:12, color:C.warmGray, marginBottom:16 }}>お気に入り数が多い順</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[...listings].sort((a,b) => (b.favorite_count||0) - (a.favorite_count||0)).slice(0,5).map((item, i) => (
            <div key={item.id} onClick={()=>onDetail(item)} style={{
              display:"flex", alignItems:"center", gap:12, padding:"12px", background:i===0?C.orangePale:C.lightGray,
              borderRadius:14, cursor:"pointer", border:i===0?`2px solid ${C.orange}`:`1px solid ${C.border}`
            }}>
              <div style={{
                width:32, height:32, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:900, fontSize:14, color:i<3?"#fff":C.warmGray,
                background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.border
              }}>{i+1}</div>
              <div style={{ width:48, height:48, borderRadius:10, overflow:"hidden", flexShrink:0, background:item.bg||C.lightGray, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:24 }}>{item.emoji}</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
                <div style={{ fontSize:11, color:C.warmGray }}>{item.seller}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:900, color:C.orange }}>¥{item.price?.toLocaleString()}</div>
                <div style={{ fontSize:10, color:C.warmGray }}>❤️ {item.favorite_count||0}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding:"24px 16px", background:C.cream }}>
        <h2 style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:4 }}>⭐ クリエイターランキング</h2>
        <p style={{ fontSize:12, color:C.warmGray, marginBottom:16 }}>出品数が多い順</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {(() => {
            const creators = {};
            listings.forEach(l => {
              if (!creators[l.seller]) creators[l.seller] = { name:l.seller, avatar:l.sellerAvatar, icon:l.sellerIcon, count:0, totalPrice:0 };
              creators[l.seller].count++;
              creators[l.seller].totalPrice += (l.price||0);
            });
            return Object.values(creators).sort((a,b) => b.count - a.count).slice(0,5);
          })().map((cr, i) => (
            <div key={cr.name} style={{
              display:"flex", alignItems:"center", gap:12, padding:"12px", background:i===0?C.orangePale:C.lightGray,
              borderRadius:14, border:i===0?`2px solid ${C.orange}`:`1px solid ${C.border}`
            }}>
              <div style={{
                width:32, height:32, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:900, fontSize:14, color:i<3?"#fff":C.warmGray,
                background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.border
              }}>{i+1}</div>
              <div style={{ width:44, height:44, borderRadius:"50%", overflow:"hidden", flexShrink:0, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {cr.avatar ? <img src={cr.avatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:20 }}>{cr.icon||"🐾"}</span>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{cr.name}</div>
                <div style={{ fontSize:11, color:C.warmGray }}>{cr.count}件の出品</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── イベント情報セクション ── */}
      <section style={{ padding:"24px 16px", background:C.white, borderTop:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>📅 イベント情報</h2>
          <button onClick={()=>setPage("events")} style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, color:C.warmGray, cursor:"pointer" }}>すべて →</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {EVENTS.slice(0,3).map(ev => (
            <div key={ev.id} onClick={()=>setPage("events")} style={{
              display:"flex", gap:12, padding:"14px", background:C.lightGray, borderRadius:14, cursor:"pointer", border:`1px solid ${C.border}`
            }}>
              <div style={{ width:50, height:50, borderRadius:12, background:ev.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{ev.image}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.title}</div>
                <div style={{ fontSize:11, color:C.warmGray }}>📅 {ev.date}　📍 {ev.pref}</div>
                <div style={{ display:"flex", gap:6, marginTop:4 }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:ev.pet==="dog"?C.orangePale:ev.pet==="cat"?"#F3E5F5":C.greenPale, color:ev.pet==="dog"?C.orange:ev.pet==="cat"?"#9C27B0":C.green, fontWeight:700 }}>
                    {ev.pet==="dog"?"🐕 犬":ev.pet==="cat"?"🐈 猫":"🐾 両方"}
                  </span>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.bluePale, color:C.blue, fontWeight:700 }}>{ev.fee}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding:"32px 16px", background:C.dark }}>
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
  if (sort === "popular") results = [...results].sort((a,b) => b.reviews - a.reviews);
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
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportDone, setReportDone] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  if (!item) return null;

  const itemOptions = item.options || [];
  const optionsTotal = itemOptions.reduce((sum, o, i) => sum + (selectedOptions[i] ? (o.price||0) : 0), 0);
  const totalPrice = (item.price || 0) + optionsTotal;

  const toggleOption = (idx) => setSelectedOptions(prev => ({...prev, [idx]: !prev[idx]}));

  const handleOrder = () => {
    if (!user) { setPage("signup"); return; }
    setShowConfirm(true);
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
          {[["⏱️ 納期", item.delivery],["🐾 対象", item.pet==="dog"?"🐕 犬向け":item.pet==="cat"?"🐈 猫向け":"🐾 両対応"],["🔒 保証","エスクロー決済"]].map(([k,v])=>(
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

      {/* 購入確認モーダル */}
      {showConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={()=>setShowConfirm(false)}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 20px", width:"100%" }} onClick={e=>e.stopPropagation()}>
            {ordered ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
                <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>注文が確定しました！</div>
                <div style={{ fontSize:13, color:C.warmGray, lineHeight:1.7, marginBottom:4 }}>出品者が作業を開始します。メッセージで詳細をご相談ください。</div>
                <div style={{ background:C.orangePale, borderRadius:10, padding:"10px", margin:"12px 0", fontSize:12, color:C.orange }}>🔒 お支払いはエスクローで安全に保護されています</div>
                <button onClick={()=>setShowConfirm(false)} style={{ padding:"12px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>OK</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:16 }}>🛒 注文内容の確認</div>
                <div style={{ background:C.lightGray, borderRadius:14, padding:"14px", marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:8 }}>{item.title}</div>
                  <div style={{ fontSize:12, color:C.warmGray, marginBottom:12 }}>{item.seller} · 納期 {item.delivery}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0", borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:14, fontWeight:800, color:C.dark }}>お支払い金額</span>
                    <span style={{ fontSize:20, fontWeight:900, color:C.orange }}>¥{item.price.toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ background:"#E3F2FD", borderRadius:10, padding:"10px", marginBottom:12, fontSize:11, color:C.blue, lineHeight:1.6 }}>
                  🔒 エスクロー決済：お支払いはQoccaが安全にお預かりし、取引完了後に出品者へ支払われます。
                </div>
                <div style={{ fontSize:10, color:C.warmGray, lineHeight:1.6, marginBottom:16 }}>
                  「注文を確定する」をクリックすると、<span style={{ color:C.orange, fontWeight:700 }}>利用規約</span>・<span style={{ color:C.orange, fontWeight:700 }}>キャンセルポリシー</span>に同意したものとみなされます。
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>setShowConfirm(false)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
                  <button onClick={()=>setOrdered(true)} style={{ flex:2, padding:"13px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>🐾 注文を確定する</button>
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
          <div style={{ fontSize:11, color:C.warmGray }}>お支払い金額{optionsTotal > 0 ? "（オプション込）" : ""}</div>
          <div style={{ fontSize:24, fontWeight:900, color:C.orange }}>¥{totalPrice.toLocaleString()}</div>
          {optionsTotal > 0 && <div style={{ fontSize:10, color:C.warmGray }}>基本 ¥{item.price.toLocaleString()} + オプション ¥{optionsTotal.toLocaleString()}</div>}
        </div>
        {ordered ? (
          <div style={{ flex:2, textAlign:"center", padding:"12px", background:C.green, borderRadius:12, color:"#fff", fontWeight:800 }}>🎉 注文完了！</div>
        ) : (
          <button onClick={handleOrder} style={{ flex:2, padding:"14px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer" }}>
            {user ? "🐾 注文する" : "🔒 ログインして注文"}
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
  const [form, setForm] = useState({ cat:"", pet:"both", title:"", desc:"", price:"", delivery:"" });
  const [images, setImages] = useState([]);
  const [options, setOptions] = useState([]);
  const up = (k,v) => setForm(p=>({...p,[k]:v}));
  const fileRef = useRef(null);
  const addOption = () => setOptions(prev => [...prev, { name:"", price:"" }]);
  const updateOption = (idx, key, val) => setOptions(prev => prev.map((o,i) => i===idx ? {...o, [key]:val} : o));
  const removeOption = (idx) => setOptions(prev => prev.filter((_,i) => i!==idx));

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) { setError("画像は最大5枚までです"); return; }
    setImages(prev => [...prev, ...files].slice(0, 5));
    setError("");
  };
  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    const { error: err } = await submitListing(user.id, form, images, options.map(o => ({ name:o.name, price:parseInt(o.price)||0 })));
    setSubmitting(false);
    if (err) { setError("出品に失敗しました: " + err.message); return; }
    setDone(true);
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

  if (done) return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", padding:32 }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
        <h2 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:10 }}>出品完了！</h2>
        <p style={{ color:C.warmGray, fontSize:14, lineHeight:1.7, marginBottom:24 }}>審査後（最大24時間）に公開されます🐾</p>
        <button onClick={()=>{setDone(false);setStep(1);setForm({cat:"",pet:"both",title:"",desc:"",price:"",delivery:""});setImages([]);setOptions([]);}} style={{ padding:"12px 28px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>続けて出品する</button>
      </div>
    </div>
  );

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
          </>}
          {step===3&&<>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:20 }}>確認して出品</h2>
            <div style={{ background:C.lightGray, borderRadius:14, padding:"16px", marginBottom:20 }}>
              {[
                ["カテゴリ", CATS.find(c=>c.id===form.cat)?.label||"未設定"],
                ["タイトル", form.title||"未入力"],
                ["料金", form.price?`¥${Number(form.price).toLocaleString()}`:"未設定"],
                ["納期", form.delivery||"未設定"],
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
            <button disabled={submitting} onClick={()=>step<3?setStep(s=>s+1):handleSubmit()} style={{ flex:2, padding:"13px", background:submitting?C.warmGray:C.orange, border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:submitting?"not-allowed":"pointer", color:"#fff", fontFamily:"inherit" }}>
              {submitting ? "送信中..." : step<3 ? "次へ →" : "🐾 出品する！"}
            </button>
          </div>
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
const MyPage = ({ setPage }) => {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("profile");

  if (!user) return null;

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "ユーザー";
  const initial = displayName.charAt(0).toUpperCase();
  const provider = user?.app_metadata?.provider;
  const providerLabel = provider === "google" ? "Google" : provider === "twitter" ? "X" : "メール";
  const unreadNotifs = MOCK_NOTIFICATIONS.filter(n=>!n.isRead).length;
  const unreadMsgs = MOCK_CONVERSATIONS.reduce((s,c)=>s+c.unread,0);

  const handleSignOut = async () => { await signOut(); setPage("home"); };

  const tabs = [
    { id:"profile", icon:"👤", label:"プロフィール" },
    { id:"orders", icon:"📦", label:"注文履歴", badge:MOCK_ORDERS.filter(o=>o.status==="delivered").length },
    { id:"messages", icon:"💬", label:"メッセージ", badge:unreadMsgs },
    { id:"notifications", icon:"🔔", label:"通知", badge:unreadNotifs },
    { id:"support", icon:"🎧", label:"サポート" },
  ];

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, padding:"80px 16px 40px" }}>
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        {/* Tab Navigation */}
        <div style={{ display:"flex", gap:4, marginBottom:20, overflowX:"auto", paddingBottom:4 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flexShrink:0, padding:"8px 16px", border:`1.5px solid ${tab===t.id?C.orange:C.border}`,
              borderRadius:12, background:tab===t.id?C.orangePale:C.white,
              color:tab===t.id?C.orange:C.warmGray, fontSize:12, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6, position:"relative"
            }}>
              <span>{t.icon}</span>{t.label}
              {t.badge > 0 && <span style={{ background:C.orange, color:"#fff", fontSize:9, fontWeight:800, padding:"1px 6px", borderRadius:8, minWidth:14, textAlign:"center" }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab==="profile" && (
          <>
            <div style={{ background:C.white, borderRadius:20, padding:"28px 20px", border:`1px solid ${C.border}`, textAlign:"center", marginBottom:20 }}>
              <div style={{ width:72, height:72, borderRadius:"50%", background:C.orange, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:900, color:"#fff", margin:"0 auto 12px" }}>{initial}</div>
              <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:4 }}>{displayName}</div>
              <div style={{ fontSize:13, color:C.warmGray, marginBottom:8 }}>{user?.email}</div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", background:C.orangePale, borderRadius:20, fontSize:11, fontWeight:700, color:C.orange }}>{providerLabel}でログイン中</div>
            </div>
            <div style={{ background:C.white, borderRadius:20, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {[
                { icon:"📦", label:"注文履歴", desc:"過去の注文を確認", action:()=>setTab("orders") },
                { icon:"💬", label:"メッセージ", desc:"取引メッセージ", action:()=>setTab("messages") },
                { icon:"🔔", label:"通知", desc:`${unreadNotifs}件の未読`, action:()=>setTab("notifications") },
                { icon:"🎧", label:"サポート", desc:"お問い合わせ", action:()=>setTab("support") },
              ].map((item, i) => (
                <button key={item.label} onClick={item.action} style={{
                  width:"100%", padding:"16px 20px", border:"none", borderBottom: i < 3 ? `1px solid ${C.border}` : "none",
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

        {/* Orders Tab */}
        {tab==="orders" && <OrdersTab/>}

        {/* Messages Tab */}
        {tab==="messages" && <MessagesTab/>}

        {/* Notifications Tab */}
        {tab==="notifications" && <NotificationsTab/>}

        {/* Support Tab */}
        {tab==="support" && <SupportTab/>}
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

// ── Orders Tab ────────────────────────────────────────────────────────────
const OrdersTab = () => {
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [selected, setSelected] = useState(null);
  const [showDispute, setShowDispute] = useState(null);
  const [filter, setFilter] = useState("all");

  const filtered = orders.filter(o => filter==="all" || o.status===filter);

  const statusLabel = (s) => {
    const map = { pending:{text:"注文確定",bg:C.orangePale,color:C.orange}, working:{text:"作業中",bg:"#E3F2FD",color:C.blue}, delivered:{text:"納品済み",bg:"#FFF3E0",color:C.orange}, completed:{text:"取引完了",bg:C.greenPale,color:C.green}, disputed:{text:"異議中",bg:"#FFEBEE",color:C.red}, refunded:{text:"返金済み",bg:"#FFEBEE",color:C.red}, cancelled:{text:"キャンセル",bg:C.lightGray,color:C.warmGray} };
    return map[s] || {text:s,bg:C.lightGray,color:C.warmGray};
  };

  const handleConfirm = (orderId) => {
    setOrders(prev=>prev.map(o=>o.id===orderId?{...o,status:"completed",completedAt:new Date().toLocaleDateString("ja-JP").replace(/\//g,".")}:o));
    setSelected(null);
  };

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

      {filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px" }}><div style={{ fontSize:40, marginBottom:8 }}>📦</div><div style={{ fontWeight:700, color:C.warmGray }}>注文がありません</div></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.map(order => {
            const st = statusLabel(order.status);
            return (
              <div key={order.id} onClick={()=>setSelected(selected?.id===order.id?null:order)} style={{
                background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", cursor:"pointer"
              }}>
                <div style={{ padding:"16px", display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:order.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{order.emoji}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{order.item}</span>
                      <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6, flexShrink:0 }}>{st.text}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.warmGray }}>{order.seller} · {order.date}</div>
                    <div style={{ fontSize:15, fontWeight:900, color:C.orange, marginTop:4 }}>¥{order.price.toLocaleString()}</div>
                  </div>
                </div>

                {selected?.id===order.id && (
                  <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px", background:C.lightGray }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.warmGray, marginBottom:4 }}>注文番号: {order.id}</div>
                    <OrderStatusBar status={order.status}/>

                    {order.status==="disputed" && (
                      <div style={{ background:"#FFEBEE", borderRadius:12, padding:"12px", marginTop:8, fontSize:12, color:C.red }}>
                        <div style={{ fontWeight:700, marginBottom:4 }}>⚠️ 異議申し立て中</div>
                        <div>{order.disputeReason}</div>
                        <div style={{ fontSize:11, color:C.warmGray, marginTop:4 }}>ステータス: {order.disputeStatus==="investigating"?"調査中":"回答待ち"}</div>
                      </div>
                    )}

                    {order.status==="refunded" && (
                      <div style={{ background:"#FFEBEE", borderRadius:12, padding:"12px", marginTop:8, fontSize:12, color:C.red }}>
                        <div style={{ fontWeight:700 }}>💸 返金済み</div>
                        <div>{order.disputeReason}</div>
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
                        <button style={{
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
      {showDispute && <DisputeModal order={showDispute} onClose={()=>setShowDispute(null)} onSubmit={(orderId, reason, desc)=>{
        setOrders(prev=>prev.map(o=>o.id===orderId?{...o,status:"disputed",disputeReason:desc,disputeStatus:"new"}:o));
        setShowDispute(null);
      }}/>}
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
const MessagesTab = () => {
  const [convos] = useState(MOCK_CONVERSATIONS);
  const [selected, setSelected] = useState(null);
  const [input, setInput] = useState("");

  return (
    <div>
      {!selected ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {convos.map(c=>(
            <button key={c.id} onClick={()=>setSelected(c)} style={{
              background:C.white, borderRadius:14, padding:"14px", border:`1px solid ${C.border}`,
              cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:12, width:"100%"
            }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{c.partnerIcon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{c.partner}</span>
                  <span style={{ fontSize:10, color:C.warmGray }}>{c.date}</span>
                </div>
                <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>{c.orderId}</div>
                <div style={{ fontSize:12, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.lastMsg}</div>
              </div>
              {c.unread>0 && <div style={{ width:20, height:20, borderRadius:"50%", background:C.orange, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{c.unread}</div>}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.orange }}>←</button>
            <span style={{ fontSize:20 }}>{selected.partnerIcon}</span>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{selected.partner}</div>
              <div style={{ fontSize:10, color:C.warmGray }}>{selected.orderId}</div>
            </div>
          </div>
          <div style={{ padding:"16px", minHeight:250, display:"flex", flexDirection:"column", gap:10 }}>
            {selected.messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.from==="me"?"flex-end":"flex-start" }}>
                <div style={{
                  maxWidth:"75%", padding:"10px 14px", borderRadius:14,
                  background:m.from==="me"?C.orange:"#F0EFEC",
                  color:m.from==="me"?"#fff":C.dark,
                  borderBottomRightRadius:m.from==="me"?4:14,
                  borderBottomLeftRadius:m.from==="me"?14:4,
                }}>
                  <div style={{ fontSize:13, lineHeight:1.6 }}>{m.text}</div>
                  <div style={{ fontSize:9, marginTop:4, opacity:0.5, textAlign:"right" }}>{m.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder="メッセージを入力..."
              style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            <button style={{ padding:"10px 16px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>送信</button>
          </div>
          <div style={{ padding:"4px 16px 12px", fontSize:10, color:C.warmGray }}>⚠️ プラットフォーム外での連絡先交換は禁止されています</div>
        </div>
      )}
    </div>
  );
};

// ── Notifications Tab ─────────────────────────────────────────────────────
const NotificationsTab = () => {
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);

  const markRead = (id) => setNotifs(prev=>prev.map(n=>n.id===id?{...n,isRead:true}:n));
  const typeIcon = (t) => t==="order"?"📦":t==="dispute"?"⚠️":t==="support"?"🎧":"🔔";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {notifs.map(n=>(
        <div key={n.id} onClick={()=>markRead(n.id)} style={{
          background:n.isRead?C.white:C.orangePale, borderRadius:14, padding:"14px",
          border:`1px solid ${n.isRead?C.border:C.orange}`, cursor:"pointer", transition:"background 0.2s"
        }}>
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <div style={{ fontSize:20, marginTop:2 }}>{typeIcon(n.type)}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{n.title}</span>
                {!n.isRead && <div style={{ width:8, height:8, borderRadius:"50%", background:C.orange }}/>}
              </div>
              <div style={{ fontSize:12, color:"#555", lineHeight:1.6 }}>{n.body}</div>
              <div style={{ fontSize:10, color:C.warmGray, marginTop:6 }}>{n.date}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Support Tab ───────────────────────────────────────────────────────────
const SupportTab = () => {
  const [msgs, setMsgs] = useState(MOCK_SUPPORT_MSGS);
  const [input, setInput] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const sendMsg = () => {
    if (!input.trim()) return;
    setMsgs(prev=>[...prev, { from:"me", text:input, time:new Date().toLocaleString("ja-JP",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(/\//g,".") }]);
    setInput("");
    // Simulate auto-reply
    setTimeout(()=>{
      setMsgs(prev=>[...prev, { from:"support", text:"お問い合わせありがとうございます。内容を確認し、順次対応いたします。通常48時間以内にご回答いたします。", time:new Date().toLocaleString("ja-JP",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(/\//g,".") }]);
    }, 1000);
  };

  const submitNew = () => {
    if (!newSubject || !newCategory) return;
    setMsgs([{ from:"me", text:`【${newCategory}】${newSubject}\n\n${newDesc}`, time:new Date().toLocaleString("ja-JP",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(/\//g,".") }]);
    setShowNew(false);
    setTimeout(()=>{
      setMsgs(prev=>[...prev, { from:"support", text:"お問い合わせありがとうございます。受付番号: TKT-" + String(Math.floor(Math.random()*9000)+1000) + "。内容を確認し、通常48時間以内にご回答いたします。緊急の場合は「緊急」とご記入ください。", time:new Date().toLocaleString("ja-JP",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(/\//g,".") }]);
    }, 800);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.dark }}>🎧 サポート</div>
        <button onClick={()=>setShowNew(true)} style={{ padding:"7px 14px", background:C.orange, border:"none", borderRadius:8, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>+ 新規問い合わせ</button>
      </div>

      {showNew && (
        <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"16px", marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:12 }}>新規お問い合わせ</div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:4 }}>カテゴリ</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["返金","出品","注文","技術","その他"].map(c=>(
                <button key={c} onClick={()=>setNewCategory(c)} style={{
                  padding:"6px 12px", border:`1.5px solid ${newCategory===c?C.orange:C.border}`,
                  borderRadius:8, background:newCategory===c?C.orangePale:C.white,
                  color:newCategory===c?C.orange:C.warmGray, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
                }}>{c}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:4 }}>件名</div>
            <input value={newSubject} onChange={e=>setNewSubject(e.target.value)} placeholder="例：返金の進捗について"
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:4 }}>詳細</div>
            <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} rows={3} placeholder="お問い合わせの詳細..."
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setShowNew(false)} style={{ flex:1, padding:"10px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
            <button onClick={submitNew} style={{ flex:2, padding:"10px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>送信</button>
          </div>
        </div>
      )}

      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div style={{ padding:"16px", minHeight:250, display:"flex", flexDirection:"column", gap:10 }}>
          {msgs.map((m,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:m.from==="me"?"flex-end":"flex-start" }}>
              <div style={{
                maxWidth:"80%", padding:"10px 14px", borderRadius:14,
                background:m.from==="me"?C.orange:m.from==="support"?"#E8F5E9":"#F0EFEC",
                color:m.from==="me"?"#fff":C.dark,
                borderBottomRightRadius:m.from==="me"?4:14,
                borderBottomLeftRadius:m.from==="me"?14:4,
              }}>
                {m.from==="support" && <div style={{ fontSize:10, fontWeight:700, color:C.green, marginBottom:4 }}>🎧 Qoccaサポート</div>}
                <div style={{ fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{m.text}</div>
                <div style={{ fontSize:9, marginTop:4, opacity:0.5, textAlign:"right" }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder="サポートに連絡..."
            onKeyDown={e=>{if(e.key==="Enter")sendMsg();}}
            style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
          <button onClick={sendMsg} style={{ padding:"10px 16px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>送信</button>
        </div>
      </div>
    </div>
  );
};

// ── Gallery (うちの子ギャラリー) ──────────────────────────────────────────
const GalleryPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [likedPosts, setLikedPosts] = useState({});
  const fileRef = useRef(null);

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
                  </div>
                </div>
              </div>
            ))}
          </div>
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
      updated: "2026年4月16日",
      sections: [
        { h:"第1条（適用）", p:"本規約は、Qocca（以下「当サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意した上で当サービスを利用するものとします。" },
        { h:"第2条（定義）", p:"「ユーザー」とは当サービスに登録した個人または法人を指します。「出品者」とはサービスを出品するユーザー、「購入者」とはサービスを購入するユーザーを指します。「取引」とは出品者と購入者の間で行われるサービスの売買を指します。" },
        { h:"第3条（登録）", p:"ユーザーは正確な情報を登録し、虚偽の情報を提供してはなりません。18歳未満の方は保護者の同意を得た上でご利用ください。1人につき1アカウントの登録に限ります。" },
        { h:"第4条（エスクロー決済）", p:"当サービスはエスクロー方式を採用しています。購入者の支払いは当サービスが一時預かり、取引完了後に出品者へ支払います。納品後72時間以内に購入者が受取確認も異議申し立ても行わない場合、自動的に取引完了となります。" },
        { h:"第5条（手数料）", p:"出品者は取引成立時に以下の手数料を負担します。初回取引：0%、登録後3ヶ月以内：5%＋決済手数料3.6%、通常：10%＋決済手数料3.6%。すべての手数料は出品者の売上から差し引かれます。購入者が支払う金額は出品ページに表示された価格のみです。売上金の振込には振込手数料（1回あたり275円・税込）がかかります。最低振込申請額は3,000円です。" },
        { h:"第6条（禁止事項）", p:"以下の行為を禁止します。(1)生体動物の売買 (2)プラットフォーム外への取引誘導（LINE、メール等での直接取引） (3)著作権・知的財産権を侵害する出品 (4)虚偽の情報・なりすまし (5)他のユーザーへの嫌がらせ・誹謗中傷 (6)法令に違反する行為 (7)当サービスのシステムに対する不正アクセス" },
        { h:"第7条（キャンセル・返金）", p:"作業開始前のキャンセルは購入者へ全額返金されます。納品後72時間以内に異議申し立てが可能です。出品者都合による返金の場合、購入者へ全額返金され、決済手数料は出品者が負担します。購入者都合による納品前キャンセルの場合、決済手数料（商品代金の3.6%）を差し引いた金額が返金されます。納品済み・受取確認後のキャンセルは原則不可です。" },
        { h:"第8条（異議申し立て）", p:"購入者は納品後72時間以内に異議を申し立てることができます。異議申し立て後、出品者に48時間の回答期限が設定されます。回答がない場合、自動的に購入者へ返金されます。当サービスは両者の主張を確認し、公正に判断します。" },
        { h:"第9条（ペナルティ）", p:"禁止事項に該当する行為が確認された場合、警告、出品停止、アカウント停止等の措置を取ることがあります。特に重大な違反（生体売買・詐欺）については即時アカウント停止となります。" },
        { h:"第10条（免責事項）", p:"当サービスはユーザー間の取引の仲介プラットフォームであり、出品されたサービスの品質・安全性を保証するものではありません。天災、システム障害等の不可抗力による損害について、当サービスは責任を負いません。" },
        { h:"第11条（規約の変更）", p:"当サービスは本規約を随時変更できるものとします。変更後の規約は当サービス上に掲載した時点で効力を生じます。重要な変更の場合はメールまたはアプリ内通知でお知らせします。" },
        { h:"第12条（準拠法・管轄）", p:"本規約の解釈は日本法に準拠します。本規約に関連する紛争については、大阪地方裁判所を第一審の専属的合意管轄裁判所とします。" },
      ]
    },
    privacy: {
      title: "プライバシーポリシー",
      updated: "2026年4月16日",
      sections: [
        { h:"1. 収集する情報", p:"当サービスは以下の情報を収集します。(1)アカウント情報（メールアドレス、表示名、パスワードのハッシュ値） (2)プロフィール情報（プロフィール画像、自己紹介文） (3)取引情報（注文履歴、メッセージ内容、レビュー） (4)決済情報（Stripeが処理。当サービスはクレジットカード番号を保持しません） (5)利用情報（アクセスログ、IPアドレス、ブラウザ情報）" },
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
      updated: "2026年4月16日",
      sections: [
        { h:"事業者名", p:"Qocca（個人事業）" },
        { h:"代表者", p:"正和1204（開業届提出後に本名を記載）" },
        { h:"所在地", p:"大阪府（詳細住所は請求があった場合に遅滞なく開示いたします）" },
        { h:"連絡先", p:"support@qocca.pet（お問い合わせはアプリ内サポートをご利用ください）\n電話番号は請求があった場合に遅滞なく開示いたします。" },
        { h:"販売価格", p:"各出品ページに表示された金額（税込）。購入者が支払う金額は表示価格のみです。決済手数料・サービス手数料はすべて出品者が負担します。" },
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
      {[["terms","利用規約"],["privacy","プライバシー"],["tokusho","特定商取引法"],["contact","お問い合わせ"]].map(([id,l])=>(
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
    { id:"search", icon:"🔍", label:"さがす" },
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
const PCHeroSection = ({ setPage }) => (
  <section style={{
    background:`linear-gradient(145deg, ${C.dark} 0%, ${C.darkBrown} 55%, #3D2810 100%)`,
    position:"relative", overflow:"hidden"
  }}>
    <div style={{ position:"absolute", left:-60, top:-40, fontSize:280, opacity:0.03, pointerEvents:"none" }}>🐾</div>
    <div style={{ position:"absolute", right:-40, bottom:-60, fontSize:200, opacity:0.03, pointerEvents:"none" }}>🐾</div>
    <div style={{ maxWidth:1280, margin:"0 auto", padding:"80px 48px", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 16px", background:"rgba(245,169,74,0.15)", borderRadius:20, border:"1px solid rgba(245,169,74,0.3)", marginBottom:24 }}>
        <span>🐨</span><span style={{ fontSize:13, color:C.orange, fontWeight:700 }}>ペットオーナー専門マーケット · 出品者募集中</span>
      </div>
      <h1 style={{ fontSize:52, fontWeight:900, color:"#fff", lineHeight:1.15, marginBottom:18, letterSpacing:"-1px" }}>
        うちの子のための<span style={{ color:C.orange }}>特別なもの</span>を。
      </h1>
      <p style={{ fontSize:16, color:"rgba(255,255,255,0.55)", lineHeight:1.8, marginBottom:32, maxWidth:560 }}>
        似顔絵・ハンドメイド服・フォト撮影・グッズ制作。<br/>ペット専門クリエイターが作る、世界にひとつだけの作品。
      </p>
      <div style={{ display:"flex", gap:12, marginBottom:36 }}>
        <button onClick={()=>setPage("search")} style={{ padding:"14px 36px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer" }}>🔍 サービスを探す</button>
        <button onClick={()=>setPage("sell")} style={{ padding:"14px 28px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>出品者になる →</button>
      </div>
      <div style={{ display:"flex", gap:40 }}>
        {[["1,200+","出品"],["8,400+","登録者"],["4.8","評価"],["¥0","初回手数料"]].map(([v,l])=>(
          <div key={l}><div style={{ fontSize:24, fontWeight:900, color:C.orange }}>{v}</div><div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:4 }}>{l}</div></div>
        ))}
      </div>
    </div>
  </section>
);

// ── EVENTS PAGE ───────────────────────────────────────────────────────────
const EventsPage = ({ isPC }) => {
  const [pref, setPref] = useState("すべて");
  const [cat, setCat] = useState("すべて");
  const [pet, setPet] = useState("すべて");
  const [evLiked, setEvLiked] = useState({});
  const [joined, setJoined] = useState({});
  const [selected, setSelected] = useState(null);
  const [showPost, setShowPost] = useState(false);
  const [form, setForm] = useState({ title:"", date:"", time:"", place:"", pref:"東京都", pet:"both", fee:"", organizer:"", url:"", desc:"", category:"フェスタ" });

  const filtered = EVENTS.filter(e => {
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
          <button onClick={()=>setShowPost(true)} style={{ padding:"10px 16px", border:"none", borderRadius:"10px 10px 0 0", background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>✏️ 投稿する</button>
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
      <div style={{ fontSize:13, color:C.warmGray, marginBottom:12, padding: isPC ? 0 : "0 16px" }}>{filtered.length}件のイベント</div>
      <div style={{ display:"flex", flexDirection:"column", gap:14, padding: isPC ? "0 0 24px" : "0 16px 24px" }}>
        {filtered.map(ev=>(
          <div key={ev.id} onClick={()=>setSelected(ev)} style={{ background:C.white, borderRadius:18, overflow:"hidden", border:`1px solid ${C.border}`, cursor:"pointer", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", display: isPC ? "flex" : "block" }}>
            <div style={{ height: isPC ? "auto" : 120, width: isPC ? 200 : "auto", flexShrink:0, background:ev.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize: isPC ? 48 : 60, position:"relative", minHeight: isPC ? 160 : "auto" }}>
              {ev.image}
              <div style={{ position:"absolute", top:10, left:10 }}><span style={{ background:C.orange, color:"#fff", fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:10 }}>{ev.category}</span></div>
              <div style={{ position:"absolute", top:10, right:10 }}><span style={{ background:evPetBg(ev.pet), color:evPetColor(ev.pet), fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:10 }}>{evPetLabel(ev.pet)}</span></div>
            </div>
            <div style={{ padding:"14px", flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:8, lineHeight:1.4 }}>{ev.title}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.warmGray }}><span>📅</span><span>{ev.date} {ev.time}</span></div>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.warmGray }}><span>📍</span><span>{ev.pref} {ev.place}</span></div>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.warmGray }}><span>💰</span><span>参加費：{ev.fee}</span></div>
              </div>
              <div style={{ fontSize:12, color:"#555", lineHeight:1.6, marginBottom:12, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{ev.desc}</div>
              <div style={{ display:"flex", gap:8, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                <button onClick={e2=>{e2.stopPropagation();setEvLiked(p=>({...p,[ev.id]:!p[ev.id]}));}} style={{ flex:1, padding:"8px", border:`1.5px solid ${evLiked[ev.id]?C.orange:C.border}`, borderRadius:10, background:evLiked[ev.id]?C.orangePale:C.white, color:evLiked[ev.id]?C.orange:C.warmGray, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>❤️ {ev.likes+(evLiked[ev.id]?1:0)}</button>
                <button onClick={e2=>{e2.stopPropagation();setJoined(p=>({...p,[ev.id]:!p[ev.id]}));}} style={{ flex:2, padding:"8px", border:"none", borderRadius:10, background:joined[ev.id]?C.green:C.orange, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>{joined[ev.id]?"✅ 参加予定":"🐾 参加する"} {ev.joins+(joined[ev.id]?1:0)}人</button>
                <button onClick={e2=>e2.stopPropagation()} style={{ padding:"8px 12px", border:`1.5px solid ${C.border}`, borderRadius:10, background:C.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.warmGray }}>💬 {ev.comments}</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, overflowY:"auto" }} onClick={()=>setSelected(null)}>
          <div style={{ background:C.white, margin: isPC ? "60px auto" : "40px 16px", maxWidth:600, borderRadius:24, overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
            <div style={{ height:180, background:selected.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:80, position:"relative" }}>
              {selected.image}
              <button onClick={()=>setSelected(null)} style={{ position:"absolute", top:12, right:12, width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.9)", border:"none", cursor:"pointer", fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:"20px 16px" }}>
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                <span style={{ background:C.orangePale, color:C.orange, fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:10 }}>{selected.category}</span>
                <span style={{ background:evPetBg(selected.pet), color:evPetColor(selected.pet), fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:10 }}>{evPetLabel(selected.pet)}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:14, lineHeight:1.4 }}>{selected.title}</div>
              {[["📅 日時",`${selected.date} ${selected.time}`],["📍 場所",`${selected.pref} ${selected.place}`],["💰 参加費",selected.fee],["👤 主催者",selected.organizer]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", gap:10, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.warmGray, minWidth:80 }}>{k}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{v}</span>
                </div>
              ))}
              <div style={{ margin:"14px 0", fontSize:14, color:"#555", lineHeight:1.8 }}>{selected.desc}</div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>setEvLiked(p=>({...p,[selected.id]:!p[selected.id]}))} style={{ flex:1, padding:"12px", border:`1.5px solid ${evLiked[selected.id]?C.orange:C.border}`, borderRadius:12, background:evLiked[selected.id]?C.orangePale:C.white, color:evLiked[selected.id]?C.orange:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>❤️ {selected.likes+(evLiked[selected.id]?1:0)}</button>
                <button onClick={()=>setJoined(p=>({...p,[selected.id]:!p[selected.id]}))} style={{ flex:2, padding:"12px", border:"none", borderRadius:12, background:joined[selected.id]?C.green:C.orange, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>{joined[selected.id]?"✅ 参加予定！":"🐾 参加する"}</button>
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
            {[["イベント名","title","例：わんわんフェスタ in 東京"],["日付","date","例：2026.05.01"],["時間","time","例：10:00〜17:00"],["会場名","place","例：代々木公園"],["主催者名","organizer","例：東京ペット愛好会"],["参加費","fee","例：無料 / 500円"]].map(([label,key,ph])=>(
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
                  <button key={v} onClick={()=>setForm(p=>({...p,pet:v}))} style={{ flex:1, padding:"10px", border:`2px solid ${form.pet===v?C.orange:C.border}`, borderRadius:10, background:form.pet===v?C.orangePale:C.white, color:form.pet===v?C.orange:C.warmGray, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:5 }}>イベント詳細</label>
              <textarea value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} rows={4} placeholder="イベントの詳細・見どころ..."
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
            </div>
            <div style={{ background:C.orangePale, borderRadius:12, padding:"12px", fontSize:12, color:C.orange, marginBottom:16 }}>🐾 投稿後、管理者が審査（最大24時間）してから公開されます。</div>
            <button onClick={()=>setShowPost(false)} style={{ width:"100%", padding:"14px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>🐾 投稿する</button>
          </div>
        </div>
      )}
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
            <Route path="/" element={
              <div>
                <PCHeroSection setPage={setPage}/>
                <div style={{ display:"flex", maxWidth:1280, margin:"0 auto", padding:"0 32px" }}>
                  <Sidebar setPage={setPage} activeCat={activeCat} setActiveCat={setActiveCat}/>
                  <div style={{ flex:1, minWidth:0, paddingLeft:32, paddingTop:24, paddingBottom:40 }}>
                    <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:16 }}>🔥 人気のサービス</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                      {[...listings].sort((a,b) => (b.favorite_count||b.reviews||0) - (a.favorite_count||a.reviews||0)).slice(0,3).map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
                    </div>
                    <PCBanner setPage={setPage}/>
                    <div style={{ fontSize:20, fontWeight:900, color:C.dark, margin:"24px 0 16px" }}>🆕 新着サービス</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                      {[...listings].sort((a,b) => { if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at); return (b.id > a.id) ? 1 : -1; }).slice(0,3).map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
                    </div>

                    {/* ── PC イベント情報 ── */}
                    <div style={{ fontSize:20, fontWeight:900, color:C.dark, margin:"32px 0 16px" }}>📅 イベント情報</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                      {EVENTS.slice(0,3).map(ev => (
                        <div key={ev.id} onClick={()=>setPage("events")} style={{
                          background:C.white, borderRadius:16, padding:"16px", border:`1px solid ${C.border}`, cursor:"pointer",
                          boxShadow:"0 2px 8px rgba(0,0,0,0.05)"
                        }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                            <div style={{ width:44, height:44, borderRadius:10, background:ev.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{ev.image}</div>
                            <div>
                              <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{ev.title}</div>
                              <div style={{ fontSize:11, color:C.warmGray }}>📅 {ev.date}</div>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:6 }}>
                            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.bluePale, color:C.blue, fontWeight:700 }}>{ev.fee}</span>
                            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.lightGray, color:C.warmGray, fontWeight:700 }}>📍 {ev.pref}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:20, fontWeight:900, color:C.dark, margin:"32px 0 16px" }}>📦 すべてのサービス</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                      {listings.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
                    </div>

                    {/* ── PC ランキングセクション ── */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginTop:32 }}>
                      <div style={{ background:C.white, borderRadius:16, padding:"20px", border:`1px solid ${C.border}` }}>
                        <h3 style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:4 }}>🏆 人気サービスランキング</h3>
                        <p style={{ fontSize:12, color:C.warmGray, marginBottom:16 }}>お気に入り数が多い順</p>
                        {[...listings].sort((a,b) => (b.favorite_count||0) - (a.favorite_count||0)).slice(0,5).map((item, i) => (
                          <div key={item.id} onClick={()=>onDetail(item)} style={{
                            display:"flex", alignItems:"center", gap:10, padding:"10px", marginBottom:6,
                            background:i===0?C.orangePale:"transparent", borderRadius:10, cursor:"pointer",
                            border:i===0?`1.5px solid ${C.orange}`:"1px solid transparent"
                          }}>
                            <div style={{
                              width:28, height:28, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                              fontWeight:900, fontSize:13, color:i<3?"#fff":C.warmGray,
                              background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.border
                            }}>{i+1}</div>
                            <div style={{ width:40, height:40, borderRadius:8, overflow:"hidden", flexShrink:0, background:item.bg||C.lightGray, display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {item.imageUrl ? <img src={item.imageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:20 }}>{item.emoji}</span>}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
                              <div style={{ fontSize:11, color:C.warmGray }}>{item.seller}</div>
                            </div>
                            <div style={{ textAlign:"right", flexShrink:0 }}>
                              <div style={{ fontSize:13, fontWeight:900, color:C.orange }}>¥{item.price?.toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ background:C.white, borderRadius:16, padding:"20px", border:`1px solid ${C.border}` }}>
                        <h3 style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:4 }}>⭐ クリエイターランキング</h3>
                        <p style={{ fontSize:12, color:C.warmGray, marginBottom:16 }}>出品数が多い順</p>
                        {(() => {
                          const creators = {};
                          listings.forEach(l => {
                            if (!creators[l.seller]) creators[l.seller] = { name:l.seller, avatar:l.sellerAvatar, icon:l.sellerIcon, count:0 };
                            creators[l.seller].count++;
                          });
                          return Object.values(creators).sort((a,b) => b.count - a.count).slice(0,5);
                        })().map((cr, i) => (
                          <div key={cr.name} style={{
                            display:"flex", alignItems:"center", gap:10, padding:"10px", marginBottom:6,
                            background:i===0?C.orangePale:"transparent", borderRadius:10,
                            border:i===0?`1.5px solid ${C.orange}`:"1px solid transparent"
                          }}>
                            <div style={{
                              width:28, height:28, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                              fontWeight:900, fontSize:13, color:i<3?"#fff":C.warmGray,
                              background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.border
                            }}>{i+1}</div>
                            <div style={{ width:40, height:40, borderRadius:"50%", overflow:"hidden", flexShrink:0, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {cr.avatar ? <img src={cr.avatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:18 }}>{cr.icon||"🐾"}</span>}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{cr.name}</div>
                              <div style={{ fontSize:11, color:C.warmGray }}>{cr.count}件の出品</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }/>
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
                  <EventsPage isPC={true}/>
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
          </Routes>
          <SharedFooter setPage={setPage}/>
        </div>
      ) : (
        <>
          <Routes>
            <Route path="/" element={<HomePage setPage={setPage} listings={listings} liked={liked} onLike={onLike} onDetail={onDetail}/>}/>
            <Route path="/search" element={<SearchPage listings={listings} liked={liked} onLike={onLike} onDetail={onDetail} search={search} setSearch={setSearch} isPC={false}/>}/>
            <Route path="/listing/:id" element={<DetailPageWrapper listings={listings} liked={liked} onLike={onLike}/>}/>
            <Route path="/events" element={<EventsPage isPC={false}/>}/>
            <Route path="/gallery" element={<GalleryPage setPage={setPage} isPC={false}/>}/>
            <Route path="/sell" element={<SellPage setPage={setPage}/>}/>
            <Route path="/login" element={<SignupPage setPage={setPage}/>}/>
            <Route path="/mypage" element={<MyPage setPage={setPage}/>}/>
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
