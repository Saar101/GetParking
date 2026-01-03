import { useMemo, useState } from "react";
import "./App.css";

import { seedGetParkingData } from "./services/seed";
import {
  occupySpaceForCustomer,
  setSpaceStatusByOwnerOrAdmin,
} from "./services/parkingSpaces.service";

import { Button } from "./components/Button";
import { UserCard } from "./components/UserCard";

// 🔹 temporary hardcoded user (until Auth)
const CURRENT_USER = {
  docId: "101",
  role: "customer" as const,
  label: "Customer (temporary)",
};

export default function App() {
  const [status, setStatus] = useState("Ready");

  const user = useMemo(() => CURRENT_USER, []);

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

  const occupy = async () => {
    try {
      setStatus("Occupying P015...");
      await occupySpaceForCustomer("P015", user.docId);
      setStatus("✅ Occupied");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Occupy failed: ${e?.message ?? "unknown error"}`);
    }
  };

  const setAvailable = async () => {
    try {
      setStatus("Setting available...");
      await setSpaceStatusByOwnerOrAdmin("P015", user.docId, "available", null);
      setStatus("✅ Set available");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Failed: ${e?.message ?? "unknown error"}`);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>GetParking</h1>

      <UserCard user={user} />

      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <Button onClick={runSeed}>Seed</Button>
        <Button onClick={occupy}>Occupy</Button>
        <Button onClick={setAvailable}>Set Available</Button>
      </div>

      <p style={{ marginTop: 14, fontFamily: "monospace" }}>{status}</p>
    </div>
  );
}
