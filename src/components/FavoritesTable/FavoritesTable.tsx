import { useEffect, useMemo, useState } from "react";
import ParkingInfo from "../ParkingInfo/ParkingInfo";
import {
  getCurrentFavoriteParkingLotIds,
  removeCurrentUserFavoriteParkingLot,
} from "../../services/users.service";
import { getEffectiveLotPricing, listParkingLots, type ParkingLotDoc } from "../../services/parkingLots.service";
import "./FavoritesTable.css";

type FavoritesTableProps = {
  isOpen: boolean;
  onClose: () => void;
};

type FavoriteParkingCard = {
  id: string;
  address: string;
  price: number;
  pricingLabel: string;
  distance: string;
  rating: number;
  recommendationCount: number;
  available: boolean;
  features: string[];
};

type ParkingLotMarker = ParkingLotDoc & { id: string };

function distanceLabel(recommendationCount: number) {
  return recommendationCount > 0 ? "נשמר מהמועדפים" : "זמין לגישה מהירה";
}

function toFavoriteParkingCard(lot: ParkingLotMarker): FavoriteParkingCard {
  const recommendationCount = Math.max(0, lot.recommendationCount ?? 0);
  const rating = Math.min(5, Math.max(1, 1 + recommendationCount / 8));
  const effectivePricing = getEffectiveLotPricing(lot);

  return {
    id: lot.id,
    address: `${lot.name} • ${lot.address}`,
    price: effectivePricing.price,
    pricingLabel: effectivePricing.label,
    distance: distanceLabel(recommendationCount),
    rating,
    recommendationCount,
    available: true,
    features: ["מועדף אישי", "גישה מהירה לכרטיס"],
  };
}

export default function FavoritesTable({ isOpen, onClose }: FavoritesTableProps) {
  const [favoriteLots, setFavoriteLots] = useState<FavoriteParkingCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingLotId, setRemovingLotId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedLot, setSelectedLot] = useState<FavoriteParkingCard | null>(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  const FAVORITES_ANIMATION_MS = 260;

  const loadFavorites = async () => {
    setLoading(true);
    setError("");

    try {
      const [favoriteIds, lots] = await Promise.all([getCurrentFavoriteParkingLotIds(), listParkingLots()]);
      const favoriteIdSet = new Set(favoriteIds);
      const mapped = lots
        .filter((lot) => favoriteIdSet.has(lot.id))
        .map((lot) => toFavoriteParkingCard(lot as ParkingLotMarker))
        .sort((left, right) => right.recommendationCount - left.recommendationCount);

      setFavoriteLots(mapped);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(message || "לא הצלחנו לטעון את המועדפים כרגע.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      void loadFavorites();
    } else if (isRendered) {
      setIsClosing(true);
      closeTimer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
        setSelectedLot(null);
      }, FAVORITES_ANIMATION_MS);
    }

    return () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    };
  }, [isOpen, isRendered]);

  const summary = useMemo(() => {
    return {
      total: favoriteLots.length,
      mostSaved: favoriteLots[0]?.recommendationCount ?? 0,
    };
  }, [favoriteLots]);

  const handleRemoveFavorite = async (lotId: string) => {
    setRemovingLotId(lotId);
    setError("");

    try {
      await removeCurrentUserFavoriteParkingLot(lotId);
      await loadFavorites();
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : String(removeError);
      setError(message || "לא הצלחנו להסיר את המועדף כרגע.");
    } finally {
      setRemovingLotId(null);
    }
  };

  if (!isRendered) {
    return null;
  }

  return (
    <div
      className={`favorites-overlay ${isClosing ? "favorites-overlay--closing" : ""}`}
      onClick={onClose}
    >
      <section
        className={`favorites-panel ${isClosing ? "favorites-panel--closing" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="favorites-header">
          <div>
            <p className="favorites-eyebrow">Quick access</p>
            <h2>המועדפים שלי</h2>
            <p className="favorites-subtitle">כל החניונים שסימנת כהמלצה, כדי להגיע לכרטיס שלהם מיד</p>
          </div>
          <button className="favorites-close" onClick={onClose} type="button" aria-label="סגירה">
            ✕
          </button>
        </header>

        <div className="favorites-summary">
          <span>מועדפים: {summary.total}</span>
          <span>הכי הרבה המלצות: {summary.mostSaved}</span>
        </div>

        {loading ? <p className="favorites-state">טוען מועדפים...</p> : null}
        {error ? <p className="favorites-error">{error}</p> : null}

        {!loading && !error && favoriteLots.length === 0 ? (
          <div className="favorites-empty">
            <p className="favorites-state">אין עדיין חניונים במועדפים.</p>
            <p className="favorites-empty-note">אפשר להוסיף חניון למועדפים דרך כפתור ההמלצה בכרטיס החניון.</p>
          </div>
        ) : null}

        {!loading && !error && favoriteLots.length > 0 ? (
          <div className="favorites-list">
            {favoriteLots.map((lot) => (
              <article key={lot.id} className="favorites-card">
                <div className="favorites-card__content">
                  <div className="favorites-card__title-row">
                    <div>
                      <p className="favorites-card__eyebrow">מועדף</p>
                      <h3>{lot.address}</h3>
                    </div>
                    <span className="favorites-card__price">₪{lot.price} {lot.pricingLabel}</span>
                  </div>

                  <div className="favorites-card__meta">
                    <span>⭐ {lot.rating.toFixed(1)}</span>
                    <span>המלצות: {lot.recommendationCount}</span>
                    <span>{lot.distance}</span>
                  </div>
                </div>

                <div className="favorites-card__actions">
                  <button
                    type="button"
                    className="favorites-action favorites-action--primary"
                    onClick={() => setSelectedLot(lot)}
                  >
                    פתח כרטיס
                  </button>
                  <button
                    type="button"
                    className="favorites-action favorites-action--ghost"
                    onClick={() => void handleRemoveFavorite(lot.id)}
                    disabled={removingLotId === lot.id}
                  >
                    {removingLotId === lot.id ? "מסיר..." : "הסר"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <footer className="favorites-footer">
          <button type="button" className="favorites-refresh" onClick={() => void loadFavorites()} disabled={loading}>
            רענון
          </button>
        </footer>

        {selectedLot ? (
          <ParkingInfo
            isOpen={selectedLot !== null}
            onClose={() => setSelectedLot(null)}
            parkingSpace={selectedLot}
            onBook={() => {}}
            onRecommend={() => {}}
            recommendationDisabled={true}
          />
        ) : null}
      </section>
    </div>
  );
}