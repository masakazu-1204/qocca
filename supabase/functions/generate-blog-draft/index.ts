// ============================================
// generate-blog-draft v11 (依頼書 #37 Phase 1, 2026/5/31)
// v11 追加機能:
//   - blog 公開成功時 (!testMode && published=true) に
//     X 告知 tweet を自動連携投稿 (シナリオ C / Premium 不要)
//   - tweet text: 「📰 新しい記事公開 「{title}」 {meta_desc} → qocca.pet/blog/{id}」
//   - cover_image_url も X media upload (5/30 達成の media.write scope 利用)
//   - x_posts テーブルに INSERT → post-to-x v7 を invoke → tweet_id 取得
//   - blog_posts UPDATE x_tweet_id + x_posted_at
//   - X 連携失敗しても blog 公開自体は成功判定 (silent fail / response に詳細)
// v10 (gpt-image-1 移行, 2026/5/24):
//   - dall-e-3 → gpt-image-1 (OpenAI 2025年新主力画像モデル)
//   - レスポンス形式変更: url → b64_json (base64 直返)
// v9: fallback image_prompt + image_trace
// v8: BLOG_CRON_SECRET 撤去
// v7: 10テーマ + THEME_GUIDE
// ============================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const BLOG_AUTO_KILL_SWITCH = Deno.env.get("BLOG_AUTO_KILL_SWITCH") ?? "false";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const IMAGE_MODEL = "gpt-image-1";
const IMAGE_QUALITY = "medium";
const IMAGE_SIZE = "1024x1024";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: any, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);

const ALLOWED_CATEGORIES = [
  "petcare", "philosophy", "ark", "creator", "industry",
  "rainbow", "medical", "anniversary", "global", "tech",
];

const SYSTEM_PROMPT = `あなたは日本のペットマーケットプレイス「Qocca」のブログライターです。

【ブランド哲学】
- 「もう一つの人生を置いておける街」
- 「住める速度を超えない」
- 「壊さない・急がない」
- 「平等に照らされる住民」
- 「気配の数」
- 「創作者と暮らす街」

【文体ルール】
- フレンドリー + ですます調
- 少しだけ関西弁 (「や」「で」等) を 1-2 回だけ混ぜる
- 強調語「ガチで」も 1 回だけ使う
- 体言止め多用 (「即修正」「神対応」)
- 絵文字は 1500字あたり 4-6 個ぐらい

【ペット業界の繊細さ】
- 「飼う」より「一緒に暮らす」「お迎えする」
- 「ペット」単体より「家族」「うちの子」を優先
- 虐待・殺処分・ペットショップ批判・やらせは絶対 NG
- 虹の橋・ペットロスは慎重に、断定せず寄り添うトーン
- 医療系トピックは「個別診断」を避け、一般的な目安と「動物病院に相談を」で締める

【SEO 意識】
- 記事タイトルにロングテール検索クエリを意識 (例: 「犬 アレルギー 対処法」)
- 本文にも「~とは」「~の方法」「~のコツ」タイプの見出しを自然に含める
- タグは検索ボリュームのあるキーワードを 3-5 個
- meta_description は必ず入れる: 検索キーワード + Qocca 名 + 120字以内

【記事構造】
- 1200-1500字
- 導入 (共感) → 3 つのポイント (H3 見出し ## 使えるように) → まとめ → Qocca への自然な誘導

出力は必ず以下 5 フィールド全てを含む JSON で返してください (どれか一つでも欠落させない):
{
  "title": "記事タイトル (30-60字、ロングテール SEO 意識)",
  "content": "記事本文 (1200-1500字、改行 \\n で表現、Markdown 見出し ## 使用可)",
  "tags": ["検索キーワード1", "キーワード2", "キーワード3"],
  "meta_description": "検索キーワード + 内容要約 + Qocca名 (120字以内)",
  "image_prompt": "画像生成プロンプト。必ず英語で記述。ペットと街の雰囲気、暖かいパステルトーン、日本のイラスト調、テキストなし。"
}

重要: image_prompt フィールドを忘れずに含めてください。`;

const THEME_TOPICS: Record<string, string[]> = {
  petcare: ["梅雨時期のペットの健康管理","犬のアレルギー 年代別の見分け方と対処法","猫の毛玉ケアのコツ 詳しく","夏のペット熱中症対策 現代版","犬の散歩時間 年齢・犬種別ガイド","シニアペットの日々のケア","多頭飼いの最初の一週間","秋の換毛と被毛ケア","冬のペットとこたつ生活の注意点","春の花粉・ストレスケア","ペットトリミング 自宅でできるコツ","ペットの歯磨き 毎日続ける方法","犬猫の食器のタイプと選び方","ペットのダイエット 体重管理のコツ","シニアペットの認知症サイン","近所付き合いとペット連れマナー"],
  philosophy: ["なぜ Qocca を作るのか","気配の数 とは どんな考え方か","住める速度とは何か","創業期住民という証","「住民」と呼ぶ理由","クリエイターと暮らす街","「もう一つの人生を置いておける街」の意味","ペットと暮らすことの深さを改めて考える","住民同士の「丁寧な繋がり」","丁寧な街づくりとは","「もう一人の自分」をここに置いておく","「壊さない」「急がない」その意味","ペットオーナーとしての誠実さ","コミュニティの「補い合う」とは"],
  ark: ["特定非営利活動法人アニマルレフュージ関西【ARK】とはどんな団体か","保護犬をお迎えするという選択肢","保護猫をお迎えする前に知るべきこと","「対立ではなく、寄り添い」の哲学","Qocca が 特定非営利活動法人アニマルレフュージ関西【ARK】と連携する理由","動物福祉にできること","譲渡会に参加した人の記録","ペットショップと保護団体の違いと向き合い方","家族として一生一緒に暮らす責任","殺処分ゼロのためにできること","動物福祉システム 海外事例","「ペットビジネス」と「動物福祉」の交点"],
  creator: ["Qocca のクリエイターのこと","作品に込められた想いという記録","ペット肖像画という仕事の魅力","オーダーメイドクリエイターという生き方","作ることと住むこと","ペットクラフトの素材と選び方","手作りグッズ うちの子のための計画","オーダー耳タグはなぜ人気なのか","ペットイラスト オーダーメイド 価格と価値","クリエイターと育てるマーケット","「作品ストーリー」を人生に残す"],
  industry: ["日本のペット飼育率の現在地","クリエイターエコノミーの成長","ペット業界のこれから","オンラインマーケットの期待","デジタル時代の「街」のあり方","ペットテック 今とこれから","ペット保険の市場と選び方","ペットサブスクリプションのトレンド","ペットロス ケアのあり方","譲渡会とオンラインマッチング","ペットシェア 現実とは","AI とペット業界の重なり"],
  rainbow: ["虹の橋を渡った子を想う日々","ペットロスとどう向き合うか","うちの子が遺してくれた時間","先住の子と新しい子のあいだに流れる時間","思い出を残す 写真・遺品・記念の整え方","虹の橋メモリアル 自分なりの儀式","ペットロスのときに寄り添ってくれる人と居場所","「もう一つの人生を置いておける街」と虹の橋","涙が出ない日と、ふいに出る日","次の子を迎える前に整えておきたいこと"],
  medical: ["犬猫のワクチン 種類と頻度の目安","動物病院の選び方 セカンドオピニオン含めて","ペットの定期健診 年齢別ガイドライン","いつもと違うサイン 早めに気づくチェックリスト","うんち・おしっこから読み取れる体調サイン","フィラリア予防と季節の目安","ノミ・マダニ対策と季節","避妊・去勢手術 タイミングの考え方","歯周病予防の基本と通院サイン","シニア期に増える病気と日常の見守り方","動物の救急 夜間病院を事前に決めておく","ペット保険の選び方 補償と通院ペース"],
  anniversary: ["うちの子のお迎え記念日 ささやかな祝い方","愛犬・愛猫の誕生日 安心ケーキの考え方","卒業や進級のように暮らしの節目を残す","季節の行事をうちの子と一緒に","フォトブックで残す 一年のうちの子","記念日に贈るオーダーメイドのアイデア","うちの子の名前入りグッズの楽しみ方","家族写真と1年に1回の記念日撮影","アニバーサリーのお散歩コースを決める","うちの子の「1年」を住民に共有する"],
  global: ["ヨーロッパのペットと暮らす街の風景","スウェーデンのペット同伴文化","ドイツのティアハイム 動物保護の仕組み","アメリカのペットフレンドリーオフィス事情","台湾のキャットカフェ文化の今","イギリスの公共交通とペット","オランダ 殺処分ゼロを実現した背景","フランスのドッグカフェ事情","日本と海外 ペット同伴飲食の違い","イスラム圏のペットとの暮らし","北欧のシニアペットケアの考え方","出典を踏まえた海外データの読み方"],
  tech: ["AI とペットの暮らし 今できること","スマートフィーダー 選び方と注意点","ペットカメラ 留守番中の安心の作り方","GPS 首輪のメリットと制限","IoT トイレ 体調管理にどう使えるか","オンライン獣医相談サービスの活用","画像認識 AI とペット健康管理","Qocca の AI 自動公開ブログのこと","ペット業界の DX これから","AI 翻訳 海外の保護団体との連携","VR/AR とペットロスケア","テクノロジーと「住める速度」の両立"],
};

const THEME_LABELS: Record<string, string> = {
  petcare: "ペットケア",
  philosophy: "Qocca 哲学",
  ark: "ARK 連携",
  creator: "クリエイター紹介",
  industry: "業界動向",
  rainbow: "虹の橋・ペットロスケア",
  medical: "ペット医療基礎知識",
  anniversary: "ペット記念日",
  global: "グローバルペット文化",
  tech: "ペット × テクノロジー",
};

const THEME_GUIDE: Record<string, string> = {
  petcare: "トーン: 親しみやすく実用的。",
  philosophy: "トーン: 静かで思慮深い。Qocca の哲学キーワードを必ず 2-3 個自然に織り込む。",
  ark: "トーン: 真摯、「対立ではなく寄り添い」を体現。批判表現は使わない。",
  creator: "トーン: あたたかい、作品と住民の関係性を語る。",
  industry: "トーン: 知的。『各種調査によれば』など曖昧出典。",
  rainbow: "トーン: 静か、温度感、配慮。断定を避ける。",
  medical: "トーン: 真摯。必ず最後に『動物病院・かかりつけ獣医に相談を』で締める。個別診断は NG。",
  anniversary: "トーン: 喜び、温かさ。体験の提案。",
  global: "トーン: 知的、好奇心。『現地報道』『業界レポート』など曖昧出典。",
  tech: "トーン: 未来志向、『住める速度』哲学を必ず添える。",
};

const FALLBACK_IMAGE_PROMPTS: Record<string, string> = {
  petcare: "A warm pastel illustration of a small dog and cat being cared for by their owner in a cozy Japanese home, soft natural light, no text.",
  philosophy: "A serene pastel illustration of a quiet Japanese town at dawn with a small pet sleeping peacefully on a windowsill, contemplative atmosphere, no text.",
  ark: "A gentle pastel illustration of a rescue dog being adopted by a kind family in a sunlit shelter, hopeful warm atmosphere, no text.",
  creator: "A soft pastel illustration of a Japanese artist painting a pet portrait in their studio, warm afternoon light, no text.",
  industry: "A modern pastel illustration of a Japanese pet market with a community of pet owners and small shops, soft warm tones, no text.",
  rainbow: "A tender pastel illustration of a person and their beloved pet sitting together under a rainbow at sunset, peaceful and comforting, no text.",
  medical: "A reassuring pastel illustration of a kind veterinarian gently examining a small pet in a Japanese clinic, soft clean atmosphere, no text.",
  anniversary: "A joyful pastel illustration of a family celebrating their pet birthday with a small cake in a Japanese home, warm festive atmosphere, no text.",
  global: "A pastel illustration of pets and their owners from different countries gathered together in a peaceful park, multicultural warmth, no text.",
  tech: "A futuristic but warm pastel illustration of a small pet wearing a smart collar in a Japanese home, soft natural colors, no text.",
};

function estimateCost(promptTokens: number, completionTokens: number, withImage: boolean): number {
  const inputCost = (promptTokens / 1_000_000) * 2.50;
  const outputCost = (completionTokens / 1_000_000) * 10.00;
  const imageCost = withImage ? 0.04 : 0;
  return Number((inputCost + outputCost + imageCost).toFixed(4));
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// 依頼書 #37 Phase 1: blog 公開 連携 X tweet 投稿
// post-to-x v7 (既存 / 5/30 達成済) を invoke して 280字告知 tweet を出す
// X Premium 不要 / コスト $0
async function postBlogAnnouncementTweet(
  supabase: any,
  postId: string,
  title: string,
  metaDescription: string | null,
  coverImageUrl: string | null,
): Promise<{ ok: boolean; tweet_id?: string; posted_at?: string; error?: string }> {
  try {
    // 280字制限に収める text 組み立て
    const titleSafe = (title || "").trim().slice(0, 50);
    const descRaw = (metaDescription || "").trim();
    const descSafe = descRaw.length > 100 ? descRaw.slice(0, 100) : descRaw;
    const blogUrl = `https://qocca.pet/blog/${postId}`;
    const lines = [
      "📰 新しい記事を公開しました",
      "",
      `「${titleSafe}」`,
    ];
    if (descSafe) {
      lines.push("");
      lines.push(descSafe);
    }
    lines.push("");
    lines.push(`→ ${blogUrl}`);
    lines.push("");
    lines.push("#Qocca #ペット");
    const tweetText = lines.join("\n").slice(0, 280); // 最後の保険

    // x_posts に INSERT (status=scheduled ・画像ありなら cover_image_url)
    const { data: xPost, error: xInsErr } = await supabase
      .from("x_posts")
      .insert({
        content: tweetText,
        image_url: coverImageUrl,
        status: "scheduled",
        scheduled_at: new Date().toISOString(),
        cost_usd: 0,
      })
      .select()
      .single();

    if (xInsErr || !xPost?.id) {
      return { ok: false, error: `x_posts insert failed: ${xInsErr?.message || "no id"}` };
    }

    // post-to-x v7 (既存) を invoke
    const xRes = await fetch(`${SUPABASE_URL}/functions/v1/post-to-x`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x_post_id: xPost.id }),
    });
    const xData = await xRes.json();

    if (!xData?.success || !xData?.tweet_id) {
      return { ok: false, error: `post-to-x failed: ${JSON.stringify(xData).slice(0, 200)}` };
    }

    return { ok: true, tweet_id: xData.tweet_id, posted_at: xData.posted_at };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let testMode = false;
  let overrideCategory: string | null = null;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      testMode = body?.test_mode === true;
      if (body?.category && ALLOWED_CATEGORIES.includes(body.category)) {
        overrideCategory = body.category;
      }
    }
  } catch (_) {}

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (BLOG_AUTO_KILL_SWITCH === "true") {
    await supabase.from("blog_generation_log").insert({
      status: "kill_switch_active",
      error_message: "BLOG_AUTO_KILL_SWITCH = true",
    });
    return jsonResponse({ success: false, error: "kill_switch_active" }, 503);
  }

  if (!OPENAI_API_KEY) {
    await supabase.from("blog_generation_log").insert({
      status: "failed",
      error_message: "OPENAI_API_KEY 未設定",
    });
    return jsonResponse({ error: "openai_key_missing" }, 503);
  }

  let category: string | null = null;
  let themeTopic: string | null = null;
  let postId: string | null = null;
  const imageTrace: any = {
    image_model: IMAGE_MODEL,
    image_prompt_from_ai: null,
    image_prompt_used: null,
    image_prompt_source: null,
    dalle_status: null,
    dalle_error: null,
  };
  // 依頼書 #37 Phase 1: X 連携 trace
  const xConnectTrace: any = {
    attempted: false,
    ok: false,
    tweet_id: null,
    posted_at: null,
    error: null,
  };

  try {
    if (overrideCategory) {
      category = overrideCategory;
    } else {
      const { data: themeData, error: themeErr } = await supabase.rpc("next_blog_theme");
      if (themeErr) throw new Error(`next_blog_theme RPC failed: ${themeErr.message}`);
      category = themeData as string;
    }

    const topics = THEME_TOPICS[category!] || THEME_TOPICS.philosophy;
    themeTopic = topics[Math.floor(Math.random() * topics.length)];
    const themeGuide = THEME_GUIDE[category!] || "";

    const { data: recentPosts } = await supabase
      .from("blog_posts")
      .select("title")
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(8);
    const recentTitles = (recentPosts || []).map((p: { title: string }) => p.title).join("\n- ");

    const userPrompt = `テーマカテゴリ: ${THEME_LABELS[category!]}
今回のトピック: ${themeTopic}

【このテーマのトーンガイド】
${themeGuide}
${recentTitles ? `\n【重複させないため、近期同テーマ記事のタイトル】\n- ${recentTitles}\n` : ""}
このトピックで、上記システムプロンプトのルールとテーマ別トーンガイドに従って、ロングテール SEO 意識して JSON を返してください。`;

    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      }),
    });
    const chatData = await chatRes.json();

    if (!chatRes.ok || !chatData.choices?.[0]?.message?.content) {
      throw new Error(`OpenAI chat failed: ${JSON.stringify(chatData).slice(0, 300)}`);
    }

    const promptTokens = chatData.usage?.prompt_tokens ?? 0;
    const completionTokens = chatData.usage?.completion_tokens ?? 0;
    const totalTokens = chatData.usage?.total_tokens ?? promptTokens + completionTokens;

    let article: any;
    try {
      article = JSON.parse(chatData.choices[0].message.content);
    } catch (_) {
      throw new Error(`JSON parse failed: ${chatData.choices[0].message.content.slice(0, 200)}`);
    }

    if (!article.title || !article.content) {
      throw new Error("記事の title または content が生成されなかった");
    }

    imageTrace.image_prompt_from_ai = typeof article.image_prompt === "string" && article.image_prompt.trim().length > 0
      ? article.image_prompt.trim()
      : null;

    let imagePromptToUse: string;
    if (imageTrace.image_prompt_from_ai) {
      imagePromptToUse = imageTrace.image_prompt_from_ai;
      imageTrace.image_prompt_source = "ai";
    } else {
      imagePromptToUse = FALLBACK_IMAGE_PROMPTS[category!] || FALLBACK_IMAGE_PROMPTS.philosophy;
      imageTrace.image_prompt_source = "fallback";
    }
    imageTrace.image_prompt_used = imagePromptToUse;

    let coverImageUrl: string | null = null;
    let imageGenerated = false;
    try {
      const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt: `${imagePromptToUse} Style: warm, soft pastel, Japanese illustration, no text.`,
          size: IMAGE_SIZE,
          quality: IMAGE_QUALITY,
          n: 1,
        }),
      });
      const imgData = await imgRes.json();
      const b64 = imgData?.data?.[0]?.b64_json;
      const dalleUrl = imgData?.data?.[0]?.url;

      if (!imgRes.ok || (!b64 && !dalleUrl)) {
        imageTrace.dalle_status = "api_error";
        imageTrace.dalle_error = JSON.stringify(imgData).slice(0, 500);
      } else {
        let imgBlob: Blob;
        if (b64) {
          const bytes = base64ToUint8Array(b64);
          imgBlob = new Blob([bytes], { type: "image/png" });
        } else {
          imgBlob = await (await fetch(dalleUrl)).blob();
        }
        const prefix = testMode ? "test-" : "auto-generated/";
        const filePath = `${prefix}${Date.now()}-${category}.png`;
        const { error: upErr } = await supabase.storage
          .from("blog-images")
          .upload(filePath, imgBlob, { contentType: "image/png", upsert: true });
        if (upErr) {
          imageTrace.dalle_status = "upload_error";
          imageTrace.dalle_error = upErr.message;
        } else {
          const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(filePath);
          coverImageUrl = urlData.publicUrl;
          imageGenerated = true;
          imageTrace.dalle_status = "success";
        }
      }
    } catch (imgErr: any) {
      imageTrace.dalle_status = "exception";
      imageTrace.dalle_error = imgErr?.message || String(imgErr);
      console.error("Image generation exception:", imgErr?.message);
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminProfile?.id) {
      throw new Error("admin role の profile が見つかりません");
    }

    const tags = Array.isArray(article.tags) ? article.tags : [];
    const { data: newPost, error: insErr } = await supabase
      .from("blog_posts")
      .insert({
        author_id: adminProfile.id,
        title: testMode ? `[TEST] ${article.title}` : article.title,
        content: article.content,
        meta_description: article.meta_description ?? null,
        category,
        tags,
        cover_image_url: coverImageUrl,
        published: !testMode,
        ai_generated: true,
        ai_model: testMode ? "gpt-4o-test" : "gpt-4o",
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insErr) throw new Error(`blog_posts INSERT failed: ${insErr.message}`);
    postId = newPost.id;

    // 依頼書 #37 Phase 1: 公開成功時のみ X 告知 tweet 連携
    // testMode は X に実投されるのを避ける (誤投防止)
    if (!testMode && newPost.published) {
      xConnectTrace.attempted = true;
      const xResult = await postBlogAnnouncementTweet(
        supabase, postId!, article.title, article.meta_description ?? null, coverImageUrl,
      );
      xConnectTrace.ok = xResult.ok;
      xConnectTrace.tweet_id = xResult.tweet_id ?? null;
      xConnectTrace.posted_at = xResult.posted_at ?? null;
      xConnectTrace.error = xResult.error ?? null;

      if (xResult.ok && xResult.tweet_id) {
        await supabase.from("blog_posts").update({
          x_tweet_id: xResult.tweet_id,
          x_posted_at: xResult.posted_at || new Date().toISOString(),
        }).eq("id", postId!);
      }
      // X 連携失敗しても blog 公開自体は成功として返す (silent fail)
    }

    const cost = estimateCost(promptTokens, completionTokens, imageGenerated);
    await supabase.from("blog_generation_log").insert({
      post_id: postId,
      category,
      theme_title: themeTopic,
      status: "success",
      ai_model: testMode ? "gpt-4o-test" : "gpt-4o",
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_usd: cost,
      metadata: {
        image_generated: imageGenerated,
        meta_description: article.meta_description ?? null,
        title: article.title,
        test_mode: testMode,
        override_category: overrideCategory,
        version: "v11",
        image_trace: imageTrace,
        x_connect_trace: xConnectTrace,
      },
    });

    return jsonResponse({
      success: true,
      version: "v11",
      test_mode: testMode,
      post_id: postId,
      title: testMode ? `[TEST] ${article.title}` : article.title,
      published: !testMode,
      category,
      theme_label: THEME_LABELS[category!],
      theme_topic: themeTopic,
      tags,
      meta_description: article.meta_description ?? null,
      cover_image_url: coverImageUrl,
      tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
      cost_usd: cost,
      image_generated: imageGenerated,
      image_trace: imageTrace,
      x_connect_trace: xConnectTrace,
    });
  } catch (err: any) {
    console.error("generate-blog-draft error:", err);
    await supabase.from("blog_generation_log").insert({
      post_id: postId,
      category,
      theme_title: themeTopic,
      status: "failed",
      ai_model: "gpt-4o",
      error_message: (err?.message || String(err)).slice(0, 500),
      metadata: { image_trace: imageTrace, x_connect_trace: xConnectTrace },
    }).then(() => {}).catch(() => {});

    return jsonResponse({
      success: false,
      error: "generation_failed",
      message: err?.message || String(err),
      image_trace: imageTrace,
      x_connect_trace: xConnectTrace,
    }, 500);
  }
});
