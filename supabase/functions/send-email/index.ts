// ============================================
// send-email v44 (2026/11/4): メールの見た目と文面を静けさへ (旧オレンジ・絵文字・太字をやめ、街だよりと同じ部品に)
// send-email v43 (2026/10/18): 呼べる人を絞る + 差し込み値を HTML エスケープ
//   v42 までは誰でも認証なしで呼べ、to も自由・data もそのまま HTML に入っていた
//   (= Qocca 名義の偽メールを誰にでも送れた)。
//
//   呼べるのは次の 2 種類だけ:
//   1) 内部 (信頼できる呼び出し)  … どちらか
//        - x-send-email-key ヘッダ = private.internal_secrets の 'send_email' (RPC check_send_email_key で照合)
//          → DB の send_welcome_email (登録時トリガ) / notify_unread_dms (cron dm-email-notify)
//        - Authorization: Bearer <service_role key>
//          → stripe-webhook / auto-complete-orders / retry-pending-payouts
//      全テンプレ可。宛先は to (自由) か user_id / seller_id。
//   2) ログイン中の住民 (Authorization: Bearer <ユーザーの JWT>)
//        - delivery_notice だけ。to は使えない。
//        - 宛先と本文は DB から作る: 自分が出品者で、15 分以内に「納品済み」にした注文の購入者へ。
//          (order_id 指定。無ければ user_id = 購入者 で直近の 1 件を探す = 旧フロントのまま動く)
//        - 送った宛先のメールアドレスは返さない。
//   それ以外 (anon key・認証なし) は 401。
//
//   verify_jwt=false のまま: 登録トリガと cron は pg_net から JWT なしで呼ぶため。
//   認証はこの関数の中で毎回やる。
// ============================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FROM_EMAIL = "Qocca <noreply@qocca.pet>";
const SITE_URL = "https://qocca.pet";

// ログイン中の住民が送れるテンプレ (今は納品通知だけ)
const USER_TEMPLATES = new Set(["delivery_notice"]);
// 納品通知は「納品済みにしてから 15 分以内」の注文にだけ送れる
const DELIVERY_WINDOW_MS = 15 * 60 * 1000;

// リンクとして差し込むキー。Qocca のドメイン以外は捨てて SITE_URL にする
const URL_KEYS = new Set(["listing_url", "order_url", "messages_url", "review_url", "ticket_url", "dispute_url"]);
const ALLOWED_LINK_HOSTS = new Set(["qocca.pet", "www.qocca.pet"]);

const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// 件名用: 改行・制御文字を消して 200 文字まで
// deno-lint-ignore no-control-regex
const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").slice(0, 200);

function safeUrl(v: string): string | undefined {
  try {
    const u = new URL(v);
    if (u.protocol === "https:" && ALLOWED_LINK_HOSTS.has(u.hostname)) return u.toString();
  } catch (_) { /* 不正な URL は捨てる */ }
  return undefined;
}

// data を 2 つに分ける: html 用 (エスケープ済み) と 件名用 (プレーン)。
// 文字列・数値・真偽値だけ通す。オブジェクトや配列は捨てる。
function prepareData(raw: unknown): { html: Record<string, unknown>; plain: Record<string, unknown> } {
  const html: Record<string, unknown> = {};
  const plain: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { html, plain };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) {
      html[k] = v; plain[k] = v; continue;
    }
    if (typeof v !== "string") continue;
    if (URL_KEYS.has(k)) {
      const u = safeUrl(v);
      if (u) { html[k] = esc(u); plain[k] = u; }
      continue;
    }
    html[k] = esc(v);
    plain[k] = oneLine(v);
  }
  return { html, plain };
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

// 定数時間で比べる (service_role key の照合用)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── メールの見た目 (街だより・notify-town-activity と同じ静けさの部品) ──
const K = { bg: "#FAF7F2", card: "#F5EFE6", line: "#EEE6D9", text: "#2C2926", sub: "#6B6259", title: "#8B6F5C", cta: "#C97B5F", notice: "#B0654A" };
const FONT = `'Zen Kaku Gothic New','Hiragino Sans','Noto Sans JP',sans-serif`;

const para = (s: string) => `<p style="margin:0 0 18px;font-size:14px;line-height:2;color:${K.text};">${s}</p>`;
const hi = (name: unknown) => para(name ? `${name} さん` : "こんにちは。");
// 期限など、見落としてほしくない一文
const notice = (s: string) => `<p style="margin:0 0 18px;font-size:14px;line-height:2;font-weight:500;color:${K.notice};">${s}</p>`;
const box = (inner: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 24px;background:${K.card};"><tr><td style="padding:18px 20px;font-size:14px;line-height:1.9;color:${K.text};">${inner}</td></tr></table>`;
// 見出しと値の組。値が空の行は出さない
const facts = (rows: [string, unknown][]) =>
  box(rows.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) =>
    `<p style="margin:0 0 6px;"><span style="color:${K.sub};font-size:12px;">${k}</span><br>${v}</p>`).join(""));
const button = (href: unknown, label: string) =>
  `<p style="margin:26px 0 22px;"><a href="${href}" style="display:inline-block;padding:12px 28px;border:1px solid ${K.cta};color:${K.cta};text-decoration:none;font-size:14px;letter-spacing:1px;">${label}</a></p>`;
const yen = (v: unknown) => (v === undefined || v === null || v === "" ? "" : `¥${v}`);
const orBlank = (v: unknown) => (v === undefined || v === null ? "" : v);

function mail(subject: string, ...inner: string[]) {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qocca</title></head>
<body style="margin:0;padding:0;background:${K.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${K.bg};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${K.bg};font-family:${FONT};color:${K.text};">
<tr><td style="padding:12px 28px 24px;"><p style="margin:0;font-family:'Instrument Serif',Georgia,serif;font-size:26px;color:${K.title};letter-spacing:1px;">Qocca</p></td></tr>
<tr><td style="padding:0 28px 16px;">${inner.join("")}</td></tr>
<tr><td style="padding:28px 28px 12px;border-top:1px solid ${K.line};font-size:11px;line-height:1.9;color:${K.sub};">Qocca（クオッカ）　うちの子を愛してる人が集まる街。<br><a href="${SITE_URL}" style="color:${K.sub};">${SITE_URL}</a>　お問い合わせ: <a href="mailto:support@qocca.pet" style="color:${K.sub};">support@qocca.pet</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

const TEMPLATES: Record<string, (d: any, r: any) => { subject: string; html: string }> = {
  welcome: (d, r) => mail(`Qocca へようこそ。${r.user_name} さん`,
    hi(d.user_name),
    para(`Qocca に来てくださって、ありがとうございます。<br>ここは、うちの子を愛してる人が集まる街です。`),
    para(`似顔絵やお洋服、写真、手づくりのグッズ。<br>うちの子のための作品に、ゆっくり出会っていただけます。`),
    button(SITE_URL, "街を歩く"),
    para(`作品をつくる方は、出品もしていただけます。<br>最初の取引は、手数料がかかりません。`),
    para(`<a href="${SITE_URL}/sell" style="color:${K.cta};">出品について見る</a>`),
  ),
  listing_approved: (d, r) => mail(`出品が公開されました。「${r.listing_title}」`,
    hi(d.user_name),
    para(`お待たせしました。<br>ご出品いただいた「${d.listing_title}」が審査を終えて、街に並びました。`),
    facts([["タイトル", d.listing_title], ["カテゴリ", d.category], ["価格", yen(d.price)]]),
    button(d.listing_url || SITE_URL, "出品ページを見る"),
    para(`注文が入ると、メールでお知らせします。<br>素敵な作品を、ありがとうございます。`),
  ),
  listing_rejected: (d, r) => mail(`ご出品についてのご連絡です。「${r.listing_title}」`,
    hi(d.user_name),
    para(`ご出品いただいた「${d.listing_title}」について、ご連絡いたします。<br>恐れ入りますが、次の理由により、このたびは公開できませんでした。`),
    facts([["理由", d.rejection_reason || "利用規約に沿わない内容が含まれていました"]]),
    para(`内容を直して、もう一度申請していただけます。`),
    button(`${SITE_URL}/sell`, "出品を編集する"),
  ),
  order_buyer: (d, r) => mail(`ご注文ありがとうございます（注文番号 ${r.order_number}）`,
    hi(d.user_name),
    para(`このたびは、Qocca でのご注文をありがとうございます。`),
    facts([["注文番号", d.order_number], ["商品名", d.listing_title], ["出品者", d.seller_name], ["お支払い額", yen(d.price)], ["注文日", d.order_date]]),
    para(`出品者さんにご注文をお知らせしました。<br>メッセージが届いたら、必要なことをお伝えください。`),
    button(d.order_url || SITE_URL, "取引ページを開く"),
  ),
  order_seller: (d, r) => mail(`新しい注文が入りました。「${r.listing_title}」`,
    hi(d.user_name),
    para(`おめでとうございます。新しい注文が入りました。`),
    facts([["注文番号", d.order_number], ["商品名", d.listing_title], ["購入者", d.buyer_name], ["注文日", d.order_date], ["ご購入額", yen(d.price)], ["受け渡し方法", d.delivery_type_label]]),
    d.has_shipping_address
      ? box(`<p style="margin:0 0 6px;font-weight:500;">配送先の住所が登録されました</p><p style="margin:0;font-size:13px;color:${K.sub};">安全のため、住所はメールには書いていません。<br>Qocca の「取引メッセージ」からご確認ください。</p>`)
      : "",
    para(`必要なことがあれば、購入者さんにメッセージで確かめてください。<br>納期に合わせて、お届けの準備をお願いします。`),
    button(d.order_url || SITE_URL, "取引ページを開く"),
  ),
  delivery_notice: (d, r) => mail(`納品のご連絡です。ご確認をお願いします（${r.order_number}）`,
    hi(d.user_name),
    para(`${d.seller_name} さんから、納品のご連絡がありました。`),
    facts([["注文番号", d.order_number], ["商品名", d.listing_title], ["出品者", d.seller_name]]),
    para(`内容をご確認のうえ、問題がなければ「取引完了」を押してください。`),
    notice(`72 時間が経つと、自動で完了します。`),
    button(d.order_url || SITE_URL, "取引ページを開く"),
  ),
  order_complete: (d, r) => mail(`取引が完了しました（${r.order_number}）`,
    hi(d.user_name),
    para(`取引が無事に完了しました。ありがとうございます。`),
    facts([["注文番号", d.order_number], ["商品名", d.listing_title]]),
    d.is_buyer
      ? para(`よければ、感想を聞かせてください。`) + button(d.review_url || SITE_URL, "レビューを書く")
      // 呼び出し元が手数料を渡さない時は、手数料 ¥0 と誤って見せない (入金予定額だけ出す)
      : facts(d.fee === undefined
        ? [["入金予定額", `¥${d.payout_amount || d.price}`]]
        : [["売上金額", yen(d.price)], ["手数料", `¥${d.fee}`], ["入金予定額", `¥${d.payout_amount || d.price}`]]),
  ),
  cancel_notice: (d, r) => mail(`ご注文がキャンセルされました（${r.order_number}）`,
    hi(d.user_name),
    para(`ご注文のキャンセルが完了しました。`),
    facts([["注文番号", d.order_number], ["商品名", d.listing_title], ["キャンセルの理由", d.cancel_reason], ["返金額", `¥${d.refund_amount || d.price}`]]),
  ),
  refund_complete: (d, r) => mail(`返金が完了しました（${r.order_number}）`,
    hi(d.user_name),
    para(`返金の手続きが完了しました。`),
    facts([["注文番号", d.order_number], ["返金額", yen(d.refund_amount)], ["返金処理日", d.refund_date || new Date().toLocaleDateString("ja-JP")]]),
  ),
  new_message: (d, r) => mail(`${r.sender_name} さんからメッセージが届いています`,
    hi(d.user_name),
    para(`${d.sender_name} さんから、メッセージが届いています。`),
    box(d.message_preview || "メッセージが届いています"),
    button(d.messages_url || SITE_URL, "Qocca で読む"),
  ),
  review_request: (d, r) => mail(`${r.seller_name} さんの作品の感想を、聞かせてください`,
    hi(d.user_name),
    para(`先日は「${d.listing_title}」をお買い上げいただき、ありがとうございました。`),
    para(`よければ、感想を聞かせてください。`),
    button(d.review_url || SITE_URL, "レビューを書く"),
  ),
  support_reply: (d, r) => mail(`Qocca サポートからのお返事です（${r.ticket_number}）`,
    hi(d.user_name),
    para(`Qocca サポートから、お返事をお送りしました。`),
    facts([["チケット番号", d.ticket_number], ["件名", d.ticket_subject]]),
    button(d.ticket_url || SITE_URL, "お返事を読む"),
  ),
  dispute_received: (d, r) => mail(`異議申し立てを受け付けました（${r.dispute_number}）`,
    hi(d.user_name),
    para(`異議申し立てを受け付けました。ご連絡ありがとうございます。`),
    facts([["異議番号", d.dispute_number], ["対象の注文", d.order_number], ["理由", d.dispute_reason]]),
    para(`1〜3 営業日のうちに、お返事します。`),
    button(d.dispute_url || SITE_URL, "内容を確認する"),
  ),
  dispute_response_needed: (d, r) => mail(`異議のご連絡があります。24 時間以内にご回答ください（${r.dispute_number}）`,
    hi(d.user_name),
    para(`購入者さんから、異議申し立てがありました。`),
    facts([["異議番号", d.dispute_number], ["対象の注文", d.order_number], ["商品名", d.listing_title], ["申し立ての理由", d.dispute_reason]]),
    notice(`回答の期限: ${d.response_deadline || "24 時間以内"}`),
    button(d.dispute_url || SITE_URL, "異議に回答する"),
  ),
  dispute_result: (d, r) => mail(`異議の結果をご連絡します（${r.dispute_number}）`,
    hi(d.user_name),
    para(`異議申し立ての確認が終わりましたので、結果をご連絡します。`),
    facts([["異議番号", d.dispute_number], ["対象の注文", d.order_number], ["結果", d.dispute_result_text], ["理由", d.dispute_reasoning], ["今後の対応", d.next_steps]]),
    button(d.dispute_url || SITE_URL, "詳しく見る"),
  ),
  payout_requested: (d, r) => mail(`出金の申請を受け付けました（¥${r.payout_amount}）`,
    hi(d.user_name),
    para(`出金の申請を受け付けました。ありがとうございます。`),
    facts([["申請額", yen(d.payout_amount)], ["振込手数料", "¥275"], ["振込額", yen(d.final_amount)], ["振込先", `${orBlank(d.bank_name)} ${orBlank(d.bank_account)}`.trim()], ["振込予定日", d.payout_date || "3〜5 営業日以内"]]),
  ),
  payout_complete: (d, r) => mail(`出金が完了しました（¥${r.final_amount}）`,
    hi(d.user_name),
    para(`出金の手続きが完了しました。銀行口座をご確認ください。`),
    facts([["振込額", yen(d.final_amount)], ["振込先", `${orBlank(d.bank_name)} ${orBlank(d.bank_account)}`.trim()]]),
  ),
  stripe_connect_request: (d, _r) => mail(`売上を受け取るための、大切なお願いです（2〜3 分の設定）`,
    hi(d.user_name),
    para(`いつも素敵な作品を出品していただき、ありがとうございます。<br>Qocca 運営チームです。`),
    para(`${d.user_name} さんのアカウントでは、売上の受け取り口座（Stripe 連携）がまだ設定されていません。<br>このままだと、作品が購入されても、売上をお受け取りいただけません。`),
    para(`設定は 2〜3 分で終わります。`),
    box(`<p style="margin:0 0 6px;font-weight:500;">設定の手順</p><p style="margin:0;">1. Qocca（https://qocca.pet）にログイン<br>2. マイページの「売上」タブを開く<br>3. 「銀行口座を設定する」を押す<br>4. 画面の案内に沿って、口座の情報などを入力</p><p style="margin:10px 0 0;font-size:12px;color:${K.sub};">本人確認のため、身分証明書をご用意いただくとスムーズです。<br>わからないことは、マイページの「Stripe Connect 登録ガイド」もご覧ください。</p>`),
    button(`${SITE_URL}/mypage`, "売上タブを開く"),
    para(`注文が入る前に済ませていただけると、安心して販売を始められます。`),
    para(`うまくいかないところがあれば、このメールへの返信や Qocca 公式 SNS の DM で、いつでもお知らせください。`),
    para(`これからも、どうぞよろしくお願いします。<br>Qocca 運営チーム`),
  ),
};

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...CORS } });

type Caller = { kind: "service" } | { kind: "user"; id: string };

async function identify(req: Request, admin: any): Promise<Caller | null> {
  const key = req.headers.get("x-send-email-key") ?? "";
  if (key) {
    const { data: ok } = await admin.rpc("check_send_email_key", { p_key: key });
    if (ok === true) return { kind: "service" };
  }
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (SUPABASE_SERVICE_KEY && safeEqual(token, SUPABASE_SERVICE_KEY)) return { kind: "service" };
  // anon key や期限切れの JWT はここで弾かれる
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { kind: "user", id: data.user.id };
}

// 住民からの納品通知: 宛先と本文を DB から作る (送られてきた data は使わない)
async function buildDeliveryNotice(admin: any, sellerId: string, body: any): Promise<{ recipientId: string; data: Record<string, unknown> } | null> {
  const since = new Date(Date.now() - DELIVERY_WINDOW_MS).toISOString();
  let q = admin.from("orders")
    .select("id, order_number, buyer_id, seller_id, listing_id, status, delivered_at")
    .eq("seller_id", sellerId)
    .eq("status", "delivered")
    .gte("delivered_at", since);
  if (typeof body.order_id === "string" && body.order_id) q = q.eq("id", body.order_id);
  else if (typeof body.user_id === "string" && body.user_id) q = q.eq("buyer_id", body.user_id);
  else return null;
  const { data: order } = await q.order("delivered_at", { ascending: false }).limit(1).maybeSingle();
  if (!order?.buyer_id) return null;

  const [{ data: listing }, { data: profs }] = await Promise.all([
    admin.from("listings").select("title").eq("id", order.listing_id).maybeSingle(),
    admin.from("profiles").select("id, display_name").in("id", [order.buyer_id, order.seller_id]),
  ]);
  const nameOf = (id: string, fallback: string) =>
    (profs ?? []).find((p: any) => p.id === id)?.display_name || fallback;
  return {
    recipientId: order.buyer_id,
    data: {
      user_name: nameOf(order.buyer_id, "ご購入者"),
      seller_name: nameOf(order.seller_id, "出品者"),
      order_number: order.order_number || "",
      listing_title: listing?.title || "(商品)",
      order_url: `${SITE_URL}/mypage`,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const caller = await identify(req, admin);
    if (!caller) return json({ error: "unauthorized" }, 401);

    let body: any = {};
    try { body = await req.json(); } catch (_) { return json({ error: "invalid json" }, 400); }
    const type = typeof body?.type === "string" ? body.type : "";
    if (!type) return json({ error: "type is required" }, 400);

    const template = TEMPLATES[type];
    if (!template) return json({ error: `Unknown template: ${type}` }, 400);

    let to = "";
    let rawData: unknown = body.data;

    if (caller.kind === "user") {
      if (!USER_TEMPLATES.has(type)) return json({ error: "forbidden" }, 403);
      if (body.to) return json({ error: "forbidden" }, 403);
      const built = await buildDeliveryNotice(admin, caller.id, body);
      if (!built) return json({ error: "no matching delivered order" }, 403);
      const { data: u } = await admin.auth.admin.getUserById(built.recipientId);
      if (!u?.user?.email) return json({ error: "Could not find user email" }, 400);
      to = u.user.email;
      rawData = built.data;
    } else if (body.to) {
      if (typeof body.to !== "string" || !EMAIL_RE.test(body.to.trim())) return json({ error: "invalid to" }, 400);
      to = body.to.trim();
    } else {
      const targetId = body.seller_id || body.user_id;
      if (!targetId) return json({ error: "to, seller_id, or user_id is required" }, 400);
      const { data: userData, error: userErr } = await admin.auth.admin.getUserById(String(targetId));
      if (userErr || !userData?.user?.email) {
        return json({ error: "Could not find user email", detail: userErr?.message }, 400);
      }
      to = userData.user.email;
    }

    const { html: d, plain: r } = prepareData(rawData);
    const { subject, html } = template(d, r);

    // 依頼書 #143 TOP2 (2026/6/10): stripe_connect_request のみ Reply-To: support@qocca.pet を付与
    const emailPayload: any = { from: FROM_EMAIL, to: [to], subject, html };
    if (type === "stripe_connect_request") {
      emailPayload.reply_to = "support@qocca.pet";
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(emailPayload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: "Failed to send", detail: result }, 500);

    // 宛先アドレスは内部の呼び出しにだけ返す (住民には他人のアドレスを見せない)
    return json(caller.kind === "service" ? { success: true, id: result.id, sent_to: to } : { success: true, id: result.id });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
