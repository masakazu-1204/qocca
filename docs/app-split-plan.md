# 🐻 App.tsx 分割計画 (Qocca Refactoring Plan)

> このドキュメントは `src/App.tsx`（約8,671行のモノリス）を安全に分割するための
> マスター計画書です。長期戦のため、セッションが切れても再開できる「地図」として残します。
>
> **作業ブランチ**: `refactor/split-app`
> **作成日**: 2026-06-14
> **担当**: クマ (Claude Code) / 判断: King

---

## 🎯 大方針：「基盤先出し → 葉から幹へ」

モノリスを割る時の最大の罠は **循環import** である。

- ❌ 悪い順：先に `FacilitiesPage` を切り出す → 中で `supabase`/`C`/`useAuth` を使う
  → それらは App.tsx に残ってる → `App.tsx → Facilities → App.tsx` の循環
  → ビルドは通っても初期化順で壊れる地雷。
- ✅ 良い順：**共有基盤（supabase/定数/認証/hooks）を先に独立モジュールへ**
  → App.tsx もそれを import → あとは各機能が基盤を import するだけで循環が一切起きない。

各ステップ後に必ず `npm run build`（型チェック＋ビルド）で緑を確認してから次へ。

---

## 🧷 全Phase共通の安全装置（厳守）

1. **ロジックは1文字も変えない** ＝「切って貼って import 足すだけ」に徹する
2. **1機能=1コミット**、各コミット前に `npm run build` 緑確認
3. **`createClient` / `createContext` は新規生成しない**（既存を切り取って移動のみ）
   - 2個目を作ったら認証・リアルタイム購読・決済導線が全滅する
4. 各Phaseで該当画面を **1回手動で目視**（特に決済・施設・SNS）
5. 詰まったら即 `git reset --hard` で戻れる粒度を保つ
6. PRはPhase単位 or 数Phaseまとめて、King レビュー後マージ
7. main 直接コミット禁止（必ず `refactor/split-app` 上で作業）

### 🚨 絶対に壊してはいけない既存機能（防御対象）

- **決済防御 (v29/v30/v31)** — Stripe導線・BPF表示・購入確認モーダル
- **SNS自動投稿** — コミュニティ/イベント/ギャラリーの投稿機能
- **施設マップ 3,525件** — Facilities群
- **18住民 / 10出品 / 2取引** — 既存データに依存する表示

---

## 📐 最終的なファイル構成（ゴール像）

```
src/
├── App.tsx               ← 最終的に ~400行（ルーティングと統合だけ）
├── types.ts              ← CommentTargetType 等の共有型
├── lib/
│   └── supabase.ts       ← supabase クライアント（唯一）
├── contexts/
│   └── AuthContext.tsx   ← AuthContext / AuthProvider / useAuth（唯一）
├── constants/
│   ├── theme.ts          ← QC トークン, フォント, KEYFRAMES, C
│   └── data.ts           ← CATS, PREFS, EVENT_*, ORDER_STEPS, NG_WORDS 等
├── utils/
│   ├── moderation.ts     ← detectContacts, detectNGWords, checkFacilityNGWords
│   └── format.ts         ← formatStat, calcPopularityScore, stepIndex 等
├── hooks/
│   └── index.ts          ← useListings, useFavorites, useIsPC, useHeroStats, useNav
├── components/
│   ├── ui/               ← Logo, Stars, Tag, Card, Navbar, Sidebar, TabBar 等
│   └── sections/         ← SectionHero〜SectionJoinTown（静けさ6本）
└── pages/
    ├── static/           ← Tokusho, Terms, Privacy, Contact, Legal
    ├── marketplace/      ← Search, Detail, Sell, Signup
    ├── mypage/           ← MyPage + 各Tab（最大塊）
    ├── facilities/       ← FacilitiesPage + 関連モーダル
    ├── community/        ← Communities, Events
    └── gallery/          ← Gallery, Blog
```

---

## 🪜 Phase 別 切り出し順（リスク低→高）

### Phase 0：準備（コード移動ゼロ）
- `git checkout -b refactor/split-app`（完了済み）
- まず**型を1個外出し**：L16 `type CommentTargetType` → `src/types.ts`
- **リスク：ほぼ無し。** ビルドが緑になる基準動作を確認する目的。

---

### Phase 1：純粋データ・関数（★最低リスク）
React も state も触らない、ただの定数と純関数。

| 切り出し先 | 中身（行） |
|---|---|
| `constants/theme.ts` | `C`(245) `QC`(1159) `QC_FONT_*`(1171) `QC_KEYFRAMES`(1175) `QC_HERO_DURATIONS`(1196) `CAT_COLORS`(154) |
| `constants/data.ts` | `CATS`(254) `LISTINGS`(264) `REVIEWS`(279) `EVENTS`(285) `EVENT_*`(286) `ORDER_STEPS`(293) `DISPUTE_REASONS`(311) `PREFS`(6490) `BLOG_CATS`(6087) `FACILITY_*`(6437-6474) `NG_WORDS`(5465) `CONTACT_PATTERNS`(5408) `COMMUNITY_CATEGORIES`(7883) `MOOD_TAGS`(6449) `QC_REACTIONS`(1388) |
| `utils/moderation.ts` | `detectContacts`(5450) `detectNGWords`(5486) `checkFacilityNGWords`(6481) |
| `utils/format.ts` | `formatStat`(685) `calcPopularityScore`(157) `sortByPopularity`(173) `stepIndex`(300) `evPetLabel/Color/Bg`(288) `miniBtnStyle`(5043) |

- **リスク：低。** import を App.tsx 側に足すだけ。`C` と `QC` は参照箇所が多い→**全文置換ではなく import 追加で解決**（参照名は変えない）。
- **⚠️ 決済防御の核心 `detectContacts`/`detectNGWords` はここで動く。** ロジックは1文字も変えず「移動のみ」。移動後に注文メッセージ送信を1回手動テスト。

---

### Phase 2：基盤シングルトン（★高レバレッジ・要慎重）
| 切り出し先 | 中身 |
|---|---|
| `lib/supabase.ts` | `SUPABASE_URL`(18) `supabase`(19) を **export** |
| `contexts/AuthContext.tsx` | `AuthContext`(25) `AuthProvider`(27) `useAuth`(96) |

- **リスク：中（影響は全域、でも作業は機械的）。**
- **🚨 絶対ルール：`createClient` と `createContext` は新規生成しない。既存を切り取って移動するだけ。** 2個目を作ったら認証・リアルタイム購読・決済導線が全滅する。
- 移動後、App.tsx 含め全ファイルが `import { supabase } from "./lib/supabase"` を参照。`useAuth` も同様。
- 確認：ログイン状態保持／`useListings`／DMリアルタイムが動くか。

---

### Phase 3：hooks（★低〜中リスク）
`hooks/index.ts` ← `useListings`(101) `useFavorites`(179) `useIsPC`(328) `useHeroStats`(698) `useNav`(8329)
- 各 hook は `supabase`（Phase2で確立済）を import するだけ。
- **リスク：低。** `useNav` は `useNavigate`(react-router) 依存なので、Router の内側でしか呼べない点だけ注意（現状通りなら問題なし）。

---

### Phase 4：葉UI部品（★低リスク）
`components/ui/` ← `Logo`(320) `Stars`(537) `Tag`(541) `Card`(545) `Sidebar`(339) `Navbar`(589) `PCNavbar`(495) `UserMenu`(416) `TabBar`(7528) `SharedFooter`(7494) `PCBanner`(8310) `OrderStatusBar`(4093) `submitListing`(210)
- 全部 props 駆動 or 基盤参照のみ。
- **リスク：低。** 1コンポーネント=1ファイルで小刻みに。

---

### Phase 5：独立ページ（★低リスク、SNS/施設マップ防御対象）
依存が少なく自己完結している順に：

1. `pages/static/` ← `Tokusho`(724) `Terms`(766) `Privacy`(833) `Contact`(901) `Legal`(7402) `QoccaTownGuide`(1047) `FirstStepGuide`(1098)（**ほぼゼロ依存・最安全**）
2. `pages/gallery/` ← `GalleryPage`(7189) `BlogPage`(6098)
3. `pages/community/` ← `EventsPage`(7603) `CommunitiesPage`(7941) `CommunityDetailPage`(8037) `CreateCommunityModal`(7886) `ReportMessageModal`(8263) `PCHeroSection`(7568)
4. `pages/facilities/` ← `FacilitiesPage`(6492) `FacilityDetailView`(6689) `FacilityVisitForm`(6854) `FacilityReportModal`(7040) `FacilityCorrectionForm`(7105)

- **⚠️ 施設マップ防御（3,525件）：** Facilities群は5部品が密結合（detail→form→modal）。**この4ファイルは「1グループとして1ステップ」で一気に移す**方が、中途半端な相互参照で壊れにくい。`checkFacilityNGWords` は Phase1 で外出し済を import。
- **⚠️ SNS防御：** Community/Eventは `CommentModal`/`ReviewModal`（既存の別ファイル）を使う。import パスが相対で変わる点だけ要注意。

---

### Phase 6：マーケットプレイス（★中リスク・決済導線）
`pages/marketplace/` ← `DetailPage`(2509) `SearchPage`(2440) `SellPage`(2946) `SignupPage`(3237) `UserProfilePage`(3467) `DetailPageWrapper`(8362)
- **🚨 決済防御の本丸 (v29/v30/v31)。** `DetailPage`(437行) と `SellPage` に購入・出品導線。Stripe関連の文字列・BPF表示・購入確認モーダルがここ。
- **リスク：中。** ロジック改変ゼロで移動。移動後に「商品詳細→購入確認モーダルでBPF表示」を1回手動確認。

---

### Phase 7：MyPage＆タブ群（★最大塊・最後）
`pages/mypage/` ← `MyPage`(3617) と全Tab：
`EarningsTab`(4128) `AddressesTab`(4425) `OrdersTab`(4620) `MyListingsTab`(4800) `SalesTab`(5142) `OrderMessagesTab`(5498) `DirectMessagesTab`(5741) `MessagesTab`(5971) `NotificationsTab`(5991) `SupportTab`(6006)
＋モーダル：`ActivityDetailModal`(3896) `ListingEditModal`(5057) `DisputeModal`(5327)

- **約2,470行（全体の28%）。最大の効果、ゆえに最後の最後。**
- タブは props 無し＝基盤参照のみ → **1タブ=1ファイルで10回に分けて**移せる。一気にやらない。
- **⚠️ 決済防御：** `EarningsTab`(Stripe残高/振込) `SalesTab`(売上) `OrderMessagesTab`(detectContacts呼び出し) が集中。各タブ移動ごとにそのタブを開いて表示確認。
- **⚠️ `window.addEventListener("openDM")`(3630) の購読** が `MessagesTab` 連携。MyPage本体と一緒に移すこと。

---

### Phase 8：Homeセクション（★中リスク・見た目）
`components/sections/` ← `SectionHero`(1200) `SectionTodaysMoments`(1395) `SectionTownMap`(1846) `SectionAtelier`(1985) `SectionVoices`(2140) `SectionJoinTown`(2336) ＋ `HomePage`(2425)
- **リスク：中（静けさデザインの崩れ）。** `QC`トークン・`QC_KEYFRAMES`(アニメ) 参照が多い。Phase1で外出し済を import。
- 移動後、**トップページの見た目を目視確認**（フォント・余白・0.8sアニメ）。CLAUDE.md の静けさルール厳守。

---

### 最終形
App.tsx に残るのは `QoccaAppInner`(8387) `QoccaApp`(8663) と Router 周りだけ → **約8,671行 → 約400行**。

---

## 📊 リスク早見表

| Phase | 内容 | リスク | 防御対象 |
|---|---|---|---|
| 0 | 型・準備 | ⬜ 無 | — |
| 1 | 定数・純関数 | 🟢 低 | 決済防御(detectContacts) |
| 2 | supabase/auth | 🟡 中 | **認証・全域** |
| 3 | hooks | 🟢 低 | — |
| 4 | 葉UI | 🟢 低 | — |
| 5 | 独立ページ | 🟢 低 | **施設マップ・SNS** |
| 6 | マーケット | 🟡 中 | **決済導線・Stripe** |
| 7 | MyPage | 🟡 中(量大) | **Stripe・DM防御** |
| 8 | Homeセクション | 🟡 中 | 静けさデザイン |

---

## 📝 実走順の推奨

- **基盤固め第一弾PR**：Phase 0→1→2→3→4 まで（基盤さえ固まれば後は事故りにくい）
- **機能ごと小分けPR**：Phase 5 以降を機能単位で
- まず1個だけ試すなら **Phase 1 の `constants/theme.ts`**（純データ・無害）が練習に最適

---

## ✅ 進捗ログ（Phase完了ごとに追記）

| Phase | 状態 | コミット | 備考 |
|---|---|---|---|
| 計画書作成 | ✅ 完了 | 8500a50 | docs/app-split-plan.md (最新mainへ再cherry-pick) |
| Phase 0 | ✅ 完了 | (このコミット) | `CommentTargetType` を `src/types.ts` へ外出し。**型のみの export は `import type` で読む**(通常importはrolldownが値解釈しMISSING_EXPORTでビルド失敗)。ビルド緑確認済 |
| Phase 1 | ✅ 完了 | 〜(このコミット) | ①`constants/theme.ts` ✅ (−65行)。②`constants/data.ts` ✅ (CATS/LISTINGS/REVIEWS/EVENTS/EVENT_CATS/ORDER_STEPS/DISPUTE_REASONS/QC_REACTIONS/CONTACT_PATTERNS/NG_WORDS/BLOG_CATS/FACILITY_CATS/MOOD_TAGS/FACILITY_REPORT_REASONS/FACILITY_NG_WORDS/PREFS/COMMUNITY_CATEGORIES / App.tsx −159行 / tsc --noEmit緑)。③`utils/format.ts` 🟡 (formatStat/calcPopularityScore/sortByPopularity/stepIndex/miniBtnStyle ✅ −53行 / vite緑 / tsc緑。**evPet\* は petLabel→PET_CAT_BY_ID→PET_CATEGORIES(26箇所使用)に依存→循環import回避のため format でなく別 pets モジュールへ後送り**)。④`utils/moderation.ts` ✅ (detectContacts/detectNGWords/checkFacilityNGWords −36行 / data.tsからCONTACT_PATTERNS/NG_WORDS/FACILITY_NG_WORDS をimport / vite緑 / tsc緑 / **ブラウザ実テストで検知関数の入出力が従来通りを確認**)。<br>**Phase1残タスク**: (a)✅petクラスタ10個(PET_CATEGORIES/PET_CAT_BY_ID/petLabel/petLabelShort/petIcon/petColor/petBg/evPetLabel/evPetColor/evPetBg)→`constants/pets.ts`(1コミット丸ごと・循環なし・tsc緑・App.tsx使用6個のみimport) (b)✅`QC_TIMING`/`QC_HERO_TRANSITION_MS`/`QC_PC_BREAKPOINT`→`constants/theme.ts` (c)✅`PREFS_47_ORDER`→`constants/data.ts` |
| Phase 2 | ✅ 完了・**main マージ済 (PR #3 / 295a189)** | ee9fe94 | `supabase` は #119 で既に `supabaseClient.ts` へ外出し済。本Phaseで `AuthContext`/`AuthProvider`/`useAuth` を `contexts/AuthContext.tsx` へ移動 (App.tsx −104行)。⚠️ `createContext` は複製せず移動のみ＝`createContext(null)` は AuthContext.tsx の1箇所だけ。App.tsx の React import から未使用化した `createContext`/`useContext` を除去。vite緑 + tsc緑 + ブラウザ実描画(ホーム全描画・DB実データ・useAuth解決・未ログイン状態正常) + **King 実機確認(ログイン/リロード保持/マイページ/DM/決済導線=全OK)** で検証。<br>📌 フォローアップ: ⑥パスワードリセット導線は本番で後ほど軽く確認(同じ AuthContext/useAuth を使い①〜⑤実証済のため低リスク)。<br>📌 別件メモ: 「Multiple GoTrueClient」警告は**元からある構造負債**(componentに createClient が計12箇所)。本Phaseとは無関係。将来 supabaseClient.ts 単一統合の別Phase候補 |
| Phase 3 | ✅ 完了 | (このコミット) | `useListings`/`useFavorites`/`useIsPC`/`useHeroStats`/`useNav` を `src/hooks/index.ts` へ移動 (App.tsx −158行)。依存: supabase / CATS(data) / CAT_COLORS(theme) / formatStat(format) / useNavigate(react-router) を import。⚠️ `useNav` は Router 内側でのみ呼び出し(位置不変)。ロジック・参照名無改変。vite緑 + tsc緑 + ブラウザ実描画(商品¥表示=useListings / 画像34枚 / `/`→`/login` 遷移=useNav 動作)で検証 |
| Phase 4 | ✅ 完了 | (このコミット) | **4-a**: `FONT_FAMILIES`/`FONT_OPTIONS`/`resolveFontFamily` → `constants/fonts.ts`(循環import回避の前提)。**4-b**: 葉UI12部品(Logo/Stars/Tag/Card/UserMenu/Sidebar/PCNavbar/Navbar/OrderStatusBar/SharedFooter/TabBar/PCBanner) → `components/ui.tsx`(相互依存は同一ファイル内=循環なし)。App.tsx は実使用11個をimport(UserMenuはPCNavbar/Navbar内部専用で非import)。App.tsx 計−538行。vite緑 + tsc緑 + ブラウザ実描画(Logo/Card/¥表示・/→/login遷移・**TabBar safe-area修正がスマホ375pxで無傷**)で検証 |
| Phase 5 | ⬜ 未着手 | — | |
| Phase 6 | ⬜ 未着手 | — | |
| Phase 7 | ⬜ 未着手 | — | |
| Phase 8 | ⬜ 未着手 | — | |

---

> **再開時の読み方**: このファイルの「進捗ログ」を見て、次に着手する Phase を確認。
> 該当 Phase の手順とリスクを読んでから作業開始。基盤（Phase 0-3）が未完なら必ずそこから。
