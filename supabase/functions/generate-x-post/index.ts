// ============================================
// generate-x-post v2 (2026/5/27, #25 Step 2 = #16 v2 Phase 1.3)
// 変更点 v1 → v2:
//   - use_image=true && image_prompt の場合に gpt-image-1 で画像生成
//   - 生成画像を Supabase Storage x-images バケットに保存
//   - x_posts.image_url にパブリック URL を保存
//   - cost_usd 概算 (画像なし: $0.0001, 画像あり: gpt-image-1 ~$0.04)
// ============================================
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

const jsonResponse = (body: any, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);

function getJstDayOfWeek(): number {
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  return jstNow.getUTCDay();
}
const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item;
  }
  return items[items.length - 1];
}

// base64 → Uint8Array
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// gpt-image-1 で画像生成 → Storage 保存 → public URL 返却
async function generateImage(
  supabase: any,
  prompt: string,
  baseContext: string
): Promise<{ url: string; cost_usd: number; size: number } | null> {
  if (!OPENAI_API_KEY) {
    console.warn("[generate-x-post] OPENAI_API_KEY 未設定。画像生成スキップ");
    return null;
  }

  // プロンプト強化: Qocca のトーン (温かみ・パステル・住める速度)
  const enriched = `${prompt}\n\nStyle: warm pastel illustration, soft lighting, gentle and inviting atmosphere, pet-friendly community vibe, no text in image. Square format.\n\nContext: ${baseContext}`;

  let imageRes: Response;
  try {
    imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: enriched,
        n: 1,
        size: "1024x1024",
      }),
    });
  } catch (e) {
    console.error("[generate-x-post] OpenAI fetch failed:", e);
    return null;
  }

  if (!imageRes.ok) {
    const errText = await imageRes.text();
    console.error("[generate-x-post] OpenAI image error:", imageRes.status, errText.slice(0, 300));
    return null;
  }

  const imageData = await imageRes.json();
  const b64 = imageData?.data?.[0]?.b64_json;
  if (!b64) {
    console.error("[generate-x-post] OpenAI: b64_json missing");
    return null;
  }

  const bytes = b64ToBytes(b64);
  const filename = `auto-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;

  const { error: uploadErr } = await supabase.storage
    .from("x-images")
    .upload(filename, bytes, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadErr) {
    console.error("[generate-x-post] Storage upload failed:", uploadErr);
    return null;
  }

  const { data: pub } = supabase.storage.from("x-images").getPublicUrl(filename);
  // gpt-image-1 価格: 1024x1024 standard = $0.040/枚 (2025-Q1 OpenAI 公表値)
  return { url: pub.publicUrl, cost_usd: 0.040, size: bytes.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let timeSlot: "morning" | "evening" = "morning";
  let testMode = false;
  let forceImage: boolean | null = null;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      if (body?.time_slot === "evening") timeSlot = "evening";
      testMode = body?.test_mode === true;
      if (typeof body?.force_image === "boolean") forceImage = body.force_image;
    }
  } catch (_) {}

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Step 1: settings 確認 (kill_switch + use_image 設定)
  const { data: settings } = await supabase
    .from("x_post_settings")
    .select("kill_switch, morning_use_image, evening_use_image")
    .eq("id", 1)
    .single();

  if (settings?.kill_switch) {
    return jsonResponse({ success: false, error: "kill_switch_active", message: "X 自動投稿は現在一時停止中" }, 503);
  }

  const slotUseImage = timeSlot === "morning" ? !!settings?.morning_use_image : !!settings?.evening_use_image;
  const useImage = forceImage !== null ? forceImage : slotUseImage;

  // Step 2: テンプレ取得 (7日以内未使用 + DOW + slot + active)
  const dow = getJstDayOfWeek();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: templates, error: tmplErr } = await supabase
    .from("x_post_templates")
    .select("id, theme, template, weight, use_image, image_prompt, use_count, last_used_at")
    .eq("day_of_week", dow)
    .eq("time_slot", timeSlot)
    .eq("is_active", true)
    .or(`last_used_at.is.null,last_used_at.lt.${sevenDaysAgo}`);

  if (tmplErr || !templates || templates.length === 0) {
    return jsonResponse({
      success: false, error: "no_template",
      message: `今日(${WEEKDAY_JP[dow]})の${timeSlot}用テンプレが見つかりません`,
      day_of_week: dow, time_slot: timeSlot,
    }, 404);
  }

  // Step 3: weight 加重ランダム選択
  const selected = weightedRandom(templates.map((t) => ({ ...t, weight: Number(t.weight) })));

  // Step 4: 動的変数取得
  const today = new Date();
  const ddayDate = new Date("2026-06-01T00:00:00+09:00");
  const grandOpenDate = new Date("2026-07-01T00:00:00+09:00");
  const ddayDays = Math.max(0, Math.ceil((ddayDate.getTime() - today.getTime()) / (24 * 3600 * 1000)));
  const grandOpenDays = Math.max(0, Math.ceil((grandOpenDate.getTime() - today.getTime()) / (24 * 3600 * 1000)));

  const [usersRes, listingsRes, petsRes, photosRes, foundingRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("pets").select("id", { count: "exact", head: true }),
    supabase.from("pet_photos").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_founding_creator", true),
  ]);

  const vars: Record<string, string> = {
    dday_days: String(ddayDays),
    grand_open_days: String(grandOpenDays),
    total_users: String(usersRes.count ?? 0),
    total_listings: String(listingsRes.count ?? 0),
    total_pets: String(petsRes.count ?? 0),
    total_photos: String(photosRes.count ?? 0),
    founding_creators: String(foundingRes.count ?? 0),
    weekday_jp: WEEKDAY_JP[dow],
  };

  let content = selected.template;
  for (const [k, v] of Object.entries(vars)) {
    content = content.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  if (content.length > 280) content = content.slice(0, 277) + "...";

  // Step 5: 画像生成判定
  let imageUrl: string | null = null;
  let imageCost = 0;
  let imageSize = 0;
  const shouldGenerateImage = useImage && !!selected.use_image && !!selected.image_prompt;
  if (shouldGenerateImage) {
    const imgResult = await generateImage(supabase, selected.image_prompt, `${selected.theme} / ${timeSlot} / ${WEEKDAY_JP[dow]}曜`);
    if (imgResult) {
      imageUrl = imgResult.url;
      imageCost = imgResult.cost_usd;
      imageSize = imgResult.size;
    }
    // 画像生成失敗してもテキストのみで継続 (フォールバック)
  }

  // Step 6: x_posts に scheduled INSERT
  const scheduledAt = new Date().toISOString();
  const { data: newPost, error: insErr } = await supabase
    .from("x_posts")
    .insert({
      template_id: selected.id,
      content,
      image_url: imageUrl,
      status: "scheduled",
      scheduled_at: scheduledAt,
      cost_usd: imageCost > 0 ? imageCost : null,
    })
    .select()
    .single();

  if (insErr || !newPost) {
    return jsonResponse({ success: false, error: "db_insert_error", message: insErr?.message }, 500);
  }

  // Step 7: テンプレ use_count + last_used_at 更新
  await supabase
    .from("x_post_templates")
    .update({ use_count: (selected.use_count || 0) + 1, last_used_at: scheduledAt })
    .eq("id", selected.id);

  return jsonResponse({
    success: true,
    test_mode: testMode,
    x_post_id: newPost.id,
    template_id: selected.id,
    theme: selected.theme,
    day_of_week: dow,
    weekday_jp: WEEKDAY_JP[dow],
    time_slot: timeSlot,
    content,
    content_length: content.length,
    image_url: imageUrl,
    image_generated: !!imageUrl,
    image_attempted: shouldGenerateImage,
    image_cost_usd: imageCost,
    image_size_bytes: imageSize,
    variables_used: vars,
    scheduled_at: scheduledAt,
  });
});
