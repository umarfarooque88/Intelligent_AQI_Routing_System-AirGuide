import polyline from '@mapbox/polyline';

export interface LatLng {
  lat: number;
  lng: number;
}

export function decodePolyline(encoded: string): LatLng[] {
  const decoded = polyline.decode(encoded);
  return decoded.map(([lat, lng]) => ({ lat, lng }));
}

export function samplePointsAlongRoute(
  coordinates: LatLng[],
  numSamples: number = 20
): LatLng[] {
  if (coordinates.length === 0) return [];
  if (coordinates.length <= numSamples) return coordinates;

  const step = (coordinates.length - 1) / (numSamples - 1);
  const sampled: LatLng[] = [];

  for (let i = 0; i < numSamples; i++) {
    const index = Math.floor(i * step);
    sampled.push(coordinates[index]);
  }

  return sampled;
}

export function calculateDistance(point1: LatLng, point2: LatLng): number {
  const R = 6371;
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLon = ((point2.lng - point1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateTotalDistance(coordinates: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += calculateDistance(coordinates[i - 1], coordinates[i]);
  }
  return total;
}