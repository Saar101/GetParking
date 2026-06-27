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
  onSnapshot,
  query,
  where,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { getCurrentBookingUserDocId, type BookingHistorySnapshot } from "./users.service";

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
  spotType?: string | null;
  floorId?: string | null;
  floorName?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  sensorId?: string | null;
  externalStatus?: string | null;
  outOfServiceReason?: string | null;
  lastChangedAt?: string | null;
  charger?: {
    connectorType?: string | null;
    powerKw?: number | null;
    isCharging?: boolean | null;
  } | null;
  reservedFor?: string | null;
  externalSource?: string | null;
  createdAt?: any;
};

type ParkingLotSyncSpot = {
  spotId?: string;
  type?: string;
  status?: string;
  sensorId?: string;
  reason?: string;
  lastChangedAt?: string;
  reservedFor?: string;
  charger?: {
    connectorType?: string;
    powerKw?: number;
    isCharging?: boolean;
  };
};

type ParkingLotSyncSection = {
  sectionId?: string;
  name?: string;
  spots?: ParkingLotSyncSpot[];
};

type ParkingLotSyncFloor = {
  floorId?: string;
  name?: string;
  sections?: ParkingLotSyncSection[];
};

type ParkingLotSyncPayload = {
  parkingLot?: {
    id?: string;
    liveAvailability?: {
      dataSource?: string;
    };
    floors?: ParkingLotSyncFloor[];
  };
};

export type ParkingLotSyncSummary = {
  totalSpacesInFile: number;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  syncedCount: number;
};

type ParkingLotSyncOptions = {
  replaceExisting?: boolean;
};

function normalizeImportedSpaceStatus(status: string | undefined): SpaceStatus {
  if (status === "available") {
    return "available";
  }

  if (status === "reserved") {
    return "reserved";
  }

  return "occupied";
}

function flattenParkingLotSyncSpots(payload: ParkingLotSyncPayload) {
  const floors = Array.isArray(payload.parkingLot?.floors) ? payload.parkingLot?.floors : [];
  const externalSource = payload.parkingLot?.liveAvailability?.dataSource ?? null;
  const flattened: Array<{
    spotId: string;
    data: Omit<ParkingSpaceDoc, "parkingLotId" | "parkingSpaceId" | "createdAt">;
  }> = [];

  for (const floor of floors) {
    const sections = Array.isArray(floor.sections) ? floor.sections : [];

    for (const section of sections) {
      const spots = Array.isArray(section.spots) ? section.spots : [];

      for (const spot of spots) {
        const spotId = String(spot.spotId ?? "").trim();

        if (!spotId) {
          continue;
        }

        flattened.push({
          spotId,
          data: {
            status: normalizeImportedSpaceStatus(spot.status),
            dateTime: spot.lastChangedAt ?? new Date().toISOString(),
            customerId: null,
            reservation: null,
            spotType: spot.type ?? null,
            floorId: floor.floorId ?? null,
            floorName: floor.name ?? null,
            sectionId: section.sectionId ?? null,
            sectionName: section.name ?? null,
            sensorId: spot.sensorId ?? null,
            externalStatus: spot.status ?? null,
            outOfServiceReason: spot.reason ?? null,
            lastChangedAt: spot.lastChangedAt ?? null,
            charger: spot.charger
              ? {
                  connectorType: spot.charger.connectorType ?? null,
                  powerKw: typeof spot.charger.powerKw === "number" ? spot.charger.powerKw : null,
                  isCharging: typeof spot.charger.isCharging === "boolean" ? spot.charger.isCharging : null,
                }
              : null,
            reservedFor: spot.reservedFor ?? null,
            externalSource,
          },
        });
      }
    }
  }

  return flattened;
}

export async function syncParkingSpacesFromJson(
  parkingLotId: string,
  payload: ParkingLotSyncPayload,
  options: ParkingLotSyncOptions = {}
): Promise<ParkingLotSyncSummary> {
  const normalizedLotId = parkingLotId.trim();
  const replaceExisting = options.replaceExisting === true;

  if (!normalizedLotId) {
    throw new Error("חסר מזהה חניון לסנכרון.");
  }

  const flattenedSpots = flattenParkingLotSyncSpots(payload);

  if (!flattenedSpots.length) {
    throw new Error("הקובץ לא מכיל מקומות חנייה בפורמט נתמך.");
  }

  const existingSnapshot = await getDocs(query(collection(db, spacesCol), where("parkingLotId", "==", normalizedLotId)));
  const existingIds = new Set(existingSnapshot.docs.map((spaceDoc) => spaceDoc.id));
  const importedIds = new Set(flattenedSpots.map((spot) => spot.spotId));

  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  for (let start = 0; start < flattenedSpots.length; start += 400) {
    const batch = writeBatch(db);
    const currentChunk = flattenedSpots.slice(start, start + 400);

    for (const spot of currentChunk) {
      const spaceRef = doc(db, spacesCol, spot.spotId);
      batch.set(
        spaceRef,
        {
          parkingSpaceId: spot.spotId,
          parkingLotId: normalizedLotId,
          ...spot.data,
        } satisfies ParkingSpaceDoc,
        { merge: true }
      );

      if (existingIds.has(spot.spotId)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    await batch.commit();
  }

  if (replaceExisting) {
    const staleDocs = existingSnapshot.docs.filter((spaceDoc) => !importedIds.has(spaceDoc.id));

    for (const staleDoc of staleDocs) {
      await deleteDoc(doc(db, spacesCol, staleDoc.id));
      deletedCount += 1;
    }
  }

  return {
    totalSpacesInFile: flattenedSpots.length,
    createdCount,
    updatedCount,
    deletedCount,
    syncedCount: flattenedSpots.length,
  };
}

export type UserBookingRow = {
  spaceId: string;
  lotId: string;
  lotName: string;
  lotAddress: string;
  date: string | null;
  startTime: string | null;
  durationHours: number | null;
  reservedFrom: string | null;
  reservedUntil: string | null;
  status: "future" | "active" | "past";
  source: "reservation" | "history";
  historyOutcome: "cancelled" | "ended" | null;
};

type ParkingLotDoc = {
  ownerId?: number | null;
};

type UserDoc = {
  userId: number;
  name: string;
  role: UserRole;
  bookingHistory?: string[];
  bookingHistoryDetails?: Record<string, BookingHistorySnapshot>;
  parkingLotId?: string | null; // לבעל חניון
  parkingLotIds?: string[] | null;
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

export async function listParkingSpaces() {
  const snap = await getDocs(collection(db, spacesCol));

  return snap.docs.map((spaceDoc) => ({
    id: spaceDoc.id,
    ...(spaceDoc.data() as ParkingSpaceDoc),
  }));
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
    .filter((space) => {
      if (space.parkingLotId !== lotId || space.status === "occupied") {
        return false;
      }

      if (space.status === "available") {
        return true;
      }

      if (space.status === "reserved") {
        return resolveBookingStatus(space.reservation?.reservedFrom ?? null, space.reservation?.reservedUntil ?? null) === "past";
      }

      return false;
    })
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

    if (space.status === "occupied") {
      throw new Error(`Space ${spaceId} is already reserved or occupied`);
    }

    if (
      space.status === "reserved" &&
      resolveBookingStatus(space.reservation?.reservedFrom ?? null, space.reservation?.reservedUntil ?? null) !== "past"
    ) {
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
    const userSnap = await tx.get(userRef);

    if (!spaceSnap.exists()) {
      throw new Error(`Space ${spaceId} not found`);
    }

    const space = spaceSnap.data() as ParkingSpaceDoc;
    const currentReservation = space.reservation;
    const userData = userSnap.exists() ? (userSnap.data() as UserDoc) : null;
    const bookingHistoryDetails = userData?.bookingHistoryDetails ?? {};

    const reservationSnapshot: BookingHistorySnapshot | null = currentReservation
      ? {
          date: currentReservation.date,
          startTime: currentReservation.startTime,
          durationHours: currentReservation.durationHours,
          reservedFrom: currentReservation.reservedFrom,
          reservedUntil: currentReservation.reservedUntil,
          endReason: "cancelled",
          endedAt: new Date().toISOString(),
        }
      : null;

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
        ...(reservationSnapshot
          ? {
              bookingHistoryDetails: {
                ...bookingHistoryDetails,
                [`${spaceId}__${reservationSnapshot.endedAt ?? new Date().toISOString()}`]: reservationSnapshot,
              },
            }
          : {}),
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
    const lotSnap = await tx.get(doc(db, "parkingLots", space.parkingLotId));
    const lot = lotSnap.exists() ? (lotSnap.data() as ParkingLotDoc) : null;

    const isAdmin = actor.role === "admin";
    const ownsLotByLotOwner = actor.role === "owner" && lot?.ownerId === actor.userId;
    const ownsLotByPrimaryLot = actor.role === "owner" && actor.parkingLotId === space.parkingLotId;
    const ownsLotByAssignedLots =
      actor.role === "owner" && Array.isArray(actor.parkingLotIds) && actor.parkingLotIds.includes(space.parkingLotId);
    const ownsLot = ownsLotByLotOwner || ownsLotByPrimaryLot || ownsLotByAssignedLots;

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

function resolveBookingStatus(reservedFrom: string | null, reservedUntil: string | null): "future" | "active" | "past" {
  if (!reservedFrom || !reservedUntil) {
    return "past";
  }

  const now = Date.now();
  const start = new Date(reservedFrom).getTime();
  const end = new Date(reservedUntil).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "past";
  }

  if (start > now) {
    return "future";
  }

  if (start <= now && end >= now) {
    return "active";
  }

  return "past";
}

function extractHistorySpaceId(historyKey: string) {
  return historyKey.split("__")[0] ?? historyKey;
}

export async function listUserBookings(userDocId?: string): Promise<UserBookingRow[]> {
  const resolvedUserDocId = userDocId ?? (await getCurrentBookingUserDocId());
  const userSnap = await getDoc(doc(db, usersCol, resolvedUserDocId));
  const userData = userSnap.exists()
    ? (userSnap.data() as {
        bookingHistory?: string[];
        bookingHistoryDetails?: Record<string, BookingHistorySnapshot>;
      })
    : null;
  const bookingHistory = Array.isArray(userData?.bookingHistory) ? userData!.bookingHistory : [];
  const bookingHistoryDetails = userData?.bookingHistoryDetails ?? {};

  const [spacesSnap, lotsSnap] = await Promise.all([
    getDocs(collection(db, spacesCol)),
    getDocs(collection(db, "parkingLots")),
  ]);

  const lotById = new Map(
    lotsSnap.docs.map((lotDoc) => {
      const data = lotDoc.data() as { name?: string; address?: string };
      return [
        lotDoc.id,
        {
          name: data.name ?? lotDoc.id,
          address: data.address ?? "",
        },
      ];
    })
  );

  const rows: UserBookingRow[] = [];

  Object.entries(bookingHistoryDetails).forEach(([historyKey, historySnapshot]) => {
    const spaceId = extractHistorySpaceId(historyKey);
    const lotId = spaceId.includes("-") ? spaceId.split("-")[0] : spaceId;
    const lotMeta = lotById.get(lotId);

    rows.push({
      spaceId,
      lotId,
      lotName: lotMeta?.name ?? lotId,
      lotAddress: lotMeta?.address ?? "",
      date: historySnapshot.date ?? null,
      startTime: historySnapshot.startTime ?? null,
      durationHours: historySnapshot.durationHours ?? null,
      reservedFrom: historySnapshot.reservedFrom ?? null,
      reservedUntil: historySnapshot.reservedUntil ?? null,
      status: "past",
      source: "history",
      historyOutcome: historySnapshot.endReason ?? null,
    });
  });

  for (const spaceDoc of spacesSnap.docs) {
    const spaceId = spaceDoc.id;
    const space = spaceDoc.data() as ParkingSpaceDoc;
    const reservation = space.reservation;
    const lotMeta = lotById.get(space.parkingLotId);
    const inHistory = bookingHistory.includes(spaceId);
    const belongsToUserReservation = reservation?.reservedByUserDocId === resolvedUserDocId;
    if (!inHistory && !belongsToUserReservation) {
      continue;
    }

    if (!reservation) {
      continue;
    }

    const row: UserBookingRow = {
      spaceId,
      lotId: space.parkingLotId,
      lotName: lotMeta?.name ?? space.parkingLotId,
      lotAddress: lotMeta?.address ?? "",
      date: reservation.date ?? null,
      startTime: reservation.startTime ?? null,
      durationHours: reservation.durationHours ?? null,
      reservedFrom: reservation.reservedFrom ?? null,
      reservedUntil: reservation.reservedUntil ?? null,
      status: resolveBookingStatus(reservation.reservedFrom, reservation.reservedUntil),
      source: belongsToUserReservation ? "reservation" : "history",
      historyOutcome: resolveBookingStatus(reservation.reservedFrom, reservation.reservedUntil) === "past" ? "ended" : null,
    };

    rows.push(row);
  }
  const statusRank = { active: 0, future: 1, past: 2 } as const;

  rows.sort((left, right) => {
    const rankDiff = statusRank[left.status] - statusRank[right.status];

    if (rankDiff !== 0) {
      return rankDiff;
    }

    const leftTime = new Date(left.reservedFrom ?? left.reservedUntil ?? 0).getTime();
    const rightTime = new Date(right.reservedFrom ?? right.reservedUntil ?? 0).getTime();

    if (left.status === "past") {
      return rightTime - leftTime;
    }

    return leftTime - rightTime;
  });

  return rows;
}

/**
 * Subscribe to real-time updates for parking spaces
 * Useful for owner dashboard to see reservation changes in real-time
 */
export function subscribeToRealtimeParkingSpaces(
  onUpdate: (spaces: ParkingSpaceDoc[]) => void,
  onError?: (error: Error) => void
): () => void {
  const unsubscribe = onSnapshot(
    query(collection(db, spacesCol)),
    (snapshot) => {
      const spaces: ParkingSpaceDoc[] = [];
      snapshot.docs.forEach((doc) => {
        if (doc.exists()) {
          spaces.push({ id: doc.id, ...doc.data() } as ParkingSpaceDoc);
        }
      });
      onUpdate(spaces);
    },
    (error) => {
      console.error("Error subscribing to parking spaces:", error);
      onError?.(error as Error);
    }
  );

  return unsubscribe;
}

/**
 * Subscribe to real-time updates for parking lots
 * Useful for owner dashboard to see lot stats changes
 */
export function subscribeToRealtimeParkingLots(
  onUpdate: (lots: Array<{ id: string; [key: string]: any }>) => void,
  onError?: (error: Error) => void
): () => void {
  const unsubscribe = onSnapshot(
    query(collection(db, "parkingLots")),
    (snapshot) => {
      const lots: Array<{ id: string; [key: string]: any }> = [];
      snapshot.docs.forEach((doc) => {
        if (doc.exists()) {
          lots.push({ id: doc.id, ...doc.data() });
        }
      });
      onUpdate(lots);
    },
    (error) => {
      console.error("Error subscribing to parking lots:", error);
      onError?.(error as Error);
    }
  );

  return unsubscribe;
}
