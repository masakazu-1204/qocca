// ============================================
// event-scraper v8 (2026/10/22)
// v8 King「承認が面倒やからそのまま載せてほしい。日にちが過ぎてるやつは消していこう」
//   - 抽出したイベントは信頼度に関係なく公開する (status='approved' / approval_status='auto_approved')。
//     信頼度 0.30 未満 (個人主催・会員限定) は今までどおり取り込まない。
//     実測: 0.30 と判定されたものも DEAR DOG FES・ジャパンわんこフェスタなど実在の公開イベントで、
//     King が旧画面で全部承認していた。AI の信頼度は「主催者が書いてあるか」でしか付いていない。
//   - 日付が過ぎたイベントは取り込まない (end_date があれば end_date、なければ start_date と JST の今日で比較)。
//     終わったイベントは毎日 0:30 に消える (cron events-mark-ended-daily)。消すと重複判定の記録も一緒に消えるため、
//     ここで弾かないと一覧ページに残っている過去のイベントが毎日入っては消える。
//   - AI の end_date を events.end_date に保存する (複数日のイベントを初日の翌日に消さないため)。
// v7 修正: 重複判定に location を含めていたため、会場表記の揺れで同一イベントが
//   何度も新規登録されていた (実例: 同一イベントが4件)。タイトル+日付で判定する。
// v6 修正: 「切ってから掃除する」順序が逆で、本文が AI に一度も届いていなかった
//   実測 (pets-support.com/dog-event/ = 全体396,620文字・イベント日付165個):
//     1. 生HTMLを先頭120,000文字で切る  -> 日付 0個   ここで全部落ちていた
//     2. それをクリーニング->25,000文字 -> 日付 0個   AI には空が届いていた
//     ★先にクリーニング->100,000文字    -> 日付165個 (掃除後 88,651文字で全部入る)
//   あわせて max_tokens 3000->8000。
// v5: HTML クリーニング関数追加 (script/style/nav/header/footer/comments 除去)
// v4: フィルタ強化 (依頼書 #48 v2)
// v3: 原型 (依頼書 #27 v2 Phase 2)
// ============================================
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// v8: これ未満は取り込まない (個人主催・会員限定)。これ以上は全部そのまま公開
const CONFIDENCE_MIN = 0.30;
// v8: 期間がこれより長いものは「年間スケジュール」や「一覧記事」を 1 件と読み違えたものなので取り込まない
//     (2026/10/22 実例: 名古屋市のしつけ方教室 5/23〜翌1/24、CHERIEE の記事タイトル 10/1〜11/30)
const MAX_SPAN_DAYS = 14;
const MONTHLY_BUDGET_USD = 13.33;

// v8: 掃除後の本文を CHUNK_CHARS ずつに分けて AI に渡す (最大 MAX_CHUNKS 回)。
//     v7 までは 100,000 文字を 1 回で渡していたため、pets-support.com (イベント日付 165 個) でも
//     返ってくるのは 13〜30 件だった。分けると 1 回あたりの出力が詰まらず、拾える数が増える。
//     費用は 1 回 $0.003 前後 × 回数 (月予算 $13.33 で十分足りる)。
const CHUNK_CHARS = 40000;
const MAX_CHUNKS = 8;
// v6: 生HTMLの安全上限 (異常に巨大なページでメモリを食い潰さないための保険)
const RAW_FETCH_LIMIT = 2000000;

const NG_WORDS = ["バズ", "爆発的", "急成長", "No.1", "最大", "最強", "業界初", "絶対", "100%", "必ず", "お得", "激安", "今だけ"];

const jstToday = (): string => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// HTML クリーニング (script/style/nav/header/footer/comments 除去 + 空白圧縮)
// a タグは残す。official_url の抽出に href が要るため。
function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, " ")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\son[a-z]+="[^"]*"/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function checkMonthlyBudget(supabase: any): Promise<{ allowed: boolean; spent: number }> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase.from("event_scrape_logs").select("ai_cost_usd").gte("scraped_at", monthStart.toISOString());
  const spent = (data || []).reduce((s: number, r: any) => s + Number(r.ai_cost_usd || 0), 0);
  return { allowed: spent < MONTHLY_BUDGET_USD, spent };
}

async function fetchHtml(url: string): Promise<{ html: string; status: number } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QoccaBot/1.0; +https://qocca.pet)" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { html: "", status: res.status };
    const html = await res.text();
    // v6: ここでは切らない。切ると本文が落ちる。掃除は extractEvents 側で行う。
    return { html: html.slice(0, RAW_FETCH_LIMIT), status: res.status };
  } catch (e) {
    console.error("[event-scraper v8] fetch failed", e);
    return null;
  }
}

// v8: 掃除してから CHUNK_CHARS ずつに分けて、それぞれ抽出して合わせる。
//     1 つでも成功すればその分を返す。全部失敗したときだけ null
async function extractEvents(
  html: string,
  sourceUrl: string,
  sourcePrefecture: string | null,
): Promise<{ events: any[]; cost_usd: number; cleaned_chars: number; chunks: number; failed_chunks: number } | null> {
  if (!OPENAI_API_KEY) return null;
  // v6: 先に掃除してから切る (v5 は逆で、本文に到達する前に予算を使い切っていた)
  const cleaned = cleanHtml(html);
  const chunks: string[] = [];
  for (let i = 0; i < cleaned.length && chunks.length < MAX_CHUNKS; i += CHUNK_CHARS) chunks.push(cleaned.slice(i, i + CHUNK_CHARS));
  const results = await Promise.all(chunks.map((c, i) => extractChunk(c, sourceUrl, sourcePrefecture, i + 1, chunks.length)));
  const ok = results.filter((r): r is { events: any[]; cost_usd: number } => r !== null);
  if (!ok.length) return null;
  return {
    events: ok.flatMap((r) => r.events),
    cost_usd: ok.reduce((s, r) => s + r.cost_usd, 0),
    cleaned_chars: Math.min(cleaned.length, CHUNK_CHARS * MAX_CHUNKS),
    chunks: chunks.length,
    failed_chunks: chunks.length - ok.length,
  };
}

async function extractChunk(
  finalHtml: string,
  sourceUrl: string,
  sourcePrefecture: string | null,
  part: number,
  totalParts: number,
): Promise<{ events: any[]; cost_usd: number } | null> {
  const schemaLine =
    '{"events":[{"title":"イベント名","summary":"100字以内要約","start_date":"YYYY-MM-DD or null",' +
    '"end_date":"YYYY-MM-DD or null","location":"全住所 or null","prefecture":"都道府県名 or null",' +
    '"city":"市区町村 or null","event_category":"adoption|expo|market|seminar|training|cafe_event|' +
    'shopping_dog_ok|medical_check|photo_session|fundraising|welfare|other",' +
    '"official_url":"公式 URL","organizer_type":"gov/npo/retail/corp/individual","ai_confidence":0.85}]}';

  const systemPrompt = [
    "あなたはペットイベント情報を抽出して構造化する AIです。",
    "",
    "【採用すべきイベント】",
    "公式団体主催 (都道府県・市区町村・動物愛護センター・NPO 法人)",
    "大規模商業施設主催 (イオンモール・ショッピングセンター・道の駅・公園事務所等)",
    "公開譲渡会・里親会 (詳細・住所・主催者が明記)",
    "ドッグランイベント・カフェイベント (公開イベント)",
    "マルシェ・フェスティバル (動物・ペット関係の公開イベント)",
    "しつけ教室 (公式ドッグスクール・トレーナー主催)",
    "",
    "【除外すべきイベント】",
    "個人主催のオフ会・交流会 / コミュニティ限定 (会員限定・招待制)",
    "SNS グループ限定 / 小規模交流 (10人未満) / 詳細未公表・連絡先不明",
    "★一覧記事そのものの見出し (例: 「2026年9月のイベント情報」など、個別のイベントでないもの)",
    "★今日 (" + jstToday() + ") より前に終わっているイベント",
    "",
    "【ルール】",
    "1. HTML からペット関連イベントのみ抽出",
    "2. 説明文の丸コピ禁止。100字以内で要約",
    "3. NG ワード除外: " + NG_WORDS.join(", "),
    "4. イベントが見つからない/条件不適合なら events:[] (幻覚禁止)",
    "5. official_url はソースページ or イベント詳細 URL",
    "6. 見つかったイベントは省略せず、可能な限りすべて出力する",
    "7. 会場名が分かる場合は location に施設名を入れる (郵便番号だけの住所より施設名を優先)",
    "8. 複数日にわたるイベントは start_date に初日、end_date に最終日を入れる。1日だけなら end_date は null。" +
      "定期開催 (毎月・毎週・年間スケジュール) は、開催日ごとに別々のイベントとして出力する (期間でまとめない)",
    "9. ai_confidence: 0.85-1.0=公式団体・公共施設・大規模商業施設 / 0.50-0.85=NPO・有名店主催 / 0.30-0.50=主催者不明確 / 0.0-0.30=個人・会員限定",
    "",
    "出力は JSON のみ、schema:",
    schemaLine,
  ].join("\n");

  const userPrompt =
    "ソースURL: " + sourceUrl +
    "\nソース都道府県ヒント: " + (sourcePrefecture || "不明") +
    (totalParts > 1 ? "\n(長いページを分けて渡しています: " + part + "/" + totalParts + "。途中で切れているイベントは、日付と名前が読み取れるものだけ出力)" : "") +
    "\n\n本文 (クリーニング済):\n" + finalHtml;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[event-scraper v8] OpenAI failed", res.status, errText.slice(0, 300));
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const events: any[] = parsed?.events || [];
    const inputTokens = data?.usage?.prompt_tokens || 0;
    const outputTokens = data?.usage?.completion_tokens || 0;
    const cost_usd = (inputTokens * 0.15 + outputTokens * 0.60) / 1000000;
    return { events, cost_usd };
  } catch (e) {
    console.error("[event-scraper v8] parse error", e);
    return null;
  }
}

async function runScrape(sourceId: string): Promise<any> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const budget = await checkMonthlyBudget(supabase);
  if (!budget.allowed) return { success: false, error: "monthly_budget_exceeded", spent_usd: budget.spent };

  const { data: source } = await supabase.from("event_sources").select("*").eq("id", sourceId).single();
  if (!source) return { success: false, error: "source_not_found" };
  if (!source.is_active) return { success: false, error: "source_inactive" };

  const fetched = await fetchHtml(source.url);
  if (!fetched || !fetched.html) {
    await supabase.from("event_scrape_logs").insert({
      source_id: sourceId, events_found: 0, events_new: 0, events_duplicate: 0,
      errors: "fetch_failed: status=" + (fetched?.status ?? "network_error"), ai_cost_usd: 0,
    });
    return { success: false, error: "fetch_failed", status: fetched?.status };
  }

  const extracted = await extractEvents(fetched.html, source.url, source.prefecture);
  if (!extracted) {
    await supabase.from("event_scrape_logs").insert({
      source_id: sourceId, events_found: 0, events_new: 0, events_duplicate: 0,
      errors: "openai_extraction_failed", ai_cost_usd: 0,
    });
    return { success: false, error: "openai_failed" };
  }

  const today = jstToday();
  let newCount = 0, dupCount = 0, rejectedCount = 0, pastCount = 0;
  const inserted: any[] = [];

  for (const e of extracted.events) {
    if (!e.title || !isYmd(e.start_date)) { dupCount++; continue; }
    const conf = Number(e.ai_confidence || 0);
    if (conf < CONFIDENCE_MIN) { rejectedCount++; continue; }

    // v8: 終わりの日 (なければ開始日) が今日より前なら取り込まない
    const endDate = isYmd(e.end_date) && e.end_date > e.start_date ? e.end_date : null;
    if ((endDate || e.start_date) < today) { pastCount++; continue; }
    if (endDate && (Date.parse(endDate) - Date.parse(e.start_date)) / 86400000 > MAX_SPAN_DAYS) { rejectedCount++; continue; }

    // v7 (2026/8/22) 重複判定から location を外す。
    //   ソースによって会場の書き方が揺れるため、同じイベントが何度も新規登録されていた。
    //   実例: PILI ALOHA Fes.with DOG 2026 SUMMER (2026-08-22) が4件登録されていた
    //     道の駅うつのみや ろまんちっく村 / 〒321-2118 栃木県宇都宮市新里町丙254
    //     / 栃木県宇都宮市新里町丙254 / 栃木県宇都宮市新里町丙254番地
    //   同じ日に同名イベントが別々に存在することは実質ないため、
    //   タイトル(空白除去・小文字化) + 開催日 で判定する。
    const dedupKey = e.title.split(" ").join("").split("　").join("").toLowerCase() + "|" + e.start_date;
    const hash = await sha256(dedupKey);
    const { data: existing } = await supabase.from("event_dedup_hashes").select("id").eq("content_hash", hash).maybeSingle();
    if (existing) { dupCount++; continue; }

    const { data: ev, error: insErr } = await supabase.from("events").insert({
      title: e.title.slice(0, 200),
      description: (e.summary || "").slice(0, 200),
      event_date: e.start_date,
      end_date: endDate,
      place: e.location || "",
      prefecture: e.prefecture || source.prefecture || "未指定",
      city: e.city || null,
      event_category: e.event_category || "other",
      official_url: e.official_url || source.url,
      source_url: source.url,
      source_type: "ai_scraped",
      ai_confidence: conf,
      approval_status: "auto_approved",
      scraped_at: new Date().toISOString(),
      status: "approved",
      image_url: "",
    }).select().single();

    if (insErr) { console.error("[event-scraper v8] insert error", insErr); continue; }
    await supabase.from("event_dedup_hashes").insert({ event_id: ev.id, content_hash: hash });
    newCount++;
    inserted.push({ id: ev.id, title: ev.title, conf, organizer_type: e.organizer_type });
  }

  await supabase.from("event_sources").update({
    last_scraped_at: new Date().toISOString(),
    events_collected: (source.events_collected || 0) + newCount,
  }).eq("id", sourceId);

  const notes = [
    rejectedCount > 0 ? "rejected_low_confidence: " + rejectedCount : "",
    pastCount > 0 ? "skipped_past: " + pastCount : "",
    extracted.failed_chunks > 0 ? "failed_chunks: " + extracted.failed_chunks + "/" + extracted.chunks : "",
  ].filter(Boolean).join(" / ");
  await supabase.from("event_scrape_logs").insert({
    source_id: sourceId,
    events_found: extracted.events.length,
    events_new: newCount,
    events_duplicate: dupCount + rejectedCount + pastCount,
    errors: notes || null,
    ai_cost_usd: extracted.cost_usd,
  });

  return {
    success: true, source_id: sourceId, source_name: source.name,
    events_found: extracted.events.length, events_new: newCount, events_duplicate: dupCount,
    events_rejected_low_conf: rejectedCount, events_skipped_past: pastCount,
    cleaned_chars: extracted.cleaned_chars, chunks: extracted.chunks, failed_chunks: extracted.failed_chunks,
    ai_cost_usd: extracted.cost_usd, budget_spent_usd: budget.spent + extracted.cost_usd,
    inserted,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let sourceId: string | null = null;
  let waitMode = false;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      sourceId = body?.source_id || null;
      waitMode = body?.wait === true;
    }
  } catch (_) { /* body 無しは source_id_required で弾く */ }
  if (!sourceId) return jsonResponse({ success: false, error: "source_id_required" }, 400);
  if (waitMode) {
    const result = await runScrape(sourceId);
    return jsonResponse(result, result.success ? 200 : 500);
  }
  EdgeRuntime.waitUntil(runScrape(sourceId).catch((err) => console.error("[event-scraper v8] background error", err)));
  return jsonResponse({ success: true, step: "accepted", source_id: sourceId, async: true });
});
