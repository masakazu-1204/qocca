// ============================================
// complete-order v33 (2026/6/15): 自動完了 system 認可経路 追加 (②-1 B)
//   v30 buyer認可のみを service_role 経路で迂回。pi_ガード(v32)/payouts判定/v29冪等 は全継承。
//   識別: Authorization が service_role キー かつ body.system===true の時のみ system 扱い。
//   濫用防止: status==='delivered' かつ auto_complete_at 経過 でなければ system でも拒否。
//   ⚠️ 既存の transfer/fee/v29/v30/v32 ロジックは 1行も変更していない (分岐の追加のみ)。
// --- 以下 v32 までの履歴 ---
// complete-order v32 (2026/6/15): 決済成立ガード追加 (未決済 立替送金の防止)
//   status guard 通過後・v30/原子的クレームの手前に pi_ 検証を追加。cs_(未決済)は送金拒否。
//   既存の transfer/fee/v29/v30 ロジックは 1行も変更していない (拒否ガード追加のみ)。
// --- 以下 v31 までの履歴 ---
// complete-order v31 (依頼書 #143 TOP3 方式C, 2026/6/11)
//   v31 変更: welcome キャンペーン判定のみ 「注文作成時(order.created_at)」基準に変更
//     - 受注生産品(羊毛フェルト等 3-4週間)が welcome 期間中に購入されれば、受取確認が8月でも 0% 適用
//     - 変更は welcome の if 条件の比較対象 (now → order.created_at) のみ
//     - 他 tier(standard/first/3M/early/founding)・min()・v29防御・v30認可 は 1行も変えない
//   v30: 認可チェック (buyer本人 or admin)
//   v29: 二重送金封鎖 (Idempotency-Key + 原子的クレーム)
//   v26: founding_creator + 最有利率採用 (#133 Phase A1)
//   v25: 送料を seller_payout に加算 (#127)
// ============================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WELCOME_CAMPAIGN_START = new Date("2026-06-01T00:00:00+09:00");
const WELCOME_CAMPAIGN_END = new Date("2026-07-31T23:59:59+09:00");

async function getSettings(supabase: any, keys: string[]): Promise<Record<string, string>> {
  const { data } = await supabase.from("platform_settings").select("key, value").in("key", keys);
  const result: Record<string, string> = {};
  for (const row of data || []) result[row.key] = row.value;
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { order_id, completed_by_user_id, system } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, amount, listing_price, buyer_protection_fee, status, escrow_status, buyer_id, seller_id, transferred_at, stripe_payment_intent_id, created_at, shipping_fee, shipping_region")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: corsHeaders });
    }

    if (order.transferred_at) {
      return new Response(JSON.stringify({
        success: false, message: "Already transferred", order_id: order.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!["working", "delivered"].includes(order.status)) {
      return new Response(JSON.stringify({
        error: "Order is not in transferable state", current_status: order.status,
      }), { status: 400, headers: corsHeaders });
    }

    // ============================================
    // 🔒 v32 (2026/6/15): 決済成立ガード (未決済 立替送金の防止 / Option②案①)
    //   stripe_payment_intent_id は create-checkout 時点では Checkout Session ID(cs_)、
    //   決済成立時に stripe-webhook が PaymentIntent ID(pi_) で上書きする。
    //   → pi_ で始まらない注文 = 決済未完了 = 立替送金を拒否 (transfer 手前で return)。
    //   ⚠️ 既存の transfer/fee/v29(原子的クレーム)/v30(認可) は 1行も変えない。拒否ガード追加のみ。
    // ============================================
    if (!String(order.stripe_payment_intent_id || "").startsWith("pi_")) {
      return new Response(JSON.stringify({
        error: "payment_not_completed",
        message: "決済が完了していません。送金できません。",
        current_payment_ref: order.stripe_payment_intent_id || null,
      }), { status: 400, headers: corsHeaders });
    }

    // ============================================
    // 🔒 v30 認可 (buyer本人 or admin) / v33 system(自動完了cron)認可 — 分岐
    // order 取得後 ・ 原子的クレームの手前に配置 (v29 防御は不変)
    // ⚠️ v33: 迂回するのは buyer認可(v30)のみ。pi_ガード(v32)は上で実行済 / payouts判定・v29冪等は下で実行=全継承。
    // ============================================
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    // v33: system 呼び出し判定 = service_role キー かつ body.system===true
    //   (service_role キーは cron/サーバのみが保持。外部呼び出しは到達不可)
    const isSystemCall = system === true && token === SUPABASE_SERVICE_ROLE_KEY;

    if (isSystemCall) {
      // v33: buyer認可の代わりに「自動完了の厳格条件」を課す。
      //   delivered かつ auto_complete_at が設定済かつ既に経過 でなければ system でも拒否。
      //   → working / 期限前 / auto_complete_at未設定 を system が勝手に完了することは不可能。
      if (order.status !== "delivered" || !order.auto_complete_at || new Date(order.auto_complete_at) > new Date()) {
        return new Response(JSON.stringify({
          error: "not_eligible_for_auto_complete",
          message: "自動完了の条件を満たしていません (delivered かつ auto_complete_at 経過が必要)",
          current_status: order.status, auto_complete_at: order.auto_complete_at || null,
        }), { status: 400, headers: corsHeaders });
      }
      // → buyer認可(v30)をスキップして続行 (system = service_role を持つ信頼済呼び出し)
    } else {
      // 通常のユーザー呼び出し: 既存 v30 認可 (buyer本人 or admin) — 挙動は一切不変
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      const callerId = caller?.id || null;
      if (!callerId) {
        return new Response(JSON.stringify({ error: "unauthorized", message: "認証が必要です" }), { status: 401, headers: corsHeaders });
      }
      if (callerId !== order.buyer_id) {
        // buyer 本人でなければ admin か確認 (admins テーブル直接照会 / is_admin() は auth.uid() 依存のため使わない)
        const { data: adminRow } = await supabase
          .from("admins").select("user_id").eq("user_id", callerId).maybeSingle();
        if (!adminRow) {
          return new Response(JSON.stringify({
            error: "forbidden", message: "この操作は購入者本人のみ可能です"
          }), { status: 403, headers: corsHeaders });
        }
      }
    }

    // v26: is_founding_creator + founding_creator_fee_rate を追加 select
    const { data: seller } = await supabase
      .from("profiles")
      .select("id, stripe_account_id, stripe_payouts_enabled, fee_tier, created_at, early_supporter_expires_at, is_founding_creator, founding_creator_fee_rate")
      .eq("id", order.seller_id)
      .single();

    if (!seller || !seller.stripe_account_id || !seller.stripe_payouts_enabled) {
      await supabase.from("orders").update({
        status: "completed", escrow_status: "held", transfer_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", order_id);
      return new Response(JSON.stringify({
        success: false,
        message: "Seller has not connected Stripe yet. Order marked as completed but payout pending.",
        order_id: order.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const settings = await getSettings(supabase, [
      "fee_first_transaction", "fee_within_3months", "fee_standard",
      "fee_discount_period_days", "stripe_processing_fee_rate",
    ]);

    const feeFirst = parseFloat(settings.fee_first_transaction || "0");
    const fee3M = parseFloat(settings.fee_within_3months || "0.05");
    const feeStd = parseFloat(settings.fee_standard || "0.10");
    const discountDays = parseInt(settings.fee_discount_period_days || "90");
    const stripeFeeRate = parseFloat(settings.stripe_processing_fee_rate || "0.036");

    const { count: sellerOrderCount } = await supabase
      .from("orders").select("id", { count: "exact", head: true })
      .eq("seller_id", order.seller_id).eq("status", "completed").not("transferred_at", "is", null);

    const now = new Date();

    // ============================================
    // v26 🌟 「最有利率を採用」ロジック
    // ============================================
    const candidates: Array<{ rate: number; tier: string }> = [];
    candidates.push({ rate: feeStd, tier: "standard" });
    // 依頼書 #143 TOP3 方式C (2026/6/11): welcome 判定のみ 「注文作成時(order.created_at)」基準
    // → 受注生産品が welcome 期間中に購入されれば、受取確認が8月でも 0% 適用 (取りこぼし防止)
    const orderCreatedAt = new Date(order.created_at);
    if (orderCreatedAt >= WELCOME_CAMPAIGN_START && orderCreatedAt <= WELCOME_CAMPAIGN_END) {
      candidates.push({ rate: 0, tier: "welcome_campaign" });
    }
    if ((sellerOrderCount || 0) === 0) {
      candidates.push({ rate: feeFirst, tier: "first_transaction" });
    }
    if (seller.early_supporter_expires_at && new Date(seller.early_supporter_expires_at) > now) {
      candidates.push({ rate: fee3M, tier: "early_supporter" });
    }
    const sellerCreatedAt = new Date(seller.created_at);
    const daysSinceRegistration = (now.getTime() - sellerCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceRegistration <= discountDays) {
      candidates.push({ rate: fee3M, tier: "within_3months" });
    }
    if (seller.is_founding_creator && seller.founding_creator_fee_rate != null) {
      const fcRate = Number(seller.founding_creator_fee_rate) / 100; // 3 → 0.03
      candidates.push({ rate: fcRate, tier: "founding_creator_3" });
    }

    const winning = candidates.reduce((best, c) => (c.rate < best.rate ? c : best), candidates[0]);
    const qoccaFeeRate = winning.rate;
    const feeTierUsed = winning.tier;

    const feeCandidatesStr = candidates
      .map((c) => `${c.tier}:${(c.rate * 100).toFixed(2)}%`)
      .join(",");

    // ============================================
    // 依頼書 #127 Phase C (v25 維持): 送料を seller_payout に加算
    // ============================================
    const listingPrice = order.listing_price || order.amount;
    const shippingFee = Number(order.shipping_fee || 0);
    const grossAmount = order.amount;
    const stripeFee = Math.floor(grossAmount * stripeFeeRate);
    const qoccaFee = Math.floor(listingPrice * qoccaFeeRate);
    const sellerPayout = listingPrice + shippingFee - qoccaFee;

    if (sellerPayout <= 0) {
      return new Response(JSON.stringify({
        error: "Calculated payout is zero or negative",
        details: { listingPrice, shippingFee, grossAmount, stripeFee, qoccaFee, sellerPayout }
      }), { status: 400, headers: corsHeaders });
    }

    // ============================================
    // 🔒 v29 Step 2 (#143 TOP1): 原子的クレーム (多層防御)
    // ============================================
    const { data: claimed, error: claimErr } = await supabase
      .from("orders")
      .update({ transfer_status: "processing", updated_at: new Date().toISOString() })
      .eq("id", order_id)
      .is("transferred_at", null)
      .or("transfer_status.is.null,transfer_status.neq.processing")
      .select("id");

    if (claimErr) {
      console.error("Atomic claim error:", claimErr);
      return new Response(JSON.stringify({ error: "Claim failed", detail: claimErr.message }), { status: 500, headers: corsHeaders });
    }
    if (!claimed || claimed.length === 0) {
      return new Response(JSON.stringify({
        success: false, message: "Already processing or transferred", order_id: order.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const transferParams = new URLSearchParams();
    transferParams.append("amount", sellerPayout.toString());
    transferParams.append("currency", "jpy");
    transferParams.append("destination", seller.stripe_account_id);
    transferParams.append("transfer_group", `order_${order.order_number}`);
    transferParams.append("metadata[order_id]", order.id);
    transferParams.append("metadata[order_number]", order.order_number);
    transferParams.append("metadata[seller_id]", order.seller_id);
    transferParams.append("metadata[buyer_id]", order.buyer_id);
    transferParams.append("metadata[fee_tier]", feeTierUsed);
    transferParams.append("metadata[fee_candidates]", feeCandidatesStr);
    transferParams.append("metadata[listing_price]", listingPrice.toString());
    transferParams.append("metadata[shipping_fee]", shippingFee.toString());
    transferParams.append("metadata[qocca_fee]", qoccaFee.toString());
    transferParams.append("metadata[stripe_fee]", stripeFee.toString());

    // 🔒 v29 Step 1 (#143 TOP1): Idempotency-Key で Stripe 側 重複送金 自動排除
    const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `transfer_${order_id}`,
      },
      body: transferParams,
    });

    const transferData = await transferRes.json();

    if (!transferRes.ok) {
      console.error("Stripe transfer failed:", transferData);
      await supabase.from("orders").update({
        status: "completed", escrow_status: "held", transfer_status: "failed",
        updated_at: new Date().toISOString(),
      }).eq("id", order_id);
      return new Response(JSON.stringify({ error: "Stripe transfer failed", detail: transferData }), { status: 500, headers: corsHeaders });
    }

    await supabase.from("orders").update({
      status: "completed", escrow_status: "released_seller",
      stripe_transfer_id: transferData.id, transferred_at: new Date().toISOString(),
      transfer_amount: sellerPayout, transfer_status: "paid",
      stripe_fee: stripeFee, qocca_fee: qoccaFee, seller_payout: sellerPayout,
      fee_tier_used: feeTierUsed, updated_at: new Date().toISOString(),
    }).eq("id", order_id);

    return new Response(JSON.stringify({
      success: true, transfer_id: transferData.id, amount: sellerPayout, fee_tier: feeTierUsed,
      fee_candidates: feeCandidatesStr,
      breakdown: {
        listing_price: listingPrice,
        shipping_fee: shippingFee,
        buyer_protection_fee: order.buyer_protection_fee || 0,
        gross_amount: grossAmount,
        stripe_fee: stripeFee,
        qocca_fee: qoccaFee,
        qocca_fee_rate: qoccaFeeRate,
        seller_payout: sellerPayout,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("Complete order error:", err);
    return new Response(JSON.stringify({
      error: "Caught error", message: err.message || String(err), stack: err.stack || null,
    }), { status: 500, headers: corsHeaders });
  }
});
