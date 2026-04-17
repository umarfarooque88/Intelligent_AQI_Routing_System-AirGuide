'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface RouteAnalysis {
  id: string;
  name: string;
  durationSeconds: number;
  avgAQI: number;
  exposureScore: number;
  color: string;
}

interface MapProps {
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  routeAnalysis: RouteAnalysis[];
  selectedRouteId?: string | null;
  onRouteClick?: (routeId: string) => void;
  onRoutesLoaded?: (routeCount: number) => void;
}

let googleLoader: Loader | null = null;
let googlePromise: Promise<typeof google> | null = null;

export default function MapComponent({ 
  origin, 
  destination,
  routeAnalysis,
  selectedRouteId,
  onRouteClick,
  onRoutesLoaded,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const overlayPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const routeDataRef = useRef<google.maps.DirectionsRoute[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  const initMap = useCallback(async () => {
    if (initRef.current || !mapRef.current) return;
    initRef.current = true;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError('API key not configured');
      return;
    }

    if (!googleLoader) {
      googleLoader = new Loader({ apiKey, version: 'weekly', libraries: ['places'] });
    }

    if (!googlePromise) {
      googlePromise = googleLoader.load() as Promise<typeof google>;
    }

    try {
      const google = await googlePromise;
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: origin || { lat: 40.7128, lng: -74.006 },
        zoom: 12,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
      });

      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: '#9ca3af',
          strokeWeight: 4,
          strokeOpacity: 0.5,
        },
      });

      mapInstanceRef.current = map;
      directionsRendererRef.current = directionsRenderer;
      setIsLoaded(true);
    } catch (err) {
      console.error('[Map] Load error:', err);
      setError('Failed to load map');
    }
  }, [origin]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !directionsRendererRef.current) return;
    if (!origin || !destination) return;

    const google = window.google;
    const directionsService = new google.maps.DirectionsService();

    console.log('[Map] Fetching routes from:', origin, 'to:', destination);

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        if (status !== 'OK' || !result) {
          console.error('[Map] Directions error:', status);
          setError('Could not get routes');
          return;
        }

        console.log('[Map] Got', result.routes.length, 'routes from Directions API');

        routeDataRef.current = result.routes;
        directionsRendererRef.current?.setDirections(result);
        onRoutesLoaded?.(result.routes.length);

        drawOverlayPolylines(result.routes);
        addMarkers();
      }
    );
  }, [isLoaded, origin, destination, onRoutesLoaded]);

  const drawOverlayPolylines = useCallback((routes: google.maps.DirectionsRoute[]) => {
    const google = window.google;
    if (!google || !mapInstanceRef.current) return;

    overlayPolylinesRef.current.forEach(p => p.setMap(null));
    overlayPolylinesRef.current = [];
    infoWindowsRef.current.forEach(iw => iw.close());
    infoWindowsRef.current = [];

    if (routeAnalysis.length === 0) {
      console.log('[Map] No route analysis yet, showing default colors');
      routes.forEach((route, index) => {
        const isCleaner = index === 0;
        const path = route.overview_path;
        
        if (!path || path.length === 0) return;

        const polyline = new google.maps.Polyline({
          path: path,
          geodesic: false,
          strokeColor: isCleaner ? '#22c55e' : '#ff4d4f',
          strokeOpacity: 0.8,
          strokeWeight: 6,
          map: mapInstanceRef.current!,
        });

        overlayPolylinesRef.current.push(polyline);
      });
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    routes.forEach((route, index) => {
      const analysis = routeAnalysis[index];
      const path = route.overview_path;
      
      if (!path || path.length === 0) return;

      const isSelected = selectedRouteId === `route-${index}`;
      
      let isCleaner = false;
      let isPolluted = false;
      
      if (routeAnalysis.length > 0) {
        const lowestAQI = Math.min(...routeAnalysis.map(r => r.avgAQI));
        const highestAQI = Math.max(...routeAnalysis.map(r => r.avgAQI));
        isCleaner = analysis && analysis.avgAQI === lowestAQI;
        isPolluted = analysis && analysis.avgAQI === highestAQI;
      }

      let weight = isCleaner ? 8 : 6;
      let opacity = isCleaner ? 1 : 0.7;
      
      if (selectedRouteId) {
        opacity = isSelected ? 1 : 0.25;
        weight = isSelected ? weight + 3 : weight;
      }

      const strokeColor = isCleaner ? '#22c55e' : '#ff4d4f';

      if (isCleaner && !selectedRouteId) {
        const glowLine = new google.maps.Polyline({
          path: path,
          geodesic: false,
          strokeColor: strokeColor,
          strokeOpacity: 0.3,
          strokeWeight: weight + 12,
          clickable: false,
          map: mapInstanceRef.current!,
        });
        overlayPolylinesRef.current.push(glowLine);
      }

      const polyline = new google.maps.Polyline({
        path: path,
        geodesic: false,
        strokeColor: strokeColor,
        strokeOpacity: opacity,
        strokeWeight: weight,
        clickable: true,
        map: mapInstanceRef.current!,
      });

      const clickHandler = () => {
        onRouteClick?.(`route-${index}`);
      };

      google.maps.event.addListener(polyline, 'click', clickHandler);
      overlayPolylinesRef.current.push(polyline);

      if (analysis) {
        const midIndex = Math.floor(path.length / 2);
        const midPoint = path[midIndex];

        const bgColor = isCleaner ? '#22c55e' : (isSelected ? strokeColor : 'rgba(30, 30, 50, 0.95)');
        const textColor = (isCleaner || isSelected) ? '#fff' : '#fff';
        const borderColor = isCleaner ? '#16a34a' : 'rgba(255,255,255,0.3)';
        const shadowColor = isCleaner ? 'rgba(34, 197, 94, 0.5)' : 'rgba(0,0,0,0.3)';

        const durationMin = Math.round(analysis.durationSeconds / 60);

        const infoContent = `
          <div style="
            background: ${bgColor};
            color: ${textColor};
            padding: 10px 16px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 4px 15px ${shadowColor};
            border: 2px solid ${borderColor};
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
          ">
            <span style="opacity: 0.9">${durationMin} min</span>
            <span style="opacity: 0.5">•</span>
            <span>AQI ${analysis.avgAQI}</span>
            ${isCleaner ? '<span style="margin-left: 4px; background: rgba(0,0,0,0.2); padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 700;">CLEANER</span>' : ''}
          </div>
        `;

        const infoWindow = new google.maps.InfoWindow({
          content: infoContent,
          position: midPoint,
          pixelOffset: new google.maps.Size(0, -25),
          disableAutoPan: true,
        });

        infoWindow.open(mapInstanceRef.current!);
        infoWindowsRef.current.push(infoWindow);
      }

      path.forEach(point => bounds.extend(point));
    });

    if (!bounds.isEmpty()) {
      setTimeout(() => {
        mapInstanceRef.current?.fitBounds(bounds, { top: 100, right: 100, bottom: 100, left: 100 });
        const zoom = mapInstanceRef.current?.getZoom();
        if (zoom && zoom > 15) {
          mapInstanceRef.current?.setZoom(15);
        }
      }, 100);
    }
  }, [routeAnalysis, selectedRouteId, onRouteClick]);

  const addMarkers = useCallback(() => {
    const google = window.google;
    if (!google || !mapInstanceRef.current) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (origin) {
      const originMarker = new google.maps.Marker({
        position: new google.maps.LatLng(origin.lat, origin.lng),
        map: mapInstanceRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 1000,
      });
      markersRef.current.push(originMarker);
    }

    if (destination) {
      const destMarker = new google.maps.Marker({
        position: new google.maps.LatLng(destination.lat, destination.lng),
        map: mapInstanceRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#EA4335',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 1000,
      });
      markersRef.current.push(destMarker);
    }
  }, [origin, destination]);

  useEffect(() => {
    if (routeDataRef.current.length > 0) {
      drawOverlayPolylines(routeDataRef.current);
    }
  }, [routeAnalysis, selectedRouteId, drawOverlayPolylines]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-10">
          <div className="text-center">
            <p className="text-red-400 text-lg mb-2">Map Error</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      )}
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center">
            <div className="loading-spinner mx-auto" />
            <p className="text-gray-400 mt-4">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
