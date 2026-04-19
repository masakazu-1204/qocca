// src/components/AboutSection.tsx
import React from "react";
import { Link } from "react-router-dom";
import { PawPrint, ShieldCheck, Tag } from "lucide-react";

const BRAND_ORANGE = "#F5A94A";
const BRAND_ORANGE_DEEP = "#B27820";

export default function AboutSection() {
  return (
    <section className="bg-white px-4 py-12 md:py-16">
      <div className="mx-auto max-w-[880px]">
        {/* ヘッダー（頭文字 + キャッチ） */}
        <div className="mx-auto mb-10 rounded-3xl bg-gradient-to-b from-[#FFF9F0] to-white px-6 py-12 text-center">
          <div className="mb-2 text-xs tracking-[0.2em] text-[color:var(--brand)]">
            ABOUT QOCCA
          </div>
          <h2 className="mb-6 text-xl font-medium text-neutral-800">
            Qoccaって、どんな場所?
          </h2>

          <div className="mx-auto inline-block text-left">
            <AcronymRow letter="Q" word="uokka" desc="クオッカの笑顔とともに" />
            <AcronymRow letter="O" word="ffer" desc="想いを差し出し" />
            <AcronymRow letter="C" word="raft" desc="手で形にして" />
            <AcronymRow letter="C" word="onnect" desc="ふたりをつなぐ" />
            <AcronymRow
              letter="A"
              word="ffection"
              desc="愛情が生まれる場所"
              isLast
            />
          </div>

          <div className="mt-8 border-t border-[#F5E6D0] pt-6">
            <p className="font-serif text-lg italic text-neutral-800">
              「想いを形にして、ふたりをつなぐ。」
            </p>
          </div>
        </div>

        {/* 3つの特徴 */}
        <div className="mb-10">
          <h3 className="mb-6 text-center text-base font-medium text-neutral-800">
            Qoccaの3つの特徴
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FeatureMini
              Icon={PawPrint}
              title="ペット専門"
              body={
                <>
                  ペットオーナーの
                  <br />
                  ためだけの市場
                </>
              }
            />
            <FeatureMini
              Icon={ShieldCheck}
              title="エスクロー決済"
              body={
                <>
                  納品後に支払う
                  <br />
                  だから安心
                </>
              }
            />
            <FeatureMini
              Icon={Tag}
              title="初回手数料0%"
              body={
                <>
                  出品者も購入者も
                  <br />
                  スタート無料
                </>
              }
            />
          </div>
        </div>

        {/* 使い方 3ステップ */}
        <div className="mb-10">
          <h3 className="mb-6 text-center text-base font-medium text-neutral-800">
            使い方
          </h3>
          <div className="mx-auto flex max-w-[560px] items-start justify-center gap-2">
            <Step num={1} title="探す" body={<>作品や出品者を<br />カテゴリから探す</>} />
            <StepArrow />
            <Step num={2} title="依頼する" body={<>想いを伝えて<br />注文する</>} />
            <StepArrow />
            <Step num={3} title="受け取る" body={<>完成した作品を<br />受け取る</>} />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            to="/about"
            className="inline-block rounded-full bg-[color:var(--brand)] px-8 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            もっと詳しく知る →
          </Link>
        </div>
      </div>

      <style>{`
        :root {
          --brand: ${BRAND_ORANGE};
          --brand-deep: ${BRAND_ORANGE_DEEP};
        }
      `}</style>
    </section>
  );
}

/* ============== Sub components ============== */

function AcronymRow({
  letter,
  word,
  desc,
  isLast,
}: {
  letter: string;
  word: string;
  desc: string;
  isLast?: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-4 ${isLast ? "" : "mb-2"}`}>
      <span
        className="min-w-[32px] font-serif text-[28px] font-medium"
        style={{ color: "var(--brand)" }}
      >
        {letter}
      </span>
      <span className="text-[15px] text-neutral-800">
        <span className="font-medium">{word}</span>{" "}
        <span className="text-neutral-500">— {desc}</span>
      </span>
    </div>
  );
}

function FeatureMini({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#F1EFE8] bg-white p-6 text-center">
      <div
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "#FFF2DF" }}
      >
        <Icon
          className="h-[22px] w-[22px]"
          strokeWidth={1.8}
          style={{ color: "var(--brand)" } as React.CSSProperties}
        />
      </div>
      <div className="mb-1 text-sm font-medium text-neutral-800">{title}</div>
      <div className="text-xs leading-[1.6] text-neutral-500">{body}</div>
    </div>
  );
}

function Step({
  num,
  title,
  body,
}: {
  num: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex-1 text-center">
      <div
        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-xl font-medium text-white"
        style={{ background: "var(--brand)" }}
      >
        {num}
      </div>
      <div className="mb-1 text-sm font-medium text-neutral-800">{title}</div>
      <div className="text-[11px] leading-[1.5] text-neutral-500">{body}</div>
    </div>
  );
}

function StepArrow() {
  return (
    <div
      className="mt-5 flex-shrink-0 text-xl"
      style={{ color: "var(--brand)" }}
    >
      →
    </div>
  );
}
