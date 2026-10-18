// 2026/10/18 街だよりの配信停止ページ (/unsubscribe?t=<token>)
//   メール末尾のリンクから来る。ログイン不要。開いた時点で停止し、押し間違いならその場で戻せる。
//   判定と更新は RPC set_town_letter_subscription (security definer・トークンを知っている人だけ)。
import { useEffect, useState } from "react";
import { QC, QC_FONT_JP, QC_FONT_EN } from "../constants/theme";
import { supabase } from "../supabaseClient";

type State = "loading" | "unsubscribed" | "subscribed" | "not_found" | "error";

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UnsubscribePage = () => {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const token = (() => {
    try { return new URLSearchParams(window.location.search).get("t") ?? ""; } catch (_) { return ""; }
  })();

  const apply = async (subscribe: boolean) => {
    if (!TOKEN_RE.test(token)) { setState("not_found"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("set_town_letter_subscription", { p_token: token, p_subscribe: subscribe });
    setBusy(false);
    if (error) { setState("error"); return; }
    setState(data === "subscribed" ? "subscribed" : data === "unsubscribed" ? "unsubscribed" : "not_found");
  };

  useEffect(() => { apply(false); /* 開いた時点で停止 */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const title: Record<State, string> = {
    loading: "手続きをしています。",
    unsubscribed: "街だよりの配信を止めました。",
    subscribed: "街だよりを、また受け取れるようにしました。",
    not_found: "このリンクは使えないようです。",
    error: "うまく手続きできませんでした。",
  };
  const note: Record<State, string> = {
    loading: "",
    unsubscribed: "これまで読んでくださって、ありがとうございました。\nQocca の街には、いつでも戻ってきてください。",
    subscribed: "来週の月曜日から、また届きます。",
    not_found: "お手数ですが、メールのリンクからもう一度開くか、support@qocca.pet までご連絡ください。",
    error: "少し時間をおいてから、もう一度メールのリンクを開いてください。",
  };

  return (
    <div style={{ minHeight: "100vh", background: QC.warmWhite, display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 24px" }}>
      <div style={{ maxWidth: 480, textAlign: "center", fontFamily: QC_FONT_JP }}>
        <p style={{ fontFamily: QC_FONT_EN, fontSize: 13, fontStyle: "italic", color: QC.warmGray, letterSpacing: 1, margin: "0 0 24px", opacity: 0.75, fontWeight: 300 }}>
          Town Letter
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: QC.softBrown, lineHeight: 1.8, margin: "0 0 24px", letterSpacing: "0.04em" }}>
          {title[state]}
        </h1>
        {note[state] && (
          <p style={{ fontSize: 13, fontWeight: 300, color: QC.warmGray, lineHeight: 2, margin: "0 0 40px", whiteSpace: "pre-line" }}>
            {note[state]}
          </p>
        )}
        {state === "unsubscribed" && (
          <button
            onClick={() => apply(true)}
            disabled={busy}
            style={{
              fontFamily: QC_FONT_JP, background: "transparent", color: QC.terracotta, border: `1px solid ${QC.terracotta}`,
              padding: "14px 36px", fontSize: 13, fontWeight: 300, letterSpacing: 1.5, cursor: busy ? "default" : "pointer",
              borderRadius: 0, transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            押し間違えたので、また受け取る
          </button>
        )}
        <p style={{ margin: "48px 0 0" }}>
          <a href="/" style={{ fontSize: 12, color: QC.warmGray, letterSpacing: 1 }}>Qocca の街へ戻る</a>
        </p>
      </div>
    </div>
  );
};
