// 2026/10/31 うちの子への「ひとこと」 (/pet/:petId の自己紹介の下)
//   King「サイト内での会員同士のコミュニケーションをもっと活発にしたい」。うちの子は増えたのに、反応する手段が無かった。
//   街の人が「ようこそ」などを 80 字まで残せる。飼い主さんも同じ欄で返事ができる (「飼い主さん」と表示)。
//   届いたら notify-town-activity が飼い主さんへメール、飼い主さんの返事は声をかけた人へメール。
//   消せるのは 書いた本人・その子の飼い主さん (RLS でも同じ)。連投よけは RLS 側 (同じ子へ 10 分に 1 回・1 日 30 回)。
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QC, QC_FONT_JP } from "../constants/theme";
import { supabase } from "../supabaseClient";

type Greeting = { id: string; user_id: string; message: string; created_at: string };
type Person = { id: string; display_name: string | null; avatar_url: string | null };

const MAX = 80;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function presets(isOwner: boolean, isMemorial: boolean, name: string): string[] {
  if (isOwner) return ["ありがとうございます", `${name}も喜んでいます`, "また会いに来てください"];
  if (isMemorial) return ["やさしいお顔ですね", "大切にされてきたのが伝わります", "お話を聞かせてください"];
  return ["ようこそ", "かわいいですね", "会えてうれしいです", "いつか一緒に歩けたら"];
}

const fmt = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };

export function PetGreetings({ petId, ownerId, petName, isMemorial, currentUserId }: {
  petId: string; ownerId: string; petName: string; isMemorial: boolean; currentUserId: string | null;
}) {
  const navigate = useNavigate();
  const [list, setList] = useState<Greeting[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const isOwner = !!currentUserId && currentUserId === ownerId;

  const loadPeople = async (ids: string[], known: Record<string, Person>) => {
    const need = [...new Set(ids)].filter((id) => !known[id]);
    if (need.length === 0) return known;
    const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", need);
    const next = { ...known };
    for (const p of (data ?? []) as Person[]) next[p.id] = p;
    return next;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("pet_greetings").select("id, user_id, message, created_at")
        .eq("pet_id", petId).order("created_at", { ascending: true }).limit(200);
      const rows = (data ?? []) as Greeting[];
      const ppl = await loadPeople(rows.map((r) => r.user_id), {});
      if (!alive) return;
      setList(rows); setPeople(ppl);
    })();
    return () => { alive = false; };
  }, [petId]);

  const send = async () => {
    const m = text.trim();
    if (!currentUserId || !m || busy) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.from("pet_greetings")
      .insert({ pet_id: petId, user_id: currentUserId, message: m.slice(0, MAX) })
      .select("id, user_id, message, created_at").single();
    if (error || !data) {
      setBusy(false);
      setMsg({ ok: false, text: "いまは届けられませんでした。同じ子へは 10 分ほどあけて、もう一度どうぞ。" });
      return;
    }
    setPeople(await loadPeople([currentUserId], people));
    setList((xs) => [...xs, data as Greeting]);
    setText(""); setBusy(false);
    setMsg({ ok: true, text: isOwner ? "返事を届けました。声をかけてくれた人に、お知らせが届きます。" : `${petName}の飼い主さんに、お知らせが届きます。` });
  };

  const remove = async (id: string) => {
    if (!confirm("このひとことを消しますか。")) return;
    const { error } = await supabase.from("pet_greetings").delete().eq("id", id);
    if (!error) setList((xs) => xs.filter((x) => x.id !== id));
  };

  const chip = (label: string) => (
    <button key={label} type="button" onClick={() => setText(label)} style={{
      padding: "6px 12px", borderRadius: 999, border: `1px solid ${QC.lightSand}`,
      background: text === label ? QC.cream : QC.warmWhite, color: QC.softBrown, fontSize: 12, fontWeight: 400,
      fontFamily: "inherit", cursor: "pointer", transition: `background 0.8s ${EASE}`,
    }}>{label}</button>
  );

  return (
    <section style={{ margin: "32px 0", padding: "24px 20px", background: QC.warmWhite, border: `1px solid ${QC.lightSand}`, borderRadius: 16, fontFamily: QC_FONT_JP, color: QC.charcoal }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: QC.softBrown, letterSpacing: 0.5 }}>
        街の人からのひとこと{list.length > 0 && <span style={{ fontSize: 12, fontWeight: 300, color: QC.warmGray, marginLeft: 8 }}>{list.length}</span>}
      </p>

      {list.length === 0 ? (
        <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 300, color: QC.warmGray, lineHeight: 1.9 }}>
          {isOwner ? `街の人から${petName}へのひとことが、ここに届きます。` : `まだ誰も声をかけていません。${petName}に、最初のひとことをどうぞ。`}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}>
          {list.map((g) => {
            const p = people[g.user_id];
            const byOwner = g.user_id === ownerId;
            const canDelete = !!currentUserId && (currentUserId === g.user_id || isOwner);
            const name = p?.display_name || "この街の住民";
            return (
              <li key={g.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: `1px solid ${QC.lightSand}` }}>
                <button type="button" onClick={() => navigate(`/user/${g.user_id}`)} aria-label={`${name} さんのページ`} style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: "50%", overflow: "hidden", padding: 0, border: "none",
                  background: QC.cream, color: QC.softBrown, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                }}>
                  {p?.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : name.slice(0, 1)}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: QC.warmGray }}>
                    <span style={{ color: QC.softBrown }}>{name}</span>
                    {byOwner && <span style={{ marginLeft: 6, color: QC.mutedGreen }}>飼い主さん</span>}
                    <span style={{ marginLeft: 8, fontWeight: 300 }}>{fmt(g.created_at)}</span>
                    {canDelete && (
                      <button type="button" onClick={() => remove(g.id)} style={{
                        marginLeft: 8, background: "none", border: "none", padding: 0, fontSize: 11, color: QC.warmGray,
                        fontFamily: "inherit", cursor: "pointer", textDecoration: "underline", opacity: 0.7,
                      }}>消す</button>
                    )}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 400, lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{g.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!currentUserId ? (
        <button type="button" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(`/pet/${petId}`)}`)} style={{
          marginTop: 16, background: "none", border: "none", padding: 0, fontSize: 13, color: QC.terracotta,
          fontFamily: "inherit", cursor: "pointer", borderBottom: `1px solid ${QC.lightSand}`,
        }}>ログインすると、{petName}にひとこと残せます</button>
      ) : (
        <div style={{ marginTop: 16 }}>
          {(!isOwner || list.some((g) => g.user_id !== ownerId)) && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {presets(isOwner, isMemorial, petName).map(chip)}
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))} rows={2}
                placeholder={isOwner ? "声をかけてくれた人へ、返事を" : `${petName}に、ひとこと`}
                style={{
                  width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1px solid ${QC.lightSand}`, borderRadius: 10,
                  background: QC.cream, color: QC.charcoal, fontSize: 14, fontFamily: "inherit", lineHeight: 1.7, resize: "vertical", outline: "none",
                }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 11, color: QC.warmGray, fontWeight: 300 }}>{text.length} / {MAX}</span>
                <button type="button" onClick={send} disabled={busy || !text.trim()} style={{
                  padding: "8px 20px", borderRadius: 10, border: `1px solid ${QC.terracotta}`, background: "transparent",
                  color: QC.terracotta, fontSize: 13, fontWeight: 500, fontFamily: "inherit",
                  cursor: busy || !text.trim() ? "default" : "pointer", opacity: busy || !text.trim() ? 0.5 : 1,
                  transition: `opacity 0.8s ${EASE}`,
                }}>{busy ? "届けています…" : "届ける"}</button>
              </div>
            </>
          )}
          {msg && <p role="status" style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.8, color: msg.ok ? QC.mutedGreen : QC.terracotta }}>{msg.text}</p>}
        </div>
      )}
    </section>
  );
}
