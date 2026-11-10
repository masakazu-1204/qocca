// 商店街の特集 (2026/11/10 King「冬の贈りもの特集で進めて」)
//
// 特集は「いま並んでいる作品から、季節に合うものを選んで並べ直す」だけの棚。
// 作品そのものや値段には触らない。並べる作品の id をここに書き、
// /feature/<slug> のページ (pages/feature.tsx) と、トップの小さな案内 (home.tsx) が読む。
//
// - 書いた id のうち、公開中 (approved / sold_out) で一覧に載っている作品だけが出る。
//   取り下げられた作品は自動で消えるので、ここを急いで直さなくても壊れない。
// - showOnHomeUntil を過ぎるとトップの案内は消える。特集ページそのものは残る。
// - 文面は静けさの決まり: 絵文字なし・「。」・煽らない・健康は断定せず獣医さんへの相談を添える。

export type FeatureSection = {
  title: string;
  note: string;
  listingIds: string[];
};

export type Feature = {
  slug: string;
  label: string; // 英字の小さな見出し
  title: string;
  lead: string;
  description: string; // 検索・共有用の一文
  showOnHomeUntil: string; // この日 (JST) の終わりまでトップに案内を出す
  sections: FeatureSection[];
  closingNote: string;
};

export const FEATURES: Feature[] = [
  {
    slug: "winter-2026",
    label: "Winter Gifts",
    title: "冬の贈りもの",
    lead:
      "寒い季節がやってきました。うちの子へ、うちの子を大切にしている誰かへ。作り手の方がひとつずつ仕立てた品を、冬の贈りものとして集めました。",
    description: "作り手の方がひとつずつ仕立てた、ペットと暮らす人への冬の贈りもの。Qocca の商店街から。",
    showOnHomeUntil: "2026-12-25",
    sections: [
      {
        title: "うちの子へ、冬のごほうび",
        note: "北海道のエゾ鹿を使った、無添加のおやつです。はじめての食材は少しずつ。体質に不安があるときは、かかりつけの獣医さんに相談してみてください。",
        listingIds: [
          "aecb52e1-727b-498e-8309-63cc88d435d8", // エゾ鹿ジャーキー4種セット (eighty eight)
          "d70ccc96-1042-4f1a-a0cd-347172e47749", // エゾ鹿内臓ふりかけ5種セット (eighty eight)
          "41e5f5c7-5d1a-4cc8-909f-43fdf9afef2a", // ひぐまジャーキー (eighty eight)
        ],
      },
      {
        title: "残しておきたい、今年の姿",
        note: "一年の終わりに、いまのうちの子を形にして残す。写真をもとに描く絵や、羊毛でつくる作品です。",
        listingIds: [
          "0445ebfc-7700-4d13-b08c-0340bf99c3e5", // うちの子アート honobono (PETRA)
          "3b5fe7e3-3ef8-48fd-8f18-c6b9cb5186c2", // ペットの色鉛筆画 (grace)
          "896c390c-ecec-4d52-8b72-02e11b53dbc9", // うちの子羊毛フレーム (grace)
          "06841745-fc78-49e4-b548-963d5d0190da", // 丸まって寝てるハムスター (kuu)
          "446183cc-53d4-4fda-9959-00a7f5172498", // 軽量粘土アート 壁掛けプレート (grace)
        ],
      },
      {
        title: "新しい年を迎える装い",
        note: "年の瀬の集まりや、新年の一枚に。手仕事のスタイです。",
        listingIds: [
          "185ff164-2ae9-4b34-9648-ac952b6ee7c7", // おめかしスタイ 1枚 (OnePetal)
          "4ea494f8-eec2-46ce-b641-259b5f368577", // おめかしスタイ 1枚 + シュシュ (OnePetal)
        ],
      },
      {
        title: "ちいさな贈りもの",
        note: "手のひらにのるくらいの、気負わずに渡せるものです。",
        listingIds: [
          "984a5ad5-f11e-4c01-9398-eac4d6d03ea1", // 枯れないお花のピン (petit futa.)
          "5a621943-3451-4d68-82df-8d03071e93b9", // うちの子のオリジナル名刺 (かわはる)
        ],
      },
    ],
    closingNote:
      "お届けまでの日数は、作品ごとに違います。年内に届けたいときは、作品ページのお届けの目安をご覧ください。迷うときは、作家さんにメッセージで尋ねてみてください。売上の 3% は、アニマルレフュージ関西 (ARK) に届けられます。",
  },
];

export const findFeature = (slug: string | undefined): Feature | undefined =>
  FEATURES.find((f) => f.slug === slug);

/** トップに案内を出す特集 (期間内のうち最初の 1 つ)。日付は日本時間で比べる。 */
export const currentHomeFeature = (now: Date = new Date()): Feature | undefined => {
  const todayJst = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return FEATURES.find((f) => todayJst <= f.showOnHomeUntil);
};
