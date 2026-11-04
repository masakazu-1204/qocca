// 称号の表示 (2026/11/4 King「掲示板を作った人に称号を」)
// badges.category = 'special' のものだけを、絵文字なしの静かな文字で出す。無ければ何も出さない。
import { useEffect, useState } from "react";
import { QC } from "../constants/theme";
import { supabase } from "../supabaseClient";

type Title = { id: string; name: string; description: string | null; order: number };

export const TitleChips = ({ userId }: { userId?: string | null }) => {
  const [titles, setTitles] = useState<Title[]>([]);

  useEffect(() => {
    if (!userId) { setTitles([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id, badges!inner(name, description, tier_order, category)")
        .eq("user_id", userId)
        .eq("badges.category", "special");
      if (cancelled) return;
      const rows = (data || []).map((r: any) => ({
        id: r.badge_id,
        name: r.badges?.name || "",
        description: r.badges?.description ?? null,
        order: r.badges?.tier_order ?? 0,
      }));
      setTitles(rows.filter((t: Title) => t.name).sort((a: Title, b: Title) => a.order - b.order));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (titles.length === 0) return null;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:6, margin:"6px 0 10px" }}>
      {titles.map(t => (
        <span key={t.id} title={t.description || undefined} style={{
          padding:"3px 12px", border:`1px solid ${QC.lightSand}`, borderRadius:999,
          background:QC.warmWhite, color:QC.softBrown, fontSize:11, fontWeight:400, letterSpacing:"0.04em",
        }}>{t.name}</span>
      ))}
    </div>
  );
};
