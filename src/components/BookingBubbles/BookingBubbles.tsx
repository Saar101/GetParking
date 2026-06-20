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
  status: "active" | "future";
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

  return `${item.lotName} • ${startText}${durationText ? ` • ${durationText}` : ""}`;
}

function getBubbleProximityTime(item: UserBookingRow) {
  if (item.status === "active") {
    const activeEnd = new Date(item.reservedUntil ?? "").getTime();
    return Number.isNaN(activeEnd) ? Number.MAX_SAFE_INTEGER : activeEnd;
  }

  const futureStart = new Date(item.reservedFrom ?? "").getTime();
  return Number.isNaN(futureStart) ? Number.MAX_SAFE_INTEGER : futureStart;
}

export default function BookingBubbles({ onOpenBookings }: BookingBubblesProps) {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<UserBookingRow[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [settings, userDocId] = await Promise.all([
          getCurrentUserSettings(),
          getCurrentBookingUserDocId(),
        ]);

        if (!mounted) {
          return;
        }

        setEnabled(settings.notificationsEnabled);

        if (!settings.notificationsEnabled) {
          setItems([]);
          return;
        }

        const bookings = await listUserBookings(userDocId);

        if (!mounted) {
          return;
        }

        const nextItems = bookings
          .filter((booking) => booking.status === "active" || booking.status === "future")
          .sort((left, right) => getBubbleProximityTime(left) - getBubbleProximityTime(right));
        setItems(nextItems);
      } catch {
        if (mounted) {
          setItems([]);
        }
      }
    };

    void load();
    const handleSettingsUpdate = () => {
      void load();
    };

    window.addEventListener("user-settings-updated", handleSettingsUpdate as EventListener);

    const intervalId = window.setInterval(() => {
      void load();
    }, 60000);

    return () => {
      mounted = false;
      window.removeEventListener("user-settings-updated", handleSettingsUpdate as EventListener);
      window.clearInterval(intervalId);
    };
  }, []);

  const bubbles = useMemo<BubbleViewModel[]>(() => {
    return items.slice(0, 3).map((item, index) => ({
      id: `${item.spaceId}-${index}`,
      title: item.status === "active" ? "החניה שלך פעילה" : "יש לך חניה עתידית",
      subtitle: buildBubbleText(item),
      status: item.status,
    }));
  }, [items]);

  if (!enabled || bubbles.length === 0) {
    return null;
  }

  return (
    <aside className="booking-bubbles" aria-live="polite">
      {bubbles.map((bubble) => (
        <button
          type="button"
          key={bubble.id}
          className={`booking-bubble booking-bubble--${bubble.status}`}
          onClick={onOpenBookings}
          title="פתח את ההזמנות שלי"
        >
          <span className="booking-bubble__title">{bubble.title}</span>
          <span className="booking-bubble__subtitle">{bubble.subtitle}</span>
        </button>
      ))}
    </aside>
  );
}
