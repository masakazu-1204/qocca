// ペットウォーカー 近隣マップ (GPS Phase3・docs/petwalker-gps-design.md §3)
// ⚠️ facilities.tsx の FacilityMapView から「初期化パターンのみ」流用 (import はしない・非接触)。
//   流用: L.map/OSMタイル+出典表記/markercluster(chunkedLoading)/DOM直組みポップアップ(XSS安全)/cleanup。
//   再設計: 静けさ世界観 — 絵文字ピン禁止・#F5A94A禁止・font-weight<=500。丸ドットピン(QC.softBrown)。
// ⚠️ このファイルは petwalker.tsx から React.lazy で読む (Leaflet を地図表示時のみロード)。
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { QC, QC_FONT_JP } from "../constants/theme";

type MapSpot = {
  id: string; name: string; pref: string; city: string | null;
  latitude: number | null; longitude: number | null;
};

type Props = {
  items: { s: MapSpot; d: number }[];   // 距離昇順 (nearby view と同じ並び)。特集モードでは d=0
  userLoc?: { lat: number; lng: number } | null;  // 省略時 = 特集のコース地図 (現在地なし・全ピンにフィット)
  isPC?: boolean;
  onSelect: (s: MapSpot) => void;
  distLabel?: (km: number) => string;   // 省略時はポップアップに距離を出さない
};

export default function PetWalkerMapView({ items, userLoc, isPC, onSelect, distLabel }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: userLoc ? [userLoc.lat, userLoc.lng] : [36.2048, 137.7], // 現在地なし時は日本の中心付近 (fitBounds が直後に上書き)
      zoom: userLoc ? 12 : 5,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    const cluster = (L as any).markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 60 });
    map.addLayer(cluster);
    // 現在地: さらに控えめな点 (sage・パルスなし)。特集モードでは出さない
    if (userLoc) {
      const youIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${QC.sage};border:3px solid #fff;box-shadow:0 1px 5px rgba(44,41,38,0.35)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      L.marker([userLoc.lat, userLoc.lng], { icon: youIcon, interactive: false }).addTo(map);
    }
    mapRef.current = map;
    clusterRef.current = cluster;
    requestAnimationFrame(() => map.invalidateSize());
    return () => { map.remove(); mapRef.current = null; clusterRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current, cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    // スポットピン: 絵文字なしの小さな丸ドット (softBrown・白縁)
    const pinIcon = L.divIcon({
      className: "",
      html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 3px;background:${QC.softBrown};border:2px solid #fff;box-shadow:0 1px 5px rgba(44,41,38,0.30)"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 14], popupAnchor: [0, -12],
    });
    items.forEach(({ s, d }) => {
      const lat = Number(s.latitude), lng = Number(s.longitude);
      if (!isFinite(lat) || !isFinite(lng) || s.latitude == null || s.longitude == null || (lat === 0 && lng === 0)) return;
      const m = L.marker([lat, lng], { icon: pinIcon });
      // ポップアップ (DOM 直組み = textContent で XSS 安全・QCトークン)
      const pop = document.createElement("div");
      pop.style.cssText = `min-width:180px;font-family:${QC_FONT_JP}`;
      const title = document.createElement("div");
      title.style.cssText = `font-weight:500;font-size:13.5px;color:${QC.charcoal};margin-bottom:4px;line-height:1.6`;
      title.textContent = s.name;
      const meta = document.createElement("div");
      meta.style.cssText = `font-size:11.5px;color:${QC.warmGray};font-weight:300;margin-bottom:10px`;
      meta.textContent = [s.pref, s.city].filter(Boolean).join(" ") + (userLoc && distLabel ? `・${distLabel(d)}` : "");
      const btn = document.createElement("button");
      btn.textContent = "くわしく見る →";
      btn.style.cssText = `padding:7px 16px;background:transparent;color:${QC.softBrown};border:1px solid ${QC.softBrown};border-radius:999px;font-weight:400;font-size:12px;cursor:pointer;font-family:${QC_FONT_JP};letter-spacing:0.4px`;
      btn.onclick = () => onSelect(s);
      pop.appendChild(title); pop.appendChild(meta); pop.appendChild(btn);
      m.bindPopup(pop);
      cluster.addLayer(m);
    });
    // 初期表示: 現在地 + 近い順30件を収める (遠方まで一気に引かない)。特集モードは全ピンにフィット
    const near = items.slice(0, 30)
      .filter(({ s }) => s.latitude != null && s.longitude != null)
      .map(({ s }) => [Number(s.latitude), Number(s.longitude)] as [number, number]);
    if (near.length > 0) {
      const pts: [number, number][] = userLoc ? [[userLoc.lat, userLoc.lng], ...near] : near;
      map.fitBounds(L.latLngBounds(pts).pad(0.1), { maxZoom: 14 });
    }
  }, [items, onSelect, distLabel, userLoc?.lat, userLoc?.lng]);

  return (
    <div
      ref={containerRef}
      style={{
        height: isPC ? 560 : "60vh", borderRadius: 16, overflow: "hidden",
        border: `1px solid ${QC.lightSand}`, position: "relative", zIndex: 0, isolation: "isolate",
      }}
    />
  );
}
