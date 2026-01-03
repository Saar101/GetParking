import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
} from "firebase/firestore";

export type SpaceStatus = "available" | "occupied";

export type ParkingSpaceDoc = {
  parkingSpaceId: string;
  parkingLotId: string;
  status: SpaceStatus;
  dateTime: string; // ISO string
  customerId?: number | null; // מזהה לקוח בלבד
  createdAt?: any;
};

const spacesCol = "parkingSpaces";

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
 * Guarded occupy (transaction):
 * - If space doesn't exist => error
 * - If already occupied => error
 * - Else occupy + set customerId/dateTime
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

/** Clear a space (make available) */
export async function clearSpace(spaceId: string) {
  await updateParkingSpace(spaceId, {
    status: "available",
    customerId: null,
    dateTime: new Date().toISOString(),
  });
}
