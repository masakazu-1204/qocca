// ============================================
// retry-pending-payouts v1 (F1 B2, 2026/6/16): 固着pendingの再送金 (連携完了後に過去売上を届ける)
//   抽出: status='completed' かつ transfer_status IN ('pending','failed') かつ transferred_at IS NULL (=固着pending)。
//   各注文に complete-order を system 経路 ({order_id, system:true} + service_role) で呼ぶだけ。
//   ⚠️ 送金/手数料/冪等(Idempotency-Key)/pi_ガード/payouts判定/原子的クレーム は全て complete-order(v37) に1本化=このfnは持たない。
//   ⚠️ payouts まだ無効なら complete-order が pending 維持 (空振り・送金ゼロ)。連携済なら 1回だけ送金。
//   ⚠️ 二重送金防止: transferred_at IS NULL で抽出 + complete-order の transferred_at guard + 原子的クレーム + Idempotency-Key。
//   セキュリティ: 呼び出しは CRON_SECRET か service_role を持つ者(cron/サーバ)のみ許可 (dual-auth)。verify_jwt:false。
//   テスト用: body.dry_run===true で「抽出のみ・complete-order を呼ばない」(お金が動かないことを保証)。
//   ※ auto-complete-orders と同型。差分は抽出条件(固着pending)と成功時メール(seller のみ=buyerは完了時に通知済)。
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

  // 対象抽出: 固着pending = status='completed' かつ transfer_status IN ('pending','failed') かつ 未送金。
  //   ・processing は除外 (Stripe成功後DB更新前クラッシュ等で24h idempotency窓越え二重送金を回避=保守)。
  //   ・transferred_at IS NULL で「既に送金済」を構造的に除外 (二重送金防止の第1層)。
  //   ※ 最終送金判定は complete-order(v37) 内部ガードで多層に守られる (このfnは呼ぶだけ)。
  const { data: stuck, error: stuckErr } = await supabase
    .from("orders")
    .select("id, order_number, buyer_id, seller_id, listing_id, status, fulfillment_status, payment_status, transfer_status, transferred_at, stripe_payment_intent_id, seller_payout")
    .eq("status", "completed")
    .in("transfer_status", ["pending", "failed"])
    .is("transferred_at", null);

  if (stuckErr) {
    return new Response(JSON.stringify({ error: "query_failed", detail: stuckErr.message }), { status: 500, headers: corsHeaders });
  }

  const results: any[] = [];
  for (const o of (stuck || [])) {
    if (dryRun) {
      // 抽出のみ。complete-order は呼ばない (お金が動かないことを保証してテスト)
      results.push({
        order_id: o.id, order_number: o.order_number, would_call: true,
        transfer_status: o.transfer_status, pay_ref: o.stripe_payment_intent_id,
        pending_payout: o.seller_payout,
      });
      continue;
    }
    try {
      // complete-order を system 経路で呼ぶ。全ガード(入口/pi_/payouts/v29/Idempotency)は complete-order(v37) が担保。
      const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ order_id: o.id, system: true }),
      });
      const json = await res.json().catch(() => ({}));
      const ok = res.ok && json?.success === true;
      results.push({ order_id: o.id, order_number: o.order_number, http: res.status, success: !!json?.success, message: json?.message || json?.error || null });

      // 送金成立時のみ seller へ「売上が届いた」通知 (best-effort)。
      // ※buyerは注文完了時に既に通知済のため再送しない。payouts無効/二重 などは success!=true でここを通らない。
      if (ok) {
        try {
          const [{ data: listing }, { data: sellerProf }] = await Promise.all([
            supabase.from("listings").select("title").eq("id", o.listing_id).maybeSingle(),
            supabase.from("profiles").select("id, display_name").eq("id", o.seller_id).maybeSingle(),
          ]);
          const sellerName = sellerProf?.display_name || "出品者";
          const title = listing?.title || "(商品)";
          const payout = json?.breakdown?.seller_payout ?? o.seller_payout ?? null;
          await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ type: "order_complete", user_id: o.seller_id, data: { user_name: sellerName, order_number: o.order_number, listing_title: title, is_buyer: false, price: payout, payout_amount: payout } }),
          }).catch(() => {});
        } catch (mailErr) { console.error("retry payout email failed (非致命):", o.id, String(mailErr)); }
      }
    } catch (e) {
      results.push({ order_id: o.id, order_number: o.order_number, error: String(e) });
    }
  }

  const summary = {
    scanned: (stuck || []).length,
    succeeded: dryRun ? 0 : results.filter((r) => r.success).length,
    dry_run: dryRun,
    at: nowIso,
  };
  console.log("retry-pending-payouts:", JSON.stringify(summary), JSON.stringify(results));
  return new Response(JSON.stringify({ ...summary, results }), { headers: corsHeaders });
});
