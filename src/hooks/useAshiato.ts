// 「あしあと」🐾 通貨フック (Phase C-1 UI第1弾・2026/7/4)
// - useAshiatoBalance: 残高取得 (currency_balances RLS SELECT・本人のみ)
// - grantDailyLogin: デイリーログイン付与 (冪等・1日1回)
//   二重ガード: ① localStorage (当日呼出済みならRPC自体を呼ばない・通信節約)
//              ② RPC側 idempotency_key UNIQUE + daily_cap (バックエンドの最終防壁)
// ⚠️ バックエンド (テーブル/RPC) は変更しない。呼び出しのみ。

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

// JST の今日 (YYYY-MM-DD)
const jstToday = (): string =>
  new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 残高取得フック。未ログイン/ウォレット未作成は free=0 */
export function useAshiatoBalance(userId: string | undefined) {
  const [free, setFree] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) { setFree(0); setLoading(false); return; }
    const { data } = await supabase
      .from("currency_balances")
      .select("free_balance")
      .eq("user_id", userId)
      .maybeSingle();
    setFree(data?.free_balance ?? 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  // 付与/消費が起きたら再取得できるよう、カスタムイベントを購読
  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener("ashiatoChanged", onChanged);
    return () => window.removeEventListener("ashiatoChanged", onChanged);
  }, [refresh]);

  return { free, loading, refresh };
}

/**
 * デイリーログイン付与。成功して新規付与された場合のみ granted 数を返す (それ以外は 0)。
 * 呼び出し側はこの戻り値 > 0 の時だけトーストを出す (重複時・上限時は無言 = 設計書 §3-2)。
 */
export async function grantDailyLogin(userId: string): Promise<number> {
  const today = jstToday();
  const lsKey = `qocca_ashiato_daily_${userId}`;
  try {
    // ① ローカルガード: 当日実行済みなら RPC を呼ばない
    if (localStorage.getItem(lsKey) === today) return 0;
  } catch (_) { /* localStorage 不可環境は RPC側ガードに任せる */ }

  try {
    const { data, error } = await supabase.rpc("grant_free_currency", {
      p_rule_key: "daily_login",
      p_idempotency_key: `daily:${userId}:${today}`,   // ② RPC側 UNIQUE で構造的冪等
    });
    if (error) return 0; // 付与失敗はUXをブロックしない (静かに無視)
    try { localStorage.setItem(lsKey, today); } catch (_) { /* no-op */ }
    if (data?.success && !data?.duplicated && (data?.granted ?? 0) > 0) {
      window.dispatchEvent(new Event("ashiatoChanged")); // 残高表示に反映
      return data.granted as number;
    }
    return 0;
  } catch (_) {
    return 0;
  }
}
