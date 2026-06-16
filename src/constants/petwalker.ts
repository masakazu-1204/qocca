// ペットウォーカー定数 (エリア / カテゴリ定義)
// ⚠️ 静けさ世界観: 絵文字なし・詩的で控えめなコピー。area_tag は DB(pet_walker_spots.area_tag)と一致必須。

export type PWArea = { tag: string; en: string; blurb: string; slug: string; img: string };
export type PWCategory = { key: string; label: string; en: string };

// 背景画像: Supabase Storage 公開バケット petwalker (King が Dashboard から <slug>.webp を投入)。
// 公開URLは決定的なので先に配線 (投入前は 404 → UI はフォールバック背景色)。
const PW_IMG_BASE = "https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/petwalker";
const pwImg = (slug: string) => `${PW_IMG_BASE}/${slug}.webp`;

// 表示順 = 収集数の多い順 (淡路島→…→しまなみ)。tag は DB の area_tag と完全一致。slug = Storage ファイル名。
export const PW_AREAS: PWArea[] = [
  { tag: "淡路島",        en: "Awaji",        blurb: "海に抱かれた、島の時間。",     slug: "awaji",       img: pwImg("awaji") },
  { tag: "湘南",          en: "Shonan",       blurb: "波音のとなりで過ごす休日。",   slug: "shonan",      img: pwImg("shonan") },
  { tag: "北海道",        en: "Hokkaido",     blurb: "大地と温泉、ひろい空。",       slug: "hokkaido",    img: pwImg("hokkaido") },
  { tag: "九州",          en: "Kyushu",       blurb: "湯けむりの里をめぐる。",       slug: "kyushu",      img: pwImg("kyushu") },
  { tag: "河口湖",        en: "Kawaguchiko",  blurb: "富士を望む、森のほとり。",     slug: "kawaguchiko", img: pwImg("kawaguchiko") },
  { tag: "伊勢志摩",      en: "Ise-Shima",    blurb: "海辺の聖地をたずねて。",       slug: "iseshima",    img: pwImg("iseshima") },
  { tag: "蓼科・八ヶ岳",  en: "Tateshina",    blurb: "高原を渡る、澄んだ風。",       slug: "tateshina",   img: pwImg("tateshina") },
  { tag: "しまなみ海道",  en: "Shimanami",    blurb: "島と橋をつなぐ道のり。",       slug: "shimanami",   img: pwImg("shimanami") },
  // 関西近郊4エリア (2026/6/16 追加・画像は後日投入→投入まではフォールバック背景)
  { tag: "城崎温泉",      en: "Kinosaki",     blurb: "湯けむりと、柳のまち。",       slug: "kinosaki",    img: pwImg("kinosaki") },
  { tag: "南紀白浜",      en: "Shirahama",    blurb: "白い渚と、太平洋。",           slug: "shirahama",   img: pwImg("shirahama") },
  { tag: "琵琶湖",        en: "Lake Biwa",    blurb: "湖畔の風と、並木道。",         slug: "biwako",      img: pwImg("biwako") },
  { tag: "小豆島",        en: "Shodoshima",   blurb: "瀬戸内の島と、夕陽。",         slug: "shodoshima",  img: pwImg("shodoshima") },
];

// カテゴリ表示 (DB の category と一致: hotel/cafe/spot)
export const PW_CATEGORIES: PWCategory[] = [
  { key: "hotel", label: "泊まる", en: "Stay" },
  { key: "cafe",  label: "食べる", en: "Eat" },
  { key: "spot",  label: "訪れる", en: "Visit" },
];

// pet_types コード → 表示ラベル
export const PW_PET_LABELS: Record<string, string> = {
  dog: "犬",
  cat: "猫",
};
