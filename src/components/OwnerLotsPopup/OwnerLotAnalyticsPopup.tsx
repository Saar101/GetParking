import { useEffect } from "react";
import type { OwnerLotsPopupLot } from "./OwnerLotsPopup";
import OwnerLotAnalytics from "./OwnerLotAnalytics";
import "./OwnerLotAnalyticsPopup.css";

type OwnerLotAnalyticsPopupProps = {
  isOpen: boolean;
  lot: OwnerLotsPopupLot | null;
  onClose: () => void;
  onBackToLots: () => void;
};

export default function OwnerLotAnalyticsPopup({ isOpen, lot, onClose, onBackToLots }: OwnerLotAnalyticsPopupProps) {
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

  if (!isOpen || !lot) {
    return null;
  }

  return (
    <div className="owner-lot-analytics-popup__overlay" role="presentation" onClick={onClose}>
      <div className="owner-lot-analytics-popup" role="dialog" aria-modal="true" aria-labelledby="owner-lot-analytics-popup-title" onClick={(event) => event.stopPropagation()}>
        <div className="owner-lot-analytics-popup__header">
          <div>
            <p className="owner-lot-analytics-popup__eyebrow">Parking lot insights</p>
            <h2 id="owner-lot-analytics-popup-title">{lot.name}</h2>
            <p className="owner-lot-analytics-popup__subtitle">גרף נפרד לכל חניון עם מרחב נוח לנתונים לפי תקופות, ביקוש, עומסים ובחינות.</p>
          </div>
          <div className="owner-lot-analytics-popup__actions">
            <button type="button" className="owner-lot-analytics-popup__back" onClick={onBackToLots}>
              חזרה לחניונים
            </button>
            <button type="button" className="owner-lot-analytics-popup__close" onClick={onClose} aria-label="סגירת הפופ-אפ">
              ✕
            </button>
          </div>
        </div>

        <div className="owner-lot-analytics-popup__meta-bar">
          <span>כתובת: {lot.address}</span>
          <span>סה״כ חניות: {lot.totalSpaces}</span>
          <span>פנויים: {lot.availableSpaces}</span>
          <span>מוזמנים: {lot.reservedSpaces}</span>
          <span>תפוסים: {lot.occupiedSpaces}</span>
        </div>

        <div className="owner-lot-analytics-popup__body">
          <OwnerLotAnalytics lot={lot} />
        </div>
      </div>
    </div>
  );
}