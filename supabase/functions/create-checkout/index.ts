// ============================================
// create-checkout v41 (決済入口の硬化, 2026/9/11)
//   v41 追加 (PR1: サーバー側だけ・クライアント変更なし):
//     1. seller_id / オプションの価格 / 商品名 を body でなく listings から確定する
//        (body の seller_id は listing と一致しなければ 400。options は name で照合し価格はサーバー値)
//     2. Authorization: Bearer <JWT> があれば auth.getUser で検証し buyer_id をトークンから取る
//        (無ければ当面 body.buyer_id にフォールバック = 現行クライアント互換。PR2 でヘッダ必須化)
//     3. 単品在庫の二重減算を撤去。orders INSERT の trg_decrement_stock が唯一の減算元
//        (従来はトリガー後にもう一度 .gte(1) で減らそうとし、在庫1の商品が必ず「売り切れ」になっていた)
//   ⚠️ 価格計算 (actualPrice / BP / 送料)・Stripe セッションの組み立ては不変
// --- 以下 v40 までの履歴 ---
// create-checkout v40 (Phase2 dual-write, 2026/6/15)
//   v40 追加: 2軸化 dual-write — 注文INSERT に payment_status/fulfillment_status を併記。
//     旧 status('pending')/escrow_status は不変。読みは旧statusのまま=挙動不変。
//     ⚠️ 在庫処理・Stripe Checkout Session・価格計算・送金ロジックは1行も変えない (insertData に2列追加のみ)。
// --- 以下 v39 までの履歴 ---
// create-checkout v39 (依頼書 #143 TOP2 方式B, 2026/6/10)
//   v39 追加: Stripe 未連携 seller の警告フラグ (購入はブロックしない)
//     1. seller.stripe_payouts_enabled を select (送金可否の真の判定軸)
//     2. false なら response に seller_payout_pending:true を含める (防御的・監査用)
//     ⚠️ 購入フロー・注文作成・Stripe ロジックは 完全不変 (読み取り1本 + レスポンス1フィールドのみ)
//     実際の警告 UX は フロント (購入確認モーダルの黄色バナー) が担う
//   v38: サーバー側送料再計算 + methods 対応 + 送料未反映バグ併修 (#127 Phase C)
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
  const { data } = await supabase.from("platform_settings").select("key, value").in("key", keys);
  const result: Record<string, string> = {};
  for (const row of data || []) result[row.key] = row.value;
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const debugLog: any = { step: "start" };

  try {
    debugLog.step = "parse_body";
    const body = await req.json();
    debugLog.body = body;

    // v41: buyer_id / seller_id / options は「クライアントの申告」として受け取り、下で必ずサーバー値に置き換える
    const {
      listing_id, listing_title, price,
      options: bodyOptions, buyer_id: bodyBuyerId, seller_id: bodySellerId,
      shipping_address_id, variant_id, shipping_region, selected_shipping_method_id,
      choice_ids  // 2026/7/23 Phase 2: 選択肢購入 (N個選択)。choiceモード時のみ使用
    } = body;

    if (!listing_title || !price) {
      return new Response(JSON.stringify({ error: "listing_title and price are required", debugLog }), { status: 400, headers: corsHeaders });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Supabase env vars missing", debugLog }), { status: 500, headers: corsHeaders });
    }

    debugLog.step = "create_client";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // v41: 買い手の確定。Authorization ヘッダがあれば JWT を検証し、トークンの user.id を買い手にする。
    //   無い場合は当面 body の buyer_id を使う (現行クライアントはヘッダを付けていないため。PR2 で必須化して撤去)。
    debugLog.step = "resolve_buyer";
    let buyerId: string | null = bodyBuyerId || null;
    let authMode = "body-fallback";
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (jwt) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid session", message: "ログインし直してください", debugLog }), { status: 401, headers: corsHeaders });
      }
      if (bodyBuyerId && bodyBuyerId !== userData.user.id) {
        return new Response(JSON.stringify({ error: "buyer_id mismatch", debugLog }), { status: 403, headers: corsHeaders });
      }
      buyerId = userData.user.id;
      authMode = "jwt";
    }
    debugLog.auth_mode = authMode;
    if (!buyerId) {
      return new Response(JSON.stringify({ error: "buyer required", message: "ログインが必要です", debugLog }), { status: 401, headers: corsHeaders });
    }

    debugLog.step = "fetch_listing";
    if (!listing_id) {
      return new Response(JSON.stringify({ error: "listing_id required", debugLog }), { status: 400, headers: corsHeaders });
    }

    const { data: listing, error: listingErr } = await supabase
      .from("listings")
      .select("id, seller_id, title, options, has_variants, price, stock_quantity, status, shipping_type, shipping_fee, shipping_rates, shipping_methods, choice_required_count, choice_set_price")
      .eq("id", listing_id)
      .single();

    if (listingErr || !listing) {
      return new Response(JSON.stringify({ error: "Listing not found", debugLog }), { status: 404, headers: corsHeaders });
    }

    if (listing.status !== "approved" && listing.status !== "sold_out") {
      return new Response(JSON.stringify({ error: "Listing not available", debugLog }), { status: 400, headers: corsHeaders });
    }

    // v41: 出品者は listings.seller_id で確定する (body の値は照合にだけ使う)。
    //   complete-order は orders.seller_id の Stripe 口座へ送金するため、ここが送金先を決める最重要ポイント。
    debugLog.step = "resolve_seller";
    const sellerId: string | null = listing.seller_id || null;
    if (!sellerId) {
      return new Response(JSON.stringify({ error: "Listing has no seller", debugLog }), { status: 400, headers: corsHeaders });
    }
    if (bodySellerId && bodySellerId !== sellerId) {
      return new Response(JSON.stringify({ error: "seller_id mismatch", message: "出品情報が更新されています。ページを開き直してください", debugLog }), { status: 400, headers: corsHeaders });
    }

    // v41: オプションは名前で listings.options と照合し、価格は必ずサーバー側の値を使う (body の price は捨てる)。
    //   知らない名前が来たら 400 (改ざんか、出品者がオプションを変えた直後のどちらか)。
    debugLog.step = "resolve_options";
    const listingOptions: Array<{ name: string; price: number }> = Array.isArray(listing.options) ? listing.options : [];
    const resolvedOptions: Array<{ name: string; price: number }> = [];
    const seenOptionNames = new Set<string>();
    for (const o of (Array.isArray(bodyOptions) ? bodyOptions : [])) {
      const name = typeof o?.name === "string" ? o.name : "";
      if (!name || seenOptionNames.has(name)) continue;
      const match = listingOptions.find((lo) => lo && lo.name === name);
      if (!match) {
        return new Response(JSON.stringify({ error: "option_invalid", message: "選んだオプションは利用できません。ページを開き直してください", debugLog }), { status: 400, headers: corsHeaders });
      }
      seenOptionNames.add(name);
      resolvedOptions.push({ name, price: Math.max(0, parseInt(String(match.price ?? 0)) || 0) });
    }
    debugLog.resolvedOptions = resolvedOptions;

    // 依頼書 #143 TOP2 (方式B): seller の送金可否を確認 (購入はブロックせず警告フラグのみ)
    // 判定軸 = stripe_payouts_enabled (onboarded は restricted とのズレ実在のため不採用)
    // 読み取り失敗時は安全側 (pending=true で警告) / 購入フローは一切止めない
    let sellerPayoutPending = false;
    try {
      const { data: sellerInfo } = await supabase
        .from("profiles").select("stripe_payouts_enabled").eq("id", sellerId).maybeSingle();
      sellerPayoutPending = !(sellerInfo?.stripe_payouts_enabled === true);
    } catch (_) {
      sellerPayoutPending = true;
    }
    debugLog.seller_payout_pending = sellerPayoutPending;

    // 価格・在庫サーバー側確定 (改ざん防止)
    let actualPrice: number;
    let variantData: any = null;
    let variantSnapshot: any = null;
    // 2026/7/23 Phase 2: 選択肢購入モード判定 (choice_required_count が正の時)。
    //   出品側で variant/option とは併用不可を強制済 (Phase 1)。ここでも choice優先で独立処理。
    const isChoiceMode = listing.choice_required_count != null && Number(listing.choice_required_count) > 0;
    let choiceRows: any[] = [];   // 検証済みの選択肢 (order_choices 保存用)
    debugLog.step = "validate_price_stock";
    debugLog.isChoiceMode = isChoiceMode;

    if (isChoiceMode) {
      const reqN = Number(listing.choice_required_count);
      const setPrice = Number(listing.choice_set_price);
      if (!Number.isFinite(setPrice) || setPrice <= 0) {
        return new Response(JSON.stringify({ error: "Invalid choice_set_price", message: "この商品の価格設定に問題があります", debugLog }), { status: 400, headers: corsHeaders });
      }
      if (!Array.isArray(choice_ids) || choice_ids.length !== reqN) {
        return new Response(JSON.stringify({ error: "Choice count mismatch", message: `${reqN}個選んでください`, debugLog }), { status: 400, headers: corsHeaders });
      }
      const uniqIds = Array.from(new Set(choice_ids.map((x: any) => String(x))));
      if (uniqIds.length !== reqN) {
        return new Response(JSON.stringify({ error: "Duplicate choices", message: "同じものは選べません。別々に選んでください", debugLog }), { status: 400, headers: corsHeaders });
      }
      // 全件このlistingの有効な選択肢か + 在庫>0 か (最終的な減算は reduce_choices_stock がアトミックに再検証)
      const { data: chs, error: chErr } = await supabase
        .from("listing_choices").select("id, name, stock, is_active")
        .in("id", uniqIds).eq("listing_id", listing_id).eq("is_active", true);
      if (chErr || !chs || chs.length !== reqN) {
        return new Response(JSON.stringify({ error: "Choice not found or inactive", message: "選んだものは利用できません", debugLog }), { status: 400, headers: corsHeaders });
      }
      if (chs.some((c: any) => (c.stock ?? 0) <= 0)) {
        return new Response(JSON.stringify({ error: "Choice out of stock", message: "売り切れのものが含まれています", debugLog }), { status: 400, headers: corsHeaders });
      }
      actualPrice = setPrice;   // セット価格をサーバー確定 (選択で価格は変わらない)
      choiceRows = chs;
    } else if (listing.has_variants) {
      if (!variant_id) {
        return new Response(JSON.stringify({ error: "Variant ID required for this listing", message: "種類を選んでください", debugLog }), { status: 400, headers: corsHeaders });
      }
      const { data: variant, error: variantErr } = await supabase
        .from("listing_variants").select("*").eq("id", variant_id).eq("listing_id", listing_id).eq("is_active", true).single();
      if (variantErr || !variant) {
        return new Response(JSON.stringify({ error: "Variant not found or inactive", message: "選んだ種類は利用できません", debugLog }), { status: 404, headers: corsHeaders });
      }
      if (variant.stock <= 0) {
        return new Response(JSON.stringify({ error: "Out of stock", message: "売り切れました", debugLog }), { status: 400, headers: corsHeaders });
      }
      actualPrice = variant.price;
      variantData = variant;
      variantSnapshot = { variant_name: variant.variant_name, attributes: variant.attributes, price: variant.price, image_url: variant.image_url };
    } else {
      if (variant_id) {
        return new Response(JSON.stringify({ error: "This listing has no variants", debugLog }), { status: 400, headers: corsHeaders });
      }
      if (listing.stock_quantity !== null && listing.stock_quantity <= 0) {
        return new Response(JSON.stringify({ error: "Out of stock", message: "売り切れました", debugLog }), { status: 400, headers: corsHeaders });
      }
      actualPrice = listing.price;
    }

    debugLog.step = "calculate_total";
    debugLog.actualPrice = actualPrice;

    const optionsTotal = resolvedOptions.reduce((sum: number, o) => sum + o.price, 0);   // v41: サーバー確定価格のみ
    const listingPrice = actualPrice + optionsTotal;

    let serverShippingFee = 0;
    let resolvedShippingRegion: string | null = null;
    let resolvedShippingMethodId: string | null = null;
    let resolvedShippingMethodName: string | null = null;
    const shipType = listing.shipping_type || "included";
    debugLog.step = "resolve_shipping";
    debugLog.shipType = shipType;

    if (shipType === "flat_rate") {
      serverShippingFee = Math.max(0, parseInt(String(listing.shipping_fee || 0)) || 0);
    } else if (shipType === "regional") {
      const rates = Array.isArray(listing.shipping_rates) ? listing.shipping_rates : [];
      const rate = rates.find((r: any) => r.region === shipping_region);
      if (!rate) {
        return new Response(JSON.stringify({ error: "shipping_region_invalid", message: "選んだ配送先地域は利用できません", debugLog }), { status: 400, headers: corsHeaders });
      }
      serverShippingFee = Math.max(0, parseInt(String(rate.fee || 0)) || 0);
      resolvedShippingRegion = rate.region;
    } else if (shipType === "methods") {
      const methods = Array.isArray(listing.shipping_methods) ? listing.shipping_methods : [];
      if (methods.length === 0) {
        return new Response(JSON.stringify({ error: "no_shipping_methods", message: "配送方法が設定されていません", debugLog }), { status: 400, headers: corsHeaders });
      }
      const chosen = methods.find((m: any) => m.id === selected_shipping_method_id) || methods[0];
      if (!chosen) {
        return new Response(JSON.stringify({ error: "shipping_method_invalid", message: "選んだ配送方法は利用できません", debugLog }), { status: 400, headers: corsHeaders });
      }
      serverShippingFee = Math.max(0, parseInt(String(chosen.fee || 0)) || 0);
      resolvedShippingMethodId = String(chosen.id);
      resolvedShippingMethodName = String(chosen.name);
    }

    const settings = await getSettings(supabase, ["buyer_protection_rate"]);
    const buyerProtectionRate = parseFloat(settings.buyer_protection_rate || "0.04");
    const buyerProtectionFee = Math.floor(listingPrice * buyerProtectionRate);

    const totalAmount = listingPrice + serverShippingFee + buyerProtectionFee;
    debugLog.serverShippingFee = serverShippingFee;
    debugLog.listingPrice = listingPrice;
    debugLog.totalAmount = totalAmount;

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
    const order_number = `QC-${dateStr}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const insertData: any = {
      order_number,
      listing_id: listing_id || null,
      buyer_id: buyerId,      // v41: JWT または body (フォールバック) で確定した値
      seller_id: sellerId,    // v41: listings.seller_id (body は使わない)
      amount: totalAmount,
      listing_price: listingPrice,
      buyer_protection_fee: buyerProtectionFee,
      stripe_fee: 0, qocca_fee: 0, seller_payout: 0,
      status: "pending", escrow_status: "held",
      // Phase2 dual-write (2軸化): 旧 status に加えて新2軸も書く。読みは旧statusのまま=挙動不変。
      payment_status: "awaiting_payment", fulfillment_status: "unfulfilled",
      variant_id: variant_id || null, variant_snapshot: variantSnapshot,
      shipping_fee: serverShippingFee,
      shipping_region: resolvedShippingRegion,
      shipping_total: serverShippingFee,
    };
    if (resolvedShippingMethodId) {
      insertData.shipping_region = resolvedShippingRegion || `method:${resolvedShippingMethodName}`;
    }
    if (shipping_address_id) insertData.shipping_address_id = shipping_address_id;
    debugLog.step = "insert_order";
    debugLog.insertData = insertData;

    const { data: order, error: insertError } = await supabase.from("orders").insert(insertData).select().single();
    if (insertError) {
      return new Response(JSON.stringify({
        error: "DB insert error", insertError_message: insertError.message,
        insertError_code: insertError.code, insertError_details: insertError.details,
        insertError_hint: insertError.hint, insertError_full: JSON.stringify(insertError), debugLog
      }), { status: 500, headers: corsHeaders });
    }

    debugLog.step = "reduce_stock";
    if (isChoiceMode) {
      // 2026/7/23 Phase 2: N個の在庫をアトミック減算 (1つでも不足なら全減算せず FALSE)
      const { data: choiceOk, error: choiceStockErr } = await supabase.rpc('reduce_choices_stock', { p_choice_ids: choiceRows.map((c: any) => c.id) });
      if (choiceStockErr || !choiceOk) {
        await supabase.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", order.id);
        return new Response(JSON.stringify({ error: "Choice stock reduction failed", message: "売り切れました", debugLog }), { status: 400, headers: corsHeaders });
      }
      // 注文明細 (選んだN個を snapshot 付きで保存)
      const { error: ocErr } = await supabase.from("order_choices").insert(
        choiceRows.map((c: any) => ({ order_id: order.id, choice_id: c.id, choice_snapshot: { name: c.name } }))
      );
      if (ocErr) {
        // 明細保存失敗: 注文を取消 (在庫は戻さない=既存variantと同一方針・二重販売より安全側)
        await supabase.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", order.id);
        return new Response(JSON.stringify({ error: "order_choices insert failed", message: "注文の保存に失敗しました", debugLog }), { status: 500, headers: corsHeaders });
      }
    } else if (variant_id) {
      const { data: stockSuccess, error: stockErr } = await supabase.rpc('reduce_variant_stock', { p_variant_id: variant_id, p_quantity: 1 });
      if (stockErr || !stockSuccess) {
        await supabase.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", order.id);
        return new Response(JSON.stringify({ error: "Stock reduction failed", message: "売り切れました", debugLog }), { status: 400, headers: corsHeaders });
      }
    } else if (listing.stock_quantity !== null) {
      // v41: 単品の在庫はここでは減らさない。orders INSERT の AFTER トリガー trg_decrement_stock が
      //   既に 1 減らしており (GREATEST(stock-1, 0))、0 になれば listings の trg_auto_sold_out が sold_out に切り替える。
      //   従来はこの後にもう一度 .gte(1) で減らそうとしていたため、在庫 1 の商品はトリガーで 0 になった直後に
      //   更新が空振りし、注文が取り消されて必ず「売り切れました」になっていた (在庫 2 以上では偶然同じ値を書いて隠れていた)。
      //   売り切れの事前判定は上の validate_price_stock (stock_quantity <= 0 → 400) で行う。
      debugLog.stock = "trg_decrement_stock に委譲 (v41)";
    }

    if (shipping_address_id) {
      await supabase.from("shipping_addresses").update({ order_id: order.id }).eq("id", shipping_address_id).eq("user_id", buyerId);
    }

    debugLog.step = "stripe_call";
    debugLog.order_id = order.id;

    const productTitle = listing.title || listing_title;   // v41: 商品名もサーバー値を優先
    const productName = isChoiceMode
      ? `${productTitle}（${choiceRows.map((c: any) => c.name).join("・")}）`.slice(0, 250)
      : variantData ? `${productTitle} - ${variantData.variant_name}` : productTitle;

    const line_items: any[] = [{
      price_data: { currency: "jpy", product_data: { name: productName }, unit_amount: actualPrice },
      quantity: 1,
    }];

    if (resolvedOptions.length > 0) {
      for (const opt of resolvedOptions) {
        if (opt.name && opt.price > 0) {
          line_items.push({
            price_data: { currency: "jpy", product_data: { name: `オプション: ${opt.name}` }, unit_amount: opt.price },
            quantity: 1,
          });
        }
      }
    }

    if (serverShippingFee > 0) {
      const shipLabel = resolvedShippingMethodName
        ? `送料: ${resolvedShippingMethodName}`
        : (resolvedShippingRegion ? `送料: ${resolvedShippingRegion}` : "送料");
      line_items.push({
        price_data: { currency: "jpy", product_data: { name: shipLabel }, unit_amount: serverShippingFee },
        quantity: 1,
      });
    }

    if (buyerProtectionFee > 0) {
      line_items.push({
        price_data: { currency: "jpy", product_data: { name: "バイヤープロテクション(4%)" }, unit_amount: buyerProtectionFee },
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
    params.append("metadata[buyer_id]", buyerId || "");
    params.append("metadata[seller_id]", sellerId || "");
    params.append("metadata[shipping_address_id]", shipping_address_id || "");
    params.append("metadata[listing_price]", String(listingPrice));
    params.append("metadata[buyer_protection_fee]", String(buyerProtectionFee));
    params.append("metadata[variant_id]", variant_id || "");
    params.append("metadata[shipping_fee]", String(serverShippingFee));
    params.append("metadata[shipping_method_id]", resolvedShippingMethodId || "");
    params.append("metadata[shipping_region]", resolvedShippingRegion || "");

    line_items.forEach((item, i) => {
      params.append(`line_items[${i}][price_data][currency]`, item.price_data.currency);
      params.append(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const session = await res.json();

    if (!res.ok) {
      await supabase.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", order.id);
      if (isChoiceMode) {
        // 2026/7/23 Phase 2: 決済前失敗なので減算した選択肢在庫を戻す (variant/単品と同じ扱い)
        await supabase.rpc('restore_choices_stock', { p_choice_ids: choiceRows.map((c: any) => c.id) });
      } else if (variant_id) {
        await supabase.from("listing_variants").update({ stock: variantData.stock }).eq("id", variant_id);
      } else if (listing.stock_quantity !== null) {
        await supabase.from("listings").update({ stock_quantity: listing.stock_quantity, status: "approved" }).eq("id", listing_id);
      }
      return new Response(JSON.stringify({ error: "Stripe error", detail: session, debugLog }), { status: 500, headers: corsHeaders });
    }

    await supabase.from("orders").update({ stripe_payment_intent_id: session.id }).eq("id", order.id);

    return new Response(JSON.stringify({
      url: session.url, session_id: session.id, order_id: order.id,
      seller_payout_pending: sellerPayoutPending,
      auth_mode: authMode,   // v41: "jwt" | "body-fallback" (ログで PR2 移行の進み具合が分かる)
      breakdown: {
        listing_price: listingPrice,
        shipping_fee: serverShippingFee,
        shipping_method: resolvedShippingMethodName,
        shipping_region: resolvedShippingRegion,
        buyer_protection_fee: buyerProtectionFee,
        total_amount: totalAmount,
        variant_info: variantData ? { variant_name: variantData.variant_name, attributes: variantData.attributes } : null,
      },
    }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({
      error: "Caught error", message: err.message || String(err), stack: err.stack || null, debugLog
    }), { status: 500, headers: corsHeaders });
  }
});
