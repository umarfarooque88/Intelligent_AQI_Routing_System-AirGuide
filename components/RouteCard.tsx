'use client';

import { ExposureMetrics } from '@/lib/calculateExposure';

interface RouteCardProps {
  id: string;
  name: string;
  durationMinutes: number;
  distanceKm: number;
  metrics: ExposureMetrics;
  aqiCategory: string;
  aqiColor: string;
  isWinner?: boolean;
  isFastest?: boolean;
}

export default function RouteCard({
  id,
  name,
  durationMinutes,
  distanceKm,
  metrics,
  aqiCategory,
  aqiColor,
  isWinner,
  isFastest,
}: RouteCardProps) {
  return (
    <div
      className={`relative p-6 rounded-2xl transition-all duration-300 ${
        isWinner
          ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-2 border-emerald-500/50'
          : 'bg-white/5 border border-white/10'
      } backdrop-blur-md`}
    >
      {isWinner && (
        <div className="absolute -top-3 left-6 px-3 py-1 bg-emerald-500 text-black text-xs font-bold rounded-full">
          CLEANER CHOICE
        </div>
      )}
      {isFastest && !isWinner && (
        <div className="absolute -top-3 left-6 px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded-full">
          FASTEST
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{name}</h3>
          <p className="text-sm text-gray-400">
            {distanceKm.toFixed(1)} km
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{durationMinutes}</p>
          <p className="text-xs text-gray-400">minutes</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-xl bg-black/20">
          <p className="text-xs text-gray-400 mb-1">Avg AQI</p>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: aqiColor }}
            />
            <span className="text-lg font-bold text-white">{metrics.avgAQI}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{aqiCategory}</p>
        </div>

        <div className="p-3 rounded-xl bg-black/20">
          <p className="text-xs text-gray-400 mb-1">Exposure</p>
          <p className="text-lg font-bold text-white">{metrics.exposureScore.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">AQI·min</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex justify-between text-xs">
          <div>
            <span className="text-gray-400">Max AQI: </span>
            <span className="text-white font-medium">{metrics.maxAQI}</span>
          </div>
          <div>
            <span className="text-gray-400">Min AQI: </span>
            <span className="text-white font-medium">{metrics.minAQI}</span>
          </div>
        </div>
      </div>
    </div>
  );
}