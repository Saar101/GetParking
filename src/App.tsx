import { useState } from "react";
import "./App.css";

import { seedGetParkingData } from "./services/seed";
import { assignCustomerToSpace, clearSpace } from "./services/parkingSpaces.service";
import { addBookingHistoryId, setCustomerCurrentParking } from "./services/users.service";

export default function App() {
  const [status, setStatus] = useState("Ready");

  const runSeed = async () => {
    try {
      setStatus("Seeding...");
      await seedGetParkingData();
      setStatus("✅ Seed done (space starts as available)");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Seed failed: ${e?.message ?? "unknown error"}`);
    }
  };

  const occupyExample = async () => {
    try {
      setStatus("Occupying P015 for customer 101...");
      await assignCustomerToSpace("P015", 101);

      // Update customer fields (simple approach)
      await addBookingHistoryId("101", "P015");
      await setCustomerCurrentParking("101", "L01", "P015");

      setStatus("✅ Occupied + updated user history/current");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Occupy failed: ${e?.message ?? "unknown error"}`);
    }
  };

  const clearExample = async () => {
    try {
      setStatus("Clearing P015...");
      await clearSpace("P015");

      // Clear customer's current linked space/lot
      await setCustomerCurrentParking("101", null, null);

      setStatus("✅ Cleared + user current cleared");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Clear failed: ${e?.message ?? "unknown error"}`);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>GetParking – Services Test</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={runSeed}>Seed Data</button>
        <button onClick={occupyExample}>Occupy P015 (customer 101)</button>
        <button onClick={clearExample}>Clear P015</button>
      </div>

      <p style={{ marginTop: 16, fontFamily: "monospace" }}>{status}</p>
    </div>
  );
}
