import { db } from "../firebase";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  runTransaction,
  arrayUnion,
} from "firebase/firestore";
import { getCurrentBookingUserDocId } from "./users.service";

export type SpaceStatus = "available" | "occupied" | "reserved";
export type UserRole = "customer" | "owner" | "admin";

export type ParkingReservationDoc = {
  date: string;
  startTime: string;
  durationHours: number;
  reservedFrom: string;
  reservedUntil: string;
  customerId?: number | null;
  reservedByUserDocId?: string | null;
  createdAt?: any;
};

export type ParkingSpaceDoc = {
  parkingSpaceId: string;
  parkingLotId: string;
  status: SpaceStatus;
  dateTime: string; // ISO string
  customerId?: number | null; // מזהה לקוח בלבד
  reservation?: ParkingReservationDoc | null;
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

export async function getAvailableParkingSpacesForLot(lotId: string) {
  const snap = await getDocs(collection(db, spacesCol));
  return snap.docs
    .map((spaceDoc) => ({
      id: spaceDoc.id,
      ...(spaceDoc.data() as ParkingSpaceDoc),
    }))
    .filter((space) => space.parkingLotId === lotId && space.status === "available")
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function getFirstAvailableParkingSpaceForLot(lotId: string) {
  const availableSpaces = await getAvailableParkingSpacesForLot(lotId);

  if (availableSpaces.length === 0) {
    return null;
  }

  return {
    ...availableSpaces[0],
  };
}

export async function resetAllParkingSpacesToAvailable() {
  const snap = await getDocs(collection(db, spacesCol));

  await Promise.all(
    snap.docs.map((spaceDoc) =>
      updateDoc(doc(db, spacesCol, spaceDoc.id), {
        status: "available",
        customerId: null,
        reservation: null,
        dateTime: new Date().toISOString(),
      } as any)
    )
  );

  return { ok: true, count: snap.docs.length };
}

function buildReservationWindow(date: string, startTime: string, durationHours: number) {
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  return {
    reservedFrom: start.toISOString(),
    reservedUntil: end.toISOString(),
  };
}

function hasTimeOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
) {
  const leftStartTime = new Date(leftStart).getTime();
  const leftEndTime = new Date(leftEnd).getTime();
  const rightStartTime = new Date(rightStart).getTime();
  const rightEndTime = new Date(rightEnd).getTime();

  return leftStartTime < rightEndTime && rightStartTime < leftEndTime;
}

export async function reserveParkingSpaceForCustomer(
  spaceId: string,
  reservation: {
    date: string;
    startTime: string;
    durationHours: number;
    customerId?: number | null;
    userDocId?: string | null;
  }
) {
  const spaceRef = doc(db, spacesCol, spaceId);
  const bookingUserDocId = reservation.userDocId ?? (await getCurrentBookingUserDocId());

  return await runTransaction(db, async (tx) => {
    const spaceSnap = await tx.get(spaceRef);

    if (!spaceSnap.exists()) {
      throw new Error(`Space ${spaceId} not found`);
    }

    const space = spaceSnap.data() as ParkingSpaceDoc;

    if (space.status === "reserved" || space.status === "occupied") {
      throw new Error(`Space ${spaceId} is already reserved or occupied`);
    }

    const reservationWindow = buildReservationWindow(
      reservation.date,
      reservation.startTime,
      reservation.durationHours
    );

    if (
      space.reservation &&
      hasTimeOverlap(
        space.reservation.reservedFrom,
        space.reservation.reservedUntil,
        reservationWindow.reservedFrom,
        reservationWindow.reservedUntil
      )
    ) {
      throw new Error(`Space ${spaceId} has an overlapping reservation`);
    }

    const userRef = doc(db, usersCol, bookingUserDocId);
    const userSnap = await tx.get(userRef);
    const user = userSnap.exists() ? (userSnap.data() as any) : null;
    const parsedBookingUserDocId = Number.parseInt(bookingUserDocId, 10);
    const numericCustomerId =
      reservation.customerId ??
      user?.customerId ??
      user?.userId ??
      (Number.isFinite(parsedBookingUserDocId) ? parsedBookingUserDocId : null);

    tx.update(spaceRef, {
      status: "reserved",
      customerId: numericCustomerId,
      dateTime: new Date().toISOString(),
      reservation: {
        date: reservation.date,
        startTime: reservation.startTime,
        durationHours: reservation.durationHours,
        ...reservationWindow,
        customerId: numericCustomerId,
        reservedByUserDocId: bookingUserDocId,
        createdAt: new Date().toISOString(),
      },
    } as any);

    const parkingLotRef = doc(db, "parkingLots", space.parkingLotId);

    tx.update(parkingLotRef, {
      customerId: numericCustomerId,
      parkingSpaceId: spaceId,
      dateTime: new Date().toISOString(),
    } as any);

    if (userSnap.exists()) {
      tx.update(userRef, {
        customerId: numericCustomerId,
        parkingLotId: space.parkingLotId,
        parkingSpaceId: spaceId,
        bookingHistory: arrayUnion(spaceId),
      } as any);
    } else {
      tx.set(
        userRef,
        {
          userId: numericCustomerId,
          customerId: numericCustomerId,
          parkingLotId: space.parkingLotId,
          parkingSpaceId: spaceId,
          bookingHistory: [spaceId],
        },
        { merge: true }
      );
    }

    return { ok: true, spaceId, reservation: { ...reservation, ...reservationWindow } };
  });
}

export async function reserveFirstAvailableParkingSpaceForCustomer(
  lotId: string,
  reservation: {
    date: string;
    startTime: string;
    durationHours: number;
    customerId?: number | null;
    userDocId?: string | null;
  }
) {
  const availableSpaces = await getAvailableParkingSpacesForLot(lotId);

  if (availableSpaces.length === 0) {
    throw new Error(`No available parking spaces found for lot ${lotId}`);
  }

  for (const availableSpace of availableSpaces) {
    try {
      const result = await reserveParkingSpaceForCustomer(availableSpace.id, reservation);

      return {
        ...result,
        spaceId: availableSpace.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("overlapping reservation")) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`No available parking spaces found for lot ${lotId}`);
}

export async function releaseParkingSpaceReservation(
  spaceId: string,
  userDocId?: string | null
) {
  const spaceRef = doc(db, spacesCol, spaceId);
  const bookingUserDocId = userDocId ?? (await getCurrentBookingUserDocId());
  const userRef = doc(db, usersCol, bookingUserDocId);

  return await runTransaction(db, async (tx) => {
    const spaceSnap = await tx.get(spaceRef);

    if (!spaceSnap.exists()) {
      throw new Error(`Space ${spaceId} not found`);
    }

    const space = spaceSnap.data() as ParkingSpaceDoc;

    tx.update(spaceRef, {
      status: "available",
      customerId: null,
      reservation: null,
      dateTime: new Date().toISOString(),
    } as any);

    tx.update(doc(db, "parkingLots", space.parkingLotId), {
      customerId: null,
      parkingSpaceId: null,
      dateTime: new Date().toISOString(),
    } as any);

    tx.set(
      userRef,
      {
        customerId: null,
        parkingLotId: null,
        parkingSpaceId: null,
      },
      { merge: true }
    );

    return { ok: true, releasedSpaceId: spaceId, parkingLotId: space.parkingLotId };
  });
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
