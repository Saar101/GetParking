import { useEffect, useMemo, useState } from "react";
import type { ParkingLotDoc } from "../../services/parkingLots.service";
import type { ParkingSpaceDoc, SpaceStatus } from "../../services/parkingSpaces.service";
import type { UserListItem } from "../../services/users.service";
import "./AdminParkingManagementPopup.css";

type ParkingSpaceView = ParkingSpaceDoc & { id: string };
type ParkingLotView = ParkingLotDoc & { id: string };

type AdminParkingManagementPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenUserManagement: () => void;
  parkingLots: ParkingLotView[];
  parkingLotsLoading: boolean;
  parkingLotsError: string;
  parkingSpaces: ParkingSpaceView[];
  parkingSpacesLoading: boolean;
  parkingSpacesError: string;
  users: UserListItem[];
};

function getEffectiveStatus(space: ParkingSpaceView): SpaceStatus {
  if (space.status !== "reserved" || !space.reservation?.reservedFrom || !space.reservation?.reservedUntil) {
    return space.status;
  }

  const now = Date.now();
  const reservedFromTime = new Date(space.reservation.reservedFrom).getTime();
  const reservedUntilTime = new Date(space.reservation.reservedUntil).getTime();

  if (Number.isNaN(reservedFromTime) || Number.isNaN(reservedUntilTime)) {
    return space.status;
  }

  if (reservedFromTime <= now && reservedUntilTime >= now) {
    return "occupied";
  }

  return space.status;
}

function getStatusLabel(status: SpaceStatus) {
  if (status === "occupied") return "תפוס";
  if (status === "reserved") return "מוזמן";
  return "פנוי";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AdminParkingManagementPopup({
  isOpen,
  onClose,
  onOpenUserManagement,
  parkingLots,
  parkingLotsLoading,
  parkingLotsError,
  parkingSpaces,
  parkingSpacesLoading,
  parkingSpacesError,
  users,
}: AdminParkingManagementPopupProps) {
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredParkingLots = useMemo(() => {
    if (!normalizedSearchTerm) {
      return parkingLots;
    }

    return parkingLots.filter((lot) => {
      const searchableText = `${lot.name} ${lot.address} ${lot.id}`.toLowerCase();
      return searchableText.includes(normalizedSearchTerm);
    });
  }, [parkingLots, normalizedSearchTerm]);

  useEffect(() => {
    if (!filteredParkingLots.length) {
      setSelectedLotId(null);
      return;
    }

    setSelectedLotId((current) => {
      if (current && filteredParkingLots.some((lot) => lot.id === current)) {
        return current;
      }

      return filteredParkingLots[0]?.id ?? null;
    });
  }, [filteredParkingLots]);

  const ownerLookup = useMemo(() => {
    return new Map(users.map((user) => [String(user.userId), user.name]));
  }, [users]);

  const lotsWithStats = useMemo(() => {
    return filteredParkingLots.map((lot) => {
      const lotSpaces = parkingSpaces.filter((space) => space.parkingLotId === lot.id);
      const spacesWithEffectiveStatus = lotSpaces.map((space) => ({
        ...space,
        effectiveStatus: getEffectiveStatus(space),
      }));

      return {
        ...lot,
        totalSpaces: spacesWithEffectiveStatus.length,
        availableSpaces: spacesWithEffectiveStatus.filter((space) => space.effectiveStatus === "available").length,
        reservedSpaces: spacesWithEffectiveStatus.filter((space) => space.effectiveStatus === "reserved").length,
        occupiedSpaces: spacesWithEffectiveStatus.filter((space) => space.effectiveStatus === "occupied").length,
        spaces: spacesWithEffectiveStatus.sort((left, right) => left.id.localeCompare(right.id)),
      };
    });
  }, [filteredParkingLots, parkingSpaces]);

  const selectedLot = useMemo(
    () => lotsWithStats.find((lot) => lot.id === selectedLotId) ?? null,
    [lotsWithStats, selectedLotId]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="admin-parking-popup__overlay" role="presentation" onClick={onClose}>
      <section
        className="admin-parking-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-parking-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-parking-popup__header">
          <div>
            <p className="admin-parking-popup__eyebrow">Parking management</p>
            <h2 id="admin-parking-popup-title">ניהול חניונים</h2>
            <p className="admin-parking-popup__subtitle">
              כאן אפשר לעבור בין כל חניוני המערכת ולקבל תמונת מצב מלאה על כל חניון בנפרד.
            </p>
          </div>

          <button type="button" className="admin-parking-popup__close" onClick={onClose} aria-label="סגירת הפופ-אפ">
            ✕
          </button>
        </header>

        {parkingLotsLoading ? <p className="admin-parking-popup__state">טוען את נתוני החניונים...</p> : null}
        {!parkingLotsLoading && parkingSpacesLoading ? <p className="admin-parking-popup__state">טוען את נתוני המקומות...</p> : null}
        {parkingLotsError ? <p className="admin-parking-popup__state admin-parking-popup__state--error">{parkingLotsError}</p> : null}
        {parkingSpacesError ? <p className="admin-parking-popup__state admin-parking-popup__state--error">{parkingSpacesError}</p> : null}

        {!parkingLotsLoading && !parkingLotsError ? (
          <div className="admin-parking-popup__layout">
            <aside className="admin-parking-popup__sidebar">
              <div className="admin-parking-popup__sidebar-header">
                <h3>כלל החניונים</h3>
                <p>{lotsWithStats.length} חניונים זמינים לניהול</p>
              </div>

              <input
                className="admin-parking-popup__search"
                placeholder="חיפוש לפי שם, כתובת או מזהה"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />

              <div className="admin-parking-popup__lot-list">
                {lotsWithStats.length ? (
                  lotsWithStats.map((lot) => (
                    <button
                      key={lot.id}
                      type="button"
                      className={`admin-parking-popup__lot-card ${selectedLotId === lot.id ? "admin-parking-popup__lot-card--active" : ""}`}
                      onClick={() => setSelectedLotId(lot.id)}
                    >
                      <div className="admin-parking-popup__lot-copy">
                        <strong>{lot.name}</strong>
                        <span>{lot.address}</span>
                      </div>
                      <div className="admin-parking-popup__lot-meta">
                        <span>סה״כ {lot.totalSpaces}</span>
                        <span>פנויים {lot.availableSpaces}</span>
                        <span>מוזמנים {lot.reservedSpaces}</span>
                        <span>תפוסים {lot.occupiedSpaces}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="admin-parking-popup__empty">לא נמצאו חניונים עבור החיפוש הזה.</p>
                )}
              </div>
            </aside>

            <div className="admin-parking-popup__details">
              {selectedLot ? (
                <>
                  <section className="admin-parking-popup__hero-card">
                    <div>
                      <p className="admin-parking-popup__detail-eyebrow">פרטי חניון</p>
                      <h3>{selectedLot.name}</h3>
                      <p>{selectedLot.address}</p>
                    </div>

                    <div className="admin-parking-popup__hero-meta">
                      <span>מזהה חניון: {selectedLot.id}</span>
                      <span>בעלים: {ownerLookup.get(String(selectedLot.ownerId ?? "")) ?? "לא משויך"}</span>
                      <span>מחיר בסיס: ₪{selectedLot.basePrice}</span>
                    </div>

                    <div className="admin-parking-popup__actions">
                      <button type="button" className="admin-parking-popup__action" onClick={onOpenUserManagement}>
                        נהל בעלים ושיוכים
                      </button>
                      <button type="button" className="admin-parking-popup__action admin-parking-popup__action--ghost" onClick={() => setSearchTerm("")}>
                        נקה חיפוש
                      </button>
                    </div>
                  </section>

                  <section className="admin-parking-popup__stats-grid">
                    <article className="admin-parking-popup__stat-card">
                      <span>סה״כ מקומות</span>
                      <strong>{selectedLot.totalSpaces}</strong>
                    </article>
                    <article className="admin-parking-popup__stat-card admin-parking-popup__stat-card--available">
                      <span>פנויים</span>
                      <strong>{selectedLot.availableSpaces}</strong>
                    </article>
                    <article className="admin-parking-popup__stat-card admin-parking-popup__stat-card--reserved">
                      <span>מוזמנים</span>
                      <strong>{selectedLot.reservedSpaces}</strong>
                    </article>
                    <article className="admin-parking-popup__stat-card admin-parking-popup__stat-card--occupied">
                      <span>תפוסים</span>
                      <strong>{selectedLot.occupiedSpaces}</strong>
                    </article>
                  </section>

                  <section className="admin-parking-popup__spaces-panel">
                    <div className="admin-parking-popup__spaces-header">
                      <h3>מקומות החניה</h3>
                      <p>פירוט מלא של כל מקום בחניון הנבחר.</p>
                    </div>

                    {selectedLot.spaces.length ? (
                      <div className="admin-parking-popup__table-wrap">
                        <table className="admin-parking-popup__table">
                          <thead>
                            <tr>
                              <th>מקום</th>
                              <th>סטטוס</th>
                              <th>לקוח</th>
                              <th>מתחיל</th>
                              <th>נגמר</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedLot.spaces.map((space) => (
                              <tr key={space.id}>
                                <td>{space.parkingSpaceId || space.id}</td>
                                <td>{getStatusLabel(space.effectiveStatus)}</td>
                                <td>{space.customerId ?? space.reservation?.customerId ?? "-"}</td>
                                <td>{formatDateTime(space.reservation?.reservedFrom)}</td>
                                <td>{formatDateTime(space.reservation?.reservedUntil)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : parkingSpacesLoading ? (
                      <p className="admin-parking-popup__empty">טוען את מקומות החניה של החניון...</p>
                    ) : (
                      <p className="admin-parking-popup__empty">לא קיימים עדיין מקומות חניה לחניון הזה.</p>
                    )}
                  </section>
                </>
              ) : (
                <p className="admin-parking-popup__empty">בחר חניון כדי לראות את כל הנתונים שלו.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}