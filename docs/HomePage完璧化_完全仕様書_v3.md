# 🎬 HomePage 完璧化 完全仕様書 v3 (FINAL)

> 2026/5/13
> King + Claude.ai + チャッピー 議論結果
> "浸る" デザインの最終形

---

## 🌟 大原則: "浸らせる" デザイン

```
Qocca は "ハマる" (TikTok型) ではなく "浸る" (Aesop型) サービス

❌ 短いドーパミン、刺激、競争
✅ 深い充足感、呼吸、共感

具体化:
- スクロール速度: ゆっくり
- アニメーション: 全部 0.8s+
- 余白: たっぷり (section間 200px+)
- 色: 静か、暖か
- 言葉: 詩的、優しい
- 動き: 気配レベル

⚠️ チャッピー最重要哲学:
"完璧に整いすぎると逆に死ぬ"
"少し生活感ある方が、本当に誰かが暮らしてる街になる"
→ 綺麗すぎない統一感
```

---

## 📐 新 HomePage 構造 (確定版)

```
1. SectionHero (シネマティック化)
   ↓
2. SectionWhatIsQocca (v2 → 完璧版)
   ↓
3. SectionTodaysMoments (キャプション革新、Frame統一)
   ↓
4. ⭐NEW⭐ SectionQuietlyLoved (「街で静かに愛されている作品」)
   ↓
5. ⭐NEW⭐ SectionResidentDiaries (「住民たちの日記」)
   ↓
6. SectionTownMap (既存維持、微調整)
   ↓
7. SectionVoices (既存維持、微調整)
   ↓
8. SectionJoinTown (CTA見直し)
   ↓
SharedFooter
```

⚠️ 既存の `SectionAtelier` は `SectionQuietlyLoved` に統合 or 並列  
⚠️ 全SECTION で hover を "気配" レベルに統一

---

## 🎬 SECTION 1: SectionHero (シネマティック化)

### PC版 (大改修)

```typescript
// PC: 21:9 ワイドスクリーン
const heroPCStyle = {
  width: '100vw',
  height: '100vh',
  position: 'relative',
  overflow: 'hidden',
};

const heroImagePCStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  // ⭐ 21:9 シネマ画像をフルワイドで表示
};

// 既存の "両サイドぼかし" は削除
// 中央フルスクリーン1枚を、ワイドに使う
```

### モバイル版 (既存維持)

```typescript
// 9:16 縦長フルスクリーン (現状維持)
```

### 共通設定

```typescript
// HERO_DURATIONS は既存維持: [14, 10, 10, 10, 10, 10, 14]
// Cross-fade: 1500ms
// Ken Burns: 既存維持

// キャプション位置調整 (PC):
const captionPCStyle = {
  position: 'absolute',
  bottom: '15%',
  left: '50%',
  transform: 'translateX(-50%)',
  textAlign: 'center',
  color: QC.warmWhite,
  textShadow: '0 2px 20px rgba(0,0,0,0.5)',
  fontFamily: QC_FONT_JP,
  fontSize: 'clamp(18px, 2vw, 24px)',
  fontWeight: 300,
  letterSpacing: 2,
  lineHeight: 1.8,
};

// 大きなコピー (チャッピー案):
"うちの子との時間を、
 ちゃんと残せる場所。"

// 小さい説明文:
"ペットを愛する人たちが集まる、
 コミュニティ＆マーケットプレイス。"
```

### 画像

```
チャッピー (DALL-E 3) で生成中のシネマ画像 7枚を使用:
- 朝の犬 (ベッド)
- 窓辺の猫 (午後)
- 散歩道 (golden hour)
- リビング (linen sofa)
- 台所 (evening)
- 玄関 (morning)
- 庭 (late summer)

→ Supabase Storage にアップロード
→ App.tsx の HERO_IMAGES_PC 配列に追加
→ モバイル用は既存 (qocca hero 1-7.jpg) を維持
```

---

## 🎨 SECTION 2: SectionWhatIsQocca (完璧版)

### v2 コピー確定版 (前回の議論で確定)

```typescript
const items = [
  {
    title: 'うちの子との記憶を、形に残す',
    quote: '"あの瞬間を、永遠の形に"',
    desc: '似顔絵、羊毛作品、記念グッズ。\n街の作家たちが、心を込めて。',
    linkText: '商店街を覗いてみる',  // ⭐ "暮らし寄り" に変更
    onClick: () => setPage("search"),
  },
  {
    title: 'うちの子の話で、笑い合う',
    quote: '"犬種ごとの、専門コミュニティ"',
    desc: '毎日の発見を、分かり合える人と。\nうちの子と同じ仲間の集まり。',
    linkText: '広場でつながる',  // ⭐ "暮らし寄り" に変更
    onClick: () => setPage("communities"),
  },
  {
    title: '街を歩いてみる',
    quote: '"クリエイター、イベント、施設"',
    desc: 'ペットと過ごす日常を、もっと豊かに。\nお出かけ先、出会い、発見。',
    linkText: '案内所へ',  // ⭐ 維持 (タイトルが "街を歩く" だから)
    onClick: () => setPage("facilities"),
  },
];
```

### 完璧化ポイント (5つ)

```typescript
// 1. カードの余白拡大 (Aesop レベル)
const cardStyle = {
  padding: isMobile ? '64px 32px' : '80px 48px',  // ⭐ 拡大
  // 既存: '48px 32px' → 拡大
};

// 2. hover を "気配" レベル
const cardHoverStyle = (isHover) => ({
  transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
  boxShadow: 'none',  // ⭐ boxShadow 削除
  border: `1px solid ${isHover ? QC.softBrown : QC.lightSand}`,  // ⭐ border opacity 変化のみ
  transition: 'transform 1.0s ease, border-color 0.8s ease',  // ⭐ さらにゆっくり
});

// 3. 文字の行間を広く
const cardTitleStyle = {
  lineHeight: 2.0,  // 既存: 1.6 → 2.0 に
};

// 4. リンクテキストの動詞化 (上記参照)

// 5. ⭐ NEW: カード下に "空気コピー"
<div style={{
  marginTop: 80,
  textAlign: 'center',
}}>
  <p style={{
    fontFamily: QC_FONT_JP,
    fontSize: 11,
    fontStyle: 'italic',
    fontWeight: 300,
    color: QC.warmGray,
    letterSpacing: 1.2,
    opacity: 0.7,
    margin: 0,
  }}>
    今日も、新しい思い出が置かれています。
  </p>
</div>
```

---

## 🖼 SECTION 3: SectionTodaysMoments (キャプション革新)

### 大改修: "綺麗な写真" → "記憶の断片"

```typescript
// タイトル変更
"Today's Quiet Moments / 今日のうちの子たち"
↓
"Today's Stories / 暮らしの断片"  // ⭐ 変更

// キャプション哲学の刷新
// チャッピー案を採用:

例えば既存:
"うちの子の、いちばん安心な顔" → "ぽぽ"
↓
"毎朝、いちばん早く起きてた"

"今日もおさんぽ、おつかれさま" → "ひなた"
↓
"いつもの散歩道、いつものペース"

"おやすみのまるく" → "にゃも"
↓
"窓辺で、ずっと外を見てた"

⭐ 重要:
- 動詞は過去形/進行形 ("〜してた" "〜していた")
- "記憶の断片" 感
- ペット名は表示しない (より普遍的に)
- 1行 12-20文字程度
```

### Frame 統一 (チャッピー5戦略)

```typescript
const photoFrameStyle = {
  // ① 統一フィルター (Qoccaフィルター)
  filter: 'saturate(0.85) brightness(1.02) contrast(0.95)',
  
  // ② 細枠
  border: '1px solid ' + QC.lightSand,
  
  // ③ Paper texture (薄く)
  background: QC.warmWhite,
  
  // ④ Polaroid 風 padding
  padding: 8,
  
  // ⑤ subtle box-shadow
  boxShadow: '0 4px 12px rgba(44, 41, 38, 0.04)',
};

// Masonry レイアウト (既存維持)
// サイズランダム化 (チャッピー②採用):
const aspectRatios = [
  '3/4',  // 縦長
  '4/3',  // 横長
  '1/1',  // 正方形
  '2/3',  // 縦長 (大)
  '3/2',  // 横長 (大)
];
// 各画像でランダムに選択
```

### キャプション統一 (チャッピー④採用)

```typescript
const captionStyle = {
  fontFamily: QC_FONT_JP,
  fontSize: 11,
  fontWeight: 300,
  color: QC.warmGray,
  letterSpacing: 0.8,
  lineHeight: 1.8,
  marginTop: 12,
  fontStyle: 'italic',  // 全部イタリック
  opacity: 0.85,
};
```

---

## 💎 SECTION 4: ⭐NEW⭐ SectionQuietlyLoved

```
チャッピー命名: "街で静かに愛されている作品"
英字: "Quietly Loved in Town"

役割:
- 既存の "ランキング" 機能を、競争 → 共感に翻訳
- リアクションの多い商品/作品を表示
- 商業感ゼロ、コミュニティ感MAX
```

### 構造

```typescript
const SectionQuietlyLoved = () => {
  // approved listings からリアクション順 or 新着順で 6件取得
  const [items, setItems] = useState([]);
  
  useEffect(() => {
    // Supabase から取得
    const fetch = async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles(username, avatar_url)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(6);
      setItems(data || []);
    };
    fetch();
  }, []);
  
  return (
    <section style={{ padding: '200px 0' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 32px' }}>
        
        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <p style={{
            fontFamily: QC_FONT_EN,
            fontSize: 13,
            fontStyle: 'italic',
            color: QC.warmGray,
            margin: '0 0 12px 0',
            opacity: 0.75,
            fontWeight: 300,
          }}>
            Quietly Loved in Town
          </p>
          <h2 style={{
            fontFamily: QC_FONT_JP,
            fontSize: 'clamp(20px, 4vw, 24px)',
            fontWeight: 500,
            color: QC.softBrown,
            letterSpacing: 0.8,
            margin: 0,
          }}>
            街で静かに愛されている作品
          </h2>
          <div style={{ marginTop: 40, width: 32, height: 1,
                       background: QC.lightSand, margin: '40px auto 0' }} />
        </div>
        
        {/* 商品 Masonry */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: 24,
        }}>
          {items.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
        
        {/* 空気コピー */}
        <div style={{ marginTop: 80, textAlign: 'center' }}>
          <p style={{
            fontFamily: QC_FONT_JP,
            fontSize: 11,
            fontStyle: 'italic',
            fontWeight: 300,
            color: QC.warmGray,
            letterSpacing: 1.2,
            opacity: 0.7,
          }}>
            今日も、誰かの心を動かしているもの。
          </p>
        </div>
        
        {/* CTA */}
        <div style={{ marginTop: 60, textAlign: 'center' }}>
          <span 
            onClick={() => setPage('search')}
            style={{
              fontFamily: QC_FONT_JP,
              fontSize: 12,
              color: QC.softBrown,
              borderBottom: `1px solid ${QC.softBrown}`,
              paddingBottom: 4,
              cursor: 'pointer',
              letterSpacing: 1.2,
            }}>
            すべての作品を見る
          </span>
        </div>
      </div>
    </section>
  );
};
```

---

## 📖 SECTION 5: ⭐NEW⭐ SectionResidentDiaries

```
チャッピー命名: "住民たちの日記"
英字: "Diaries from Town"

役割:
- 既存のブログを HomePage に統合
- 街の住民が書いた日々の記録を見せる
- 公式ブログ + ユーザーブログ (将来)
```

### 構造

```typescript
const SectionResidentDiaries = () => {
  const [posts, setPosts] = useState([]);
  
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('*, profiles(username)')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(3);
      setPosts(data || []);
    };
    fetch();
  }, []);
  
  return (
    <section style={{ padding: '200px 0' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 32px' }}>
        
        {/* ヘッダー (同じパターン) */}
        <SectionHeader 
          en="Diaries from Town"
          jp="住民たちの日記"
        />
        
        {/* ブログ記事 (3カラム or 1カラム) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 32,
        }}>
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
        
        {/* 空気コピー */}
        <div style={{ marginTop: 80, textAlign: 'center' }}>
          <p style={{...同じスタイル}}>
            今日も、誰かが何かを書き残しています。
          </p>
        </div>
      </div>
    </section>
  );
};

// BlogCard コンポーネント
const BlogCard = ({ post }) => (
  <article style={{
    border: `1px solid ${QC.lightSand}`,
    background: QC.warmWhite,
    padding: 32,
    cursor: 'pointer',
    transition: 'border-color 0.8s ease',
  }}>
    {post.cover_image && (
      <img src={post.cover_image} 
           style={{ 
             width: '100%', 
             aspectRatio: '16/10',
             objectFit: 'cover',
             filter: 'saturate(0.85)',  // Qoccaフィルター
             marginBottom: 24,
           }} />
    )}
    <h3 style={{
      fontFamily: QC_FONT_JP,
      fontSize: 15,
      fontWeight: 500,
      color: QC.softBrown,
      lineHeight: 1.8,
      margin: '0 0 12px 0',
    }}>
      {post.title}
    </h3>
    <p style={{
      fontFamily: QC_FONT_JP,
      fontSize: 12,
      fontWeight: 300,
      color: QC.warmGray,
      lineHeight: 1.9,
      margin: 0,
    }}>
      {post.excerpt || post.content.substring(0, 80) + '...'}
    </p>
  </article>
);
```

---

## 🗺 SECTION 6: SectionTownMap (微調整)

```
既存維持、ただし:
✅ hover を "気配" レベルに
✅ サブテキストで機能明示 (まだ抽象的すぎる場合)
✅ 余白拡大
```

---

## 💬 SECTION 7: SectionVoices (微調整)

```
既存維持、ただし:
✅ hover translateX(2px) → translateX(1px) (もっと気配)
✅ 余白拡大
```

---

## 🌟 SECTION 8: SectionJoinTown (CTA見直し)

### コピー刷新

```typescript
// BEFORE:
"あなたの家の窓辺を、誰かに見せませんか。"
[Qoccaの住民になる]

// AFTER:
"うちの子との時間を、
 この街に置いていきませんか。"

[この街に参加する]  // ⭐ チャッピー提案
or
[暮らしを、置いていく]  // ⭐ チャッピー提案
```

---

## 🌀 全体スクロール調整 (Phase G)

```typescript
// section間余白を全部統一
const SECTION_PADDING = {
  desktop: '200px 0',  // 既存より拡大
  mobile: '120px 0',
};

// HomePage 全体
<div style={{ background: 'transparent' }}>
  <SectionHero />
  <div style={{ padding: SECTION_PADDING.desktop }}>
    <SectionWhatIsQocca />
  </div>
  <div style={{ padding: SECTION_PADDING.desktop }}>
    <SectionTodaysMoments />
  </div>
  ...
</div>

// アニメーション速度を全部統一
const QC_TIMING = {
  hover: '1.0s',  // 既存 0.8s → 1.0s
  fadeIn: '1.5s',  // 既存 1.2s → 1.5s
  heroCrossFade: 1800,  // 既存 1500ms → 1800ms
};
```

---

## 📋 実装手順 (クマ用)

### Phase A: SectionWhatIsQocca v2 修正 (最優先・15分)

```
1. items 配列のタイトル2箇所を v2 に修正
   - "思い出を形に残す" → "うちの子との記憶を、形に残す"
   - "同じうちの子と話す" → "うちの子の話で、笑い合う"

2. リンクテキスト変更:
   - "商店街へ" → "商店街を覗いてみる"
   - "広場へ" → "広場でつながる"
   - "案内所へ" → "案内所へ" (維持)

3. カード余白拡大: padding を 48px → 80px (PC)
4. hover 軽量化: boxShadow 削除、border 変化のみ
5. 空気コピー追加 (3カード下)

→ ブランチ: claude/whatisqocca-v3-perfect
```

### Phase B: SectionHero シネマ化 (画像到着後)

```
1. PC専用ワイド表示の実装
2. HERO_IMAGES_PC 配列 (新しい21:9画像)
3. キャプション位置調整 (下部 15%)
4. 既存両サイドぼかしロジック削除

→ ブランチ: claude/hero-cinematic
→ 画像を Supabase Storage にアップロード後に作業
```

### Phase C: SectionTodaysMoments キャプション革新 (30分)

```
1. タイトル: "今日のうちの子たち" → "暮らしの断片"
2. 既存 22枚のキャプションを "記憶の断片" 型に修正
   (DB 更新 SQL 必要)
3. Frame 統一 (border, padding, filter)
4. キャプション統一 (italic, 軽いフォント)

→ ブランチ: claude/moments-stories
```

### Phase D: SectionQuietlyLoved 新規作成 (60分)

```
1. 既存 SectionAtelier を改修 or 並列で新規作成
2. listings を 6件取得
3. ProductCard コンポーネント作成
4. 配置: SectionTodaysMoments の次

→ ブランチ: claude/quietly-loved
```

### Phase E: SectionResidentDiaries 新規作成 (45分)

```
1. blog_posts を 3件取得
2. BlogCard コンポーネント作成
3. 配置: SectionQuietlyLoved の次

→ ブランチ: claude/resident-diaries
```

### Phase F: SectionJoinTown コピー更新 (5分)

```
1. タイトル更新
2. CTA ボタンテキスト変更

→ ブランチ: claude/join-town-update
```

### Phase G: 全体スクロール調整 (15分)

```
1. SECTION_PADDING 統一
2. QC_TIMING 統一
3. 全体ビルド確認

→ ブランチ: claude/scroll-refinement
```

### Phase H: 最終確認・デプロイ

```
1. 全ブランチを順番に main にマージ
2. Vercel デプロイ
3. King 動作確認
4. 微調整サイクル
```

---

## ⚠️ クマへの厳守事項

```
🚨 99-safety-protocol.md 完全遵守:

✅ 全てのフェーズで新ブランチで作業
✅ main 直接コミット禁止
✅ Phase F (デプロイ) は King の明示承認後
✅ 各Phase 完了後、King 確認を待つ
✅ DB操作は3段階確認 (確認SQL → 実行 → 結果確認)
✅ 既存セクションを破壊しない (新セクションは追加)
✅ 影響範囲を必ず事前報告
✅ ロールバック手順を提示
```

---

## ✅ 完了基準

```
✅ PC Hero がシネマティック表示 (21:9)
✅ SectionWhatIsQocca が v2 完璧版
✅ SectionTodaysMoments がキャプション革新済み
✅ SectionQuietlyLoved (NEW) 追加
✅ SectionResidentDiaries (NEW) 追加
✅ 全SECTION で hover が "気配" レベル
✅ 全体スクロールが "ゆっくり呼吸" している
✅ ビルドエラーなし
✅ qocca.pet に反映
✅ King の最終 OK
```

---

## 🎯 期待される最終形

```
🌟 完成後の qocca.pet:

PC で訪問:
- シネマティック Hero、映画のワンシーン
- スクロール → "What is Qocca" 機能理解
- スクロール → "暮らしの断片" 記憶のコラージュ
- スクロール → "街で静かに愛されている作品" 商品
- スクロール → "住民たちの日記" ブログ
- スクロール → "Town Map" 4つの場所
- スクロール → "Voices" 街の声
- スクロール → "Join Town" 自然な誘い

→ 全体: "詩集のような街への招待状"
→ ユーザー体験: 5-10分、深く浸れる
→ 結果: "ここに住みたい" の感情
```

---

> **作成**: 2026/5/13 04:50
> **対象**: クマ (Claude Code)
> **承認**: King (確定)
> **議論参加**: ワイ (Claude.ai) + チャッピー (ChatGPT)
> **実装目標**: 今日中 (一日プロジェクト)
