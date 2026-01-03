import { useState } from "react";
import "./App.css";

import { db } from "./firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function App() {
  const [status, setStatus] = useState<string>("Ready");
  const [lastDocId, setLastDocId] = useState<string>("");

  const writeTestDoc = async () => {
    setLastDocId("");

    // בדיקות env בלי לחשוף ערכים
    console.log("apiKey loaded?", !!import.meta.env.VITE_FIREBASE_API_KEY);
    console.log("projectId loaded?", !!import.meta.env.VITE_FIREBASE_PROJECT_ID);

    try {
      setStatus("Writing to Firestore...");

      console.log("➡️ before addDoc");

      // Timeout כדי שלא ניתקע לנצח
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Firestore write timed out (10s)")),
          10000
        )
      );

      const writePromise = addDoc(collection(db, "test"), {
        message: "Firebase Firestore write test ✅",
        createdAt: serverTimestamp(),
        from: "React + TS (Vite)",
      });

      const ref = await Promise.race([writePromise, timeout]);

      console.log("⬅️ after addDoc");
      console.log("✅ Firestore doc created:", ref.id);

      setLastDocId(ref.id);
      setStatus(`✅ Success! Document created: ${ref.id}`);
    } catch (err) {
      console.error("❌ Firestore write failed:", err);
      setStatus("❌ Write failed. Open DevTools Console (F12) for details.");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>GetParking – Firestore Test</h1>

      <p>
        Click the button to create a document in Firestore collection{" "}
        <code>test</code>.
      </p>

      <button onClick={writeTestDoc}>Write test doc</button>

      <p style={{ marginTop: 16, fontFamily: "monospace" }}>{status}</p>

      {lastDocId && (
        <p style={{ fontFamily: "monospace" }}>
          Last Doc ID: <b>{lastDocId}</b>
        </p>
      )}

      <hr style={{ margin: "24px 0" }} />

      <p style={{ opacity: 0.85 }}>
        If it times out, check Network tab for requests to{" "}
        <code>firestore.googleapis.com</code>. If it fails with permissions,
        update Firestore Rules or sign in with Auth.
      </p>
    </div>
  );
}
