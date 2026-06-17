import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!isOpen) {
      setHasRecommendedLocal(false);
      setIsCelebrating(false);
      return;
    }

    setHasRecommendedLocal(false);
    setIsCelebrating(false);
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
            onClick={onBook}
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
      </div>
    </div>
  );
}
