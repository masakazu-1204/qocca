// ============================================
// auto-complete-orders v1 (2026/6/15): 注文の自動完了 (②-1 C)
//   delivered かつ auto_complete_at 経過 かつ 未送金 の注文を抽出し、
//   complete-order を system 経路 ({order_id, system:true} + service_role) で呼ぶだけ。
//   ⚠️ 送金/手数料/冪等/pi_ガード/payouts判定 は全て complete-order(v33) に1本化=このfnは持たない。
//   セキュリティ: 呼び出しは service_role を持つ者(cron/サーバ)のみ許可。
//   テスト用: body.dry_run===true で「抽出のみ・complete-order を呼ばない」。
// ============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 認可(dual-auth): CRON_SECRET 一致 か service_role 一致 のどちらか。外部からの無認可起動を拒否。
  //   ・x-cron-secret ヘッダ === CRON_SECRET (King設定の専用秘密。テスト&cron用・master鍵を使わない)
  //   ・Authorization === Bearer <SUPABASE_SERVICE_ROLE_KEY> (fn間/サーバ経路・互換維持)
  const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
  const auth = req.headers.get("Authorization") || "";
  const cronSecret = req.headers.get("x-cron-secret") || "";
  const authorized = (CRON_SECRET.length > 0 && cronSecret === CRON_SECRET)
                  || (auth === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  // body は任意。dry_run のみ参照。
  let dryRun = false;
  try { const b = await req.json(); dryRun = b?.dry_run === true; } catch (_) { /* body無しでもOK */ }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();

  // 対象抽出 (Phase3: fulfillment_status ベースに切替): delivered かつ auto_complete_at 経過 かつ 未送金。
  //   disputed/working/cancelled/completed は fulfillment_status!='delivered' で自動的に対象外。
  //   期限前(auto_complete_at 未来)は lte で対象外。
  //   ※ status と fulfillment_status は dual-write で整合 (切替時 ドリフトゼロ確認済)。
  //   ※ 最終送金判定は complete-order 内部ガード(status据置)で二重に守られる。
  const { data: due, error: dueErr } = await supabase
    .from("orders")
    .select("id, order_number, buyer_id, seller_id, listing_id, status, fulfillment_status, payment_status, auto_complete_at, transferred_at, stripe_payment_intent_id")
    .eq("fulfillment_status", "delivered")
    .lte("auto_complete_at", nowIso)
    .is("transferred_at", null);

  if (dueErr) {
    return new Response(JSON.stringify({ error: "query_failed", detail: dueErr.message }), { status: 500, headers: corsHeaders });
  }

  const results: any[] = [];
  for (const o of (due || [])) {
    if (dryRun) {
      // 抽出のみ。complete-order は呼ばない (お金が動かないことを保証してテスト)
      results.push({ order_id: o.id, order_number: o.order_number, would_call: true, pay_ref: o.stripe_payment_intent_id });
      continue;
    }
    try {
      // complete-order を system 経路で呼ぶ。全ガード(pi_/payouts/v29/eligibility)は complete-order が担保。
      const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ order_id: o.id, system: true }),
      });
      const json = await res.json().catch(() => ({}));
      const ok = res.ok && json?.success === true;
      results.push({ order_id: o.id, order_number: o.order_number, http: res.status, success: !!json?.success, message: json?.message || json?.error || null });

      // 送金成立時のみ order_complete 通知 (buyer/seller 両方・best-effort)。
      // ※未決済拒否/payouts無効/二重 などは success!=true でここを通らない=メールも飛ばない。
      if (ok) {
        try {
          const [{ data: listing }, { data: profs }] = await Promise.all([
            supabase.from("listings").select("title").eq("id", o.listing_id).maybeSingle(),
            supabase.from("profiles").select("id, display_name").in("id", [o.buyer_id, o.seller_id]),
          ]);
          const buyerName = profs?.find((p: any) => p.id === o.buyer_id)?.display_name || "ご購入者";
          const sellerName = profs?.find((p: any) => p.id === o.seller_id)?.display_name || "出品者";
          const title = listing?.title || "(商品)";
          const payout = json?.breakdown?.seller_payout ?? null;
          await Promise.all([
            fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({ type: "order_complete", user_id: o.buyer_id, data: { user_name: buyerName, order_number: o.order_number, listing_title: title, is_buyer: true, review_url: "https://qocca.pet/mypage" } }),
            }).catch(() => {}),
            fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({ type: "order_complete", user_id: o.seller_id, data: { user_name: sellerName, order_number: o.order_number, listing_title: title, is_buyer: false, price: payout, payout_amount: payout } }),
            }).catch(() => {}),
          ]);
        } catch (mailErr) { console.error("order_complete email failed (非致命):", o.id, String(mailErr)); }
      }
    } catch (e) {
      results.push({ order_id: o.id, order_number: o.order_number, error: String(e) });
    }
  }

  const summary = {
    scanned: (due || []).length,
    succeeded: dryRun ? 0 : results.filter((r) => r.success).length,
    dry_run: dryRun,
    at: nowIso,
  };
  console.log("auto-complete-orders:", JSON.stringify(summary), JSON.stringify(results));
  return new Response(JSON.stringify({ ...summary, results }), { headers: corsHeaders });
});
