import { useState, useEffect, useRef } from "react";
import "./ParkingReservation.css";

interface ParkingReservationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (data: ReservationData) => void;
  parkingLotName?: string;
  initialDurationHours?: number;
}

export interface ReservationData {
  date: string;
  startTime: string;
  durationHours: number;
}

// Get current date in YYYY-MM-DD format
function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Get current time in HH:MM format
function getCurrentTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function ParkingReservation({
  isOpen,
  onClose,
  onConfirm,
  parkingLotName = "החניון",
  initialDurationHours = 2,
}: ParkingReservationProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);
  const [date, setDate] = useState(getCurrentDate());
  const [startTime, setStartTime] = useState(getCurrentTime());
  const [durationHours, setDurationHours] = useState(initialDurationHours);
  const durationOptions = Array.from({ length: 24 }, (_, index) => index + 1);

  // Reset to current date/time when popup opens
  const handleOpen = () => {
    setDate(getCurrentDate());
    setStartTime(getCurrentTime());
    setDurationHours(initialDurationHours);
  };

  useEffect(() => {
    if (isOpen) {
      handleOpen();
    }
  }, [isOpen, initialDurationHours]);

  const openDatePicker = () => {
    const input = dateInputRef.current;

    if (!input) {
      return;
    }

    const pickerInput = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.focus();
  };

  const openTimePicker = () => {
    const input = timeInputRef.current;

    if (!input) {
      return;
    }

    const pickerInput = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.focus();
  };

  const handleConfirm = () => {
    if (!date || !startTime) {
      alert("אנא מלא את כל השדות");
      return;
    }

    const reservationData: ReservationData = {
      date,
      startTime,
      durationHours,
    };

    if (onConfirm) {
      onConfirm(reservationData);
    }

    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="pr-overlay" onClick={onClose} />
      <div className="pr-popup">
        <div className="pr-header">
          <h3 className="pr-title">📅 הזמן חנייה</h3>
          <p className="pr-subtitle">ל־{parkingLotName}</p>
          <button
            className="pr-close-button"
            onClick={onClose}
            aria-label="סגירת הפאנל"
          >
            ✕
          </button>
        </div>

        <div className="pr-body">
          {/* Date Field */}
          <div className="pr-field">
            <label htmlFor="pr-date" className="pr-label">
              📆 בחר תאריך
            </label>
            <input
              id="pr-date"
              type="date"
              ref={dateInputRef}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onClick={openDatePicker}
              className="pr-input pr-input--date"
              style={{ cursor: "pointer", pointerEvents: "auto" }}
            />
          </div>

          {/* Time Field */}
          <div className="pr-field">
            <label htmlFor="pr-time" className="pr-label">
              🕐 שעת הגעה
            </label>
            <input
              id="pr-time"
              type="time"
              ref={timeInputRef}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              onClick={openTimePicker}
              className="pr-input pr-input--time"
              style={{ cursor: "pointer", pointerEvents: "auto" }}
            />
          </div>

          {/* Duration Field */}
          <div className="pr-field">
            <label htmlFor="pr-duration" className="pr-label">
              ⏱️ זמן השהות בחנייה (שעות)
            </label>
            <div className="pr-duration-container">
              <select
                id="pr-duration"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="pr-select"
              >
                {durationOptions.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours} {hours === 1 ? "שעה" : "שעות"}
                  </option>
                ))}
              </select>
              <span className="pr-duration-display">{durationHours} ש׳</span>
            </div>
          </div>

          {/* Summary */}
          <div className="pr-summary">
            <div className="pr-summary-item">
              <span className="pr-summary-label">תאריך:</span>
              <span className="pr-summary-value">
                {date ? new Date(date).toLocaleDateString("he-IL") : "לא נבחר"}
              </span>
            </div>
            <div className="pr-summary-item">
              <span className="pr-summary-label">זמן:</span>
              <span className="pr-summary-value">{startTime}</span>
            </div>
            <div className="pr-summary-item">
              <span className="pr-summary-label">משך:</span>
              <span className="pr-summary-value">{durationHours} שעות</span>
            </div>
          </div>
        </div>

        <div className="pr-footer">
          <button
            className="pr-button pr-button--secondary"
            onClick={onClose}
            type="button"
          >
            ביטול
          </button>
          <button
            className="pr-button pr-button--primary"
            onClick={handleConfirm}
            type="button"
          >
            ✓ אישור הזמנה
          </button>
        </div>
      </div>
    </>
  );
}
