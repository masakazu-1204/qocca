// サイトの正規URL (canonical / OGP / 構造化データ の基準)
//
// 2026/7/27: 本番は qocca.pet → www.qocca.pet に 307 リダイレクトされており、
//   実際に 200 を返すのは www 側。canonical がリダイレクトするURLを指していると
//   検索エンジンが正規URLを判断できないため、実体に合わせて www を正とする。
//
// ⚠️ Vercel の Primary Domain を apex (qocca.pet) に変更した場合は、
//    ここと api/_lib.js の SITE、index.html / public/llms.txt / public/robots.txt を
//    apex に戻すこと。切り替えはこの1箇所が起点。
export const SITE_URL = "https://www.qocca.pet";
