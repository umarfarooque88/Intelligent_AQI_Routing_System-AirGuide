import { AQIResult } from './getAQI';
import { LatLng, calculateDistance } from './decodePolyline';

export interface ExposureMetrics {
  avgAQI: number;
  maxAQI: number;
  minAQI: number;
  exposureScore: number;
  totalDistance: number;
}

export function calculateExposure(
  aqiResults: AQIResult[],
  coordinates: LatLng[],
  totalDurationSeconds: number
): ExposureMetrics {
  if (aqiResults.length === 0 || coordinates.length === 0) {
    return {
      avgAQI: 0,
      maxAQI: 0,
      minAQI: 0,
      exposureScore: 0,
      totalDistance: 0,
    };
  }

  const aqis = aqiResults.map((r) => r.aqi);
  const avgAQI = Math.round(aqis.reduce((a, b) => a + b, 0) / aqis.length);
  const maxAQI = Math.max(...aqis);
  const minAQI = Math.min(...aqis);

  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistance(coordinates[i - 1], coordinates[i]);
  }

  const avgSegmentTime = (totalDurationSeconds / aqiResults.length) / 60;
  const exposureScore = Math.round(
    aqis.reduce((sum, aqi) => sum + aqi * avgSegmentTime, 0)
  );

  return {
    avgAQI,
    maxAQI,
    minAQI,
    exposureScore,
    totalDistance: Math.round(totalDistance * 10) / 10,
  };
}

export function compareRoutes(
  route1: { metrics: ExposureMetrics; duration: number },
  route2: { metrics: ExposureMetrics; duration: number }
): {
  cleanerRoute: number;
  exposureDifference: number;
  exposureSavingsPercent: number;
  timeDifference: number;
} {
  const exp1 = route1.metrics.exposureScore;
  const exp2 = route2.metrics.exposureScore;

  const cleanerRoute = exp1 < exp2 ? 1 : 2;
  const exposureDifference = Math.abs(exp1 - exp2);
  const maxExp = Math.max(exp1, exp2);
  const exposureSavingsPercent = maxExp > 0 ? Math.round((exposureDifference / maxExp) * 100) : 0;

  const timeDifference = Math.round((route2.duration - route1.duration) / 60);

  return {
    cleanerRoute,
    exposureDifference,
    exposureSavingsPercent,
    timeDifference,
  };
}