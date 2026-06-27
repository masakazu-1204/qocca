// コミュニティ/イベント ページ群 (App.tsx 分割 Phase5 ③community)
// PCHeroSection / EventsPage / CreateCommunityModal / CommunitiesPage / CommunityDetailPage / ReportMessageModal
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。
// ⚠️ detectContacts/detectNGWords(決済防御+SNS安全の心臓部) は utils/moderation を参照のみ。CommentModal(SNS防御) は外部モジュール。
// ⚠️ PCHeroSection は現状デッドコード(使用箇所ゼロ)だが温存のため module-private で保持 (King 判断)。

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useHeroStats } from "../hooks";
import { PET_CATEGORIES, evPetLabel, evPetColor, evPetBg } from "../constants/pets";
import { EVENT_CATS, PREFS_47_ORDER, COMMUNITY_CATEGORIES } from "../constants/data";
import { detectContacts, detectNGWords } from "../utils/moderation";
import CommentModal from "../components/CommentModal";
import type { CommentTargetType } from "../types";

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
export const EventsPage = ({ isPC, setPage }) => {
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

  // 2026/6/28 軽傷UX: イベント詳細モーダル表示中の右スワイプ/戻る で別ページに飛ばずモーダルだけ閉じる。
  //   pushState で履歴に印を積み popstate で印を見て selected=null。petwalker PR#60 と同パターン。
  const EVENT_MODAL_MARK = "community_event_modal";
  const openEvent = (ev: any) => {
    setSelected(ev);
    window.history.pushState({ [EVENT_MODAL_MARK]: ev?.id || true }, "");
  };
  const closeEvent = () => {
    const marker = (window.history.state as { [k: string]: unknown } | null)?.[EVENT_MODAL_MARK];
    if (marker) window.history.back(); else setSelected(null);
  };
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const marker = (e.state as { [k: string]: unknown } | null)?.[EVENT_MODAL_MARK];
      if (!marker) setSelected(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [form, setForm] = useState({ title:"", event_date:"", event_time:"", place:"", prefecture:"東京都", pet_type:"both", fee:"", category:"フェスタ", description:"" });
  const [submitting, setSubmitting] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ type: CommentTargetType; id: string; ownerId: string } | null>(null);

  // DB からイベントを取得
  const fetchEvents = async () => {
    setLoading(true);
    // 2026/6/28: 日付フィルタ追加 — 開催日が過ぎたイベントを自動で非表示に
    //   (再発防止: 今後も event_date < today は自動的に /events 一覧から消える)
    //   ⚠️ 履歴は events テーブルに残る (status='approved' のまま) → 後方互換・統計用
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("status", ["approved", "sold_out"])
      .gte("event_date", today)
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

  // 依頼書 #122 (2026/6/5): 旧 EVENT_PREFS 5 件固定 → 実データから動的生成
  //   - approved events の prefecture を unique 抽出
  //   - PREFS_47_ORDER (北→南順) でソート、未収録の表記揺れは末尾に
  //   - "すべて" 先頭 + 該当 0 件のフィルタ pill を並べない (UX 維持)
  const dynamicPrefs = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const p = (e as any).pref;
      if (typeof p === "string" && p.trim() !== "") set.add(p.trim());
    }
    const inOrder = PREFS_47_ORDER.filter(p => set.has(p));
    const extras = Array.from(set).filter(p => !PREFS_47_ORDER.includes(p)).sort();
    return ["すべて", ...inOrder, ...extras];
  }, [events]);

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
          {/* 依頼書 #122 (2026/6/5): 旧固定 EVENT_PREFS (5件のみ) → dynamicPrefs (events から useMemo で抽出) */}
          {dynamicPrefs.map(p=>(
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
          {/* 依頼書 #19 (5/27): 動物カテゴリ 17種フィルター (横スクロール) */}
          {[["すべて","🐾 すべて"],["both","🐾 両方"],...PET_CATEGORIES.map(c=>[c.id, `${c.icon} ${c.label}`] as [string,string])].map(([v,l])=>(
            <button key={v} onClick={()=>setPet(v)} style={{ flexShrink:0, padding:"6px 14px", border:`1.5px solid ${pet===v?C.orange:C.border}`, borderRadius:20, background:pet===v?C.orangePale:C.white, color:pet===v?C.orange:C.warmGray, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize:13, color:C.warmGray, marginBottom:12, padding: isPC ? 0 : "0 16px" }}>
        {loading ? "読み込み中..." : `${filtered.length}件のイベント`}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:14, padding: isPC ? "0 0 24px" : "0 16px 24px" }}>
        {filtered.map(ev=>(
          <div key={ev.id} onClick={()=>openEvent(ev)} style={{ background:C.white, borderRadius:18, overflow:"hidden", border:`1px solid ${C.border}`, cursor:"pointer", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", display: isPC ? "flex" : "block" }}>
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
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, overflowY:"auto" }} onClick={closeEvent}>
          <div style={{ background:C.white, margin: isPC ? "60px auto" : "40px 16px", maxWidth:600, borderRadius:24, overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
            <div style={{ height:180, background:selected.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:80, position:"relative" }}>
              {selected.image && selected.image.startsWith("http")
  ? <img src={selected.image} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
  : selected.image}
              <button onClick={closeEvent} style={{ position:"absolute", top:12, right:12, width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.9)", border:"none", cursor:"pointer", fontSize:18 }}>✕</button>
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
                {/* 依頼書 #19 (5/27): イベント投稿フォーム 動物カテゴリ 17種 */}
                {[["both","🐾 両方"],...PET_CATEGORIES.map(c=>[c.id, `${c.icon} ${c.label}`] as [string,string])].map(([v,l])=>(
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
// COMMUNITY_CATEGORIES は constants/data.ts へ移動 (Phase 1 ②)

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
export const CommunitiesPage = ({ isPC, setPage }: { isPC?: boolean; setPage:(p:string,d?:any)=>void }) => {
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
export const CommunityDetailPage = ({ isPC, setPage }: { isPC?: boolean; setPage:(p:string,d?:any)=>void }) => {
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
