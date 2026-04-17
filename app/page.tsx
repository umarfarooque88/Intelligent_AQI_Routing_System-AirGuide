'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import dynamic from 'next/dynamic';
import { getRoutes, Route } from '@/lib/getRoutes';
import { getAQIAtLocation, AQIResult } from '@/lib/getAQI';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

interface RouteAnalysis {
  id: string;
  name: string;
  durationSeconds: number;
  avgAQI: number;
  exposureScore: number;
  color: string;
  distanceMeters: number;
}

let googleLoader: Loader | null = null;
let googlePromise: Promise<typeof google> | null = null;

function samplePoints(points: any[], sampleSize: number = 20): any[] {
  if (!points || points.length === 0) return [];
  if (points.length <= sampleSize) return points;
  
  const step = Math.floor(points.length / sampleSize);
  const sampled: any[] = [];
  
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }
  
  return sampled.slice(0, sampleSize);
}

function getAQICategory(aqi: number): { label: string; color: string; level: string } {
  if (aqi <= 50) return { label: 'Good', color: '#00e400', level: 'low' };
  if (aqi <= 100) return { label: 'Moderate', color: '#ffff00', level: 'medium' };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: '#ff7e00', level: 'high' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ff0000', level: 'very-high' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#8f3f97', level: 'hazardous' };
  return { label: 'Hazardous', color: '#7e0023', level: 'hazardous' };
}

function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) {
    return `${totalMin}`;
  }
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

export default function Home() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [mapsReady, setMapsReady] = useState(false);
  const [comparison, setComparison] = useState<{
    cleanerRoute: number;
    exposureSavingsPercent: number;
    timeDifference: number;
  } | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const [originPredictions, setOriginPredictions] = useState<Array<{
    place_id: string;
    main_text: string;
    secondary_text: string;
  }>>([]);
  const [destPredictions, setDestPredictions] = useState<Array<{
    place_id: string;
    main_text: string;
    secondary_text: string;
  }>>([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const originDropdownRef = useRef<HTMLDivElement>(null);
  const destDropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const googleRef = useRef<typeof google | null>(null);

  const initGoogleMaps = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError('Google Maps API key is not configured');
      return null;
    }

    if (!googleLoader) {
      googleLoader = new Loader({ apiKey, version: 'weekly', libraries: ['places'] });
    }

    if (!googlePromise) {
      googlePromise = googleLoader.load() as Promise<typeof google>;
    }

    try {
      const google = await googlePromise;
      googleRef.current = google;
      setMapsReady(true);
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      geocoderRef.current = new google.maps.Geocoder();
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      return google;
    } catch (err) {
      console.error('Failed to load Google Maps:', err);
      setError('Failed to load Google Maps');
      return null;
    }
  }, []);

  useEffect(() => {
    initGoogleMaps();
  }, [initGoogleMaps]);

  const fetchPredictions = useCallback(async (input: string, setPredictions: (p: any[]) => void) => {
    if (!autocompleteServiceRef.current || input.length < 2) {
      setPredictions([]);
      return;
    }

    try {
      const request: google.maps.places.AutocompletionRequest = {
        input,
        sessionToken: sessionTokenRef.current || undefined,
      };

      autocompleteServiceRef.current.getPlacePredictions(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const predictions = results.slice(0, 5).map((result) => ({
            place_id: result.place_id,
            main_text: result.structured_formatting?.main_text || result.description,
            secondary_text: result.structured_formatting?.secondary_text || '',
          }));
          setPredictions(predictions);
        } else {
          setPredictions([]);
        }
      });
    } catch {
      setPredictions([]);
    }
  }, []);

  const selectPrediction = useCallback(async (
    prediction: any,
    setCoords: (coords: { lat: number; lng: number }) => void,
    setAddress: (address: string) => void,
    setPredictions: (p: any[]) => void,
    setShowDropdown: (show: boolean) => void
  ) => {
    if (!geocoderRef.current) return;

    try {
      const result = await geocoderRef.current.geocode({ placeId: prediction.place_id });
      if (result.results?.[0]?.geometry?.location) {
        const loc = result.results[0].geometry.location;
        setCoords({ lat: loc.lat(), lng: loc.lng() });
        setAddress(result.results[0].formatted_address || prediction.description);
      }
      setPredictions([]);
      setShowDropdown(false);
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    } catch (e) {
      console.error('Geocode error:', e);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (originDropdownRef.current && !originDropdownRef.current.contains(e.target as Node) && 
          originInputRef.current && !originInputRef.current.contains(e.target as Node)) {
        setShowOriginDropdown(false);
      }
      if (destDropdownRef.current && !destDropdownRef.current.contains(e.target as Node) && 
          destInputRef.current && !destInputRef.current.contains(e.target as Node)) {
        setShowDestDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const findRoutes = async () => {
    if (!origin || !destination) {
      setError('Please enter both locations');
      return;
    }

    if (!originCoords || !destCoords) {
      setError('Please select locations from suggestions');
      return;
    }

    setLoading(true);
    setError(null);
    setRouteAnalysis([]);
    setComparison(null);
    setSelectedRouteId(null);

    try {
      const directionsRoutes: Route[] = await getRoutes(originCoords, destCoords, googleRef.current || undefined);
      console.log('[page] Got routes:', directionsRoutes.length);

      const totalAQICalls = directionsRoutes.length * 20;
      const processedRoutes: RouteAnalysis[] = [];

      for (let i = 0; i < directionsRoutes.length; i++) {
        const route = directionsRoutes[i];
        const overviewPath = route.overviewPath;
        console.log(`[page] Route ${i}: ${overviewPath.length} path points`);
        
        const sampledCoords = samplePoints(overviewPath, 20);
        setProgress({ current: i * 20, total: totalAQICalls });

        const aqiResults: AQIResult[] = [];

        for (let j = 0; j < sampledCoords.length; j++) {
          const point = sampledCoords[j];
          const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
          const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
          
          try {
            const result = await getAQIAtLocation(lat, lng);
            aqiResults.push(result);
          } catch {
            aqiResults.push({ aqi: 50, category: 'Moderate', color: '#ffff00' });
          }
          setProgress({ current: i * 20 + j + 1, total: totalAQICalls });
        }

        const avgAQI = Math.round(aqiResults.reduce((sum, r) => sum + r.aqi, 0) / aqiResults.length);
        const avgSegmentTime = (route.totalDuration / aqiResults.length) / 60;
        const exposureScore = Math.round(aqiResults.reduce((sum, r) => sum + r.aqi * avgSegmentTime, 0));

        processedRoutes.push({
          id: `route-${i}`,
          name: route.name,
          durationSeconds: route.totalDuration,
          avgAQI,
          exposureScore,
          color: '#888888',
          distanceMeters: route.totalDistance,
        });
      }

      if (processedRoutes.length >= 2) {
        const lowestAQIIndex = processedRoutes.reduce((minIdx, route, idx, arr) => 
          route.avgAQI < arr[minIdx].avgAQI ? idx : minIdx, 0);

        const highestAQIIndex = processedRoutes.reduce((maxIdx, route, idx, arr) => 
          route.avgAQI > arr[maxIdx].avgAQI ? idx : maxIdx, 0);

        processedRoutes.forEach((route, idx) => {
          if (idx === lowestAQIIndex) {
            route.color = '#22c55e';
            route.name = 'Cleaner Route';
          } else if (idx === highestAQIIndex) {
            route.color = '#ff4d4f';
            route.name = 'More Polluted';
          } else {
            route.color = '#f59e0b';
            route.name = `Alternative ${idx + 1}`;
          }
        });

        const cleaner = processedRoutes[lowestAQIIndex];
        const polluted = processedRoutes[highestAQIIndex];
        
        const aqiDiff = Math.abs(cleaner.avgAQI - polluted.avgAQI);
        const maxAQI = Math.max(cleaner.avgAQI, polluted.avgAQI);
        const savingsPercent = maxAQI > 0 ? Math.round((aqiDiff / maxAQI) * 100) : 0;
        const timeDiff = Math.round((cleaner.durationSeconds - polluted.durationSeconds) / 60);

        setComparison({
          cleanerRoute: lowestAQIIndex + 1,
          exposureSavingsPercent: savingsPercent,
          timeDifference: timeDiff,
        });
      }

      setRouteAnalysis(processedRoutes);
    } catch (err) {
      console.error('Error fetching routes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch routes');
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const clearRoutes = () => {
    setRouteAnalysis([]);
    setComparison(null);
    setOrigin('');
    setDestination('');
    setOriginCoords(null);
    setDestCoords(null);
    setSelectedRouteId(null);
  };

  const handleRouteClick = (routeId: string) => {
    setSelectedRouteId(prev => prev === routeId ? null : routeId);
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="app-layout">
      {/* Minimal Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span className="logo-text">AirGuide</span>
          </div>
          {mapsReady && (
            <span className="status-pill">Ready</span>
          )}
        </div>

        <div className="search-section">
          <div className="input-wrapper" data-origin>
            <svg className="input-icon origin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <input
              ref={originInputRef}
              type="text"
              placeholder="Start location"
              value={origin}
              onChange={(e) => {
                setOrigin(e.target.value);
                fetchPredictions(e.target.value, setOriginPredictions);
                setShowOriginDropdown(true);
                setOriginCoords(null);
              }}
              onFocus={() => originPredictions.length > 0 && setShowOriginDropdown(true)}
              aria-label="Start location"
            />
            {showOriginDropdown && originPredictions.length > 0 && (
              <div ref={originDropdownRef} className="predictions-dropdown">
                {originPredictions.map((p) => (
                  <button
                    key={p.place_id}
                    className="prediction-item"
                    onClick={() => selectPrediction(p, setOriginCoords, setOrigin, setOriginPredictions, setShowOriginDropdown)}
                  >
                    <span className="prediction-main">{p.main_text}</span>
                    <span className="prediction-secondary">{p.secondary_text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="input-divider">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </div>

          <div className="input-wrapper" data-destination>
            <svg className="input-icon destination" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <input
              ref={destInputRef}
              type="text"
              placeholder="Destination"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                fetchPredictions(e.target.value, setDestPredictions);
                setShowDestDropdown(true);
                setDestCoords(null);
              }}
              onFocus={() => destPredictions.length > 0 && setShowDestDropdown(true)}
              aria-label="Destination"
            />
            {showDestDropdown && destPredictions.length > 0 && (
              <div ref={destDropdownRef} className="predictions-dropdown">
                {destPredictions.map((p) => (
                  <button
                    key={p.place_id}
                    className="prediction-item"
                    onClick={() => selectPrediction(p, setDestCoords, setDestination, setDestPredictions, setShowDestDropdown)}
                  >
                    <span className="prediction-main">{p.main_text}</span>
                    <span className="prediction-secondary">{p.secondary_text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={findRoutes}
          disabled={loading || !originCoords || !destCoords}
          className="compare-btn"
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true"/>
              <span>Analyzing {progressPercent}%</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 18l6-6-6-6"/>
              </svg>
              <span>Compare Routes</span>
            </>
          )}
        </button>

        {error && (
          <div className="error-alert" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {comparison && routeAnalysis.length > 0 && (
          <div className="comparison-card">
            <div className="comparison-header">
              <svg viewBox="0 0 24 24" fill="#22c55e" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>Recommendation</span>
            </div>
            <div className="comparison-stats">
              <div className="stat-highlight">
                <span className="stat-value">{comparison.exposureSavingsPercent}%</span>
                <span className="stat-label">less pollution</span>
              </div>
              {comparison.timeDifference !== 0 && (
                <span className="time-note">
                  {comparison.timeDifference > 0 ? '+' : ''}{formatDuration(Math.abs(comparison.timeDifference * 60))}
                </span>
              )}
            </div>
          </div>
        )}

        {routeAnalysis.map((route, index) => {
          const aqiInfo = getAQICategory(route.avgAQI);
          const isWinner = comparison?.cleanerRoute === index + 1;
          const totalMin = Math.round(route.durationSeconds / 60);
          const durationStr = formatDuration(route.durationSeconds);
          const isHours = totalMin >= 60;

          return (
            <button
              key={route.id}
              className={`route-card ${isWinner ? 'winner' : ''} ${selectedRouteId === route.id ? 'selected' : ''}`}
              onClick={() => handleRouteClick(route.id)}
              aria-pressed={selectedRouteId === route.id}
            >
              <div className="route-header">
                <div className="route-indicator" style={{ background: route.color }} />
                <span className="route-name">{route.name}</span>
                {isWinner && <span className="route-badge">Best</span>}
              </div>
              
              <div className="route-metrics">
                <div className="metric">
                  <span className="metric-value">{durationStr}</span>
                  <span className="metric-label">{isHours ? 'hrs' : 'min'}</span>
                </div>
                <div className="metric">
                  <span className="metric-value" style={{ color: aqiInfo.color }}>{route.avgAQI}</span>
                  <span className="metric-label">AQI</span>
                </div>
                <div className="metric">
                  <span className="metric-value">{route.distanceMeters >= 1000 
                    ? (route.distanceMeters / 1000).toFixed(1) 
                    : route.distanceMeters}</span>
                  <span className="metric-label">{route.distanceMeters >= 1000 ? 'km' : 'm'}</span>
                </div>
              </div>

              <div className="route-aqi-bar">
                <div 
                  className="aqi-fill" 
                  style={{ 
                    width: `${Math.min(100, route.avgAQI)}%`,
                    background: aqiInfo.color 
                  }} 
                />
              </div>
              <span className="aqi-label" style={{ color: aqiInfo.color }}>{aqiInfo.label}</span>
            </button>
          );
        })}

        {routeAnalysis.length > 0 && (
          <button onClick={clearRoutes} className="clear-btn">
            Clear & New Search
          </button>
        )}
      </aside>

      {/* Map Area */}
      <main className="map-area">
        <Map
          origin={originCoords}
          destination={destCoords}
          routeAnalysis={routeAnalysis}
          selectedRouteId={selectedRouteId}
          onRouteClick={handleRouteClick}
        />

        {loading && (
          <div className="loading-overlay" aria-live="polite">
            <div className="loading-content">
              <span className="spinner-large" aria-hidden="true"/>
              <p>Analyzing air quality...</p>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }}/>
              </div>
              <span className="progress-text">{progressPercent}%</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
