import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  arrayUnion,
} from "firebase/firestore";

export type SpaceStatus = "available" | "occupied";
export type UserRole = "customer" | "owner" | "admin";

export type ParkingSpaceDoc = {
  parkingSpaceId: string;
  parkingLotId: string;
  status: SpaceStatus;
  dateTime: string; // ISO string
  customerId?: number | null; // מזהה לקוח בלבד
  createdAt?: any;
};

type UserDoc = {
  userId: number;
  name: string;
  role: UserRole;
  bookingHistory?: string[];
  parkingLotId?: string | null;
  parkingSpaceId?: string | null;
  createdAt?: any;
};

const spacesCol = "parkingSpaces";
const usersCol = "users";

export async function createParkingSpace(
  spaceId: string,
  data: ParkingSpaceDoc
) {
  await setDoc(doc(db, spacesCol, spaceId), data, { merge: true });
}

export async function getParkingSpace(spaceId: string) {
  const snap = await getDoc(doc(db, spacesCol, spaceId));
  return snap.exists() ? (snap.data() as ParkingSpaceDoc) : null;
}

export async function updateParkingSpace(
  spaceId: string,
  patch: Partial<ParkingSpaceDoc>
) {
  await updateDoc(doc(db, spacesCol, spaceId), patch as any);
}

export async function setSpaceStatus(spaceId: string, status: SpaceStatus) {
  await updateParkingSpace(spaceId, { status });
}

/**
 * Guarded occupy (space-only transaction):
 * - checks availability
 * - occupies space
 */
export async function assignCustomerToSpace(
  spaceId: string,
  customerId: number,
  dateTimeISO: string = new Date().toISOString()
) {
  const spaceRef = doc(db, spacesCol, spaceId);

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(spaceRef);

    if (!snap.exists()) {
      throw new Error(`Space ${spaceId} not found`);
    }

    const data = snap.data() as ParkingSpaceDoc;

    if (data.status === "occupied") {
      const current = data.customerId ?? "unknown";
      throw new Error(
        `Space ${spaceId} is already occupied (customerId: ${current})`
      );
    }

    tx.update(spaceRef, {
      status: "occupied",
      customerId,
      dateTime: dateTimeISO,
    });

    return { ok: true };
  });
}

/**
 * ✅ Atomic occupy (space + user) in ONE transaction:
 * - validates user exists and role === "customer"
 * - validates space exists and is available
 * - updates space -> occupied + customerId + dateTime
 * - updates user:
 *    - bookingHistory += spaceId (IDs only)
 *    - parkingLotId / parkingSpaceId set to current
 *
 * userDocId is the document ID in /users (e.g. "101")
 */
export async function occupySpaceForCustomer(
  spaceId: string,
  userDocId: string,
  dateTimeISO: string = new Date().toISOString()
) {
  const spaceRef = doc(db, spacesCol, spaceId);
  const userRef = doc(db, usersCol, userDocId);

  return await runTransaction(db, async (tx) => {
    const [spaceSnap, userSnap] = await Promise.all([
      tx.get(spaceRef),
      tx.get(userRef),
    ]);

    if (!spaceSnap.exists()) {
      throw new Error(`Space ${spaceId} not found`);
    }
    if (!userSnap.exists()) {
      throw new Error(`User ${userDocId} not found`);
    }

    const space = spaceSnap.data() as ParkingSpaceDoc;
    const user = userSnap.data() as UserDoc;

    if (user.role !== "customer") {
      throw new Error(`User ${userDocId} is not a customer (role: ${user.role})`);
    }

    if (space.status === "occupied") {
      const current = space.customerId ?? "unknown";
      throw new Error(
        `Space ${spaceId} is already occupied (customerId: ${current})`
      );
    }

    // Update space
    tx.update(spaceRef, {
      status: "occupied",
      customerId: user.userId, // מזהה לקוח (number) מתוך המסמך
      dateTime: dateTimeISO,
    });

    // Update user
    tx.update(userRef, {
      bookingHistory: arrayUnion(spaceId),
      parkingLotId: space.parkingLotId,
      parkingSpaceId: spaceId,
    } as any);

    return { ok: true, customerId: user.userId, parkingLotId: space.parkingLotId };
  });
}

/** Clear a space (make available) */
export async function clearSpace(spaceId: string) {
  await updateParkingSpace(spaceId, {
    status: "available",
    customerId: null,
    dateTime: new Date().toISOString(),
  });
}
