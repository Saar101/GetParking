import { useEffect, useMemo, useState } from "react";
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

export default function BookingsTable({ isOpen, onClose }: BookingsTableProps) {
  const [bookings, setBookings] = useState<UserBookingRow[]>([]);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelingSpaceId, setCancelingSpaceId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
      await loadBookings();
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : String(cancelError);
      setError(message || "לא הצלחנו לבטל את ההזמנה כרגע.");
    } finally {
      setCancelingSpaceId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadBookings();
  }, [isOpen]);

  const summary = useMemo(() => {
    const active = bookings.filter((item) => item.status === "active").length;
    const future = bookings.filter((item) => item.status === "future").length;
    const past = bookings.filter((item) => item.status === "past").length;

    return { active, future, past };
  }, [bookings]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="bookings-overlay" onClick={onClose}>
      <section className="bookings-panel" onClick={(event) => event.stopPropagation()}>
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

        {!loading && !error && bookings.length === 0 ? (
          <p className="bookings-state">אין עדיין הזמנות להצגה.</p>
        ) : null}

        {!loading && !error && bookings.length > 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.spaceId}>
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
                      ) : (
                        "-"
                      )}
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
