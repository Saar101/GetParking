import { useState } from "react";
import "./App.css";

import { seedGetParkingData } from "./services/seed";
import GoogleMapTest from "./components/GoogleMapTest.tsx/GoogleMapTest";
import ParkingApproved from "./components/ParkingApproved/ParkingApproved";
import ParkingInfo from "./components/ParkingInfo/ParkingInfo";
import SidBar from "./components/SidBar/SidBar";

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
    reviews: 234,
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

  return (
    <>
      <SidBar />
      <button
        className="gmt-open-button-circular"
        onClick={() => setShowMap(true)}
        title="חפש כתובת"
      >
        🗺️
      </button>

      <div style={{ padding: 24 }}>
      <h1>GetParking</h1>

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
