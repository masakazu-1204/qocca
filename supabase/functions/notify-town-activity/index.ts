// ============================================
// notify-town-activity v1 (2026/10/28): 投稿したら返事が届く街に
//   King「投稿と出品を増やす案」→ A。住民の写真 3 件に付いた いいね は合わせて 1・コメント 0 だった。
//   投稿しても何も返ってこないので 2 回目が無い。
//
//   1. 運営あて: 住民が写真・口コミ・出品・うちの子を置いたら support@qocca.pet (→ King) に 1 通にまとめて知らせる。
//      King か 運営事務局 が 24 時間以内に いいね と一言を返す。30 分に 1 通まで。
//   2. 住民あて: 自分の写真に いいね / コメント / 返信 が付いたら知らせる。1 人 6 時間に 1 通まで。
//      街だよりを止めている人には送らない (town_letter_prefs.unsubscribed_at)。
//   何を知らせるかは DB の town_activity_owner_pending() / town_activity_admin_pending() が決める。
//   知らせたものは town_activity_notices に入れ、2 度は知らせない。
//
//   呼び出し: cron town-activity-notify (10 分ごと)。ヘッダ x-town-letter-key 必須 (街だよりと同じ合言葉)。
//     {}               … 送る
//     {dry_run: true}  … 送らずに、送る予定の件数だけ返す
//   Resend の 1 日 100 通は 街だより・注文・DM 通知と共有。1 回の呼び出しで住民あては 20 通まで。
// ============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM_EMAIL = "Qocca <noreply@qocca.pet>";
const ADMIN_TO = "support@qocca.pet";
const SITE = "https://www.qocca.pet";
const MAX_OWNER_MAILS = 20;
const ADMIN_EVERY_MIN = 30;

const K = { bg: "#FAF7F2", card: "#F5EFE6", line: "#EEE6D9", text: "#2C2926", sub: "#6B6259", title: "#8B6F5C", cta: "#C97B5F" };
const FONT = `'Zen Kaku Gothic New','Hiragino Sans','Noto Sans JP',sans-serif`;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const cut = (s: unknown, n: number) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };

type OwnerItem = {
  kind: "like" | "comment" | "reply"; ref_id: string; recipient: string; email: string; display_name: string; token: string;
  actor_name: string; post_id: string; post_image: string | null; post_caption: string | null; content: string | null; created_at: string;
};
type AdminItem = {
  kind: "admin_post" | "admin_review" | "admin_listing" | "admin_pet"; ref_id: string; actor_name: string;
  title: string | null; detail: string | null; image: string | null; link: string | null; first_time: boolean; created_at: string;
};

function frame(title: string, inner: string, footer: string) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${K.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${K.bg};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${K.bg};font-family:${FONT};color:${K.text};">
<tr><td style="padding:12px 28px 24px;"><p style="margin:0;font-family:'Instrument Serif',Georgia,serif;font-size:26px;color:${K.title};letter-spacing:1px;">Qocca</p></td></tr>
${inner}
<tr><td style="padding:32px 28px 12px;border-top:1px solid ${K.line};font-size:11px;line-height:1.9;color:${K.sub};">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

// 住民あて: 1 人ぶんの いいね / コメント / 返信 をまとめた 1 通
function renderOwner(items: OwnerItem[]) {
  const u = items[0];
  const likes = items.filter((i) => i.kind === "like");
  const words = items.filter((i) => i.kind !== "like");
  const names = (xs: OwnerItem[]) => {
    const n = [...new Set(xs.map((x) => x.actor_name))];
    return n.length <= 2 ? n.map((x) => `${x} さん`).join("と") : `${n.slice(0, 2).map((x) => `${x} さん`).join("、")}ほか ${n.length - 2} 人`;
  };
  const subject = words.length > 0
    ? `${words[0].actor_name} さんから、ひとこと届いています`
    : `${names(likes)}が、あなたの写真に いいね しました`;

  const posts = [...new Map(items.map((i) => [i.post_id, i])).values()];
  let inner = `<tr><td style="padding:0 28px 28px;font-size:14px;line-height:2;color:${K.text};">${esc(u.display_name)} さん<br>街のアルバムに置いた写真に、反応が届いています。</td></tr>`;
  for (const p of posts) {
    const pl = likes.filter((i) => i.post_id === p.post_id);
    const pw = words.filter((i) => i.post_id === p.post_id);
    const link = `${SITE}/gallery/${p.post_id}`;
    inner += `<tr><td style="padding:24px 28px;border-top:1px solid ${K.line};">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
${p.post_image ? `<td width="104" style="vertical-align:top;"><a href="${link}"><img src="${esc(p.post_image)}" width="96" height="96" alt="" style="display:block;width:96px;height:96px;object-fit:cover;"></a></td>` : ""}
<td style="vertical-align:top;">
${p.post_caption ? `<p style="margin:0 0 10px;font-size:12px;color:${K.sub};line-height:1.8;">${esc(cut(p.post_caption, 40))}</p>` : ""}
${pl.length ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.8;">${esc(names(pl))}が いいね しました。</p>` : ""}
${pw.map((w) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.8;">${esc(w.actor_name)} さん${w.kind === "reply" ? "（あなたのコメントへの返信）" : ""}<br><span style="color:${K.sub};">「${esc(cut(w.content, 80))}」</span></p>`).join("")}
<p style="margin:12px 0 0;font-size:13px;"><a href="${link}" style="color:${K.cta};">写真を見に行く</a></p>
</td></tr></table></td></tr>`;
  }
  inner += `<tr><td style="padding:24px 28px 8px;font-size:13px;line-height:2;color:${K.sub};">また一枚、置きに来てください。<br><a href="${SITE}/gallery?theme=1&compose=1" style="color:${K.cta};">今週のお題で一枚</a></td></tr>`;
  const unsub = `${SITE}/unsubscribe?t=${u.token}`;
  const footer = `このメールは、あなたの写真に反応があったときにお送りしています (6 時間に 1 通まで)。<br>
止める場合は <a href="${unsub}" style="color:${K.sub};">配信停止</a> から。街だよりと一緒に止まります。<br><br>
発行: Qocca（クオッカ）　<a href="${SITE}/tokusho" style="color:${K.sub};">特定商取引法に基づく表記</a>　お問い合わせ: <a href="mailto:support@qocca.pet" style="color:${K.sub};">support@qocca.pet</a>`;
  return { subject, html: frame(subject, inner, footer), unsub };
}

const ADMIN_LABEL: Record<AdminItem["kind"], string> = {
  admin_post: "写真", admin_review: "口コミ (ペットウォーカー)", admin_listing: "出品", admin_pet: "うちの子の登録",
};

// 運営あて: 住民が置いたもの一覧。返事の仕方も添える
function renderAdmin(items: AdminItem[]) {
  const posts = items.filter((i) => i.kind === "admin_post").length;
  const subject = `街に ${items.length} 件、住民が置いていきました${posts ? `（写真 ${posts}）` : ""}`;
  let inner = `<tr><td style="padding:0 28px 20px;font-size:14px;line-height:2;">King へ。<br>写真には いいね と一言を、24 時間以内に返してあげてください。返事が届くと、2 枚目が置かれやすくなります。</td></tr>`;
  for (const i of items) {
    inner += `<tr><td style="padding:20px 28px;border-top:1px solid ${K.line};">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
${i.image ? `<td width="88" style="vertical-align:top;"><img src="${esc(i.image)}" width="80" height="80" alt="" style="display:block;width:80px;height:80px;object-fit:cover;"></td>` : ""}
<td style="vertical-align:top;font-size:14px;line-height:1.8;">
<p style="margin:0;font-size:11px;letter-spacing:1px;color:${K.sub};">${esc(ADMIN_LABEL[i.kind])}${i.first_time ? "　はじめて" : ""}</p>
<p style="margin:2px 0 0;">${esc(i.actor_name)} さん${i.title ? `　${esc(cut(i.title, 50))}` : ""}</p>
${i.detail ? `<p style="margin:2px 0 0;font-size:12px;color:${K.sub};">${esc(cut(i.detail, 140))}</p>` : ""}
${i.link ? `<p style="margin:8px 0 0;font-size:13px;"><a href="${esc(i.link)}" style="color:${K.cta};">${i.kind === "admin_post" ? "開いて返事をする" : "開く"}</a></p>` : ""}
</td></tr></table></td></tr>`;
  }
  const footer = `notify-town-activity (10 分ごと・運営あては 30 分に 1 通まで) からの自動のお知らせです。`;
  return { subject, html: frame(subject, inner, footer) };
}

async function send(to: string, subject: string, html: string, unsub?: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM_EMAIL, to: [to], subject, html, reply_to: "support@qocca.pet",
      ...(unsub ? { headers: { "List-Unsubscribe": `<${unsub}>, <mailto:support@qocca.pet?subject=unsubscribe>` } } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, id: (data as any)?.id ?? null, data };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: okKey } = await sb.rpc("check_town_letter_key", { p_key: req.headers.get("x-town-letter-key") ?? "" });
  if (okKey !== true) return json({ error: "forbidden" }, 403);
  let body: any = {};
  try { body = await req.json(); } catch (_) { /* 空でよい */ }
  const dry = body?.dry_run === true;

  const out: Record<string, unknown> = {};

  // --- 運営あて ---
  const { data: adminRows, error: aErr } = await sb.rpc("town_activity_admin_pending");
  if (aErr) return json({ error: "admin_pending_failed", detail: aErr.message }, 500);
  const admin = (adminRows ?? []) as AdminItem[];
  const { data: lastAdmin } = await sb.from("town_activity_emails").select("created_at")
    .eq("kind", "admin").eq("status", "sent").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const adminWait = lastAdmin && Date.now() - new Date(lastAdmin.created_at).getTime() < ADMIN_EVERY_MIN * 60e3;
  out.admin_pending = admin.length;
  if (admin.length > 0 && !adminWait && !dry) {
    const r = renderAdmin(admin);
    const s = await send(ADMIN_TO, r.subject, r.html);
    await sb.from("town_activity_emails").insert({ kind: "admin", items: admin.length, status: s.ok ? "sent" : "failed",
      resend_id: s.id, error: s.ok ? null : JSON.stringify(s.data).slice(0, 400) });
    if (s.ok) await sb.from("town_activity_notices").upsert(admin.map((i) => ({ kind: i.kind, ref_id: i.ref_id })), { onConflict: "kind,ref_id", ignoreDuplicates: true });
    out.admin_sent = s.ok; if (!s.ok) out.admin_error = s.status;
  }

  // --- 住民あて ---
  const { data: ownerRows, error: oErr } = await sb.rpc("town_activity_owner_pending");
  if (oErr) return json({ ...out, error: "owner_pending_failed", detail: oErr.message }, 500);
  const byUser = new Map<string, OwnerItem[]>();
  for (const r of (ownerRows ?? []) as OwnerItem[]) {
    if (!byUser.has(r.recipient)) byUser.set(r.recipient, []);
    byUser.get(r.recipient)!.push(r);
  }
  out.owner_pending = byUser.size;
  if (dry) return json({ ...out, dry_run: true });

  let sent = 0, failed = 0;
  for (const [uid, items] of [...byUser.entries()].slice(0, MAX_OWNER_MAILS)) {
    // いいね してすぐ取り消した、などで 2 分以内のものだけなら次の便に回す (DM 通知と同じ猶予)
    if (items.every((i) => Date.now() - new Date(i.created_at).getTime() < 2 * 60e3)) continue;
    const r = renderOwner(items);
    const s = await send(items[0].email, r.subject, r.html, r.unsub);
    await sb.from("town_activity_emails").insert({ user_id: uid, kind: "owner", items: items.length, status: s.ok ? "sent" : "failed",
      resend_id: s.id, error: s.ok ? null : JSON.stringify(s.data).slice(0, 400) });
    if (s.ok) {
      sent++;
      await sb.from("town_activity_notices").upsert(items.map((i) => ({ kind: i.kind, ref_id: i.ref_id, recipient: uid })), { onConflict: "kind,ref_id", ignoreDuplicates: true });
    } else { failed++; if (s.status === 429) break; }
    await new Promise((res) => setTimeout(res, 600)); // Resend の秒間上限
  }
  return json({ ...out, owner_sent: sent, owner_failed: failed });
});
