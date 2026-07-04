// 「あしあと」🐾 ブランドアイコン (Phase C-1 UI第1弾)
// King検収済み i1_ashiato_b.svg (ashiato-assets バケット・オレンジ#F5A94A単色) を表示。
// 残高カード・価格表示・トーストで size を変えて使い回す。

const ICON_URL =
  "https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/ashiato-assets/icon/i1_ashiato_b.svg";

type Props = {
  size?: number;          // px (default 20)
  style?: React.CSSProperties;
  alt?: string;
};

export const AshiatoIcon = ({ size = 20, style, alt = "あしあと" }: Props) => (
  <img
    src={ICON_URL}
    alt={alt}
    width={size}
    height={size}
    loading="lazy"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  />
);
