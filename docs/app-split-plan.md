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
| Phase 5 | ✅ **完了・全グループ main マージ済** (①②③④) | ①: fb9182c(PR#7) / ②: 7e21ea4(PR#8) / ③: dd51648(PR#9) / ④: dbe87fb(PR#10) | **④facilities 完了・main マージ済 (2026-06-15, PR #10 squash, 本丸=施設3525件/Leaflet地図/スマホ修正 King実機確認済=地図トグル/ピン/もっと見る/見切れなし全OK)**: 地雷ゼロ＝単一ステップ。施設7部品(facilityDisplayDesc/FacilityMapView/FacilitiesPage/FacilityDetailView/FacilityVisitForm/FacilityReportModal/FacilityCorrectionForm, 連続) + **Leaflet 5本(L+CSS×3+markercluster)** → `pages/facilities.tsx`(App.tsx −1045行)。export=FacilitiesPageのみ。`checkFacilityNGWords`(SNS安全)はmoderation参照のみ。死にimport掃除(Leaflet5本+FACILITY_CATS/MOOD_TAGS/FACILITY_REPORT_REASONS/FACILITY_NG_WORDS/PREFS+checkFacilityNGWords)※detectContacts残置。⚠️ロジック無改変(トグル/もっと見る/safe-area/markercluster/RPCページング)。検証=grep重複ゼロ/tsc緑/vite緑/実描画最厳重(リスト50+→100+/地図トグル→Leaflet+OSM+出典/markercluster1000ピン/もっと見る/スマホ375pxトグル&もっと見る無傷/詳細+修正モーダル)。**既知(非起因)**: もっと見る後 React duplicate-key 警告=RPCページング重複ID(byte同一移動・key/append無改変=既存挙動)→別件dedup候補。<hr>**App.tsx 推移: 15,094 → 11,617行 (Phase5で −3,477行 / static726+gallery948+community756+facilities1045+α)**。<hr>**③community 完了・main マージ済 (2026-06-15, PR #9 squash, マスク動作=連絡先***マスク King実機確認済=決済防御無傷)**: 地雷ゼロ(基盤は全てPhase1-3で外出し済)＝単一ステップ。6部品(PCHeroSection温存/EventsPage/CreateCommunityModal/CommunitiesPage/CommunityDetailPage/ReportMessageModal, 連続ブロック) → `pages/community.tsx`(App.tsx −756行)。export=Events/Communities/CommunityDetail の3つ(他はintra/dead)。`detectContacts`/`detectNGWords`(決済防御+SNS安全)は`utils/moderation`から参照のみ・`CommentModal`(SNS防御)相対import。死にimport8種除去(CommentModal/useHeroStats/EVENT_CATS/COMMUNITY_CATEGORIES/evPet*3/PREFS_47_ORDER/CommentTargetType/detectNGWords)※detectContacts(MyPage現役)は残置。⚠️PCHeroSectionはデッドコードだが温存(King判断)。検証=grep重複ゼロ/tsc緑/vite緑/実描画(/events /communities /community/:id /EventsPage CommentModal=SNS防御=エラー皆無)。<hr>**②gallery 完了・main マージ済 (2026-06-15, PR #8 squash)**: 事前地雷 `CrowdfundingBanner`(HomePage/FacilitiesPage残留 と GalleryPage移動の両側参照) ＋専用定数4個 → `components/CrowdfundingBanner.tsx`(0899a2e)。`BlogPage`/`GalleryPage` → `pages/gallery.tsx`(54477a3, App.tsx −860行)。⚠️間の施設クラスタ(3525件)は非接触で個別抽出。`GalleryComposeForm`/`BlogComposeForm`/`PostsTab`(MyPageタブ)はPhase7で残留。`CommentModal`(SNS防御)は相対パスimport。不要化した`BLOG_CATS` import除去。検証=grep重複ゼロ/tsc緑/vite緑/実描画(/blog /gallery(画像23+バナー+CommentModal開閉) /facilities(バナー無傷) /home=エラー皆無)。<hr>**①static 完了・main マージ済 (2026-06-15, PR #7 squash)**。事前地雷2個を中立化してから10ページ移動。<br>**地雷除去**: (1)`CAMPFIRE_PROJECT_URL_WITH_UTM`+`CROWDFUNDING_ACTIVE`→`constants/data.ts`(d39d785, Hero CTA残留側とstatic両方が参照=循環回避。「1フラグ撤去で全導線消える」設計を1箇所に保持)。(2)`FoundingCreator`型→`types.ts`(77a886c, 残留`InitialMembersSection`と移動`FoundingCreatorsPage`の両側が参照=第2地雷)。<br>**移動**(3aa2d18): Tokusho/Terms/Privacy/Contact/QoccaTownGuide/FirstStepGuide/FoundingCreators/Sponsors/Legal/FAQ の10個→`pages/static.tsx`(App.tsx −726行)。⚠️`InitialMembersSection`はHomeセクションのため残留(非連続移動)。`TERMS_V2`は`legal/terms_v2.tsx`既存独立=staticがimport。不要化したApp.tsx側TERMS_V2 import除去。<br>**検証**: grep重複ゼロ/tsc緑/vite緑/ブラウザ実描画(/tokusho /terms(LegalPage+TERMS_V2) /privacy /contact(useAuth) /faq /founding-creators(supabase+CAMPFIRE) /sponsors + Home Hero CTA=全描画・コンソールエラー皆無)。<br>**残**: ②gallery ③community ④facilities。 |
| Phase 6 | ✅ **完了・main マージ済** (6a #11 / 6b #12) | 6a: e93d753(PR#11) / 6b: ae15020(PR#12) | **6b 完了・main マージ済 (2026-06-15, PR #12 squash, 決済本丸・1万行切り達成 / King実機確認済=購入確認モーダル/BP/送料合計/決済導線/出品フォーム/出品編集 全OK)**: Step A=`ListingEditModal`→`components/ListingEditModal.tsx`(068e469, DetailPage+MyListingsTab両側参照の循環地雷除去)。Step B=submitListing/DetailPage/SellPage/DetailPageWrapper→`marketplace.tsx`(0c2fe74, App.tsx 11110→9015行)。export=SellPage/DetailPageWrapper(他intra)。決済ロジック/BP計算(Math.floor*0.04)/送料合計(grand)/購入確認モーダルJSX/create-checkout/Stripe文字列 無改変。死にimport掃除(Tag/Stars/REVIEWS/PET_CATEGORIES)。**🐛 移動中に検出&修正**: SellPage の `useRef`(fileRef) が marketplace.tsx react import 漏れ→実行時クラッシュ(/sell白画面)→useRef追加で修正。⚠️**tsc は本件を見逃した→ブラウザ実描画で捕捉**(教訓: 実描画検証必須)。検証=tsc/vite緑/実描画(/search /商品詳細 BP=¥5,000+¥200=¥5,200 /sell intro /Wrapper)。⚠️ 購入確認モーダル/create-checkout/出品submit/ListingEditModal編集=ログイン必須→King実機確認予定。<hr>**6a 完了・main マージ済 (2026-06-15, PR #11 squash)**: 決済導線に触れない SearchPage / UserProfilePage → `pages/marketplace.tsx`(App.tsx −508行)。循環2件回避(SignupPage→`<MyPage>`Phase7残留=Phase7同梱 / DetailPageWrapper→`<DetailPage>`6b=6b同梱)。死にimport掃除(calcPopularityScore+sortByPopularity)。検証=実描画(/search /user authガード)エラー皆無。 |
| Phase 7 | 🟡 PRレビュー待ち (最大塊完了) | 2887cbd | **MyPage最大塊 完了 (2026-06-15, PRレビュー待ち)**: MyPage(ハブ)+10タブ+ActivityDetailModal/DisputeModal+GalleryCompose/BlogCompose+PetCategory型 の15部品 → `pages/mypage.tsx`(連続3937-7281, App.tsx 9016→5636行)。export=MyPageのみ(他14部品intra)。EarningsTab(Stripe Connect: SUPABASE_URL/ANONローカル+独自createClient)/detectContacts(DM防御)/openDMリスナー3箇所 無改変。死にimport大掃除(createClient/ListingEditModal/ProfileEditModal/PetEditModal/ReviewModal/stepIndex/formatStat/miniBtnStyle/detectContacts/DISPUTE_REASONS/OrderStatusBar)。<br>**🐛 隠れ地雷2件 検出&修正(tsc全部見逃し→実描画+予防点検で捕捉)**: (1)`findAtmosphere`(+ATMOSPHERE_PRESETS等 MyPage専用ヘルパー未移動)→mypage.tsxへ移動(MyPage即白画面を修正)。(2)`REDEEM_TIER_THEME`(RedeemPage残留+MyPage両側参照)→`constants/data.ts`中立化(ログイン時クラファンコード表示でのみ落ちる隠れ地雷を、App.tsx残留トップレベル定義 vs mypage参照の総当たりクロスチェックで事前捕捉)。<br>**L1適用**: bare hook確実版抽出で`useRef`×4漏れなく投入。検証=tsc/vite緑/残留参照漏れゼロ/実描画(/mypage /sell /search /facilities /home=リグレッションなし)。⚠️ログイン必須タブはKing実機確認。 |
| Phase 8 | ✅ **完了** (8a Home / 8b 独立ページ) ※8b PRレビュー待ち | 8a: 0bae86a(PR#17) / 8b: (このコミット) | **🏁 8b 独立ページ群 完了 (2026-06-15, PRレビュー待ち)=App.tsx分割ゴール達成**: 連続11ページ(141-2379)を3先へ byte同一 line-slice 移動。(1)`pages/account.tsx`(新)←Signup/PetDetail/ProfileMeRedirect/UpdatePassword/Redeem/PhoneVerification/DeletionStatus 7ページ(141-1514, export7)。(2)`pages/connections.tsx`(新)←X/Threads/Instagram 連携3ページ(1515-2342, export3)。(3)`marketplace.tsx`追記←LikedPage(2343-2361, C/Card既import)。**App.tsx 2839→515行**(=15,094からの分割ゴール。残=import+QoccaAppInner/QoccaApp/Router本体)。死にimport大掃除: SUPABASE_URL(未使用const)削除 / FoundingCreator型・pets・fonts import 行削除 / theme→C / data→LISTINGS / metaPixel→mpTrackEvent除去 / ui→Card・PCBanner除去。事前依存分析: ①SUPABASE_URL=定義のみ使用ゼロ ②11ページ間相互参照ゼロ(全てRouterからのみ)=循環なし ③mypage→account逆流なし ④LikedPageはC/Cardのみ依存。**L1**: account=useState/useEffect/useNavigate/useParams/useAuth+React(FC/CSSProperties)、connections=useState/useEffect/useNavigate/useAuth、全import照合一致(bare hook漏れゼロ)。**L2**: 新2モジュール参照識別子 vs import 総当たり=漏れゼロ。検証=tsc/vite緑/重複定義ゼロ/**実描画(dev server再起動でクリーン状態)**: /login(SignupPageフォーム)・/update-password(無効アクセス判定)・/favorites(LikedPage❤️0件)・/deletion-status(React.FC描画)=実コンテンツOK / auth必須(/settings/* /redeem /pet)=/loginリダイレクト(ガード正常クラッシュなし) / トップ`/`リグレッションなし / **全ルートコンソールエラー0**。⚠️ログイン必須ページ(SNS連携/redeem実コード)はKing実機確認。<hr>**8a Home完了 (2026-06-15, PR#17 main マージ済 0bae86a, King実機確認=静けさデザイン崩れなし)**: Homeセクション群(SectionHero/TodaysMoments/TownMap/Atelier/Voices/JoinTown/InitialMembersSection 等 + HomePage統合) → `pages/home.tsx`(連続2ブロック=本体R1+末尾R2を byte同一 line-slice 移動, App.tsx 5636→2839行=**−2797行**)。export=HomePageのみ。死にimport大掃除: `CrowdfundingBanner`(line20)除去 / theme import を `C,QC_FONT_DISPLAY` のみに / data import を `LISTINGS,REDEEM_TIER_THEME` のみに(CAT_COLORS/QC/QC_FONT_JP/QC_FONT_EN/QC_KEYFRAMES/QC_HERO_DURATIONS/QC_TIMING/QC_HERO_TRANSITION_MS/QC_PC_BREAKPOINT/CATS/EVENTS/ORDER_STEPS/QC_REACTIONS/CONTACT_PATTERNS/NG_WORDS/CROWDFUNDING_ACTIVE/CAMPFIRE_PROJECT_URL_WITH_UTM 全て未使用化)。KEEP=C(278)/QC_FONT_DISPLAY(3)/LISTINGS(1)/REDEEM_TIER_THEME(RedeemPage 8b残留)/SharedFooter/useListings。**L1適用**: react import に useState/useEffect/useRef 揃い確認済(bare hook漏れゼロ)。**L2適用**: App.tsx残留トップレベル定義 vs home.tsx参照の総当たりクロスチェック=漏れゼロ。検証=tsc/vite緑/grep重複ゼロ/**トップページ(`/`)実描画OK**(Hero「想いを形にして、ふたりをつなぐ。」→7月手数料無料→クラウドファンディング(CAMPFIRE)→Qocca街, Instrument Serif見出し・静けさデザイン健在・画像34枚・コンソールエラー0)。<br>**残**: 8b 独立11ページ(SignupPage/PetDetailPage/ProfileMeRedirect/UpdatePasswordPage/RedeemPage/PhoneVerificationPage/DeletionStatusPage/X|Threads|InstagramConnectionPage/LikedPage)→App.tsx ~400行(QoccaAppInner/QoccaApp/Router)へ。 |

---

## 🧭 分割作業の教訓（Phase 7-8 で必ず活かす）

| # | 教訓 | 詳細 |
|---|---|---|
| L1 | **tsc 緑だけでは不十分・実描画が命綱** | Phase6 6b で SellPage の `useRef`(bare) を新モジュールの react import に入れ忘れ→実行時クラッシュ(/sell白画面)。だが `tsc --noEmit` は**緑のまま見逃した**(本プロジェクトの tsc は未定義参照すら検出しないケースがある)。**ブラウザ実描画**で「component error」を捕捉→git stash で baseline 比較→起因特定→修正。**移動後は必ず実描画で全ルート確認**。特に各ページの **bare hook (useRef/useState/useEffect/useMemo/useCallback) が新ファイルの `import {...} from "react"` に揃っているか** を要確認。⚠️ `useRef<T>(` のジェネリック型は単純 grep で見逃すので **`sed -n 'S,Ep' App.tsx | grep -oE "\\buse[A-Z][a-zA-Z]+" | sort -u`** で確実抽出。 |
| L2 | **大型移動は「残留トップレベル定義 vs 新モジュール参照」を総当たりクロスチェック** | Phase7 で `findAtmosphere`/`REDEEM_TIER_THEME` 等、App.tsx 残留の MyPage 専用ヘルパーが未移動→新モジュールで undefined 参照(特に **ログイン等の条件分岐内でのみ描画される箇所は実描画で踏めず見逃しやすい**)。対策: 移動後に App.tsx 残留の `^(const\|function\|type) X` を全列挙し、新モジュールで参照されるが新モジュールに定義/import が無いものを grep で総当たり検出。共有なら中立モジュール化、専用なら移動。 |
| **L3** 🔴 | **`npm run typecheck`(=`tsc -p tsconfig.app.json`) が唯一の本物の型チェック** | 分割完了後の全体総点検(2026-06-15)で判明: ルート `tsconfig.json` は `files:[]`＋`references` のみ → **`tsc --noEmit`(非build) は対象ファイルゼロで常に exit 0**。ビルドも `vite build`(esbuild=型チェック無)。**＝今まで「tsc緑」は全部無意味だった(L1 の真因)**。本物は `tsc -p tsconfig.app.json`。総点検でこれを回し、分割起因の**未定義参照2件**を検出: ①`home.tsx` の `QC_REACTIONS`(MomentCard/MomentModal・Phase8a import漏れ) ②`mypage.tsx` の `SUPABASE_URL`(OrdersTab.handleConfirm=受取確認/complete-order・Phase7 定義漏れ→8bでApp.tsx定義削除で顕在化)。両方とも条件分岐の奥で実描画では踏めず潜伏。**対策: `package.json` に `"typecheck":"tsc -p tsconfig.app.json"` 追加。今後の検証は「未定義参照(TS2304/TS2552)ゼロ」を合格基準にする**(既存の緩い型ノイズ ~684件 implicit any/never型 は別問題として残置)。 |

---

## 🐛 既知バグ・別件TODO（分割と無関係 / Phase完了後に対応）

| # | 内容 | 詳細 | 起因 | 対応 |
|---|---|---|---|---|
| K1 | 施設「もっと見る」後に React duplicate-key 警告 | RPC `search_facilities` が offset ページング境界で**重複ID**を返す → `FacilitiesPage` の `facilities=[...baseList,...rows]` に同一 `id` が混入 → `key={f.id}` 重複。初回ロードは無問題、もっと見る押下後のみ顕在化。 | **分割と無関係の既存バグ**（④facilities で `key`/append ロジックは byte 同一移動・無改変と確認済）。 | Phase 完了後に別途 dedup 修正（append 時に id 重複排除、or RPC 側 offset/sort 安定化）。今は「ロジック無改変」厳守のため未着手。 |
| **K2** 🔴**Dday前必須** | **全出品者が Stripe Connect 未連携 (`stripe_payouts_enabled=false`)** | 2026-06-15 調査時点で、承認済み出品の**出品者全員が `stripe_payouts_enabled=false`**。complete-order は受取確認時に seller の payouts 無効を検出すると「送金準備中」で completed/transfer_status=pending 止まり＝**取引成立しても出品者に送金されない**。 | データ実態（出品者の Stripe Connect オンボーディング未完了）。分割・決済コードとは無関係。 | **7/1 前に必須**: 出品者に Stripe Connect 連携完了を促す。現状 stripe未連携警告バナー(購入確認モーダル/EarningsTab)は実装済 → それで足りるか検証＋リマインドメール等の導線追加を検討。送金できないと Dday 取引が破綻する。 |

---

## 🛡 決済UX防御 実施記録 (2026-06-15)

未決済(pending)テスト注文 09e569cc 発覚を機に、未決済取引の「入口」と「出口」を二重防御。**いずれも本番反映済み**。

| 層 | 対策 | 実装 | 検証 |
|---|---|---|---|
| 入口①B (フロント) | 未決済を出品者が触れない・「決済待ち」明示 | `pages/mypage.tsx`: SalesTab「対応中」から pending 除外 / statusLabel「決済待ち」/ 「作業開始」ボタン廃止 (PR #14, main マージ済) | tsc/vite緑・/mypage実描画 |
| 出口② (Edge Function) | 未決済の立替送金を拒否 | `complete-order` **v32**: transfer 手前で `stripe_payment_intent_id` が `pi_` でなければ拒否 (本番 version 32 デプロイ済 / repo記録) | **ライブ拒否テスト成功**(cs_注文→HTTP400 payment_not_completed・送金ゼロ)・pass側は構造上自明＋pi_送金実績(QOC-2026-9109)で確証 |

- 案②(Stripe実照会) は Dday後・テスト環境整備後に後付け候補。
- ⚠️ テスト環境: supabase CLI/Docker/プレビューブランチ無し・Stripe本番LIVE → Edge Function は MCP `deploy_edge_function` で直接デプロイ運用。

---

> **再開時の読み方**: このファイルの「進捗ログ」を見て、次に着手する Phase を確認。
> 該当 Phase の手順とリスクを読んでから作業開始。基盤（Phase 0-3）が未完なら必ずそこから。
