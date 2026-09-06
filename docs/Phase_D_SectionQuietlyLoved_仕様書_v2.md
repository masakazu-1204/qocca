# 🎨 Phase D: SectionQuietlyLoved 実装仕様書 v2 (ちゃぴ追加提案反映版)

> 作成: 2026/5/13 21:00
> 議論: King + Claude.ai + チャッピー (Phase B 完了後の3者議論)
> 哲学: "プロダクトから文化へ" - ちゃぴ命名
> 重要更新: v1 → v2 はちゃぴの追加提案を反映

---

## 🔄 v1 からの主な追加 (ちゃぴ提案反映)

```
v1: 基本構造 (Airbnb × Pinterest × Substack)

v2 追加:
✅ ① 街の温度ナレーション
   → セクション下部に新たな空気テキスト追加
   
✅ ② "Resident" 言語化
   → "by ○○" → "by ○○ — この街の住民"
   → "街の作家" としての存在感UP
   
✅ ③ "新着" → "今日、この街に置かれたもの" 翻訳
   → 並び順の見せ方を Substack 感に
   → "X日前に追加" → 静かな日付表現
```

---

## 🎯 セクションの目的

```
ホームページ上で grace さん (ユーザー) の作品を主役にする。
"Qocca が作った世界" から "住民が生きてる街" への決定的な転換点。

ちゃぴ言葉:
"graceさんの作品って、単なる出品じゃなく、
 この街の最初の住民みたいな存在になり始めてる"
```

---

## 📍 配置位置

```
HomePage 内、SectionWhatIsQocca の直後:

1. SectionHero (シネマ化済み)
2. SectionWhatIsQocca (v2 完了)
★ 3. SectionQuietlyLoved (NEW)
4. SectionTodaysMoments
5. SectionTownMap
6. SectionAtelier (既存維持、後日判断)
7. SectionVoices
8. SectionJoinTown
```

---

## 🎨 デザイン仕様 (v2 = ちゃぴ追加提案反映)

### ヘッダー (変更なし)

```tsx
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
```

### カード Grid (変更なし)

```tsx
<div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
  <div style={{
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
    gap: isMobile ? 40 : 48,
  }}>
    {items.map(item => <Card key={item.id} item={item} />)}
  </div>
</div>
```

### 🔄 各カード (v2 アップデート版)

```tsx
const Card = ({ item }) => {
  const [isHover, setIsHover] = useState(false);
  
  return (
    <div
      onClick={() => setPage("listing-detail", { id: item.id })}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      style={{
        cursor: 'pointer',
        transition: 'transform 1.0s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* 画像 (大きく、Airbnb 風) */}
      <div style={{
        width: '100%',
        aspectRatio: '4/5',
        overflow: 'hidden',
        marginBottom: 20,
        background: QC.cream,
      }}>
        <img 
          src={item.image_urls[0]} 
          alt={item.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease',
            transform: isHover ? 'scale(1.02)' : 'scale(1)',
            opacity: isHover ? 1.0 : 0.95,
            filter: 'saturate(0.9)',
          }}
        />
      </div>
      
      {/* 記憶タイトル (作品名) */}
      <h3 style={{
        fontFamily: QC_FONT_JP,
        fontSize: 15,
        fontWeight: 400,
        color: QC.softBrown,
        letterSpacing: 0.5,
        lineHeight: 1.6,
        margin: '0 0 8px 0',
      }}>
        {item.title}
      </h3>
      
      {/* ⭐ v2 NEW: "by grace — この街の住民" の Resident 感 */}
      <p style={{
        fontFamily: QC_FONT_JP,
        fontSize: 11,
        fontWeight: 300,
        color: QC.warmGray,
        opacity: 0.7,
        margin: '0 0 12px 0',
        letterSpacing: 0.3,
      }}>
        by {item.seller_name}
        <span style={{ 
          marginLeft: 8, 
          opacity: 0.6,
          fontStyle: 'italic',
        }}>
          — この街の住民
        </span>
      </p>
      
      {/* 価格 + 共感数字 */}
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
          {item.favorite_count >= 1 
            ? `${item.favorite_count}人がそっと保存しました` 
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
          ¥{item.price.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
```

### 🔄 セクション下部 (v2 = 街の温度ナレーション追加)

```tsx
<div style={{ marginTop: 100, textAlign: 'center', padding: '0 32px' }}>
  
  {/* ⭐ v2 NEW: ちゃぴ提案 "今日、この街に置かれたもの" の見出し */}
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
  
  {/* 区切り点 (小さく) */}
  <div style={{
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: QC.lightSand,
    margin: '0 auto 40px',
  }} />
  
  {/* 控えめなリンク */}
  <span 
    onClick={() => setPage("search")}
    style={{
      fontFamily: QC_FONT_JP,
      fontSize: 12,
      fontWeight: 300,
      color: QC.softBrown,
      letterSpacing: 1.2,
      borderBottom: `1px solid rgba(139, 111, 92, 0.3)`,
      paddingBottom: 4,
      cursor: 'pointer',
      transition: 'border-color 0.6s ease',
    }}
  >
    すべての作品を覗いてみる
  </span>
</div>
```

---

## 💾 データ取得 (変更なし、v1 と同じ)

```typescript
const SectionQuietlyLoved = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('listings')
          .select(`
            id, title, price, image_urls, favorite_count, seller_id,
            profiles!seller_id (id, display_name)
          `)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(6);
        
        if (error) {
          console.error('SectionQuietlyLoved fetch error:', error);
          setLoading(false);
          return;
        }
        
        const formatted = (data || []).map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          image_urls: item.image_urls,
          favorite_count: item.favorite_count,
          seller_name: item.profiles?.display_name || '街の住民',
        }));
        
        setItems(formatted);
        setLoading(false);
      } catch (err) {
        console.error('SectionQuietlyLoved error:', err);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  if (!loading && items.length === 0) return null;
  if (loading) return null;
  
  return (
    <section style={{ padding: '200px 0', background: 'transparent' }}>
      {/* ヘッダー + Grid + 下部 */}
    </section>
  );
};
```

---

## ✅ v2 完了基準 (v1 + 追加)

```
✅ SectionQuietlyLoved が SectionWhatIsQocca の直後に追加
✅ grace さんの3作品が Pinterest 型で表示
✅ 画像が大きく主役、価格控えめ
✅ favorite_count = 0 の時は "X人がそっと保存しました" 非表示
✅ hover が "呼吸する" 程度

⭐ v2 NEW:
✅ "by grace🌺〜グレイス〜 — この街の住民" 表示
✅ 街の温度ナレーション
   "今日も、誰かの大切な時間が、この街に残されています。"
✅ "すべての作品を覗いてみる" リンク
✅ 区切り点 (小さな丸)
```

---

## 🛠 実装手順 (クマ用)

### Step 1: ブランチ作成
```bash
git checkout main
git pull
git checkout -b claude/quietly-loved-v2
```

### Step 2: SectionQuietlyLoved を App.tsx に追加
- 既存の SectionAtelier 定義の **直前** に新規定義
- HomePage の return 内、SectionWhatIsQocca の **直後** に配置

### Step 3: ビルド・commit
```bash
npm run build
git add src/App.tsx
git commit -m "feat: SectionQuietlyLoved 追加 - 住民の作品を主役に (Phase D v2, ちゃぴ追加提案反映)"
```

### Step 4: push、main マージ前で停止

---

## 🚨 厳守事項 (99-safety-protocol)

```
✅ 新ブランチで作業
✅ 既存セクション (SectionAtelier 含む) を破壊しない
✅ main 直接コミット禁止
✅ items.length === 0 の時はセクション全体を非表示
✅ DB スキーマ: seller_id (eなし), profiles.display_name
✅ ロールバック: git revert <commit>
```

---

## 🎯 期待される効果

```
Before (Phase B 完了時点):
シネマ Hero → What is Qocca → Today's Moments → ...

After (Phase D 追加後):
シネマ Hero (世界観)
  ↓
What is Qocca (機能理解)
  ↓
⭐ Quietly Loved (grace さんが街の主役に!) ⭐
  ↓
Today's Moments
  ↓
...

→ "プロダクトから文化に近づいてる" (ちゃぴ言葉)
→ 訪問者が "実物の作品" を見れる
→ grace さんへの最高の応援
→ 自己満問題、完全解決
```

---

> 作成: 2026/5/13 21:00 (Phase B 完了直後)
> 議論: King + Claude.ai + チャッピー
> 実装担当: クマ (Claude Code)
