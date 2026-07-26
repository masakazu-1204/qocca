// api/sitemap.js — 動的サイトマップ
//
// 旧 public/sitemap.xml は手書き9URLだった。実際には約5,200件の公開コンテンツがあり、
// そのほぼ全部が検索エンジンに存在を知られていなかった。
//   /sitemap.xml            → サイトマップインデックス
//   /sitemap-pages.xml      → 静的ページ + 施設ハブ(都道府県/カテゴリ)
//   /sitemap-facilities.xml → 承認済のペット施設 (約3,500)
//   /sitemap-spots.xml      → 承認済の散歩スポット (約1,550)
//   /sitemap-content.xml    → 出品 / ブログ / コミュニティ
//
// ⚠️ ルートが実在するURLだけを載せる (404をサイトマップに入れない)。

import {
  sb, sbAll, esc, urlEntry, SITE,
  FACILITY_CATEGORIES, catSlug, prefToSlug,
} from "./_lib.js";

const xml = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;

const STATIC_PAGES = [
  ["/", "daily", "1.0"],
  ["/marketplace", "daily", "0.9"],
  ["/facilities", "weekly", "0.9"],
  ["/petwalker", "weekly", "0.9"],
  ["/events", "daily", "0.8"],
  ["/blog", "daily", "0.8"],
  ["/communities", "weekly", "0.7"],
  ["/gallery", "weekly", "0.6"],
  ["/about", "monthly", "0.7"],
  ["/sell", "monthly", "0.7"],
  ["/founding-creators", "monthly", "0.5"],
  ["/sponsors", "monthly", "0.4"],
  ["/faq", "monthly", "0.5"],
  ["/help", "monthly", "0.5"],
  ["/contact", "monthly", "0.4"],
  ["/terms", "yearly", "0.3"],
  ["/privacy", "yearly", "0.3"],
  ["/tokusho", "yearly", "0.3"],
];

/** 施設ハブ: 件数が少なすぎるページは作らない (薄いページはSEO上むしろ有害) */
const HUB_MIN = 3;

async function buildPages() {
  let body = STATIC_PAGES.map(([p, cf, pr]) =>
    urlEntry(`${SITE}${p}`, { changefreq: cf, priority: pr })
  ).join("");

  const rows = await sbAll(
    `pet_facilities?approved=is.true&is_closed=not.is.true&prefecture=not.is.null&select=prefecture,facility_category`
  );
  const prefCount = new Map();
  const pairCount = new Map();
  for (const r of rows) {
    const ps = prefToSlug(r.prefecture);
    if (!ps) continue; // "全国" など都道府県でないものは除外
    prefCount.set(ps, (prefCount.get(ps) || 0) + 1);
    const key = `${ps}/${catSlug(r.facility_category || "other")}`;
    pairCount.set(key, (pairCount.get(key) || 0) + 1);
  }
  for (const [ps, n] of prefCount) {
    if (n < HUB_MIN) continue;
    body += urlEntry(`${SITE}/facilities/${ps}`, { changefreq: "weekly", priority: "0.8" });
  }
  for (const [key, n] of pairCount) {
    if (n < HUB_MIN) continue;
    body += urlEntry(`${SITE}/facilities/${key}`, { changefreq: "weekly", priority: "0.7" });
  }
  return xml(body);
}

async function buildFacilities() {
  const rows = await sbAll(
    `pet_facilities?approved=is.true&is_closed=not.is.true&select=id,last_verified_at,created_at&order=id.asc`
  );
  return xml(
    rows
      .map((r) =>
        urlEntry(`${SITE}/facility/${r.id}`, {
          lastmod: r.last_verified_at || r.created_at,
          changefreq: "monthly",
          priority: "0.6",
        })
      )
      .join("")
  );
}

async function buildSpots() {
  const rows = await sbAll(
    `pet_walker_spots?approval_status=eq.approved&select=id,updated_at,created_at&order=id.asc`
  );
  return xml(
    rows
      .map((r) =>
        urlEntry(`${SITE}/petwalker/spot/${r.id}`, {
          lastmod: r.updated_at || r.created_at,
          changefreq: "monthly",
          priority: "0.7",
        })
      )
      .join("")
  );
}

async function buildContent() {
  const [listings, blogs, communities] = await Promise.all([
    sbAll(`listings?status=eq.approved&select=id,updated_at,created_at&order=id.asc`),
    sbAll(`blog_posts_public?select=id,updated_at,created_at&order=id.asc`),
    sbAll(`communities?is_archived=not.is.true&select=id,updated_at,created_at&order=id.asc`),
  ]);
  let body = "";
  for (const r of listings)
    body += urlEntry(`${SITE}/listing/${r.id}`, { lastmod: r.updated_at || r.created_at, changefreq: "weekly", priority: "0.8" });
  for (const r of blogs)
    body += urlEntry(`${SITE}/blog/${r.id}`, { lastmod: r.updated_at || r.created_at, changefreq: "monthly", priority: "0.7" });
  for (const r of communities)
    body += urlEntry(`${SITE}/community/${r.id}`, { lastmod: r.updated_at || r.created_at, changefreq: "weekly", priority: "0.5" });
  return xml(body);
}

function buildIndex() {
  const now = new Date().toISOString().slice(0, 10);
  const maps = ["pages", "facilities", "spots", "content"];
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    maps
      .map(
        (m) =>
          `<sitemap><loc>${esc(`${SITE}/sitemap-${m}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`
      )
      .join("") +
    `</sitemapindex>`
  );
}

export default async function handler(req, res) {
  const type = (new URL(req.url, "https://qocca.pet").searchParams.get("type") || "").toLowerCase();
  try {
    let out;
    if (!type) out = buildIndex();
    else if (type === "pages") out = await buildPages();
    else if (type === "facilities") out = await buildFacilities();
    else if (type === "spots") out = await buildSpots();
    else if (type === "content") out = await buildContent();
    else return res.status(404).send("not found");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).send(out);
  } catch (e) {
    console.error("sitemap failed:", type, e?.message);
    // 失敗時も空のサイトマップを返す (検索エンジンに 500 を見せない)
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(xml(""));
  }
}
