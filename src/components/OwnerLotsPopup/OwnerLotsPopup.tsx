import { useEffect, useState, type CSSProperties } from "react";
import { syncParkingSpacesFromJson, type ParkingLotSyncSummary } from "../../services/parkingSpaces.service";
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
  onSyncCompleted: () => Promise<void> | void;
};

export default function OwnerLotsPopup({ isOpen, lots, selectedLotId, onClose, onOpenLotDetails, onShowAll, onSyncCompleted }: OwnerLotsPopupProps) {
  const [syncingLotId, setSyncingLotId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const handleSyncLotSpaces = async (lot: OwnerLotsPopupLot, file: File) => {
    setSyncFeedback(null);
    setSyncingLotId(lot.id);

    try {
      const replaceExisting = window.confirm(
        "האם להחליף את מקומות החנייה הקיימים של החניון?\n\nאישור = להחליף ולמחוק מקומות קיימים שלא מופיעים בקובץ.\nביטול = למזג בלבד בלי למחוק מקומות קיימים."
      );
      const fileText = await file.text();
      const payload = JSON.parse(fileText) as Parameters<typeof syncParkingSpacesFromJson>[1];
      const result: ParkingLotSyncSummary = await syncParkingSpacesFromJson(lot.id, payload, {
        replaceExisting,
      });

      await onSyncCompleted();

      setSyncFeedback({
        kind: "success",
        message: replaceExisting
          ? `סונכרנו ${result.syncedCount} מקומות לחניון ${lot.name}. נוצרו ${result.createdCount}, עודכנו ${result.updatedCount}, ונמחקו ${result.deletedCount} מקומות שלא הופיעו בקובץ.`
          : `סונכרנו ${result.syncedCount} מקומות לחניון ${lot.name}. נוצרו ${result.createdCount} ועודכנו ${result.updatedCount}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "סנכרון מקומות החנייה נכשל.";
      setSyncFeedback({ kind: "error", message });
    } finally {
      setSyncingLotId(null);
    }
  };

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

        {syncFeedback ? (
          <p className={`owner-lots-popup__state ${syncFeedback.kind === "error" ? "owner-lots-popup__state--error" : "owner-lots-popup__state--success"}`}>
            {syncFeedback.message}
          </p>
        ) : null}

        <div className="owner-lots-popup__content">
          {lots.length === 0 ? (
            <p className="owner-lots-popup__empty">לא נמצאו חניונים להצגה.</p>
          ) : (
            <div className="owner-lots-popup__grid">
              {lots.map((lot, index) => (
                <div
                  key={lot.id}
                  className={`owner-lots-popup__lot-card ${selectedLotId === lot.id ? "owner-lots-popup__lot-card--active" : ""}`}
                  style={{ ["--lot-index" as string]: index } as CSSProperties}
                >
                  <button
                    type="button"
                    className="owner-lots-popup__lot-card-button"
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

                  <label className="owner-lots-popup__sync-button">
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="owner-lots-popup__sync-input"
                      disabled={syncingLotId === lot.id}
                      onChange={(event) => {
                        const file = event.target.files?.[0];

                        if (file) {
                          void handleSyncLotSpaces(lot, file);
                        }

                        event.currentTarget.value = "";
                      }}
                    />
                    {syncingLotId === lot.id ? "מסנכרן חניות..." : "סנכרון מקומות חנייה"}
                  </label>
                </div>
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