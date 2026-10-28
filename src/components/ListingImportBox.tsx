// 2026/10/29 よそで売っている自分の作品ページの URL から、出品の下書きを作る (出品画面 STEP 1 の上)
//   Edge Function import-listing-from-url が題名・説明・価格・写真を取り出し、写真は listing-images/<user>/import/ に写して返す。
//   ここでは写真を File にして親 (SellPage) に渡すだけ。出品の送信はいつもの submitListing のまま (決済・手数料には触れない)。
//   読めるのは minne / Creema / BASE の作品ページ。本人が貼った 1 ページだけを読む。
import { useState } from "react";
import { QC, QC_FONT_JP } from "../constants/theme";
import { supabase } from "../supabaseClient";

export type ImportedListing = { title: string; description: string; price: number | null; files: File[]; source: string };

const MESSAGES: Record<string, string> = {
  unsupported_url: "minne・Creema・BASE の作品ページの URL を貼ってください (例: https://minne.com/items/12345678)。",
  url_invalid: "URL の形になっていないようです。もう一度貼り付けてみてください。",
  too_many: "今日はここまでです。明日また読み込めます。",
  login_required: "ログインしてから使えます。",
  fetch_failed: "ページを読み込めませんでした。少し時間をおくか、手で入力してください。",
  nothing_found: "このページからは作品の情報を見つけられませんでした。手で入力してください。",
};

async function toFile(url: string, i: number): Promise<File | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    const ext = (b.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    return new File([b], `import_${i + 1}.${ext}`, { type: b.type || "image/jpeg" });
  } catch (_) { return null; }
}

export function ListingImportBox({ onImported }: { onImported: (x: ImportedListing) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    if (!url.trim() || busy) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("import-listing-from-url", { body: { url: url.trim() } });
    let code: string | null = null;
    if (error) {
      try { code = (await (error as { context?: Response }).context?.json())?.error ?? null; } catch (_) { code = null; }
    }
    if (error || !data?.title) {
      setBusy(false);
      setMsg({ ok: false, text: MESSAGES[code ?? ""] ?? MESSAGES.fetch_failed });
      return;
    }
    const files = (await Promise.all(((data.images ?? []) as string[]).map(toFile))).filter((f): f is File => !!f);
    onImported({ title: data.title, description: data.description ?? "", price: data.price ?? null, files, source: data.source });
    setBusy(false);
    setMsg({ ok: true, text: `読み込みました。題名・説明・価格${files.length ? `・写真 ${files.length} 枚` : ""}を入れています。カテゴリを選んで、中身を確かめてから出品してください。` });
  };

  return (
    <div style={{ marginBottom: 20, padding: "14px 16px", background: QC.warmWhite, border: `1px solid ${QC.lightSand}`, borderRadius: 14, fontFamily: QC_FONT_JP }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: QC.charcoal }}>minne・Creema・BASE で売っている作品なら</span>
          <span style={{ display: "block", fontSize: 12, color: QC.softBrown, marginTop: 4, borderBottom: `1px solid ${QC.lightSand}`, paddingBottom: 2, width: "fit-content" }}>作品ページの URL から下書きを作る</span>
        </button>
      ) : (
        <>
          <p style={{ fontSize: 13.5, fontWeight: 500, color: QC.charcoal, margin: "0 0 6px" }}>作品ページの URL から下書きを作る</p>
          <p style={{ fontSize: 12, color: QC.warmGray, lineHeight: 1.8, margin: "0 0 10px" }}>
            あなたが minne・Creema・BASE に出している作品ページの URL を貼ってください。題名・説明・価格・写真を読み込みます。
            ご自身の作品のページだけにしてください。
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }}
              placeholder="https://minne.com/items/..." inputMode="url"
              style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: `1px solid ${QC.lightSand}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", color: QC.charcoal, background: QC.cream, outline: "none" }} />
            <button onClick={run} disabled={busy || !url.trim()} style={{
              padding: "10px 16px", borderRadius: 10, border: `1px solid ${QC.terracotta}`, background: "transparent",
              color: QC.terracotta, fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: busy || !url.trim() ? "default" : "pointer",
              opacity: busy || !url.trim() ? 0.5 : 1, whiteSpace: "nowrap", transition: "opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            }}>{busy ? "読み込み中…" : "読み込む"}</button>
          </div>
          {msg && <p role="status" style={{ fontSize: 12, lineHeight: 1.8, margin: "10px 0 0", color: msg.ok ? QC.mutedGreen : QC.terracotta }}>{msg.text}</p>}
        </>
      )}
    </div>
  );
}
