# 🎨 Phase D: SectionQuietlyLoved 実装仕様書 (即実装版)

> 作成: 2026/5/13
> 議論: King + Claude.ai + チャッピー (ChatGPT)
> 哲学: "Qocca = Airbnb × Pinterest × Substack"

---

## 🎯 セクションの目的

```
ホームページ上で、grace さん (ユーザー) の作品を堂々と展示する。
"Qocca が作った世界" から "住民が生きてる街" への転換点。

❌ NG: 商品カード感、EC感、宣伝感
✅ YES: "誰かの愛情" の展示、Airbnb の宿一覧の静けさ
```

---

## 📍 配置位置

```
HomePage 内、SectionWhatIsQocca の直後:

1. SectionHero (Phase B 完了)
2. SectionWhatIsQocca (Phase A 完了)
★ 3. SectionQuietlyLoved (NEW) ← ココに追加
4. SectionTodaysMoments
5. SectionTownMap
6. SectionAtelier (← どうする? 後述)
7. SectionVoices
8. SectionJoinTown
```

⚠️ **既存の SectionAtelier との関係**:
- SectionAtelier は維持 (現状コードを壊さない)
- SectionQuietlyLoved を SectionAtelier の "進化版" として新規追加
- 後日、King の判断で SectionAtelier を削除 or 統合する可能性あり
- **今回は SectionAtelier に触らない** (安全優先)

---

## 🎨 デザイン仕様 (ちゃぴ案全採用)

### セクション全体

```typescript
const sectionStyle = {
  padding: '200px 0',  // セクション間余白を大きく取る
  background: 'transparent',
};
```

### ヘッダー (中央)

```tsx
<div style={{ textAlign: 'center', marginBottom: 100 }}>
  
  {/* 英字サブタイトル */}
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
    Quietly Loved in Town
  </p>
  
  {/* メインタイトル (和文) */}
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
  
  {/* 区切り線 */}
  <div style={{
    marginTop: 40,
    width: 32,
    height: 1,
    background: QC.lightSand,
    margin: '40px auto 0',
  }} />
</div>
```

### カード Grid (Pinterest型)

```tsx
<div style={{ 
  maxWidth: 1200, 
  margin: '0 auto', 
  padding: '0 32px' 
}}>
  <div style={{
    display: 'grid',
    gridTemplateColumns: isMobile 
      ? '1fr' 
      : 'repeat(3, 1fr)',
    gap: isMobile ? 40 : 48,
  }}>
    {items.map((item, i) => <Card key={item.id} item={item} index={i} />)}
  </div>
</div>
```

### 各カード (ちゃぴ案: 商品カード感を消す)

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
        aspectRatio: '4/5',  // 縦長、Airbnb 風
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
            filter: 'saturate(0.9)',  // Qocca フィルター
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
      
      {/* "by 作家名" (Substack 感) */}
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
      </p>
      
      {/* 価格 (控えめ、右寄せ) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {/* 左: favorite_count が 1以上なら表示 */}
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
        
        {/* 右: 価格 (控えめ) */}
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

### セクション下部 (空気テキスト + リンク)

```tsx
<div style={{ 
  marginTop: 100, 
  textAlign: 'center',
  padding: '0 32px',
}}>
  {/* 空気テキスト */}
  <p style={{
    fontFamily: QC_FONT_JP,
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: 300,
    color: QC.warmGray,
    letterSpacing: 1.2,
    opacity: 0.7,
    margin: '0 0 40px 0',
    lineHeight: 1.8,
  }}>
    今日も、誰かの大切な時間が残されています。
  </p>
  
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

## 💾 データ取得

```typescript
const SectionQuietlyLoved = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // listings + profiles を結合して取得
        const { data, error } = await supabase
          .from('listings')
          .select(`
            id, title, price, image_urls, favorite_count, seller_id,
            profiles!seller_id (id, display_name)
          `)
          .eq('status', 'approved')
          .order('favorite_count', { ascending: false })  // お気に入り順
          .order('created_at', { ascending: false })       // 新しい順
          .limit(6);
        
        if (error) {
          console.error('SectionQuietlyLoved fetch error:', error);
          setLoading(false);
          return;
        }
        
        // データ整形
        const formatted = (data || []).map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          image_urls: item.image_urls,
          favorite_count: item.favorite_count,
          seller_name: item.profiles?.display_name || '街の作家',
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
  
  // 作品が1件もない場合はセクションごと非表示
  if (!loading && items.length === 0) {
    return null;
  }
  
  // ローディング中は何も表示しない (静かに登場)
  if (loading) {
    return null;
  }
  
  return (
    <section style={{ padding: '200px 0', background: 'transparent' }}>
      {/* 上記のヘッダー + Grid + 下部 */}
    </section>
  );
};
```

---

## 🛠 実装手順 (クマ用)

### Step 1: ブランチ作成
```bash
git checkout main
git pull
git checkout -b claude/quietly-loved
```

### Step 2: App.tsx に SectionQuietlyLoved を追加
- 既存の SectionAtelier の定義の **直前** に新規定義
- HomePage の return 内で SectionWhatIsQocca の **直後** に配置

### Step 3: ビルド確認
```bash
npm run build
```

### Step 4: commit & push
```bash
git add src/App.tsx
git commit -m "feat: SectionQuietlyLoved 追加 - 住民の作品を主役に (Phase D)"
git push origin claude/quietly-loved
```

### Step 5: main マージ前で停止
- King の動作確認・承認を待つ
- preview URL で確認

---

## 🚨 厳守事項 (99-safety-protocol)

```
✅ 新ブランチ claude/quietly-loved で作業
✅ 既存セクションを破壊しない (SectionAtelier は触らない)
✅ 既存 listings の DB スキーマに合わせる:
   - seller_id (eなし)
   - profiles.display_name (eなし)
✅ main 直接コミット禁止
✅ items.length === 0 の時は null を返す (空セクション表示防止)
✅ ロールバック手順: git revert <commit>
```

---

## ✅ 完了基準

```
✅ SectionQuietlyLoved が HomePage に追加される
✅ SectionWhatIsQocca の直後に配置
✅ grace さんの3作品が Pinterest 型で表示
✅ 価格、作家名、記憶タイトル の階層が正しい
✅ favorite_count = 0 の場合 "X人がそっと保存しました" は非表示
✅ hover が "呼吸する" 程度 (scale 1.02 + translateY -2px)
✅ 空気テキスト "今日も、誰かの大切な時間が残されています。" 表示
✅ "すべての作品を覗いてみる" リンク機能
✅ レスポンシブ (モバイル 1列、PC 3列)
✅ ビルドエラーなし
```

---

## 🎯 期待される効果

```
Before (現状):
Hero (世界観) → What is Qocca (機能) → Today's Moments (公式写真)
→ "Qocca が作った世界" 

After (Phase D 追加後):
Hero → What is Qocca → ⭐ Quietly Loved (grace さんの作品) ⭐
→ Today's Moments → ...

→ "住民が生きてる街" への転換 ✨
→ 自己満問題、解決
→ 集客した人が "実物" を見れる
→ grace さんへの最高の応援
```

---

> 作成: 2026/5/13
> 採用議論: King + Claude.ai + チャッピー
> 実装担当: クマ (Claude Code)
