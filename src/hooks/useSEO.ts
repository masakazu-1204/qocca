// src/hooks/useSEO.ts — ページ単位の <title> / meta / canonical / JSON-LD (2026/7/27)
//
// 背景: Qocca は SPA で、全URLが index.html の同じ <title> のままだった。
//   → 検索結果でもブラウザのタブでも、どのページも同じ名前で並んでいた。
//
// これはクライアント側 (JSを実行する Googlebot と、実ユーザーのタブ表示) 向け。
// JS を実行しない AI クローラー向けには api/prerender.js が別途 HTML を返す。

import { useEffect } from "react";
import { SITE_URL } from "../constants/site";

type SEO = {
  title: string;
  description?: string;
  /** 先頭 "/" のパス。省略時は現在のURL */
  path?: string;
  image?: string;
  /** schema.org の JSON-LD (複数可) */
  jsonLd?: unknown[];
  /** true で noindex (検索結果に出したくないページ) */
  noindex?: boolean;
};

const SITE = SITE_URL;
const MANAGED = "data-qocca-seo"; // このフックが作った要素の目印

const upsert = (
  selector: string,
  create: () => HTMLElement,
  apply: (el: HTMLElement) => void
) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    el.setAttribute(MANAGED, "1");
    document.head.appendChild(el);
  }
  apply(el);
};

const setMeta = (attr: "name" | "property", key: string, content: string) =>
  upsert(
    `meta[${attr}="${key}"]`,
    () => {
      const m = document.createElement("meta");
      m.setAttribute(attr, key);
      return m;
    },
    (el) => el.setAttribute("content", content)
  );

export function useSEO({ title, description, path, image, jsonLd, noindex }: SEO) {
  const jsonKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    document.title = title;
    const url = SITE + (path || window.location.pathname);

    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    setMeta("property", "og:title", title);
    setMeta("name", "twitter:title", title);
    setMeta("property", "og:url", url);
    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }

    upsert(
      'link[rel="canonical"]',
      () => {
        const l = document.createElement("link");
        l.rel = "canonical";
        return l;
      },
      (el) => el.setAttribute("href", url)
    );

    // noindex は必要なときだけ付け、離脱時に必ず外す (付けっぱなしは事故になる)
    const robots = document.head.querySelector('meta[name="robots"]');
    if (noindex) setMeta("name", "robots", "noindex, nofollow");
    else if (robots?.getAttribute(MANAGED)) robots.remove();

    // JSON-LD はこのフック管理分だけ入れ替える (index.html の静的 JSON-LD は触らない)
    const olds = document.head.querySelectorAll(`script[type="application/ld+json"][${MANAGED}]`);
    olds.forEach((n) => n.remove());
    (jsonLd || []).forEach((obj) => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.setAttribute(MANAGED, "1");
      s.textContent = JSON.stringify(obj);
      document.head.appendChild(s);
    });

    return () => {
      document.head
        .querySelectorAll(`script[type="application/ld+json"][${MANAGED}]`)
        .forEach((n) => n.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, image, noindex, jsonKey]);
}
