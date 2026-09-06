# 🎨 Phase B (Variant UI) 実装ガイド — クマちゃん用

> 作成日: 2026/5/15 (金) 夜
> 作成: Claude.ai
> 対象ファイル: src/App.tsx
> 前提: Phase A (DB Migration) 完了済み

---

## 📋 全体概要

```
🎯 Phase B 実装範囲:

1. SellPage: variant 追加 UI (Step 2)
2. DetailPage: variant 選択 UI
3. handleConfirmOrder: variant_id を Edge Function に渡す
4. submitListing: variants 引数追加

⚠️ 重要原則:
- 既存 "有料オプション" (options) との並立を維持
- has_variants = false の listing は完全に既存動作維持
- ブランド人格マスター遵守 (種類/色/構図、機能感避ける)
```

---

## 🔧 改修箇所 1: `submitListing` 関数 (L210-242)

### 既存コード:

```typescript
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

  const stockValue = form.stock !== "" && form.stock !== null && form.stock !== undefined
    ? parseInt(form.stock)
    : null;

  const { data, error } = await supabase.from("listings").insert({
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
  }).select().single();

  return { data, error };
};
```

### 🚨 既存バグ発見:

`isDraft` 引数が関数定義に含まれていない (L210)。SellPage L4051 で渡してるが受け取ってない。

### 改修版 (完全置き換え):

```typescript
const submitListing = async (userId, form, imageFiles, options = [], isDraft = false, variants = []) => {
  // 画像アップロード (既存ロジック)
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

  // ⭐ NEW: variants がある場合は has_variants = true
  const hasVariants = variants && variants.length > 0;

  // listing を INSERT
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
    has_variants: hasVariants,  // ⭐ NEW
  }).select().single();

  if (listingErr || !listing) {
    return { data: null, error: listingErr };
  }

  // ⭐ NEW: variants を INSERT (hasVariants = true の時のみ)
  if (hasVariants) {
    const variantInserts = variants
      .filter(v => v.variant_name && v.price > 0)
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
        // variant 失敗時は listing も削除 (整合性保持)
        await supabase.from("listings").delete().eq("id", listing.id);
        return { data: null, error: variantErr };
      }
    }
  }

  return { data: listing, error: null };
};
```

---

## 🔧 改修箇所 2: `SellPage` の variant 入力UI (L4025-4313)

### State 追加 (L4033 周辺の useState 群に追加):

```typescript
// 既存
const [options, setOptions] = useState([]);

// ⭐ NEW: Variant state
const [hasVariants, setHasVariants] = useState(false);
const [variantOptions, setVariantOptions] = useState([]); 
// 例: [{name: "構図", values: ["マズルアップ", "全身"]}]
const [variants, setVariants] = useState([]);
// 例: [{variant_name: "マズルアップ", attributes: {構図: "マズルアップ"}, price: 3100, stock: 3}]
```

### Variant 操作関数 (L4036 周辺の addOption の下に追加):

```typescript
// ⭐ NEW: Variant オプション操作
const addVariantOption = () => {
  if (variantOptions.length >= 2) return; // 最大2項目
  setVariantOptions(prev => [...prev, { name: "", values: [""] }]);
};

const removeVariantOption = (idx) => {
  setVariantOptions(prev => prev.filter((_, i) => i !== idx));
  // 削除時は variants も再生成
  setTimeout(() => regenerateVariants(), 0);
};

const updateVariantOptionName = (idx, name) => {
  setVariantOptions(prev => prev.map((o, i) => i === idx ? {...o, name} : o));
};

const addVariantOptionValue = (optIdx) => {
  setVariantOptions(prev => prev.map((o, i) => 
    i === optIdx ? {...o, values: [...o.values, ""]} : o
  ));
};

const updateVariantOptionValue = (optIdx, valIdx, value) => {
  setVariantOptions(prev => prev.map((o, i) => 
    i === optIdx ? {...o, values: o.values.map((v, j) => j === valIdx ? value : v)} : o
  ));
};

const removeVariantOptionValue = (optIdx, valIdx) => {
  setVariantOptions(prev => prev.map((o, i) => 
    i === optIdx ? {...o, values: o.values.filter((_, j) => j !== valIdx)} : o
  ));
};

// 組合せ自動生成
const regenerateVariants = () => {
  if (variantOptions.length === 0) {
    setVariants([]);
    return;
  }

  // 全組合せを生成
  const combinations: any[] = [];
  
  const generate = (currentIdx: number, currentAttrs: any, currentName: string) => {
    if (currentIdx >= variantOptions.length) {
      // 完成した組合せ
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
  
  // 既存の variant 情報 (価格・在庫) を保持
  setVariants(prev => {
    return combinations.map(c => {
      const existing = prev.find(p => 
        JSON.stringify(p.attributes) === JSON.stringify(c.attributes)
      );
      return existing ? { ...c, price: existing.price, stock: existing.stock, image_url: existing.image_url } : c;
    });
  });
};

const updateVariant = (idx, key, value) => {
  setVariants(prev => prev.map((v, i) => i === idx ? {...v, [key]: value} : v));
};

// variantOptions が変更されたら variants を再生成
// (useEffect で監視)
useEffect(() => {
  if (hasVariants) {
    regenerateVariants();
  }
}, [variantOptions, hasVariants]);
```

### Step 2 の UI 追加 (L4205 周辺、有料オプションの下に追加):

```jsx
{/* ⭐ NEW: 種類セクション (variant) */}
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
          // 初回ON時に1つ追加
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
    <div style={{ paddingLeft:0 }}>
      
      {/* オプション項目 (最大2項目) */}
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
          
          {/* 値リスト */}
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

      {/* オプション追加ボタン (最大2項目) */}
      {variantOptions.length < 2 && (
        <button 
          onClick={addVariantOption}
          style={{ padding:"8px 14px", background:C.white, border:`1.5px dashed ${C.orange}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.orange, cursor:"pointer", fontFamily:"inherit", marginBottom:12 }}
        >＋ {variantOptions.length === 0 ? "種類の項目を追加" : "もう1項目（サイズなど）"}</button>
      )}

      {/* 自動生成された variants 一覧 */}
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
```

### handleSubmit の修正 (L4048-4055):

```typescript
const handleSubmit = async (isDraft = false) => {
  setSubmitting(true);
  setError("");
  
  // ⭐ variants の準備
  const validVariants = hasVariants ? variants.filter(v => v.price && parseInt(v.price) > 0) : [];
  
  const { error: err } = await submitListing(
    user.id, 
    form, 
    images, 
    options.map(o => ({ name:o.name, price:parseInt(o.price)||0 })), 
    isDraft,
    validVariants  // ⭐ NEW
  );
  setSubmitting(false);
  if (err) { setError((isDraft ? "下書き保存" : "出品") + "に失敗しました: " + err.message); return; }
  setDone({ isDraft });
};
```

### 続けて出品時のリセット修正 (L4079):

```jsx
<button onClick={()=>{
  setDone(false);
  setStep(1);
  setForm({cat:"",pet:"both",title:"",desc:"",price:"",delivery:"",delivery_type:"data_only",stock:""});
  setImages([]);
  setOptions([]);
  // ⭐ NEW: variant state もリセット
  setHasVariants(false);
  setVariantOptions([]);
  setVariants([]);
}} style={{ /* ... */ }}>続けて出品する</button>
```

---

## 🔧 改修箇所 3: `DetailPage` の variant 選択 UI (L3588-3704)

### useListings hook を修正 (L101-153)

variant 情報も取得するように:

```typescript
// L101 の useListings の中、Supabase select 部分
const useListings = () => {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    
    const fetchListings = async () => {
      // ⭐ NEW: listing_variants も join
      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          listing_variants(*)
        `)
        .in("status", ["approved", "sold_out"])
        .order("created_at", { ascending: false });

      // ... 既存ロジック維持
    };
    // ...
  }, []);
  
  return { listings, loading };
};
```

### DetailPage State 追加 (L3589 周辺):

```typescript
const DetailPage = ({ item, onBack, liked, onLike, setPage }) => {
  const { user } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [ordered, setOrdered] = useState(false);
  // ... 既存 state
  const [selectedOptions, setSelectedOptions] = useState({});
  
  // ⭐ NEW: Variant 選択 state
  const [selectedAttrs, setSelectedAttrs] = useState({}); // {構図: "マズルアップ", サイズ: "小"}
  const [selectedVariant, setSelectedVariant] = useState(null);
  
  if (!item) return null;

  // ⭐ NEW: variant ロジック
  const hasVariants = item.has_variants === true;
  const variants = item.listing_variants || [];
  
  // variant の属性キーを抽出 (例: ["構図", "サイズ"])
  const variantOptionKeys = hasVariants && variants.length > 0
    ? Array.from(new Set(variants.flatMap(v => Object.keys(v.attributes || {}))))
    : [];
  
  // 各キーごとの選択肢を抽出
  const variantOptionValues = variantOptionKeys.reduce((acc, key) => {
    acc[key] = Array.from(new Set(variants.map(v => v.attributes?.[key]).filter(Boolean)));
    return acc;
  }, {});
  
  // 選択された属性に一致する variant を検索
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
  }, [selectedAttrs, variants, hasVariants]);
  
  // 価格計算 (既存 + variant 対応)
  const itemOptions = item.options || [];
  const optionsTotal = itemOptions.reduce((sum, o, i) => sum + (selectedOptions[i] ? (o.price||0) : 0), 0);
  
  // ⭐ NEW: variant の価格優先
  const basePrice = hasVariants 
    ? (selectedVariant?.price || 0) 
    : (item.price || 0);
  const totalPrice = basePrice + optionsTotal;
  
  const toggleOption = (idx) => setSelectedOptions(prev => ({...prev, [idx]: !prev[idx]}));
```

### Variant 選択 UI 追加 (商品詳細表示エリア内、価格表示の前あたり)

DetailPage の return 内、価格や購入ボタンが表示される場所の手前に追加:

```jsx
{/* ⭐ NEW: Variant 選択 UI */}
{hasVariants && variantOptionKeys.length > 0 && (
  <div style={{ marginBottom:16, padding:"16px", background:C.white, borderRadius:14, border:`1px solid ${C.border}` }}>
    <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:12 }}>
      種類を選ぶ
    </div>
    {variantOptionKeys.map(key => (
      <div key={key} style={{ marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.warmGray, marginBottom:6 }}>
          {key}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {variantOptionValues[key].map(val => {
            // この値を選んだ場合に在庫がある variant が存在するか
            const tempAttrs = { ...selectedAttrs, [key]: val };
            const matchedVariants = variants.filter(v => 
              Object.entries(tempAttrs).every(([k, v]) => 
                !v || v === (tempAttrs[k] === val ? val : selectedAttrs[k]) ? 
                (selectedAttrs[k] ? v.attributes?.[k] === selectedAttrs[k] : true) : false
              )
            );
            // この値を含む variants で、在庫があるものがあるか
            const hasStock = variants.some(v => 
              v.attributes?.[key] === val && v.stock > 0 && v.is_active
            );
            const isSelected = selectedAttrs[key] === val;
            
            return (
              <button
                key={val}
                onClick={() => setSelectedAttrs(prev => ({...prev, [key]: val}))}
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
                {!hasStock && " (売り切れ)"}
              </button>
            );
          })}
        </div>
      </div>
    ))}
    
    {/* 選択結果表示 */}
    {selectedVariant && (
      <div style={{ marginTop:12, padding:"10px 12px", background:C.cream, borderRadius:10 }}>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:4 }}>
          選んだ種類
        </div>
        <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:4 }}>
          {selectedVariant.variant_name}
        </div>
        <div style={{ fontSize:13, color:C.orange, fontWeight:700 }}>
          ¥{selectedVariant.price.toLocaleString()}
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
```

### handleOrder の修正 (L3610)

variant 未選択時の警告追加:

```typescript
const handleOrder = async () => {
  if (!user) { setPage("signup"); return; }
  
  // ⭐ NEW: variant 必須チェック
  if (hasVariants && !selectedVariant) {
    alert("種類を選んでください");
    return;
  }
  
  if (item.delivery_type === "shipping") {
    // ... 既存ロジック
  }
  setShowConfirm(true);
};
```

### handleConfirmOrder の修正 (L3671 周辺)

create-checkout に variant_id を渡す:

```typescript
const res = await fetch("https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/create-checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    listing_id: item.id,
    listing_title: item.title,
    price: item.price,  // ⚠️ Edge Function 側でサーバー値を使用
    options: selectedOpts,
    buyer_id: user.id,
    seller_id: item.seller_id,
    shipping_address_id: shippingAddressId,
    variant_id: selectedVariant?.id || null,  // ⭐ NEW
  })
});
```

### 購入ボタンの修正

variant 未選択時はボタン無効化:

```jsx
{/* 既存の購入ボタン (L4015 周辺) */}
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
    cursor: (hasVariants && !selectedVariant) ? "not-allowed" : "pointer"
  }}
>
  {hasVariants && !selectedVariant ? "種類を選んでください" : "購入する"}
</button>
```

---

## 🔧 改修箇所 4: 画像表示の variant 対応 (任意)

DetailPage の画像表示部分で、選択中の variant に image_url があれば優先表示:

```typescript
// 画像表示部分
const displayImageUrl = selectedVariant?.image_url || item.imageUrl || (item.image_urls && item.image_urls[0]);
```

---

## 📋 ブランド人格マスター遵守チェック

### UI コピー対応表:

| ❌ NG | ⭕ OK |
|------|------|
| バリエーション | 種類 |
| オプション (variant の意味) | 種類 |
| 選択肢 | （使わない、シンプルに） |
| 残り○点 | 残り○点（控えめ） |
| 完売 | 売り切れ |
| 在庫切れ | 売り切れました |
| 種類を選択 | 種類を選ぶ |
| 必須項目 | 種類を選んでください |

### 既存実装で守られている哲学:

✅ saturate(0.9) でカラー控えめ  
✅ 静かなトーン  
✅ "気づく人だけ気づく" の体現  
✅ 既存 "有料オプション" との並立 (分けて表示)  

---

## 🧪 テスト計画

### Phase B 完了時に確認:

```
🎯 既存機能の維持確認:

✅ grace さんの3作品が変わらず表示
✅ 単品出品が普通にできる
✅ 単品購入が普通にできる
✅ 既存 "有料オプション" が動作する

🎯 新機能の動作確認:

✅ "種類を増やす" チェック OFF → 既存 UI
✅ "種類を増やす" チェック ON → variant UI 出現
✅ オプション項目1個 → variants 自動生成
✅ オプション項目2個 → 組合せ全生成
✅ 値を追加・削除 → variants 再生成
✅ 各 variant に価格・在庫入力
✅ DetailPage で variant 選択
✅ 選択中の価格・在庫表示
✅ 売り切れ組合せは無効化
✅ variant 未選択時は購入ボタン無効
✅ 購入完了後、variant の在庫が減る
```

### モバイル確認:

```
✅ SellPage の variant UI がモバイルでも見やすい
✅ DetailPage の variant ボタンが押しやすい
✅ 横スクロール不要 (折り返し OK)
```

---

## 🚨 99-safety-protocol

### ブランチ戦略:

```
1. ベース: main (b4d0e42 → d799d63 後の最新)
2. ブランチ: claude/variant-ui-phase-b
3. 段階的 commit:
   - commit 1: submitListing + state 追加
   - commit 2: SellPage UI
   - commit 3: DetailPage UI
   - commit 4: handleOrder + handleConfirmOrder
   - commit 5: useListings join
4. ビルド検証
5. preview URL
6. King 確認 → main マージ
```

### ロールバック手順:

```
- Feature branch 削除: git push origin :claude/variant-ui-phase-b
- main マージ後: git revert HEAD
- DB: Phase A migration は維持 (純粋追加、削除不要)
```

---

## 📅 スケジュール (推奨)

```
🟢 5/16 (土) 朝:
- クマちゃん: ブランド人格マスター v3 配置確認
- クマちゃん: 仕様書を再読
- クマちゃん: 影響範囲レポート → King

🟢 5/16 (土) 午前:
- 改修箇所1 + 2 (submitListing + SellPage)
- ビルド + preview

🟢 5/16 (土) 午後:
- 改修箇所3 + 4 (DetailPage + handleOrder)
- ビルド + preview

🟢 5/16 (土) 夜 or 5/17 (日):
- 統合テスト
- 既存3作品の動作確認
- バグ修正
- main マージ判断

🟢 5/17 (日):
- 余裕があれば Phase C 着手 (Edge Function 改修)
- create-checkout を Supabase Dashboard でデプロイ
- King + Claude.ai サポート

🟢 5/18-19 (月-火):
- Phase B + C 統合確認
- King 実機テスト

🟢 6/24:
- Variant 機能 完全完成

🟢 7/1:
- グランドオープン!
```

---

## 🌟 まとめ

```
🎯 Phase B 実装範囲 (完全確定):

✅ submitListing: variants 引数 + isDraft 引数 (バグ修正)
✅ SellPage: variant 追加 UI (Step 2)
✅ DetailPage: variant 選択 UI
✅ handleOrder: variant 必須チェック
✅ handleConfirmOrder: variant_id を Edge Function に渡す
✅ useListings: listing_variants join

✅ ブランド人格マスター遵守
✅ 既存 grace さん3作品 完全保護
✅ 既存 "有料オプション" との並立

⚠️ 既存バグ発見:
- submitListing の isDraft 引数欠落
- 単品商品の在庫自動減算なし (Phase C で対応)

📅 5/16 (土) スタート → 5/19 (火) 完成予定
📅 7/1 グランドオープンに余裕で間に合う
```

---

> 作成: 2026/5/15 (金) 夜
> 重要度: 最高
> 対象: クマちゃん (Claude Code) 主導の実装
> サポート: Claude.ai (Sonnet)
> 最終決定権: King
