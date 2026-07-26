// 施設まわりの URL スラッグ定義 (2026/7/27 SEO/MEO)
//
// /facilities/:pref[/:cat] と /facility/:id を成立させるための対応表。
// ⚠️ api/_lib.js に同じ定義がある (Vercel Function は .ts を import できないため意図的な二重管理)。
//    どちらかを変えたら必ず両方を揃えること。

export const FACILITY_CATEGORIES: Record<string, { slug: string; label: string }> = {
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

export const CATEGORY_BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(FACILITY_CATEGORIES).map(([k, v]) => [v.slug, k])
);

export const catLabel = (c?: string | null) =>
  (FACILITY_CATEGORIES[c || "other"] || FACILITY_CATEGORIES.other).label;
export const catSlug = (c?: string | null) =>
  (FACILITY_CATEGORIES[c || "other"] || FACILITY_CATEGORIES.other).slug;

export const PREF_SLUG: Record<string, string> = {
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

export const SLUG_TO_PREF: Record<string, string> = Object.fromEntries(
  Object.entries(PREF_SLUG).map(([k, v]) => [v, k])
);

/** DB の "東京都"/"大阪府"/"北海道" 等の表記ゆれを吸収して slug 化 */
export const prefToSlug = (p?: string | null): string | null => {
  if (!p) return null;
  const base = String(p).replace(/[都道府県]$/, "");
  return PREF_SLUG[base] || PREF_SLUG[String(p)] || null;
};

/** slug → DB検索用の県名ベース (例: osaka → "大阪") */
export const slugToPrefBase = (s?: string | null): string | null =>
  SLUG_TO_PREF[String(s || "").toLowerCase()] || null;
