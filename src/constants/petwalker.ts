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
  // 全国7エリア (2026/6/16 追加・画像は後日投入→投入まではフォールバック背景)
  { tag: "房総",          en: "Boso",         blurb: "潮風と、海辺の休日。",         slug: "boso",         img: pwImg("boso") },
  { tag: "日光・那須",    en: "Nikko",        blurb: "森と湖の、高原へ。",           slug: "nikko",        img: pwImg("nikko") },
  { tag: "浜名湖",        en: "Lake Hamana",  blurb: "湖畔で過ごす、犬旅。",         slug: "hamanako",     img: pwImg("hamanako") },
  { tag: "出雲",          en: "Izumo",        blurb: "神話の国を、めぐる。",         slug: "izumo",        img: pwImg("izumo") },
  { tag: "四万十",        en: "Shimanto",     blurb: "最後の清流に沿って。",         slug: "shimanto",     img: pwImg("shimanto") },
  { tag: "飛騨高山",      en: "Hida-Takayama", blurb: "古い町並みと、山里。",        slug: "hidatakayama", img: pwImg("hidatakayama") },
  { tag: "白馬",          en: "Hakuba",       blurb: "北アルプスを、仰ぐ。",         slug: "hakuba",       img: pwImg("hakuba") },
  // 高原・温泉4エリア (2026/6/16 追加・画像は後日投入→投入まではフォールバック背景)
  { tag: "軽井沢",        en: "Karuizawa",    blurb: "木陰の風と、避暑地。",         slug: "karuizawa",   img: pwImg("karuizawa") },
  { tag: "箱根",          en: "Hakone",       blurb: "山の湯と、富士の眺め。",       slug: "hakone",      img: pwImg("hakone") },
  { tag: "伊豆",          en: "Izu",          blurb: "海と高原の、伊豆路。",         slug: "izu",         img: pwImg("izu") },
  { tag: "蔵王",          en: "Zao",          blurb: "樹氷と、山の湯。",             slug: "zao",         img: pwImg("zao") },
  // 全国4エリア (2026/6/16 追加・画像は後日投入→投入まではフォールバック背景)
  { tag: "沖縄",          en: "Okinawa",      blurb: "碧い海と、島時間。",           slug: "okinawa",     img: pwImg("okinawa") },
  { tag: "草津温泉",      en: "Kusatsu",      blurb: "湯畑と、硫黄の香り。",         slug: "kusatsu",     img: pwImg("kusatsu") },
  { tag: "金沢",          en: "Kanazawa",     blurb: "茶屋街と、古都の風情。",       slug: "kanazawa",    img: pwImg("kanazawa") },
  { tag: "道後温泉",      en: "Dogo",         blurb: "日本最古の、湯の里。",         slug: "dogo",        img: pwImg("dogo") },
  // テーマ特集 (地名でなく道中の休憩テーマ・2026/6/16・画像後日)
  { tag: "高速SA・ドッグラン", en: "Highway Dog Run", blurb: "道中の、ひと休み。",      slug: "driving_dogrun", img: pwImg("driving_dogrun") },
  { tag: "道の駅・ドッグラン", en: "Roadside Station Dog Run", blurb: "立ち寄りの、ひと遊び。", slug: "michinoeki_dogrun", img: pwImg("michinoeki_dogrun") },
  { tag: "雨の日OK・屋内あそび場", en: "Rainy Day", blurb: "雨でも、思いきり。", slug: "rainy_indoor", img: pwImg("rainy_indoor") },
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
