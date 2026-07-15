// 保存(♡)を未ログインで押した時の ログイン誘導トースト (2026/7/13 お気に入り拡張 Phase1)
//   Before: App.tsx onLike が `if (user)` で黙って無反応 → 会員登録の機会損失
//   After : 未ログインでも押せて、静かにログインへ誘導する
// 設計: AshiatoDailyGrant と同作法の自己完結トースト。画面下からふわっと・タップで/loginへ。
//   4秒表示 → フェードアウト。絵文字なし・QC世界観の静かな誘導。
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../constants/theme";

export const LoginPromptToast = ({ show, onDone }: { show: boolean; onDone: () => void }) => {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setLeaving(false);
    const t1 = setTimeout(() => setLeaving(true), 4000);
    const t2 = setTimeout(() => onDone(), 4600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div
      onClick={() => { onDone(); navigate("/login"); }}
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
        transform: `translateX(-50%) translateY(${leaving ? "8px" : "0"})`,
        opacity: leaving ? 0 : 1,
        transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        gap: 14,
        maxWidth: "calc(100vw - 32px)",
        padding: "13px 18px",
        borderRadius: 999,
        background: C.white,
        border: `1px solid ${C.border}`,
        boxShadow: "0 6px 24px rgba(26,18,8,0.12)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 13.5, color: C.dark, fontWeight: 500, whiteSpace: "nowrap" }}>
        保存するには、ログインを。
      </span>
      <span style={{ fontSize: 12.5, color: C.orange, fontWeight: 700, whiteSpace: "nowrap" }}>
        ログイン
      </span>
    </div>
  );
};
