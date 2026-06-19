import { useState } from "react";
import "./App.css";

import { seedGetParkingData } from "./services/seed";
import { resetAllParkingSpacesToAvailable } from "./services/parkingSpaces.service";
import GoogleMapTest from "./components/GoogleMapTest.tsx/GoogleMapTest";
import ParkingApproved from "./components/ParkingApproved/ParkingApproved";
import ParkingInfo from "./components/ParkingInfo/ParkingInfo";
import SidBar from "./components/SidBar/SidBar";
import logo from "./assets/ChatGPT Image Jan 26, 2026, 08_22_00 PM.png";

export default function App() {
  const [status, setStatus] = useState("Ready");
  const [showApproved, setShowApproved] = useState(false);
  const [showParkingInfo, setShowParkingInfo] = useState(false);
  const [showMap, setShowMap] = useState(false);

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

  return (
    <>
      <SidBar />
      <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 1100 }}>
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

      <div style={{ padding: 24 }}>
      <div className="gp-title-container">
        <img src={logo} alt="GetParking" className="gp-title-logo" />
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <button
          className="gmt-open-button-main"
          onClick={() => setShowMap(true)}
          title="חפש כתובת"
        >
          <span className="gmt-button-emoji">🗺️</span>
          <span className="gmt-button-text">חיפוש חניון</span>
        </button>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => setShowParkingInfo(true)} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Show Parking Info
        </button>
      </div>

      <p style={{ marginTop: 14, fontFamily: "monospace", fontSize: "14px", color: "#666" }}>
        Status: {status}
      </p>

    
      <div style={{ marginTop: 24 }}>
        <GoogleMapTest isOpen={showMap} onClose={() => setShowMap(false)} />
      </div>

      <ParkingApproved isOpen={showApproved} onClose={() => setShowApproved(false)} />
      <ParkingInfo 
        isOpen={showParkingInfo} 
        onClose={() => setShowParkingInfo(false)}
        parkingSpace={mockParkingSpace}
        onBook={() => setShowApproved(true)}
        onRecommend={() => console.log("Recommend clicked")}
      />
      </div>
    </>
  );
}
