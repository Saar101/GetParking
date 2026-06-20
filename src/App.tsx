import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import "./App.css";

import { auth } from "./firebase";
import AuthScreen from "./components/AuthScreen/AuthScreen";
import { seedGetParkingData } from "./services/seed";
import { resetAllParkingSpacesToAvailable } from "./services/parkingSpaces.service";
import { syncAuthenticatedUserRecord } from "./services/users.service";
import GoogleMapTest from "./components/GoogleMapTest.tsx/GoogleMapTest";
import BookingsTable from "./components/BookingsTable/BookingsTable";
import BookingBubbles from "./components/BookingBubbles/BookingBubbles";
import FavoritesTable from "./components/FavoritesTable/FavoritesTable";
import UserSettings from "./components/UserSettings/UserSettings";
import ParkingInfo from "./components/ParkingInfo/ParkingInfo";
import SidBar from "./components/SidBar/SidBar";
import appTitleLogo from "./assets/ChatGPT Image Jan 26, 2026, 08_22_00 PM.png";
import homeBackgroundImage from "./assets/home-background.png";

export default function App() {
  const [status, setStatus] = useState("Ready");
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showParkingInfo, setShowParkingInfo] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSidebarPage, setActiveSidebarPage] = useState<'find' | 'bookings' | 'favorites' | 'settings' | 'logout'>('find');
  const logoutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        if (logoutTimerRef.current !== null) {
          window.clearTimeout(logoutTimerRef.current);
          logoutTimerRef.current = null;
        }

        void syncAuthenticatedUserRecord();
        setShowIntro(true);

        const timeoutId = window.setTimeout(() => {
          setShowIntro(false);
        }, 900);

        return () => {
          window.clearTimeout(timeoutId);
        };
      }
    });

    return unsubscribe;
  }, []);

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

  const runSeed = async () => {
    try {
      setStatus("Seeding...");
      await seedGetParkingData();
      setStatus("✅ Seed done");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Seed failed: ${e?.message ?? "unknown error"}`);
    }
  };

  const resetParkingSpaces = async () => {
    try {
      setStatus("Resetting spaces...");
      const result = await resetAllParkingSpacesToAvailable();
      setStatus(`✅ Reset done (${result.count} spaces)`);
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Reset failed: ${e?.message ?? "unknown error"}`);
    }
  };

  const handleLogout = async () => {
    setShowIntro(true);

    if (logoutTimerRef.current !== null) {
      window.clearTimeout(logoutTimerRef.current);
    }

    logoutTimerRef.current = window.setTimeout(() => {
      void signOut(auth);
      logoutTimerRef.current = null;
    }, 900);
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

  if (!authReady) {
    return <AuthScreen subtitle="טוען את מסך הכניסה..." />;
  }

  return (
    <>
      {showIntro ? (
        <div className="app-intro-overlay" aria-hidden="true">
          <div className="app-intro-circle" />
          <div className="app-intro-ripple" />
        </div>
      ) : null}
      {user ? (
        <div
          className={`app-shell ${showIntro ? "app-shell--intro" : ""}`}
          style={{ backgroundImage: `url(${homeBackgroundImage})` }}
        >
          <div className="app-shell__content">
            <SidBar
              onLogout={handleLogout}
              onBookingsClick={() => setShowBookings(true)}
              onFavoritesClick={() => setShowFavorites(true)}
              onSettingsClick={() => setShowSettings(true)}
              activePage={activeSidebarPage}
              onPageChange={setActiveSidebarPage}
              userName={user.displayName ?? user.email ?? "משתמש"}
            />
            <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 1100, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={runSeed}
                style={{ padding: '8px 12px', borderRadius: 8, background: '#08507a', color: 'white', border: 'none', cursor: 'pointer' }}
                title="Seed Firestore with test data"
              >
                Run seed
              </button>
              <button
                onClick={resetParkingSpaces}
                style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#0a79b3', color: 'white', border: 'none', cursor: 'pointer' }}
                title="Reset all parking spaces to available"
              >
                Reset spaces
              </button>
            </div>
            <button
              className="gmt-open-button-circular"
              onClick={() => setShowMap(true)}
              title="חפש כתובת"
            >
              🗺️
            </button>

            <div style={{ padding: "72px 24px 24px" }}>
            <div className="gp-title-container" style={{ marginTop: 84 }}>
              <img src={appTitleLogo} alt="GetParking" className="gp-title-logo" />
            </div>

            <div style={{ marginTop: 48, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <button
                className="gmt-open-button-main"
                onClick={() => setShowMap(true)}
                title="חפש כתובת"
              >
                <span className="gmt-button-emoji">🗺️</span>
                <span className="gmt-button-text">חיפוש חניון</span>
              </button>
            </div>

            <p style={{ marginTop: 14, fontFamily: "monospace", fontSize: "14px", color: "#666" }}>
              Status: {status}
            </p>

          
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
          </div>
        </div>
        </div>
      ) : (
        <AuthScreen />
      )}
    </>
  );
}
