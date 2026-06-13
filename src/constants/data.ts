// 静的データ・マスタ定数 (App.tsx 分割 Phase 1 ②)
// カテゴリ/イベント/施設/モデレーション辞書等。ロジック無改変で App.tsx から移動。

// ── 出品カテゴリ ──────────────────────────────────────────────────────
export const CATS = [
  { id:"all", icon:"🐾", label:"すべて" },
  { id:"illust", icon:"🎨", label:"似顔絵" },
  { id:"clothes", icon:"👕", label:"お洋服" },
  { id:"photo", icon:"📸", label:"フォト" },
  { id:"goods", icon:"✨", label:"グッズ" },
  { id:"food", icon:"🍖", label:"フード" },
  { id:"training", icon:"🐕", label:"しつけ" },
];

// listings は useListings hook が DB から取得する。
// フォールバック先は空配列とする (King 判断: Supabase 障害 / RLS ミス / network エラー時に
// 架空 seller + 偽 rating/reviews を出すリスクを永続排除)。
// 詳細: 利用規約 第16条第1項⑤ / ブランド人格 v3 第2章二・第11章・第13章 (依頼書 #105 v2.0 連動更新)
export const LISTINGS: any[] = [];

// レビューはユーザーの実取引完了後に reviews テーブルから取得する設計。
// 運営による架空レビューは一切置かない（利用規約 第16条第1項⑤、ブランド人格 v3 第2章二・第11章・第13章）。
export const REVIEWS: any[] = [];

export const EVENTS: any[] = [];

export const EVENT_CATS = ["すべて","フェスタ","交流会","撮影会","マーケット","体験会","健康"];

// ── Mock Orders ───────────────────────────────────────────────────────────
export const ORDER_STEPS = [
  { key:"pending", label:"注文確定", icon:"🛒" },
  { key:"working", label:"作業中", icon:"🎨" },
  { key:"delivered", label:"納品済み", icon:"📦" },
  { key:"completed", label:"取引完了", icon:"✅" },
];

export const DISPUTE_REASONS = [
  { id:"quality", label:"イメージと違う・品質問題", icon:"😕" },
  { id:"not_delivered", label:"商品が届かない", icon:"📭" },
  { id:"wrong_spec", label:"サイズ・仕様が違う", icon:"📏" },
  { id:"no_show", label:"サービスが提供されなかった", icon:"🚫" },
  { id:"other", label:"その他", icon:"💬" },
];

// ── リアクション (SectionTodaysMoments) ───────────────────────────────
export const QC_REACTIONS: { key: string; label: string }[] = [
  { key: "precious", label: "尊い" },
  { key: "healed", label: "癒された" },
  { key: "glad_met", label: "出会えてよかった" },
  { key: "want_see", label: "ずっと見てたい" },
];

// ── 連絡先検出パターン (決済防御: detectContacts が参照) ────────────────
export const CONTACT_PATTERNS = [
  // 電話番号
  { regex: /0\d{1,4}[-－‐ーｰ\s]?\d{1,4}[-－‐ーｰ\s]?\d{3,4}/g, label: "電話番号" },
  { regex: /0\d{9,10}/g, label: "電話番号" },
  // メールアドレス
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "メールアドレス" },
  { regex: /[a-zA-Z0-9._%+-]+\s*[＠@]\s*[a-zA-Z0-9.-]+\s*[\.。]\s*[a-zA-Z]{2,}/g, label: "メールアドレス" },
  // URL
  { regex: /https?:\/\/[^\s]+/gi, label: "URL" },
  { regex: /[a-zA-Z0-9-]+\.(com|jp|net|org|io|co|me|app|shop|store|tv|ne)\b/gi, label: "URL" },
  // LINE
  { regex: /(LINE|line|Line|ライン|らいん|ﾗｲﾝ|raɪn)/gi, label: "LINE" },
  // Twitter/X
  { regex: /(Twitter|twitter|ツイッター|ついったー|ﾂｲｯﾀｰ|つぶやき)/gi, label: "Twitter/X" },
  { regex: /(\bX\b|エックス)\s*(id|ID|アカウント|あかうんと)/gi, label: "Twitter/X" },
  // Instagram
  { regex: /(Instagram|instagram|insta|Insta|インスタ|いんすた|ｲﾝｽﾀ|インスタグラム|いんすたぐらむ|ｲﾝｽﾀｸﾞﾗﾑ|IG)/gi, label: "Instagram" },
  // Facebook
  { regex: /(Facebook|facebook|フェイスブック|ふぇいすぶっく|ﾌｪｲｽﾌﾞｯｸ|フェースブック|FB|ｴﾌﾋﾞｰ)/gi, label: "Facebook" },
  // TikTok
  { regex: /(TikTok|tiktok|ティックトック|てぃっくとっく|ﾃｨｯｸﾄｯｸ|tt)/gi, label: "TikTok" },
  // WhatsApp
  { regex: /(WhatsApp|whatsapp|ワッツアップ|わっつあっぷ|ﾜｯﾂｱｯﾌﾟ)/gi, label: "WhatsApp" },
  // Telegram
  { regex: /(Telegram|telegram|テレグラム|てれぐらむ|ﾃﾚｸﾞﾗﾑ)/gi, label: "Telegram" },
  // Discord
  { regex: /(Discord|discord|ディスコード|でぃすこーど|ﾃﾞｨｽｺｰﾄﾞ|ディスコ|でぃすこ|ﾃﾞｨｽｺ)/gi, label: "Discord" },
  // YouTube
  { regex: /(YouTube|youtube|ユーチューブ|ゆーちゅーぶ|ﾕｰﾁｭｰﾌﾞ|ようつべ|ﾖｳﾂﾍﾞ)/gi, label: "YouTube" },
  // Skype
  { regex: /(Skype|skype|スカイプ|すかいぷ|ｽｶｲﾌﾟ)/gi, label: "Skype" },
  // Kakao Talk
  { regex: /(KakaoTalk|kakao|カカオトーク|かかおとーく|ｶｶｵﾄｰｸ|カカオ|かかお|ｶｶｵ)/gi, label: "KakaoTalk" },
  // Signal
  { regex: /(Signal|signal|シグナル|しぐなる|ｼｸﾞﾅﾙ)/gi, label: "Signal" },
  // 一般的な連絡関連キーワード
  { regex: /(連絡先|れんらくさき|ﾚﾝﾗｸｻｷ)\s*[:：はを]?\s*[\w@＠\-_.]+/gi, label: "連絡先" },
  { regex: /(直接|ちょくせつ|ﾁｮｸｾﾂ)(連絡|連絡先|やりとり|取引|送金|振込)/gi, label: "サイト外取引" },
  { regex: /(サイト外|外部|別|他|ほか)で\s*(連絡|やりとり|取引|送金|振込|決済)/gi, label: "サイト外取引" },
  { regex: /(振込|ふりこみ|銀行|ぎんこう|口座|こうざ)/gi, label: "銀行振込" },
];

// ── NGワードフィルター（喧嘩・誹謗中傷防止 / detectNGWords が参照） ──────
export const NG_WORDS = [
  // 暴言・侮辱
  "死ね","しね","シネ","ｼﾈ","殺す","ころす","コロス","ｺﾛｽ","殺して","しんで","死んで",
  "ばか","バカ","馬鹿","ｱﾎ","あほ","アホ","阿呆","間抜け","まぬけ","低能","低脳","無能",
  "クソ","くそ","糞","クズ","くず","屑","ゴミ","ごみ","カス","かす","滓",
  "ブス","ぶす","醜い","キモい","きもい","気持ち悪い","うざい","ウザい","ウザ","邪魔",
  "雑魚","ザコ","ざこ","負け犬","負け組","役立たず","やくたたず",
  // 差別・ヘイト
  "ガイジ","がいじ","池沼","ちしょう","知障","精神病","キチガイ","きちがい","気違い","発達障害者",
  "在日","ザイニチ","チョン","支那","シナ人","土人","部落",
  // 性的・下品
  "セックス","ｾｯｸｽ","ヤリマン","やりまん","ビッチ","びっち","売女","淫売",
  "ち〇ぽ","ま〇こ","おまんこ","チンコ","ﾁﾝｺ","マンコ","ﾏﾝｺ",
  // 脅迫
  "潰す","ぶっ殺","ぶっころ","殴る","なぐる","刺す","さす","ぶん殴","ボコる","ぼこる",
  "晒す","さらす","特定する","個人情報","住所教えろ","住所さらす",
  "訴える","訴訟","裁判","慰謝料","賠償",
  // ペット関連の悪質ワード（Qocca特有）
  "虐待","ぎゃくたい","ギャクタイ","殺処分","保健所送り","捨てろ","捨てる",
];

// ── ブログカテゴリ ────────────────────────────────────────────────────
export const BLOG_CATS = [
  { id:"all", icon:"📝", label:"すべて" },
  { id:"tips", icon:"💡", label:"豆知識" },
  { id:"health", icon:"🏥", label:"健康" },
  { id:"food", icon:"🍖", label:"ごはん" },
  { id:"training", icon:"🎓", label:"しつけ" },
  { id:"goods", icon:"🛍", label:"グッズ" },
  { id:"story", icon:"📖", label:"うちの子物語" },
  { id:"creator", icon:"🎨", label:"クリエイター" },
];

// ── 施設カテゴリ ──────────────────────────────────────────────────────
export const FACILITY_CATS = [
  { id:"all", icon:"🐾", label:"すべて" },
  { id:"dogrun", icon:"🐕", label:"ドッグラン" },
  { id:"cafe", icon:"☕", label:"ペットカフェ" },
  { id:"hospital", icon:"🏥", label:"動物病院" },
  { id:"salon", icon:"✂️", label:"トリミング" },
  { id:"hotel", icon:"🏨", label:"ペットホテル" },
  { id:"park", icon:"🌳", label:"公園" },
  { id:"shop", icon:"🛍", label:"ペットショップ" },
];

// 気分タグ（ポジティブ・ファクトベース型）
export const MOOD_TAGS = [
  { id:"fun", icon:"🐕", label:"楽しく遊べた" },
  { id:"clean", icon:"✨", label:"きれいで快適" },
  { id:"empty", icon:"☀️", label:"空いていた" },
  { id:"moderate", icon:"🌤", label:"適度な人出" },
  { id:"busy", icon:"⛅", label:"少し混んでいた" },
  { id:"water", icon:"💧", label:"水道・足洗い場あり" },
  { id:"parking", icon:"🚗", label:"駐車場が便利" },
  { id:"shade", icon:"🌳", label:"日陰・木陰あり" },
  { id:"roof", icon:"🏠", label:"屋根あり" },
  { id:"small_dog", icon:"🐕‍🦺", label:"小型犬向け" },
  { id:"large_dog", icon:"🦮", label:"大型犬向け" },
  { id:"agility", icon:"🎯", label:"アジリティあり" },
];

export const FACILITY_REPORT_REASONS = [
  { id:"inappropriate", label:"不適切な内容" },
  { id:"spam", label:"スパム・宣伝" },
  { id:"misinformation", label:"誤った情報" },
  { id:"defamation", label:"誹謗中傷・名誉毀損" },
  { id:"privacy", label:"プライバシー侵害" },
  { id:"other", label:"その他" },
];

// 名誉毀損リスクを下げるためのNGワード（コメント投稿時のチェック / checkFacilityNGWords が参照）
export const FACILITY_NG_WORDS = [
  "最悪","ひどい","クソ","くそ","死ね","殺","ゴミ","汚い","汚れすぎ",
  "詐欺","二度と行かない","潰れろ","訴え","営業停止","違法",
  "店員がムカつく","スタッフが最悪","オーナーが","○○さん",
];

// ── 都道府県 (施設検索用 / 県表記なし) ────────────────────────────────
export const PREFS = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"];

// ── コミュニティカテゴリ ──────────────────────────────────────────────
export const COMMUNITY_CATEGORIES = ["すべて","犬種別","猫種別","エリア別","しつけ・お悩み","お散歩仲間","多頭飼い","シニアペット","保護犬・保護猫","その他"];
