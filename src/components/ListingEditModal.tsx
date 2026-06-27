// 出品編集モーダル (App.tsx 分割 Phase6 6b Step A / 循環import回避のため抽出)
// DetailPage(pages/marketplace.tsx) と MyListingsTab(App.tsx 残留 Phase7) の両方が参照するため中立化。
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。依存=useState/supabase/C のみ。

import { useState, useRef } from "react";
import { C } from "../constants/theme";
import { CATS } from "../constants/data";
import { supabase } from "../supabaseClient";

const MAX_IMAGES = 5;

export const ListingEditModal = ({ listing, onClose, onSaved }) => {
  const [title, setTitle] = useState(listing.title || "");
  const [description, setDescription] = useState(listing.description || "");
  const [price, setPrice] = useState(listing.price?.toString() || "");
  const [delivery, setDelivery] = useState(listing.delivery_days || "");
  // 2026/6/28 ②: category + stock_quantity を編集可能に (下書きバグ修正)
  const [category, setCategory] = useState<string>(listing.category || "");
  const [stock, setStock] = useState<string>(listing.stock_quantity != null ? String(listing.stock_quantity) : "");
  // 2026/6/28 ①: 画像差替UI — 既存URL/新規File を分けて管理し、保存時に新規をアップ→最終的なURL配列をUPDATE
  const [existingUrls, setExistingUrls] = useState<string[]>(Array.isArray(listing.image_urls) ? listing.image_urls : []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const totalImageCount = existingUrls.length + newFiles.length;
  const onAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewFiles(prev => [...prev, ...files].slice(0, MAX_IMAGES - existingUrls.length));
    if (e.target) e.target.value = "";
  };
  const removeExistingUrl = (idx: number) => setExistingUrls(prev => prev.filter((_, i) => i !== idx));
  const removeNewFile = (idx: number) => setNewFiles(prev => prev.filter((_, i) => i !== idx));
  // 依頼書 #104 Phase B-2 (2026/6/3): 4タイプ送料編集 UI (SellPage と同パターン)
  const [shippingType, setShippingType] = useState<string>(listing.shipping_type || "included");
  const [shippingFee, setShippingFee] = useState<string>(listing.shipping_fee != null ? String(listing.shipping_fee) : "");
  const [shippingRates, setShippingRates] = useState<any[]>(() => {
    if (Array.isArray(listing.shipping_rates) && listing.shipping_rates.length > 0) return listing.shipping_rates;
    return [{ region:"本州", fee:0 }, { region:"北海道", fee:0 }, { region:"沖縄・離島", fee:0 }];
  });
  const [shippingNote, setShippingNote] = useState<string>(listing.shipping_note || "");
  // 依頼書 #127 Phase B (2026/6/5): methods 編集 state
  const [shippingMethods, setShippingMethods] = useState<any[]>(() => {
    if (Array.isArray(listing.shipping_methods) && listing.shipping_methods.length > 0) return listing.shipping_methods;
    return [{ id: "m1", name: "クリックポスト", fee: 185, note: "" }, { id: "m2", name: "宅急便60サイズ", fee: 750, note: "" }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    if (!title.trim()) { setError("タイトルを入力してください"); return; }
    if (!description.trim()) { setError("説明を入力してください"); return; }
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) { setError("価格は1円以上の数字を入力してください"); return; }
    // 2026/6/28 ②: category 必須(空欄禁止)
    if (!category) { setError("カテゴリを選んでください"); return; }
    // 依頼書 #127 Phase B: methods 選択時は最低1件 + 名前必須
    if (shippingType === 'methods') {
      const valid = (shippingMethods || []).filter((m:any) => m?.name?.trim());
      if (valid.length === 0) { setError("配送方法を最低1件 (名前必須) 入力してください"); return; }
    }
    // 2026/6/28 ②: stock — 空欄=null(在庫管理しない) / 数値=その値
    const stockNum = stock.trim() === "" ? null : parseInt(stock);
    if (stock.trim() !== "" && (isNaN(stockNum as number) || (stockNum as number) < 0)) {
      setError("在庫数は0以上の整数で入力してください(空欄=在庫管理しない)"); return;
    }
    // 2026/6/28 ①: 画像最低1枚必須(SellPageと同水準のバリデーション)
    if (totalImageCount === 0) { setError("画像を少なくとも1枚アップロードしてください"); return; }
    setSaving(true);
    // 2026/6/28 ①: 新規ファイルを Storage アップ → 最終的な image_urls 配列を組み立て
    const uploadedUrls: string[] = [];
    for (const file of newFiles) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${listing.seller_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("listing-images").upload(path, file);
      if (upErr) { setSaving(false); setError("画像アップロードに失敗しました: " + upErr.message); return; }
      const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(path);
      uploadedUrls.push(urlData.publicUrl);
    }
    const finalImageUrls = [...existingUrls, ...uploadedUrls];
    const { error: updErr } = await supabase
      .from("listings")
      .update({
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        delivery_days: delivery,
        // 2026/6/28 ②: 種類(category) と 在庫(stock_quantity) を UPDATE 対象に追加
        category,
        stock_quantity: stockNum,
        // 2026/6/28 ①: 画像配列を UPDATE 対象に追加 (既存URL残し+新規アップURL)
        image_urls: finalImageUrls,
        // 依頼書 #104 Phase B-2 (2026/6/3): 4タイプ送料 UPDATE
        shipping_type: shippingType,
        shipping_fee: shippingType === 'flat_rate' ? (parseInt(shippingFee) || 0) : 0,
        shipping_rates: shippingType === 'regional' ? shippingRates : [],
        shipping_note: shippingNote.trim(),
        // 依頼書 #127 Phase B (2026/6/5): methods 編集 UPDATE (他タイプ選択時は [] で後方互換)
        shipping_methods: shippingType === 'methods'
          ? (shippingMethods || [])
              .filter((m:any) => m?.name?.trim())
              .slice(0, 5)
              .map((m:any, i:number) => ({
                id: String(m.id || `m${i+1}_${Date.now().toString(36)}`),
                name: String(m.name).trim().slice(0, 40),
                fee: Math.max(0, parseInt(m.fee) || 0),
                note: String(m.note || '').trim().slice(0, 60),
              }))
          : [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);
    setSaving(false);
    if (updErr) { setError("保存に失敗しました: " + updErr.message); return; }
    onSaved();
  };

  return (
    // 依頼書 #114 (2026/6/5): TabBar(zIndex:200) 衝突解消 - 3層flex + ボトムシート型 + safe-area
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:C.white, borderRadius:"24px 24px 0 0", maxWidth:480, width:"100%", maxHeight:"88vh", display:"flex", flexDirection:"column" }}>
        {/* ── HEADER (flexShrink:0) ── */}
        <div style={{ flexShrink:0, padding:"24px 24px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>✏️ 出品を編集</h2>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
          </div>
          <p style={{ fontSize:11, color:C.warmGray, marginBottom:14, lineHeight:1.6 }}>
            ※ 大きな変更は再審査の対象になる場合があります。
          </p>
        </div>

        {/* ── BODY (flex:1 overflowY:auto minHeight:0) - 内部スクロール領域 ── */}
        <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", minHeight:0, padding:"0 24px" }}>

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

        {/* 2026/6/28 ①: 画像差替UI — 既存URL × ボタン削除 / + ボタンで新規追加(最大5枚) */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>画像（最大{MAX_IMAGES}枚）</label>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onAddImages} style={{ display:"none" }}/>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {existingUrls.map((url, i) => (
              <div key={`ex-${i}`} style={{ width:72, height:72, borderRadius:10, overflow:"hidden", position:"relative", border:`1px solid ${C.border}` }}>
                <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                <button type="button" onClick={()=>removeExistingUrl(i)} style={{ position:"absolute", top:2, right:2, width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.5)", border:"none", color:"#fff", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
              </div>
            ))}
            {newFiles.map((file, i) => (
              <div key={`new-${i}`} style={{ width:72, height:72, borderRadius:10, overflow:"hidden", position:"relative", border:`2px solid ${C.orange}` }}>
                <img src={URL.createObjectURL(file)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                <button type="button" onClick={()=>removeNewFile(i)} style={{ position:"absolute", top:2, right:2, width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.5)", border:"none", color:"#fff", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                <span style={{ position:"absolute", bottom:2, left:2, fontSize:9, color:"#fff", background:"rgba(0,0,0,0.5)", padding:"1px 4px", borderRadius:4 }}>NEW</span>
              </div>
            ))}
            {totalImageCount < MAX_IMAGES && (
              <button type="button" onClick={()=>fileRef.current?.click()} style={{ width:72, height:72, borderRadius:10, border:`2px dashed ${C.border}`, background:C.lightGray, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, color:C.warmGray }}>+</button>
            )}
          </div>
          <p style={{ fontSize:10.5, color:C.warmGray, marginTop:6, lineHeight:1.6 }}>
            ×で削除 / +で新規追加。保存時に新規分のみアップロードされます。{totalImageCount}/{MAX_IMAGES}
          </p>
        </div>

        {/* 2026/6/28 ②: 種類(category) 選択UI — SellPage L1844と同流儀のグリッド2列 */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>種類（カテゴリ）</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {CATS.filter((c:any)=>c.id!=="all").map((c:any)=>(
              <button key={c.id} type="button" onClick={()=>setCategory(c.id)} style={{
                padding:"10px 8px",
                border:`1.5px solid ${category===c.id ? C.orange : C.border}`,
                borderRadius:10,
                background:category===c.id ? C.orangePale : C.white,
                cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:"inherit",
                textAlign:"left",
              }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                <span style={{ fontSize:12, fontWeight:700, color:category===c.id ? C.orange : C.dark }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2026/6/28 ②: 在庫(stock_quantity) 入力UI — 空欄=在庫管理しない (SellPage L2086と同思想) */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>在庫数（任意）</label>
          <p style={{ fontSize:10.5, color:C.warmGray, marginBottom:6, lineHeight:1.6 }}>
            空欄 = 在庫管理しない（オーダーメイド・受注生産など）／数字を入力すると売れるたびに自動減算
          </p>
          <div style={{ position:"relative", maxWidth:160 }}>
            <input type="number" value={stock} onChange={e=>setStock(e.target.value)} placeholder="例: 10" min="0" style={{
              width:"100%", padding:"10px 32px 10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
            }}/>
            <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.warmGray }}>個</span>
          </div>
        </div>

        {/* 依頼書 #104 Phase B-2 (2026/6/3): 4タイプ送料編集 UI */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>🚚 送料設定</label>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:8 }}>
            {[
              { v:"included", label:"✅ 送料込み (無料配送)" },
              { v:"flat_rate", label:"📮 全国一律" },
              { v:"regional", label:"🗾 地域別" },
              { v:"methods", label:"📦 配送方法から選ぶ (購入者が選択)" },
              { v:"consultation", label:"💬 要相談" },
            ].map(opt => (
              <button key={opt.v} type="button" onClick={()=>setShippingType(opt.v)} style={{
                padding:"8px 12px", border:`1.5px solid ${shippingType===opt.v ? C.orange : C.border}`,
                borderRadius:8, background:shippingType===opt.v ? C.orangePale : C.white,
                textAlign:"left", fontSize:12, fontWeight:700, color:shippingType===opt.v ? C.orange : C.dark,
                cursor:"pointer", fontFamily:"inherit", display:"flex", justifyContent:"space-between", alignItems:"center"
              }}>
                <span>{opt.label}</span>
                {shippingType===opt.v && <span style={{ color:C.orange }}>✓</span>}
              </button>
            ))}
          </div>
          {shippingType === "flat_rate" && (
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.warmGray, display:"block", marginBottom:4 }}>送料 (円)</label>
              <input type="number" min="0" value={shippingFee} onChange={e=>setShippingFee(e.target.value)} placeholder="例: 800" style={{
                width:"100%", padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", boxSizing:"border-box"
              }}/>
            </div>
          )}
          {shippingType === "regional" && (
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.warmGray, display:"block", marginBottom:4 }}>地域別送料</label>
              {shippingRates.map((rate, idx) => (
                <div key={idx} style={{ display:"flex", gap:6, marginBottom:4, alignItems:"center" }}>
                  <input type="text" placeholder="地域名" value={rate.region} onChange={e=>{
                    const next = [...shippingRates]; next[idx] = { ...next[idx], region: e.target.value }; setShippingRates(next);
                  }} style={{ flex:2, padding:"6px 8px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:12, fontFamily:"inherit", boxSizing:"border-box" }}/>
                  <input type="number" min="0" placeholder="0" value={rate.fee} onChange={e=>{
                    const next = [...shippingRates]; next[idx] = { ...next[idx], fee: parseInt(e.target.value)||0 }; setShippingRates(next);
                  }} style={{ flex:1, padding:"6px 8px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:12, fontFamily:"inherit", boxSizing:"border-box" }}/>
                  <button type="button" onClick={()=>{ setShippingRates(shippingRates.filter((_,i)=>i!==idx)); }} style={{ width:28, height:28, border:"none", background:"transparent", color:"#E57373", fontSize:16, cursor:"pointer", padding:0 }}>×</button>
                </div>
              ))}
              <button type="button" onClick={()=>{ setShippingRates([...shippingRates, { region:"", fee:0 }]); }} style={{ padding:"5px 10px", background:"transparent", border:`1px dashed ${C.border}`, borderRadius:6, color:C.warmGray, fontSize:11, cursor:"pointer", fontFamily:"inherit", marginTop:4 }}>+ 地域を追加</button>
            </div>
          )}
          {shippingType === "consultation" && (
            <div style={{ background:C.orangePale, borderRadius:8, padding:"8px 10px", marginBottom:8, fontSize:11, color:C.dark, lineHeight:1.6 }}>
              💬 購入希望者から個別に送料相談があります。
            </div>
          )}
          {/* 依頼書 #127 Phase B (2026/6/5): methods 編集 UI (最大5件 / 名前必須) */}
          {shippingType === "methods" && (
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.warmGray, display:"block", marginBottom:4 }}>配送方法 (最大5件・購入者が選択)</label>
              {(shippingMethods || []).map((m:any, idx:number) => (
                <div key={idx} style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
                  <input type="text" maxLength={40} placeholder="配送方法名" value={m.name || ""} onChange={e=>{
                    const next = [...shippingMethods]; next[idx] = { ...next[idx], name: e.target.value }; setShippingMethods(next);
                  }} style={{ flex:"1 1 140px", minWidth:120, padding:"6px 8px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:12, fontFamily:"inherit", boxSizing:"border-box" }}/>
                  <input type="number" min="0" placeholder="¥" value={m.fee ?? 0} onChange={e=>{
                    const next = [...shippingMethods]; next[idx] = { ...next[idx], fee: Math.max(0, parseInt(e.target.value) || 0) }; setShippingMethods(next);
                  }} style={{ width:90, padding:"6px 8px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:12, fontFamily:"inherit", boxSizing:"border-box" }}/>
                  <input type="text" maxLength={60} placeholder="補足 (任意)" value={m.note || ""} onChange={e=>{
                    const next = [...shippingMethods]; next[idx] = { ...next[idx], note: e.target.value }; setShippingMethods(next);
                  }} style={{ flex:"1 1 120px", minWidth:100, padding:"6px 8px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:11, fontFamily:"inherit", boxSizing:"border-box" }}/>
                  <button type="button" onClick={()=>{ setShippingMethods(shippingMethods.filter((_,i)=>i!==idx)); }} style={{ width:28, height:28, border:"none", background:"transparent", color:"#E57373", fontSize:16, cursor:"pointer", padding:0 }}>×</button>
                </div>
              ))}
              {shippingMethods.length < 5 && (
                <button type="button" onClick={()=>{ setShippingMethods([...shippingMethods, { id: `m${shippingMethods.length+1}_${Date.now().toString(36)}`, name:"", fee:0, note:"" }]); }} style={{ padding:"5px 10px", background:"transparent", border:`1px dashed ${C.border}`, borderRadius:6, color:C.warmGray, fontSize:11, cursor:"pointer", fontFamily:"inherit", marginTop:4 }}>+ 配送方法を追加 ({shippingMethods.length}/5)</button>
              )}
            </div>
          )}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:C.warmGray, display:"block", marginBottom:4 }}>補足説明 (任意)</label>
            <input type="text" value={shippingNote} onChange={e=>setShippingNote(e.target.value)} placeholder="例: 同梱対応可 / 速達+500円 等" style={{
              width:"100%", padding:"7px 10px", borderRadius:8, border:`1.5px solid ${C.border}`,
              fontSize:12, fontFamily:"inherit", boxSizing:"border-box"
            }}/>
          </div>
        </div>

        </div>
        {/* ── FOOTER (flexShrink:0 + borderTop + safe-area paddingBottom) - 常時下部固定 ── */}
        <div style={{ flexShrink:0, padding:`16px 24px calc(env(safe-area-inset-bottom, 8px) + 16px)`, borderTop:`1px solid ${C.border}`, background:C.white }}>
          {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12 }}>{error}</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose} disabled={saving} style={{ flex:1, padding:"12px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit" }}>キャンセル</button>
            <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:"12px", background:saving?C.warmGray:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit" }}>{saving ? "保存中..." : "💾 保存する"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
