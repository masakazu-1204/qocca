// 「あしあと」🐾 残高カード (Phase C-1 UI第1弾)
// マイページ プロフィールタブ用。#F5A94A基調 (機能画面=Cトークン系・設計書§0)。
// props は {free, paid?} で C-3 の paid_balance 分離に備える (設計書§1-2)。
// 2026/7/5 UI第2弾: ティザー「つかいみちは もうすぐ」→ /ashiato-shop 導線に差替え。

import { useNavigate } from "react-router-dom";
import { AshiatoIcon } from "./AshiatoIcon";
import { useAshiatoBalance } from "../hooks/useAshiato";
import { C } from "../constants/theme";

type Props = {
  userId: string | undefined;
};

export const AshiatoBalanceCard = ({ userId }: Props) => {
  const { free, loading } = useAshiatoBalance(userId);
  const navigate = useNavigate();

  return (
    <div style={{
      background: C.orangePale,
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      padding: "16px 20px",
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AshiatoIcon size={28} />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.orange, lineHeight: 1 }}>
              {loading ? "…" : free}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.warmGray }}>あしあと</span>
          </div>
          <div style={{ fontSize: 10, color: C.warmGray, marginTop: 3 }}>
            街を歩いた足跡が、貯まっていく。
          </div>
        </div>
      </div>
      <button
        onClick={() => navigate("/ashiato-shop")}
        style={{
          fontSize: 11, fontWeight: 600, color: C.orange,
          background: "transparent", border: `1px solid ${C.orangeLight}`,
          borderRadius: 999, padding: "8px 14px", cursor: "pointer",
          whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        ショップへ →
      </button>
    </div>
  );
};
