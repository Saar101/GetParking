import { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import "./GoogleMapTest.css";

type LatLng = {
  lat: number;
  lng: number;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  place_id: number;
};

const FALLBACK_CENTER: LatLng = {
  lat: 31.7683,
  lng: 35.2137, // Jerusalem
};

export default function GoogleMapTest() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;

  const [initialCenter, setInitialCenter] = useState<LatLng>(FALLBACK_CENTER);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    position: LatLng;
    address: string;
  } | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocationSelected, setIsLocationSelected] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "locating" | "ready" | "denied" | "unsupported"
  >("idle");

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      setInitialCenter(FALLBACK_CENTER);
      setMapKey((k) => k + 1);
      return;
    }

    setStatus("locating");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setUserLocation(loc);
        setInitialCenter(loc);
        setMapKey((k) => k + 1);
        setStatus("ready");
        console.log("✅ User location found:", loc);
      },
      (error) => {
        console.warn("❌ Location denied or error:", error);
        setStatus("denied");
        setInitialCenter(FALLBACK_CENTER);
        setMapKey((k) => k + 1);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  // Search using Nominatim (OpenStreetMap)
  useEffect(() => {
    // אם המשתמש בחר כתובת, לא מחפשים
    if (isLocationSelected) {
      return;
    }

    if (searchText.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(searchText)}&` +
            `countrycodes=il&` +
            `format=json&` +
            `limit=8&` +
            `addressdetails=1`,
          {
            headers: {
              "Accept-Language": "he,en",
            },
          }
        );
        const data: NominatimResult[] = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchText, isLocationSelected]);

  const handleLocationSelect = (result: NominatimResult) => {
    const location: LatLng = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };

    setInitialCenter(location);
    setSelectedLocation({
      position: location,
      address: result.display_name,
    });
    setMapKey((k) => k + 1);
    setStatus("ready");
    setSearchText(result.display_name);
    setSuggestions([]);
    setIsLocationSelected(true); // סימון שבחרנו כתובת
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setIsLocationSelected(false); // איפוס הדגל כשהמשתמש משנה את הטקסט
  };

  if (!apiKey) {
    return (
      <div className="gmt-error">
        Missing VITE_GOOGLE_MAPS_API_KEY in your env
      </div>
    );
  }

  return (
    <>
      <button
        className="gmt-open-button"
        onClick={() => setIsMapOpen(true)}
      >
        🗺️ חפש כתובת
      </button>

      {isMapOpen && (
        <>
          <div
            className="gmt-overlay"
            onClick={() => setIsMapOpen(false)}
          />
          <div className="gmt-popover">
            <button
              className="gmt-close-button"
              onClick={() => setIsMapOpen(false)}
              aria-label="Close map"
            >
              ✕
            </button>

            <div className="gmt-card">
      <div className="gmt-header">
        <div>
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#07324a" }}>
            📍 Map Preview
          </h3>
          <p className="gmt-subtitle">
            {status === "locating" && "🔍 Locating you…"}
            {status === "ready" && "✅ Ready"}
            {status === "denied" && "⚠️ Location denied — showing default"}
            {status === "unsupported" && "❌ Geolocation not supported"}
            {status === "idle" && "⏳ Loading…"}
          </p>
        </div>
      </div>

      <div className="gmt-search-container">
        <div className="gmt-search-wrapper">
          <input
            type="text"
            className="gmt-search-input"
            placeholder="🔍 חפש כתובת בישראל..."
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {isSearching && (
            <div className="gmt-searching">
              <span className="gmt-searching-dots">
                <span className="gmt-dot"></span>
                <span className="gmt-dot"></span>
                <span className="gmt-dot"></span>
              </span>
              <span>מחפש כתובות</span>
            </div>
          )}
          {suggestions.length > 0 && (
            <ul className="gmt-suggestions">
              {suggestions.map((result) => (
                <li key={result.place_id}>
                  <button
                    className="gmt-suggestion-item"
                    onClick={() => handleLocationSelect(result)}
                  >
                    📍 {result.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="gmt-map">
        <APIProvider apiKey={apiKey}>
          <Map
            key={mapKey}
            mapId={mapId}
            defaultCenter={initialCenter}
            defaultZoom={userLocation ? 15 : selectedLocation ? 16 : 13}
            gestureHandling="greedy"
            disableDefaultUI={false}
          >
            {userLocation && mapId && (
              <AdvancedMarker position={userLocation} title="You are here">
                <div className="gmt-you-pin" />
              </AdvancedMarker>
            )}
            {selectedLocation && mapId && (
              <AdvancedMarker
                position={selectedLocation.position}
                title={selectedLocation.address}
              >
                <div className="gmt-location-marker">
                  <div className="gmt-marker-icon">📍</div>
                  <div className="gmt-marker-tooltip">
                    {selectedLocation.address}
                  </div>
                </div>
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>
      </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
