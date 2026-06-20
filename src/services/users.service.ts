import { auth, db } from "../firebase";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

export type UserRole = "customer" | "owner" | "admin";

export type UserBase = {
  userId: number;
  name: string;
  role: UserRole;
  email?: string | null;
  authUid?: string | null;
  licensePlate?: string | null;
  defaultDurationHours?: number;
  defaultSearchRadiusKm?: number;
  defaultArrivalTime?: string;
  notificationsEnabled?: boolean;
  createdAt?: any; // serverTimestamp (optional to keep it simple)
};

export type CustomerFields = {
  customerId?: number | null;
  bookingHistory: string[]; // IDs only
  parkingLotId?: string | null;
  parkingSpaceId?: string | null;
};

export type OwnerFields = {
  parkingLotId: string;
};

export type UserDoc = UserBase & Partial<CustomerFields & OwnerFields>;

const usersCol = "users";

export type UserSettings = {
  displayName: string;
  email: string;
  licensePlate: string;
  defaultDurationHours: number;
  defaultSearchRadiusKm: number;
  defaultArrivalTime: string;
  notificationsEnabled: boolean;
};

const DEFAULT_USER_SETTINGS: UserSettings = {
  displayName: "לקוח GetParking",
  email: "",
  licensePlate: "",
  defaultDurationHours: 2,
  defaultSearchRadiusKm: 1,
  defaultArrivalTime: "09:00",
  notificationsEnabled: true,
};

async function findUserDocIdByEmail(email: string) {
  const matches = await getDocs(query(collection(db, usersCol), where("email", "==", email), limit(1)));

  return matches.empty ? null : matches.docs[0].id;
}

export async function syncAuthenticatedUserRecord() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return "101";
  }

  const email = currentUser.email?.trim() || null;
  const displayName = currentUser.displayName?.trim() || email?.split("@")[0] || "Customer";

  if (email) {
    const emailMatchDocId = await findUserDocIdByEmail(email);

    if (emailMatchDocId) {
      await setDoc(
        doc(db, usersCol, emailMatchDocId),
        {
          email,
          authUid: currentUser.uid,
          name: displayName,
        },
        { merge: true }
      );

      return emailMatchDocId;
    }
  }

  const fallbackUserDocRef = doc(db, usersCol, currentUser.uid);
  const fallbackSnap = await getDoc(fallbackUserDocRef);

  if (!fallbackSnap.exists()) {
    const parsedUserId = Number.parseInt(currentUser.uid, 10);

    await setDoc(
      fallbackUserDocRef,
      {
        userId: Number.isFinite(parsedUserId) ? parsedUserId : Date.now(),
        customerId: Number.isFinite(parsedUserId) ? parsedUserId : null,
        name: displayName,
        role: "customer",
        email,
        authUid: currentUser.uid,
        bookingHistory: [],
        parkingLotId: null,
        parkingSpaceId: null,
      },
      { merge: true }
    );
  } else {
    await setDoc(
      fallbackUserDocRef,
      {
        email,
        authUid: currentUser.uid,
        name: displayName,
      },
      { merge: true }
    );
  }

  return currentUser.uid;
}

export async function createUser(userId: string, data: UserDoc) {
  await setDoc(doc(db, usersCol, userId), data, { merge: true });
}

export async function getUser(userId: string) {
  const snap = await getDoc(doc(db, usersCol, userId));
  return snap.exists() ? (snap.data() as DocumentData) : null;
}

export async function updateUser(userId: string, patch: Partial<UserDoc>) {
  await updateDoc(doc(db, usersCol, userId), patch as any);
}

/** Customer: add a parkingSpaceId to bookingHistory (IDs only) */
export async function addBookingHistoryId(userId: string, spaceId: string) {
  await updateDoc(doc(db, usersCol, userId), {
    bookingHistory: arrayUnion(spaceId),
  } as any);
}

/** Customer: set current linked lot/space */
export async function setCustomerCurrentParking(
  userId: string,
  parkingLotId: string | null,
  parkingSpaceId: string | null
) {
  await updateDoc(doc(db, usersCol, userId), {
    parkingLotId,
    parkingSpaceId,
  } as any);
}

/** Admin: change role (use carefully) */
export async function setUserRole(userId: string, role: UserRole) {
  await updateDoc(doc(db, usersCol, userId), { role } as any);
}

export async function getCurrentBookingUserDocId() {
  return syncAuthenticatedUserRecord();
}

export async function getCurrentUserSettings(): Promise<UserSettings> {
  const userDocId = await getCurrentBookingUserDocId();
  const userSnap = await getDoc(doc(db, usersCol, userDocId));
  const user = userSnap.exists() ? (userSnap.data() as Partial<UserDoc>) : {};

  return {
    displayName: user?.name ?? DEFAULT_USER_SETTINGS.displayName,
    email: user?.email ?? auth.currentUser?.email ?? DEFAULT_USER_SETTINGS.email,
    licensePlate: user?.licensePlate ?? DEFAULT_USER_SETTINGS.licensePlate,
    defaultDurationHours:
      typeof user?.defaultDurationHours === "number"
        ? user.defaultDurationHours
        : DEFAULT_USER_SETTINGS.defaultDurationHours,
    defaultSearchRadiusKm:
      typeof user?.defaultSearchRadiusKm === "number"
        ? user.defaultSearchRadiusKm
        : DEFAULT_USER_SETTINGS.defaultSearchRadiusKm,
    defaultArrivalTime: user?.defaultArrivalTime ?? DEFAULT_USER_SETTINGS.defaultArrivalTime,
    notificationsEnabled:
      typeof user?.notificationsEnabled === "boolean"
        ? user.notificationsEnabled
        : DEFAULT_USER_SETTINGS.notificationsEnabled,
  };
}

export async function updateCurrentUserSettings(
  patch: Partial<UserSettings>
): Promise<void> {
  const userDocId = await getCurrentBookingUserDocId();

  const payload: Partial<UserDoc> = {
    ...(patch.displayName !== undefined ? { name: patch.displayName.trim() || DEFAULT_USER_SETTINGS.displayName } : {}),
    ...(patch.licensePlate !== undefined
      ? { licensePlate: patch.licensePlate.trim().toUpperCase() }
      : {}),
    ...(patch.defaultDurationHours !== undefined
      ? { defaultDurationHours: Number(patch.defaultDurationHours) }
      : {}),
    ...(patch.defaultSearchRadiusKm !== undefined
      ? { defaultSearchRadiusKm: Number(patch.defaultSearchRadiusKm) }
      : {}),
    ...(patch.defaultArrivalTime !== undefined
      ? { defaultArrivalTime: patch.defaultArrivalTime }
      : {}),
    ...(patch.notificationsEnabled !== undefined
      ? { notificationsEnabled: Boolean(patch.notificationsEnabled) }
      : {}),
  };

  await setDoc(doc(db, usersCol, userDocId), payload, { merge: true });
}
