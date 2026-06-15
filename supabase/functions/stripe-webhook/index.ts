import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Content-Type": "application/json",
};

// Stripe署名を検証
async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const parts = signature.split(",").reduce((acc: Record<string, string>, part) => {
      const [key, value] = part.split("=");
      acc[key] = value;
      return acc;
    }, {});

    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const computedSig = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computedSig === v1;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const payload = await req.text();

    // 署名検証（本番化のため有効化）
    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      console.error("Missing signature or webhook secret");
      return new Response(JSON.stringify({ error: "Missing signature" }), { status: 400, headers: corsHeaders });
    }

    const isValid = await verifyStripeSignature(payload, signature, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error("Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
    }

    console.log("=== WEBHOOK RECEIVED ===");

    const event = JSON.parse(payload);
    console.log("Event type:", event.type);
    console.log("Event id:", event.id);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 決済完了イベント
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const order_id = session.metadata?.order_id;
      const payment_intent_id = session.payment_intent;

      if (order_id) {
        const { error } = await supabase
          .from("orders")
          .update({
            status: "working",
            escrow_status: "held",
            // Phase2 dual-write (2軸化): 旧status不変・新2軸も書く・読みは旧statusのまま
            payment_status: "paid",
            fulfillment_status: "working",
            stripe_payment_intent_id: payment_intent_id || session.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order_id);

        if (error) {
          console.error("Update error:", error);
          return new Response(JSON.stringify({ error: "DB update failed", detail: error }), { status: 500, headers: corsHeaders });
        }

        // ===== メール通知を送信（出品者・購入者へ） =====
        try {
          // 注文情報＋配送先住所を取得
          const { data: order } = await supabase
            .from("orders")
            .select("id, order_number, amount, buyer_id, seller_id, listing_id, shipping_address_id, created_at")
            .eq("id", order_id)
            .single();

          if (order) {
            // 出品情報
            const { data: listing } = await supabase
              .from("listings")
              .select("title, delivery_type")
              .eq("id", order.listing_id)
              .single();

            // 購入者・出品者プロフィール
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, display_name")
              .in("id", [order.buyer_id, order.seller_id]);

            const buyerProfile = profiles?.find(p => p.id === order.buyer_id);
            const sellerProfile = profiles?.find(p => p.id === order.seller_id);

            // 配送先住所（配送ありの場合）
            let shippingAddress = null;
            if (order.shipping_address_id) {
              const { data: addr } = await supabase
                .from("shipping_addresses")
                .select("recipient_name, postal_code, prefecture, city, address_line, phone")
                .eq("id", order.shipping_address_id)
                .single();
              shippingAddress = addr;
            }

            const deliveryTypeLabel =
              listing?.delivery_type === "shipping" ? "📦 配送あり" :
              listing?.delivery_type === "visit" ? "📍 訪問あり" :
              "💻 データのみ";

            const orderDate = new Date(order.created_at).toLocaleString("ja-JP", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
            const orderUrl = `https://qocca.pet/mypage`;

            // 出品者へメール送信（セキュリティのため住所はメール内に含めない）
            const sellerPayload = {
              type: "order_seller",
              seller_id: order.seller_id,
              data: {
                user_name: sellerProfile?.display_name || "出品者",
                order_number: order.order_number,
                listing_title: listing?.title || "(商品名なし)",
                buyer_name: buyerProfile?.display_name || "購入者",
                order_date: orderDate,
                price: order.amount,
                delivery_type_label: deliveryTypeLabel,
                has_shipping_address: !!shippingAddress,
                order_url: orderUrl,
              }
            };

            // 購入者へメール送信
            const buyerPayload = {
              type: "order_buyer",
              user_id: order.buyer_id,
              data: {
                user_name: buyerProfile?.display_name || "購入者",
                order_number: order.order_number,
                listing_title: listing?.title || "(商品名なし)",
                seller_name: sellerProfile?.display_name || "出品者",
                price: order.amount,
                order_date: orderDate,
                order_url: orderUrl,
              }
            };

            // 並行送信
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
                body: JSON.stringify(sellerPayload),
              }).catch(e => console.error("Failed to send seller email:", e)),
              fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
                body: JSON.stringify(buyerPayload),
              }).catch(e => console.error("Failed to send buyer email:", e)),
            ]);

            console.log("Order notification emails sent");
          }
        } catch (emailErr) {
          // メール送信失敗してもwebhook自体は成功扱い
          console.error("Email notification error:", emailErr);
        }
      }
    }

    // 決済失敗・キャンセル
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const order_id = session.metadata?.order_id;

      if (order_id) {
        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            // Phase2 dual-write (2軸化): 期限切れ/失敗 → 決済軸=expired, フルフィルメント軸=cancelled
            payment_status: "expired",
            fulfillment_status: "cancelled",
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", order_id);
      }
    }

    // 返金イベント
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const payment_intent_id = charge.payment_intent;

      if (payment_intent_id) {
        await supabase
          .from("orders")
          .update({
            status: "refunded",
            escrow_status: "refunded",
            // Phase2 dual-write (2軸化): 決済軸のみ refunded。fulfillment_status は不変=文脈保持(納品後返金等)
            payment_status: "refunded",
            refunded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", payment_intent_id);
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
