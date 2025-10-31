/**
 * Interactive Well Map Component
 *
 * Displays wells on an interactive Mapbox map with real-time production data.
 * Features:
 * - Color-coded markers by well status (ACTIVE=green, INACTIVE=yellow, PLUGGED=red)
 * - Popup info windows with production metrics and well details
 * - Automatic bounds fitting to show all wells
 * - Satellite imagery view (Permian Basin terrain)
 * - Navigation controls (zoom, rotate, fullscreen)
 * - Loading state handling
 *
 * Pattern References:
 * - Observer Pattern (map events)
 * - Component Composition (markers, popups)
 *
 * @see docs/sprints/sprint-5-implementation-spec.md:1352-1494
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Map, {
  Marker,
  Popup,
  NavigationControl,
  FullscreenControl,
  type MapRef,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2 } from 'lucide-react';

// Mapbox access token (public token - safe for client-side)
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Well status colors
const STATUS_COLORS = {
  ACTIVE: '#22c55e', // green-500
  INACTIVE: '#eab308', // yellow-500
  PLUGGED: '#ef4444', // red-500
  UNKNOWN: '#94a3b8', // slate-400
} as const;

export interface WellMapMarker {
  id: string;
  name: string;
  apiNumber: string;
  latitude: number;
  longitude: number;
  status: 'ACTIVE' | 'INACTIVE' | 'PLUGGED';
  lastProduction?: {
    oil: number; // BBL
    gas: number; // MCF
    water: number; // BBL
    date: string; // ISO date
  };
  field?: string;
  operator?: string;
}

interface WellsMapViewProps {
  wells: WellMapMarker[];
  onWellClick?: (wellId: string) => void;
  className?: string;
  height?: string;
}

export function WellsMapView({
  wells,
  onWellClick,
  className = '',
  height = '600px',
}: WellsMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [selectedWell, setSelectedWell] = useState<WellMapMarker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Calculate center point (Midland, TX - heart of Permian Basin)
  const defaultCenter = {
    longitude: -102.0779,
    latitude: 31.9973,
    zoom: 9,
  };

  /**
   * Fit map bounds to show all wells
   */
  const fitMapToWells = useCallback(() => {
    if (!mapRef.current || wells.length === 0) return;

    const bounds = wells.reduce(
      (acc, well) => {
        return {
          minLng: Math.min(acc.minLng, well.longitude),
          maxLng: Math.max(acc.maxLng, well.longitude),
          minLat: Math.min(acc.minLat, well.latitude),
          maxLat: Math.max(acc.maxLat, well.latitude),
        };
      },
      {
        minLng: wells[0].longitude,
        maxLng: wells[0].longitude,
        minLat: wells[0].latitude,
        maxLat: wells[0].latitude,
      },
    );

    mapRef.current.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      {
        padding: 50,
        duration: 1000,
      },
    );
  }, [wells]);

  /**
   * Fit bounds when wells change
   */
  useEffect(() => {
    if (mapLoaded && wells.length > 0) {
      fitMapToWells();
    }
  }, [mapLoaded, wells, fitMapToWells]);

  /**
   * Handle well marker click
   */
  const handleMarkerClick = (well: WellMapMarker) => {
    setSelectedWell(well);
    if (onWellClick) {
      onWellClick(well.id);
    }
  };

  /**
   * Close popup
   */
  const handleClosePopup = () => {
    setSelectedWell(null);
  };

  /**
   * Format production date
   */
  const formatProductionDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Format number with commas
   */
  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center p-6">
          <p className="text-slate-600 font-medium mb-2">Map Unavailable</p>
          <p className="text-sm text-slate-500">
            Mapbox token not configured. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-lg overflow-hidden shadow-lg ${className}`}
      style={{ height }}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={defaultCenter}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        onLoad={() => setMapLoaded(true)}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Navigation Controls */}
        <NavigationControl />
        <FullscreenControl />

        {/* Well Markers */}
        {wells.map((well) => (
          <Marker
            key={well.id}
            longitude={well.longitude}
            latitude={well.latitude}
            anchor="bottom"
            onClick={(e) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (e as any).originalEvent?.stopPropagation();
              handleMarkerClick(well);
            }}
          >
            <div className="cursor-pointer group">
              {/* Marker Icon */}
              <svg
                width="30"
                height="40"
                viewBox="0 0 30 40"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-lg transition-transform group-hover:scale-110"
              >
                <path
                  d="M15 0 L30 30 L15 40 L0 30 Z"
                  fill={STATUS_COLORS[well.status] || STATUS_COLORS.UNKNOWN}
                  stroke="white"
                  strokeWidth="2"
                />
                {/* Status indicator dot */}
                <circle cx="15" cy="20" r="4" fill="white" opacity="0.9" />
              </svg>
            </div>
          </Marker>
        ))}

        {/* Selected Well Popup */}
        {selectedWell && (
          <Popup
            longitude={selectedWell.longitude}
            latitude={selectedWell.latitude}
            anchor="bottom"
            onClose={handleClosePopup}
            closeButton={true}
            closeOnClick={false}
            className="well-popup"
          >
            <div className="p-3 min-w-[280px]">
              {/* Well Header */}
              <div className="mb-3 pb-3 border-b border-slate-200">
                <h3 className="font-bold text-lg text-slate-900 mb-1">{selectedWell.name}</h3>
                <p className="text-sm text-slate-600 mb-1">API: {selectedWell.apiNumber}</p>
                {selectedWell.field && (
                  <p className="text-xs text-slate-500">Field: {selectedWell.field}</p>
                )}
                {selectedWell.operator && (
                  <p className="text-xs text-slate-500">Operator: {selectedWell.operator}</p>
                )}
              </div>

              {/* Well Status */}
              <div className="mb-3">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${STATUS_COLORS[selectedWell.status]}20`,
                    color: STATUS_COLORS[selectedWell.status],
                  }}
                >
                  {selectedWell.status}
                </span>
              </div>

              {/* Production Data */}
              {selectedWell.lastProduction && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Last Production
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Oil</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatNumber(selectedWell.lastProduction.oil)} BBL
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Gas</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatNumber(selectedWell.lastProduction.gas)} MCF
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Water</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatNumber(selectedWell.lastProduction.water)} BBL
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 pt-1">
                    {formatProductionDate(selectedWell.lastProduction.date)}
                  </p>
                </div>
              )}

              {/* View Details Link */}
              <a
                href={`/wells/${selectedWell.id}`}
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                View Details →
              </a>
            </div>
          </Popup>
        )}
      </Map>

      {/* Loading Overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Loading map...</p>
            <p className="text-sm text-slate-500 mt-1">{wells.length} wells to display</p>
          </div>
        </div>
      )}

      {/* Well Count Badge */}
      {mapLoaded && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2 z-10">
          <p className="text-sm font-medium text-slate-900">{wells.length} Wells</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS.ACTIVE }}
              />
              <span className="text-xs text-slate-600">
                {wells.filter((w) => w.status === 'ACTIVE').length} Active
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS.INACTIVE }}
              />
              <span className="text-xs text-slate-600">
                {wells.filter((w) => w.status === 'INACTIVE').length} Inactive
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS.PLUGGED }}
              />
              <span className="text-xs text-slate-600">
                {wells.filter((w) => w.status === 'PLUGGED').length} Plugged
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
