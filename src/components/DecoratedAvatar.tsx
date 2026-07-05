// 装着装飾つきアバター (あしあとUI第3弾・2026/7/6)
// equipped=true の装飾を重ね表示する:
//   - フレーム (profile_deco): 透過なしの風景画 (中央が明るい設計) のため
//     「上に重ねる」でなく「台紙にしてアバターを上に乗せる」构図で表示
//   - スタンプ (stamp): アバター右下に小さなバッジで表示
// RLS: user_decorations は equipped=true なら他人も SELECT 可 (設計済み) → 公開プロフィールでも見える
// 装飾なしユーザーは既存とピクセル同一の素のアバター円を返す (無装飾ユーザーへの影響ゼロ)

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { C } from "../constants/theme";

type Props = {
  userId: string | undefined;
  avatarUrl?: string | null;
  initial: string;
  margin?: string;      // 呼び出し元の既存マージンを維持
  fontWeight?: number;  // イニシャル表示の既存太さを維持
};

type Equipped = { frameUrl: string | null; stampUrl: string | null };

export const DecoratedAvatar = ({ userId, avatarUrl, initial, margin = "0 auto 12px", fontWeight = 800 }: Props) => {
  const [deco, setDeco] = useState<Equipped>({ frameUrl: null, stampUrl: null });

  const fetchDeco = useCallback(async () => {
    if (!userId) { setDeco({ frameUrl: null, stampUrl: null }); return; }
    const { data } = await supabase
      .from("user_decorations")
      .select("decoration_items(category, image_url)")
      .eq("user_id", userId)
      .eq("equipped", true);
    const rows = (data || []).map((r: any) => r.decoration_items).filter(Boolean);
    setDeco({
      frameUrl: rows.find((r: any) => r.category === "profile_deco")?.image_url || null,
      stampUrl: rows.find((r: any) => r.category === "stamp")?.image_url || null,
    });
  }, [userId]);

  useEffect(() => { fetchDeco(); }, [fetchDeco]);

  // ショップで装備を切り替えたら即反映 (同一セッション内)
  useEffect(() => {
    const onChanged = () => fetchDeco();
    window.addEventListener("ashiatoEquipChanged", onChanged);
    return () => window.removeEventListener("ashiatoEquipChanged", onChanged);
  }, [fetchDeco]);

  // 素のアバター円 (既存マークアップと同一スタイル)
  const avatarCircle = (
    <div style={{
      width: 72, height: 72, borderRadius: "50%",
      background: avatarUrl ? `url(${avatarUrl}) center/cover` : C.orange,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 32, fontWeight, color: "#fff",
      boxShadow: deco.frameUrl ? "0 0 0 3px rgba(255,255,255,0.9), 0 2px 8px rgba(26,18,8,0.18)" : undefined,
    }}>
      {!avatarUrl && initial}
    </div>
  );

  const stampBadge = deco.stampUrl && (
    <img
      src={deco.stampUrl}
      alt="装着スタンプ"
      style={{
        position: "absolute", right: -4, bottom: -4,
        width: 30, height: 30, objectFit: "contain",
        background: "#fff", borderRadius: "50%",
        border: `1px solid ${C.border}`, padding: 2,
        boxShadow: "0 1px 4px rgba(26,18,8,0.12)",
      }}
    />
  );

  // 装飾なし → 既存と同じ見た目 (wrapperにmarginのみ)
  if (!deco.frameUrl && !deco.stampUrl) {
    return <div style={{ width: 72, margin }}>{avatarCircle}</div>;
  }

  // スタンプのみ → 円の右下にバッジ
  if (!deco.frameUrl) {
    return (
      <div style={{ position: "relative", width: 72, margin }}>
        {avatarCircle}
        {stampBadge}
      </div>
    );
  }

  // フレームあり → フレームを台紙にしてアバターを中央に
  return (
    <div style={{ position: "relative", width: 116, height: 116, margin }}>
      <img
        src={deco.frameUrl}
        alt="装着フレーム"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", borderRadius: 16, display: "block",
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {avatarCircle}
      </div>
      {stampBadge}
    </div>
  );
};
