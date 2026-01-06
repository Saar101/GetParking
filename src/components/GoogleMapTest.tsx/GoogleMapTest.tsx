import { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
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

// Inner component to use useMap hook
function MapContent({
  userLocation,
  selectedLocation,
  mapId,
  radius,
  circleRef,
}: {
  userLocation: LatLng | null;
  selectedLocation: { position: LatLng; address: string } | null;
  mapId: string | undefined;
  radius: number;
  circleRef: React.MutableRefObject<any>;
}) {
  const map = useMap();
  const animationRef = useRef<number | null>(null);
  const targetRadiusRef = useRef<number>(250);

  // Create circle when location changes
  useEffect(() => {
    if (!map || !selectedLocation) {
      return;
    }

    // Cancel any ongoing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    try {
      // Clear old circle
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }

      // Create circle with radius 0 for animation
      targetRadiusRef.current = radius;
      circleRef.current = new (window as any).google.maps.Circle({
        strokeColor: "#0a79b3",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#0a79b3",
        fillOpacity: 0.15,
        map: map,
        center: selectedLocation.position,
        radius: 0, // Start from 0 for nice entrance animation
      });

      // Animate the radius from 0 to target with bounce effect
      const startTime = Date.now();
      const animationDuration = 900; // 0.9 seconds for entrance animation
      const targetRadius = radius;

      const animateEntrance = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        // Bounce easing for entrance - elastic feel
        let easedProgress = progress < 0.5
          ? 2 * progress * progress // ease-in first half
          : 1 - Math.pow(-2 * progress + 2, 2) / 2; // ease-out second half

        // Add extra bounce/spring at the end
        if (easedProgress > 0.7) {
          const bounceAmount = (easedProgress - 0.7) * 1.5;
          easedProgress = easedProgress + bounceAmount;
        }

        const currentRadius = targetRadius * Math.min(easedProgress, 1);

        if (circleRef.current) {
          circleRef.current.setRadius(currentRadius);
        }

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animateEntrance);
        } else {
          // Ensure final radius is set
          if (circleRef.current) {
            circleRef.current.setRadius(targetRadius);
          }
        }
      };

      animationRef.current = requestAnimationFrame(animateEntrance);
      console.log("✅ Circle created with entrance animation!");
    } catch (error) {
      console.error("❌ Error creating circle:", error);
    }

    // Cleanup
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [map, selectedLocation]);

  // Smooth animation for radius changes
  useEffect(() => {
    if (!circleRef.current || !selectedLocation) {
      return;
    }

    // Cancel any ongoing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    const startRadius = circleRef.current.getRadius();
    const endRadius = radius;
    targetRadiusRef.current = radius;

    // Skip animation if radius hasn't changed
    if (Math.abs(startRadius - endRadius) < 1) {
      return;
    }

    const startTime = Date.now();
    const animationDuration = 600; // 0.6 seconds for smooth scroll
    const direction = endRadius > startRadius ? 1 : -1; // going up or down

    const animateRadius = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Smooth easing with a slight bounce/spring
      // y = t < 0.5 ? 2t² : -1 + (4 - 2t)t
      let easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Add a subtle bounce by overshooting slightly then settling
      if (easedProgress > 0.8) {
        const overshootAmount = (easedProgress - 0.8) * 0.15;
        easedProgress = easedProgress + overshootAmount * direction;
      }

      const currentRadius = startRadius + (endRadius - startRadius) * easedProgress;

      if (circleRef.current && targetRadiusRef.current === radius) {
        circleRef.current.setRadius(currentRadius);
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateRadius);
      } else {
        // Ensure final radius is set
        if (circleRef.current && targetRadiusRef.current === radius) {
          circleRef.current.setRadius(endRadius);
        }
      }
    };

    animationRef.current = requestAnimationFrame(animateRadius);

    // Cleanup
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [radius, selectedLocation]);

  return (
    <>
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
    </>
  );
}

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
  const [radius, setRadius] = useState(250); // in meters
  const [isRadiusExpanded, setIsRadiusExpanded] = useState(false);
  const [isRadiusClosing, setIsRadiusClosing] = useState(false);
  const circleRef = useRef<any>(null);

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

  // Handle radius changes - update circle on map
  useEffect(() => {
    console.log("Radius changed:", radius);
  }, [radius]);

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
          <button
            className="gmt-radius-button"
            onClick={() => {
              if (isRadiusExpanded) {
                setIsRadiusClosing(true);
              } else {
                setIsRadiusExpanded(true);
              }
            }}
          >
            <span className="gmt-radius-button-icon">📍</span>
            <span className="gmt-radius-button-text">{radius} מ'</span>
          </button>
          
          {(isRadiusExpanded || isRadiusClosing) && (
            <div 
              className={`gmt-radius-expanded ${isRadiusClosing ? 'closing' : ''}`}
              onAnimationEnd={() => {
                if (isRadiusClosing) {
                  setIsRadiusClosing(false);
                  setIsRadiusExpanded(false);
                }
              }}
            >
              <label htmlFor="radius-slider">🎯 בחר רדיוס:</label>
              <input
                id="radius-slider"
                type="range"
                min="50"
                max="500"
                step="50"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="gmt-radius-slider"
              />
              <span className="gmt-radius-value">{radius} מ'</span>
            </div>
          )}

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
            <MapContent
              userLocation={userLocation}
              selectedLocation={selectedLocation}
              mapId={mapId}
              radius={radius}
              circleRef={circleRef}
            />
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
