import { useEffect, useState } from 'react';
import ParkingReservation, { type ReservationData } from '../ParkingReservation';
import ParkingApproved from '../ParkingApproved/ParkingApproved';
import {
  releaseParkingSpaceReservation,
  reserveFirstAvailableParkingSpaceForCustomer,
} from '../../services/parkingSpaces.service';
import { getCurrentBookingUserDocId } from '../../services/users.service';
import './ParkingInfo.css';

interface ParkingSpace {
  id: string;
  address: string;
  price: number;
  distance: string;
  rating: number;
  recommendationCount: number;
  available: boolean;
  features?: string[];
}

interface ParkingInfoProps {
  isOpen: boolean;
  onClose: () => void;
  parkingSpace: ParkingSpace;
  onBook: () => void;
  onRecommend: () => void;
  recommendationDisabled?: boolean;
}

export default function ParkingInfo({ 
  isOpen, 
  onClose, 
  parkingSpace, 
  onBook, 
  onRecommend,
  recommendationDisabled = false
}: ParkingInfoProps) {
  const [hasRecommendedLocal, setHasRecommendedLocal] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [showApproved, setShowApproved] = useState(false);
  const [showNoAvailability, setShowNoAvailability] = useState(false);
  const [reservedSpaceId, setReservedSpaceId] = useState<string | null>(null);
  const [reservedByUserDocId, setReservedByUserDocId] = useState<string | null>(null);
  const [reservationData, setReservationData] = useState<ReservationData | null>(null);

  const notifyBookingChange = () => {
    window.dispatchEvent(new CustomEvent("user-bookings-updated"));
  };

  useEffect(() => {
    if (!isOpen) {
      setHasRecommendedLocal(false);
      setIsCelebrating(false);
      setShowReservation(false);
      setShowApproved(false);
      setShowNoAvailability(false);
      setReservedSpaceId(null);
      setReservedByUserDocId(null);
      setReservationData(null);
      return;
    }

    setHasRecommendedLocal(false);
    setIsCelebrating(false);
    setShowReservation(false);
    setShowNoAvailability(false);
    setReservedSpaceId(null);
    setReservedByUserDocId(null);
  }, [isOpen, parkingSpace?.id]);

  if (!isOpen || !parkingSpace) return null;

  const isRecommendationLocked = recommendationDisabled || hasRecommendedLocal;

  const handleRecommend = () => {
    if (isRecommendationLocked) {
      return;
    }

    setHasRecommendedLocal(true);
    setIsCelebrating(true);
    window.setTimeout(() => setIsCelebrating(false), 750);
    onRecommend();
  };

  const handleReservationConfirm = async (data: ReservationData) => {
    setReservationData(data);
    const currentUserDocId = await getCurrentBookingUserDocId();

    try {
      const reservationResult = await reserveFirstAvailableParkingSpaceForCustomer(parkingSpace.id, {
        ...data,
        userDocId: currentUserDocId,
      });

      console.log("הזמנת חנייה אושרה ונשמרה ב-Firestore:", {
        parkingLotId: parkingSpace.id,
        parkingLotAddress: parkingSpace.address,
        reservedSpaceId: reservationResult.spaceId,
        ...data,
      });

      setReservedSpaceId(reservationResult.spaceId);
      setReservedByUserDocId(currentUserDocId);
      setShowReservation(false);
      setShowApproved(true);
      notifyBookingChange();
      onBook();
    } catch (error) {
      console.error("שגיאה בשמירת ההזמנה ב-Firestore:", error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("No available parking spaces found")) {
        setShowReservation(false);
        setShowNoAvailability(true);
        return;
      }

      alert("לא הצלחנו לשמור את ההזמנה כרגע. נסה שוב.");
    }
  };

  const handleReleaseReservation = async () => {
    if (!reservedSpaceId) {
      return;
    }

    try {
      await releaseParkingSpaceReservation(reservedSpaceId, reservedByUserDocId ?? undefined);
      setShowApproved(false);
      setReservedSpaceId(null);
      setReservedByUserDocId(null);
      setReservationData(null);
      notifyBookingChange();
    } catch (error) {
      console.error('שגיאה בשחרור החנייה:', error);
      alert('לא הצלחנו לשחרר את החנייה כרגע. נסה שוב.');
    }
  };

  return (
    <div className="parking-info-overlay" onClick={onClose}>
      <div className="parking-info-popup" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>
        
        <div className="parking-info-header">
          <h2>{parkingSpace.address}</h2>
          <div className="parking-rating">
            <span className="stars">⭐ {parkingSpace.rating.toFixed(1)}</span>
            <span className="reviews">({parkingSpace.recommendationCount} המלצות)</span>
          </div>
        </div>

        <div className="parking-info-details">
          <div className="detail-row">
            <span className="detail-label">💰 מחיר:</span>
            <span className="detail-value">₪{parkingSpace.price}/שעה</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">📍 מרחק:</span>
            <span className="detail-value">{parkingSpace.distance}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">🅿️ סטטוס:</span>
            <span className={`detail-value status ${parkingSpace.available ? 'available' : 'occupied'}`}>
              {parkingSpace.available ? '✓ זמין' : '✕ תפוס'}
            </span>
          </div>

          {parkingSpace.features && parkingSpace.features.length > 0 && (
            <div className="features-section">
              <h3>😊 תכונות:</h3>
              <div className="features-list">
                {parkingSpace.features.map((feature, index) => (
                  <div key={index} className="feature-tag">
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="parking-info-actions">
          <button 
            className="action-button book-button"
            onClick={() => {
              setShowReservation(true);
            }}
            disabled={!parkingSpace.available}
          >
            🔖 הזמנת חנייה
          </button>
          <button 
            className={`action-button recommend-button ${isCelebrating ? 'recommend-button--celebrating' : ''} ${isRecommendationLocked ? 'recommend-button--locked' : ''}`}
            onClick={handleRecommend}
            disabled={isRecommendationLocked}
          >
            {isRecommendationLocked ? '✅ הומלץ' : '👍 המלצה'}
          </button>
        </div>

        <ParkingReservation
          isOpen={showReservation}
          onClose={() => setShowReservation(false)}
          onConfirm={handleReservationConfirm}
          parkingLotName={parkingSpace.address}
        />

        <ParkingApproved
          isOpen={showApproved}
          onClose={() => setShowApproved(false)}
          onRelease={handleReleaseReservation}
          parkingSpaceId={reservedSpaceId}
          reservation={reservationData}
        />

        <ParkingApproved
          isOpen={showNoAvailability}
          onClose={() => setShowNoAvailability(false)}
          variant="error"
        />
      </div>
    </div>
  );
}
