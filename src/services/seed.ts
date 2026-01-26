import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Seeds Firestore with sample data for testing relationships:
 * - 3 users (customer, owner, admin)
 * - 3 parking lots
 * - 8 parking spaces (linked to lots via parkingLotId)
 *
 * Safe to run multiple times (setDoc overwrites same IDs).
 */
export async function seedGetParkingData() {
  // ----- PARKING LOTS (first, so we know the IDs) -----
  const lots = [
    {
      id: "L01",
      name: "חניון בן גוריון",
      address: "רחוב בן גוריון 25, תל אביב",
      location: { lat: 32.0853, lng: 34.7818 },
      ownerId: 201,
    },
    {
      id: "L02",
      name: "חניון דיזנגוף",
      address: "דיזנגוף 99, תל אביב",
      location: { lat: 32.0830, lng: 34.7700 },
      ownerId: 202,
    },
    {
      id: "L03",
      name: "חניון אלנבי",
      address: "אלנבי 150, תל אביב",
      location: { lat: 32.0770, lng: 34.7650 },
      ownerId: 201,
    },
  ];

  for (const lot of lots) {
    await setDoc(
      doc(db, "parkingLots", lot.id),
      {
        parkingLotId: lot.id,
        name: lot.name,
        address: lot.address,
        location: lot.location,
        demandScore: Math.floor(Math.random() * 10),
        basePrice: Math.floor(Math.random() * 30) + 15,
        salePrice: null,
        ownerId: lot.ownerId,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // ----- USERS (with proper parkingLotId assignments) -----
  const users = [
    { id: "101", name: "Saar", role: "customer", parkingLotId: null },
    { id: "102", name: "Nir", role: "customer", parkingLotId: null },
    { id: "201", name: "David", role: "owner", parkingLotId: "L01" },
    { id: "202", name: "Rachel", role: "owner", parkingLotId: "L02" },
    { id: "1", name: "Admin", role: "admin", parkingLotId: null },
  ];

  for (const user of users) {
    await setDoc(
      doc(db, "users", user.id),
      {
        userId: Number(user.id),
        name: user.name,
        role: user.role,
        bookingHistory: [],
        parkingLotId: user.parkingLotId,
        parkingSpaceId: null,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // ----- PARKING SPACES -----
  const lotsSpaces = [
    { lotId: "L01", count: 3 },
    { lotId: "L02", count: 3 },
    { lotId: "L03", count: 2 },
  ];

  for (const { lotId, count } of lotsSpaces) {
    for (let i = 1; i <= count; i++) {
      const spaceId = `${lotId}-${String(i).padStart(2, "0")}`;
      const isOccupied = Math.random() > 0.6; // 40% chance occupied

      await setDoc(
        doc(db, "parkingSpaces", spaceId),
        {
          parkingSpaceId: spaceId,
          parkingLotId: lotId,
          status: isOccupied ? "occupied" : "available",
          dateTime: new Date().toISOString(),
          customerId: isOccupied ? Number(["101", "102"][Math.floor(Math.random() * 2)]) : null,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  return {
    users: users.map((u) => u.id),
    parkingLots: lots.map((l) => l.id),
    parkingSpaces: lotsSpaces.reduce((acc, { lotId, count }) => {
      for (let i = 1; i <= count; i++) {
        acc.push(`${lotId}-${String(i).padStart(2, "0")}`);
      }
      return acc;
    }, [] as string[]),
  };
}

