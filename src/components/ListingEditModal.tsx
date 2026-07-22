// 出品編集モーダル (App.tsx 分割 Phase6 6b Step A / 循環import回避のため抽出)
// DetailPage(pages/marketplace.tsx) と MyListingsTab(App.tsx 残留 Phase7) の両方が参照するため中立化。
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。依存=useState/supabase/C のみ。

import { useState, useRef, useEffect, useCallback } from "react";
import { C } from "../constants/theme";
import { CATS } from "../constants/data";
import { supabase } from "../supabaseClient";

// 2026/7/22 Tails Up報告修正: attributes の照合キー (jsonb はキー順が正規化されるため、
// JSON.stringify 直接比較では順序ズレで不一致になる → キーをソートして正規化)
const attrKey = (a: any) => JSON.stringify(Object.keys(a || {}).sort().map(k => [k, a[k]]));

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
  // ── 2026/7/22 Tails Up報告修正 A: 有料オプション編集 (SellPage L2111 と同型・編集モーダルに欄が無かった) ──
  const [options, setOptions] = useState<any[]>(() =>
    Array.isArray(listing.options)
      ? listing.options.map((o: any) => ({ name: o?.name || "", price: o?.price != null ? String(o.price) : "" }))
      : []
  );
  const addOption = () => setOptions(prev => [...prev, { name: "", price: "" }]);
  const updateOption = (idx: number, key: string, val: string) => setOptions(prev => prev.map((o, i) => i === idx ? { ...o, [key]: val } : o));
  const removeOption = (idx: number) => setOptions(prev => prev.filter((_, i) => i !== idx));

  // ── 2026/7/22 Tails Up報告修正 B: 種類 (Variant) 編集 (SellPage Phase B と同型) ──
  // 既存 listing_variants をモーダル開時に fetch → 軸(variantOptions)を attributes から逆算して復元。
  // 保存は差分適用: 既存id→UPDATE / 新規→INSERT / 消えた組合せ→is_active=false (物理削除しない=過去注文の参照保護)
  const [variantsLoading, setVariantsLoading] = useState(true);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantOptions, setVariantOptions] = useState<Array<{ name: string; values: string[] }>>([]);
  const [variants, setVariants] = useState<any[]>([]);       // {id?, variant_name, attributes, price, stock}
  const [origVariants, setOrigVariants] = useState<any[]>([]); // DB既存行 (is_active含む全行)

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("listing_variants")
        .select("id, variant_name, attributes, price, stock, is_active, display_order")
        .eq("listing_id", listing.id)
        .order("display_order", { ascending: true });
      if (!alive) return;
      const rows = data || [];
      setOrigVariants(rows);
      const active = rows.filter((r: any) => r.is_active !== false);
      if (active.length > 0) {
        // 軸を attributes から逆算 (実データは全行 attributes あり)
        const keys = Array.from(new Set(active.flatMap((r: any) => Object.keys(r.attributes || {}))));
        setVariantOptions(keys.map(k => ({
          name: k,
          values: Array.from(new Set(active.map((r: any) => r.attributes?.[k]).filter(Boolean))) as string[],
        })));
        setVariants(active.map((r: any) => ({
          id: r.id, variant_name: r.variant_name, attributes: r.attributes || {},
          price: r.price != null ? String(r.price) : "", stock: r.stock != null ? String(r.stock) : "0",
        })));
        setHasVariants(true);
      }
      setVariantsLoading(false);
    })();
    return () => { alive = false; };
  }, [listing.id]);

  // 軸操作 (SellPage L1544-1568 と同一ロジック)
  const addVariantOption = () => { if (variantOptions.length < 2) setVariantOptions(prev => [...prev, { name: "", values: [""] }]); };
  const removeVariantOption = (idx: number) => setVariantOptions(prev => prev.filter((_, i) => i !== idx));
  const updateVariantOptionName = (idx: number, name: string) => setVariantOptions(prev => prev.map((o, i) => i === idx ? { ...o, name } : o));
  const addVariantOptionValue = (optIdx: number) => setVariantOptions(prev => prev.map((o, i) => i === optIdx ? { ...o, values: [...o.values, ""] } : o));
  const updateVariantOptionValue = (optIdx: number, valIdx: number, value: string) => setVariantOptions(prev => prev.map((o, i) => i === optIdx ? { ...o, values: o.values.map((v, j) => j === valIdx ? value : v) } : o));
  const removeVariantOptionValue = (optIdx: number, valIdx: number) => setVariantOptions(prev => prev.map((o, i) => i === optIdx ? { ...o, values: o.values.filter((_, j) => j !== valIdx) } : o));
  const updateVariant = (idx: number, key: string, value: string) => setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [key]: value } : v));

  // 組合せ再生成 (SellPage L1572 と同型 + id 継承 / 照合は attrKey 正規化)
  const regenerateVariants = useCallback(() => {
    if (variantOptions.length === 0) { setVariants([]); return; }
    const combos: any[] = [];
    const gen = (i: number, attrs: any, name: string) => {
      if (i >= variantOptions.length) {
        combos.push({ variant_name: name.trim() || "デフォルト", attributes: attrs, price: listing.price != null ? String(listing.price) : "", stock: "1" });
        return;
      }
      const opt = variantOptions[i];
      for (const val of opt.values.filter(v => v && v.trim())) {
        gen(i + 1, { ...attrs, [opt.name]: val }, name + (name ? " × " : "") + val);
      }
    };
    gen(0, {}, "");
    setVariants(prev => combos.map(c => {
      const ex = prev.find(p => attrKey(p.attributes) === attrKey(c.attributes));
      return ex ? { ...c, id: ex.id, price: ex.price, stock: ex.stock } : c;
    }));
  }, [variantOptions, listing.price]);

  useEffect(() => {
    if (variantsLoading) return;          // fetch 完了前に走って初期値を消さない
    if (hasVariants) regenerateVariants();
  }, [variantOptions, hasVariants, variantsLoading, regenerateVariants]);

  // ── 2026/7/23 Phase 1: 選択肢から選んでもらう (N個選択+選択肢ごと在庫・Tails Up要望) ──
  // ★Phase 1 は出品側の登録のみ (決済フロー完全非接触・購入UIと在庫減算は Phase 2)。
  // ★有料オプション/種類とは併用不可 (どれか1モードのみ。混在すると購入UIが破綻するため)。
  const [choicesLoading, setChoicesLoading] = useState(true);
  const [hasChoices, setHasChoices] = useState(listing.choice_required_count != null);
  const [choiceCount, setChoiceCount] = useState<string>(listing.choice_required_count != null ? String(listing.choice_required_count) : "3");
  const [choiceSetPrice, setChoiceSetPrice] = useState<string>(listing.choice_set_price != null ? String(listing.choice_set_price) : "");
  const [choices, setChoices] = useState<any[]>([]);          // {id?, name, stock}
  const [origChoices, setOrigChoices] = useState<any[]>([]);  // DB既存行 (is_active含む全行)

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("listing_choices")
        .select("id, name, stock, is_active, display_order")
        .eq("listing_id", listing.id)
        .order("display_order", { ascending: true });
      if (!alive) return;
      const rows = data || [];
      setOrigChoices(rows);
      setChoices(rows.filter((r: any) => r.is_active !== false)
        .map((r: any) => ({ id: r.id, name: r.name || "", stock: r.stock != null ? String(r.stock) : "0" })));
      setChoicesLoading(false);
    })();
    return () => { alive = false; };
  }, [listing.id]);

  const addChoice = () => setChoices(prev => [...prev, { name: "", stock: "0" }]);
  const updateChoice = (idx: number, key: string, val: string) => setChoices(prev => prev.map((c, i) => i === idx ? { ...c, [key]: val } : c));
  const removeChoice = (idx: number) => setChoices(prev => prev.filter((_, i) => i !== idx));

  // 併用判定 (UI制御 + 保存時の二重ガードに使用)
  const optionsInUse = options.some((o: any) => (o.name && String(o.name).trim()) || (o.price && String(o.price).trim()));
  const variantsInUse = hasVariants;

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
    // 2026/7/22 B: 種類ON時は有効な組合せ(名前+価格>0)が1件以上必要
    const validVariants = hasVariants && !variantsLoading
      ? variants.filter((v: any) => v.variant_name && parseInt(v.price) > 0)
      : [];
    if (hasVariants && !variantsLoading && validVariants.length === 0) {
      setError("種類を使う場合は、価格を入れた種類を1つ以上設定してください（チェックを外すと種類なしで保存できます）"); return;
    }
    // 2026/7/23 Phase 1: 選択肢モードのバリデーション + 併用二重ガード
    const validChoices = hasChoices && !choicesLoading
      ? choices.filter((c: any) => c.name && String(c.name).trim())
      : [];
    if (hasChoices && !choicesLoading) {
      if (optionsInUse || variantsInUse) {
        setError("「選択肢から選んでもらう」は、有料オプション・種類とは併用できません。どちらかを空にしてください"); return;
      }
      const n = parseInt(choiceCount);
      const p = parseInt(choiceSetPrice);
      if (isNaN(n) || n < 1) { setError("選んでもらう数は1以上を入力してください"); return; }
      if (isNaN(p) || p <= 0) { setError("セット価格は1円以上を入力してください"); return; }
      if (validChoices.length < n) {
        setError(`選択肢が足りません（${n}個選んでもらうには、選択肢が${n}個以上必要です）`); return;
      }
    }
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
        // 2026/7/22 A: 有料オプション UPDATE (SellPage submitListing L564 と同フィルタ)
        options: options
          .filter((o: any) => o.name && parseInt(o.price) > 0)
          .map((o: any) => ({ name: String(o.name).trim(), price: parseInt(o.price) || 0 })),
        // 2026/7/22 B: has_variants は有効な組合せがある時のみ true
        has_variants: validVariants.length > 0,
        // 2026/7/23 Phase 1: 選択設定 (OFF時は null = 機能未使用・既存挙動のまま)
        choice_required_count: hasChoices && !choicesLoading ? parseInt(choiceCount) : null,
        choice_set_price: hasChoices && !choicesLoading ? parseInt(choiceSetPrice) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);
    if (updErr) { setSaving(false); setError("保存に失敗しました: " + updErr.message); return; }

    // 2026/7/23 Phase 1: 選択肢の差分適用 (variants と同流儀: 既存id→UPDATE / 新規→INSERT /
    // 消えた行→is_active=false。Phase 2 の注文明細が参照する前提で物理削除しない)
    if (!choicesLoading) {
      const keepChoiceIds = new Set(validChoices.filter((c: any) => c.id).map((c: any) => c.id));
      for (const r of origChoices) {
        if (!keepChoiceIds.has(r.id) && r.is_active !== false) {
          const { error: e } = await supabase.from("listing_choices")
            .update({ is_active: false }).eq("id", r.id);
          if (e) { setSaving(false); setError("選択肢の更新に失敗しました: " + e.message); return; }
        }
      }
      for (let i = 0; i < validChoices.length; i++) {
        const c = validChoices[i];
        const row = {
          name: String(c.name).trim().slice(0, 60),
          stock: Math.max(0, parseInt(c.stock) || 0),
          display_order: i,
          is_active: true,
        };
        const { error: e } = c.id
          ? await supabase.from("listing_choices").update(row).eq("id", c.id)
          : await supabase.from("listing_choices").insert({ ...row, listing_id: listing.id });
        if (e) { setSaving(false); setError("選択肢の保存に失敗しました: " + e.message); return; }
      }
    }

    // 2026/7/22 B: 種類の差分適用 (fetch未完了のまま保存された場合は既存を触らない=安全側)
    if (!variantsLoading) {
      const keepIds = new Set(validVariants.filter((v: any) => v.id).map((v: any) => v.id));
      // 1) 今回の組合せに無い既存行 → is_active=false (物理削除しない: 過去注文の variant_id 参照を守る)
      for (const r of origVariants) {
        if (!keepIds.has(r.id) && r.is_active !== false) {
          const { error: e } = await supabase.from("listing_variants")
            .update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", r.id);
          if (e) { setSaving(false); setError("種類の更新に失敗しました: " + e.message); return; }
        }
      }
      // 2) 有効な組合せを UPDATE / INSERT
      for (let i = 0; i < validVariants.length; i++) {
        const v = validVariants[i];
        const row = {
          variant_name: String(v.variant_name).trim(),
          attributes: v.attributes || {},
          price: parseInt(v.price),
          stock: Math.max(0, parseInt(v.stock) || 0),
          display_order: i,
          is_active: true,
          updated_at: new Date().toISOString(),
        };
        const { error: e } = v.id
          ? await supabase.from("listing_variants").update(row).eq("id", v.id)
          : await supabase.from("listing_variants").insert({ ...row, listing_id: listing.id });
        if (e) { setSaving(false); setError("種類の保存に失敗しました: " + e.message); return; }
      }
    }
    setSaving(false);
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

        {/* 2026/7/22 Tails Up報告修正 A: 有料オプション編集 (SellPage L2111 と同型・編集画面に欄が無かった) */}
        {/* 2026/7/23 Phase 1: 選択肢モード使用中は併用不可のため畳む */}
        {hasChoices ? (
          <div style={{ marginBottom:14, padding:"10px 12px", background:C.lightGray, borderRadius:10, fontSize:11, color:C.warmGray, lineHeight:1.7 }}>
            有料オプション・種類は「選択肢から選んでもらう」と併用できません。使う場合は下のチェックを外してください。
          </div>
        ) : (
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>有料オプション（任意）</label>
          <p style={{ fontSize:10.5, color:C.warmGray, marginBottom:8, lineHeight:1.6 }}>購入者が注文時に追加できるオプションを設定できます</p>
          {options.map((opt: any, i: number) => (
            <div key={i} style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center" }}>
              <input value={opt.name} onChange={e=>updateOption(i,"name",e.target.value)} placeholder="例：急ぎ対応（3日以内）"
                style={{ flex:2, padding:"9px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              <div style={{ position:"relative", flex:1 }}>
                <input type="number" value={opt.price} onChange={e=>updateOption(i,"price",e.target.value)} placeholder="500"
                  style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.warmGray }}>円</span>
              </div>
              <button type="button" onClick={()=>removeOption(i)} style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.lightGray, cursor:"pointer", fontSize:14, color:C.warmGray, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
            </div>
          ))}
          {options.length < 15 && (
            <button type="button" onClick={addOption} style={{ padding:"8px 14px", background:C.orangePale, border:`1.5px dashed ${C.orange}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.orange, cursor:"pointer", fontFamily:"inherit" }}>＋ オプションを追加</button>
          )}
        </div>
        )}

        {/* 2026/7/22 Tails Up報告修正 B: 種類 (Variant) 編集 (SellPage Phase B と同型) */}
        {!hasChoices && (
        <div style={{ marginBottom:14, paddingTop:12, borderTop:`1px dashed ${C.border}` }}>
          {variantsLoading ? (
            <p style={{ fontSize:11, color:C.warmGray }}>種類を読み込み中...</p>
          ) : (
            <>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontWeight:800, color:C.dark, cursor:"pointer", marginBottom:6 }}>
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={e => {
                    setHasVariants(e.target.checked);
                    if (!e.target.checked) { setVariantOptions([]); setVariants([]); }
                    else if (variantOptions.length === 0) { setVariantOptions([{ name: "", values: [""] }]); }
                  }}
                  style={{ width:16, height:16, accentColor:C.orange }}
                />
                <span>種類を増やす（色違い・サイズ違いなど）</span>
              </label>
              <p style={{ fontSize:10.5, color:C.warmGray, marginBottom:10, paddingLeft:24, lineHeight:1.6 }}>
                1つの作品で、構図やサイズの種類を選んでもらえます。それぞれに価格と在庫を設定できます。<br/>
                {origVariants.some((r:any)=>r.is_active!==false) && !hasVariants && "⚠️ チェックを外して保存すると、既存の種類は購入画面に表示されなくなります。"}
              </p>
              {hasVariants && (
                <div>
                  {/* 軸 (項目) max 2 */}
                  {variantOptions.map((opt, optIdx) => (
                    <div key={optIdx} style={{ marginBottom:12, padding:12, background:C.lightGray, borderRadius:10 }}>
                      <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8 }}>
                        <input
                          value={opt.name}
                          onChange={e => updateVariantOptionName(optIdx, e.target.value)}
                          placeholder={optIdx === 0 ? "例：構図" : "例：サイズ"}
                          style={{ flex:1, padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                        />
                        <button type="button" onClick={() => removeVariantOption(optIdx)}
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
                              style={{ width:90, padding:"4px 2px", border:"none", fontSize:12, fontFamily:"inherit", outline:"none", background:"transparent" }}
                            />
                            {opt.values.length > 1 && (
                              <button type="button" onClick={() => removeVariantOptionValue(optIdx, valIdx)}
                                style={{ width:18, height:18, borderRadius:"50%", border:"none", background:C.lightGray, cursor:"pointer", fontSize:10, color:C.warmGray }}
                              >×</button>
                            )}
                          </div>
                        ))}
                        {opt.values.length < 10 && (
                          <button type="button" onClick={() => addVariantOptionValue(optIdx)}
                            style={{ padding:"4px 10px", background:C.orangePale, border:`1px dashed ${C.orange}`, borderRadius:6, fontSize:11, color:C.orange, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}
                          >＋ 追加</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {variantOptions.length < 2 && (
                    <button type="button" onClick={addVariantOption}
                      style={{ padding:"8px 14px", background:C.white, border:`1.5px dashed ${C.orange}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.orange, cursor:"pointer", fontFamily:"inherit", marginBottom:12 }}
                    >＋ {variantOptions.length === 0 ? "種類の項目を追加" : "もう1項目（サイズなど）"}</button>
                  )}
                  {/* 組合せごとの価格・在庫 */}
                  {variants.length > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:8 }}>それぞれの種類（{variants.length}通り）</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {variants.map((v: any, idx: number) => (
                          <div key={idx} style={{ padding:10, background:C.white, border:`1px solid ${C.border}`, borderRadius:10 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:6 }}>{v.variant_name}</div>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                              <div style={{ position:"relative" }}>
                                <input type="number" value={v.price} onChange={e => updateVariant(idx, "price", e.target.value)} placeholder="3000"
                                  style={{ width:"100%", padding:"7px 26px 7px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                                <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:C.warmGray }}>円</span>
                              </div>
                              <div style={{ position:"relative" }}>
                                <input type="number" value={v.stock} onChange={e => updateVariant(idx, "stock", e.target.value)} placeholder="1" min="0"
                                  style={{ width:"100%", padding:"7px 26px 7px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
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
            </>
          )}
        </div>
        )}

        {/* 2026/7/23 Phase 1: 選択肢から選んでもらう (N個選択+選択肢ごと在庫・出品側のみ) */}
        <div style={{ marginBottom:14, paddingTop:12, borderTop:`1px dashed ${C.border}` }}>
          {choicesLoading ? (
            <p style={{ fontSize:11, color:C.warmGray }}>選択肢を読み込み中...</p>
          ) : (
            <>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontWeight:800, color:(optionsInUse||variantsInUse) ? C.warmGray : C.dark, cursor:(optionsInUse||variantsInUse) ? "not-allowed" : "pointer", marginBottom:6 }}>
                <input
                  type="checkbox"
                  checked={hasChoices}
                  disabled={optionsInUse || variantsInUse}
                  onChange={e => {
                    setHasChoices(e.target.checked);
                    if (e.target.checked && choices.length === 0) {
                      setChoices([{ name:"", stock:"0" }, { name:"", stock:"0" }, { name:"", stock:"0" }]);
                    }
                  }}
                  style={{ width:16, height:16, accentColor:C.orange }}
                />
                <span>選択肢から選んでもらう（詰め合わせ・セット向け）</span>
              </label>
              <p style={{ fontSize:10.5, color:C.warmGray, marginBottom:10, paddingLeft:24, lineHeight:1.6 }}>
                「15種類から3つ選ぶ」のような売り方ができます。選択肢ごとに在庫を持てます。<br/>
                {(optionsInUse || variantsInUse) && "⚠️ 有料オプション・種類と併用できません。先にそちらを空にしてください。"}
              </p>
              {hasChoices && (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:C.warmGray, display:"block", marginBottom:4 }}>選んでもらう数</label>
                      <div style={{ position:"relative" }}>
                        <input type="number" min="1" value={choiceCount} onChange={e=>setChoiceCount(e.target.value)} placeholder="3"
                          style={{ width:"100%", padding:"8px 26px 8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                        <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:C.warmGray }}>個</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:C.warmGray, display:"block", marginBottom:4 }}>セット価格</label>
                      <div style={{ position:"relative" }}>
                        <input type="number" min="1" value={choiceSetPrice} onChange={e=>setChoiceSetPrice(e.target.value)} placeholder="1680"
                          style={{ width:"100%", padding:"8px 26px 8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                        <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:C.warmGray }}>円</span>
                      </div>
                    </div>
                  </div>
                  <label style={{ fontSize:11, fontWeight:700, color:C.warmGray, display:"block", marginBottom:6 }}>選択肢（名前と在庫）</label>
                  {choices.map((c: any, i: number) => (
                    <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                      <input value={c.name} onChange={e=>updateChoice(i,"name",e.target.value)} placeholder={`例：ささみジャーキー`}
                        style={{ flex:2, padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                      <div style={{ position:"relative", width:90 }}>
                        <input type="number" min="0" value={c.stock} onChange={e=>updateChoice(i,"stock",e.target.value)} placeholder="0"
                          style={{ width:"100%", padding:"8px 22px 8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                        <span style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", fontSize:10, color:C.warmGray }}>個</span>
                      </div>
                      <button type="button" onClick={()=>removeChoice(i)} style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.lightGray, cursor:"pointer", fontSize:14, color:C.warmGray, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
                    </div>
                  ))}
                  {choices.length < 30 && (
                    <button type="button" onClick={addChoice} style={{ padding:"8px 14px", background:C.orangePale, border:`1.5px dashed ${C.orange}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.orange, cursor:"pointer", fontFamily:"inherit" }}>＋ 選択肢を追加 ({choices.length})</button>
                  )}
                  <p style={{ fontSize:10.5, color:C.warmGray, marginTop:8, lineHeight:1.6 }}>
                    ※ 購入画面での選択表示は準備中です。登録した内容は保存され、機能公開時にそのまま使えます。
                  </p>
                </div>
              )}
            </>
          )}
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
