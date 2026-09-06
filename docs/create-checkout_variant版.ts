// ============================================
// create-checkout (Variant 対応版)
// 改修日: 2026/5/15 夜
// 改修内容:
//   1. variant_id サポート (Amazon型バリエーション対応)
//   2. has_variants 判定で価格・在庫を variant から取得
//   3. 在庫減算ロジック追加 (variant + 単品両方)
//   4. 排他制御 (FOR UPDATE 行ロック)
//   5. 既存単品購入フローは完全維持
// ============================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SITE_URL = "https://qocca.pet";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

async function getSettings(supabase: any, keys: string[]): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", keys);
  const result: Record<string, string> = {};
  for (const row of data || []) result[row.key] = row.value;
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const debugLog: any = { step: "start" };

  try {
    debugLog.step = "parse_body";
    const body = await req.json();
    debugLog.body = body;

    // ⭐ variant_id 受け取り (新規追加)
    const { listing_id, listing_title, price, options, buyer_id, seller_id, shipping_address_id, variant_id } = body;

    if (!listing_title || !price) {
      return new Response(JSON.stringify({ error: "listing_title and price are required", debugLog }), { status: 400, headers: corsHeaders });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Supabase env vars missing", debugLog }), { status: 500, headers: corsHeaders });
    }

    debugLog.step = "create_client";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============================================
    // ⭐ NEW: listing 取得 + has_variants 判定
    // ============================================
    debugLog.step = "fetch_listing";
    
    if (!listing_id) {
      return new Response(JSON.stringify({ error: "listing_id required", debugLog }), { status: 400, headers: corsHeaders });
    }

    const { data: listing, error: listingErr } = await supabase
      .from("listings")
      .select("id, has_variants, price, stock_quantity, status")
      .eq("id", listing_id)
      .single();

    if (listingErr || !listing) {
      return new Response(JSON.stringify({ error: "Listing not found", debugLog }), { status: 404, headers: corsHeaders });
    }

    if (listing.status !== "approved" && listing.status !== "sold_out") {
      return new Response(JSON.stringify({ error: "Listing not available", debugLog }), { status: 400, headers: corsHeaders });
    }

    // ============================================
    // ⭐ NEW: 価格・在庫を サーバー側で決定 (改ざん防止)
    // ============================================
    let actualPrice: number;
    let variantData: any = null;
    let variantSnapshot: any = null;
    
    debugLog.step = "validate_price_stock";

    if (listing.has_variants) {
      // ⭐ Variant 商品の場合
      if (!variant_id) {
        return new Response(JSON.stringify({ 
          error: "Variant ID required for this listing",
          message: "種類を選んでください",
          debugLog 
        }), { status: 400, headers: corsHeaders });
      }

      // variant を取得 + 親 listing と一致確認
      const { data: variant, error: variantErr } = await supabase
        .from("listing_variants")
        .select("*")
        .eq("id", variant_id)
        .eq("listing_id", listing_id)
        .eq("is_active", true)
        .single();

      if (variantErr || !variant) {
        return new Response(JSON.stringify({ 
          error: "Variant not found or inactive",
          message: "選んだ種類は利用できません",
          debugLog 
        }), { status: 404, headers: corsHeaders });
      }

      // 在庫チェック
      if (variant.stock <= 0) {
        return new Response(JSON.stringify({ 
          error: "Out of stock",
          message: "売り切れました",
          debugLog 
        }), { status: 400, headers: corsHeaders });
      }

      // ⭐ サーバー側で price を確定 (Frontend からの price は無視)
      actualPrice = variant.price;
      variantData = variant;
      
      // 注文時点の variant 情報をスナップショット保存
      variantSnapshot = {
        variant_name: variant.variant_name,
        attributes: variant.attributes,
        price: variant.price,
        image_url: variant.image_url,
      };
    } else {
      // 単品商品の場合 (既存ロジック)
      if (variant_id) {
        return new Response(JSON.stringify({ 
          error: "This listing has no variants",
          debugLog 
        }), { status: 400, headers: corsHeaders });
      }

      // ⭐ NEW: 単品の在庫チェック (既存はチェックなしだった)
      if (listing.stock_quantity !== null && listing.stock_quantity <= 0) {
        return new Response(JSON.stringify({ 
          error: "Out of stock",
          message: "売り切れました",
          debugLog 
        }), { status: 400, headers: corsHeaders });
      }

      // サーバー側で price を確定
      actualPrice = listing.price;
    }

    debugLog.step = "calculate_total";
    debugLog.actualPrice = actualPrice;

    // ============================================
    // 価格計算 (既存ロジック踏襲)
    // ============================================
    
    // 商品価格(出品価格 + オプション)
    const optionsTotal = (options || []).reduce((sum, o) => sum + (o.price || 0), 0);
    const listingPrice = actualPrice + optionsTotal;

    // バイヤープロテクション率を platform_settings から取得(デフォルト4%)
    const settings = await getSettings(supabase, ["buyer_protection_rate"]);
    const buyerProtectionRate = parseFloat(settings.buyer_protection_rate || "0.04");

    // バイヤープロテクション手数料(購入者負担)
    const buyerProtectionFee = Math.floor(listingPrice * buyerProtectionRate);

    // 購入者の支払い総額 = 商品価格 + BP
    const totalAmount = listingPrice + buyerProtectionFee;

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
    const order_number = `QC-${dateStr}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // ============================================
    // orders に挿入 (⭐ variant_id + variant_snapshot 追加)
    // ============================================
    const insertData: any = {
      order_number,
      listing_id: listing_id || null,
      buyer_id: buyer_id || null,
      seller_id: seller_id || null,
      amount: totalAmount,
      listing_price: listingPrice,
      buyer_protection_fee: buyerProtectionFee,
      stripe_fee: 0,
      qocca_fee: 0,
      seller_payout: 0,
      status: "pending",
      escrow_status: "held",
      // ⭐ NEW: Variant 情報
      variant_id: variant_id || null,
      variant_snapshot: variantSnapshot,
    };
    if (shipping_address_id) {
      insertData.shipping_address_id = shipping_address_id;
    }
    debugLog.step = "insert_order";
    debugLog.insertData = insertData;

    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ 
        error: "DB insert error", 
        insertError_message: insertError.message,
        insertError_code: insertError.code,
        insertError_details: insertError.details,
        insertError_hint: insertError.hint,
        insertError_full: JSON.stringify(insertError),
        debugLog
      }), { status: 500, headers: corsHeaders });
    }

    // ============================================
    // ⭐ NEW: 在庫減算 (Stripe決済前に予約的に減らす)
    // ============================================
    debugLog.step = "reduce_stock";
    
    if (variant_id) {
      // Variant の在庫減算 (RPC 関数で行ロック)
      const { data: stockSuccess, error: stockErr } = await supabase.rpc('reduce_variant_stock', {
        p_variant_id: variant_id,
        p_quantity: 1,
      });

      if (stockErr || !stockSuccess) {
        // 在庫不足エラー → order をキャンセル
        await supabase.from("orders").update({ 
          status: "cancelled", 
          cancelled_at: new Date().toISOString() 
        }).eq("id", order.id);

        return new Response(JSON.stringify({ 
          error: "Stock reduction failed",
          message: "売り切れました",
          debugLog 
        }), { status: 400, headers: corsHeaders });
      }
    } else if (listing.stock_quantity !== null) {
      // 単品の在庫減算 (FOR UPDATE 相当の処理)
      // .gte で在庫があることを保証 (失敗したら別プロセスが先に減らした)
      const { data: updatedListing, error: updateErr } = await supabase
        .from("listings")
        .update({ 
          stock_quantity: listing.stock_quantity - 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", listing_id)
        .gte("stock_quantity", 1)  // ⭐ 同時購入対策
        .select()
        .single();

      if (updateErr || !updatedListing) {
        // 在庫減算失敗 → order をキャンセル
        await supabase.from("orders").update({ 
          status: "cancelled", 
          cancelled_at: new Date().toISOString() 
        }).eq("id", order.id);

        return new Response(JSON.stringify({ 
          error: "Stock reduction failed",
          message: "売り切れました",
          debugLog 
        }), { status: 400, headers: corsHeaders });
      }

      // 在庫0になったら listing.status を sold_out に
      if (updatedListing.stock_quantity === 0) {
        await supabase.from("listings").update({ 
          status: "sold_out",
          updated_at: new Date().toISOString()
        }).eq("id", listing_id);
      }
    }

    // 配送先住所をこの注文に紐付ける
    if (shipping_address_id) {
      await supabase
        .from("shipping_addresses")
        .update({ order_id: order.id })
        .eq("id", shipping_address_id)
        .eq("user_id", buyer_id);
    }

    // ============================================
    // Stripe Checkout Session 作成 (既存ロジック踏襲)
    // ============================================
    debugLog.step = "stripe_call";
    debugLog.order_id = order.id;

    // line_items: 商品本体 + オプション + バイヤープロテクション
    // ⭐ variant の場合、商品名に variant 情報を追加
    const productName = variantData 
      ? `${listing_title} - ${variantData.variant_name}`
      : listing_title;

    const line_items: any[] = [{
      price_data: {
        currency: "jpy",
        product_data: { name: productName },
        unit_amount: actualPrice,
      },
      quantity: 1,
    }];

    if (options && options.length > 0) {
      for (const opt of options) {
        if (opt.name && opt.price > 0) {
          line_items.push({
            price_data: {
              currency: "jpy",
              product_data: { name: `オプション: ${opt.name}` },
              unit_amount: opt.price,
            },
            quantity: 1,
          });
        }
      }
    }

    // バイヤープロテクションを別行として追加
    if (buyerProtectionFee > 0) {
      line_items.push({
        price_data: {
          currency: "jpy",
          product_data: { name: "バイヤープロテクション(4%)" },
          unit_amount: buyerProtectionFee,
        },
        quantity: 1,
      });
    }

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${SITE_URL}/mypage?order=success&order_id=${order.id}`);
    params.append("cancel_url", `${SITE_URL}/mypage?order=cancel&order_id=${order.id}`);
    params.append("metadata[order_id]", order.id);
    params.append("metadata[order_number]", order_number);
    params.append("metadata[listing_id]", listing_id || "");
    params.append("metadata[buyer_id]", buyer_id || "");
    params.append("metadata[seller_id]", seller_id || "");
    params.append("metadata[shipping_address_id]", shipping_address_id || "");
    params.append("metadata[listing_price]", String(listingPrice));
    params.append("metadata[buyer_protection_fee]", String(buyerProtectionFee));
    // ⭐ NEW: variant_id を metadata に追加
    params.append("metadata[variant_id]", variant_id || "");

    line_items.forEach((item, i) => {
      params.append(`line_items[${i}][price_data][currency]`, item.price_data.currency);
      params.append(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await res.json();

    if (!res.ok) {
      // Stripe エラー時: order をキャンセル + 在庫を戻す
      await supabase.from("orders").update({ 
        status: "cancelled", 
        cancelled_at: new Date().toISOString() 
      }).eq("id", order.id);

      // ⭐ NEW: 在庫ロールバック
      if (variant_id) {
        await supabase
          .from("listing_variants")
          .update({ stock: variantData.stock })
          .eq("id", variant_id);
      } else if (listing.stock_quantity !== null) {
        await supabase
          .from("listings")
          .update({ 
            stock_quantity: listing.stock_quantity,
            status: "approved"
          })
          .eq("id", listing_id);
      }

      return new Response(JSON.stringify({ error: "Stripe error", detail: session, debugLog }), { status: 500, headers: corsHeaders });
    }

    await supabase.from("orders").update({ stripe_payment_intent_id: session.id }).eq("id", order.id);

    return new Response(JSON.stringify({ 
      url: session.url, 
      session_id: session.id, 
      order_id: order.id,
      breakdown: {
        listing_price: listingPrice,
        buyer_protection_fee: buyerProtectionFee,
        total_amount: totalAmount,
        variant_info: variantData ? {
          variant_name: variantData.variant_name,
          attributes: variantData.attributes,
        } : null,
      },
    }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: "Caught error",
      message: err.message || String(err),
      stack: err.stack || null,
      debugLog
    }), { status: 500, headers: corsHeaders });
  }
});
