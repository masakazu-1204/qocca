// ============================================
// event-source-discovery v1 (依頼書 #27 v2 Phase 2, 2026/5/28)
// 47都道府県 × カテゴリで gpt-4o-mini に「動物イベント情報源」の URL 候補を提案させる
// 月 1回起動 (約 47都道府県 × 5カテゴリ ≈ 235 提案)
//
// 設計メモ:
//   - 本物の Web 検索 API は追加コストかかるため、本版では gpt-4o-mini に
//     「明らかに明らかに存在する公表サイト URL」を記憶から提案させるだけ、
//     実際の validation は event-scraper が扱う
//   - 将来 Google Custom Search / Brave Search API 連携は Phase以降拡張
//
// 著作権: URL 提案のみ・コンテンツ未取得
// NG語彙: コメント部分に使わせない (URLのみ)
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

const PREFECTURES = [
  "北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬",
  "埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野",
  "岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山",
  "鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡",
  "佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"
];

const SUGGEST_CATEGORIES = [
  { key: "prefecture_official", label: "都道府県公式動物愛護センター" },
  { key: "city_official",       label: "主要市区町村公式ペット関連ページ" },
  { key: "npo",                 label: "動物保護 NPO・シェルター" },
  { key: "cafe",                label: "有名ドッグカフェ・キャットカフェ" },
  { key: "aggregator",          label: "ペットイベントアグリゲータ・地域情報サイト" },
];

async function suggestSources(supabase: any, prefecture: string, category: { key: string; label: string }): Promise<{ added: number; cost_usd: number }> {
  if (!OPENAI_API_KEY) return { added: 0, cost_usd: 0 };
  const prompt = `あなたはペットイベント情報源を提案する AI です。

ターゲット: ${prefecture}としの ${category.label}で、ペットイベント情報 (譲渡会/里親会/ドッグラン/しつけ教室等) を掲載する可能性が高い公式サイトを最大3件提案してください。

【重要ルール】
- 実在する URL のみ (幻覚禁止)
- URL が不明ならその件はスキップ
- 動物関連のイベント情報が載ってるページだけ

出力: JSON
{
  "sources": [
    { "name": "サイト名", "url": "https://...", "city": "市区町村 or null" }
  ]
}`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.4, max_tokens: 800,
      }),
    });
    if (!res.ok) return { added: 0, cost_usd: 0 };
    const data = await res.json();
    const sources = JSON.parse(data?.choices?.[0]?.message?.content || '{}')?.sources || [];
    const inputTokens = data?.usage?.prompt_tokens || 0;
    const outputTokens = data?.usage?.completion_tokens || 0;
    const cost_usd = (inputTokens * 0.15 + outputTokens * 0.60) / 1_000_000;

    let added = 0;
    for (const s of sources) {
      if (!s.url || !s.name) continue;
      const { data: existing } = await supabase.from("event_sources").select("id").eq("url", s.url).maybeSingle();
      if (existing) continue;
      await supabase.from("event_sources").insert({
        name: s.name.slice(0, 200), url: s.url,
        source_type: category.key, prefecture, city: s.city || null,
        scrape_frequency: "weekly", is_active: false,
        notes: `AI 提案 (${new Date().toISOString().slice(0,10)})`,
      }).select().single().then(() => added++).catch(() => {});
    }
    return { added, cost_usd };
  } catch (e) { console.error("[discovery] error", e); return { added: 0, cost_usd: 0 }; }
}

async function runDiscovery(prefectures: string[] | null, categories: string[] | null): Promise<any> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await supabase.from("meta_agent_state").update({
    last_run_at: new Date().toISOString(), agent_status: "healthy", updated_at: new Date().toISOString(),
  }).eq("agent_name", "events_collection");

  const targetPrefs = prefectures && prefectures.length > 0 ? prefectures : PREFECTURES;
  const targetCats = categories && categories.length > 0
    ? SUGGEST_CATEGORIES.filter(c => categories.includes(c.key))
    : SUGGEST_CATEGORIES;

  let totalAdded = 0;
  let totalCost = 0;
  const results: any[] = [];
  for (const pref of targetPrefs) {
    for (const cat of targetCats) {
      const r = await suggestSources(supabase, pref, cat);
      totalAdded += r.added;
      totalCost += r.cost_usd;
      results.push({ prefecture: pref, category: cat.key, added: r.added, cost_usd: r.cost_usd });
    }
  }

  await supabase.from("meta_agent_state").update({
    last_success_at: new Date().toISOString(),
    cost_month: totalCost,
    metrics: { description: "全国小規模動物イベント自動収集 (#27 v2)", last_discovery_added: totalAdded, last_discovery_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }).eq("agent_name", "events_collection");

  return { success: true, total_added: totalAdded, total_cost_usd: totalCost, total_queries: results.length, results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let prefectures: string[] | null = null;
  let categories: string[] | null = null;
  let waitMode = false;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      if (Array.isArray(body?.prefectures)) prefectures = body.prefectures;
      if (Array.isArray(body?.categories)) categories = body.categories;
      waitMode = body?.wait === true;
    }
  } catch (_) {}

  if (waitMode) {
    const result = await runDiscovery(prefectures, categories);
    return jsonResponse(result, result.success ? 200 : 500);
  }
  EdgeRuntime.waitUntil(runDiscovery(prefectures, categories).catch(err => console.error("[discovery] background error", err)));
  return jsonResponse({ success: true, step: "accepted", async: true });
});
