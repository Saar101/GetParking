import { useEffect, useMemo, useState } from "react";
import { listUserBookings, type UserBookingRow } from "../../services/parkingSpaces.service";
import { getCurrentBookingUserDocId, getCurrentUserSettings } from "../../services/users.service";
import "./BookingBubbles.css";

type BookingBubblesProps = {
  onOpenBookings?: () => void;
};

type BubbleViewModel = {
  id: string;
  title: string;
  subtitle: string;
  status: "active" | "future" | "cancelled";
  booking: UserBookingRow;
};

function formatBubbleTime(iso: string | null, fallback: string | null) {
  if (!iso) {
    return fallback ?? "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return fallback ?? "";
  }

  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function buildBubbleText(item: UserBookingRow) {
  const startText = formatBubbleTime(item.reservedFrom, item.startTime);
  const durationText = item.durationHours ? `${item.durationHours} ש׳` : "";

  if (item.status === "active") {
    return `בחניה ${item.spaceId} • ${item.lotName}`;
  }

  if (item.status === "past" && item.historyOutcome === "cancelled") {
    return `הזמנה בוטלה ע"י מנהל החניון • ${item.lotName} • חניה ${item.spaceId}`;
  }

  return `${item.lotName} • ${startText}${durationText ? ` • ${durationText}` : ""}`;
}

function getBubbleProximityTime(item: UserBookingRow) {
  if (item.status === "active") {
    const activeEnd = new Date(item.reservedUntil ?? "").getTime();
    return Number.isNaN(activeEnd) ? Number.MAX_SAFE_INTEGER : activeEnd;
  }

  if (item.status === "past" && item.historyOutcome === "cancelled") {
    const cancelledTime = new Date(item.reservedUntil ?? item.reservedFrom ?? "").getTime();
    return Number.isNaN(cancelledTime) ? Number.MAX_SAFE_INTEGER : cancelledTime;
  }

  const futureStart = new Date(item.reservedFrom ?? "").getTime();
  return Number.isNaN(futureStart) ? Number.MAX_SAFE_INTEGER : futureStart;
}

function getCancelledBubbleKey(item: UserBookingRow) {
  return [item.spaceId, item.reservedFrom ?? item.date ?? item.startTime ?? "unknown", item.reservedUntil ?? "unknown"].join("|");
}

function formatModalDate(iso: string | null) {
  if (!iso) {
    return "-";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("he-IL");
}

function formatModalTime(iso: string | null, fallback: string | null) {
  if (iso) {
    const date = new Date(iso);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    }
  }

  return fallback ?? "-";
}

export default function BookingBubbles({ onOpenBookings }: BookingBubblesProps) {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<UserBookingRow[]>([]);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [hiddenCancelledKeys, setHiddenCancelledKeys] = useState<string[]>([]);
  const [selectedCancelledBooking, setSelectedCancelledBooking] = useState<UserBookingRow | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [settings, resolvedUserDocId] = await Promise.all([
          getCurrentUserSettings(),
          getCurrentBookingUserDocId(),
        ]);

        if (!mounted) {
          return;
        }

        setUserDocId(resolvedUserDocId);
        setEnabled(settings.notificationsEnabled);

        if (!settings.notificationsEnabled) {
          setItems([]);
          return;
        }

        const bookings = await listUserBookings(resolvedUserDocId);

        if (!mounted) {
          return;
        }

        const nextItems = bookings
          .filter((booking) => booking.status === "active" || booking.status === "future" || (booking.status === "past" && booking.historyOutcome === "cancelled"))
          .sort((left, right) => {
            const statusRank = { active: 0, future: 1, cancelled: 2 } as const;
            const leftRank = left.status === "past" && left.historyOutcome === "cancelled" ? statusRank.cancelled : statusRank[left.status];
            const rightRank = right.status === "past" && right.historyOutcome === "cancelled" ? statusRank.cancelled : statusRank[right.status];

            const rankDiff = leftRank - rightRank;

            if (rankDiff !== 0) {
              return rankDiff;
            }

            return getBubbleProximityTime(left) - getBubbleProximityTime(right);
          });

        setItems(nextItems);
      } catch {
        if (mounted) {
          setItems([]);
        }
      }
    };

    void load();

    const handleRefresh = () => {
      void load();
    };

    window.addEventListener("user-settings-updated", handleRefresh as EventListener);
    window.addEventListener("user-bookings-updated", handleRefresh as EventListener);

    const intervalId = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      mounted = false;
      window.removeEventListener("user-settings-updated", handleRefresh as EventListener);
      window.removeEventListener("user-bookings-updated", handleRefresh as EventListener);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!userDocId) {
      return;
    }

    const storageKey = `getparking.hidden-cancelled-bookings.v1.${userDocId}`;
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      setHiddenCancelledKeys([]);
      return;
    }

    try {
      const parsed = JSON.parse(storedValue) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        setHiddenCancelledKeys(parsed);
        return;
      }
    } catch {
      // ignore malformed local storage
    }

    setHiddenCancelledKeys([]);
  }, [userDocId]);

  const bubbles = useMemo<BubbleViewModel[]>(() => {
    return items.slice(0, 3).map((item, index) => ({
      id: `${item.spaceId}-${index}`,
      title:
        item.status === "active"
          ? "החניה שלך פעילה"
          : item.status === "past" && item.historyOutcome === "cancelled"
            ? "הזמנה בוטלה"
            : "יש לך חניה עתידית",
      subtitle: buildBubbleText(item),
      status: item.status === "past" && item.historyOutcome === "cancelled" ? "cancelled" : item.status,
      booking: item,
    }));
  }, [items]);

  const visibleBubbles = useMemo(() => {
    return bubbles.filter((bubble) => {
      if (bubble.status !== "cancelled") {
        return true;
      }

      return !hiddenCancelledKeys.includes(getCancelledBubbleKey(bubble.booking));
    });
  }, [bubbles, hiddenCancelledKeys]);

  const persistHiddenCancelledKeys = (nextHiddenKeys: string[]) => {
    setHiddenCancelledKeys(nextHiddenKeys);

    if (!userDocId) {
      return;
    }

    window.localStorage.setItem(`getparking.hidden-cancelled-bookings.v1.${userDocId}`, JSON.stringify(nextHiddenKeys));
  };

  const handleCancelledBubbleClick = (booking: UserBookingRow) => {
    const bookingKey = getCancelledBubbleKey(booking);

    if (!hiddenCancelledKeys.includes(bookingKey)) {
      persistHiddenCancelledKeys([...hiddenCancelledKeys, bookingKey]);
    }

    setSelectedCancelledBooking(booking);
  };

  const closeCancelledPopup = () => {
    setSelectedCancelledBooking(null);
  };

  if (!enabled || (visibleBubbles.length === 0 && !selectedCancelledBooking)) {
    return null;
  }

  return (
    <>
      {visibleBubbles.length > 0 ? (
        <aside className="booking-bubbles" aria-live="polite">
          {visibleBubbles.map((bubble) => (
            <button
              key={bubble.id}
              type="button"
              className={`booking-bubble booking-bubble--${bubble.status}`}
              onClick={() => {
                if (bubble.status === "cancelled") {
                  handleCancelledBubbleClick(bubble.booking);
                  return;
                }

                onOpenBookings?.();
              }}
              title={bubble.status === "cancelled" ? "הצג הודעת ביטול" : "פתח את ההזמנות שלי"}
            >
              <span className="booking-bubble__title">{bubble.title}</span>
              <span className="booking-bubble__subtitle">{bubble.subtitle}</span>
            </button>
          ))}
        </aside>
      ) : null}

      {selectedCancelledBooking ? (
        <div className="booking-cancel-overlay" role="presentation" onClick={closeCancelledPopup}>
          <section
            className="booking-cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-cancel-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="booking-cancel-modal__header">
              <div>
                <p className="booking-cancel-modal__eyebrow">התראה ממנהל החניון</p>
                <h2 id="booking-cancel-modal-title">הזמנה בוטלה</h2>
              </div>
              <button type="button" className="booking-cancel-modal__close" onClick={closeCancelledPopup} aria-label="סגירה">
                ✕
              </button>
            </div>

            <p className="booking-cancel-modal__message">
              מנהל החניון ביטל את החנייה שלך בחניון <strong>{selectedCancelledBooking.lotName}</strong> עבור חניה <strong>{selectedCancelledBooking.spaceId}</strong>.
            </p>

            <div className="booking-cancel-modal__details">
              <div>
                <span>תאריך</span>
                <strong>{formatModalDate(selectedCancelledBooking.reservedFrom ?? null)}</strong>
              </div>
              <div>
                <span>שעה</span>
                <strong>{formatModalTime(selectedCancelledBooking.reservedFrom ?? null, selectedCancelledBooking.startTime ?? null)}</strong>
              </div>
              <div>
                <span>משך</span>
                <strong>{selectedCancelledBooking.durationHours ? `${selectedCancelledBooking.durationHours} שעות` : "-"}</strong>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
