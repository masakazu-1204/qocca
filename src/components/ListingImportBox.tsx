// 2026/10/29 よそで売っている自分の作品ページの URL から、出品の下書きを作る (出品画面 STEP 1 の上)
//   Edge Function import-listing-from-url が題名・説明・価格・写真を取り出し、写真は listing-images/<user>/import/ に写して返す。
//   ここでは写真を File にして親 (SellPage) に渡すだけ。出品の送信はいつもの submitListing のまま (決済・手数料には触れない)。
//   読めるのは minne / Creema / BASE / メルカリ / ラクマ / Yahoo!フリマ の作品ページ。本人が貼った 1 ページだけを読む。
//   2026/11/2 フリマ 3 つを足した。URL の出し方 (アプリ・ブラウザ) を「URL の出し方」で開けるようにした。
//     メルカリは説明文が読めない (ページに入っていない) ので、読み込んだあとに「説明は手で」と伝える。
import { useState } from "react";
import { QC, QC_FONT_JP } from "../constants/theme";
import { supabase } from "../supabaseClient";

export type ImportedListing = { title: string; description: string; price: number | null; files: File[]; source: string };

const MESSAGES: Record<string, string> = {
  unsupported_url: "作品ページの URL を貼ってください (例: https://jp.mercari.com/item/m12345678901)。お店のトップやプロフィールの URL では読めません。下の「URL の出し方」もどうぞ。",
  url_invalid: "URL の形になっていないようです。もう一度貼り付けてみてください。",
  too_many: "今日はここまでです。明日また読み込めます。",
  login_required: "ログインしてから使えます。",
  fetch_failed: "ページを読み込めませんでした。少し時間をおくか、手で入力してください。",
  nothing_found: "このページからは作品の情報を見つけられませんでした。手で入力してください。",
};

// URL の出し方。アプリは「共有」からリンクをコピー、ブラウザは作品ページのアドレス欄をコピー
const SITES: { name: string; example: string; how: string; note?: string }[] = [
  { name: "メルカリ", example: "https://jp.mercari.com/item/m12345678901",
    how: "アプリ: 作品ページの右上の共有ボタン →「リンクをコピー」。ブラウザ: 作品ページのアドレス欄をコピー。",
    note: "メルカリは説明文を読み込めません。題名・価格・写真 1 枚が入るので、説明は貼り付けるか書き足してください。" },
  { name: "ラクマ", example: "https://item.fril.jp/0123456789abcdef0123456789abcdef",
    how: "アプリ: 作品ページの共有ボタン →「リンクをコピー」。ブラウザ: 作品ページのアドレス欄をコピー。" },
  { name: "Yahoo!フリマ", example: "https://paypayfleamarket.yahoo.co.jp/item/z123456789",
    how: "アプリ: 作品ページの共有ボタン →「リンクをコピー」。ブラウザ: 作品ページのアドレス欄をコピー。" },
  { name: "minne", example: "https://minne.com/items/12345678",
    how: "作品ページを開いて、アドレス欄をコピー (アプリなら共有 →「リンクをコピー」)。", note: "写真は 1 枚目だけ入ります。" },
  { name: "Creema", example: "https://www.creema.jp/item/12345678/detail",
    how: "作品ページを開いて、アドレス欄をコピー (アプリなら共有 →「リンクをコピー」)。" },
  { name: "BASE", example: "https://お店の名前.base.shop/items/12345678",
    how: "お店の作品ページを開いて、アドレス欄をコピー。", note: "写真は 1 枚目だけ入ります。" },
];

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
  const [guide, setGuide] = useState(false);

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
    const filled = ["題名", data.description ? "説明" : "", data.price != null ? "価格" : "", files.length ? `写真 ${files.length} 枚` : ""].filter(Boolean).join("・");
    const extra = data.source === "mercari" ? "メルカリは説明文を読み込めないので、説明は書き足してください。" : "";
    setMsg({ ok: true, text: `読み込みました。${filled}を入れています。${extra}カテゴリを選んで、中身を確かめてから出品してください。` });
  };

  return (
    <div style={{ marginBottom: 20, padding: "14px 16px", background: QC.warmWhite, border: `1px solid ${QC.lightSand}`, borderRadius: 14, fontFamily: QC_FONT_JP }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: QC.charcoal }}>メルカリ・minne・Creema などで売っている作品なら</span>
          <span style={{ display: "block", fontSize: 12, color: QC.softBrown, marginTop: 4, borderBottom: `1px solid ${QC.lightSand}`, paddingBottom: 2, width: "fit-content" }}>作品ページの URL から下書きを作る</span>
        </button>
      ) : (
        <>
          <p style={{ fontSize: 13.5, fontWeight: 500, color: QC.charcoal, margin: "0 0 6px" }}>作品ページの URL から下書きを作る</p>
          <p style={{ fontSize: 12, color: QC.warmGray, lineHeight: 1.8, margin: "0 0 10px" }}>
            あなたがメルカリ・ラクマ・Yahoo!フリマ・minne・Creema・BASE に出している作品ページの URL を貼ってください。
            題名・説明・価格・写真を読み込みます。ご自身の作品のページだけにしてください。
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }}
              placeholder="https://jp.mercari.com/item/..." inputMode="url"
              style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: `1px solid ${QC.lightSand}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", color: QC.charcoal, background: QC.cream, outline: "none" }} />
            <button onClick={run} disabled={busy || !url.trim()} style={{
              padding: "10px 16px", borderRadius: 10, border: `1px solid ${QC.terracotta}`, background: "transparent",
              color: QC.terracotta, fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: busy || !url.trim() ? "default" : "pointer",
              opacity: busy || !url.trim() ? 0.5 : 1, whiteSpace: "nowrap", transition: "opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            }}>{busy ? "読み込み中…" : "読み込む"}</button>
          </div>
          <button type="button" onClick={() => setGuide((g) => !g)} style={{
            marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, color: QC.softBrown, borderBottom: `1px solid ${QC.lightSand}`,
          }}>{guide ? "URL の出し方を閉じる" : "URL の出し方"}</button>
          {guide && (
            <div style={{ marginTop: 10, padding: "12px 14px", background: QC.cream, borderRadius: 10 }}>
              <p style={{ fontSize: 12, color: QC.charcoal, lineHeight: 1.8, margin: "0 0 10px" }}>
                1. 出しているサイトで、作品のページを開きます (お店のトップやプロフィールではなく、作品 1 つのページ)。<br />
                2. URL をコピーします。<br />
                3. 上の欄に貼り付けて「読み込む」。題名などが入ったら、カテゴリを選んで中身を確かめ、いつもどおり出品します。
              </p>
              {SITES.map((x) => (
                <div key={x.name} style={{ padding: "8px 0", borderTop: `1px solid ${QC.lightSand}` }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: QC.softBrown, margin: 0 }}>{x.name}</p>
                  <p style={{ fontSize: 11.5, color: QC.warmGray, lineHeight: 1.8, margin: "2px 0 0" }}>{x.how}</p>
                  <p style={{ fontSize: 11, color: QC.warmGray, lineHeight: 1.6, margin: "2px 0 0", wordBreak: "break-all", opacity: 0.85 }}>例: {x.example}</p>
                  {x.note && <p style={{ fontSize: 11.5, color: QC.warmGray, lineHeight: 1.8, margin: "2px 0 0" }}>{x.note}</p>}
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: QC.warmGray, lineHeight: 1.8, margin: "8px 0 0" }}>
                読み込めるのは 1 日 20 回まで。売り切れの作品や消した作品は読み込めないことがあります。その時は手で入力してください。
              </p>
            </div>
          )}
          {msg && <p role="status" style={{ fontSize: 12, lineHeight: 1.8, margin: "10px 0 0", color: msg.ok ? QC.mutedGreen : QC.terracotta }}>{msg.text}</p>}
        </>
      )}
    </div>
  );
}
