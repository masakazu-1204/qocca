// ペットウォーカー定数 (エリア / カテゴリ定義)
// ⚠️ 静けさ世界観: 絵文字なし・詩的で控えめなコピー。area_tag は DB(pet_walker_spots.area_tag)と一致必須。

export type PWArea = { tag: string; en: string; blurb: string; slug: string; img: string; kind: "area" | "theme" };
export type PWCategory = { key: string; label: string; en: string };

// 背景画像: Supabase Storage 公開バケット petwalker (King が Dashboard から <slug>.webp を投入)。
// 公開URLは決定的なので先に配線 (投入前は 404 → UI はフォールバック背景色)。
const PW_IMG_BASE = "https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/petwalker";
const pwImg = (slug: string) => `${PW_IMG_BASE}/${slug}.webp`;

// 表示順: ① 地名エリア(kind:"area")を北→南 ② テーマ特集(kind:"theme")を後置。
//   tag は DB の area_tag と完全一致。slug = Storage ファイル名。en/blurb/slug は不変(並び替えのみ)。
export const PW_AREAS: PWArea[] = [
  // ── エリアで探す: 地名27 (北→南) ──
  // 2026/7/6 188計画 土台固め: 超広域「北海道」を実態4分割 (DB更新済・裏タグ=北海道西/北/南)
  { tag: "富良野・美瑛",  en: "Furano-Biei",  blurb: "丘と花畑を、ゆく夏。",         slug: "furano_biei", img: pwImg("furano_biei"), kind: "area" },
  { tag: "札幌・小樽",    en: "Sapporo-Otaru", blurb: "都会と運河、北の週末。",      slug: "sapporo_otaru", img: pwImg("sapporo_otaru"), kind: "area" },
  { tag: "ニセコ・洞爺",  en: "Niseko-Toya",  blurb: "山と湖の、澄んだ空気。",       slug: "niseko_toya", img: pwImg("niseko_toya"), kind: "area" },
  { tag: "函館・大沼",    en: "Hakodate",     blurb: "港町の坂と、湖のほとり。",     slug: "hakodate_onuma", img: pwImg("hakodate_onuma"), kind: "area" },
  { tag: "蔵王",          en: "Zao",          blurb: "樹氷と、山の湯。",             slug: "zao",         img: pwImg("zao"),         kind: "area" },
  { tag: "仙台",          en: "Sendai",       blurb: "杜の都の、しずかな時間。",     slug: "sendai",      img: pwImg("sendai"),      kind: "area" },
  { tag: "奥日光・中禅寺湖", en: "Oku-Nikko",  blurb: "高原と、湖と、滝。",           slug: "okunikko",    img: pwImg("okunikko"),    kind: "area" },
  { tag: "日光・那須",    en: "Nikko",        blurb: "森と湖の、高原へ。",           slug: "nikko",        img: pwImg("nikko"),       kind: "area" },
  { tag: "房総",          en: "Boso",         blurb: "潮風と、海辺の休日。",         slug: "boso",         img: pwImg("boso"),        kind: "area" },
  { tag: "秩父・長瀞",    en: "Chichibu",     blurb: "霊峰と、岩畳の川。",           slug: "chichibu",    img: pwImg("chichibu"),    kind: "area" },
  // 2026/7/6 188計画 Phase A 第1マス (東京南): お台場・東京ベイ
  { tag: "お台場・東京ベイ", en: "Odaiba / Tokyo Bay", blurb: "海風わたる、都会の水辺。", slug: "odaiba", img: pwImg("odaiba"), kind: "area" },
  // 2026/7/7 188計画 Phase A 第5マス (東京西): 高尾・奥多摩
  { tag: "高尾・奥多摩",   en: "Takao / Okutama", blurb: "山の空気と、犬の神様。",    slug: "takao_okutama", img: pwImg("takao_okutama"), kind: "area" },
  { tag: "軽井沢",        en: "Karuizawa",    blurb: "木陰の風と、避暑地。",         slug: "karuizawa",   img: pwImg("karuizawa"),   kind: "area" },
  { tag: "草津温泉",      en: "Kusatsu",      blurb: "湯畑と、硫黄の香り。",         slug: "kusatsu",     img: pwImg("kusatsu"),     kind: "area" },
  { tag: "蓼科・八ヶ岳",  en: "Tateshina",    blurb: "高原を渡る、澄んだ風。",       slug: "tateshina",   img: pwImg("tateshina"),   kind: "area" },
  { tag: "白馬",          en: "Hakuba",       blurb: "北アルプスを、仰ぐ。",         slug: "hakuba",       img: pwImg("hakuba"),      kind: "area" },
  { tag: "箱根",          en: "Hakone",       blurb: "山の湯と、富士の眺め。",       slug: "hakone",      img: pwImg("hakone"),      kind: "area" },
  // 2026/7/6 188計画 Phase A 第4マス (神奈川東): 横浜・みなとみらい
  { tag: "横浜・みなとみらい", en: "Yokohama", blurb: "港と汽笛と、海沿いの散歩。",   slug: "yokohama_mm", img: pwImg("yokohama_mm"), kind: "area" },
  { tag: "鎌倉",          en: "Kamakura",     blurb: "古都を、犬とあるく。",         slug: "kamakura",    img: pwImg("kamakura"),    kind: "area" },
  { tag: "伊豆",          en: "Izu",          blurb: "海と高原の、伊豆路。",         slug: "izu",         img: pwImg("izu"),         kind: "area" },
  { tag: "浜名湖",        en: "Lake Hamana",  blurb: "湖畔で過ごす、犬旅。",         slug: "hamanako",     img: pwImg("hamanako"),    kind: "area" },
  { tag: "名古屋・知多",  en: "Nagoya",       blurb: "街と海の、あいだで。",         slug: "nagoya",       img: pwImg("nagoya"),      kind: "area" },
  { tag: "飛騨高山",      en: "Hida-Takayama", blurb: "古い町並みと、山里。",        slug: "hidatakayama", img: pwImg("hidatakayama"), kind: "area" },
  { tag: "奥飛騨温泉郷",  en: "Okuhida",      blurb: "湯けむりと、北アルプスの麓。", slug: "okuhida",     img: pwImg("okuhida"),     kind: "area" },
  { tag: "金沢",          en: "Kanazawa",     blurb: "茶屋街と、古都の風情。",       slug: "kanazawa",    img: pwImg("kanazawa"),    kind: "area" },
  { tag: "河口湖",        en: "Kawaguchiko",  blurb: "富士を望む、森のほとり。",     slug: "kawaguchiko", img: pwImg("kawaguchiko"), kind: "area" },
  { tag: "山中湖",        en: "Yamanakako",   blurb: "富士を映す、湖のほとり。",     slug: "yamanakako",  img: pwImg("yamanakako"),  kind: "area" },
  { tag: "伊勢志摩",      en: "Ise-Shima",    blurb: "海辺の聖地をたずねて。",       slug: "iseshima",    img: pwImg("iseshima"),    kind: "area" },
  { tag: "京都",          en: "Kyoto",        blurb: "古都の、しずかな路地。",       slug: "kyoto",       img: pwImg("kyoto"),       kind: "area" },
  // 2026/7/7 188計画 Phase A 第6マス (奈良北): 奈良・生駒
  { tag: "奈良・生駒",    en: "Nara / Ikoma", blurb: "古都と、鹿と、山あいの緑。",   slug: "nara_ikoma",  img: pwImg("nara_ikoma"),  kind: "area" },
  { tag: "神戸",          en: "Kobe",         blurb: "港と、坂のある街。",           slug: "kobe",        img: pwImg("kobe"),        kind: "area" },
  // 2026/7/6 188計画 Phase A 第2マス (大阪南): 堺・りんくう
  { tag: "堺・りんくう",  en: "Sakai / Rinku", blurb: "海辺のまちと、南大阪の風。",  slug: "sakai_rinku", img: pwImg("sakai_rinku"), kind: "area" },
  // 2026/7/6 188計画 Phase A 第3マス (大阪北): 北摂・箕面
  { tag: "北摂・箕面",    en: "Hokusetsu / Minoh", blurb: "山なみと緑地の、北の郊外。", slug: "hokusetsu_minoh", img: pwImg("hokusetsu_minoh"), kind: "area" },
  { tag: "淡路島",        en: "Awaji",        blurb: "海に抱かれた、島の時間。",     slug: "awaji",       img: pwImg("awaji"),       kind: "area" },
  { tag: "城崎温泉",      en: "Kinosaki",     blurb: "湯けむりと、柳のまち。",       slug: "kinosaki",    img: pwImg("kinosaki"),    kind: "area" },
  { tag: "琵琶湖",        en: "Lake Biwa",    blurb: "湖畔の風と、並木道。",         slug: "biwako",      img: pwImg("biwako"),      kind: "area" },
  { tag: "南紀白浜",      en: "Shirahama",    blurb: "白い渚と、太平洋。",           slug: "shirahama",   img: pwImg("shirahama"),   kind: "area" },
  { tag: "鳥取",          en: "Tottori",      blurb: "砂丘と、山と、湯けむり。",     slug: "tottori",     img: pwImg("tottori"),     kind: "area" },
  { tag: "出雲",          en: "Izumo",        blurb: "神話の国を、めぐる。",         slug: "izumo",        img: pwImg("izumo"),       kind: "area" },
  { tag: "小豆島",        en: "Shodoshima",   blurb: "瀬戸内の島と、夕陽。",         slug: "shodoshima",  img: pwImg("shodoshima"),  kind: "area" },
  { tag: "しまなみ海道",  en: "Shimanami",    blurb: "島と橋をつなぐ道のり。",       slug: "shimanami",   img: pwImg("shimanami"),   kind: "area" },
  { tag: "宮島",          en: "Miyajima",     blurb: "海に浮かぶ、朱の鳥居。",       slug: "miyajima",    img: pwImg("miyajima"),    kind: "area" },
  { tag: "山口",          en: "Yamaguchi",    blurb: "城下町と、海辺の風。",         slug: "yamaguchi",   img: pwImg("yamaguchi"),   kind: "area" },
  { tag: "道後温泉",      en: "Dogo",         blurb: "日本最古の、湯の里。",         slug: "dogo",        img: pwImg("dogo"),        kind: "area" },
  { tag: "四万十",        en: "Shimanto",     blurb: "最後の清流に沿って。",         slug: "shimanto",     img: pwImg("shimanto"),    kind: "area" },
  { tag: "湘南",          en: "Shonan",       blurb: "波音のとなりで過ごす休日。",   slug: "shonan",      img: pwImg("shonan"),      kind: "area" },
  // 2026/7/6 188計画 土台固め: 超広域「九州」を実態分割 (福岡・糸島 / 別府 / 湯布院へ3件編入・DB更新済)
  { tag: "福岡・糸島",    en: "Fukuoka-Itoshima", blurb: "海辺のカフェと、街の元気。", slug: "fukuoka_itoshima", img: pwImg("fukuoka_itoshima"), kind: "area" },
  { tag: "別府",          en: "Beppu",        blurb: "湯けむりの向こうに、海。",     slug: "beppu",       img: pwImg("beppu"),       kind: "area" },
  { tag: "湯布院",        en: "Yufuin",       blurb: "盆地の朝霧と、湯の町。",       slug: "yufuin",      img: pwImg("yufuin"),      kind: "area" },
  { tag: "阿蘇",          en: "Aso",          blurb: "草原に、風がわたる。",         slug: "aso",         img: pwImg("aso"),         kind: "area" },
  { tag: "沖縄",          en: "Okinawa",      blurb: "碧い海と、島時間。",           slug: "okinawa",     img: pwImg("okinawa"),     kind: "area" },
  // ── 目的で探す: テーマ特集3 (高速SA→道の駅→雨の日) ──
  { tag: "高速SA・ドッグラン", en: "Highway Dog Run", blurb: "道中の、ひと休み。",      slug: "driving_dogrun", img: pwImg("driving_dogrun"), kind: "theme" },
  { tag: "道の駅・ドッグラン", en: "Roadside Station Dog Run", blurb: "立ち寄りの、ひと遊び。", slug: "michinoeki_dogrun", img: pwImg("michinoeki_dogrun"), kind: "theme" },
  { tag: "雨の日OK・屋内あそび場", en: "Rainy Day", blurb: "雨でも、思いきり。", slug: "rainy_indoor", img: pwImg("rainy_indoor"), kind: "theme" },
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
