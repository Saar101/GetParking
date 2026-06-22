import { useEffect, type CSSProperties } from "react";
import "./OwnerLotsPopup.css";

export type OwnerLotsPopupLot = {
  id: string;
  name: string;
  address: string;
  totalSpaces: number;
  availableSpaces: number;
  reservedSpaces: number;
  occupiedSpaces: number;
  demandScore: number;
  recommendationCount: number;
  recommendationHistoryByHour?: Record<string, number>;
  cardChecksCount?: number;
  cardChecksHistoryByHour?: Record<string, number>;
};

type OwnerLotsPopupProps = {
  isOpen: boolean;
  lots: OwnerLotsPopupLot[];
  selectedLotId: string | null;
  onClose: () => void;
  onOpenLotDetails: (lot: OwnerLotsPopupLot) => void;
  onShowAll: () => void;
};

export default function OwnerLotsPopup({ isOpen, lots, selectedLotId, onClose, onOpenLotDetails, onShowAll }: OwnerLotsPopupProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="owner-lots-popup__overlay" role="presentation" onClick={onClose}>
      <div className="owner-lots-popup" role="dialog" aria-modal="true" aria-labelledby="owner-lots-popup-title" onClick={(event) => event.stopPropagation()}>
        <div className="owner-lots-popup__header">
          <div>
            <p className="owner-lots-popup__eyebrow">Parking lots</p>
            <h2 id="owner-lots-popup-title">החניונים שלי</h2>
            <p className="owner-lots-popup__subtitle">בחר חניון כדי לסנן את החניות שלו, או הצג שוב את כל החניות.</p>
          </div>
          <button type="button" className="owner-lots-popup__close" onClick={onClose} aria-label="סגירת הפופ-אפ">
            ✕
          </button>
        </div>

        <div className="owner-lots-popup__content">
          {lots.length === 0 ? (
            <p className="owner-lots-popup__empty">לא נמצאו חניונים להצגה.</p>
          ) : (
            <div className="owner-lots-popup__grid">
              {lots.map((lot, index) => (
                <button
                  key={lot.id}
                  type="button"
                  className={`owner-lots-popup__lot-card ${selectedLotId === lot.id ? "owner-lots-popup__lot-card--active" : ""}`}
                  style={{ ["--lot-index" as string]: index } as CSSProperties}
                  onClick={() => onOpenLotDetails(lot)}
                >
                  <div className="owner-lots-popup__lot-copy">
                    <strong>{lot.name}</strong>
                    <span>{lot.address}</span>
                  </div>
                  <div className="owner-lots-popup__lot-meta">
                    <span>סה״כ {lot.totalSpaces}</span>
                    <span>פנויים {lot.availableSpaces}</span>
                    <span>מוזמנים {lot.reservedSpaces}</span>
                    <span>תפוסים {lot.occupiedSpaces}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="owner-lots-popup__footer">
          <button
            type="button"
            className="owner-lots-popup__show-all"
            onClick={onShowAll}
          >
            הצג חניות של כלל החניונים
          </button>
        </div>
      </div>
    </div>
  );
}