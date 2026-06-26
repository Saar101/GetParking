import { auth, db } from "../firebase";
import {
  arrayUnion,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

export type UserRole = "customer" | "owner" | "admin";

export type BookingHistorySnapshot = {
  date: string;
  startTime: string;
  durationHours: number;
  reservedFrom: string;
  reservedUntil: string;
  endReason: "cancelled" | "ended";
  endedAt?: string;
};

export type UserBase = {
  userId: number;
  name: string;
  role: UserRole;
  email?: string | null;
  phoneNumber?: string | null;
  authUid?: string | null;
  licensePlate?: string | null;
  defaultDurationHours?: number;
  defaultSearchRadiusKm?: number;
  defaultArrivalTime?: string;
  defaultArrivalTimeUsesCurrentTime?: boolean;
  notificationsEnabled?: boolean;
  bookingHistoryDetails?: Record<string, BookingHistorySnapshot>;
  favoriteParkingLotIds?: string[];
  createdAt?: any; // serverTimestamp (optional to keep it simple)
  lastSeenAt?: string | null;
  isDisabled?: boolean;
  disabledAt?: string | null;
};

export type CustomerFields = {
  customerId?: number | null;
  bookingHistory: string[]; // IDs only
  parkingLotId?: string | null;
  parkingSpaceId?: string | null;
};

export type OwnerFields = {
  parkingLotId: string;
  parkingLotIds?: string[];
};

export type UserDoc = UserBase & Partial<CustomerFields & OwnerFields>;

const usersCol = "users";

export type UserSettings = {
  displayName: string;
  email: string;
  phoneNumber: string;
  licensePlate: string;
  defaultDurationHours: number;
  defaultSearchRadiusKm: number;
  defaultArrivalTime: string;
  defaultArrivalTimeUsesCurrentTime: boolean;
  notificationsEnabled: boolean;
};

function getCurrentTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getDefaultArrivalTime(): string {
  return getCurrentTime();
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  displayName: "לקוח GetParking",
  email: "",
  phoneNumber: "",
  licensePlate: "",
  defaultDurationHours: 2,
  defaultSearchRadiusKm: 250,
  defaultArrivalTime: getDefaultArrivalTime(),
  defaultArrivalTimeUsesCurrentTime: true,
  notificationsEnabled: true,
};

async function findUserDocIdByEmail(email: string) {
  const matches = await getDocs(query(collection(db, usersCol), where("email", "==", email), limit(1)));

  return matches.empty ? null : matches.docs[0].id;
}

export async function syncAuthenticatedUserRecord() {
  const currentUser = auth.currentUser;
  const lastSeenAt = toIsoNow();

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
          lastSeenAt,
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
        lastSeenAt,
        bookingHistory: [],
        bookingHistoryDetails: {},
        favoriteParkingLotIds: [],
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
        lastSeenAt,
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

export type UserListItem = UserDoc & { id: string };

export type ActivityRoleFilter = "customer" | "owner" | "both";

export type ActivityTimeFilter = "24h" | "7d" | "30d" | "90d" | "1y";

export type RecentActivityBucket = {
  key: string;
  label: string;
  minutes: number;
  count: number;
};

export type RecentActivityUser = {
  id: string;
  name: string;
  email: string | null;
  role: Extract<UserRole, "customer" | "owner">;
  lastSeenAt: string;
};

export type RecentUserActivitySummary = {
  roleFilter: ActivityRoleFilter;
  timeFilter: ActivityTimeFilter;
  totalMatchingUsers: number;
  usersWithActivity: number;
  buckets: RecentActivityBucket[];
  recentUsers: RecentActivityUser[];
};

const ACTIVITY_TIME_FILTER_PRESETS: Record<
  ActivityTimeFilter,
  {
    maxMinutes: number;
    buckets: RecentActivityBucket[];
  }
> = {
  "24h": {
    maxMinutes: 24 * 60,
    buckets: [
      { key: "15m", label: "15 דקות", minutes: 15, count: 0 },
      { key: "1h", label: "שעה", minutes: 60, count: 0 },
      { key: "6h", label: "6 שעות", minutes: 6 * 60, count: 0 },
      { key: "24h", label: "24 שעות", minutes: 24 * 60, count: 0 },
    ],
  },
  "7d": {
    maxMinutes: 7 * 24 * 60,
    buckets: [
      { key: "24h", label: "24 שעות", minutes: 24 * 60, count: 0 },
      { key: "3d", label: "3 ימים", minutes: 3 * 24 * 60, count: 0 },
      { key: "5d", label: "5 ימים", minutes: 5 * 24 * 60, count: 0 },
      { key: "7d", label: "7 ימים", minutes: 7 * 24 * 60, count: 0 },
    ],
  },
  "30d": {
    maxMinutes: 30 * 24 * 60,
    buckets: [
      { key: "7d", label: "7 ימים", minutes: 7 * 24 * 60, count: 0 },
      { key: "14d", label: "14 ימים", minutes: 14 * 24 * 60, count: 0 },
      { key: "21d", label: "21 ימים", minutes: 21 * 24 * 60, count: 0 },
      { key: "30d", label: "30 ימים", minutes: 30 * 24 * 60, count: 0 },
    ],
  },
  "90d": {
    maxMinutes: 90 * 24 * 60,
    buckets: [
      { key: "30d", label: "30 ימים", minutes: 30 * 24 * 60, count: 0 },
      { key: "60d", label: "60 ימים", minutes: 60 * 24 * 60, count: 0 },
      { key: "75d", label: "75 ימים", minutes: 75 * 24 * 60, count: 0 },
      { key: "90d", label: "90 ימים", minutes: 90 * 24 * 60, count: 0 },
    ],
  },
  "1y": {
    maxMinutes: 365 * 24 * 60,
    buckets: [
      { key: "3m", label: "3 חודשים", minutes: 90 * 24 * 60, count: 0 },
      { key: "6m", label: "6 חודשים", minutes: 180 * 24 * 60, count: 0 },
      { key: "9m", label: "9 חודשים", minutes: 270 * 24 * 60, count: 0 },
      { key: "1y", label: "שנה", minutes: 365 * 24 * 60, count: 0 },
    ],
  },
};

function toIsoNow() {
  return new Date().toISOString();
}

function isTrackedActivityRole(role: UserRole | undefined): role is Extract<UserRole, "customer" | "owner"> {
  return role === "customer" || role === "owner";
}

function matchesActivityRoleFilter(role: UserRole | undefined, filter: ActivityRoleFilter) {
  if (!isTrackedActivityRole(role)) {
    return false;
  }

  if (filter === "both") {
    return true;
  }

  return role === filter;
}

export async function listUsers(): Promise<UserListItem[]> {
  const snap = await getDocs(collection(db, usersCol));

  return snap.docs.map((userDoc) => ({
    id: userDoc.id,
    ...(userDoc.data() as UserDoc),
  }));
}

export function subscribeToRealtimeUsers(
  onUpdate: (users: UserListItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  const unsubscribe = onSnapshot(
    query(collection(db, usersCol)),
    (snapshot) => {
      const users: UserListItem[] = snapshot.docs.map((userDoc) => ({
        id: userDoc.id,
        ...(userDoc.data() as UserDoc),
      }));

      onUpdate(users);
    },
    (error) => {
      console.error("Error subscribing to users:", error);
      onError?.(error as Error);
    }
  );

  return unsubscribe;
}

export function buildRecentUserActivitySummary(
  users: UserListItem[],
  roleFilter: ActivityRoleFilter = "both",
  timeFilter: ActivityTimeFilter = "7d"
): RecentUserActivitySummary {
  const now = Date.now();
  const selectedPreset = ACTIVITY_TIME_FILTER_PRESETS[timeFilter];
  const matchingUsers = users.filter((user) => matchesActivityRoleFilter(user.role, roleFilter));

  const recentUsersWithActivity = matchingUsers
    .map((user) => {
      const rawLastSeen = typeof user.lastSeenAt === "string" ? user.lastSeenAt : null;
      const lastSeenMs = rawLastSeen ? new Date(rawLastSeen).getTime() : Number.NaN;

      if (!rawLastSeen || Number.isNaN(lastSeenMs) || !isTrackedActivityRole(user.role)) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email ?? null,
        role: user.role,
        lastSeenAt: rawLastSeen,
        lastSeenMs,
      };
    })
    .filter((user): user is RecentActivityUser & { lastSeenMs: number } => Boolean(user))
    .sort((left, right) => right.lastSeenMs - left.lastSeenMs);

  const filteredRecentUsers = recentUsersWithActivity.filter(
    (user) => now - user.lastSeenMs <= selectedPreset.maxMinutes * 60 * 1000
  );

  const buckets = selectedPreset.buckets.map((bucket) => ({
    ...bucket,
    count: recentUsersWithActivity.filter((user) => now - user.lastSeenMs <= bucket.minutes * 60 * 1000).length,
  }));

  return {
    roleFilter,
    timeFilter,
    totalMatchingUsers: matchingUsers.length,
    usersWithActivity: filteredRecentUsers.length,
    buckets,
    recentUsers: filteredRecentUsers.slice(0, 12).map(({ lastSeenMs, ...user }) => user),
  };
}

export async function getRecentUserActivitySummary(
  roleFilter: ActivityRoleFilter = "both",
  timeFilter: ActivityTimeFilter = "7d"
): Promise<RecentUserActivitySummary> {
  const users = await listUsers();
  return buildRecentUserActivitySummary(users, roleFilter, timeFilter);
}

export async function updateUser(userId: string, patch: Partial<UserDoc>) {
  await updateDoc(doc(db, usersCol, userId), patch as any);
}

export async function deleteUserRecord(userId: string) {
  await deleteDoc(doc(db, usersCol, userId));
}

export async function disableUserRecord(userId: string) {
  await updateDoc(doc(db, usersCol, userId), {
    isDisabled: true,
    disabledAt: toIsoNow(),
  } as any);
}

export async function enableUserRecord(userId: string) {
  await updateDoc(doc(db, usersCol, userId), {
    isDisabled: false,
    disabledAt: null,
  } as any);
}

/** Customer: add a parkingSpaceId to bookingHistory (IDs only) */
export async function addBookingHistoryId(userId: string, spaceId: string) {
  await updateDoc(doc(db, usersCol, userId), {
    bookingHistory: arrayUnion(spaceId),
  } as any);
}

export async function addFavoriteParkingLotId(userId: string, lotId: string) {
  await updateDoc(doc(db, usersCol, userId), {
    favoriteParkingLotIds: arrayUnion(lotId),
  } as any);
}

export async function removeFavoriteParkingLotId(userId: string, lotId: string) {
  await updateDoc(doc(db, usersCol, userId), {
    favoriteParkingLotIds: arrayRemove(lotId),
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

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const userDocId = await getCurrentBookingUserDocId();
  const userSnap = await getDoc(doc(db, usersCol, userDocId));

  if (!userSnap.exists()) {
    return null;
  }

  const user = userSnap.data() as Partial<UserDoc>;

  if (user.isDisabled) {
    throw new Error("USER_DISABLED");
  }

  return user.role ?? null;
}

export async function getCurrentUserSettings(): Promise<UserSettings> {
  const userDocId = await getCurrentBookingUserDocId();
  const userSnap = await getDoc(doc(db, usersCol, userDocId));
  const user = userSnap.exists() ? (userSnap.data() as Partial<UserDoc>) : {};
  const storedSearchRadius = user?.defaultSearchRadiusKm;
  const defaultSearchRadiusKm =
    typeof storedSearchRadius === "number"
      ? storedSearchRadius <= 20
        ? storedSearchRadius * 1000
        : storedSearchRadius
      : DEFAULT_USER_SETTINGS.defaultSearchRadiusKm;

  return {
    displayName: user?.name ?? DEFAULT_USER_SETTINGS.displayName,
    email: user?.email ?? auth.currentUser?.email ?? DEFAULT_USER_SETTINGS.email,
    phoneNumber: user?.phoneNumber ?? DEFAULT_USER_SETTINGS.phoneNumber,
    licensePlate: user?.licensePlate ?? DEFAULT_USER_SETTINGS.licensePlate,
    defaultDurationHours:
      typeof user?.defaultDurationHours === "number"
        ? user.defaultDurationHours
        : DEFAULT_USER_SETTINGS.defaultDurationHours,
    defaultSearchRadiusKm,
    defaultArrivalTime: user?.defaultArrivalTime ?? getDefaultArrivalTime(),
    defaultArrivalTimeUsesCurrentTime:
      typeof user?.defaultArrivalTimeUsesCurrentTime === "boolean"
        ? user.defaultArrivalTimeUsesCurrentTime
        : DEFAULT_USER_SETTINGS.defaultArrivalTimeUsesCurrentTime,
    notificationsEnabled:
      typeof user?.notificationsEnabled === "boolean"
        ? user.notificationsEnabled
        : DEFAULT_USER_SETTINGS.notificationsEnabled,
  };
}

export async function getCurrentFavoriteParkingLotIds(): Promise<string[]> {
  const userDocId = await getCurrentBookingUserDocId();
  const userSnap = await getDoc(doc(db, usersCol, userDocId));

  if (!userSnap.exists()) {
    return [];
  }

  const user = userSnap.data() as Partial<UserDoc>;

  return Array.isArray(user.favoriteParkingLotIds) ? user.favoriteParkingLotIds : [];
}

export async function addCurrentUserFavoriteParkingLot(lotId: string): Promise<void> {
  const userDocId = await getCurrentBookingUserDocId();
  await addFavoriteParkingLotId(userDocId, lotId);
}

export async function removeCurrentUserFavoriteParkingLot(lotId: string): Promise<void> {
  const userDocId = await getCurrentBookingUserDocId();
  await removeFavoriteParkingLotId(userDocId, lotId);
}

export async function updateCurrentUserSettings(
  patch: Partial<UserSettings>
): Promise<void> {
  const userDocId = await getCurrentBookingUserDocId();

  const payload: Partial<UserDoc> = {
    ...(patch.displayName !== undefined ? { name: patch.displayName.trim() || DEFAULT_USER_SETTINGS.displayName } : {}),
    ...(patch.phoneNumber !== undefined ? { phoneNumber: patch.phoneNumber.trim() } : {}),
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
    ...(patch.defaultArrivalTimeUsesCurrentTime !== undefined
      ? { defaultArrivalTimeUsesCurrentTime: Boolean(patch.defaultArrivalTimeUsesCurrentTime) }
      : {}),
    ...(patch.notificationsEnabled !== undefined
      ? { notificationsEnabled: Boolean(patch.notificationsEnabled) }
      : {}),
  };

  await setDoc(doc(db, usersCol, userDocId), payload, { merge: true });
}
