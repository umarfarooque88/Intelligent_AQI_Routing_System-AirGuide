import { LatLng } from './decodePolyline';

const aqiCache = new Map<string, { aqi: number; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000;

function getCacheKey(lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  return `${roundedLat},${roundedLng}`;
}

export interface AQIResult {
  aqi: number;
  category: string;
  color: string;
}

export function getAQICategory(aqi: number): { category: string; color: string } {
  if (aqi <= 50) return { category: 'Good', color: '#00e400' };
  if (aqi <= 100) return { category: 'Moderate', color: '#ffff00' };
  if (aqi <= 150) return { category: 'Unhealthy for Sensitive Groups', color: '#ff7e00' };
  if (aqi <= 200) return { category: 'Unhealthy', color: '#ff0000' };
  if (aqi <= 300) return { category: 'Very Unhealthy', color: '#8f3f97' };
  return { category: 'Hazardous', color: '#7e0023' };
}

function generateMockAQI(): AQIResult {
  const aqi = Math.floor(Math.random() * 120) + 20;
  const { category, color } = getAQICategory(aqi);
  return { aqi, category, color };
}

export async function getAQIAtLocation(lat: number, lng: number): Promise<AQIResult> {
  const cacheKey = getCacheKey(lat, lng);
  const cached = aqiCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    const { category, color } = getAQICategory(cached.aqi);
    return { aqi: cached.aqi, category, color };
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AIR_QUALITY_API_KEY;
  
  if (!apiKey || apiKey === 'AIzaSyCnH0aAMWuyk9fpzzczuOKzQblEPffDISM') {
    console.log('Using mock AQI data (no API key configured)');
    const mockResult = generateMockAQI();
    aqiCache.set(cacheKey, { aqi: mockResult.aqi, timestamp: Date.now() });
    return mockResult;
  }

  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;

  const body = {
    location: {
      latitude: lat,
      longitude: lng,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn(`AQI API error: ${response.status}. Using mock data.`);
      const mockResult = generateMockAQI();
      aqiCache.set(cacheKey, { aqi: mockResult.aqi, timestamp: Date.now() });
      return mockResult;
    }

    const data = await response.json();

    let aqi = 0;
    if (data.indexes && data.indexes.length > 0) {
      const aqiIndex = data.indexes.find((idx: { code: string }) => idx.code === 'UAQI');
      if (aqiIndex && aqiIndex.aqi) {
        aqi = aqiIndex.aqi;
      }
    }

    if (aqi === 0) {
      aqi = Math.floor(Math.random() * 100) + 20;
    }

    aqiCache.set(cacheKey, { aqi, timestamp: Date.now() });

    const { category, color } = getAQICategory(aqi);
    return { aqi, category, color };
  } catch (error) {
    console.warn('AQI fetch failed, using mock data:', error);
    const mockResult = generateMockAQI();
    aqiCache.set(cacheKey, { aqi: mockResult.aqi, timestamp: Date.now() });
    return mockResult;
  }
}

export async function getAQIsForLocations(
  locations: LatLng[],
  onProgress?: (current: number, total: number) => void
): Promise<AQIResult[]> {
  const results: AQIResult[] = [];

  for (let i = 0; i < locations.length; i++) {
    try {
      const result = await getAQIAtLocation(locations[i].lat, locations[i].lng);
      results.push(result);
    } catch (error) {
      console.error(`Failed to get AQI for location ${i}:`, error);
      results.push({ aqi: 50, category: 'Moderate', color: '#ffff00' });
    }

    if (onProgress) {
      onProgress(i + 1, locations.length);
    }
  }

  return results;
}