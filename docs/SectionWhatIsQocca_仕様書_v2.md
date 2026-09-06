# 🎨 "What is Qocca" セクション 完全仕様書 v2 (最終版)

> **作成日**: 2026/5/13 02:15
> **対象**: Claude Code (クマ)
> **背景**: King と チャッピー (ChatGPT) のレビューで確定
> **方針**: 静けさを守りながら、7秒で機能理解させる
> **重要更新**: v2 - チャッピーのレビューを反映した最終版

---

## 🎯 v1 からの変更点 (重要)

```
🔄 カード1 タイトル変更:
   v1: "思い出を形に残す"
   v2: "うちの子との記憶を、形に残す" ← より人生保存感UP

🔄 カード2 タイトル変更:
   v1: "同じうちの子と話す"
   v2: "うちの子の話で、笑い合う" ← 機能寄り → 暮らし寄り

✅ カード3: 変更なし
   "街を歩いてみる" (チャッピーも「かなり良い」評価)
```

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
3. SectionTodaysMoments (現状維持、※次フェーズで Gallery 改善予定)
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

## 📋 最終版コンテンツ (3カード)

### カード 1: うちの子との記憶を、形に残す

```typescript
{
  title: 'うちの子との記憶を、形に残す',
  quote: '"あの瞬間を、永遠の形に"',
  desc: '似顔絵、羊毛作品、記念グッズ。\n街の作家たちが、心を込めて。',
  linkText: '商店街へ',
  linkPage: 'search',
}
```

### カード 2: うちの子の話で、笑い合う

```typescript
{
  title: 'うちの子の話で、笑い合う',
  quote: '"犬種ごとの、専門コミュニティ"',
  desc: '毎日の発見を、分かり合える人と。\nうちの子と同じ仲間の集まり。',
  linkText: '広場へ',
  linkPage: 'communities',
}
```

### カード 3: 街を歩いてみる

```typescript
{
  title: '街を歩いてみる',
  quote: '"クリエイター、イベント、施設"',
  desc: 'ペットと過ごす日常を、もっと豊かに。\nお出かけ先、出会い、発見。',
  linkText: '案内所へ',
  linkPage: 'facilities',
}
```

---

## 🎨 デザイン仕様

### セクション全体

```typescript
const sectionWhatIsQoccaStyle = {
  padding: '160px 0 160px',
  background: 'transparent',
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
// 英字サブタイトル
{
  fontFamily: QC_FONT_EN,
  fontSize: 13,
  fontStyle: 'italic',
  color: QC.warmGray,
  letterSpacing: 0.8,
  margin: '0 0 12px 0',
  opacity: 0.75,
  fontWeight: 300,
  text: 'What you can do here',
}

// メインタイトル
{
  fontFamily: QC_FONT_JP,
  fontSize: 'clamp(20px, 4vw, 24px)',
  fontWeight: 500,
  color: QC.softBrown,
  letterSpacing: 0.8,
  lineHeight: 1.5,
  margin: 0,
  text: 'Qocca、できること',
}

// ディバイダー
{
  marginTop: 40,
  width: 32,
  height: 1,
  background: QC.lightSand,
  margin: '40px auto 0',
}
```

### カード内の要素

```typescript
// タイトル (大、詩的、人生感)
{
  fontFamily: QC_FONT_JP,
  fontSize: 17,
  fontWeight: 400,
  color: QC.softBrown,
  margin: '0 0 16px 0',
  letterSpacing: 0.8,
  lineHeight: 1.6,
}

// 詩的サブコピー (引用風)
{
  fontFamily: QC_FONT_JP,
  fontSize: 12,
  fontStyle: 'italic',
  fontWeight: 300,
  color: QC.warmGray,
  margin: '0 0 24px 0',
  letterSpacing: 0.5,
  lineHeight: 1.7,
  opacity: 0.85,
}

// 機能説明
{
  fontFamily: QC_FONT_JP,
  fontSize: 12,
  fontWeight: 300,
  color: QC.warmGray,
  margin: '0 0 32px 0',
  lineHeight: 1.9,
  letterSpacing: 0.3,
  whiteSpace: 'pre-line',
}

// リンク (CTA代わり、控えめ)
{
  fontFamily: QC_FONT_JP,
  fontSize: 12,
  fontWeight: 300,
  color: QC.softBrown,
  letterSpacing: 1.2,
  borderBottom: `1px solid rgba(139, 111, 92, 0.3)`,
  paddingBottom: 4,
  transition: 'border-color 0.6s ease',
  // hover時: borderBottom -> QC.softBrown
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
      title: 'うちの子との記憶を、形に残す',
      quote: '"あの瞬間を、永遠の形に"',
      desc: '似顔絵、羊毛作品、記念グッズ。\n街の作家たちが、心を込めて。',
      linkText: '商店街へ',
      onClick: () => setPage("search"),
    },
    {
      title: 'うちの子の話で、笑い合う',
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
grep -n "SectionHero" src/App.tsx
grep -n "SectionTodaysMoments" src/App.tsx
grep -n "const HomePage" src/App.tsx
```

### Phase 2: 新セクション追加 (15分)

```
1. SectionTodaysMoments の定義の直前に
   SectionWhatIsQocca コンポーネントを追加

2. HomePage 内で SectionHero と SectionTodaysMoments の間に
   <SectionWhatIsQocca setPage={setPage} /> を追加
```

### Phase 3: ビルド確認 (5分)

```bash
npm run build
```

### Phase 4: コミット (5分)

```bash
git checkout -b claude/what-is-qocca-section
git add src/App.tsx
git commit -m "feat: SectionWhatIsQocca v2 追加 - 機能理解導線 (King+チャッピー確定版)"
```

### Phase 5: King 承認後にデプロイ

```
King の "OK、デプロイして" を待ってから:
git push origin claude/what-is-qocca-section
PR 作成 → main マージ → Vercel デプロイ
```

---

## ✅ 完了基準

```
✅ SectionWhatIsQocca が HomePage に追加される
✅ Hero と Today's Moments の間に配置
✅ 3カード (記憶/笑い合う/街を歩く) が表示
✅ コピーが v2 (最終版) で実装されている
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
- SectionTodaysMoments は触らない
- 他のセクションも一切触らない

⚠️ 静けさRedesign ブランチとの関係:
- 静けさRedesign (claude/silent-redesign-day2) がまだ未マージなら:
  → 待つ (静けさが先)
- 静けさRedesign が main にマージ済みなら:
  → main から新ブランチ作成 OK

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

After (新セクション追加):
Hero (感情)
  ↓
What is Qocca (機能理解) ← NEW! v2 確定版
  ↓
Today's Moments (これは "暮らしの記録" として理解できる)
```

→ 7秒以内に "何ができる場所か" 理解可能に
→ それでも静けさは保たれる
→ "感情で引き込み、機能で理解させる" 達成
→ チャッピーの "人生保存感" + "暮らし感" も反映

---

## 🔄 次フェーズの予定 (記録)

```
このセクション完了後の次のステップ:

【次フェーズ 1】Gallery (Today's Moments) のキャプション革新
   - "毎朝ベッドに飛び乗ってきた子"
   - "帰宅すると玄関で待っていた"
   - "いつも同じ窓から外を見てた"
   → "作品" ではなく "記憶の断片" として見せる

【次フェーズ 2】全 SECTION の CTA 見直し
   - 「投稿する」→「うちの子の時間を残す」
   - 商業感を完全排除
```

→ チャッピーから提案あり、King 承認済み、次フェーズで実装

---

> **更新**: 2026/5/13 02:15 (v2 - チャッピー案採用版)
> **承認**: King
> **実装担当**: クマ (Claude Code)
