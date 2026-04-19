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

const BRAND_ORANGE = "#F5A94A";
const BRAND_ORANGE_DEEP = "#B27820";

export default function AboutPage() {
  return (
    <div className="bg-white text-neutral-800">
      {/* ================= HERO ================= */}
      <section className="bg-gradient-to-b from-[#FFF9F0] to-white px-6 py-16 text-center md:py-20">
        <img
          src="/logo.png"
          alt="Qocca"
          className="mx-auto mb-5 h-16 w-16 object-contain"
        />
        <div className="mb-4 text-xs tracking-[0.3em] text-[color:var(--brand)]">
          ABOUT QOCCA
        </div>
        <h1 className="mb-4 font-serif text-3xl font-normal leading-snug md:text-4xl">
          想いを形にして、
          <br />
          ふたりをつなぐ。
        </h1>
        <p className="mx-auto max-w-[460px] text-sm leading-[1.9] text-neutral-500">
          Qoccaは、ペットオーナーと、
          <br />
          作品をつくるクリエイターが出会う場所です。
        </p>
      </section>

      {/* ================= WHY QUOKKA ================= */}
      <section className="mx-auto max-w-[680px] px-6 py-16 text-center">
        <div className="mb-2 text-xs tracking-[0.3em] text-[color:var(--brand)]">
          WHY QUOKKA
        </div>
        <h2 className="mb-6 text-xl font-medium">なぜ、クオッカ?</h2>
        <img
          src="/logo.png"
          alt="Qocca"
          className="mx-auto mb-5 h-24 w-24 object-contain"
        />
        <p className="text-sm leading-[2] text-neutral-600">
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
      <section className="mx-auto max-w-[680px] px-6 py-16">
        <div className="mb-10 text-center">
          <div className="mb-2 text-xs tracking-[0.3em] text-[color:var(--brand)]">
            THE STORY
          </div>
          <h2 className="text-xl font-medium">Qoccaという名前の物語</h2>
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
      <section className="px-4 py-4">
        <div className="mx-auto max-w-[680px] rounded-3xl bg-gradient-to-b from-[#FFF9F0] to-[#FFF2DF] px-6 py-12 text-center">
          <div className="mb-3 text-xs tracking-[0.3em] text-[color:var(--brand)]">
            COMMUNITY
          </div>
          <h2 className="mb-4 text-xl font-medium leading-snug">
            ただの市場じゃない、
            <br />
            コミュニティがある。
          </h2>
          <p className="mx-auto mb-8 max-w-[480px] text-sm leading-[1.9] text-neutral-700">
            Qoccaは、作品を売り買いするだけの場所ではありません。
            <br />
            ペットを想うオーナー、作品に愛情をこめるクリエイターが集まり、
            <br />
            お互いに刺激しあい、支えあう——
            <br />
            そんな温かいコミュニティが、自然に育つ場所です。
          </p>

          {/* 3つの価値 */}
          <div className="mx-auto mb-8 grid max-w-[520px] grid-cols-3 gap-3">
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
          <div className="border-t border-[#F5E6D0] pt-6">
            <div className="mb-4 text-sm font-medium text-[color:var(--brand-deep)]">
              Qoccaだからできること
            </div>
            <div className="mx-auto grid max-w-[480px] grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
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

          <p className="mt-7 font-serif text-lg italic">
            想いが集まる場所に、物語は生まれる。
          </p>
        </div>
      </section>

      {/* ================= VISION & MISSION ================= */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-[680px]">
          <div className="mb-8 text-center">
            <div className="mb-2 text-xs tracking-[0.3em] text-[color:var(--brand)]">
              VISION &amp; MISSION
            </div>
            <h2 className="text-xl font-medium">わたしたちの想い</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-[20px] border border-[#F1EFE8] bg-white p-7">
              <div className="mb-2.5 text-xs tracking-[0.2em] text-[color:var(--brand)]">
                MISSION
              </div>
              <div className="mb-1.5 text-xs text-neutral-500">日々の使命</div>
              <p className="font-serif text-base leading-[1.7] text-neutral-800">
                ペットと過ごす時間を、
                <br />
                もっと特別なものに。
              </p>
            </div>
            <div className="rounded-[20px] border border-[#F1EFE8] bg-white p-7">
              <div className="mb-2.5 text-xs tracking-[0.2em] text-[color:var(--brand)]">
                VISION
              </div>
              <div className="mb-1.5 text-xs text-neutral-500">目指す未来</div>
              <p className="font-serif text-base leading-[1.7] text-neutral-800">
                すべてのうちの子に、
                <br />
                その子だけの物語を。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3つの安心 ================= */}
      <section className="bg-[#FFF9F0] px-6 py-16">
        <div className="mx-auto max-w-[680px]">
          <div className="mb-8 text-center">
            <div className="mb-2 text-xs tracking-[0.3em] text-[color:var(--brand)]">
              WHY QOCCA
            </div>
            <h2 className="text-xl font-medium">3つの安心</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      <section className="mx-auto max-w-[680px] px-6 py-16">
        <div className="mb-8 text-center">
          <div className="mb-2 text-xs tracking-[0.3em] text-[color:var(--brand)]">
            FEATURES
          </div>
          <h2 className="text-xl font-medium">Qoccaの機能</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
      <section className="mx-auto max-w-[680px] px-6 py-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[20px] border border-[#F1EFE8] bg-white p-8">
            <div className="mb-2 text-xs tracking-[0.2em] text-[color:var(--brand)]">
              FOR OWNERS
            </div>
            <h3 className="mb-4 text-base font-medium">オーナー様へ</h3>
            <ul className="space-y-1.5 text-sm leading-[1.9] text-neutral-700">
              <li>・うちの子だけの、世界にひとつの作品</li>
              <li>・エスクローで安心の取引</li>
              <li>・クリエイターと想いを共有できる</li>
              <li>・似顔絵・洋服・写真・グッズ・フード・しつけ</li>
            </ul>
          </div>
          <div className="rounded-[20px] border border-[#F1EFE8] bg-white p-8">
            <div className="mb-2 text-xs tracking-[0.2em] text-[color:var(--brand)]">
              FOR CREATORS
            </div>
            <h3 className="mb-4 text-base font-medium">クリエイター様へ</h3>
            <ul className="space-y-1.5 text-sm leading-[1.9] text-neutral-700">
              <li>・ペット愛好家に直接届く</li>
              <li>・初回手数料0%でスタート</li>
              <li>・ギャラリー・ブログで発信</li>
              <li>・作品ごとのやりとりで信頼を育める</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================= FEE ================= */}
      <section className="bg-[#FFF9F0] px-6 py-12">
        <div className="mx-auto max-w-[680px]">
          <div className="mb-7 text-center">
            <div className="mb-2 text-xs tracking-[0.3em] text-[color:var(--brand)]">
              FEE STRUCTURE
            </div>
            <h2 className="text-xl font-medium">手数料について</h2>
            <p className="mt-2 text-xs text-neutral-500">
              購入者様は表示価格のみ。手数料は出品者様からいただきます。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FeeCard label="はじめての取引" value="0%" sub="決済手数料のみ" />
            <FeeCard label="3ヶ月以内" value="5%" sub="+決済手数料3.6%" />
            <FeeCard label="通常" value="10%" sub="+決済手数料3.6%" />
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="mx-auto max-w-[680px] px-6 py-16">
        <div className="mb-7 text-center">
          <div className="mb-2 text-xs tracking-[0.3em] text-[color:var(--brand)]">
            FAQ
          </div>
          <h2 className="text-xl font-medium">よくある質問</h2>
        </div>
        <div className="border-t border-[#F1EFE8]">
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
      <section className="bg-[#FFF9F0] px-6 py-12 text-center">
        <div className="mb-2 text-xs tracking-[0.3em] text-[color:var(--brand)]">
          FOLLOW US
        </div>
        <h2 className="mb-3 text-xl font-medium">Instagramでも発信中</h2>
        <p className="mb-6 text-sm text-neutral-500">
          最新の作品情報・キャンペーン情報をお届け
        </p>
        <a
          href="https://instagram.com/qocca_pet"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand)] bg-white px-8 py-3 text-sm font-medium text-[color:var(--brand)] transition hover:bg-[#FFF9F0]"
        >
          <Instagram className="h-4 w-4" strokeWidth={2} />
          @qocca_pet をフォロー
        </a>
      </section>

      {/* ================= CTA ================= */}
      <section className="px-6 py-16 text-center">
        <img
          src="/logo.png"
          alt="Qocca"
          className="mx-auto mb-4 h-12 w-12 object-contain"
        />
        <p className="mb-6 font-serif text-xl italic">
          想いを形にして、ふたりをつなぐ。
        </p>
        <Link
          to="/"
          className="inline-block rounded-full bg-[color:var(--brand)] px-10 py-3.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Qoccaをはじめる →
        </Link>
      </section>

      {/* CSS variable for brand color */}
      <style>{`
        :root {
          --brand: ${BRAND_ORANGE};
          --brand-deep: ${BRAND_ORANGE_DEEP};
        }
      `}</style>
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
      className={`flex gap-5 ${
        isLast ? "" : "mb-5 border-b border-dashed border-[#F1EFE8] pb-5"
      }`}
    >
      <div className="w-[72px] flex-shrink-0 text-center">
        <div
          className="font-serif text-[52px] font-medium leading-none"
          style={{ color: "var(--brand)" }}
        >
          {letter}
        </div>
        <div
          className="mt-1.5 text-[11px] tracking-[0.08em]"
          style={{ color: "var(--brand-deep)" }}
        >
          {small}
        </div>
      </div>
      <div className="pt-2">
        <div className="text-base font-medium leading-snug text-neutral-800">
          {title}
        </div>
        <div className="mt-1 text-[13px] leading-[1.9] text-neutral-500">
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
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5">
      <div
        className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: "#FFF9F0" }}
      >
        <Icon
          className="h-[22px] w-[22px]"
          strokeWidth={2}
          style={{ color: "var(--brand)" } as React.CSSProperties}
        />
      </div>
      <div className="mb-1 text-[13px] font-medium">{title}</div>
      <div className="text-[11px] leading-[1.6] text-neutral-500">{body}</div>
    </div>
  );
}

function CanDoCard({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3.5">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "#FFF9F0" }}
      >
        <Icon
          className="h-[18px] w-[18px]"
          strokeWidth={2}
          style={{ color: "var(--brand)" } as React.CSSProperties}
        />
      </div>
      <div>
        <div className="text-[13px] font-medium">{title}</div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{body}</div>
      </div>
    </div>
  );
}

function SafetyCard({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-7 text-center">
      <div
        className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "#FFF2DF" }}
      >
        <Icon
          className="h-7 w-7"
          strokeWidth={1.8}
          style={{ color: "var(--brand)" } as React.CSSProperties}
        />
      </div>
      <div className="mb-2 text-[15px] font-medium">{title}</div>
      <div className="text-xs leading-[1.7] text-neutral-500">{body}</div>
    </div>
  );
}

function FeatureCard({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[#F1EFE8] bg-white p-5">
      <div className="mb-2 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "#FFF9F0" }}
        >
          <Icon
            className="h-4 w-4"
            strokeWidth={2}
            style={{ color: "var(--brand)" } as React.CSSProperties}
          />
        </div>
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="text-xs leading-[1.7] text-neutral-500">{body}</div>
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
    <div className="rounded-xl bg-white px-3 py-5 text-center">
      <div className="mb-1.5 text-xs text-neutral-500">{label}</div>
      <div
        className="text-[22px] font-medium"
        style={{ color: "var(--brand)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-b border-[#F1EFE8] py-5">
      <div className="mb-2 text-sm font-medium">Q. {q}</div>
      <div className="text-[13px] leading-[1.9] text-neutral-500">{a}</div>
    </div>
  );
}
