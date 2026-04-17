declare module '@mapbox/polyline' {
  export function decode(encoded: string, precision?: number): [number, number][];
  export function encode(coords: [number, number][], precision?: number): string;
}

declare namespace GeoJSON {
  interface Position {
    0: number;
    1: number;
  }
  interface LineString {
    type: 'LineString';
    coordinates: Position[];
  }
  interface MultiLineString {
    type: 'MultiLineString';
    coordinates: Position[][];
  }
}