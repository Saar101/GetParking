import { db } from "../firebase";
import {
  arrayUnion,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

export type UserRole = "customer" | "owner" | "admin";

export type UserBase = {
  userId: number;
  name: string;
  role: UserRole;
  createdAt?: any; // serverTimestamp (optional to keep it simple)
};

export type CustomerFields = {
  bookingHistory: string[]; // IDs only
  parkingLotId?: string | null;
  parkingSpaceId?: string | null;
};

export type OwnerFields = {
  parkingLotId: string;
};

export type UserDoc = UserBase & Partial<CustomerFields & OwnerFields>;

const usersCol = "users";

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
