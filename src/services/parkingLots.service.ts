import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

export type ParkingLotDoc = {
  parkingLotId: string;
  name: string;
  demandScore: number;
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
