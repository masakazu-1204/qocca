// src/components/AboutSection.tsx
import React from "react";
import { Link } from "react-router-dom";
import { PawPrint, ShieldCheck, Tag } from "lucide-react";

const BRAND = "#F5A94A";
const BRAND_DEEP = "#B27820";
const CREAM = "#FFF9F0";
const CREAM_DARK = "#FFF2DF";
const TEXT_DARK = "#2C2C2A";
const TEXT_MUTED = "#888780";
const BORDER = "#F1EFE8";
const BORDER_WARM = "#F5E6D0";

export default function AboutSection() {
  return (
    <section
      style={{
        background: "#FFFFFF",
        padding: "64px 16px",
        color: TEXT_DARK,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* ヘッダー：頭文字とキャッチ */}
        <div
          style={{
            background: `linear-gradient(180deg, ${CREAM} 0%, #FFFFFF 100%)`,
            borderRadius: 24,
            padding: "48px 24px",
            textAlign: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.2em",
              color: BRAND,
              marginBottom: 8,
            }}
          >
            ABOUT QOCCA
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 500,
              margin: 0,
              marginBottom: 24,
              color: TEXT_DARK,
            }}
          >
            Qoccaって、どんな場所?
          </h2>

          <div
            style={{
              display: "inline-block",
              textAlign: "left",
              margin: "0 auto",
            }}
          >
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

          <div
            style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: `1px solid ${BORDER_WARM}`,
            }}
          >
            <p
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 18,
                fontStyle: "italic",
                color: TEXT_DARK,
                margin: 0,
              }}
            >
              「想いを形にして、ふたりをつなぐ。」
            </p>
          </div>
        </div>

        {/* 3つの特徴 */}
        <div style={{ marginBottom: 40 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 500,
              textAlign: "center",
              color: TEXT_DARK,
              margin: 0,
              marginBottom: 24,
            }}
          >
            Qoccaの3つの特徴
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
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
        <div style={{ marginBottom: 40 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 500,
              textAlign: "center",
              color: TEXT_DARK,
              margin: 0,
              marginBottom: 24,
            }}
          >
            使い方
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr auto 1fr",
              gap: 8,
              alignItems: "start",
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            <Step
              num={1}
              title="探す"
              body={
                <>
                  作品や出品者を
                  <br />
                  カテゴリから探す
                </>
              }
            />
            <StepArrow />
            <Step
              num={2}
              title="依頼する"
              body={
                <>
                  想いを伝えて
                  <br />
                  注文する
                </>
              }
            />
            <StepArrow />
            <Step
              num={3}
              title="受け取る"
              body={
                <>
                  完成した作品を
                  <br />
                  受け取る
                </>
              }
            />
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <Link
            to="/about"
            style={{
              display: "inline-block",
              padding: "12px 32px",
              background: BRAND,
              color: "white",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            もっと詳しく知る →
          </Link>
        </div>
      </div>
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
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 16,
        marginBottom: isLast ? 0 : 8,
      }}
    >
      <span
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 28,
          fontWeight: 500,
          color: BRAND,
          minWidth: 32,
        }}
      >
        {letter}
      </span>
      <span style={{ fontSize: 15, color: TEXT_DARK }}>
        <span style={{ fontWeight: 500 }}>{word}</span>{" "}
        <span style={{ color: TEXT_MUTED }}>— {desc}</span>
      </span>
    </div>
  );
}

function FeatureMini({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "24px 16px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          background: CREAM_DARK,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 12px",
        }}
      >
        <Icon size={22} strokeWidth={1.8} color={BRAND} />
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: TEXT_DARK,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.6 }}>
        {body}
      </div>
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
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          background: BRAND,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 12px",
          color: "white",
          fontSize: 22,
          fontWeight: 500,
        }}
      >
        {num}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: TEXT_DARK,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>
        {body}
      </div>
    </div>
  );
}

function StepArrow() {
  return (
    <div
      style={{
        marginTop: 20,
        color: BRAND,
        fontSize: 20,
        flexShrink: 0,
      }}
    >
      →
    </div>
  );
}
