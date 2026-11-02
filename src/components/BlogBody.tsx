// ブログ本文の簡易 Markdown 表示 (2026/11/3)
// 自動ブログは ## 見出し・**太字**・- 箇条書き で書かれるが、詳細ページは素のテキストで出していたので
// 「##」「**」がそのまま見えていた。HTML は一切通さず、見出し / 箇条書き / 太字 だけを React 要素にする。
// 住民が書いた記事 (記号なし) は今まで通り段落として出る。

import type { ReactNode } from "react";
import { C } from "../constants/theme";

/** **太字** だけを <strong> にする。それ以外の文字はそのまま */
function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part)
      ? <strong key={`${keyBase}-${i}`} style={{ fontWeight: 500, color: C.dark }}>{part.slice(2, -2)}</strong>
      : part
  );
}

/** 一覧の抜粋用: 記号を外した素の文章 */
export function blogPlainText(md: string | undefined | null): string {
  return (md ?? "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*・]|\d+[.)])\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1");
}

export function BlogBody({ content }: { content?: string | null }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const k = `p${blocks.length}`;
    blocks.push(<p key={k} style={{ margin: "0 0 1.2em", whiteSpace: "pre-wrap" }}>{inline(para.join("\n"), k)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const k = `l${blocks.length}`;
    const items = list.items.map((it, i) => <li key={`${k}-${i}`} style={{ marginBottom: "0.4em" }}>{inline(it, `${k}-${i}`)}</li>);
    const style = { margin: "0 0 1.2em", paddingLeft: "1.4em" };
    blocks.push(list.ordered ? <ol key={k} style={style}>{items}</ol> : <ul key={k} style={style}>{items}</ul>);
    list = null;
  };

  for (const raw of (content ?? "").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^\s*(?:([-*・])|(\d+)[.)])\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      const k = `h${blocks.length}`;
      const size = h[1].length <= 2 ? 19 : 17;
      blocks.push(<h2 key={k} style={{ fontSize: size, fontWeight: 500, color: C.dark, lineHeight: 1.6, margin: "1.8em 0 0.6em" }}>{inline(h[2], k)}</h2>);
    } else if (li) {
      flushPara();
      const ordered = !!li[2];
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(li[3]);
    } else if (line.trim() === "") {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();

  return <div style={{ fontSize: 15, color: "#333", lineHeight: 2 }}>{blocks}</div>;
}
