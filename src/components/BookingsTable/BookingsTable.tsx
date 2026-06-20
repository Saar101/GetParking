import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentBookingUserDocId } from "../../services/users.service";
import {
  listUserBookings,
  releaseParkingSpaceReservation,
  type UserBookingRow,
} from "../../services/parkingSpaces.service";
import "./BookingsTable.css";

type BookingsTableProps = {
  isOpen: boolean;
  onClose: () => void;
};

function formatDate(dateIso: string | null) {
  if (!dateIso) {
    return "-";
  }

  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("he-IL");
}

function formatTime(dateIso: string | null, fallbackTime: string | null) {
  if (dateIso) {
    const date = new Date(dateIso);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    }
  }

  return fallbackTime ?? "-";
}

function getStatusLabel(status: UserBookingRow["status"]) {
  if (status === "active") {
    return "פעילה עכשיו";
  }

  if (status === "future") {
    return "עתידית";
  }

  return "היסטוריה";
}

function getHistoryOutcomeLabel(booking: UserBookingRow) {
  if (booking.status !== "past") {
    return "-";
  }

  if (booking.historyOutcome === "cancelled") {
    return "בוטלה";
  }

  if (booking.historyOutcome === "ended") {
    return "הסתיימה";
  }

  return booking.source === "history" ? "בוטלה" : "הסתיימה";
}

function getHistoryVisibilityKey(booking: UserBookingRow) {
  return [booking.spaceId, booking.reservedFrom ?? booking.date ?? booking.startTime ?? "unknown"].join("|");
}

export default function BookingsTable({ isOpen, onClose }: BookingsTableProps) {
  const [bookings, setBookings] = useState<UserBookingRow[]>([]);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [hiddenHistoryKeys, setHiddenHistoryKeys] = useState<string[]>([]);
  const [hidingHistoryKeys, setHidingHistoryKeys] = useState<string[]>([]);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelingSpaceId, setCancelingSpaceId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const hideTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const BOOKING_PANEL_ANIMATION_MS = 260;
  const hiddenHistoryStorageKey = userDocId ? `getparking.hidden-bookings.v2.${userDocId}` : null;

  const loadHiddenHistorySpaceIds = (resolvedUserDocId: string) => {
    const storedValue = window.localStorage.getItem(`getparking.hidden-bookings.v2.${resolvedUserDocId}`);

    if (!storedValue) {
      setHiddenHistoryKeys([]);
      return;
    }

    try {
      const parsed = JSON.parse(storedValue) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        setHiddenHistoryKeys(parsed);
        return;
      }
    } catch {
      // Ignore malformed local storage and start clean.
    }

    setHiddenHistoryKeys([]);
  };

  const persistHiddenHistorySpaceIds = (nextHiddenIds: string[]) => {
    setHiddenHistoryKeys(nextHiddenIds);

    if (!hiddenHistoryStorageKey) {
      return;
    }

    window.localStorage.setItem(hiddenHistoryStorageKey, JSON.stringify(nextHiddenIds));
  };

  const loadBookings = async () => {
    setLoading(true);
    setError("");

    try {
      const resolvedUserDocId = await getCurrentBookingUserDocId();
      setUserDocId(resolvedUserDocId);
      const rows = await listUserBookings(resolvedUserDocId);
      setBookings(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(message || "לא הצלחנו לטעון את ההזמנות כרגע.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelFutureReservation = async (spaceId: string) => {
    if (!userDocId) {
      setError("לא הצלחנו לזהות את המשתמש המחובר.");
      return;
    }

    setCancelingSpaceId(spaceId);
    setError("");

    try {
      await releaseParkingSpaceReservation(spaceId, userDocId);
      window.dispatchEvent(new CustomEvent("user-bookings-updated"));
      await loadBookings();
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : String(cancelError);
      setError(message || "לא הצלחנו לבטל את ההזמנה כרגע.");
    } finally {
      setCancelingSpaceId(null);
    }
  };

  const handleHideHistoryRow = (booking: UserBookingRow) => {
    if (booking.status !== "past") {
      return;
    }

    const bookingKey = getHistoryVisibilityKey(booking);

    if (hiddenHistoryKeys.includes(bookingKey) || hidingHistoryKeys.includes(bookingKey)) {
      return;
    }

    setHidingHistoryKeys((current) => [...current, bookingKey]);

    const existingTimer = hideTimersRef.current[bookingKey];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    hideTimersRef.current[bookingKey] = window.setTimeout(() => {
      const nextHiddenIds = [...hiddenHistoryKeys, bookingKey];
      persistHiddenHistorySpaceIds(nextHiddenIds);
      setHidingHistoryKeys((current) => current.filter((item) => item !== bookingKey));
      delete hideTimersRef.current[bookingKey];
    }, 260);
  };

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      void loadBookings();
    } else if (isRendered) {
      setIsClosing(true);
      closeTimer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, BOOKING_PANEL_ANIMATION_MS);
    }

    return () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    };
  }, [isOpen, isRendered]);

  useEffect(() => {
    const handleBookingsUpdate = () => {
      if (!isOpen) {
        return;
      }

      void loadBookings();
    };

    window.addEventListener("user-bookings-updated", handleBookingsUpdate as EventListener);

    return () => {
      window.removeEventListener("user-bookings-updated", handleBookingsUpdate as EventListener);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!userDocId) {
      return;
    }

    loadHiddenHistorySpaceIds(userDocId);
  }, [userDocId]);

  useEffect(() => {
    return () => {
      Object.values(hideTimersRef.current).forEach((timerId) => clearTimeout(timerId));
      hideTimersRef.current = {};
    };
  }, []);

  const summary = useMemo(() => {
    const active = bookings.filter((item) => item.status === "active").length;
    const future = bookings.filter((item) => item.status === "future").length;
    const past = bookings.filter((item) => item.status === "past").length;

    return { active, future, past };
  }, [bookings]);

  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (booking) => !(booking.status === "past" && hiddenHistoryKeys.includes(getHistoryVisibilityKey(booking)))
      ),
    [bookings, hiddenHistoryKeys]
  );

  if (!isRendered) {
    return null;
  }

  return (
    <div
      className={`bookings-overlay ${isClosing ? "bookings-overlay--closing" : ""}`}
      onClick={onClose}
    >
      <section
        className={`bookings-panel ${isClosing ? "bookings-panel--closing" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bookings-header">
          <div>
            <p className="bookings-eyebrow">My bookings</p>
            <h2>ההזמנות שלי</h2>
            <p className="bookings-subtitle">כולל הזמנות עתידיות והיסטוריית חניות שכבר בוצעו</p>
          </div>
          <button className="bookings-close" onClick={onClose} type="button" aria-label="סגירה">
            ✕
          </button>
        </header>

        <div className="bookings-summary">
          <span>פעילות: {summary.active}</span>
          <span>עתידיות: {summary.future}</span>
          <span>היסטוריה: {summary.past}</span>
          <button className="bookings-refresh" onClick={() => void loadBookings()} type="button" disabled={loading}>
            רענון
          </button>
        </div>

        {loading ? <p className="bookings-state">טוען הזמנות...</p> : null}
        {error ? <p className="bookings-error">{error}</p> : null}

        {!loading && !error && visibleBookings.length === 0 ? (
          <p className="bookings-state">אין עדיין הזמנות להצגה.</p>
        ) : null}

        {!loading && !error && visibleBookings.length > 0 ? (
          <div className="bookings-table-wrap">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>סטטוס</th>
                  <th>חניה</th>
                  <th>חניון</th>
                  <th>תאריך</th>
                  <th>שעה</th>
                  <th>משך</th>
                  <th>כתובת</th>
                  <th>פעולה</th>
                  <th>הערה</th>
                </tr>
              </thead>
              <tbody>
                {visibleBookings.map((booking) => (
                  <tr
                    key={booking.spaceId}
                    className={
                      booking.status === "past" && hidingHistoryKeys.includes(getHistoryVisibilityKey(booking))
                        ? "bookings-table__row--hiding"
                        : ""
                    }
                  >
                    <td>
                      <span className={`booking-status booking-status--${booking.status}`}>
                        {getStatusLabel(booking.status)}
                      </span>
                    </td>
                    <td>{booking.spaceId}</td>
                    <td>{booking.lotName}</td>
                    <td>{formatDate(booking.reservedFrom)}</td>
                    <td>{formatTime(booking.reservedFrom, booking.startTime)}</td>
                    <td>{booking.durationHours ? `${booking.durationHours} שעות` : "-"}</td>
                    <td>{booking.lotAddress || "-"}</td>
                    <td>
                      {booking.status === "future" && booking.source === "reservation" ? (
                        <button
                          type="button"
                          className="booking-cancel-button"
                          onClick={() => void handleCancelFutureReservation(booking.spaceId)}
                          disabled={cancelingSpaceId === booking.spaceId}
                        >
                          {cancelingSpaceId === booking.spaceId ? "מבטל..." : "ביטול הזמנה"}
                        </button>
                      ) : booking.status === "past" ? (
                        <div className="booking-history-action-cell">
                          <button
                            type="button"
                            className="booking-hide-button"
                            onClick={() => handleHideHistoryRow(booking)}
                            title="הסתר שורה זו מהטבלה"
                            aria-label="הסתר שורה מהיסטוריה"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {getHistoryOutcomeLabel(booking)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
