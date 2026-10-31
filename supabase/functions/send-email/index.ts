// ============================================
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

const TEMPLATES: Record<string, (d: any, r: any) => { subject: string; html: string }> = {
  welcome: (d, r) => ({
    subject: `🐾 Qoccaへようこそ！${r.user_name}さんのご登録が完了しました`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>Qocca（クオッカ）へのご登録、ありがとうございます！</p><p>Qoccaは、うちの子のための特別な作品・サービスに出会えるペットオーナー専門マーケットプレイスです。</p><p>🎨 オリジナル似顔絵を注文<br>👕 ハンドメイドのペット服を購入<br>📷 ペット専門フォトグラファーに依頼<br>🛍 いろいろなオリジナルグッズをGET</p><p><a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">🐾 サービスを探す</a></p><p style="margin-top:24px">あなたもクリエイターに？<br>Qoccaでは、ペット専門のクリエイターを募集しています。<br>初回出品は手数料無料！</p><p><a href="${SITE_URL}/sell" style="color:#F5A94A;font-weight:700">▶ 出品を始める</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br>ペットオーナー専門マーケットプレイス<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  listing_approved: (d, r) => ({
    subject: `🎉 出品が公開されました！「${r.listing_title}」`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>お待たせしました！<br>ご出品いただいた「<strong>${d.listing_title}</strong>」が審査を通過し、Qoccaに公開されました🐾</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>タイトル：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>カテゴリ：</strong>${d.category || ""}</p><p style="margin:4px 0"><strong>価格：</strong>¥${d.price || ""}</p></div><p><a href="${d.listing_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 出品ページを表示</a></p><p style="margin-top:16px">購入者から注文が入るとメールで通知されます。<br>素敵な作品をお届けいただき、ありがとうございます。</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  listing_rejected: (d, r) => ({
    subject: `ご出品について：「${r.listing_title}」`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>ご出品いただいた「<strong>${d.listing_title}</strong>」につきまして、ご連絡いたします。</p><p>恐れ入りますが、下記の理由によりこのたび出品を公開できませんでした。</p><div style="background:#FFEBEE;border-radius:12px;padding:16px;margin:16px 0"><p><strong>却下理由：</strong><br>${d.rejection_reason || "利用規約に準拠しない内容が含まれていました"}</p></div><p>内容修正して再申請していただけます。<br>ぜひ内容を見直しておそれいただければと思います。</p><p><a href="${SITE_URL}/sell" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 出品を編集する</a></p><p style="margin-top:16px">お問い合わせ：<a href="mailto:support@qocca.pet" style="color:#F5A94A">support@qocca.pet</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  order_buyer: (d, r) => ({
    subject: `📝 ご注文ありがとうございます！注文番号：${r.order_number}`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>このたびはQoccaでのご注文ありがとうございます🐾</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>出品者：</strong>${d.seller_name}</p><p style="margin:4px 0"><strong>支払額：</strong>¥${d.price}</p><p style="margin:4px 0"><strong>注文日：</strong>${d.order_date}</p></div><p>出品者に注文が通知されました。<br>出品者からメッセージが届いたら、必要な情報をお伝えください。</p><p><a href="${d.order_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 取引ページを開く</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  order_seller: (d, r) => ({
    subject: `📦 新しい注文が入りました！「${r.listing_title}」`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>おめでとうございます！新しい注文が入りました🐾</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>購入者：</strong>${d.buyer_name}</p><p style="margin:4px 0"><strong>注文日：</strong>${d.order_date}</p><p style="margin:4px 0"><strong>ご購入額：</strong>¥${d.price}</p>${d.delivery_type_label ? `<p style="margin:4px 0"><strong>受け渡し方法：</strong>${d.delivery_type_label}</p>` : ""}</div>${d.has_shipping_address ? `<div style="background:#FFF8F0;border:2px solid #F5A94A;border-radius:12px;padding:16px;margin:16px 0"><p style="font-weight:800;color:#F5A94A;margin:0 0 8px 0">📦 配送先住所が登録されました</p><p style="margin:4px 0;font-size:13px;line-height:1.7">セキュリティのため、配送先住所はメールには記載しません。<br>Qoccaサイト内の<strong>「取引メッセージ」</strong>からご確認ください。</p></div>` : ""}<p>必要な場合は購入者さんにメッセージで確認しましょう。<br>納期に合わせて納品を進めます。</p><p><a href="${d.order_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 取引ページを開く</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  delivery_notice: (d, r) => ({
    subject: `✨ 納品されました！ご確認をお願いします（${r.order_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>${d.seller_name}さんから納品の連絡がありました🐾</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>出品者：</strong>${d.seller_name}</p></div><p>商品・サービスの内容をご確認の上、問題なければ「<strong>取引完了</strong>」ボタンを押してください。</p><p style="color:#EF5350;font-weight:700">⚠ 72時間後に自動で完了します。</p><p><a href="${d.order_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 取引ページを開く</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  order_complete: (d, r) => ({
    subject: `✅ 取引が完了しました🎉（${r.order_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>取引が無事に完了いたしました🐾</p><div style="background:#E8F5E9;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p></div>${d.is_buyer ? `<p>ぜひレビューをお願いします！</p><p><a href="${d.review_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">⭐ レビューを書く</a></p>` : `<p>売上金額：¥${d.price}<br>手数料：¥${d.fee || "0"}<br>入金予定額：¥${d.payout_amount || d.price}</p>`}<hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  cancel_notice: (d, r) => ({
    subject: `ご注文がキャンセルされました（${r.order_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>ご注文のキャンセルが完了しました。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>キャンセル理由：</strong>${d.cancel_reason || ""}</p></div><p>返金額：¥${d.refund_amount || d.price}</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  refund_complete: (d, r) => ({
    subject: `💰 返金が完了しました（${r.order_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>返金手続きが完了いたしました。</p><div style="background:#E8F5E9;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>返金額：</strong>¥${d.refund_amount}</p><p style="margin:4px 0"><strong>返金処理日：</strong>${d.refund_date || new Date().toLocaleDateString("ja-JP")}</p></div><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  new_message: (d, r) => ({
    subject: `💬 新しいメッセージがあります（${r.sender_name}さん）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>${d.sender_name}さんからメッセージが届いています。</p><div style="background:#F5F3F0;border-radius:12px;padding:16px;margin:16px 0"><p style="color:#666">${d.message_preview || "メッセージが届いています"}</p></div><p><a href="${d.messages_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ Qoccaで確認する</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  review_request: (d, r) => ({
    subject: `⭐ ${r.seller_name}さんの感想、聴かせてくださいませんか？`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>先日は「${d.listing_title}」をお買い上げいただき、ありがとうございました。</p><p>ご感想を聴かせていただけませんか？</p><p><a href="${d.review_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">⭐ レビューを書く</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  support_reply: (d, r) => ({
    subject: `✉️ Qoccaサポートからのお返事（${r.ticket_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>Qoccaサポートチームより返信をいたしました。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>チケット番号：</strong>${d.ticket_number}</p><p style="margin:4px 0"><strong>件名：</strong>${d.ticket_subject || ""}</p></div><p><a href="${d.ticket_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 返信内容を確認する</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  dispute_received: (d, r) => ({
    subject: `異議申し立てを受理しました（${r.dispute_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>異議を申し立てていただきありがとうございます。受理いたしました。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>異議番号：</strong>${d.dispute_number}</p><p style="margin:4px 0"><strong>対象注文：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>理由：</strong>${d.dispute_reason || ""}</p></div><p>1～3営業日でご回答いたします。</p><p><a href="${d.dispute_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 異議情報を確認する</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  dispute_response_needed: (d, r) => ({
    subject: `⚠️ 異議のご連絡があります。24時間以内にご回答ください（${r.dispute_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>購入者より異議申し立てがありました。</p><div style="background:#FFEBEE;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>異議番号：</strong>${d.dispute_number}</p><p style="margin:4px 0"><strong>対象注文：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>申し立て理由：</strong>${d.dispute_reason || ""}</p></div><p><a href="${d.dispute_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#EF5350;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 異議へ回答する</a></p><p style="color:#EF5350;font-weight:700">回答期限：${d.response_deadline || "24時間以内"}</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  dispute_result: (d, r) => ({
    subject: `異議の結果をご連絡いたします（${r.dispute_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>異議申し立ての確認が完了しましたので、結果をご連絡いたします。</p><div style="background:#E8F5E9;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>異議番号：</strong>${d.dispute_number}</p><p style="margin:4px 0"><strong>対象注文：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>判断結果：</strong>${d.dispute_result_text || ""}</p></div><p><strong>理由：</strong><br>${d.dispute_reasoning || ""}</p><p><strong>今後の対応：</strong><br>${d.next_steps || ""}</p><p><a href="${d.dispute_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 詳細を確認する</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  payout_requested: (d, r) => ({
    subject: `💳 出金申請を受付しました（¥${r.payout_amount}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>出金申請ありがとうございます。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>申請額：</strong>¥${d.payout_amount}</p><p style="margin:4px 0"><strong>振込手数料：</strong>¥275</p><p style="margin:4px 0"><strong>振込額：</strong>¥${d.final_amount || ""}</p><p style="margin:4px 0"><strong>振込先：</strong>${d.bank_name || ""} ${d.bank_account || ""}</p></div><p>振込予定日：${d.payout_date || "3～5営業日以内"}</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  payout_complete: (d, r) => ({
    subject: `✅ 出金が完了しました（¥${r.final_amount}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>出金処理が完了いたしました。</p><div style="background:#E8F5E9;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>振込額：</strong>¥${d.final_amount}</p><p style="margin:4px 0"><strong>振込先：</strong>${d.bank_name || ""} ${d.bank_account || ""}</p></div><p>銀行口座をご確認ください🐾</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  stripe_connect_request: (d, r) => ({
    subject: `【Qocca】売上を受け取るための大切なお願い（残り2、3分の設定）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name}さま</p><p>いつもQoccaで素敵な作品を出品していただき、ありがとうございます。<br>Qocca運営チームです🐨</p><p>7月1日のグランドオープンに向けて、ひとつ大切なお願いがあり、ご連絡しました。</p><p>現在、${d.user_name}さまのアカウントで、「売上の受け取り口座（Stripe連携）」がまだ設定されていません。<br>このままだと、せっかく作品が購入されても、売上をお受け取りいただけない状態になってしまいます。</p><p>設定はとても簡単で、2～3分で完了します。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="font-weight:800;color:#F5A94A;margin:0 0 8px 0">【設定手順】</p><p style="margin:4px 0;line-height:1.9">1. Qocca（https://qocca.pet）にログイン<br>2. マイページ →「売上」タブを開く<br>3. 「🏦 銀行口座を設定する」ボタンをタップ<br>4. 画面の案内に沿って、口座情報などを入力</p><p style="margin:8px 0 0 0;font-size:12px;color:#7A5C00">※本人確認のため、身分証明書のご用意があるとスムーズです。<br>※ご不明点はマイページ内の「Stripe Connect 登録ガイド」もご参照ください。</p></div><p><a href="${SITE_URL}/mypage" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">🏦 売上タブを開く</a></p><p style="margin-top:16px">グランドオープンでお客様が増える前に済ませていただけると、安心して販売をスタートできます。</p><p>ご不明点やうまくいかないところがあれば、このメールへの返信や、Qocca公式SNSのDMでいつでもお気軽にお問い合わせください。</p><p>これからもどうぞよろしくお願いいたします。</p><p style="margin-top:16px">Qocca運営チーム<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br>ペットオーナー専門マーケットプレイス<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
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
