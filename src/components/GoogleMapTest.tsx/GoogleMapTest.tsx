import { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { addParkingLotRecommendation, listParkingLots, type ParkingLotDoc } from "../../services/parkingLots.service";
import ChatConsultation from "../ChatConsultation/ChatConsultation";
import ParkingInfo from "../ParkingInfo/ParkingInfo";
import "./GoogleMapTest.css";

type LatLng = {
  lat: number;
  lng: number;
};

type ParkingLotMarker = ParkingLotDoc & {
  id: string;
};

type ParkingInfoCard = {
  id: string;
  address: string;
  price: number;
  distance: string;
  rating: number;
  recommendationCount: number;
  available: boolean;
  features: string[];
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

function distanceMeters(a: LatLng, b: LatLng) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
}

function toParkingInfoCard(
  lot: ParkingLotMarker,
  center: LatLng | null,
  lotsInRadius: ParkingLotMarker[]
): ParkingInfoCard {
  const distance = center ? distanceMeters(center, lot.location) : 0;
  const recommendationCount = Math.max(0, lot.recommendationCount ?? 0);
  const maxRecommendations = Math.max(
    0,
    ...lotsInRadius.map((item) => Math.max(0, item.recommendationCount ?? 0))
  );
  const rating = maxRecommendations > 0
    ? 1 + (recommendationCount / maxRecommendations) * 4
    : 1;

  return {
    id: lot.id,
    address: `${lot.name} • ${lot.address}`,
    price: lot.salePrice ?? lot.basePrice,
    distance: `${Math.round(distance)} מ' מהמיקום שנבחר`,
    rating: Math.min(5, Math.max(1, rating)),
    recommendationCount,
    available: true,
    features: ["חניון פעיל", "מיקום בתוך הרדיוס"],
  };
}

// Inner component to use useMap hook
function MapContent({
  userLocation,
  selectedLocation,
  mapId,
  radius,
  circleRef,
  parkingLots,
  onParkingLotClick,
}: {
  userLocation: LatLng | null;
  selectedLocation: { position: LatLng; address: string } | null;
  mapId: string | undefined;
  radius: number;
  circleRef: React.MutableRefObject<any>;
  parkingLots: ParkingLotMarker[];
  onParkingLotClick: (lot: ParkingLotMarker) => void;
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
      {parkingLots.map((lot) => (
        <AdvancedMarker key={lot.id} position={lot.location} title={lot.name}>
          <div
            className="gmt-parking-lot-marker"
            onClick={() => onParkingLotClick(lot)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onParkingLotClick(lot);
              }
            }}
          >
            <div className="gmt-parking-lot-pin">🅿️</div>
            <div className="gmt-parking-lot-tooltip">
              <strong>{lot.name}</strong>
              <span>{lot.address}</span>
              <span>₪{lot.salePrice ?? lot.basePrice}/שעה</span>
            </div>
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}

export default function GoogleMapTest({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
  const [status, setStatus] = useState<
    "idle" | "locating" | "ready" | "denied" | "unsupported"
  >("idle");
  const [radius, setRadius] = useState(250); // in meters
  const [isRadiusExpanded, setIsRadiusExpanded] = useState(false);
  const [isRadiusClosing, setIsRadiusClosing] = useState(false);
  const [parkingLots, setParkingLots] = useState<ParkingLotMarker[]>([]);
  const [selectedParkingLot, setSelectedParkingLot] = useState<ParkingInfoCard | null>(null);
  const [recommendedLotIds, setRecommendedLotIds] = useState<string[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const loadParkingLots = async () => {
      try {
        const lots = await listParkingLots();
        if (isMounted) {
          setParkingLots(lots);
        }
      } catch (error) {
        console.error("Error loading parking lots:", error);
        if (isMounted) {
          setParkingLots([]);
        }
      }
    };

    void loadParkingLots();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

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

  const mapCenter = selectedLocation?.position ?? userLocation;
  const parkingLotsInRadius = mapCenter
    ? parkingLots.filter((lot) => distanceMeters(mapCenter, lot.location) <= radius)
    : [];

  const handleParkingLotClick = (lot: ParkingLotMarker) => {
    setSelectedParkingLot(toParkingInfoCard(lot, mapCenter, parkingLotsInRadius));
  };

  const handleSelectRecommendedLot = (lotId: string) => {
    const lot = parkingLots.find((item) => item.id === lotId);

    if (!lot) {
      return;
    }

    setSelectedParkingLot(toParkingInfoCard(lot, mapCenter, parkingLotsInRadius));
  };

  const handleRecommendParkingLot = async () => {
    if (!selectedParkingLot || recommendedLotIds.includes(selectedParkingLot.id) || isRecommending) {
      return;
    }

    setIsRecommending(true);
    try {
      await addParkingLotRecommendation(selectedParkingLot.id);
      setRecommendedLotIds((current) => [...current, selectedParkingLot.id]);
      setParkingLots((current) => {
        const updatedLots = current.map((lot) => {
          if (lot.id !== selectedParkingLot.id) {
            return lot;
          }

          return {
            ...lot,
            recommendationCount: (lot.recommendationCount ?? 0) + 1,
          };
        });

        const updatedMapCenter = selectedLocation?.position ?? userLocation;
        const updatedLotsInRadius = updatedMapCenter
          ? updatedLots.filter((lot) => distanceMeters(updatedMapCenter, lot.location) <= radius)
          : [];
        const updatedSelectedLot = updatedLots.find((lot) => lot.id === selectedParkingLot.id);

        if (updatedSelectedLot) {
          setSelectedParkingLot(
            toParkingInfoCard(updatedSelectedLot, updatedMapCenter, updatedLotsInRadius)
          );
        }

        return updatedLots;
      });
    } catch (error) {
      console.error("Error adding parking lot recommendation:", error);
    } finally {
      setIsRecommending(false);
    }
  };

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
      {isOpen && (
        <>
          <div
            className="gmt-overlay"
            onClick={onClose}
          />
          <div className="gmt-popover">
            <button
              className="gmt-close-button"
              onClick={onClose}
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

          <ChatConsultation
            parkingLots={parkingLotsInRadius.map((lot) => {
              const distance = mapCenter ? distanceMeters(mapCenter, lot.location) : 0;

              return {
                id: lot.id,
                name: lot.name,
                distanceMeters: distance,
                price: lot.salePrice ?? lot.basePrice,
                salePrice: lot.salePrice ?? null,
                recommendationCount: lot.recommendationCount ?? 0,
                available: true,
              };
            })}
            mapCenter={mapCenter}
            radiusMeters={radius}
            selectedLotId={selectedParkingLot?.id ?? null}
            onSelectRecommendedLot={handleSelectRecommendedLot}
          />

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
              parkingLots={parkingLotsInRadius}
              onParkingLotClick={handleParkingLotClick}
            />
                </Map>
              </APIProvider>
            </div>

      <ParkingInfo
        isOpen={selectedParkingLot !== null}
        onClose={() => setSelectedParkingLot(null)}
        parkingSpace={selectedParkingLot as any}
        onBook={() => {}}
        onRecommend={handleRecommendParkingLot}
        recommendationDisabled={
          !selectedParkingLot ? false : recommendedLotIds.includes(selectedParkingLot.id) || isRecommending
        }
      />
            </div>
          </div>
        </>
      )}
    </>
  );
}
