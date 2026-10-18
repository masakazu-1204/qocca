// ============================================
// send-town-letter v2 (2026/10/18): 週 1 回の「街だより」メール
//   v2: King「おすすめの商品やブログも載せてあげたら」→ 「今週のおすすめ」(town_letter_picks で手で選べる・推薦文つき。
//       選んでない週は作家さん 1 人 1 点で 3 点を週替わり) と「街の読みもの」(直近 2 週間のブログ 2 本) を追加。
//   v2: King「1 日 100 件までなら、50 通ずつ日を空けて」→ send は 1 回 limit 通まで (既定 50・最大 100)。
//       毎朝 cron で呼べば、その週にまだ届いていない人へ順に送る (Resend の 1 日枠を注文・DM 通知のために残す)。
//   King「2で進めて。街だよりにお題も入れといてあげたら」。
//   中身: 今週のお題 (目玉) / 先週の街のようす / 今週の商店街から 2 点 / 近くのイベント 3 件 / その人の招待リンク。
//   末尾に配信停止リンク (https://www.qocca.pet/unsubscribe?t=<token>) と送信者情報 (特定電子メール法)。
//
//   呼び出し (どれも x-town-letter-key ヘッダ必須。合言葉は private.internal_secrets):
//     {mode:"preview"}            … 送らない。見本の件名・HTML・宛先数を返す (個人情報は入れない)
//     {mode:"test", to:"a@b.c"}   … 見本を 1 通だけ送る
//     {mode:"send", limit?:50}    … 今週まだ届いていない人へ limit 通まで。同じ週に 2 度は送らない (town_letter_sends)
//   ⚠️ 毎週の自動送信 (cron) は King が初回の文面を確認してから登録する。
// ============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM_EMAIL = "Qocca <noreply@qocca.pet>";
const SITE = "https://www.qocca.pet";
const BATCH = 50;
const DAILY_LIMIT = 50; // 1 回 (= 1 日) に送る上限。残りは翌朝の cron が送る

// 静けさの色 (CLAUDE.md の QC トークン)
const K = {
  bg: "#FAF7F2", card: "#F5EFE6", line: "#EEE6D9", text: "#2C2926",
  sub: "#6B6259", title: "#8B6F5C", cta: "#C97B5F",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// JST の今週の月曜 (YYYY-MM-DD)
function jstWeekStart(): string {
  const jst = new Date(Date.now() + 9 * 3600 * 1000);
  const dow = jst.getUTCDay();               // 0=日
  const diff = dow === 0 ? 6 : dow - 1;      // 月曜まで戻る
  jst.setUTCDate(jst.getUTCDate() - diff);
  return jst.toISOString().slice(0, 10);
}
const jstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const mdJa = (d: string) => { const [, m, dd] = d.split("-"); return `${Number(m)}月${Number(dd)}日`; };

type Content = {
  week: string;
  theme: { title: string; body: string } | null;
  themePhotos: number;
  newResidents: number;
  weekPhotos: { url: string }[];
  weekPhotoCount: number;
  listings: { id: string; title: string; price: number; image: string | null; seller: string; note: string | null }[];
  blogs: { id: string; title: string; image: string | null; desc: string }[];
  events: { title: string; date: string; pref: string }[];
};

async function loadContent(sb: any, week: string): Promise<Content> {
  const today = jstToday();
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const in14 = new Date(Date.now() + (9 + 14 * 24) * 3600 * 1000).toISOString().slice(0, 10);

  const { data: th } = await sb.from("weekly_themes").select("id, title, body")
    .eq("is_active", true).lte("week_start", today).order("week_start", { ascending: false }).limit(1).maybeSingle();

  const [themeCnt, residents, photos, listingsRes, eventsRes, picksRes, blogsRes] = await Promise.all([
    th ? sb.from("gallery_posts").select("id", { count: "exact", head: true }).eq("theme_id", th.id).eq("is_deleted", false)
       : Promise.resolve({ count: 0 }),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    sb.from("gallery_posts").select("image_url", { count: "exact" })
      .eq("is_deleted", false).eq("is_official", false).gte("created_at", weekAgo)
      .order("created_at", { ascending: false }).limit(3),
    sb.from("listings").select("id, title, price, image_urls, seller_id").eq("status", "approved").limit(300),
    sb.from("events").select("title, event_date, prefecture").eq("status", "approved")
      .gte("event_date", today).lte("event_date", in14).order("event_date", { ascending: true }).limit(3),
    sb.from("town_letter_picks").select("item_id, note, sort").eq("week_start", week).eq("kind", "listing").order("sort", { ascending: true }),
    sb.from("blog_posts").select("id, title, cover_image_url, hero_image_url, meta_description")
      .eq("published", true).eq("is_deleted", false).gte("created_at", new Date(Date.now() - 14 * 86400 * 1000).toISOString())
      .order("created_at", { ascending: false }).limit(2),
  ]);

  // 今週のおすすめ: town_letter_picks に手で選んだものがあればそれ (推薦文つき)。
  //   無い週は、作家さんが偏らないよう 1 人 1 点ずつ、週の文字列で決まる並びで 3 点 (同じ週は全員同じ)。
  const all = (listingsRes.data ?? []) as any[];
  const byId = new Map(all.map((l) => [l.id, l]));
  const picks = ((picksRes as any).data ?? []) as { item_id: string; note: string | null }[];
  const score = (id: string) => { let h = 0; for (const ch of id + week) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  let picked: { l: any; note: string | null }[] = picks.filter((p) => byId.has(p.item_id)).slice(0, 3)
    .map((p) => ({ l: byId.get(p.item_id), note: p.note }));
  if (picked.length === 0) {
    const sellers = new Set<string>();
    picked = [...all].sort((a, b) => score(a.id) - score(b.id))
      .filter((l) => { if (sellers.has(l.seller_id)) return false; sellers.add(l.seller_id); return true; })
      .slice(0, 3).map((l) => ({ l, note: null }));
  }
  const sellerIds = [...new Set(picked.map((p) => p.l.seller_id))];
  const { data: sellerRows } = sellerIds.length
    ? await sb.from("profiles").select("id, display_name").in("id", sellerIds)
    : { data: [] };
  const sellerName = new Map(((sellerRows ?? []) as any[]).map((r) => [r.id, r.display_name ?? ""]));

  return {
    week,
    theme: th ? { title: th.title, body: th.body } : null,
    themePhotos: (themeCnt as any).count ?? 0,
    newResidents: (residents as any).count ?? 0,
    weekPhotos: ((photos as any).data ?? []).map((p: any) => ({ url: p.image_url })),
    weekPhotoCount: (photos as any).count ?? 0,
    listings: picked.map(({ l, note }) => ({
      id: l.id, title: l.title, price: l.price, image: (l.image_urls ?? [])[0] ?? null,
      seller: String(sellerName.get(l.seller_id) ?? ""), note,
    })),
    blogs: (((blogsRes as any).data ?? []) as any[]).map((b) => ({
      id: b.id, title: b.title, image: b.cover_image_url ?? b.hero_image_url ?? null,
      desc: String(b.meta_description ?? "").slice(0, 80),
    })),
    events: ((eventsRes as any).data ?? []).map((e: any) => ({ title: e.title, date: e.event_date, pref: e.prefecture ?? "" })),
  };
}

function render(c: Content, name: string, inviteCode: string | null, token: string | null) {
  const subject = c.theme ? `街だより｜今週のお題「${c.theme.title}」` : "街だより｜今週の Qocca";
  const unsub = token ? `${SITE}/unsubscribe?t=${token}` : `${SITE}/unsubscribe`;
  const font = `'Zen Kaku Gothic New','Hiragino Sans','Noto Sans JP',sans-serif`;
  const h = (en: string, ja: string) =>
    `<p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:${K.sub};">${en}</p>` +
    `<p style="margin:0 0 14px;font-size:17px;font-weight:500;color:${K.title};line-height:1.7;">${ja}</p>`;
  const btn = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;padding:12px 28px;border:1px solid ${K.cta};color:${K.cta};text-decoration:none;font-size:14px;letter-spacing:1px;">${label}</a>`;
  const section = (inner: string) =>
    `<tr><td style="padding:36px 28px;border-top:1px solid ${K.line};">${inner}</td></tr>`;

  let body = "";
  // 今週のお題 (目玉)
  if (c.theme) {
    body += section(
      h("THIS WEEK", `今週のお題「${esc(c.theme.title)}」`) +
      (c.theme.body ? `<p style="margin:0 0 20px;font-size:14px;color:${K.sub};line-height:2;">${esc(c.theme.body)}</p>` : "") +
      `<p style="margin:0 0 22px;font-size:13px;color:${K.sub};line-height:1.9;">上手な写真じゃなくて大丈夫です。その家でしか見られない一枚を。<br>投稿すると あしあと 3 が届きます。</p>` +
      btn(`${SITE}/gallery?theme=1`, "一枚、置きに行く") +
      `<p style="margin:16px 0 0;font-size:12px;color:${K.sub};">${c.themePhotos > 0 ? `今週はすでに ${c.themePhotos} 枚が集まっています。` : "最初の一枚を、待っています。"}</p>`,
    );
  }
  // 先週の街のようす
  {
    const lines: string[] = [];
    if (c.newResidents > 0) lines.push(`この一週間で、${c.newResidents} 人が新しく住民になりました。`);
    if (c.weekPhotoCount > 0) lines.push(`街のアルバムに、${c.weekPhotoCount} 枚の写真が置かれました。`);
    if (lines.length === 0) lines.push("静かな一週間でした。街は、あなたの一枚を待っています。");
    const imgs = c.weekPhotos.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>${c.weekPhotos.map((p) =>
          `<td style="padding-right:6px;"><img src="${esc(p.url)}" width="120" height="120" alt="" style="display:block;width:120px;height:120px;object-fit:cover;"></td>`).join("")}</tr></table>`
      : "";
    body += section(h("THE TOWN", "先週の街") +
      `<p style="margin:0;font-size:14px;color:${K.text};line-height:2;">${lines.map(esc).join("<br>")}</p>` + imgs);
  }
  // 今週のおすすめ (商店街から)
  if (c.listings.length > 0) {
    body += section(h("ATELIER", "今週のおすすめ") + c.listings.map((l) =>
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%;"><tr>` +
      (l.image ? `<td width="88" style="vertical-align:top;"><a href="${SITE}/listing/${l.id}"><img src="${esc(l.image)}" width="80" height="80" alt="" style="display:block;width:80px;height:80px;object-fit:cover;"></a></td>` : "") +
      `<td style="vertical-align:top;"><a href="${SITE}/listing/${l.id}" style="color:${K.text};text-decoration:none;font-size:14px;line-height:1.7;">${esc(l.title)}</a>` +
      `<p style="margin:4px 0 0;font-size:12px;color:${K.sub};">${l.seller ? `${esc(l.seller)} さん　` : ""}${Number(l.price).toLocaleString("ja-JP")} 円</p>` +
      (l.note ? `<p style="margin:6px 0 0;font-size:13px;color:${K.text};line-height:1.8;">${esc(l.note)}</p>` : "") +
      `</td></tr></table>`).join("") +
      `<p style="margin:4px 0 0;font-size:13px;"><a href="${SITE}/marketplace" style="color:${K.cta};">商店街を歩く</a></p>`);
  }
  // 街の読みもの (ブログ)
  if (c.blogs.length > 0) {
    body += section(h("READING", "街の読みもの") + c.blogs.map((b) =>
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;width:100%;"><tr>` +
      (b.image ? `<td width="128" style="vertical-align:top;"><a href="${SITE}/blog/${b.id}"><img src="${esc(b.image)}" width="120" height="80" alt="" style="display:block;width:120px;height:80px;object-fit:cover;"></a></td>` : "") +
      `<td style="vertical-align:top;"><a href="${SITE}/blog/${b.id}" style="color:${K.text};text-decoration:none;font-size:14px;line-height:1.7;">${esc(b.title)}</a>` +
      (b.desc ? `<p style="margin:4px 0 0;font-size:12px;color:${K.sub};line-height:1.8;">${esc(b.desc)}</p>` : "") +
      `</td></tr></table>`).join("") +
      `<p style="margin:4px 0 0;font-size:13px;"><a href="${SITE}/blog" style="color:${K.cta};">ほかの読みものを見る</a></p>`);
  }
  // 近くのイベント
  if (c.events.length > 0) {
    body += section(h("EVENTS", "これからのイベント") +
      c.events.map((e) => `<p style="margin:0 0 10px;font-size:14px;color:${K.text};line-height:1.8;">${mdJa(e.date)}　${esc(e.title)}${e.pref ? `<span style="color:${K.sub};">（${esc(e.pref)}）</span>` : ""}</p>`).join("") +
      `<p style="margin:8px 0 0;font-size:13px;"><a href="${SITE}/events" style="color:${K.cta};">ほかのイベントを見る</a></p>`);
  }
  // 招待
  {
    const link = inviteCode ? `${SITE}/welcome/r/${inviteCode}` : `${SITE}/mypage`;
    body += section(h("INVITE", "この街を、友達にも。") +
      `<p style="margin:0 0 14px;font-size:13px;color:${K.sub};line-height:1.9;">あなたのリンクから来た人が住民になると、あなたに あしあと 5 が届きます。</p>` +
      `<p style="margin:0;font-size:13px;word-break:break-all;"><a href="${link}" style="color:${K.cta};">${link}</a></p>`);
  }

  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${K.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${K.bg};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${K.bg};font-family:${font};color:${K.text};">
<tr><td style="padding:12px 28px 28px;">
  <p style="margin:0;font-family:'Instrument Serif',Georgia,serif;font-size:26px;color:${K.title};letter-spacing:1px;">Qocca</p>
  <p style="margin:6px 0 0;font-size:11px;letter-spacing:3px;color:${K.sub};">街だより　${mdJa(c.week)}の週</p>
</td></tr>
<tr><td style="padding:0 28px 32px;font-size:14px;line-height:2;color:${K.text};">${esc(name)} さん<br>今週も、うちの子と元気にお過ごしですか。<br>Qocca の街から、今週のお知らせです。</td></tr>
${body}
<tr><td style="padding:36px 28px 12px;border-top:1px solid ${K.line};font-size:11px;line-height:1.9;color:${K.sub};">
  このメールは、Qocca に住民登録している方へお送りしています。<br>
  受け取りをやめる場合は <a href="${unsub}" style="color:${K.sub};">配信停止</a> から。1 回押すだけで止まります。<br><br>
  発行: Qocca（クオッカ）　運営者・所在地は <a href="${SITE}/tokusho" style="color:${K.sub};">特定商取引法に基づく表記</a> をご覧ください。<br>
  お問い合わせ: <a href="mailto:support@qocca.pet" style="color:${K.sub};">support@qocca.pet</a>
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, unsub };
}

async function sendBatch(items: { to: string; subject: string; html: string; unsub: string }[]) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify(items.map((i) => ({
      from: FROM_EMAIL, to: [i.to], subject: i.subject, html: i.html, reply_to: "support@qocca.pet",
      headers: { "List-Unsubscribe": `<${i.unsub}>, <mailto:support@qocca.pet?subject=unsubscribe>` },
    }))),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const key = req.headers.get("x-town-letter-key") ?? "";
  const { data: okKey } = await sb.rpc("check_town_letter_key", { p_key: key });
  if (okKey !== true) return json({ error: "forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const mode = String(body?.mode ?? "preview");
  const week = jstWeekStart();
  const content = await loadContent(sb, week);

  if (mode === "preview") {
    const { data: rcpt } = await sb.rpc("town_letter_recipients", { p_week: week });
    const r = render(content, "〇〇", "xxxxxxxxxxxx", null);
    return json({ mode, week, subject: r.subject, recipients: (rcpt ?? []).length, content, html: r.html });
  }

  if (mode === "test") {
    const to = String(body?.to ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "to_invalid" }, 400);
    const r = render(content, "〇〇", "xxxxxxxxxxxx", null);
    const out = await sendBatch([{ to, subject: `【見本】${r.subject}`, html: r.html, unsub: r.unsub }]);
    return json({ mode, week, ok: out.ok, status: out.status, resend: out.data });
  }

  if (mode !== "send") return json({ error: "mode_invalid" }, 400);
  if (!content.theme) return json({ mode, week, skipped: "no_theme_this_week" });

  const { data: rcpt, error: rErr } = await sb.rpc("town_letter_recipients", { p_week: week });
  if (rErr) return json({ error: "recipients_failed", detail: rErr.message }, 500);
  const all = (rcpt ?? []) as { user_id: string; email: string; display_name: string; token: string }[];
  const limit = Math.max(1, Math.min(100, Math.floor(Number(body?.limit ?? DAILY_LIMIT)) || DAILY_LIMIT));
  const list = all.slice(0, limit);

  let sent = 0, failed = 0; const errors: string[] = [];
  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    const items = chunk.map((u) => {
      const r = render(content, u.display_name, u.user_id.replace(/-/g, "").slice(0, 12), u.token);
      return { to: u.email, subject: r.subject, html: r.html, unsub: r.unsub };
    });
    const out = await sendBatch(items);
    const ids: any[] = Array.isArray(out.data?.data) ? out.data.data : [];
    const rows = chunk.map((u, j) => ({
      week_start: week, user_id: u.user_id,
      status: out.ok ? "sent" : "failed",
      resend_id: out.ok ? (ids[j]?.id ?? null) : null,
      error: out.ok ? null : JSON.stringify(out.data).slice(0, 400),
    }));
    await sb.from("town_letter_sends").upsert(rows, { onConflict: "week_start,user_id" });
    if (out.ok) sent += chunk.length; else { failed += chunk.length; errors.push(`${out.status}: ${JSON.stringify(out.data).slice(0, 200)}`); break; }
    await new Promise((r) => setTimeout(r, 700)); // Resend の秒間上限に当たらないように
  }
  return json({ mode, week, waiting: all.length, attempted: list.length, sent, failed, remaining: all.length - sent, errors });
});
