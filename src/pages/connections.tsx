import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabaseClient";
import { C } from "../constants/theme";
import { SharedFooter } from "../components/ui";

// Phase8 8b: SNS連携3ページを App.tsx から byte同一 line-slice 移動 (元 App.tsx 1515-2342)

export const XConnectionPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<any>(null);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<any>(null);
  const [postError, setPostError] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      const returnTo = encodeURIComponent("/settings/x");
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("x") === "connected") {
      setShowSuccess(true);
      window.history.replaceState(null, "", "/settings/x");
    }
  }, []);

  const loadConnection = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-profile",
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }
      );
      const data = await res.json();
      setConnection(data);
    } catch (e) {
      console.error("Failed to load X profile:", e);
    }
    setLoading(false);
  };

  useEffect(() => { if (user?.id) loadConnection(); }, [user?.id]);

  const startOAuth = async () => {
    if (!user?.id) return;
    setInitLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setInitLoading(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-init-oauth",
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success && data.authorize_url) {
        window.location.href = data.authorize_url;
      } else {
        alert(data.message || data.error || "OAuth 開始に失敗しました");
        setInitLoading(false);
      }
    } catch (e: any) {
      alert(e?.message || "エラー");
      setInitLoading(false);
    }
  };

  const handlePost = async () => {
    if (!postText.trim()) { setPostError("投稿内容を入力してください"); return; }
    setPosting(true); setPostError(""); setPostResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setPostError("認証エラー"); setPosting(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/x-post",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ text: postText.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setPostResult(data); setPostText("");
      } else {
        setPostError(data.message || data.error || "投稿に失敗しました");
      }
    } catch (e: any) {
      setPostError(e?.message || "投稿エラー");
    }
    setPosting(false);
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    if (!window.confirm("X との連携を解除しますか?")) return;
    setDisconnecting(true);
    try {
      await supabase.from("social_connections").delete().eq("user_id", user.id).eq("platform", "x");
      setConnection({ connected: false });
      setShowSuccess(false);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
    setDisconnecting(false);
  };

  if (!user || loading) {
    return (<div style={{ maxWidth: 600, margin: "0 auto", padding: 24, textAlign: "center", color: C.warmGray }}>読み込み中...</div>);
  }

  const isConnected = connection?.connected === true && !connection?.expired;
  const isExpired = connection?.connected === true && connection?.expired;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 0" }}>
      <button onClick={() => navigate("/mypage")} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 0", fontFamily: "inherit", minHeight: 40 }}>
        ← マイページに戻る
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginTop: 8, marginBottom: 8 }}>🐦 X 連携</h1>
      <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24, lineHeight: 1.7 }}>
        X (旧 Twitter) と連携すると、Qocca から直接 X に投稿できるようになります。<br/>連携はいつでも解除できます。
      </p>

      {showSuccess && (
        <div style={{ background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)", border: "1px solid #4CAF50", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: C.dark }}>
          ✅ X との連携が完了しました!
        </div>
      )}

      {!isConnected && !isExpired && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🐦</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 8 }}>まだ連携されていません</div>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 20, lineHeight: 1.7 }}>
            「X と連携」ボタンを押すと X の認証画面が開きます。<br/>ご自身の X アカウントで承認してください。
          </div>
          <button onClick={startOAuth} disabled={initLoading} style={{ padding: "14px 24px", background: "#000", color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: initLoading ? "wait" : "pointer", fontFamily: "inherit", minHeight: 48, width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            {initLoading ? "認証画面へ移動中..." : "🐦 X と連携する"}
          </button>
        </div>
      )}

      {isExpired && (
        <div style={{ background: "#FFF3E0", border: `1px solid ${C.orange}`, borderRadius: 12, padding: "16px 18px", fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          ⚠️ X のトークンが期限切れです。再連携してください。
          <button onClick={startOAuth} disabled={initLoading} style={{ marginTop: 12, padding: "12px 20px", background: "#000", color: "#fff", border: "none", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: initLoading ? "wait" : "pointer", fontFamily: "inherit", display: "block", width: "100%", minHeight: 40 }}>
            {initLoading ? "..." : "🐦 再連携する"}
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", flexShrink: 0 }}>
                {connection.profile?.profile_image_url ? (
                  <img src={connection.profile.profile_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : "🐦"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>@{connection.platform_username || connection.profile?.username || "X"}</div>
                {connection.profile?.name && (<div style={{ fontSize: 12, color: C.warmGray }}>{connection.profile.name}</div>)}
              </div>
            </div>
            {connection.profile?.description && (
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>
                {connection.profile.description}
              </div>
            )}
            {connection.public_metrics && (
              <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                {Object.entries(connection.public_metrics).map(([k, v]) => (
                  <div key={k} style={{ flex: "1 1 60px", textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.orange }}>{String(v ?? "-")}</div>
                    <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>{k.replace(/_/g, " ").replace(" count", "")}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 12 }}>
              連携日: {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString("ja-JP") : "-"}
              {connection.token_expires_at && (<> ・ トークン期限: {new Date(connection.token_expires_at).toLocaleString("ja-JP")}</>)}
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📝 X 投稿テスト</div>
            <textarea value={postText} onChange={(e) => setPostText(e.target.value)} maxLength={280} placeholder="ツイートする内容を入力してください..." rows={4} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 100, boxSizing: "border-box", outline: "none" }} />
            <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{postText.length} / 280</div>
            {postError && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#FFEBEE", color: "#E57373", borderRadius: 8, fontSize: 13 }}>⚠️ {postError}</div>
            )}
            {postResult?.success && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#E8F5E9", color: "#2E7D32", borderRadius: 8, fontSize: 13 }}>
                ✅ 投稿成功! Tweet ID: {postResult.tweet_id}
                {postResult.permalink && (<> ・ <a href={postResult.permalink} target="_blank" rel="noopener noreferrer" style={{ color: "#2E7D32", textDecoration: "underline" }}>X で見る</a></>)}
              </div>
            )}
            <button onClick={handlePost} disabled={posting || !postText.trim()} style={{ marginTop: 12, padding: "12px 24px", width: "100%", background: posting || !postText.trim() ? C.warmGray : "#000", color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: posting || !postText.trim() ? "wait" : "pointer", fontFamily: "inherit", minHeight: 48 }}>
              {posting ? "投稿中..." : "📤 X に投稿"}
            </button>
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 8, lineHeight: 1.6 }}>
              ℹ️ X API は Pay-Per-Use 課金です (テキスト投稿 約 $0.015/件)
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 8 }}>連携を解除</div>
            <p style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.7 }}>
              連携解除すると、Qocca から X への投稿はできなくなります。<br/>いつでも再連携できます。
            </p>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{ padding: "10px 20px", background: C.white, color: "#E57373", border: "1.5px solid #E57373", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: disconnecting ? "wait" : "pointer", fontFamily: "inherit", width: "100%", minHeight: 40 }}>
              {disconnecting ? "解除中..." : "🔓 連携を解除する"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Threads 連携ページ (Phase Threads, 2026/5/23, 案C 移植 5/27) ───────────
// Meta Threads API OAuth + 投稿テスト + 連携情報 + 連携解除
// App Review 申請の動画デモ用 UI
export const ThreadsConnectionPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<any>(null);
  const [postText, setPostText] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<any>(null);
  const [postError, setPostError] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // 依頼書 #124 (2026/6/5): 連携失敗時のエラー表示 (callback v12 が ?threads=error&reason=...&detail=... で戻すよう変更)
  const [errorBanner, setErrorBanner] = useState<{ reason: string; message: string; detail?: string } | null>(null);
  const [oauthStarting, setOauthStarting] = useState(false);

  useEffect(() => {
    if (!user) {
      const returnTo = encodeURIComponent("/settings/threads");
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // 依頼書 #124: 成功 / 失敗 両方の戻り URL を解釈
    const params = new URLSearchParams(window.location.search);
    const status = params.get("threads");
    if (status === "connected") {
      setShowSuccess(true);
      window.history.replaceState(null, "", "/settings/threads");
    } else if (status === "error") {
      const reason = params.get("reason") || "unknown";
      const detail = params.get("detail") || "";
      const reasonMap: Record<string, string> = {
        meta_denied: "Meta 側で認証がキャンセル/拒否されました",
        missing_params: "必要なパラメータが不足しています (callback URL の問題)",
        invalid_state: "セッション (state) が不正です。もう一度連携をお試しください",
        secrets_missing: "サーバー側の設定が未完了です。運営にお問い合わせください",
        token_short_failed: "アクセストークン交換失敗 (Meta App の Threads ユースケース / Redirect URI 設定を確認)",
        token_long_failed: "長期トークン (60日) 交換に失敗しました",
        db_failed: "データベース保存に失敗しました",
        unknown: "予期せぬエラーが発生しました",
      };
      setErrorBanner({ reason, message: reasonMap[reason] || reason, detail });
      window.history.replaceState(null, "", "/settings/threads");
    }
  }, []);

  const loadConnection = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/threads-profile",
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }
      );
      const data = await res.json();
      setConnection(data);
    } catch (e) {
      console.error("Failed to load Threads profile:", e);
    }
    setLoading(false);
  };

  useEffect(() => { if (user?.id) loadConnection(); }, [user?.id]);

  // 依頼書 #124 (2026/6/5): META_APP_ID ハードコードを排除 → threads-init-oauth Edge Function 経由
  //   - Meta App ID は Supabase secrets (META_APP_ID) で一元管理
  //   - フロントは authorize_url を受け取って遷移するだけ → ID 差替時に再 deploy 不要
  //   - 失敗時は callback v12 が ?threads=error&reason=... で戻る (errorBanner で表示)
  const startOAuth = async () => {
    if (!user?.id || oauthStarting) return;
    setErrorBanner(null);
    setOauthStarting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setErrorBanner({ reason: "no_session", message: "ログインセッションが切れています。再ログインしてください。" });
        setOauthStarting(false);
        return;
      }
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/threads-init-oauth",
        { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      const data = await res.json();
      if (!res.ok || !data?.authorize_url) {
        setErrorBanner({
          reason: data?.error || `http_${res.status}`,
          message: data?.message || `連携 URL の取得に失敗しました (${res.status})`,
        });
        setOauthStarting(false);
        return;
      }
      window.location.href = data.authorize_url;
    } catch (e: any) {
      setErrorBanner({ reason: "client_exception", message: `連携開始エラー: ${e?.message || e}` });
      setOauthStarting(false);
    }
  };

  const handlePost = async () => {
    if (!postText.trim()) { setPostError("投稿内容を入力してください"); return; }
    setPosting(true); setPostError(""); setPostResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setPostError("認証エラー"); setPosting(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/threads-post",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ text: postText.trim(), image_url: postImageUrl.trim() || undefined }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setPostResult(data); setPostText(""); setPostImageUrl("");
      } else {
        setPostError(data.message || data.error || "投稿に失敗しました");
      }
    } catch (e: any) {
      setPostError(e?.message || "投稿エラー");
    }
    setPosting(false);
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    if (!window.confirm("Threads との連携を解除しますか?")) return;
    setDisconnecting(true);
    try {
      await supabase.from("social_connections").delete().eq("user_id", user.id).eq("platform", "threads");
      setConnection({ connected: false });
      setShowSuccess(false);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
    setDisconnecting(false);
  };

  if (!user || loading) {
    return (<div style={{ maxWidth: 600, margin: "0 auto", padding: 24, textAlign: "center", color: C.warmGray }}>読み込み中...</div>);
  }

  const isConnected = connection?.connected === true && !connection?.expired;
  const isExpired = connection?.connected === true && connection?.expired;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 0" }}>
      <button onClick={() => navigate("/mypage")} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 0", fontFamily: "inherit", minHeight: 40 }}>
        ← マイページに戻る
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginTop: 8, marginBottom: 8 }}>🧵 Threads 連携</h1>
      <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24, lineHeight: 1.7 }}>
        Threads と連携すると、Qocca から直接 Threads に投稿できるようになります。<br/>連携はいつでも解除できます。
      </p>

      {showSuccess && (
        <div style={{ background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)", border: "1px solid #4CAF50", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: C.dark }}>
          ✅ Threads との連携が完了しました!
        </div>
      )}

      {/* 依頼書 #124 (2026/6/5): 連携失敗時のエラー表示 (callback v12 から ?threads=error で戻った時) */}
      {errorBanner && (
        <div style={{ background: "linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)", border: "1px solid #E57373", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>⚠️ 連携に失敗しました</div>
          <div>{errorBanner.message}</div>
          {errorBanner.detail && (
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6, fontFamily: "monospace", wordBreak: "break-all" }}>詳細: {errorBanner.detail}</div>
          )}
          <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6 }}>理由コード: <code>{errorBanner.reason}</code></div>
          <button onClick={() => setErrorBanner(null)} style={{ marginTop: 8, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>閉じる</button>
        </div>
      )}

      {!isConnected && !isExpired && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🧵</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 8 }}>まだ連携されていません</div>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 20, lineHeight: 1.7 }}>
            「Threads と連携」ボタンを押すと Meta の認証画面が開きます。<br/>ご自身の Threads アカウントで承認してください。
          </div>
          <button onClick={startOAuth} style={{ padding: "14px 24px", background: "#000", color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", minHeight: 48, width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            🧵 Threads と連携する
          </button>
        </div>
      )}

      {isExpired && (
        <div style={{ background: "#FFF3E0", border: `1px solid ${C.orange}`, borderRadius: 12, padding: "16px 18px", fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          ⚠️ Threads のトークンが期限切れです。再連携してください。
          <button onClick={startOAuth} style={{ marginTop: 12, padding: "12px 20px", background: "#000", color: "#fff", border: "none", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "block", width: "100%", minHeight: 40 }}>
            🧵 再連携する
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", flexShrink: 0 }}>
                {connection.profile?.profile_picture_url ? (
                  <img src={connection.profile.profile_picture_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : "🧵"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>@{connection.platform_username || connection.profile?.username || "Threads"}</div>
                {connection.profile?.name && (<div style={{ fontSize: 12, color: C.warmGray }}>{connection.profile.name}</div>)}
              </div>
            </div>
            {connection.profile?.biography && (
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>
                {connection.profile.biography}
              </div>
            )}
            {connection.insights && (
              <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                {Object.entries(connection.insights).map(([k, v]) => (
                  <div key={k} style={{ flex: "1 1 60px", textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.orange }}>{String(v ?? "-")}</div>
                    <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>{k.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 12 }}>
              連携日: {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString("ja-JP") : "-"}
              {connection.token_expires_at && (<> ・ トークン期限: {new Date(connection.token_expires_at).toLocaleDateString("ja-JP")}</>)}
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📝 Threads 投稿テスト</div>
            <textarea value={postText} onChange={(e) => setPostText(e.target.value)} maxLength={500} placeholder="投稿したい内容を入力してください..." rows={4} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 100, boxSizing: "border-box", outline: "none" }} />
            <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{postText.length} / 500</div>
            <input type="url" value={postImageUrl} onChange={(e) => setPostImageUrl(e.target.value)} placeholder="画像 URL (任意・公開アクセス可能なもの)" style={{ width: "100%", padding: "10px 12px", marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
            {postError && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#FFEBEE", color: "#E57373", borderRadius: 8, fontSize: 13 }}>⚠️ {postError}</div>
            )}
            {postResult?.success && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#E8F5E9", color: "#2E7D32", borderRadius: 8, fontSize: 13 }}>
                ✅ 投稿成功! Thread ID: {postResult.thread_id}
              </div>
            )}
            <button onClick={handlePost} disabled={posting || !postText.trim()} style={{ marginTop: 12, padding: "12px 24px", width: "100%", background: posting || !postText.trim() ? C.warmGray : "#000", color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: posting || !postText.trim() ? "wait" : "pointer", fontFamily: "inherit", minHeight: 48 }}>
              {posting ? "投稿中... (画像ありは最大30秒)" : "📤 Threads に投稿"}
            </button>
            {postImageUrl && (
              <div style={{ fontSize: 11, color: C.warmGray, marginTop: 8, lineHeight: 1.6 }}>
                ℹ️ 画像付き投稿は Meta 仕様により 30 秒待機が必要です
              </div>
            )}
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 8 }}>連携を解除</div>
            <p style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.7 }}>
              連携解除すると、Qocca から Threads への投稿はできなくなります。<br/>いつでも再連携できます。
            </p>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{ padding: "10px 20px", background: C.white, color: "#E57373", border: "1.5px solid #E57373", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: disconnecting ? "wait" : "pointer", fontFamily: "inherit", width: "100%", minHeight: 40 }}>
              {disconnecting ? "解除中..." : "🔓 連携を解除する"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Instagram 連携ページ (5/28 #25 Step 2 UI 追加 / X・Threads と同パターン) ─
// Edge Functions (instagram-init-oauth / instagram-oauth-callback / instagram-post / instagram-profile)
// は別 commit でデプロイ予定。UI 側は同パターンで先に main 反映する。
// Instagram Business Account 必須 (Personal は Graph API 非対応)。
export const InstagramConnectionPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<any>(null);
  const [postCaption, setPostCaption] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<any>(null);
  const [postError, setPostError] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // 依頼書 #126 Phase 0 (2026/6/5): #124 Threads と同型のエラーバナー導入
  //   callback v10 が ?instagram=error&reason=...&detail=... で戻す
  const [errorBanner, setErrorBanner] = useState<{ reason: string; message: string; detail?: string } | null>(null);

  useEffect(() => {
    if (!user) {
      const returnTo = encodeURIComponent("/settings/instagram");
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // 依頼書 #126 Phase 0: 成功 / 失敗 両方の戻り URL を解釈
    const params = new URLSearchParams(window.location.search);
    const status = params.get("instagram");
    if (status === "connected") {
      setShowSuccess(true);
      window.history.replaceState(null, "", "/settings/instagram");
    } else if (status === "error") {
      const reason = params.get("reason") || "unknown";
      const detail = params.get("detail") || "";
      const reasonMap: Record<string, string> = {
        meta_denied: "Meta 側で認証がキャンセル/拒否されました",
        missing_params: "必要なパラメータが不足しています (callback URL の問題)",
        invalid_state: "セッション (state) が不正です。もう一度連携をお試しください",
        secrets_missing: "サーバー側の設定が未完了です。運営にお問い合わせください",
        token_short_failed: "アクセストークン交換失敗 (Meta App / Instagram Login API 設定を確認)",
        token_long_failed: "長期トークン (60日) 交換に失敗しました",
        db_failed: "データベース保存に失敗しました",
        unknown: "予期せぬエラーが発生しました",
      };
      setErrorBanner({ reason, message: reasonMap[reason] || reason, detail });
      window.history.replaceState(null, "", "/settings/instagram");
    }
  }, []);

  // social_connections から platform='instagram' の連携情報を取得
  // Edge Function instagram-profile が未deploy の場合は DB 直読みでフォールバック
  const loadConnection = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/instagram-profile",
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
      } else {
        // Edge Function 未deploy のフォールバック: DB 直読み
        const { data: row } = await supabase
          .from("social_connections")
          .select("platform_username, connected_at, token_expires_at")
          .eq("user_id", user.id)
          .eq("platform", "instagram")
          .maybeSingle();
        if (row) {
          setConnection({
            connected: true,
            expired: row.token_expires_at ? new Date(row.token_expires_at) < new Date() : false,
            platform_username: row.platform_username,
            connected_at: row.connected_at,
            token_expires_at: row.token_expires_at,
          });
        } else {
          setConnection({ connected: false });
        }
      }
    } catch (e) {
      console.error("Failed to load Instagram profile:", e);
      setConnection({ connected: false });
    }
    setLoading(false);
  };

  useEffect(() => { if (user?.id) loadConnection(); }, [user?.id]);

  // OAuth 開始: Instagram Business Login 新方式 (依頼書 #45 緊急 / 2026/5/31)
  // 旧 Facebook Login (facebook.com + Meta App ID) では「URL を読み込めません」エラー
  // 真因: Instagram には専用の App ID + endpoint 体系がある
  //   - endpoint: https://www.instagram.com/oauth/authorize (NOT facebook.com)
  //   - client_id: Instagram アプリ ID (NOT Meta App ID)
  //   - token 交換: api.instagram.com + graph.instagram.com
  const startOAuth = () => {
    if (!user?.id) return;
    // Instagram アプリ ID (Meta Portal の「Instagram ログインによる API 設定」内 / 公開情報)
    const INSTAGRAM_APP_ID = "1674772637106046";
    const REDIRECT_URI = "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/instagram-oauth-callback";
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.append("client_id", INSTAGRAM_APP_ID);
    url.searchParams.append("redirect_uri", REDIRECT_URI);
    // 依頼書 #41: Meta 新 scope (旧 instagram_basic 等は 2025/1/27 deprecated)
    url.searchParams.append("scope", "instagram_business_basic,instagram_business_content_publish");
    url.searchParams.append("response_type", "code");
    url.searchParams.append("state", user.id);
    window.location.href = url.toString();
  };

  const handlePost = async () => {
    if (!postCaption.trim()) { setPostError("キャプションを入力してください"); return; }
    if (!postImageUrl.trim()) { setPostError("画像 URL は必須です (Instagram は画像なし投稿不可)"); return; }
    setPosting(true); setPostError(""); setPostResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setPostError("認証エラー"); setPosting(false); return; }
    try {
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/instagram-post",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ caption: postCaption.trim(), image_url: postImageUrl.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setPostResult(data); setPostCaption(""); setPostImageUrl("");
      } else {
        setPostError(data.message || data.error || "投稿に失敗しました (Edge Function 未deploy の可能性あり)");
      }
    } catch (e: any) {
      setPostError(e?.message || "投稿エラー");
    }
    setPosting(false);
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    if (!window.confirm("Instagram との連携を解除しますか?")) return;
    setDisconnecting(true);
    try {
      await supabase.from("social_connections").delete().eq("user_id", user.id).eq("platform", "instagram");
      setConnection({ connected: false });
      setShowSuccess(false);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
    setDisconnecting(false);
  };

  if (!user || loading) {
    return (<div style={{ maxWidth: 600, margin: "0 auto", padding: 24, textAlign: "center", color: C.warmGray }}>読み込み中...</div>);
  }

  const isConnected = connection?.connected === true && !connection?.expired;
  const isExpired = connection?.connected === true && connection?.expired;

  // Instagram ブランドカラー (ピンク→オレンジ→パープルのグラデ)
  const IG_GRADIENT = "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)";

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 0" }}>
      <button onClick={() => navigate("/mypage")} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 0", fontFamily: "inherit", minHeight: 40 }}>
        ← マイページに戻る
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginTop: 8, marginBottom: 8 }}>📷 Instagram 連携</h1>
      <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 16, lineHeight: 1.7 }}>
        Instagram と連携すると、Qocca から直接 Instagram に投稿できるようになります。<br/>連携はいつでも解除できます。
      </p>

      {/* Business Account 必須注意 */}
      <div style={{ background: "#FFF3E0", border: `1px solid ${C.orange}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: C.dark, lineHeight: 1.7 }}>
        ⚠️ <b>Instagram Business Account 必須</b><br/>
        Personal アカウントでは Graph API 経由の投稿ができません。<br/>
        Instagram アプリの「プロフェッショナルアカウントに切り替える」から Business 化してから連携してください。
      </div>

      {showSuccess && (
        <div style={{ background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)", border: "1px solid #4CAF50", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: C.dark }}>
          ✅ Instagram との連携が完了しました!
        </div>
      )}

      {/* 依頼書 #126 Phase 0 (2026/6/5): 連携失敗時のエラー表示 (callback v10 から ?instagram=error で戻った時) */}
      {errorBanner && (
        <div style={{ background: "linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)", border: "1px solid #E57373", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>⚠️ 連携に失敗しました</div>
          <div>{errorBanner.message}</div>
          {errorBanner.detail && (
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6, fontFamily: "monospace", wordBreak: "break-all" }}>詳細: {errorBanner.detail}</div>
          )}
          <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6 }}>理由コード: <code>{errorBanner.reason}</code></div>
          <button onClick={() => setErrorBanner(null)} style={{ marginTop: 8, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>閉じる</button>
        </div>
      )}

      {!isConnected && !isExpired && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 8 }}>まだ連携されていません</div>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 20, lineHeight: 1.7 }}>
            「Instagram と連携」ボタンを押すと Meta の認証画面が開きます。<br/>Business Account でログインして承認してください。
          </div>
          <button onClick={startOAuth} style={{ padding: "14px 24px", background: IG_GRADIENT, color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", minHeight: 48, width: "100%", boxShadow: "0 2px 8px rgba(221,42,123,0.3)" }}>
            📷 Instagram と連携する
          </button>
        </div>
      )}

      {isExpired && (
        <div style={{ background: "#FFF3E0", border: `1px solid ${C.orange}`, borderRadius: 12, padding: "16px 18px", fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
          ⚠️ Instagram のトークンが期限切れです。再連携してください。
          <button onClick={startOAuth} style={{ marginTop: 12, padding: "12px 20px", background: IG_GRADIENT, color: "#fff", border: "none", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "block", width: "100%", minHeight: 40 }}>
            📷 再連携する
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: IG_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", flexShrink: 0 }}>
                {connection.profile?.profile_picture_url ? (
                  <img src={connection.profile.profile_picture_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : "📷"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>@{connection.platform_username || connection.profile?.username || "Instagram"}</div>
                {connection.profile?.name && (<div style={{ fontSize: 12, color: C.warmGray }}>{connection.profile.name}</div>)}
                {connection.profile?.account_type && (
                  <div style={{ fontSize: 10, color: "#DD2A7B", fontWeight: 700, marginTop: 2 }}>{connection.profile.account_type}</div>
                )}
              </div>
            </div>
            {connection.profile?.biography && (
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>
                {connection.profile.biography}
              </div>
            )}
            {connection.insights && (
              <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                {Object.entries(connection.insights).map(([k, v]) => (
                  <div key={k} style={{ flex: "1 1 60px", textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#DD2A7B" }}>{String(v ?? "-")}</div>
                    <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>{k.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 12 }}>
              連携日: {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString("ja-JP") : "-"}
              {connection.token_expires_at && (<> ・ トークン期限: {new Date(connection.token_expires_at).toLocaleDateString("ja-JP")}</>)}
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📝 Instagram 投稿テスト</div>
            <input type="url" value={postImageUrl} onChange={(e) => setPostImageUrl(e.target.value)} placeholder="画像 URL (必須・公開アクセス可能な JPG/PNG)" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
            <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value)} maxLength={2200} placeholder="キャプションを入力してください (最大2200文字)..." rows={4} style={{ width: "100%", padding: "10px 12px", marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 100, boxSizing: "border-box", outline: "none" }} />
            <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{postCaption.length} / 2200</div>
            {postError && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#FFEBEE", color: "#E57373", borderRadius: 8, fontSize: 13 }}>⚠️ {postError}</div>
            )}
            {postResult?.success && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#E8F5E9", color: "#2E7D32", borderRadius: 8, fontSize: 13 }}>
                ✅ 投稿成功! Media ID: {postResult.media_id || postResult.id}
                {postResult.permalink && (<><br/><a href={postResult.permalink} target="_blank" rel="noopener" style={{ color: "#2E7D32", fontWeight: 700 }}>投稿を Instagram で見る →</a></>)}
              </div>
            )}
            <button onClick={handlePost} disabled={posting || !postCaption.trim() || !postImageUrl.trim()} style={{ marginTop: 12, padding: "12px 24px", width: "100%", background: posting || !postCaption.trim() || !postImageUrl.trim() ? C.warmGray : IG_GRADIENT, color: "#fff", border: "none", borderRadius: 22, fontSize: 14, fontWeight: 800, cursor: posting || !postCaption.trim() || !postImageUrl.trim() ? "wait" : "pointer", fontFamily: "inherit", minHeight: 48 }}>
              {posting ? "投稿中... (Instagram は 2段階フローで最大30秒)" : "📤 Instagram に投稿"}
            </button>
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 8, lineHeight: 1.6 }}>
              ℹ️ Instagram Graph API は 2段階フロー (media container 作成 → publish)<br/>
              ℹ️ 画像なし投稿は不可。最低 1枚の画像必須。
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 8 }}>連携を解除</div>
            <p style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.7 }}>
              連携解除すると、Qocca から Instagram への投稿はできなくなります。<br/>いつでも再連携できます。
            </p>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{ padding: "10px 20px", background: C.white, color: "#E57373", border: "1.5px solid #E57373", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: disconnecting ? "wait" : "pointer", fontFamily: "inherit", width: "100%", minHeight: 40 }}>
              {disconnecting ? "解除中..." : "🔓 連携を解除する"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// FoundingCreatorsPage は pages/static.tsx へ移動 (Phase5 ①static)

// InitialMembersSection は pages/home.tsx へ移動 (Phase8 8a / HomePage が render)

// SponsorsPage は pages/static.tsx へ移動 (Phase5 ①static)

// LegalPage は pages/static.tsx へ移動 (Phase5 ①static)

// FAQPage は pages/static.tsx へ移動 (Phase5 ①static)

// ── Shared Footer ─────────────────────────────────────────────────────────
// SharedFooter は components/ui.tsx へ移動 (Phase 4-b)

// ── LIKED ──────────────────────────────────────────────────────────────────
