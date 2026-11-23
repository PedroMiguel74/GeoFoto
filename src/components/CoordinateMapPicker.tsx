/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  type MapMouseEvent,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Crosshair, MapPin, Search } from 'lucide-react';
import { type Coordinates, isValidCoordinates } from '../utils/exifUtils';

interface CoordinateMapPickerProps {
  coordinates: Coordinates | null;
  onChange: (coords: Coordinates) => void;
  validationError: string | null;
}

const DEFAULT_CENTER: Coordinates = { lat: 40.416775, lng: -3.70379 };

function roundCoord(val: number): number {
  return Number(val.toFixed(6));
}

interface PlaceSearchProps {
  onSelectLocation: (coords: Coordinates, viewport?: google.maps.LatLngBounds) => void;
}

const PlaceSearchBar: React.FC<PlaceSearchProps> = ({ onSelectLocation }) => {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setIsSearching(true);
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions ?? []);
        setIsOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [placesLib, query]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['location', 'viewport', 'formattedAddress', 'displayName'],
        });
        if (place.location) {
          const lat = roundCoord(place.location.lat());
          const lng = roundCoord(place.location.lng());
          onSelectLocation({ lat, lng }, place.viewport ?? undefined);
        }
        setQuery(
          suggestion.placePrediction.text?.text ??
            place.formattedAddress ??
            place.displayName ??
            ''
        );
      } catch {
        // Ignore transient fetchFields error
      } finally {
        sessionTokenRef.current = null;
        setSuggestions([]);
        setIsOpen(false);
      }
    },
    [placesLib, onSelectLocation]
  );

  return (
    <div className="relative flex-1 min-w-0">
      <div className="relative flex items-center">
        <Search
          className="w-4 h-4 text-[#6B6B65] absolute left-3 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Buscar lugar o dirección en el mapa"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder="Buscar ciudad, calle o lugar..."
          className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border border-[#DCDCD6] bg-white text-sm text-[#141413] placeholder:text-[#8A8A83] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
        />
      </div>

      {isOpen && (suggestions.length > 0 || isSearching) && (
        <div
          role="listbox"
          aria-label="Sugerencias de lugares"
          className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl border border-[#E4E4E0] bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto"
        >
          {isSearching && suggestions.length === 0 ? (
            <div className="px-3.5 py-2.5 text-xs text-[#6B6B65]">Buscando lugares...</div>
          ) : (
            suggestions.map((suggestion, idx) => {
              const label = suggestion.placePrediction?.text?.text;
              if (!label) return null;
              return (
                <button
                  key={`${label}-${idx}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left px-3.5 py-2.5 min-h-[44px] text-sm text-[#141413] hover:bg-[#F5F5F2] border-b last:border-b-0 border-[#F0F0EC] flex items-center gap-2.5 cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-[#2563EB] shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface MapViewportInnerProps {
  coordinates: Coordinates | null;
  onChange: (coords: Coordinates) => void;
  focusTarget: { coords: Coordinates; zoom?: number; bounds?: google.maps.LatLngBounds; nonce: number } | null;
}

const MapViewportInner: React.FC<MapViewportInnerProps> = ({
  coordinates,
  onChange,
  focusTarget,
}) => {
  const map = useMap();
  const loadingStatus = useApiLoadingStatus();

  useEffect(() => {
    if (!map || !focusTarget) return;
    if (focusTarget.bounds) {
      map.fitBounds(focusTarget.bounds);
    } else {
      map.panTo(focusTarget.coords);
      if (focusTarget.zoom !== undefined) {
        map.setZoom(focusTarget.zoom);
      }
    }
  }, [map, focusTarget]);

  const handleMapClick = useCallback(
    (ev: MapMouseEvent) => {
      const latLng = ev.detail.latLng;
      if (!latLng) return;
      onChange({
        lat: roundCoord(latLng.lat),
        lng: roundCoord(latLng.lng),
      });
    },
    [onChange]
  );

  const handleMarkerDragEnd = useCallback(
    (ev: google.maps.MapMouseEvent) => {
      if (!ev.latLng) return;
      onChange({
        lat: roundCoord(ev.latLng.lat()),
        lng: roundCoord(ev.latLng.lng()),
      });
    },
    [onChange]
  );

  if (
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#F4F4F0] text-[#5C5C57]">
        <MapPin className="w-7 h-7 text-[#6B6B65] mb-2" aria-hidden="true" />
        <p className="text-sm font-semibold text-[#141413]">
          No se pudo cargar Google Maps en este momento
        </p>
        <p className="text-xs text-[#6B6B65] mt-1 max-w-sm">
          Puedes introducir las coordenadas manualmente en los campos de latitud y longitud de abajo o usar tu ubicación GPS.
        </p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      defaultCenter={coordinates ?? DEFAULT_CENTER}
      defaultZoom={coordinates ? 13 : 5}
      gestureHandling="greedy"
      streetViewControl={false}
      mapTypeControl={true}
      fullscreenControl={false}
      onClick={handleMapClick}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    >
      {coordinates && (
        <AdvancedMarker
          position={coordinates}
          draggable={true}
          onDragEnd={handleMarkerDragEnd}
          title="Ubicación de la fotografía (arrastra para ajustar)"
        >
          <Pin background="#2563EB" borderColor="#1E40AF" glyphColor="#FFFFFF" />
        </AdvancedMarker>
      )}
    </GoogleMap>
  );
};

export const CoordinateMapPicker: React.FC<CoordinateMapPickerProps> = ({
  coordinates,
  onChange,
  validationError,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [latDraft, setLatDraft] = useState(coordinates ? coordinates.lat.toFixed(6) : '');
  const [lngDraft, setLngDraft] = useState(coordinates ? coordinates.lng.toFixed(6) : '');
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{
    coords: Coordinates;
    zoom?: number;
    bounds?: google.maps.LatLngBounds;
    nonce: number;
  } | null>(null);

  useEffect(() => {
    if (coordinates) {
      setLatDraft(coordinates.lat.toFixed(6));
      setLngDraft(coordinates.lng.toFixed(6));
    } else {
      setLatDraft('');
      setLngDraft('');
    }
  }, [coordinates]);

  const commitManualCoords = useCallback(
    (nextLatStr: string, nextLngStr: string) => {
      const lat = Number.parseFloat(nextLatStr.replace(',', '.'));
      const lng = Number.parseFloat(nextLngStr.replace(',', '.'));
      if (isValidCoordinates({ lat, lng })) {
        const rounded = { lat: roundCoord(lat), lng: roundCoord(lng) };
        onChange(rounded);
        setFocusTarget({ coords: rounded, zoom: 14, nonce: Date.now() });
      }
    },
    [onChange]
  );

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Tu navegador no permite obtener la ubicación GPS.');
      return;
    }
    setIsLocating(true);
    setGeoStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: roundCoord(pos.coords.latitude),
          lng: roundCoord(pos.coords.longitude),
        };
        onChange(next);
        setFocusTarget({ coords: next, zoom: 15, nonce: Date.now() });
        setIsLocating(false);
      },
      () => {
        setGeoStatus('No se pudo obtener tu ubicación actual. Revisa los permisos o toca en el mapa.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectPlace = useCallback(
    (coords: Coordinates, bounds?: google.maps.LatLngBounds) => {
      onChange(coords);
      setFocusTarget({ coords, zoom: 14, bounds, nonce: Date.now() });
    },
    [onChange]
  );

  const innerContent = (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#141413] tracking-tight">
            4. Selecciona las coordenadas en el mapa
          </h2>
          <p className="text-xs text-[#6B6B65] mt-0.5">
            Haz clic o toca en el mapa para fijar el punto exacto donde se tomó la foto.
          </p>
        </div>
        {coordinates && (
          <span className="text-xs font-mono tabular-nums text-[#2563EB] font-medium">
            {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {apiKey ? (
          <PlaceSearchBar onSelectLocation={handleSelectPlace} />
        ) : (
          <div className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-[#E4E4E0] bg-[#FAFAF8] text-xs text-[#6B6B65] flex items-center">
            Clave de Google Maps no configurada — introduce coordenadas abajo
          </div>
        )}

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-[#DCDCD6] bg-white hover:bg-[#F5F5F2] text-xs font-semibold text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          <Crosshair className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
          {isLocating ? 'Localizando...' : 'Mi ubicación'}
        </button>
      </div>

      {geoStatus && (
        <p role="status" className="text-xs text-[#B45309]">
          {geoStatus}
        </p>
      )}

      <div
        data-testid="map-container"
        className={`relative w-full h-[340px] lg:flex-1 lg:min-h-[380px] rounded-xl overflow-hidden border ${
          validationError ? 'border-[#DC2626]' : 'border-[#E4E4E0]'
        } bg-[#EFECE6]`}
      >
        {apiKey ? (
          <MapViewportInner
            coordinates={coordinates}
            onChange={onChange}
            focusTarget={focusTarget}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#5C5C57]">
            <MapPin className="w-7 h-7 text-[#2563EB] mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#141413]">
              Mapa en espera de clave de Google Maps
            </p>
            <p className="text-xs text-[#6B6B65] mt-1 max-w-sm">
              Introduce manualmente la latitud y longitud debajo, o usa «Mi ubicación».
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="coord-lat-input"
            className="block text-xs font-medium text-[#5C5C57] mb-1"
          >
            Latitud (-90 a 90)
          </label>
          <input
            id="coord-lat-input"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            inputMode="decimal"
            placeholder="Ej. 40.416775"
            value={latDraft}
            onChange={(e) => {
              setLatDraft(e.target.value);
              commitManualCoords(e.target.value, lngDraft);
            }}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#DCDCD6] bg-white font-mono text-sm tabular-nums text-[#141413] placeholder:text-[#8A8A83] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
          />
        </div>
        <div>
          <label
            htmlFor="coord-lng-input"
            className="block text-xs font-medium text-[#5C5C57] mb-1"
          >
            Longitud (-180 a 180)
          </label>
          <input
            id="coord-lng-input"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            inputMode="decimal"
            placeholder="Ej. -3.703790"
            value={lngDraft}
            onChange={(e) => {
              setLngDraft(e.target.value);
              commitManualCoords(latDraft, e.target.value);
            }}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#DCDCD6] bg-white font-mono text-sm tabular-nums text-[#141413] placeholder:text-[#8A8A83] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
          />
        </div>
      </div>

      {validationError && (
        <p role="alert" className="text-xs font-medium text-[#DC2626]">
          {validationError}
        </p>
      )}
    </div>
  );

  if (!apiKey) {
    return innerContent;
  }

  return (
    <APIProvider apiKey={apiKey} language="es" region="ES" libraries={['places', 'marker']}>
      {innerContent}
    </APIProvider>
  );
};
