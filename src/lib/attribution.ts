// ============================================
// 登録流入元トラッキング (2026/7/17 King承認「UTM GO」)
//
// 仕組み (ファーストタッチ方式):
//   1. captureAttribution() — アプリ初回ロード時に URL の utm_* と外部リファラーを
//      localStorage に保存。既に保存済みなら上書きしない (= 最初に連れてきた経路が勝つ)。
//      登録がメール認証などで数日後になっても、最初の訪問経路が残る。
//   2. saveRegistrationSource(userId) — 初回ログイン検知 (App.tsx の CompleteRegistration
//      と同じタイミング) で registration_sources に1行だけ INSERT。
//      保存された属性が無ければ全カラム null = 「直接 or 記録なし」として1行残す。
//
// 🛡️ 安全設計:
//   - 個人情報は扱わない (UTM 文字列とリファラー URL のみ・各256文字に切詰め)
//   - 失敗しても静かに諦める (登録フローには一切影響させない)
//   - AuthContext 非接触 (呼び出し側が user.id を渡すだけ)
// ============================================

import { supabase } from "../supabaseClient";

const ATTR_KEY = "qocca_attr_v1";

// OAuth コールバック等の内部的なリファラーは流入元として意味がないので除外
const REFERRER_IGNORE = ["accounts.google.com", "supabase.co", "qocca.pet", "localhost"];

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

// 2026/7/31 計測の穴ふさぎ:
//   Meta のアプリ内ブラウザから外部ブラウザへ飛ぶと、URL の utm_* もリファラーも失われる。
//   そのため広告経由の登録が全て「直接/不明」に落ちていた (7月の登録21名中 UTM 判明 0件)。
//   → 広告の着地先を専用パスにしておけば「パスそのもの」が経路の証拠になる。
//     クエリが消えてもパスは残るため、QRカードと同じ発想で確実に効く。
const CAMPAIGN_PATH_PREFIXES = ["/welcome"];
export const isCampaignPath = (path: string): boolean =>
  CAMPAIGN_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

type StoredAttr = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
  first_seen_at: string | null;
};

const clip = (v: string | null): string | null => (v ? v.slice(0, 256) : null);

// アプリ初回ロード時に呼ぶ。utm_* か外部リファラーがある時だけ保存 (直接訪問は何も残さない)。
export function captureAttribution(): void {
  try {
    if (localStorage.getItem(ATTR_KEY)) return; // ファーストタッチ維持
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string | null> = {};
    for (const k of UTM_KEYS) utm[k] = clip(params.get(k));

    let referrer: string | null = null;
    const raw = document.referrer || "";
    if (raw) {
      try {
        const host = new URL(raw).hostname;
        const isInternal = host === window.location.hostname || REFERRER_IGNORE.some((d) => host === d || host.endsWith(`.${d}`));
        if (!isInternal) referrer = clip(raw);
      } catch { /* 壊れた referrer は無視 */ }
    }

    const landingPath = window.location.pathname;
    // utm も referrer も無い「素の着地」でも、専用パスなら経路が確定するので必ず記録する
    const hasUtm = UTM_KEYS.some((k) => utm[k]);
    if (!hasUtm && !referrer && !isCampaignPath(landingPath)) return;

    const attr: StoredAttr = {
      utm_source: utm.utm_source, utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content, utm_term: utm.utm_term,
      referrer,
      landing_path: clip(landingPath),
      first_seen_at: new Date().toISOString(),
    };
    localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
  } catch { /* localStorage 不可環境では諦める */ }
}

// 初回ログイン検知時に呼ぶ。user_id 単位で1回だけ registration_sources に記録。
export async function saveRegistrationSource(userId: string): Promise<void> {
  const sentKey = `qocca_attr_sent_${userId}`;
  try { if (localStorage.getItem(sentKey)) return; } catch { /* ガード不可でも続行 (PK 重複で二重は防がれる) */ }

  let attr: Partial<StoredAttr> = {};
  try { attr = JSON.parse(localStorage.getItem(ATTR_KEY) || "{}") || {}; } catch { /* 破損は空扱い */ }

  const { error } = await supabase.from("registration_sources").insert({
    user_id: userId,
    utm_source: attr.utm_source ?? null,
    utm_medium: attr.utm_medium ?? null,
    utm_campaign: attr.utm_campaign ?? null,
    utm_content: attr.utm_content ?? null,
    utm_term: attr.utm_term ?? null,
    referrer: attr.referrer ?? null,
    landing_path: attr.landing_path ?? null,
    first_seen_at: attr.first_seen_at ?? null,
  });
  // 成功 or 既に行がある (23505) → 送信済みマーク
  if (!error || error.code === "23505") {
    try { localStorage.setItem(sentKey, "1"); } catch { /* no-op */ }
  }
}
