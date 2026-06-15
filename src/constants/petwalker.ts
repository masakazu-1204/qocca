// ペットウォーカー定数 (エリア / カテゴリ定義)
// ⚠️ 静けさ世界観: 絵文字なし・詩的で控えめなコピー。area_tag は DB(pet_walker_spots.area_tag)と一致必須。

export type PWArea = { tag: string; en: string; blurb: string };
export type PWCategory = { key: string; label: string; en: string };

// 表示順 = 収集数の多い順 (淡路島→…→しまなみ)。tag は DB の area_tag と完全一致。
export const PW_AREAS: PWArea[] = [
  { tag: "淡路島",        en: "Awaji",        blurb: "海に抱かれた、島の時間。" },
  { tag: "湘南",          en: "Shonan",       blurb: "波音のとなりで過ごす休日。" },
  { tag: "北海道",        en: "Hokkaido",     blurb: "大地と温泉、ひろい空。" },
  { tag: "九州",          en: "Kyushu",       blurb: "湯けむりの里をめぐる。" },
  { tag: "河口湖",        en: "Kawaguchiko",  blurb: "富士を望む、森のほとり。" },
  { tag: "伊勢志摩",      en: "Ise-Shima",    blurb: "海辺の聖地をたずねて。" },
  { tag: "蓼科・八ヶ岳",  en: "Tateshina",    blurb: "高原を渡る、澄んだ風。" },
  { tag: "しまなみ海道",  en: "Shimanami",    blurb: "島と橋をつなぐ道のり。" },
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
