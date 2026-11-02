// ============================================
// instagram-cron-handler v3 (2026/11/3)
//   v3 変更 (gpt-image-1 提供終了で 10/24 から静かに止まっていた件):
//     ① IMAGE_MODELS: 候補を順に試し、「モデルが無い」エラーなら次へ。1つが終わっても止まらない
//     ② 画像生成に失敗したら meta_agent_notifications に残す (黙って止まらない)
//     ③ 今はリール (post-video-to-instagram) の在庫が切れた日だけ cron から呼ばれる予備
//   v2 (依頼書 #143, 2026/6/12): 「一度使ったネタは二度使わない」
//     ① pickUnusedTemplate: use_count=0 かつ instagram_posts 未出現 のみ / day_of_week 広止 (A案)
//     ② 枯渇ガード: 未使用が0 → meta_agent_notifications(critical) で King通知 + スキップ (再投稿しない)
//     ③ 同日冪等ガード: 本日(JST)に posted/scheduled があればスキップ (06-05型の多重防止)
//   v1: 朝/夜 cron から呼ばれる自動投稿 handler
// ============================================
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SNS_KILL_SWITCH = Deno.env.get("SNS_KILL_SWITCH") ?? "false";

// 上から順に試す。提供終了 (model_not_found / does not exist) なら次の候補へ
const IMAGE_MODELS = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1-mini", "gpt-image-1"];
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

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// JST の本日 00:00 を UTC ISO で返す (同日冪等ガード用)
function jstDayStartUtcIso(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

// ① 未使用テンプレ選択: use_count=0 かつ instagram_posts 未出現 (failed除く) / day_of_week 無視
// ※ use_count ドリフト(投稿後クラッシュで increment 未実行)に備え instagram_posts と両方で判定
async function pickUnusedTemplate(supabase: any, timeSlot: "morning" | "evening") {
  const { data: usedRows } = await supabase
    .from("instagram_posts").select("template_id").neq("status", "failed");
  const usedIds = new Set((usedRows || []).map((r: any) => r.template_id).filter(Boolean));

  const { data: templates } = await supabase
    .from("instagram_post_templates")
    .select("id, theme, caption_template, hashtags, variables, image_prompt, use_count")
    .eq("is_active", true)
    .eq("time_slot", timeSlot);

  const unused = (templates || []).filter(
    (t: any) => (Number(t.use_count) || 0) === 0 && !usedIds.has(t.id)
  );
  if (unused.length === 0) return null;
  return unused[Math.floor(Math.random() * unused.length)];
}

function isModelGone(status: number, data: any): boolean {
  const code = String(data?.error?.code ?? "");
  const msg = String(data?.error?.message ?? "").toLowerCase();
  return status === 404 || code === "model_not_found" || msg.includes("does not exist") ||
    (msg.includes("model") && (msg.includes("not found") || msg.includes("invalid")));
}

async function generateAndUploadImage(
  supabase: any, prompt: string, theme: string,
): Promise<{ url: string | null; error: string | null; cost: number; model: string | null }> {
  const tried: string[] = [];
  try {
    let imgData: any = null;
    let model: string | null = null;
    for (const m of IMAGE_MODELS) {
      const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: m,
          prompt: `${prompt} Style: warm, soft pastel, Japanese illustration, high quality, no text overlay.`,
          size: IMAGE_SIZE,
          quality: IMAGE_QUALITY,
          n: 1,
        }),
      });
      const data = await imgRes.json().catch(() => ({}));
      if (imgRes.ok && (data?.data?.[0]?.b64_json || data?.data?.[0]?.url)) {
        imgData = data; model = m; break;
      }
      tried.push(`${m}: ${JSON.stringify(data).slice(0, 160)}`);
      if (!isModelGone(imgRes.status, data)) break; // モデル以外の失敗 (中身の審査など) は次に回さない
    }
    if (!imgData) {
      return { url: null, error: tried.join(" | ").slice(0, 600), cost: 0, model: null };
    }
    const b64 = imgData.data[0].b64_json;
    const dalleUrl = imgData.data[0].url;
    let imgBlob: Blob;
    if (b64) {
      imgBlob = new Blob([base64ToUint8Array(b64)], { type: "image/png" });
    } else {
      imgBlob = await (await fetch(dalleUrl)).blob();
    }
    const safeTheme = (theme || "general").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 24);
    const filePath = `auto-instagram/${Date.now()}-${safeTheme}.png`;
    const { error: upErr } = await supabase.storage
      .from("x-images")
      .upload(filePath, imgBlob, { contentType: "image/png", upsert: true });
    if (upErr) return { url: null, error: `upload_failed: ${upErr.message}`, cost: 0.04, model };
    const { data: urlData } = supabase.storage.from("x-images").getPublicUrl(filePath);
    return { url: urlData.publicUrl, error: null, cost: 0.04, model };
  } catch (e: any) {
    return { url: null, error: e?.message || String(e), cost: 0, model: null };
  }
}

function renderCaption(t: string, hashtags: string[] | null, vars: any): string {
  let body = t || "";
  if (vars && typeof vars === "object") {
    Object.entries(vars).forEach(([k, v]) => {
      body = body.replace(new RegExp(`{${k}}`, "g"), String(v));
    });
  }
  const tagsLine = Array.isArray(hashtags) && hashtags.length > 0
    ? "\n\n" + hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")
    : "";
  return `${body}${tagsLine}`.slice(0, 2200);
}

async function runJob(timeSlot: "morning" | "evening", testMode: boolean): Promise<any> {
  const startedAt = new Date().toISOString();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: settings } = await supabase
    .from("instagram_post_settings")
    .select("kill_switch")
    .eq("id", 1)
    .maybeSingle();
  if (settings?.kill_switch || SNS_KILL_SWITCH === "true") {
    return { success: false, step: "kill_switch", started_at: startedAt };
  }

  // ③ 同日冪等ガード (本日 JST に posted/scheduled があれば多重投稿を防ぐ)
  if (!testMode) {
    const dayStart = jstDayStartUtcIso();
    const { data: todays } = await supabase
      .from("instagram_posts").select("id, status").gte("created_at", dayStart);
    const alreadyToday = (todays || []).some(
      (p: any) => p.status === "posted" || p.status === "scheduled"
    );
    if (alreadyToday) {
      return { success: false, step: "already_posted_today", skipped: true, started_at: startedAt };
    }
  }

  // ① 未使用テンプレのみ選択
  const template = await pickUnusedTemplate(supabase, timeSlot);

  // ② 枯渇ガード: 未使用が0 → Kingに critical 通知 + スキップ (「二度使わない」原則を守り再投稿しない)
  if (!template) {
    if (!testMode) {
      await supabase.from("meta_agent_notifications").insert({
        agent_name: "instagram_auto_post",
        notification_type: "template_depleted",
        title: "⚠️ Instagram 未使用テンプレ枯渇 — 自動投稿スキップ中",
        body: "instagram_post_templates の未使用(use_count=0)テンプレが0です。新規ネタを追加するまで Instagram 自動投稿はスキップされます（同じネタの再投稿はしません）。",
        severity: "critical",
      });
    }
    return { success: false, step: "no_unused_template", depleted: true, alerted: !testMode, started_at: startedAt };
  }

  const img = await generateAndUploadImage(supabase, template.image_prompt, template.theme);
  if (!img.url) {
    if (!testMode) {
      await supabase.from("meta_agent_notifications").insert({
        agent_name: "instagram_auto_post",
        notification_type: "image_generation_failed",
        title: "Instagram 画像生成に失敗 — 今日の投稿はスキップ",
        body: `候補モデル (${IMAGE_MODELS.join(", ")}) がすべて使えませんでした。IMAGE_MODELS を今あるモデルに替えてください。\n${img.error ?? ""}`.slice(0, 1000),
        severity: "critical",
      });
    }
    return { success: false, step: "image_generation", error: img.error, started_at: startedAt };
  }

  const caption = renderCaption(template.caption_template, template.hashtags, template.variables);

  const { data: igPost, error: igInsErr } = await supabase
    .from("instagram_posts")
    .insert({
      template_id: template.id,
      caption, media_url: img.url,
      status: testMode ? "test" : "scheduled",
      scheduled_at: new Date().toISOString(),
      cost_usd: img.cost,
    })
    .select()
    .single();
  if (igInsErr || !igPost) {
    return { success: false, step: "instagram_posts_insert", error: igInsErr?.message, started_at: startedAt };
  }

  if (testMode) {
    return {
      success: true, step: "test_mode_skip", started_at: startedAt,
      instagram_post_id: igPost.id, image_url: img.url, image_model: img.model,
      template_theme: template.theme,
      caption_preview: caption.slice(0, 120),
    };
  }

  let postedRes: any = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/post-to-instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption, image_url: img.url, instagram_post_id: igPost.id,
      }),
    });
    postedRes = await r.json();
  } catch (e: any) {
    await supabase.from("instagram_posts").update({
      status: "failed", error_message: `post_invoke_error: ${e?.message || String(e)}`,
    }).eq("id", igPost.id);
    return { success: false, step: "post_invoke", error: e?.message, started_at: startedAt };
  }

  if (!postedRes?.success) {
    return { success: false, step: "post_to_instagram", error: postedRes?.error, message: postedRes?.message, started_at: startedAt };
  }

  // テンプレート use_count ++ (= 今後未使用プールから外れる)
  await supabase.from("instagram_post_templates").update({
    use_count: (Number(template.use_count) || 0) + 1,
    last_used_at: new Date().toISOString(),
  }).eq("id", template.id);

  return {
    success: true, step: "complete", started_at: startedAt,
    completed_at: new Date().toISOString(),
    instagram_post_id: igPost.id,
    media_id: postedRes.media_id,
    permalink: postedRes.permalink,
    template_theme: template.theme,
    image_url: img.url, image_model: img.model,
    caption_preview: caption.slice(0, 120),
    cost_usd: img.cost,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let timeSlot: "morning" | "evening" = "morning";
  let testMode = false;
  let waitMode = false;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("wait") === "true") waitMode = true;
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      if (body?.time_slot === "evening") timeSlot = "evening";
      testMode = body?.test_mode === true;
      if (body?.wait === true) waitMode = true;
    }
  } catch (_) {}

  if (waitMode) {
    const r = await runJob(timeSlot, testMode);
    return jsonResponse(r, r.success ? 200 : 500);
  }

  EdgeRuntime.waitUntil(
    runJob(timeSlot, testMode).catch((err) => {
      console.error("[instagram-cron-handler] background error", err);
    })
  );

  return jsonResponse({
    success: true, step: "accepted", async: true, time_slot: timeSlot,
    message: "裏で 未使用テンプレ選択 → 画像生成 → 投稿 を実行中。instagram_posts で確認してください。",
    received_at: new Date().toISOString(),
  });
});
