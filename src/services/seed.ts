import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Seeds Firestore with sample data for:
 * - users/{userId}
 * - parkingLots/{parkingLotId}
 * - parkingSpaces/{parkingSpaceId}
 *
 * Safe to run multiple times (setDoc overwrites same IDs).
 */
export async function seedGetParkingData() {
  // ----- SAMPLE IDS -----
  const customerId = "101";
  const ownerId = "201";
  const adminId = "1";

  const lotId = "L01";
  const spaceId = "P015";

  // ----- users -----
  await setDoc(
    doc(db, "users", customerId),
    {
      userId: Number(customerId),
      name: "Saar",
      role: "customer",
      bookingHistory: [], // ✅ מתחילים בלי היסטוריה
      parkingLotId: null, // ✅ אין שיוך פעיל בהתחלה
      parkingSpaceId: null, // ✅ אין שיוך פעיל בהתחלה
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", ownerId),
    {
      userId: Number(ownerId),
      name: "David",
      role: "owner",
      parkingLotId: lotId,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", adminId),
    {
      userId: Number(adminId),
      name: "Admin",
      role: "admin",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  // ----- parkingLots -----
  await setDoc(
    doc(db, "parkingLots", lotId),
    {
      parkingLotId: lotId,
      name: "Azrieli Parking",
      demandScore: 42,
      basePrice: 25,
      salePrice: 20,
      ownerId: Number(ownerId),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  // ----- parkingSpaces -----
  await setDoc(
    doc(db, "parkingSpaces", spaceId),
    {
      parkingSpaceId: spaceId,
      parkingLotId: lotId,
      status: "available", // ✅ מתחילים פנוי
      dateTime: new Date().toISOString(),
      customerId: null, // ✅ אין לקוח בהתחלה
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    users: [customerId, ownerId, adminId],
    parkingLots: [lotId],
    parkingSpaces: [spaceId],
    initialSpaceStatus: "available",
  };
}
