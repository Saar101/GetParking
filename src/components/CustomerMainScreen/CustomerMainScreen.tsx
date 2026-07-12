import { useState } from "react";
import BookingsTable from "../BookingsTable/BookingsTable";
import BookingBubbles from "../BookingBubbles/BookingBubbles";
import FavoritesTable from "../FavoritesTable/FavoritesTable";
import GoogleMapTest from "../GoogleMapTest.tsx/GoogleMapTest";
import LogoutConfirmPopup from "../LogoutConfirmPopup/LogoutConfirmPopup";
import ParkingInfo from "../ParkingInfo/ParkingInfo";
import SidBar from "../SidBar/SidBar";
import UserSettings from "../UserSettings/UserSettings";
import appTitleLogo from "../../assets/ChatGPT Image Jan 26, 2026, 08_22_00 PM.png";
import homeBackgroundImage from "../../assets/home-background.png";

type CustomerMainScreenProps = {
  userName: string;
  onLogout: () => void;
  showIntro: boolean;
};

export default function CustomerMainScreen({ userName, onLogout, showIntro }: CustomerMainScreenProps) {
  const [showParkingInfo, setShowParkingInfo] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeSidebarPage, setActiveSidebarPage] = useState<'find' | 'bookings' | 'favorites' | 'settings' | 'logout'>('find');

  const mockParkingSpace = {
    id: "L01-01",
    address: "רחוב בן גוריון 25, תל אביב",
    price: 18,
    distance: "250 מ' ממיקומך",
    rating: 4.8,
    recommendationCount: 234,
    available: true,
    features: ["תאורה", "מצלמות אבטחה", "גדר", "מטענת חשמל"],
  };

  const handleCloseBookings = () => {
    setShowBookings(false);
    setActiveSidebarPage('find');
  };

  const handleCloseFavorites = () => {
    setShowFavorites(false);
    setActiveSidebarPage('find');
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    setActiveSidebarPage('find');
  };

  const handleRequestLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
    setActiveSidebarPage('find');
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <div
      className={`app-shell ${showIntro ? "app-shell--intro" : ""}`}
      style={{ backgroundImage: `url(${homeBackgroundImage})` }}
    >
      <div className="app-shell__content">
        <SidBar
          onLogout={handleRequestLogout}
          onBookingsClick={() => setShowBookings(true)}
          onFavoritesClick={() => setShowFavorites(true)}
          onSettingsClick={() => setShowSettings(true)}
          activePage={activeSidebarPage}
          onPageChange={setActiveSidebarPage}
          userName={userName}
        />
        <div className="customer-main-shell">
          <div className="gp-title-container customer-main-title-container">
            <img src={appTitleLogo} alt="GetParking" className="gp-title-logo" />
          </div>

          <div className="customer-main-cta-row">
            <button
              className="gmt-open-button-main"
              onClick={() => setShowMap(true)}
              title="חפש כתובת"
            >
              <span className="gmt-button-emoji">🗺️</span>
              <span className="gmt-button-text">חיפוש חניון</span>
            </button>
          </div>
          <div style={{ marginTop: 24 }}>
            <GoogleMapTest isOpen={showMap} onClose={() => setShowMap(false)} />
          </div>

          <ParkingInfo
            isOpen={showParkingInfo}
            onClose={() => setShowParkingInfo(false)}
            parkingSpace={mockParkingSpace}
            onBook={() => {}}
            onRecommend={() => console.log("Recommend clicked")}
          />
          <BookingBubbles onOpenBookings={() => setShowBookings(true)} />
          <BookingsTable isOpen={showBookings} onClose={handleCloseBookings} />
          <FavoritesTable isOpen={showFavorites} onClose={handleCloseFavorites} />
          <UserSettings isOpen={showSettings} onClose={handleCloseSettings} />
          <LogoutConfirmPopup isOpen={showLogoutConfirm} onConfirm={handleConfirmLogout} onCancel={handleCancelLogout} />
        </div>
      </div>
    </div>
  );
}
