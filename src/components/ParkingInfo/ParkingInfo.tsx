import { useEffect, useState } from 'react';
import ParkingReservation, { ReservationData } from '../ParkingReservation';
import ParkingApproved from '../ParkingApproved/ParkingApproved';
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
  const [reservationData, setReservationData] = useState<ReservationData | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setHasRecommendedLocal(false);
      setIsCelebrating(false);
      setShowReservation(false);
      setShowApproved(false);
      setReservationData(null);
      return;
    }

    setHasRecommendedLocal(false);
    setIsCelebrating(false);
    setShowReservation(false);
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

  const handleReservationConfirm = (data: ReservationData) => {
    setReservationData(data);
    console.log("הזמנת חנייה אושרה:", {
      parkingLotId: parkingSpace.id,
      parkingLotAddress: parkingSpace.address,
      ...data,
    });
    setShowReservation(false);
    setShowApproved(true);
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
            onClick={() => setShowReservation(true)}
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
        />
      </div>
    </div>
  );
}
