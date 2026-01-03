import { useMemo, useState } from "react";
import "./App.css";

import { seedGetParkingData } from "./services/seed";
import {
  occupySpaceForCustomer,
  setSpaceStatusByOwnerOrAdmin,
} from "./services/parkingSpaces.service";

import { MOCK_USERS, canEditSpaces } from "./mockSession";
import { Button } from "./components/Button";
import { UserCard } from "./components/UserCard";

export default function App() {
  const [status, setStatus] = useState("Ready");
  const [selectedDocId, setSelectedDocId] = useState<string>(MOCK_USERS[0].docId);

  const selectedUser = useMemo(
    () => MOCK_USERS.find((u) => u.docId === selectedDocId) ?? MOCK_USERS[0],
    [selectedDocId]
  );

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

  const occupyAsSelected = async () => {
    try {
      setStatus(`Occupying P015 as ${selectedUser.role} (docId=${selectedUser.docId})...`);
      await occupySpaceForCustomer("P015", selectedUser.docId);
      setStatus("✅ Occupied (space + user updated in one transaction)");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Occupy failed: ${e?.message ?? "unknown error"}`);
    }
  };

  const markAvailableBySelected = async () => {
    try {
      setStatus(`Setting P015 to available as ${selectedUser.role}...`);
      await setSpaceStatusByOwnerOrAdmin("P015", selectedUser.docId, "available", null);
      setStatus("✅ Space set to available (owner/admin action)");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Set available failed: ${e?.message ?? "unknown error"}`);
    }
  };

  const markOccupiedBySelected = async () => {
    try {
      setStatus(`Setting P015 to occupied as ${selectedUser.role}...`);
      await setSpaceStatusByOwnerOrAdmin("P015", selectedUser.docId, "occupied", 101);
      setStatus("✅ Space set to occupied (owner/admin action)");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Set occupied failed: ${e?.message ?? "unknown error"}`);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>GetParking – Mock Roles (No Auth)</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 14, maxWidth: 720 }}>
        {/* UserCard */}
        <UserCard user={selectedUser} />

        {/* Selector */}
        <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Select Mock User</h3>

          <label style={{ display: "block", marginBottom: 6 }}>Choose mock user:</label>
          <select value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}>
            {MOCK_USERS.map((u) => (
              <option key={u.docId} value={u.docId}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Actions</h3>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={runSeed}>Seed Data</Button>

            <Button
              onClick={occupyAsSelected}
              disabled={selectedUser.role !== "customer"}
              title={selectedUser.role !== "customer" ? "Only customer can occupy" : ""}
            >
              Occupy P015 (Customer)
            </Button>

            <Button
              onClick={markAvailableBySelected}
              disabled={!canEditSpaces(selectedUser.role)}
              title={!canEditSpaces(selectedUser.role) ? "Only owner/admin can edit spaces" : ""}
            >
              Set P015 to available (Owner/Admin)
            </Button>

            <Button
              onClick={markOccupiedBySelected}
              disabled={!canEditSpaces(selectedUser.role)}
              title={!canEditSpaces(selectedUser.role) ? "Only owner/admin can edit spaces" : ""}
            >
              Set P015 to occupied (Owner/Admin)
            </Button>
          </div>

          <p style={{ marginTop: 14, fontFamily: "monospace" }}>{status}</p>

          <p style={{ marginTop: 8, opacity: 0.75 }}>
            Temporary UI-only permissions (no Auth yet).
          </p>
        </div>
      </div>
    </div>
  );
}
