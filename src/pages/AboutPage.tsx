// src/pages/AboutPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  Users,
  Sparkles,
  Camera,
  Mail,
  PenLine,
  Calendar,
  PawPrint,
  ShieldCheck,
  Tag,
  MapPin,
  Instagram,
} from "lucide-react";

const BRAND = "#F5A94A";
const BRAND_DEEP = "#B27820";
const CREAM = "#FFF9F0";
const CREAM_DARK = "#FFF2DF";
const TEXT_DARK = "#2C2C2A";
const TEXT_MID = "#444441";
const TEXT_MUTED = "#888780";
const BORDER = "#F1EFE8";
const BORDER_WARM = "#F5E6D0";

const container: React.CSSProperties = {
  background: "#FFFFFF",
  color: TEXT_DARK,
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const sectionBase: React.CSSProperties = {
  padding: "64px 24px",
  maxWidth: 720,
  margin: "0 auto",
};

const badgeLabel: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.2em",
  color: BRAND,
  marginBottom: 8,
};

const h2Style: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 500,
  margin: 0,
  color: TEXT_DARK,
};

export default function AboutPage() {
  return (
    <div style={container}>
      {/* ================= HERO ================= */}
      <section
        style={{
          background: `linear-gradient(180deg, ${CREAM} 0%, #FFFFFF 100%)`,
          padding: "64px 24px 72px",
          textAlign: "center",
        }}
      >
        <img
          src="/logo.png"
          alt="Qocca"
          style={{
            width: 64,
            height: 64,
            objectFit: "contain",
            margin: "0 auto 20px",
            display: "block",
          }}
        />
        <div style={badgeLabel}>ABOUT QOCCA</div>
        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.4,
            margin: 0,
            marginBottom: 16,
            color: TEXT_DARK,
          }}
        >
          想いを形にして、
          <br />
          ふたりをつなぐ。
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.8,
            color: TEXT_MUTED,
            maxWidth: 460,
            margin: "0 auto",
          }}
        >
          Qoccaは、ペットオーナーと、
          <br />
          作品をつくるクリエイターが出会う場所です。
        </p>
      </section>

      {/* ================= WHY QUOKKA ================= */}
      <section style={{ ...sectionBase, textAlign: "center" }}>
        <div style={badgeLabel}>WHY QUOKKA</div>
        <h2 style={{ ...h2Style, marginBottom: 24 }}>なぜ、クオッカ?</h2>
        <img
          src="/logo.png"
          alt="Qocca"
          style={{
            width: 96,
            height: 96,
            objectFit: "contain",
            margin: "0 auto 20px",
            display: "block",
          }}
        />
        <p style={{ fontSize: 14, lineHeight: 2, color: TEXT_MID, margin: 0 }}>
          「世界一しあわせな動物」と呼ばれる、クオッカ。
          <br />
          いつも笑っているように見える、その表情。
          <br />
          <br />
          ペットと過ごす毎日に、もっと笑顔が増えますように。
          <br />
          そんな願いをこめて、Qoccaと名付けました。
        </p>
      </section>

      {/* ================= THE STORY (QOCCA) ================= */}
      <section style={sectionBase}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={badgeLabel}>THE STORY</div>
          <h2 style={h2Style}>Qoccaという名前の物語</h2>
        </div>

        <StoryRow
          letter="Q"
          small="uokka"
          title="クオッカの笑顔とともに"
          body="世界一しあわせな動物と呼ばれる、クオッカ。ペットと過ごす毎日に、もっと笑顔が増えますように。"
        />
        <StoryRow
          letter="O"
          small="ffer"
          title="想いを差し出し"
          body="大切な家族への、言葉にならない愛情。その想いを、かたちにしてほしいという願いから、物語は始まります。"
        />
        <StoryRow
          letter="C"
          small="raft"
          title="手で形にして"
          body="クリエイターが一点ずつ、丁寧に仕上げる手仕事。同じものは、ふたつとない。だからこそ宝物になります。"
        />
        <StoryRow
          letter="C"
          small="onnect"
          title="ふたりをつなぐ"
          body="ペットを愛するオーナーと、作品に愛情をこめるクリエイター。Qoccaは、そのふたりが出会うための場所です。"
        />
        <StoryRow
          letter="A"
          small="ffection"
          title="愛情が生まれる場所"
          body="ひとつの作品が、新しい愛情をまた生み出していく。Qoccaは、そんな連鎖を信じています。"
          isLast
        />
      </section>

      {/* ================= COMMUNITY ================= */}
      <section style={{ padding: "16px 24px" }}>
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            background: `linear-gradient(180deg, ${CREAM} 0%, ${CREAM_DARK} 100%)`,
            borderRadius: 24,
            padding: "48px 24px 40px",
            textAlign: "center",
          }}
        >
          <div style={badgeLabel}>COMMUNITY</div>
          <h2 style={{ ...h2Style, lineHeight: 1.5, marginBottom: 16 }}>
            ただの市場じゃない、
            <br />
            コミュニティがある。
          </h2>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.9,
              color: TEXT_MID,
              maxWidth: 480,
              margin: "0 auto 32px",
            }}
          >
            Qoccaは、作品を売り買いするだけの場所ではありません。
            <br />
            ペットを想うオーナー、作品に愛情をこめるクリエイターが集まり、
            <br />
            お互いに刺激しあい、支えあう——
            <br />
            そんな温かいコミュニティが、自然に育つ場所です。
          </p>

          {/* 3つの価値 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              maxWidth: 520,
              margin: "0 auto 32px",
            }}
          >
            <CommunityCard
              Icon={MessageCircle}
              title="想いを語る"
              body="作品の裏側、うちの子のこと、なんでも話せる"
            />
            <CommunityCard
              Icon={Users}
              title="仲間と出会う"
              body="同じ想いを持った仲間が、ここにはいる"
            />
            <CommunityCard
              Icon={Sparkles}
              title="日常が豊かに"
              body="ペットとの毎日が、もっと特別になる"
            />
          </div>

          {/* Qoccaだからできること */}
          <div
            style={{
              borderTop: `1px solid ${BORDER_WARM}`,
              paddingTop: 24,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: BRAND_DEEP,
                marginBottom: 16,
              }}
            >
              Qoccaだからできること
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                maxWidth: 480,
                margin: "0 auto",
                textAlign: "left",
              }}
            >
              <CanDoCard
                Icon={Camera}
                title="ギャラリーで"
                body="うちの子の写真を共有"
              />
              <CanDoCard
                Icon={Mail}
                title="メッセージで"
                body="クリエイターと直接つながる"
              />
              <CanDoCard
                Icon={PenLine}
                title="ブログで"
                body="作品や想いを発信"
              />
              <CanDoCard
                Icon={Calendar}
                title="イベントで"
                body="オフラインで出会う"
              />
            </div>
          </div>

          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 17,
              fontStyle: "italic",
              color: TEXT_DARK,
              margin: "28px 0 0",
            }}
          >
            想いが集まる場所に、物語は生まれる。
          </p>
        </div>
      </section>

      {/* ================= VISION & MISSION ================= */}
      <section style={sectionBase}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={badgeLabel}>VISION &amp; MISSION</div>
          <h2 style={h2Style}>わたしたちの想い</h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <VisionCard label="MISSION" small="日々の使命" text={<>ペットと過ごす時間を、<br />もっと特別なものに。</>} />
          <VisionCard label="VISION" small="目指す未来" text={<>すべてのうちの子に、<br />その子だけの物語を。</>} />
        </div>
      </section>

      {/* ================= 3つの安心 ================= */}
      <section style={{ background: CREAM, padding: "64px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={badgeLabel}>WHY QOCCA</div>
            <h2 style={h2Style}>3つの安心</h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            <SafetyCard
              Icon={PawPrint}
              title="ペット専門の場所"
              body="うちの子のための作品だけ。愛犬・愛猫を想うクリエイターが集まります。"
            />
            <SafetyCard
              Icon={ShieldCheck}
              title="エスクロー決済"
              body="支払いは一度Qoccaが預かり、納品確認後にクリエイターへ。万が一も返金対応。"
            />
            <SafetyCard
              Icon={Tag}
              title="初回手数料0%"
              body="はじめての取引は、手数料ゼロから。クリエイターも購入者も気軽に始められます。"
            />
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section style={sectionBase}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={badgeLabel}>FEATURES</div>
          <h2 style={h2Style}>Qoccaの機能</h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <FeatureCard
            Icon={Camera}
            title="ギャラリー"
            body="うちの子の写真をシェア。他のオーナーさんの投稿もお楽しみに。"
          />
          <FeatureCard
            Icon={MapPin}
            title="施設マップ"
            body="ペット対応施設を地図で探せる。お出かけの新しい発見を。"
          />
          <FeatureCard
            Icon={PenLine}
            title="ブログ"
            body="ペットケアや作品の話題を発信。読むほど愛が深まる。"
          />
          <FeatureCard
            Icon={Calendar}
            title="イベント"
            body="オフ会・ポップアップ情報。オンラインを越えた出会いを。"
          />
        </div>
      </section>

      {/* ================= FOR OWNERS / CREATORS ================= */}
      <section style={sectionBase}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <RoleCard
            label="FOR OWNERS"
            title="オーナー様へ"
            items={[
              "うちの子だけの、世界にひとつの作品",
              "エスクローで安心の取引",
              "クリエイターと想いを共有できる",
              "似顔絵・洋服・写真・グッズ・フード・しつけ",
            ]}
          />
          <RoleCard
            label="FOR CREATORS"
            title="クリエイター様へ"
            items={[
              "ペット愛好家に直接届く",
              "初回手数料0%でスタート",
              "ギャラリー・ブログで発信",
              "作品ごとのやりとりで信頼を育める",
            ]}
          />
        </div>
      </section>

      {/* ================= FEE ================= */}
      <section style={{ background: CREAM, padding: "48px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={badgeLabel}>FEE STRUCTURE</div>
            <h2 style={h2Style}>手数料について</h2>
            <p style={{ fontSize: 12, color: TEXT_MUTED, margin: "8px 0 0" }}>
              購入者様は表示価格のみ。手数料は出品者様からいただきます。
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <FeeCard label="はじめての取引" value="0%" sub="決済手数料のみ" />
            <FeeCard label="3ヶ月以内" value="5%" sub="+決済手数料3.6%" />
            <FeeCard label="通常" value="10%" sub="+決済手数料3.6%" />
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section style={sectionBase}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={badgeLabel}>FAQ</div>
          <h2 style={h2Style}>よくある質問</h2>
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          <FaqRow
            q="支払いはいつ発生しますか?"
            a="購入時にQoccaがお預かりし、納品から72時間経過後にクリエイターへ送金します。万が一のトラブルがあった場合は返金対応いたします。"
          />
          <FaqRow
            q="注文をキャンセルできますか?"
            a="作業開始前であれば全額返金で対応します。作業開始後は決済手数料を差し引いて返金、納品後72時間以内は異議申立が可能です。"
          />
          <FaqRow
            q="クリエイターとして出品したい"
            a="会員登録後、「出品する」からすぐに始められます。初回取引は手数料0%、安心してスタートできます。"
          />
          <FaqRow
            q="クリエイターと直接やりとりできますか?"
            a="メッセージ機能でクリエイターと直接やりとりできます。うちの子の写真や要望を伝えて、世界にひとつの作品を作ってもらえます。"
          />
          <FaqRow
            q="対応カテゴリは?"
            a="似顔絵、お洋服、フォト、グッズ、フード、しつけの6カテゴリです。今後も拡充予定です。"
          />
        </div>
      </section>

      {/* ================= INSTAGRAM ================= */}
      <section
        style={{
          background: CREAM,
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <div style={badgeLabel}>FOLLOW US</div>
        <h2 style={{ ...h2Style, marginBottom: 12 }}>Instagramでも発信中</h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 24px" }}>
          最新の作品情報・キャンペーン情報をお届け
        </p>
        <a
          href="https://instagram.com/qocca_pet"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 32px",
            background: "#FFFFFF",
            border: `1px solid ${BRAND}`,
            color: BRAND,
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          <Instagram size={16} strokeWidth={2} />
          @qocca_pet をフォロー
        </a>
      </section>

      {/* ================= CTA ================= */}
      <section style={{ padding: "64px 24px", textAlign: "center" }}>
        <img
          src="/logo.png"
          alt="Qocca"
          style={{
            width: 48,
            height: 48,
            objectFit: "contain",
            margin: "0 auto 16px",
            display: "block",
          }}
        />
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 20,
            fontStyle: "italic",
            color: TEXT_DARK,
            margin: "0 0 24px",
          }}
        >
          想いを形にして、ふたりをつなぐ。
        </p>
        <Link
          to="/"
          style={{
            display: "inline-block",
            padding: "14px 40px",
            background: BRAND,
            color: "white",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Qoccaをはじめる →
        </Link>
      </section>
    </div>
  );
}

/* ===================== Sub components ===================== */

function StoryRow({
  letter,
  small,
  title,
  body,
  isLast,
}: {
  letter: string;
  small: string;
  title: string;
  body: string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        marginBottom: isLast ? 0 : 20,
        paddingBottom: isLast ? 0 : 20,
        borderBottom: isLast ? "none" : `1px dashed ${BORDER}`,
      }}
    >
      <div style={{ flexShrink: 0, width: 72, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 52,
            fontWeight: 500,
            color: BRAND,
            lineHeight: 1,
          }}
        >
          {letter}
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            color: BRAND_DEEP,
            marginTop: 6,
          }}
        >
          {small}
        </div>
      </div>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.5,
            color: TEXT_DARK,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.9,
            color: TEXT_MUTED,
            marginTop: 4,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function CommunityCard({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          background: CREAM,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 10px",
        }}
      >
        <Icon size={22} strokeWidth={2} color={BRAND} />
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: TEXT_DARK,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.6, color: TEXT_MUTED }}>
        {body}
      </div>
    </div>
  );
}

function CanDoCard({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          background: CREAM,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} strokeWidth={2} color={BRAND} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT_DARK }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function VisionCard({
  label,
  small,
  text,
}: {
  label: string;
  small: string;
  text: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        padding: "28px 24px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: "0.15em",
          color: BRAND,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 6 }}>
        {small}
      </div>
      <p
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 16,
          lineHeight: 1.7,
          color: TEXT_DARK,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

function SafetyCard({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 16,
        padding: "28px 16px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: CREAM_DARK,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        <Icon size={28} strokeWidth={1.8} color={BRAND} />
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: TEXT_DARK,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.7, color: TEXT_MUTED }}>
        {body}
      </div>
    </div>
  );
}

function FeatureCard({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "20px 18px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: CREAM,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} strokeWidth={2} color={BRAND} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: TEXT_DARK }}>
          {title}
        </div>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.7, color: TEXT_MUTED }}>
        {body}
      </div>
    </div>
  );
}

function RoleCard({
  label,
  title,
  items,
}: {
  label: string;
  title: string;
  items: string[];
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        padding: "32px 24px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: "0.15em",
          color: BRAND,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <h3
        style={{
          fontSize: 17,
          fontWeight: 500,
          color: TEXT_DARK,
          margin: "0 0 16px",
        }}
      >
        {title}
      </h3>
      <div style={{ fontSize: 13, lineHeight: 1.9, color: TEXT_MID }}>
        {items.map((item, i) => (
          <div key={i}>・{item}</div>
        ))}
      </div>
    </div>
  );
}

function FeeCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        padding: "20px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color: BRAND }}>{value}</div>
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${BORDER}`,
        padding: "20px 4px",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: TEXT_DARK,
          marginBottom: 8,
        }}
      >
        Q. {q}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.9, color: TEXT_MUTED }}>
        {a}
      </div>
    </div>
  );
}
