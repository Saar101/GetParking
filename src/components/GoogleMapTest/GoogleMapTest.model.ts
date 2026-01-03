export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
};

export const DEFAULT_CENTER = { lat: 31.7683, lng: 35.2137 }; // Jerusalem
export const DEFAULT_ZOOM = 13;

export const DEMO_POINTS: MapPoint[] = [
  { id: "p1", lat: 31.778, lng: 35.235, title: "Point A" },
  { id: "p2", lat: 31.765, lng: 35.205, title: "Point B" },
  { id: "p3", lat: 31.755, lng: 35.225, title: "Point C" },
];

export function clampZoom(z: number) {
  if (z < 3) return 3;
  if (z > 20) return 20;
  return z;
}
