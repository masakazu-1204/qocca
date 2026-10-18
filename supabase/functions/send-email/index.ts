import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FROM_EMAIL = "Qocca <noreply@qocca.pet>";
const SITE_URL = "https://qocca.pet";

const TEMPLATES: Record<string, (d: any) => { subject: string; html: string }> = {
  welcome: (d) => ({
    subject: `🐾 Qoccaへようこそ！${d.user_name}さんのご登録が完了しました`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>Qocca（クオッカ）へのご登録、ありがとうございます！</p><p>Qoccaは、うちの子のための特別な作品・サービスに出会えるペットオーナー専門マーケットプレイスです。</p><p>🎨 オリジナル似顔絵を注文<br>👕 ハンドメイドのペット服を購入<br>📷 ペット専門フォトグラファーに依頼<br>🛍 いろいろなオリジナルグッズをGET</p><p><a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">🐾 サービスを探す</a></p><p style="margin-top:24px">あなたもクリエイターに？<br>Qoccaでは、ペット専門のクリエイターを募集しています。<br>初回出品は手数料無料！</p><p><a href="${SITE_URL}/sell" style="color:#F5A94A;font-weight:700">▶ 出品を始める</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br>ペットオーナー専門マーケットプレイス<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  listing_approved: (d) => ({
    subject: `🎉 出品が公開されました！「${d.listing_title}」`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>お待たせしました！<br>ご出品いただいた「<strong>${d.listing_title}</strong>」が審査を通過し、Qoccaに公開されました🐾</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>タイトル：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>カテゴリ：</strong>${d.category || ""}</p><p style="margin:4px 0"><strong>価格：</strong>¥${d.price || ""}</p></div><p><a href="${d.listing_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 出品ページを表示</a></p><p style="margin-top:16px">購入者から注文が入るとメールで通知されます。<br>素敵な作品をお届けいただき、ありがとうございます。</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  listing_rejected: (d) => ({
    subject: `ご出品について：「${d.listing_title}」`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>ご出品いただいた「<strong>${d.listing_title}</strong>」につきまして、ご連絡いたします。</p><p>恐れ入りますが、下記の理由によりこのたび出品を公開できませんでした。</p><div style="background:#FFEBEE;border-radius:12px;padding:16px;margin:16px 0"><p><strong>却下理由：</strong><br>${d.rejection_reason || "利用規約に準拠しない内容が含まれていました"}</p></div><p>内容修正して再申請していただけます。<br>ぜひ内容を見直しておそれいただければと思います。</p><p><a href="${SITE_URL}/sell" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 出品を編集する</a></p><p style="margin-top:16px">お問い合わせ：<a href="mailto:support@qocca.pet" style="color:#F5A94A">support@qocca.pet</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  order_buyer: (d) => ({
    subject: `📝 ご注文ありがとうございます！注文番号：${d.order_number}`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>このたびはQoccaでのご注文ありがとうございます🐾</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>出品者：</strong>${d.seller_name}</p><p style="margin:4px 0"><strong>支払額：</strong>¥${d.price}</p><p style="margin:4px 0"><strong>注文日：</strong>${d.order_date}</p></div><p>出品者に注文が通知されました。<br>出品者からメッセージが届いたら、必要な情報をお伝えください。</p><p><a href="${d.order_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 取引ページを開く</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  order_seller: (d) => ({
    subject: `📦 新しい注文が入りました！「${d.listing_title}」`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>おめでとうございます！新しい注文が入りました🐾</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>購入者：</strong>${d.buyer_name}</p><p style="margin:4px 0"><strong>注文日：</strong>${d.order_date}</p><p style="margin:4px 0"><strong>ご購入額：</strong>¥${d.price}</p>${d.delivery_type_label ? `<p style="margin:4px 0"><strong>受け渡し方法：</strong>${d.delivery_type_label}</p>` : ""}</div>${d.has_shipping_address ? `<div style="background:#FFF8F0;border:2px solid #F5A94A;border-radius:12px;padding:16px;margin:16px 0"><p style="font-weight:800;color:#F5A94A;margin:0 0 8px 0">📦 配送先住所が登録されました</p><p style="margin:4px 0;font-size:13px;line-height:1.7">セキュリティのため、配送先住所はメールには記載しません。<br>Qoccaサイト内の<strong>「取引メッセージ」</strong>からご確認ください。</p></div>` : ""}<p>必要な場合は購入者さんにメッセージで確認しましょう。<br>納期に合わせて納品を進めます。</p><p><a href="${d.order_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 取引ページを開く</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  delivery_notice: (d) => ({
    subject: `✨ 納品されました！ご確認をお願いします（${d.order_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>${d.seller_name}さんから納品の連絡がありました🐾</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>出品者：</strong>${d.seller_name}</p></div><p>商品・サービスの内容をご確認の上、問題なければ「<strong>取引完了</strong>」ボタンを押してください。</p><p style="color:#EF5350;font-weight:700">⚠ 72時間後に自動で完了します。</p><p><a href="${d.order_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 取引ページを開く</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  order_complete: (d) => ({
    subject: `✅ 取引が完了しました🎉（${d.order_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>取引が無事に完了いたしました🐾</p><div style="background:#E8F5E9;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p></div>${d.is_buyer ? `<p>ぜひレビューをお願いします！</p><p><a href="${d.review_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">⭐ レビューを書く</a></p>` : `<p>売上金額：¥${d.price}<br>手数料：¥${d.fee || "0"}<br>入金予定額：¥${d.payout_amount || d.price}</p>`}<hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  cancel_notice: (d) => ({
    subject: `ご注文がキャンセルされました（${d.order_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>ご注文のキャンセルが完了しました。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>キャンセル理由：</strong>${d.cancel_reason || ""}</p></div><p>返金額：¥${d.refund_amount || d.price}</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  refund_complete: (d) => ({
    subject: `💰 返金が完了しました（${d.order_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>返金手続きが完了いたしました。</p><div style="background:#E8F5E9;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>注文番号：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>返金額：</strong>¥${d.refund_amount}</p><p style="margin:4px 0"><strong>返金処理日：</strong>${d.refund_date || new Date().toLocaleDateString("ja-JP")}</p></div><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  new_message: (d) => ({
    subject: `💬 新しいメッセージがあります（${d.sender_name}さん）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>${d.sender_name}さんからメッセージが届いています。</p><div style="background:#F5F3F0;border-radius:12px;padding:16px;margin:16px 0"><p style="color:#666">${d.message_preview || "メッセージが届いています"}</p></div><p><a href="${d.messages_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ Qoccaで確認する</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  review_request: (d) => ({
    subject: `⭐ ${d.seller_name}さんの感想、聴かせてくださいませんか？`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>先日は「${d.listing_title}」をお買い上げいただき、ありがとうございました。</p><p>ご感想を聴かせていただけませんか？</p><p><a href="${d.review_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">⭐ レビューを書く</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  support_reply: (d) => ({
    subject: `✉️ Qoccaサポートからのお返事（${d.ticket_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>Qoccaサポートチームより返信をいたしました。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>チケット番号：</strong>${d.ticket_number}</p><p style="margin:4px 0"><strong>件名：</strong>${d.ticket_subject || ""}</p></div><p><a href="${d.ticket_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 返信内容を確認する</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  dispute_received: (d) => ({
    subject: `異議申し立てを受理しました（${d.dispute_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>異議を申し立てていただきありがとうございます。受理いたしました。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>異議番号：</strong>${d.dispute_number}</p><p style="margin:4px 0"><strong>対象注文：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>理由：</strong>${d.dispute_reason || ""}</p></div><p>1～3営業日でご回答いたします。</p><p><a href="${d.dispute_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 異議情報を確認する</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  dispute_response_needed: (d) => ({
    subject: `⚠️ 異議のご連絡があります。24時間以内にご回答ください（${d.dispute_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>購入者より異議申し立てがありました。</p><div style="background:#FFEBEE;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>異議番号：</strong>${d.dispute_number}</p><p style="margin:4px 0"><strong>対象注文：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>商品名：</strong>${d.listing_title}</p><p style="margin:4px 0"><strong>申し立て理由：</strong>${d.dispute_reason || ""}</p></div><p><a href="${d.dispute_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#EF5350;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 異議へ回答する</a></p><p style="color:#EF5350;font-weight:700">回答期限：${d.response_deadline || "24時間以内"}</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  dispute_result: (d) => ({
    subject: `異議の結果をご連絡いたします（${d.dispute_number}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>異議申し立ての確認が完了しましたので、結果をご連絡いたします。</p><div style="background:#E8F5E9;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>異議番号：</strong>${d.dispute_number}</p><p style="margin:4px 0"><strong>対象注文：</strong>${d.order_number}</p><p style="margin:4px 0"><strong>判断結果：</strong>${d.dispute_result_text || ""}</p></div><p><strong>理由：</strong><br>${d.dispute_reasoning || ""}</p><p><strong>今後の対応：</strong><br>${d.next_steps || ""}</p><p><a href="${d.dispute_url || SITE_URL}" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">▶ 詳細を確認する</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  payout_requested: (d) => ({
    subject: `💳 出金申請を受付しました（¥${d.payout_amount}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>出金申請ありがとうございます。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>申請額：</strong>¥${d.payout_amount}</p><p style="margin:4px 0"><strong>振込手数料：</strong>¥275</p><p style="margin:4px 0"><strong>振込額：</strong>¥${d.final_amount || ""}</p><p style="margin:4px 0"><strong>振込先：</strong>${d.bank_name || ""} ${d.bank_account || ""}</p></div><p>振込予定日：${d.payout_date || "3～5営業日以内"}</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  payout_complete: (d) => ({
    subject: `✅ 出金が完了しました（¥${d.final_amount}）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name} さん</p><p>出金処理が完了いたしました。</p><div style="background:#E8F5E9;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:4px 0"><strong>振込額：</strong>¥${d.final_amount}</p><p style="margin:4px 0"><strong>振込先：</strong>${d.bank_name || ""} ${d.bank_account || ""}</p></div><p>銀行口座をご確認ください🐾</p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
  stripe_connect_request: (d) => ({
    subject: `【Qocca】売上を受け取るための大切なお願い（残り2、3分の設定）`,
    html: `<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1208"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:900;color:#F5A94A">Qocca</span></div><p>${d.user_name}さま</p><p>いつもQoccaで素敵な作品を出品していただき、ありがとうございます。<br>Qocca運営チームです🐨</p><p>7月1日のグランドオープンに向けて、ひとつ大切なお願いがあり、ご連絡しました。</p><p>現在、${d.user_name}さまのアカウントで、「売上の受け取り口座（Stripe連携）」がまだ設定されていません。<br>このままだと、せっかく作品が購入されても、売上をお受け取りいただけない状態になってしまいます。</p><p>設定はとても簡単で、2～3分で完了します。</p><div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0"><p style="font-weight:800;color:#F5A94A;margin:0 0 8px 0">【設定手順】</p><p style="margin:4px 0;line-height:1.9">1. Qocca（https://qocca.pet）にログイン<br>2. マイページ →「売上」タブを開く<br>3. 「🏦 銀行口座を設定する」ボタンをタップ<br>4. 画面の案内に沿って、口座情報などを入力</p><p style="margin:8px 0 0 0;font-size:12px;color:#7A5C00">※本人確認のため、身分証明書のご用意があるとスムーズです。<br>※ご不明点はマイページ内の「Stripe Connect 登録ガイド」もご参照ください。</p></div><p><a href="${SITE_URL}/mypage" style="display:inline-block;padding:12px 28px;background:#F5A94A;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">🏦 売上タブを開く</a></p><p style="margin-top:16px">グランドオープンでお客様が増える前に済ませていただけると、安心して販売をスタートできます。</p><p>ご不明点やうまくいかないところがあれば、このメールへの返信や、Qocca公式SNSのDMでいつでもお気軽にお問い合わせください。</p><p>これからもどうぞよろしくお願いいたします。</p><p style="margin-top:16px">Qocca運営チーム<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p><hr style="border:none;border-top:1px solid #EDE9E3;margin:24px 0"><p style="font-size:12px;color:#9E9B95">Qocca（クオッカ）<br>ペットオーナー専門マーケットプレイス<br><a href="${SITE_URL}" style="color:#F5A94A">${SITE_URL}</a></p></div>`,
  }),
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const body = await req.json();
    const { type, data } = body;
    let { to, seller_id, user_id } = body;

    if (!type) {
      return new Response(JSON.stringify({ error: "type is required" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    if (!to && (seller_id || user_id)) {
      const targetId = seller_id || user_id;
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(targetId);
      if (userErr || !userData?.user?.email) {
        return new Response(JSON.stringify({ error: "Could not find user email", detail: userErr?.message }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
      to = userData.user.email;
    }

    if (!to) {
      return new Response(JSON.stringify({ error: "to, seller_id, or user_id is required" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    const template = TEMPLATES[type];
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown template: ${type}` }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    const { subject, html } = template(data || {});

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

    const result = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed to send", detail: result }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    return new Response(JSON.stringify({ success: true, id: result.id, sent_to: to }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
