// うちの子ギャラリー: 全ユーザーの公開うちの子を集約表示
// ⚠️ 公開データ(pets RLS select=true)のみ読む。決済/SNS/施設マップ/認証/Pet Walker 非接触。
// カードUIはマイページのうちの子セクション(L1017〜)と同等の作法。各カード→飼い主の公開プロフィール(/user/:owner_id)へ遷移。
// 取得は pets(active) を新着順 PAGE_SIZE 件・スクロール時「もっと見る」で +PAGE_SIZE。profiles は別取得→JS側JOIN(pets→auth.usersのFKしか無いため)。
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { C } from "../constants/theme";
import { petIcon, petLabelShort } from "../constants/pets";
import { FloatingBackButton } from "../components/FloatingBackButton";
import { dailySeededShuffle } from "../utils/dailyShuffle";

type Pet = {
  id: string;
  owner_id: string | null;
  name: string;
  species: string;
  breed: string | null;
  gender: string | null;
  bio: string | null;
  avatar_url: string | null;
};
type Owner = { id: string; display_name: string | null; avatar_url: string | null };
type Card = Pet & { owner: Owner | null };

const PAGE_SIZE = 24;

export function PetGalleryPage({ isPC }: { setPage?: (p: string) => void; isPC?: boolean }) {
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchPage = async (off: number) => {
    const { data: pets, error } = await supabase
      .from("pets")
      .select("id, owner_id, name, species, breed, gender, bio, avatar_url")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(off, off + PAGE_SIZE - 1);
    if (error) return { rows: [] as Card[], finished: true };
    const list = (pets || []) as Pet[];
    const ownerIds = Array.from(new Set(list.map((p) => p.owner_id).filter((v): v is string => !!v)));
    let ownerMap: Record<string, Owner> = {};
    if (ownerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ownerIds);
      ownerMap = Object.fromEntries(((profs || []) as Owner[]).map((p) => [p.id, p]));
    }
    // 2026/6/29 日替わりシャッフル: 各ページ内の並びを日付シードでシャッフル。
    // 取得 (active + created_at desc + range) ロジックは現状維持・JS で並び替えのみ。
    const rows: Card[] = dailySeededShuffle(
      list.map((p) => ({ ...p, owner: p.owner_id ? ownerMap[p.owner_id] ?? null : null }))
    );
    return { rows, finished: list.length < PAGE_SIZE };
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { rows, finished } = await fetchPage(0);
      if (!alive) return;
      setCards(rows);
      setHasMore(!finished);
      setOffset(0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const onMore = async () => {
    if (busy || !hasMore) return;
    setBusy(true);
    const next = offset + PAGE_SIZE;
    const { rows, finished } = await fetchPage(next);
    setCards((prev) => [...prev, ...rows]);
    setHasMore(!finished);
    setOffset(next);
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 48 }}>
      <div style={{ padding: isPC ? "28px 16px 24px" : "20px 16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: isPC ? 30 : 22, fontWeight: 700, color: C.dark, marginBottom: 8, letterSpacing: 0.5 }}>
          うちの子たち
        </div>
        <div style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.8 }}>
          Qoccaの街で暮らす、みんなのうちの子。<br />
          カードをタップすると、その子の飼い主のページへ。
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${isPC ? 180 : 150}px, 1fr))`,
        gap: 12,
        padding: "0 16px",
      }}>
        {cards.map((p) => {
          const heroPhoto = p.avatar_url || "";
          const speciesEmoji = petIcon(p.species);
          const genderIcon = p.gender === "male" ? "♂" : p.gender === "female" ? "♀" : "";
          return (
            <div
              key={p.id}
              onClick={() => p.owner_id && navigate(`/user/${p.owner_id}`)}
              style={{
                background: C.white,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                overflow: "hidden",
                cursor: p.owner_id ? "pointer" : "default",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!p.owner_id) return;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: "100%",
                aspectRatio: "1",
                background: "#FFF5EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                overflow: "hidden",
              }}>
                {heroPhoto ? (
                  <img src={heroPhoto} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : speciesEmoji}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  {genderIcon && <span style={{ color: C.warmGray, fontSize: 11, fontWeight: 600 }}>{genderIcon}</span>}
                </div>
                <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {speciesEmoji} {p.breed || petLabelShort(p.species)}
                </div>
                {p.bio && (
                  <div style={{ fontSize: 11, color: C.dark, lineHeight: 1.5, marginBottom: 8, opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                    {p.bio}
                  </div>
                )}
                {p.owner && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                    {p.owner.avatar_url ? (
                      <img src={p.owner.avatar_url} alt="" loading="lazy" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.border }} />
                    )}
                    <span style={{ fontSize: 10, color: C.warmGray, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.owner.display_name || "—"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray, fontSize: 12 }}>
          読み込み中…
        </div>
      )}
      {!loading && !cards.length && (
        <div style={{ textAlign: "center", padding: 48, color: C.warmGray, fontSize: 13, lineHeight: 1.8 }}>
          まだ公開されているうちの子がいません。<br />
          マイページの「うちの子」から登録できます。
        </div>
      )}
      {!loading && hasMore && (
        <div style={{ textAlign: "center", padding: "20px 16px 8px" }}>
          <button
            onClick={onMore}
            disabled={busy}
            style={{
              padding: "10px 28px",
              background: C.white,
              color: C.dark,
              border: `1px solid ${C.border}`,
              borderRadius: 24,
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.6 : 1,
              minHeight: 40,
            }}
          >
            {busy ? "読み込み中…" : "もっと見る"}
          </button>
        </div>
      )}
      {/* 2026/6/29 案① B案: フローティング戻るボタン (PetGalleryPage 一覧 → 前ページ) */}
      <FloatingBackButton aboveTabBar={true} />
    </div>
  );
}
