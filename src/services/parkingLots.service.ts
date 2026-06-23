import { db } from "../firebase";
import { collection, doc, getDoc, getDocs, increment, setDoc, updateDoc } from "firebase/firestore";
import type { UserDoc, BookingHistorySnapshot } from "./users.service";

export type ParkingLotDoc = {
  parkingLotId: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  demandScore: number;
  recommendationCount?: number;
  recommendationHistoryByHour?: Record<string, number>;
  cardChecksCount?: number;
  cardChecksHistoryByHour?: Record<string, number>;
  basePrice: number;
  basePricingTiers?: ParkingPriceTier[];
  basePriceDurationUnit?: PricingDurationUnit;
  basePriceDurationValue?: number;
  salePrice?: number | null;
  salePricingTiers?: ParkingPriceTier[] | null;
  salePriceDurationUnit?: PricingDurationUnit | null;
  salePriceDurationValue?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  activeSalePrice?: number | null;
  activeSalePricingTiers?: ParkingPriceTier[] | null;
  activeSaleDurationUnit?: PricingDurationUnit | null;
  activeSaleDurationValue?: number | null;
  activeSaleUpdatedAt?: string | null;
  ownerId: number;
  createdAt?: any;
};

export type PricingDurationUnit = "minutes" | "hours" | "day";

export type ParkingPriceTier = {
  price: number;
  durationUnit: PricingDurationUnit;
  durationValue: number;
};

export type ParkingLotPricingPatch = {
  basePricingTiers: ParkingPriceTier[];
  salePricingTiers: ParkingPriceTier[] | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  activeSalePrice?: number | null;
  activeSalePricingTiers?: ParkingPriceTier[] | null;
  activeSaleDurationUnit?: PricingDurationUnit | null;
  activeSaleDurationValue?: number | null;
  activeSaleUpdatedAt?: string | null;
};

export type EffectiveLotPricing = {
  price: number;
  durationUnit: PricingDurationUnit;
  durationValue: number;
  label: string;
};

const lotsCol = "parkingLots";

export async function createParkingLot(lotId: string, data: ParkingLotDoc) {
  await setDoc(doc(db, lotsCol, lotId), data, { merge: true });
}

export async function getParkingLot(lotId: string) {
  const snap = await getDoc(doc(db, lotsCol, lotId));

  if (!snap.exists()) {
    return null;
  }

  const lot = snap.data() as ParkingLotDoc;
  return await syncLotActiveSaleFields(lotId, lot);
}

export async function listParkingLots() {
  const snap = await getDocs(collection(db, lotsCol));

  return await Promise.all(
    snap.docs.map(async (lotDoc) => {
      const lot = {
        id: lotDoc.id,
        ...(lotDoc.data() as ParkingLotDoc),
      };

      return await syncLotActiveSaleFields(lotDoc.id, lot);
    })
  );
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

function parseOptionalDate(dateValue: string | null | undefined) {
  if (!dateValue) {
    return null;
  }

  const parsedDate = new Date(dateValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function normalizeDurationUnit(unit: PricingDurationUnit | null | undefined): PricingDurationUnit {
  if (unit === "minutes" || unit === "hours" || unit === "day") {
    return unit;
  }

  return "hours";
}

function normalizeDurationValue(unit: PricingDurationUnit, value: number | null | undefined) {
  if (unit === "day") {
    return 1;
  }

  return Math.max(1, Math.round(value ?? 1));
}

function getDurationMinutes(unit: PricingDurationUnit, value: number) {
  if (unit === "day") {
    return 24 * 60;
  }

  if (unit === "hours") {
    return value * 60;
  }

  return value;
}

function normalizePricingTier(tier: ParkingPriceTier): ParkingPriceTier {
  const durationUnit = normalizeDurationUnit(tier.durationUnit);

  return {
    price: Math.max(1, Math.round(tier.price)),
    durationUnit,
    durationValue: normalizeDurationValue(durationUnit, tier.durationValue),
  };
}

function normalizePricingTiers(tiers: ParkingPriceTier[] | null | undefined, fallbackTier?: ParkingPriceTier | null) {
  const normalizedTiers = (tiers ?? [])
    .filter((tier) => tier && Number.isFinite(tier.price) && tier.price > 0)
    .map(normalizePricingTier)
    .sort((left, right) => getDurationMinutes(left.durationUnit, left.durationValue) - getDurationMinutes(right.durationUnit, right.durationValue));

  if (normalizedTiers.length > 0) {
    return normalizedTiers;
  }

  if (fallbackTier) {
    return [normalizePricingTier(fallbackTier)];
  }

  return [];
}

function getPrimaryPricingTier(tiers: ParkingPriceTier[] | null | undefined, fallbackTier?: ParkingPriceTier | null) {
  return normalizePricingTiers(tiers, fallbackTier)[0] ?? null;
}

export function getPricingDurationLabel(unit: PricingDurationUnit | null | undefined, value: number | null | undefined) {
  const normalizedUnit = normalizeDurationUnit(unit);
  const normalizedValue = normalizeDurationValue(normalizedUnit, value);

  if (normalizedUnit === "day") {
    return "ליום שלם";
  }

  if (normalizedUnit === "minutes") {
    return `ל־${normalizedValue} דקות`;
  }

  if (normalizedValue === 1) {
    return "לשעה";
  }

  return `ל־${normalizedValue} שעות`;
}

export function getPricingTierLabel(tier: Pick<ParkingPriceTier, "durationUnit" | "durationValue"> | null | undefined) {
  if (!tier) {
    return "";
  }

  return `עד ${getPricingDurationLabel(tier.durationUnit, tier.durationValue)}`;
}

function buildEffectiveLotPricing(price: number, unit: PricingDurationUnit | null | undefined, value: number | null | undefined): EffectiveLotPricing {
  const durationUnit = normalizeDurationUnit(unit);
  const durationValue = normalizeDurationValue(durationUnit, value);

  return {
    price,
    durationUnit,
    durationValue,
    label: getPricingDurationLabel(durationUnit, durationValue),
  };
}

function getLegacyBaseTier(lot: Pick<ParkingLotDoc, "basePrice" | "basePriceDurationUnit" | "basePriceDurationValue">): ParkingPriceTier {
  return {
    price: lot.basePrice,
    durationUnit: normalizeDurationUnit(lot.basePriceDurationUnit),
    durationValue: normalizeDurationValue(normalizeDurationUnit(lot.basePriceDurationUnit), lot.basePriceDurationValue),
  };
}

function getLegacySaleTier(lot: Pick<ParkingLotDoc, "salePrice" | "salePriceDurationUnit" | "salePriceDurationValue">): ParkingPriceTier | null {
  if (typeof lot.salePrice !== "number") {
    return null;
  }

  return {
    price: lot.salePrice,
    durationUnit: normalizeDurationUnit(lot.salePriceDurationUnit),
    durationValue: normalizeDurationValue(normalizeDurationUnit(lot.salePriceDurationUnit), lot.salePriceDurationValue),
  };
}

export function getBasePricingTiers(
  lot: Pick<ParkingLotDoc, "basePrice" | "basePricingTiers" | "basePriceDurationUnit" | "basePriceDurationValue">
) {
  return normalizePricingTiers(lot.basePricingTiers, getLegacyBaseTier(lot));
}

export function getSalePricingTiers(
  lot: Pick<ParkingLotDoc, "salePrice" | "salePricingTiers" | "salePriceDurationUnit" | "salePriceDurationValue">
) {
  return normalizePricingTiers(lot.salePricingTiers, getLegacySaleTier(lot));
}

export function getActiveSalePricingTiers(
  lot: Pick<ParkingLotDoc,
    "salePrice" |
    "salePricingTiers" |
    "salePriceDurationUnit" |
    "salePriceDurationValue" |
    "saleStartsAt" |
    "saleEndsAt" |
    "activeSalePrice" |
    "activeSalePricingTiers" |
    "activeSaleDurationUnit" |
    "activeSaleDurationValue"
  >,
  at: Date = new Date()
) {
  if (getActiveSalePrice(lot, at) === null) {
    return [];
  }

  const fallbackTier = typeof lot.activeSalePrice === "number"
    ? {
      price: lot.activeSalePrice,
      durationUnit: normalizeDurationUnit(lot.activeSaleDurationUnit),
      durationValue: normalizeDurationValue(normalizeDurationUnit(lot.activeSaleDurationUnit), lot.activeSaleDurationValue),
    }
    : getLegacySaleTier(lot);

  return normalizePricingTiers(lot.activeSalePricingTiers ?? lot.salePricingTiers, fallbackTier);
}

export function getActiveSalePrice(
  lot: Pick<ParkingLotDoc, "salePrice" | "salePricingTiers" | "saleStartsAt" | "saleEndsAt" | "activeSalePrice" | "activeSalePricingTiers">,
  at: Date = new Date()
) {
  if (typeof lot.activeSalePrice === "number") {
    return lot.activeSalePrice;
  }

  if (typeof lot.salePrice !== "number" && normalizePricingTiers(lot.salePricingTiers).length === 0) {
    return null;
  }

  const startDate = parseOptionalDate(lot.saleStartsAt);
  const endDate = parseOptionalDate(lot.saleEndsAt);

  if (startDate && startDate.getTime() > at.getTime()) {
    return null;
  }

  if (endDate && endDate.getTime() < at.getTime()) {
    return null;
  }

  const primaryTier = getPrimaryPricingTier(lot.salePricingTiers, typeof lot.salePrice === "number"
    ? {
      price: lot.salePrice,
      durationUnit: "hours",
      durationValue: 1,
    }
    : null);

  return primaryTier?.price ?? lot.salePrice ?? null;
}

export function getEffectiveLotPrice(
  lot: Pick<ParkingLotDoc,
    "basePrice" |
    "basePricingTiers" |
    "basePriceDurationUnit" |
    "basePriceDurationValue" |
    "salePrice" |
    "salePricingTiers" |
    "saleStartsAt" |
    "saleEndsAt" |
    "activeSalePrice" |
    "activeSalePricingTiers"
  >,
  at: Date = new Date()
) {
  return getActiveSalePrice(lot, at) ?? lot.basePrice;
}

export function getEffectiveLotPricing(
  lot: Pick<ParkingLotDoc,
    "basePrice" |
    "basePricingTiers" |
    "basePriceDurationUnit" |
    "basePriceDurationValue" |
    "salePrice" |
    "salePricingTiers" |
    "salePriceDurationUnit" |
    "salePriceDurationValue" |
    "saleStartsAt" |
    "saleEndsAt" |
    "activeSalePrice" |
    "activeSalePricingTiers" |
    "activeSaleDurationUnit" |
    "activeSaleDurationValue"
  >,
  at: Date = new Date()
) {
  const activeSaleTier = getActiveSalePricingTiers(lot, at)[0];
  if (activeSaleTier) {
    return buildEffectiveLotPricing(activeSaleTier.price, activeSaleTier.durationUnit, activeSaleTier.durationValue);
  }

  const baseTier = getBasePricingTiers(lot)[0] ?? getLegacyBaseTier(lot);
  return buildEffectiveLotPricing(baseTier.price, baseTier.durationUnit, baseTier.durationValue);
}

function computeActiveSalePrice(lot: Pick<ParkingLotDoc, "salePrice" | "salePricingTiers" | "saleStartsAt" | "saleEndsAt">, at: Date = new Date()) {
  const primaryTier = getPrimaryPricingTier(lot.salePricingTiers, typeof lot.salePrice === "number"
    ? {
      price: lot.salePrice,
      durationUnit: "hours",
      durationValue: 1,
    }
    : null);

  if (!primaryTier) {
    return null;
  }

  const startDate = parseOptionalDate(lot.saleStartsAt);
  const endDate = parseOptionalDate(lot.saleEndsAt);

  if (startDate && startDate.getTime() > at.getTime()) {
    return null;
  }

  if (endDate && endDate.getTime() < at.getTime()) {
    return null;
  }

  return primaryTier.price;
}

function computeActiveSaleDuration(lot: Pick<ParkingLotDoc, "salePrice" | "salePricingTiers" | "salePriceDurationUnit" | "salePriceDurationValue" | "saleStartsAt" | "saleEndsAt">, at: Date = new Date()) {
  if (computeActiveSalePrice(lot, at) === null) {
    return {
      activeSaleDurationUnit: null,
      activeSaleDurationValue: null,
    };
  }

  const primaryTier = getPrimaryPricingTier(lot.salePricingTiers, getLegacySaleTier(lot));

  if (!primaryTier) {
    return {
      activeSaleDurationUnit: null,
      activeSaleDurationValue: null,
    };
  }

  return {
    activeSaleDurationUnit: primaryTier.durationUnit,
    activeSaleDurationValue: primaryTier.durationValue,
  };
}

async function syncLotActiveSaleFields<T extends Pick<ParkingLotDoc, "basePrice" | "basePricingTiers" | "basePriceDurationUnit" | "basePriceDurationValue" | "salePrice" | "salePricingTiers" | "salePriceDurationUnit" | "salePriceDurationValue" | "saleStartsAt" | "saleEndsAt" | "activeSalePrice" | "activeSalePricingTiers" | "activeSaleDurationUnit" | "activeSaleDurationValue">>(lotId: string, lot: T) {
  const computedActiveSalePrice = computeActiveSalePrice(lot);
  const computedActiveSaleDuration = computeActiveSaleDuration(lot);
  const computedActiveSalePricingTiers = computedActiveSalePrice === null ? null : getSalePricingTiers(lot);
  const storedActiveSalePrice = typeof lot.activeSalePrice === "number" ? lot.activeSalePrice : null;
  const storedActiveSalePricingTiers = lot.activeSalePricingTiers ?? null;
  const storedActiveSaleDurationUnit = lot.activeSaleDurationUnit ?? null;
  const storedActiveSaleDurationValue = lot.activeSaleDurationValue ?? null;
  const normalizedBasePricingTiers = getBasePricingTiers(lot);
  const normalizedSalePricingTiers = getSalePricingTiers(lot);
  const primaryBaseTier = normalizedBasePricingTiers[0] ?? getLegacyBaseTier(lot);
  const primarySaleTier = normalizedSalePricingTiers[0] ?? null;

  const shouldSyncPrimaryFields =
    lot.basePrice !== primaryBaseTier.price ||
    (lot.basePriceDurationUnit ?? null) !== primaryBaseTier.durationUnit ||
    (lot.basePriceDurationValue ?? null) !== primaryBaseTier.durationValue ||
    (lot.salePrice ?? null) !== (primarySaleTier?.price ?? null) ||
    (lot.salePriceDurationUnit ?? null) !== (primarySaleTier?.durationUnit ?? null) ||
    (lot.salePriceDurationValue ?? null) !== (primarySaleTier?.durationValue ?? null);

  const activeTiersChanged = JSON.stringify(storedActiveSalePricingTiers ?? []) !== JSON.stringify(computedActiveSalePricingTiers ?? []);

  if (
    shouldSyncPrimaryFields ||
    storedActiveSalePrice !== computedActiveSalePrice ||
    activeTiersChanged ||
    storedActiveSaleDurationUnit !== computedActiveSaleDuration.activeSaleDurationUnit ||
    storedActiveSaleDurationValue !== computedActiveSaleDuration.activeSaleDurationValue
  ) {
    await updateParkingLot(lotId, {
      basePricingTiers: normalizedBasePricingTiers,
      basePrice: primaryBaseTier.price,
      basePriceDurationUnit: primaryBaseTier.durationUnit,
      basePriceDurationValue: primaryBaseTier.durationValue,
      salePricingTiers: primarySaleTier ? normalizedSalePricingTiers : null,
      salePrice: primarySaleTier?.price ?? null,
      salePriceDurationUnit: primarySaleTier?.durationUnit ?? null,
      salePriceDurationValue: primarySaleTier?.durationValue ?? null,
      activeSalePrice: computedActiveSalePrice,
      activeSalePricingTiers: computedActiveSalePricingTiers,
      activeSaleDurationUnit: computedActiveSaleDuration.activeSaleDurationUnit,
      activeSaleDurationValue: computedActiveSaleDuration.activeSaleDurationValue,
      activeSaleUpdatedAt: new Date().toISOString(),
    });

    return {
      ...lot,
      basePricingTiers: normalizedBasePricingTiers,
      basePrice: primaryBaseTier.price,
      basePriceDurationUnit: primaryBaseTier.durationUnit,
      basePriceDurationValue: primaryBaseTier.durationValue,
      salePricingTiers: primarySaleTier ? normalizedSalePricingTiers : null,
      salePrice: primarySaleTier?.price ?? null,
      salePriceDurationUnit: primarySaleTier?.durationUnit ?? null,
      salePriceDurationValue: primarySaleTier?.durationValue ?? null,
      activeSalePrice: computedActiveSalePrice,
      activeSalePricingTiers: computedActiveSalePricingTiers,
      activeSaleDurationUnit: computedActiveSaleDuration.activeSaleDurationUnit,
      activeSaleDurationValue: computedActiveSaleDuration.activeSaleDurationValue,
      activeSaleUpdatedAt: new Date().toISOString(),
    };
  }

  return {
    ...lot,
    basePricingTiers: normalizedBasePricingTiers,
    basePrice: primaryBaseTier.price,
    basePriceDurationUnit: primaryBaseTier.durationUnit,
    basePriceDurationValue: primaryBaseTier.durationValue,
    salePricingTiers: primarySaleTier ? normalizedSalePricingTiers : null,
    salePrice: primarySaleTier?.price ?? null,
    salePriceDurationUnit: primarySaleTier?.durationUnit ?? null,
    salePriceDurationValue: primarySaleTier?.durationValue ?? null,
    activeSalePrice: storedActiveSalePrice,
    activeSalePricingTiers: storedActiveSalePricingTiers,
    activeSaleDurationUnit: storedActiveSaleDurationUnit,
    activeSaleDurationValue: storedActiveSaleDurationValue,
  };
}

export async function setLotPricing(lotId: string, pricing: ParkingLotPricingPatch) {
  const normalizedBasePricingTiers = normalizePricingTiers(pricing.basePricingTiers);
  const normalizedSalePricingTiers = normalizePricingTiers(pricing.salePricingTiers);
  const primaryBaseTier = normalizedBasePricingTiers[0];
  const primarySaleTier = normalizedSalePricingTiers[0] ?? null;

  if (!primaryBaseTier) {
    throw new Error("חייבים להגדיר לפחות מדרגת מחיר אחת למחיר הבסיס.");
  }

  const pricingForSync = {
    ...pricing,
    basePrice: primaryBaseTier.price,
    basePricingTiers: normalizedBasePricingTiers,
    basePriceDurationUnit: primaryBaseTier.durationUnit,
    basePriceDurationValue: primaryBaseTier.durationValue,
    salePrice: primarySaleTier?.price ?? null,
    salePricingTiers: primarySaleTier ? normalizedSalePricingTiers : null,
    salePriceDurationUnit: primarySaleTier?.durationUnit ?? null,
    salePriceDurationValue: primarySaleTier?.durationValue ?? null,
  };

  const activeSalePrice = computeActiveSalePrice(pricingForSync);
  const activeSaleDuration = computeActiveSaleDuration(pricingForSync);
  const activeSalePricingTiers = activeSalePrice === null ? null : normalizedSalePricingTiers;

  await updateParkingLot(lotId, {
    ...pricingForSync,
    activeSalePrice,
    activeSalePricingTiers,
    activeSaleDurationUnit: activeSaleDuration.activeSaleDurationUnit,
    activeSaleDurationValue: activeSaleDuration.activeSaleDurationValue,
    activeSaleUpdatedAt: new Date().toISOString(),
  });
}

export async function incrementDemandScore(lotId: string, by: number = 1) {
  // פשוט: קורא ואז מעדכן. (אם תרצה נעשה atomic עם increment)
  const lot = await getParkingLot(lotId);
  const current = typeof lot?.demandScore === "number" ? lot.demandScore : 0;
  await updateParkingLot(lotId, { demandScore: current + by });
}

export async function incrementCardChecksCount(lotId: string, by: number = 1) {
  await updateDoc(doc(db, lotsCol, lotId), {
    cardChecksCount: increment(by),
  });
}

function buildHourlyHistoryKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");

  return `${year}-${month}-${day}_${hour}`;
}

export async function addParkingLotRecommendation(lotId: string, date: Date = new Date()) {
  const hourKey = buildHourlyHistoryKey(date);

  await updateDoc(doc(db, lotsCol, lotId), {
    recommendationCount: increment(1),
    [`recommendationHistoryByHour.${hourKey}`]: increment(1),
  });
}

export async function recordParkingLotCardCheck(lotId: string, date: Date = new Date()) {
  const hourKey = buildHourlyHistoryKey(date);

  await updateDoc(doc(db, lotsCol, lotId), {
    cardChecksCount: increment(1),
    [`cardChecksHistoryByHour.${hourKey}`]: increment(1),
  });
}

/**
 * Fetch real historical booking data for a parking lot from user booking history
 * Extracts all bookings where spaceId starts with lotId (e.g., "L01-01" for lot "L01")
 */
export async function getActualHistoryForLot(lotId: string): Promise<{
  dailyBookings: Array<{ date: string; count: number }>;
  allBookings: Array<BookingHistorySnapshot & { spaceId: string; date: string }>;
}> {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const allBookings: Array<BookingHistorySnapshot & { spaceId: string; date: string }> = [];

    // Extract all bookings for this lot from all users
    usersSnap.docs.forEach((userDoc) => {
      const user = userDoc.data() as UserDoc;
      const bookingHistoryDetails = user.bookingHistoryDetails ?? {};

      Object.entries(bookingHistoryDetails).forEach(([spaceId, booking]) => {
        // Filter only spaces that belong to this lot (e.g., "L01-01" for "L01")
        if (spaceId.startsWith(`${lotId}-`)) {
          allBookings.push({
            ...booking,
            spaceId,
            date: booking.date ?? "",
          });
        }
      });
    });

    // Group by date and count
    const dateMap = new Map<string, number>();
    allBookings.forEach((booking) => {
      if (booking.date) {
        dateMap.set(booking.date, (dateMap.get(booking.date) ?? 0) + 1);
      }
    });

    // Convert to sorted array
    const dailyBookings = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { dailyBookings, allBookings };
  } catch (error) {
    console.error(`Error fetching actual history for lot ${lotId}:`, error);
    return { dailyBookings: [], allBookings: [] };
  }
}

// Example parking lot data (can be used for reference or future migrations)
// const exampleParkingLot: ParkingLotDoc = {
//   parkingLotId: "P001",
//   name: "חנייה בן גוריון",
//   address: "רחוב בן גוריון 25, תל אביב",
//   location: {
//     lat: 32.0853,
//     lng: 34.7818
//   },
//   demandScore: 5,
//   basePrice: 18,
//   ownerId: 123,
//   createdAt: new Date()
// };
