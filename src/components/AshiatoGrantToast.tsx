// 「あしあと」🐾 デイリー付与トースト (Phase C-1 UI第1弾)
// 自己完結コンポーネント: マウント時 (=アプリ起動時・user確定後) に grantDailyLogin を1回実行し、
// 新規付与があった時だけ画面下からふわっとトーストを出す (設計書§3-1)。
// - 2.5秒表示 → ふわっと消える。タップで即閉じ。音なし・画面中央を塞がない。
// - 重複時/上限時/失敗時は無言 (何も表示しない)。
// App.tsx へは <AshiatoDailyGrant /> のマウント1行だけで済む設計 (肥大防止)。

import { useState, useEffect, useRef } from "react";
import { AshiatoIcon } from "./AshiatoIcon";
import { grantDailyLogin } from "../hooks/useAshiato";
import { useAuth } from "../contexts/AuthContext";
import { C } from "../constants/theme";

export const AshiatoDailyGrant = () => {
  const auth = useAuth() as { user?: { id: string } | null } | null;
  const user = auth?.user;
  const [granted, setGranted] = useState<number>(0);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const firedRef = useRef(false); // StrictMode/再レンダーでの二重発火ガード (セッション内1回)

  useEffect(() => {
    if (!user?.id || firedRef.current) return;
    firedRef.current = true;
    (async () => {
      const n = await grantDailyLogin(user.id);
      if (n > 0) {
        setGranted(n);
        setVisible(true);
        // 2.5秒表示 → 0.6秒かけてフェードアウト
        setTimeout(() => setLeaving(true), 2500);
        setTimeout(() => setVisible(false), 3100);
      }
    })();
  }, [user?.id]);

  if (!visible) return null;

  return (
    <div
      onClick={() => { setLeaving(true); setTimeout(() => setVisible(false), 300); }}
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(96px + env(safe-area-inset-bottom, 0px))", // TabBar(70)+余裕
        transform: leaving ? "translate(-50%, 12px)" : "translate(-50%, 0)",
        opacity: leaving ? 0 : 1,
        transition: "opacity 0.6s ease, transform 0.6s ease",
        zIndex: 300,
        background: "rgba(255, 252, 247, 0.97)",
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "12px 20px",
        boxShadow: "0 6px 20px rgba(245, 169, 74, 0.18)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        // 出現アニメ: 下からふわっと (keyframes は inline animation)
        animation: "ashiatoToastIn 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <style>{`
        @keyframes ashiatoToastIn {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes ashiatoPawPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {/* 足跡がポンと出る (設計書§3-4: stagger的にアイコンがポップ) */}
      <span style={{ display: "inline-flex", animation: "ashiatoPawPop 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards" }}>
        <AshiatoIcon size={22} />
      </span>
      <div>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.orange }}>+{granted}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, marginLeft: 6 }}>あしあとが増えた</span>
        <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>今日も、街へようこそ。</div>
      </div>
    </div>
  );
};
