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
  parkingLotId?: string | null; // לבעל חניון
  parkingSpaceId?: string | null; // ללקוח (לא חובה כאן)
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

/**
 * ✅ ONLY Owner/Admin can manually edit a space status (mock permissions for now)
 * actorUserDocId = doc id in /users (e.g. "201" owner, "1" admin)
 */
export async function setSpaceStatusByOwnerOrAdmin(
  spaceId: string,
  actorUserDocId: string,
  status: SpaceStatus,
  customerId: number | null = null
) {
  const spaceRef = doc(db, spacesCol, spaceId);
  const actorRef = doc(db, usersCol, actorUserDocId);

  return await runTransaction(db, async (tx) => {
    const [spaceSnap, actorSnap] = await Promise.all([
      tx.get(spaceRef),
      tx.get(actorRef),
    ]);

    if (!spaceSnap.exists()) throw new Error(`Space ${spaceId} not found`);
    if (!actorSnap.exists()) throw new Error(`User ${actorUserDocId} not found`);

    const space = spaceSnap.data() as ParkingSpaceDoc;
    const actor = actorSnap.data() as UserDoc;

    const isAdmin = actor.role === "admin";
    const ownsLot = actor.role === "owner" && actor.parkingLotId === space.parkingLotId;

    if (!isAdmin && !ownsLot) {
      throw new Error("Not allowed: only owner of this lot or admin can edit space status");
    }

    tx.update(spaceRef, {
      status,
      customerId: status === "occupied" ? customerId : null,
      dateTime: new Date().toISOString(),
    });

    return { ok: true };
  });
}

/**
 * ✅ Customer occupy (atomic: space + user) in ONE transaction
 * userDocId = doc id in /users (e.g. "101")
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

    if (!spaceSnap.exists()) throw new Error(`Space ${spaceId} not found`);
    if (!userSnap.exists()) throw new Error(`User ${userDocId} not found`);

    const space = spaceSnap.data() as ParkingSpaceDoc;
    const user = userSnap.data() as UserDoc;

    if (user.role !== "customer") {
      throw new Error(`User ${userDocId} is not a customer (role: ${user.role})`);
    }

    if (space.status === "occupied") {
      const current = space.customerId ?? "unknown";
      throw new Error(`Space ${spaceId} is already occupied (customerId: ${current})`);
    }

    // update space
    tx.update(spaceRef, {
      status: "occupied",
      customerId: user.userId,
      dateTime: dateTimeISO,
    });

    // update user
    tx.update(userRef, {
      bookingHistory: arrayUnion(spaceId),
      parkingLotId: space.parkingLotId,
      parkingSpaceId: spaceId,
    } as any);

    return { ok: true };
  });
}

/** Clear a space (still simple for now) */
export async function clearSpace(spaceId: string) {
  await updateParkingSpace(spaceId, {
    status: "available",
    customerId: null,
    dateTime: new Date().toISOString(),
  });
}
