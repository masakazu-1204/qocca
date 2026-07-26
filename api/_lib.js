// api/_lib.js — Vercel Functions 共通ヘルパー (SEO/GEO 基盤)
//
// 目的: クローラー向けプリレンダリング と 動的サイトマップ の共通処理。
//   Qocca は Vite の純SPAで、全URLが同一の index.html を返す。Googlebot は JS を実行するが、
//   AI クローラー (GPTBot / ClaudeBot / PerplexityBot 等) は基本 JS を実行しないため、
//   robots.txt で許可していても中身が <div id="root"></div> しか見えていなかった。
//   → クローラーからのリクエストにだけ、実データを埋めた HTML を返してこれを解消する。
//
// ⚠️ ファイル名の先頭 "_" は Vercel がルートとして公開しない (ヘルパー専用)。
// ⚠️ anon key はクライアントバンドルにも埋まっている公開キー。ここで使っても新たな露出は無い。
//    参照するのは公開データ(承認済の施設/スポット/出品/ブログ等)のみ。

export const SB_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://qufrqkuipzuqeqkvuhkx.supabase.co";

export const SB_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou";

export const SITE = "https://qocca.pet";
export const SITE_NAME = "Qocca";
export const DEFAULT_IMAGE = `${SITE}/logo.png`;

/** Supabase REST (PostgREST) を叩く。失敗時は例外。 */
export async function sb(path, { timeoutMs = 6000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** HTML エスケープ (属性値・テキスト共用) */
export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** 改行・連続空白を潰して n 文字に丸める (meta description 用) */
export const clip = (s, n = 120) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

/** JSON-LD を安全に埋める (</script> 対策) */
export const ld = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

// ── 施設カテゴリ (pet_facilities.facility_category) ────────────────────
//    slug = URL用 / label = 表示・検索キーワード用
export const FACILITY_CATEGORIES = {
  pet_salon:      { slug: "salon",  label: "トリミングサロン" },
  pet_shop_live:  { slug: "shop",   label: "ペットショップ" },
  dog_run:        { slug: "dogrun", label: "ドッグラン" },
  park:           { slug: "park",   label: "公園" },
  vet_clinic:     { slug: "vet",    label: "動物病院" },
  pet_goods_shop: { slug: "goods",  label: "ペット用品店" },
  pet_hotel:      { slug: "hotel",  label: "ペットホテル" },
  cafe_dog_ok:    { slug: "cafe",   label: "ペット同伴可カフェ" },
  other:          { slug: "other",  label: "その他のペット施設" },
};
/** slug → DBの facility_category 値 */
export const CATEGORY_BY_SLUG = Object.fromEntries(
  Object.entries(FACILITY_CATEGORIES).map(([k, v]) => [v.slug, k])
);
export const catLabel = (c) => (FACILITY_CATEGORIES[c] || FACILITY_CATEGORIES.other).label;
export const catSlug = (c) => (FACILITY_CATEGORIES[c] || FACILITY_CATEGORIES.other).slug;

// ── 都道府県 ローマ字スラッグ (47全部。将来の県追加でも落ちないように) ──
export const PREF_SLUG = {
  北海道: "hokkaido", 青森: "aomori", 岩手: "iwate", 宮城: "miyagi", 秋田: "akita",
  山形: "yamagata", 福島: "fukushima", 茨城: "ibaraki", 栃木: "tochigi", 群馬: "gunma",
  埼玉: "saitama", 千葉: "chiba", 東京: "tokyo", 神奈川: "kanagawa", 新潟: "niigata",
  富山: "toyama", 石川: "ishikawa", 福井: "fukui", 山梨: "yamanashi", 長野: "nagano",
  岐阜: "gifu", 静岡: "shizuoka", 愛知: "aichi", 三重: "mie", 滋賀: "shiga",
  京都: "kyoto", 大阪: "osaka", 兵庫: "hyogo", 奈良: "nara", 和歌山: "wakayama",
  鳥取: "tottori", 島根: "shimane", 岡山: "okayama", 広島: "hiroshima", 山口: "yamaguchi",
  徳島: "tokushima", 香川: "kagawa", 愛媛: "ehime", 高知: "kochi", 福岡: "fukuoka",
  佐賀: "saga", 長崎: "nagasaki", 熊本: "kumamoto", 大分: "oita", 宮崎: "miyazaki",
  鹿児島: "kagoshima", 沖縄: "okinawa",
};
/** DBの prefecture 表記ゆれ("東京都"/"大阪府"/"北海道")を吸収して slug 化 */
export const prefToSlug = (p) => {
  if (!p) return null;
  const base = String(p).replace(/[都道府県]$/, "");
  return PREF_SLUG[base] || PREF_SLUG[String(p)] || null;
};
export const SLUG_TO_PREF = Object.fromEntries(
  Object.entries(PREF_SLUG).map(([k, v]) => [v, k])
);
/** slug → DB検索用の前方一致パターン (例: osaka → "大阪") */
export const slugToPrefBase = (s) => SLUG_TO_PREF[String(s || "").toLowerCase()] || null;

/** サイトマップの <url> 1件 */
export const urlEntry = (loc, { lastmod, changefreq, priority } = {}) =>
  `<url><loc>${esc(loc)}</loc>` +
  (lastmod ? `<lastmod>${String(lastmod).slice(0, 10)}</lastmod>` : "") +
  (changefreq ? `<changefreq>${changefreq}</changefreq>` : "") +
  (priority ? `<priority>${priority}</priority>` : "") +
  `</url>`;

/** 該当件数だけを取る (Content-Range から読む)。表示上限で件数を偽らないため。 */
export async function sbCount(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${SB_URL}/rest/v1/${path}${sep}select=id&limit=1`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: "count=exact",
    },
  });
  const cr = r.headers.get("content-range") || "";
  const n = parseInt(cr.split("/")[1] || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

/** PostgREST のページングで全件取得 (1000件上限を超えるため) */
export async function sbAll(path, { pageSize = 1000, max = 60000 } = {}) {
  const out = [];
  for (let from = 0; from < max; from += pageSize) {
    const sep = path.includes("?") ? "&" : "?";
    const rows = await sb(`${path}${sep}limit=${pageSize}&offset=${from}`);
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
