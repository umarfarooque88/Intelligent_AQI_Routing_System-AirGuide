import { LatLng } from './decodePolyline';

export interface Route {
  id: string;
  name: string;
  overview_polyline: string;
  overviewPath: any[];
  legs: Array<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    start_location: LatLng;
    end_location: LatLng;
  }>;
  totalDistance: number;
  totalDuration: number;
}

interface DirectionsRoute {
  overview_polyline: { points: string };
  overview_path?: any[];
  legs: Array<{
    distance: { value: number };
    duration: { value: number };
    steps?: Array<{
      distance: { value: number };
      duration: { value: number };
      polyline: { encoded: string };
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
    }>;
  }>;
}

interface CacheEntry {
  data: Route[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000;

let mockLatLngConstructor: any = null;

function createMockLatLng(lat: number, lng: number): any {
  if (mockLatLngConstructor) {
    return new mockLatLngConstructor(lat, lng);
  }
  return { lat, lng, toString: () => `(${lat}, ${lng})` };
}

function generateMockRoutes(origin: LatLng, dest: LatLng): Route[] {
  const latDiff = dest.lat - origin.lat;
  const lngDiff = dest.lng - origin.lng;
  
  const route1Points: any[] = [];
  const route2Points: any[] = [];
  
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    route1Points.push(createMockLatLng(
      origin.lat + latDiff * t + Math.sin(t * Math.PI * 2) * 0.003,
      origin.lng + lngDiff * t + Math.cos(t * Math.PI * 2) * 0.003
    ));
    route2Points.push(createMockLatLng(
      origin.lat + latDiff * t - Math.sin(t * Math.PI * 2) * 0.004,
      origin.lng + lngDiff * t - Math.cos(t * Math.PI * 2) * 0.002
    ));
  }

  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
  
  return [
    {
      id: 'route-0',
      name: 'Fastest Route',
      overview_polyline: '',
      overviewPath: route1Points,
      legs: [{
        distance: { text: `${distance.toFixed(1)} km`, value: Math.round(distance * 1000) },
        duration: { text: `${Math.round(distance * 3)} mins`, value: Math.round(distance * 180) },
        start_location: origin,
        end_location: dest,
      }],
      totalDistance: Math.round(distance * 1000),
      totalDuration: Math.round(distance * 180),
    },
    {
      id: 'route-1',
      name: 'Cleaner Route',
      overview_polyline: '',
      overviewPath: route2Points,
      legs: [{
        distance: { text: `${(distance * 1.15).toFixed(1)} km`, value: Math.round(distance * 1150) },
        duration: { text: `${Math.round(distance * 4)} mins`, value: Math.round(distance * 240) },
        start_location: origin,
        end_location: dest,
      }],
      totalDistance: Math.round(distance * 1150),
      totalDuration: Math.round(distance * 240),
    },
  ];
}

export async function getRoutes(
  origin: string | LatLng,
  destination: string | LatLng,
  googleInstance?: typeof google
): Promise<Route[]> {
  if (googleInstance && !mockLatLngConstructor) {
    mockLatLngConstructor = googleInstance.maps.LatLng;
  }

  const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
  const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;
  const cacheKey = `${originStr}-${destStr}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('[getRoutes] Using cached routes');
    console.log('[getRoutes] Cached route duration:', cached.data[0]?.totalDuration, 'seconds');
    return cached.data;
  }

  if (googleInstance && typeof googleInstance.maps !== 'undefined') {
    console.log('[getRoutes] Using Google Maps JavaScript API for directions');
    return new Promise((resolve, reject) => {
      const directionsService = new googleInstance.maps.DirectionsService();
      const originLatLng = typeof origin === 'string' 
        ? origin 
        : new googleInstance.maps.LatLng(origin.lat, origin.lng);
      const destLatLng = typeof destination === 'string' 
        ? destination 
        : new googleInstance.maps.LatLng(destination.lat, destination.lng);

      directionsService.route(
        {
          origin: originLatLng,
          destination: destLatLng,
          travelMode: googleInstance.maps.TravelMode.DRIVING,
          provideRouteAlternatives: true,
        },
        (result, status) => {
          if (status !== 'OK' || !result) {
            console.warn(`[getRoutes] DirectionsService error: ${status}. Using mock routes.`);
            const originCoords = typeof origin === 'object' ? origin : { lat: 40.7128, lng: -74.006 };
            const destCoords = typeof destination === 'object' ? destination : { lat: 40.7580, lng: -73.9855 };
            const mockRoutes = generateMockRoutes(originCoords, destCoords);
            cache.set(cacheKey, { data: mockRoutes, timestamp: Date.now() });
            resolve(mockRoutes);
            return;
          }

          console.log(`[getRoutes] Got ${result.routes.length} routes from DirectionsService`);

          const routes: Route[] = result.routes.slice(0, 3).map((route: any, index: number) => {
            const leg = route.legs[0];
            const totalDistance = leg.distance.value;
            const totalDuration = leg.duration.value;

            console.log(`[getRoutes] Route ${index}: ${totalDuration}s (${Math.round(totalDuration/60)}min), ${totalDistance/1000}km`);
            console.log(`[getRoutes] Route ${index}: overview_path has ${route.overview_path?.length || 0} points`);

            return {
              id: `route-${index}`,
              name: index === 0 ? 'Fastest Route' : `Alternative ${index + 1}`,
              overview_polyline: route.overview_polyline?.points || '',
              overviewPath: route.overview_path || [],
              legs: route.legs,
              totalDistance,
              totalDuration,
            };
          });

          cache.set(cacheKey, { data: routes, timestamp: Date.now() });
          resolve(routes);
        }
      );
    });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey || apiKey === 'AIzaSyCnH0aAMWuyk9fpzzczuOKzQblEPffDISM') {
    console.log('[getRoutes] Using mock routes (no valid API key)');
    const originCoords = typeof origin === 'string' 
      ? { lat: 40.7128, lng: -74.006 } 
      : origin;
    const destCoords = typeof destination === 'string' 
      ? { lat: 40.7580, lng: -73.9855 } 
      : destination;
    
    const mockRoutes = generateMockRoutes(originCoords, destCoords);
    cache.set(cacheKey, { data: mockRoutes, timestamp: Date.now() });
    return mockRoutes;
  }

  console.log('[getRoutes] No Google instance available, using mock routes');
  const originCoords = typeof origin === 'object' ? origin : { lat: 40.7128, lng: -74.006 };
  const destCoords = typeof destination === 'object' ? destination : { lat: 40.7580, lng: -73.9855 };
  const mockRoutes = generateMockRoutes(originCoords, destCoords);
  cache.set(cacheKey, { data: mockRoutes, timestamp: Date.now() });
  return mockRoutes;
}
