// ============================================
// event-scraper v1 (依頼書 #27 v2 Phase 2, 2026/5/28)
// コア: source_url を fetch → gpt-4o-mini で構造化 → events に INSERT
//
// 著作権ルール (顕教書 §3 厳格遵守):
//   - 公式画像は絶対にコレクションしない (URLのみ)
//   - 公式説明文の丸コピー禁止
//   - 100字以内に AI が自分の言葉で要約
//   - official_url 必須
//
// マーケ・ブランド戦略書 v1.0 §3 NG 語彙遵守:
//   - バズ/爆発的/急成長/No.1/最大/最強/業界初/絶対/100%/必ず/お得/激安/今だけ
//
// #32 の教訓: EdgeRuntime.waitUntil() で非同期可能 / 本文は同期 (個別 source 1件処理)
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

const CONFIDENCE_AUTO = 0.70;
const CONFIDENCE_PENDING = 0.50;
const MONTHLY_BUDGET_USD = 13.33; // ¥2,000 / 150

const NG_WORDS = ['バズ','爆発的','急成長','No.1','最大','最強','業界初','絶対','100%','必ず','お得','激安','今だけ'];

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function checkMonthlyBudget(supabase: any): Promise<{ allowed: boolean; spent: number }> {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
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
    return { html: html.slice(0, 60000), status: res.status };
  } catch (e) {
    console.error("[event-scraper] fetch failed", e);
    return null;
  }
}

async function extractEvents(html: string, sourceUrl: string, sourcePrefecture: string | null): Promise<{ events: any[]; cost_usd: number } | null> {
  if (!OPENAI_API_KEY) return null;
  const systemPrompt = `あなたはペットイベント情報を抽出して構造化する AIです。
【重要ルール】
1. HTML からペット関連イベントのみ抽出 (譲渡会・里親会・ドッグランイベント・しつけ教室等)
2. 説明文の丸コピー禁止 - 必ず 100字以内で自分の言葉で要約
3. 以下の NG ワードを要約に使わない: ${NG_WORDS.join(', ')}
4. イベントが見つからなければ events:[] を返す (幻覚に作らない)
5. official_url はソースページのトップ URL もしくはイベント詳細ページを使う
6. ai_confidence: 0-1 で「これは本当にペットイベントだと思う度合い」を評価する

出力は JSON のみ、schema:
{
  "events": [
    {
      "title": "イベント名", "summary": "100字以内要約 (NG語彙不使用)",
      "start_date": "YYYY-MM-DD or null", "end_date": "YYYY-MM-DD or null",
      "location": "全住所 or null", "prefecture": "都道府県名 (例: 大阪府) or null",
      "city": "市区町村 or null",
      "event_category": "adoption|expo|market|seminar|training|cafe_event|shopping_dog_ok|medical_check|photo_session|fundraising|welfare|other",
      "official_url": "公式 URL (必須)", "ai_confidence": 0.85
    }
  ]
}`;
  const userPrompt = `ソースURL: ${sourceUrl}\nソース都道府県ヒント: ${sourcePrefecture || '不明'}\n\nHTML:\n${html}`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" }, temperature: 0.3, max_tokens: 2000,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const events: any[] = parsed?.events || [];
    const inputTokens = data?.usage?.prompt_tokens || 0;
    const outputTokens = data?.usage?.completion_tokens || 0;
    const cost_usd = (inputTokens * 0.15 + outputTokens * 0.60) / 1_000_000;
    return { events, cost_usd };
  } catch (e) { console.error("[event-scraper] parse error", e); return null; }
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
      errors: `fetch_failed: status=${fetched?.status ?? "network_error"}`, ai_cost_usd: 0,
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

  let newCount = 0, dupCount = 0;
  const inserted: any[] = [];
  for (const e of extracted.events) {
    if (!e.title || !e.start_date) { dupCount++; continue; }
    const hash = await sha256(`${e.title}|${e.start_date}|${e.location || ''}`);
    const { data: existing } = await supabase.from("event_dedup_hashes").select("id").eq("content_hash", hash).maybeSingle();
    if (existing) { dupCount++; continue; }

    const conf = Number(e.ai_confidence || 0);
    let approval = "pending";
    if (conf >= CONFIDENCE_AUTO) approval = "auto_approved";
    else if (conf < CONFIDENCE_PENDING) approval = "rejected";

    const { data: ev, error: insErr } = await supabase.from("events").insert({
      title: e.title.slice(0, 200),
      description: (e.summary || '').slice(0, 200),
      event_date: e.start_date,
      place: e.location || '',
      prefecture: e.prefecture || source.prefecture || '未指定',
      city: e.city || null,
      event_category: e.event_category || 'other',
      official_url: e.official_url || source.url,
      source_url: source.url,
      source_type: 'ai_scraped',
      ai_confidence: conf,
      approval_status: approval,
      scraped_at: new Date().toISOString(),
      status: approval === 'auto_approved' ? 'approved' : 'pending',
      image_url: '', // 著作権ルールで画像は収集しない
    }).select().single();
    if (insErr) { console.error("[event-scraper] insert error", insErr); continue; }
    await supabase.from("event_dedup_hashes").insert({ event_id: ev.id, content_hash: hash });
    newCount++;
    inserted.push({ id: ev.id, title: ev.title, approval, conf });
  }

  await supabase.from("event_sources").update({
    last_scraped_at: new Date().toISOString(),
    events_collected: (source.events_collected || 0) + newCount,
  }).eq("id", sourceId);

  await supabase.from("event_scrape_logs").insert({
    source_id: sourceId, events_found: extracted.events.length,
    events_new: newCount, events_duplicate: dupCount, errors: null, ai_cost_usd: extracted.cost_usd,
  });

  return { success: true, source_id: sourceId, source_name: source.name,
    events_found: extracted.events.length, events_new: newCount, events_duplicate: dupCount,
    ai_cost_usd: extracted.cost_usd, budget_spent_usd: budget.spent + extracted.cost_usd, inserted };
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
  } catch (_) {}
  if (!sourceId) return jsonResponse({ success: false, error: "source_id_required" }, 400);

  if (waitMode) {
    const result = await runScrape(sourceId);
    return jsonResponse(result, result.success ? 200 : 500);
  }
  EdgeRuntime.waitUntil(runScrape(sourceId).catch(err => console.error("[event-scraper] background error", err)));
  return jsonResponse({ success: true, step: "accepted", source_id: sourceId, async: true });
});
