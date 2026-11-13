// src/lib/routeTitle.ts — useSEO を使っていないページのタブ名 (2026/11/13)
//
// 背景: useSEO を使っているのは施設・特集・welcome だけで、ほかのページは index.html の
//   共通タイトルのままだった。さらに useSEO が離脱時にタイトルを戻さないため、
//   「冬の贈りもの」を見たあと商店街やブログに移っても、タブが「冬の贈りもの | Qocca」のまま残っていた。
//
// 名前は api/prerender.js の STATIC / LISTS と揃える (検索結果とタブで呼び名が食い違わないように)。
// 個別ページ (/listing/:id・/blog/:postId など) はここでは共通タイトルに戻すだけ。

const SITE_NAME = "Qocca";
export const DEFAULT_TITLE = "Qocca(クオッカ)- ペットオーナー専門マーケットプレイス";

const EXACT: Record<string, string> = {
  "/": DEFAULT_TITLE,
  "/marketplace": `出品一覧 | ${SITE_NAME}`,
  "/facilities": `ペット同伴可 施設マップ | ${SITE_NAME}`,
  "/petwalker": `ペットウォーカー｜うちの子と歩ける散歩スポット | ${SITE_NAME}`,
  "/events": `ペットイベント情報 | ${SITE_NAME}`,
  "/blog": `ブログ | ${SITE_NAME}`,
  "/communities": `コミュニティ | ${SITE_NAME}`,
  "/gallery": `ギャラリー | ${SITE_NAME}`,
  "/petgallery": `うちの子ギャラリー | ${SITE_NAME}`,
  "/about": `Qoccaについて | ${SITE_NAME}`,
  "/sell": `出品する（クリエイター募集）| ${SITE_NAME}`,
  "/contact": `お問い合わせ | ${SITE_NAME}`,
  "/terms": `利用規約 | ${SITE_NAME}`,
  "/privacy": `プライバシーポリシー | ${SITE_NAME}`,
  "/tokusho": `特定商取引法に基づく表記 | ${SITE_NAME}`,
  "/help": `ヘルプ | ${SITE_NAME}`,
  "/faq": `よくある質問 | ${SITE_NAME}`,
  "/sponsors": `法人スポンサー | ${SITE_NAME}`,
  "/founding-creators": `創業クリエイター | ${SITE_NAME}`,
  "/search": `作品をさがす | ${SITE_NAME}`,
  "/favorites": `お気に入り | ${SITE_NAME}`,
  "/mypage": `マイページ | ${SITE_NAME}`,
  "/login": `ログイン | ${SITE_NAME}`,
};

export function titleForPath(pathname: string): string {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (EXACT[p]) return EXACT[p];
  // /petwalker/* は内部で画面を切り替えるので、どこにいても散歩スポットの名前
  if (p.startsWith("/petwalker/")) return EXACT["/petwalker"];
  if (p.startsWith("/help/")) return EXACT["/help"];
  return DEFAULT_TITLE;
}

/** useSEO が今のページを受け持っているか (受け持っていればタブ名には触らない) */
export const SEO_OWNER_ATTR = "data-qocca-seo-page";
export const isSeoOwned = (): boolean =>
  typeof document !== "undefined" && document.documentElement.hasAttribute(SEO_OWNER_ATTR);
