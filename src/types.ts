// 共有型定義 (App.tsx 分割 Phase 0: 型の外出し)
// コメント対象の種別 (ギャラリー / イベント / ブログ)
export type CommentTargetType = "gallery" | "event" | "blog";

// 依頼書 #36 (2026/5/31): 初期メンバー/創業クリエイター紹介で使う共有型
// FoundingCreatorsPage(pages/static.tsx) と InitialMembersSection(App.tsx 残留 Home セクション) の
// 両方が参照するため Phase5 ①static で types.ts へ中立化 (循環import回避)
export type FoundingCreator = {
  id: string; display_name: string | null; avatar_url: string | null;
  bio: string | null; creator_intro: string | null;
  is_founding_creator: boolean | null; is_initial_member: boolean | null;
  approved_count: number;
};
