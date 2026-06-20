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
