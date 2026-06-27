import { useEffect, useState } from 'react';
import ParkingReservation, { type ReservationData } from '../ParkingReservation';
import ParkingApproved from '../ParkingApproved/ParkingApproved';
import { recordParkingLotCardCheck } from '../../services/parkingLots.service';
import {
  releaseParkingSpaceReservation,
  reserveFirstAvailableParkingSpaceForCustomer,
} from '../../services/parkingSpaces.service';
import { getCurrentBookingUserDocId, getCurrentUserSettings } from '../../services/users.service';
import './ParkingInfo.css';

interface ParkingSpace {
  id: string;
  address: string;
  navigationAddress?: string;
  navigationLat?: number;
  navigationLng?: number;
  price: number;
  hidePricing?: boolean;
  bookingLocked?: boolean;
  pricingLabel?: string;
  pricingRanges?: Array<{
    text: string;
    isSale?: boolean;
    originalText?: string;
    animateSale?: boolean;
    coveredBySale?: boolean;
  }>;
  pricingRangesTitle?: string;
  originalPriceText?: string;
  salePriceText?: string;
  hasActiveSale?: boolean;
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
  const [showNavigationOptions, setShowNavigationOptions] = useState(false);
  const [reservedSpaceId, setReservedSpaceId] = useState<string | null>(null);
  const [reservedByUserDocId, setReservedByUserDocId] = useState<string | null>(null);
  const [reservationData, setReservationData] = useState<ReservationData | null>(null);
  const [defaultDurationHours, setDefaultDurationHours] = useState(2);
  const [defaultArrivalTime, setDefaultArrivalTime] = useState("09:00");
  const [defaultArrivalTimeUsesCurrentTime, setDefaultArrivalTimeUsesCurrentTime] = useState(true);

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
      setShowNavigationOptions(false);
      setReservedSpaceId(null);
      setReservedByUserDocId(null);
      setReservationData(null);
      return;
    }

    const loadDefaultDuration = async () => {
      try {
        const settings = await getCurrentUserSettings();
        setDefaultDurationHours(settings.defaultDurationHours);
        setDefaultArrivalTime(settings.defaultArrivalTime);
        setDefaultArrivalTimeUsesCurrentTime(settings.defaultArrivalTimeUsesCurrentTime);
      } catch (loadError) {
        console.error('שגיאה בטעינת ברירת המחדל של משך החניה:', loadError);
        setDefaultDurationHours(2);
        setDefaultArrivalTime(new Date().toTimeString().slice(0, 5));
        setDefaultArrivalTimeUsesCurrentTime(true);
      }
    };

    void loadDefaultDuration();

    setHasRecommendedLocal(false);
    setIsCelebrating(false);
    setShowReservation(false);
    setShowNoAvailability(false);
    setShowNavigationOptions(false);
    setReservedSpaceId(null);
    setReservedByUserDocId(null);
  }, [isOpen, parkingSpace?.id]);

  useEffect(() => {
    if (!isOpen || !parkingSpace?.id) {
      return;
    }

    void recordParkingLotCardCheck(parkingSpace.id).catch((error) => {
      console.error('שגיאה בעדכון כניסה לכרטיס החניון:', error);
    });
  }, [isOpen, parkingSpace?.id]);

  if (!isOpen || !parkingSpace) return null;

  const isRecommendationLocked = recommendationDisabled || hasRecommendedLocal;
  const isBookingLocked = Boolean(parkingSpace.bookingLocked);
  const navigationAddress = (parkingSpace.navigationAddress ?? parkingSpace.address.replace(' • ', ', ')).trim();
  const hasNavigationCoordinates = Number.isFinite(parkingSpace.navigationLat) && Number.isFinite(parkingSpace.navigationLng);
  const fallbackSaleRange =
    parkingSpace.hasActiveSale && parkingSpace.salePriceText
      ? {
          text: parkingSpace.salePriceText,
          isSale: true,
          originalText: parkingSpace.originalPriceText,
          animateSale: true,
        }
      : null;
  const displayPricingRanges = (parkingSpace.pricingRanges ?? []).length > 0
    ? parkingSpace.pricingRanges ?? []
    : fallbackSaleRange
      ? [fallbackSaleRange]
      : [];

  const handleRecommend = () => {
    if (isRecommendationLocked) {
      return;
    }

    setHasRecommendedLocal(true);
    setIsCelebrating(true);
    window.setTimeout(() => setIsCelebrating(false), 750);
    onRecommend();
  };

  const openExternalNavigation = (provider: 'waze' | 'google-maps') => {
    if (!hasNavigationCoordinates && !navigationAddress) {
      return;
    }

    const encodedAddress = encodeURIComponent(navigationAddress);
    const lat = parkingSpace.navigationLat;
    const lng = parkingSpace.navigationLng;
    const targetUrl = provider === 'waze'
      ? hasNavigationCoordinates
        ? `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://www.waze.com/ul?q=${encodedAddress}&navigate=yes`
      : hasNavigationCoordinates
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
        : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    setShowNavigationOptions(false);
  };

  const handleReservationConfirm = async (data: ReservationData) => {
    setReservationData(data);

    try {
      const currentUserDocId = await getCurrentBookingUserDocId();
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
          {!parkingSpace.hidePricing ? (
            <div className="detail-row">
              <span className="detail-label">💰 מחיר:</span>
              <div className="parking-price-block">
                {displayPricingRanges.length > 0 ? (
                <div className={`parking-price-ranges ${parkingSpace.hasActiveSale ? 'parking-price-ranges--sale' : ''}`}>
                  <ul className="parking-price-ranges__list">
                    {displayPricingRanges.map((range) => (
                      <li key={`${range.originalText ?? ''}-${range.text}`} className={`parking-price-ranges__item ${range.isSale ? 'parking-price-ranges__item--sale' : ''}`}>
                        {range.coveredBySale && range.originalText ? (
                          <span className="parking-price-ranges__covered-original">{range.originalText}</span>
                        ) : range.isSale && range.originalText ? (
                          <span className="parking-price-ranges__sale-pair">
                            <span className="parking-price-ranges__original">{range.originalText}</span>
                            <span className={`parking-price-ranges__sale ${range.animateSale ? '' : 'parking-price-ranges__sale--covered'}`.trim()}>{range.text}</span>
                          </span>
                        ) : (
                          range.text
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                ) : !parkingSpace.hasActiveSale ? (
                  <span className="detail-value">₪{parkingSpace.price} {parkingSpace.pricingLabel ?? "לשעה"}</span>
                ) : null}
              </div>
            </div>
          ) : null}
          
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
            className={`action-button navigation-button ${showNavigationOptions ? 'navigation-button--active' : ''}`}
            onClick={() => setShowNavigationOptions((current) => !current)}
            disabled={!hasNavigationCoordinates && !navigationAddress}
          >
            🧭 נווט
          </button>
          <button 
            className="action-button book-button"
            onClick={() => {
              setShowReservation(true);
            }}
            disabled={!parkingSpace.available || isBookingLocked}
          >
            {isBookingLocked ? '🔒 הזמנת חנייה' : '🔖 הזמנת חנייה'}
          </button>
          <button 
            className={`action-button recommend-button ${isCelebrating ? 'recommend-button--celebrating' : ''} ${isRecommendationLocked ? 'recommend-button--locked' : ''}`}
            onClick={handleRecommend}
            disabled={isRecommendationLocked}
          >
            {isRecommendationLocked ? '✅ הומלץ' : '👍 המלצה'}
          </button>
        </div>

        {showNavigationOptions ? (
          <div className="parking-navigation-panel">
            <button
              type="button"
              className="parking-navigation-panel__option parking-navigation-panel__option--waze"
              onClick={() => openExternalNavigation('waze')}
            >
              פתח ב-Waze
            </button>
            <button
              type="button"
              className="parking-navigation-panel__option parking-navigation-panel__option--google"
              onClick={() => openExternalNavigation('google-maps')}
            >
              פתח ב-Google Maps
            </button>
          </div>
        ) : null}

        <ParkingReservation
          isOpen={showReservation}
          onClose={() => setShowReservation(false)}
          onConfirm={handleReservationConfirm}
          parkingLotName={parkingSpace.address}
          initialDurationHours={defaultDurationHours}
          initialStartTime={defaultArrivalTime}
          useCurrentStartTime={defaultArrivalTimeUsesCurrentTime}
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
