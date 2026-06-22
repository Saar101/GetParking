import { db } from "../firebase";
import { collection, doc, getDoc, getDocs, increment, setDoc, updateDoc } from "firebase/firestore";
import type { UserDoc, BookingHistorySnapshot } from "./users.service";

export type ParkingLotDoc = {
  parkingLotId: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  demandScore: number;
  recommendationCount?: number;
  recommendationHistoryByHour?: Record<string, number>;
  cardChecksCount?: number;
  cardChecksHistoryByHour?: Record<string, number>;
  basePrice: number;
  salePrice?: number | null;
  ownerId: number;
  createdAt?: any;
};

const lotsCol = "parkingLots";

export async function createParkingLot(lotId: string, data: ParkingLotDoc) {
  await setDoc(doc(db, lotsCol, lotId), data, { merge: true });
}

export async function getParkingLot(lotId: string) {
  const snap = await getDoc(doc(db, lotsCol, lotId));
  return snap.exists() ? snap.data() : null;
}

export async function listParkingLots() {
  const snap = await getDocs(collection(db, lotsCol));

  return snap.docs.map((lotDoc) => ({
    id: lotDoc.id,
    ...(lotDoc.data() as ParkingLotDoc),
  }));
}

export async function updateParkingLot(
  lotId: string,
  patch: Partial<ParkingLotDoc>
) {
  await updateDoc(doc(db, lotsCol, lotId), patch as any);
}

export async function setLotSalePrice(lotId: string, salePrice: number | null) {
  await updateParkingLot(lotId, { salePrice });
}

export async function incrementDemandScore(lotId: string, by: number = 1) {
  // פשוט: קורא ואז מעדכן. (אם תרצה נעשה atomic עם increment)
  const lot = await getParkingLot(lotId);
  const current = typeof lot?.demandScore === "number" ? lot.demandScore : 0;
  await updateParkingLot(lotId, { demandScore: current + by });
}

export async function incrementCardChecksCount(lotId: string, by: number = 1) {
  await updateDoc(doc(db, lotsCol, lotId), {
    cardChecksCount: increment(by),
  });
}

function buildHourlyHistoryKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");

  return `${year}-${month}-${day}_${hour}`;
}

export async function addParkingLotRecommendation(lotId: string, date: Date = new Date()) {
  const hourKey = buildHourlyHistoryKey(date);

  await updateDoc(doc(db, lotsCol, lotId), {
    recommendationCount: increment(1),
    [`recommendationHistoryByHour.${hourKey}`]: increment(1),
  });
}

export async function recordParkingLotCardCheck(lotId: string, date: Date = new Date()) {
  const hourKey = buildHourlyHistoryKey(date);

  await updateDoc(doc(db, lotsCol, lotId), {
    cardChecksCount: increment(1),
    [`cardChecksHistoryByHour.${hourKey}`]: increment(1),
  });
}

/**
 * Fetch real historical booking data for a parking lot from user booking history
 * Extracts all bookings where spaceId starts with lotId (e.g., "L01-01" for lot "L01")
 */
export async function getActualHistoryForLot(lotId: string): Promise<{
  dailyBookings: Array<{ date: string; count: number }>;
  allBookings: Array<BookingHistorySnapshot & { spaceId: string; date: string }>;
}> {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const allBookings: Array<BookingHistorySnapshot & { spaceId: string; date: string }> = [];

    // Extract all bookings for this lot from all users
    usersSnap.docs.forEach((userDoc) => {
      const user = userDoc.data() as UserDoc;
      const bookingHistoryDetails = user.bookingHistoryDetails ?? {};

      Object.entries(bookingHistoryDetails).forEach(([spaceId, booking]) => {
        // Filter only spaces that belong to this lot (e.g., "L01-01" for "L01")
        if (spaceId.startsWith(`${lotId}-`)) {
          allBookings.push({
            ...booking,
            spaceId,
            date: booking.date ?? "",
          });
        }
      });
    });

    // Group by date and count
    const dateMap = new Map<string, number>();
    allBookings.forEach((booking) => {
      if (booking.date) {
        dateMap.set(booking.date, (dateMap.get(booking.date) ?? 0) + 1);
      }
    });

    // Convert to sorted array
    const dailyBookings = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { dailyBookings, allBookings };
  } catch (error) {
    console.error(`Error fetching actual history for lot ${lotId}:`, error);
    return { dailyBookings: [], allBookings: [] };
  }
}

// Example parking lot data (can be used for reference or future migrations)
// const exampleParkingLot: ParkingLotDoc = {
//   parkingLotId: "P001",
//   name: "חנייה בן גוריון",
//   address: "רחוב בן גוריון 25, תל אביב",
//   location: {
//     lat: 32.0853,
//     lng: 34.7818
//   },
//   demandScore: 5,
//   basePrice: 18,
//   ownerId: 123,
//   createdAt: new Date()
// };
