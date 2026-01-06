import './ParkingInfo.css';

interface ParkingSpace {
  id: string;
  address: string;
  price: number;
  distance: string;
  rating: number;
  reviews: number;
  available: boolean;
  features?: string[];
}

interface ParkingInfoProps {
  isOpen: boolean;
  onClose: () => void;
  parkingSpace: ParkingSpace;
  onBook: () => void;
  onRecommend: () => void;
}

export default function ParkingInfo({ 
  isOpen, 
  onClose, 
  parkingSpace, 
  onBook, 
  onRecommend 
}: ParkingInfoProps) {
  if (!isOpen || !parkingSpace) return null;

  return (
    <div className="parking-info-overlay" onClick={onClose}>
      <div className="parking-info-popup" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>
        
        <div className="parking-info-header">
          <h2>{parkingSpace.address}</h2>
          <div className="parking-rating">
            <span className="stars">⭐ {parkingSpace.rating.toFixed(1)}</span>
            <span className="reviews">({parkingSpace.reviews} ביקורות)</span>
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
            className="action-button recommend-button"
            onClick={onRecommend}
          >
            👍 המלצה
          </button>
        </div>
      </div>
    </div>
  );
}
