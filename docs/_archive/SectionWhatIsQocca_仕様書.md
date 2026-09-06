# 🎨 "What is Qocca" セクション 完全仕様書

> **作成日**: 2026/5/13
> **対象**: Claude Code (クマ)
> **背景**: King と チャッピー (ChatGPT) の指摘により、
>           Hero と Today's Moments の間に "機能理解" のセクションが必要と判断
> **方針**: 静けさを守りながら、7秒で機能理解させる

---

## 🎯 セクションの目的

```
ユーザーが Qocca を開いてから:

⏱ 0.5秒: Hero で "なんか好き" (感情)
⏱ 3秒: "ペット好きの場所や" (ジャンル理解)

★⏱ 7秒: "何ができるんや" (機能理解) ← このセクションの役割

⏱ 15秒: "自分も参加したい" (行動)
```

---

## 📍 配置位置

```
HomePage の構造 (変更後):

1. SectionHero (現状維持)
   ↓
★ 2. SectionWhatIsQocca (新規追加) ← ココ
   ↓
3. SectionTodaysMoments (現状維持)
   ↓
4. SectionTownMap (現状維持)
   ↓
5. SectionAtelier (現状維持)
   ↓
6. SectionVoices (現状維持)
   ↓
7. SectionJoinTown (現状維持)
   ↓
SharedFooter
```

---

## 🎨 デザイン仕様

### セクション全体

```typescript
const sectionWhatIsQoccaStyle = {
  padding: '160px 0 160px',  // Hero と Today's Moments の間、やや控えめ
  background: 'transparent',   // HomePage の動的背景を見せる
  position: 'relative',
};
```

### コンテナ

```typescript
const containerStyle = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '0 32px',
};
```

### セクションヘッダー

```typescript
const headerStyle = {
  textAlign: 'center',
  marginBottom: 80,
};

// 英字サブタイトル
const subtitleEnStyle = {
  fontFamily: QC_FONT_EN,
  fontSize: 13,
  fontStyle: 'italic',
  color: QC.warmGray,
  letterSpacing: 0.8,
  margin: '0 0 12px 0',
  opacity: 0.75,
  fontWeight: 300,
};

// メインタイトル
const titleJpStyle = {
  fontFamily: QC_FONT_JP,
  fontSize: 'clamp(20px, 4vw, 24px)',
  fontWeight: 500,  // 静けさルール
  color: QC.softBrown,
  letterSpacing: 0.8,
  lineHeight: 1.5,
  margin: 0,
};

// ディバイダー
const dividerStyle = {
  marginTop: 40,
  width: 32,
  height: 1,
  background: QC.lightSand,
  margin: '40px auto 0',
};
```

### カードグリッド

```typescript
const cardsGridStyle = (isMobile) => ({
  display: 'grid',
  gridTemplateColumns: isMobile 
    ? '1fr'                        // モバイル: 1列
    : 'repeat(3, 1fr)',            // PC: 3列
  gap: isMobile ? 24 : 32,
});
```

### カードスタイル

```typescript
const cardStyle = (isHover) => ({
  background: QC.warmWhite,
  borderRadius: 4,
  padding: '48px 32px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.8s ease',
  border: `1px solid ${QC.lightSand}`,
  transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
  boxShadow: isHover 
    ? '0 8px 24px rgba(44, 41, 38, 0.04)' 
    : 'none',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});
```

### カード内の要素

```typescript
// 大きな日本語コピー (詩的)
const cardTitleStyle = {
  fontFamily: QC_FONT_JP,
  fontSize: 17,
  fontWeight: 400,  // 軽く
  color: QC.softBrown,
  margin: '0 0 16px 0',
  letterSpacing: 0.8,
  lineHeight: 1.6,
};

// 詩的サブコピー (引用風)
const cardQuoteStyle = {
  fontFamily: QC_FONT_JP,
  fontSize: 12,
  fontStyle: 'italic',
  fontWeight: 300,
  color: QC.warmGray,
  margin: '0 0 24px 0',
  letterSpacing: 0.5,
  lineHeight: 1.7,
  opacity: 0.85,
};

// 機能説明 (具体的)
const cardDescStyle = {
  fontFamily: QC_FONT_JP,
  fontSize: 12,
  fontWeight: 300,
  color: QC.warmGray,
  margin: '0 0 32px 0',
  lineHeight: 1.9,
  letterSpacing: 0.3,
};

// リンクテキスト (CTA代わり、控えめ)
const cardLinkStyle = (isHover) => ({
  fontFamily: QC_FONT_JP,
  fontSize: 12,
  fontWeight: 300,
  color: QC.softBrown,
  letterSpacing: 1.2,
  borderBottom: `1px solid ${isHover ? QC.softBrown : 'rgba(139, 111, 92, 0.3)'}`,
  paddingBottom: 4,
  transition: 'border-color 0.6s ease',
  marginTop: 'auto',  // カード下端に配置
});
```

---

## 📋 コンテンツ (3カード)

### カード 1: 思い出を形に残す

```typescript
{
  title: '思い出を形に残す',
  quote: '"あの瞬間を、永遠の形に"',
  desc: '似顔絵、羊毛作品、記念グッズ。\n街の作家たちが、心を込めて。',
  linkText: '商店街へ',
  linkPage: 'search',  // SectionAtelier or 全出品ページ
}
```

### カード 2: 同じうちの子と話す

```typescript
{
  title: '同じうちの子と話す',
  quote: '"犬種ごとの、専門コミュニティ"',
  desc: '毎日の発見を、分かり合える人と。\nうちの子と同じ仲間の集まり。',
  linkText: '広場へ',
  linkPage: 'communities',  // SectionVoices or コミュニティページ
}
```

### カード 3: 街を歩いてみる

```typescript
{
  title: '街を歩いてみる',
  quote: '"クリエイター、イベント、施設"',
  desc: 'ペットと過ごす日常を、もっと豊かに。\nお出かけ先、出会い、発見。',
  linkText: '案内所へ',
  linkPage: 'facilities',  // 施設ページ
}
```

---

## 💻 完全コード (実装用)

```tsx
const SectionWhatIsQocca = ({ setPage }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const items = [
    {
      title: '思い出を形に残す',
      quote: '"あの瞬間を、永遠の形に"',
      desc: '似顔絵、羊毛作品、記念グッズ。\n街の作家たちが、心を込めて。',
      linkText: '商店街へ',
      onClick: () => setPage("search"),
    },
    {
      title: '同じうちの子と話す',
      quote: '"犬種ごとの、専門コミュニティ"',
      desc: '毎日の発見を、分かり合える人と。\nうちの子と同じ仲間の集まり。',
      linkText: '広場へ',
      onClick: () => setPage("communities"),
    },
    {
      title: '街を歩いてみる',
      quote: '"クリエイター、イベント、施設"',
      desc: 'ペットと過ごす日常を、もっと豊かに。\nお出かけ先、出会い、発見。',
      linkText: '案内所へ',
      onClick: () => setPage("facilities"),
    },
  ];

  return (
    <section style={{
      padding: '160px 0 160px',
      background: 'transparent',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 32px' }}>
        
        {/* セクションヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
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
            What you can do here
          </p>
          <h2 style={{
            fontFamily: QC_FONT_JP,
            fontSize: 'clamp(20px, 4vw, 24px)',
            fontWeight: 500,
            color: QC.softBrown,
            letterSpacing: 0.8,
            lineHeight: 1.5,
            margin: 0,
          }}>
            Qocca、できること
          </h2>
          <div style={{
            marginTop: 40,
            width: 32,
            height: 1,
            background: QC.lightSand,
            margin: '40px auto 0',
          }} />
        </div>

        {/* 3カード */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 24 : 32,
        }}>
          {items.map((item, i) => {
            const isHover = hoverIndex === i;
            return (
              <div
                key={i}
                onClick={item.onClick}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{
                  background: QC.warmWhite,
                  borderRadius: 4,
                  padding: '48px 32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.8s ease',
                  border: `1px solid ${QC.lightSand}`,
                  transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: isHover 
                    ? '0 8px 24px rgba(44, 41, 38, 0.04)' 
                    : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                }}
              >
                {/* タイトル (詩的・大きく) */}
                <h3 style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: 17,
                  fontWeight: 400,
                  color: QC.softBrown,
                  margin: '0 0 16px 0',
                  letterSpacing: 0.8,
                  lineHeight: 1.6,
                }}>
                  {item.title}
                </h3>

                {/* 引用 (詩的・控えめ) */}
                <p style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: 12,
                  fontStyle: 'italic',
                  fontWeight: 300,
                  color: QC.warmGray,
                  margin: '0 0 24px 0',
                  letterSpacing: 0.5,
                  lineHeight: 1.7,
                  opacity: 0.85,
                }}>
                  {item.quote}
                </p>

                {/* 機能説明 (具体的) */}
                <p style={{
                  fontFamily: QC_FONT_JP,
                  fontSize: 12,
                  fontWeight: 300,
                  color: QC.warmGray,
                  margin: '0 0 32px 0',
                  lineHeight: 1.9,
                  letterSpacing: 0.3,
                  whiteSpace: 'pre-line',
                }}>
                  {item.desc}
                </p>

                {/* リンク (CTA代わり、控えめ) */}
                <div style={{
                  marginTop: 'auto',
                  textAlign: 'center',
                }}>
                  <span style={{
                    fontFamily: QC_FONT_JP,
                    fontSize: 12,
                    fontWeight: 300,
                    color: QC.softBrown,
                    letterSpacing: 1.2,
                    borderBottom: `1px solid ${isHover 
                      ? QC.softBrown 
                      : 'rgba(139, 111, 92, 0.3)'}`,
                    paddingBottom: 4,
                    transition: 'border-color 0.6s ease',
                  }}>
                    {item.linkText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
```

---

## 🛠 実装手順 (クマ用)

### Phase 1: ファイル探索 (3分)

```bash
# App.tsx 内で HomePage の構造を確認
grep -n "SectionHero" src/App.tsx
grep -n "SectionTodaysMoments" src/App.tsx
grep -n "const HomePage" src/App.tsx
```

### Phase 2: 新セクション追加 (15分)

```
1. SectionTodaysMoments の定義の直前 (上) に
   SectionWhatIsQocca コンポーネントを追加
   
2. HomePage 内で SectionHero と SectionTodaysMoments の間に
   <SectionWhatIsQocca setPage={setPage} /> を追加
```

### Phase 3: ビルド確認 (5分)

```bash
npm run build
```

→ エラーなければ OK

### Phase 4: コミット (5分)

```bash
git add src/App.tsx
git commit -m "feat: SectionWhatIsQocca 追加 - 機能理解導線"
```

### Phase 5: King 承認後にデプロイ

```
King の "OK、デプロイして" を待ってから:
git push
```

---

## ✅ 完了基準

```
✅ SectionWhatIsQocca が HomePage に追加される
✅ Hero と Today's Moments の間に配置
✅ 3カード (思い出/同じ/街を歩く) が表示
✅ レスポンシブ (モバイル1列、PC3列)
✅ クリック → 各ページ遷移
✅ 静けさルール厳守 (絵文字なし、軽いフォント、ゆっくり)
✅ ビルドエラーなし
```

---

## 🚨 クマへの注意点

```
⚠️ 既存セクションを破壊しないこと:
- SectionHero は触らない
- SectionTodaysMoments は触らない (位置だけずれる)
- 他のセクションも一切触らない

⚠️ "What is Qocca" のセクション名:
- 関数名: SectionWhatIsQocca
- ファイル: src/App.tsx (既存のモノリシック構造内)
- 配置: SectionTodaysMoments の直前

⚠️ 99-safety-protocol.md の厳守:
- 影響範囲の事前報告
- ブランチで作業 (claude/what-is-qocca-section)
- main 直接コミット禁止
- 完了報告は詳細フォーマット
```

---

## 🎯 期待される効果

```
Before (現状):
Hero (感情)
  ↓
Today's Moments (綺麗な写真) ← "で、何する場所?" になる
  ↓
Town Map (場所の名前だけ)

After (新セクション追加):
Hero (感情)
  ↓
What is Qocca (機能理解) ← NEW!
  ↓
Today's Moments (これは "暮らしの記録" として理解できる)
  ↓
Town Map (場所の意味が分かる)
```

→ 7秒以内に "何ができる場所か" 理解可能に
→ それでも静けさは保たれる
→ "感情で引き込み、機能で理解させる" 達成

---

> **更新**: 2026/5/13 (King 確定版)
> **承認**: King
> **実装担当**: クマ (Claude Code)
