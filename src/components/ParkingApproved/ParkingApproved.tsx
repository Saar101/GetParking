import { useEffect } from 'react';
import './ParkingApproved.css';

interface ParkingApprovedProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'success' | 'error';
  title?: string;
  message?: string;
  parkingSpaceId?: string | null;
  reservation?: {
    date: string;
    startTime: string;
    durationHours: number;
    reservedFrom?: string;
    reservedUntil?: string;
  } | null;
}

export default function ParkingApproved({
  isOpen,
  onClose,
  variant = 'success',
  title,
  message,
  parkingSpaceId,
  reservation,
}: ParkingApprovedProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedReservationDate = reservation?.date
    ? new Date(reservation.date).toLocaleDateString('he-IL')
    : null;

  const isErrorVariant = variant === 'error';
  const popupTitle = title ?? (isErrorVariant ? 'אין חנייה פנויה' : 'החנייה מאושרת!');
  const popupMessage =
    message ??
    (isErrorVariant ? 'אין חנייה פנויה בזמן המבוקש' : 'החנייה שלך הוזמנה בהצלחה');

  return (
    <div className="parking-approved-overlay" onClick={onClose}>
      <div className={`parking-approved-popup ${isErrorVariant ? 'parking-approved-popup--error' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className={`checkmark-circle ${isErrorVariant ? 'checkmark-circle--error' : ''}`}>
          <div className="checkmark">{isErrorVariant ? '✕' : '✓'}</div>
        </div>
        <h2>{popupTitle}</h2>
        <p>{popupMessage}</p>
        {!isErrorVariant && parkingSpaceId && <p>מספר חנייה: {parkingSpaceId}</p>}
        {!isErrorVariant && formattedReservationDate && reservation && (
          <p>
            {formattedReservationDate} • {reservation.startTime} • {reservation.durationHours} שעות
          </p>
        )}
      </div>
    </div>
  );
}
