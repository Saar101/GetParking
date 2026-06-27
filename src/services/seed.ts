import { db } from "../firebase";
import { doc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import proj4 from "proj4";

const PARKING_LOTS_COLLECTION = "parkingLots";
const PARKING_SPACES_COLLECTION = "parkingSpaces";
const USERS_COLLECTION = "users";
const GOV_IL_PARKING_RESOURCE_ID = "34729a10-299b-448d-a223-5d7533e8f147";
const GOV_IL_PARKING_API_URL = "https://data.gov.il/api/3/action/datastore_search";
const GOV_IL_API_PAGE_SIZE = 1000;
const DEFAULT_IMPORTED_BASE_PRICE = 20;
const DEFAULT_IMPORTED_BATCH_SIZE = 400;
const ITM_EPSG = "EPSG:2039";

type GovernmentParkingRecord = {
  UNIQ_ID?: string | number | null;
  NAME?: string | null;
  LATIN_NAME?: string | null;
  SETL_NAME?: string | null;
  E_ORD?: string | number | null;
  N_ORD?: string | number | null;
  X?: string | number | null;
  Y?: string | number | null;
};

type GovernmentParkingApiResponse = {
  success?: boolean;
  result?: {
    records?: GovernmentParkingRecord[];
    total?: number;
  };
};

export type GovernmentParkingImportSummary = {
  fetched: number;
  imported: number;
  skipped: number;
  pages: number;
};

type GovernmentParkingImportOptions = {
  batchSize?: number;
  defaultBasePrice?: number;
  limit?: number;
};

proj4.defs(
  ITM_EPSG,
  "+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-24.0024,-17.1032,-17.8444,-0.33077,-1.85269,1.66969,5.4248 +units=m +no_defs +type=crs"
);

function parseProjectedCoordinate(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(normalizedValue) ? normalizedValue : null;
}

function isValidItmCoordinate(x: number, y: number) {
  return x >= 120000 && x <= 285000 && y >= 350000 && y <= 850000;
}

export function convertItmToLatLng(x: number, y: number) {
  const [lng, lat] = proj4(ITM_EPSG, proj4.WGS84, [x, y]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Converted coordinates are invalid.");
  }

  return { lat, lng };
}

function buildGovernmentLotId(record: GovernmentParkingRecord) {
  const uniqueId = String(record.UNIQ_ID ?? "").trim();
  return uniqueId ? `gov-il-${uniqueId}` : null;
}

function buildGovernmentLotName(record: GovernmentParkingRecord) {
  const name = record.NAME?.trim();
  const latinName = record.LATIN_NAME?.trim();

  return name || latinName || "חניון ציבורי";
}

function buildGovernmentLotAddress(record: GovernmentParkingRecord) {
  const settlementName = record.SETL_NAME?.trim();
  return settlementName || "ישראל";
}

function toImportedParkingLot(record: GovernmentParkingRecord, defaultBasePrice: number) {
  const lotId = buildGovernmentLotId(record);
  const x = parseProjectedCoordinate(record.X ?? record.E_ORD);
  const y = parseProjectedCoordinate(record.Y ?? record.N_ORD);

  if (!lotId || x === null || y === null || !isValidItmCoordinate(x, y)) {
    return null;
  }

  const location = convertItmToLatLng(x, y);

  if (location.lat < 29 || location.lat > 34 || location.lng < 34 || location.lng > 36.5) {
    return null;
  }

  return {
    id: lotId,
    data: {
      parkingLotId: lotId,
      name: buildGovernmentLotName(record),
      address: buildGovernmentLotAddress(record),
      location,
      demandScore: 0,
      recommendationCount: 0,
      recommendationHistoryByHour: {},
      cardChecksCount: 0,
      cardChecksHistoryByHour: {},
      basePrice: defaultBasePrice,
      basePricingTiers: [{ price: defaultBasePrice, durationUnit: "hours" as const, durationValue: 1 }],
      basePriceDurationUnit: "hours" as const,
      basePriceDurationValue: 1,
      salePrice: null,
      salePricingTiers: null,
      saleStartsAt: null,
      saleEndsAt: null,
      ownerId: 0,
    },
  };
}

async function fetchGovernmentParkingPage(offset: number, limit: number) {
  const url = new URL(GOV_IL_PARKING_API_URL);
  url.searchParams.set("resource_id", GOV_IL_PARKING_RESOURCE_ID);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Government parking dataset request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GovernmentParkingApiResponse;
  const records = payload.result?.records;

  if (!payload.success || !Array.isArray(records)) {
    throw new Error("Government parking dataset response format is invalid.");
  }

  return {
    records,
    total: payload.result?.total ?? records.length,
  };
}

async function fetchAllGovernmentParkingRecords(limit?: number) {
  const allRecords: GovernmentParkingRecord[] = [];
  let offset = 0;
  let pages = 0;

  while (true) {
    const pageSize = limit
      ? Math.min(GOV_IL_API_PAGE_SIZE, Math.max(limit - allRecords.length, 0))
      : GOV_IL_API_PAGE_SIZE;

    if (pageSize <= 0) {
      break;
    }

    const page = await fetchGovernmentParkingPage(offset, pageSize);
    pages += 1;
    allRecords.push(...page.records);

    if (page.records.length < pageSize || allRecords.length >= page.total) {
      break;
    }

    offset += page.records.length;
  }

  return {
    records: limit ? allRecords.slice(0, limit) : allRecords,
    pages,
  };
}

export async function importIsraelGovernmentParkingLots(
  options: GovernmentParkingImportOptions = {}
): Promise<GovernmentParkingImportSummary> {
  const batchSize = Math.max(1, Math.min(options.batchSize ?? DEFAULT_IMPORTED_BATCH_SIZE, 400));
  const defaultBasePrice = Math.max(1, Math.round(options.defaultBasePrice ?? DEFAULT_IMPORTED_BASE_PRICE));
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : undefined;
  const { records, pages } = await fetchAllGovernmentParkingRecords(limit);
  const transformedLots = records
    .map((record) => toImportedParkingLot(record, defaultBasePrice))
    .filter((lot): lot is NonNullable<typeof lot> => lot !== null);

  for (let start = 0; start < transformedLots.length; start += batchSize) {
    const batch = writeBatch(db);
    const currentChunk = transformedLots.slice(start, start + batchSize);

    for (const lot of currentChunk) {
      batch.set(doc(db, PARKING_LOTS_COLLECTION, lot.id), lot.data, { merge: true });
    }

    await batch.commit();
  }

  return {
    fetched: records.length,
    imported: transformedLots.length,
    skipped: records.length - transformedLots.length,
    pages,
  };
}

/**
 * Seeds Firestore with sample data for testing relationships:
 * - 3 users (customer, owner, admin)
 * - 3 parking lots
 * - 8 parking spaces (linked to lots via parkingLotId)
 *
 * Safe to run multiple times (setDoc overwrites same IDs).
 */
export async function seedGetParkingData() {
  // ----- PARKING LOTS (first, so we know the IDs) -----
  const lots = [
    {
      id: "L01",
      name: "חניון בדיקה A",
      address: "מיקום בדיקה קרוב אליך",
      // ~150m NE from provided center (31.768245,35.193791)
      location: { lat: 31.76955, lng: 35.1957 },
      ownerId: 201,
    },
    {
      id: "L02",
      name: "חניון דיזנגוף",
      address: "דיזנגוף 99, תל אביב",
      location: { lat: 32.0830, lng: 34.7700 },
      ownerId: 201,
    },
    {
      id: "L03",
      name: "חניון בדיקה B",
      address: "מיקום בדיקה קרוב אליך",
      // ~220m SE from provided center (31.768245,35.193791)
      location: { lat: 31.7663, lng: 35.1952 },
      ownerId: 201,
    },
  ];

  for (const lot of lots) {
    await setDoc(
    doc(db, PARKING_LOTS_COLLECTION, lot.id),
      {
        parkingLotId: lot.id,
        name: lot.name,
        address: lot.address,
        location: lot.location,
        demandScore: Math.floor(Math.random() * 10),
        recommendationCount: 0,
        cardChecksCount: 0,
        basePrice: Math.floor(Math.random() * 30) + 15,
        salePrice: null,
        ownerId: lot.ownerId,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // ----- USERS (with proper parkingLotId assignments) -----
  const users = [
    { id: "101", name: "Saar", role: "customer", parkingLotId: null },
    { id: "102", name: "Nir", role: "customer", parkingLotId: null },
    { id: "201", name: "Saar Nir", role: "owner", parkingLotId: "L01", parkingLotIds: ["L01", "L02", "L03"] },
    { id: "202", name: "Rachel", role: "owner", parkingLotId: "L02" },
    { id: "1", name: "Admin", role: "admin", parkingLotId: null },
  ];

  for (const user of users) {
    await setDoc(
    doc(db, USERS_COLLECTION, user.id),
      {
        userId: Number(user.id),
        customerId: Number(user.id),
        name: user.name,
        role: user.role,
        bookingHistory: [],
        parkingLotId: user.parkingLotId,
        parkingLotIds: user.parkingLotIds ?? [user.parkingLotId].filter(Boolean),
        parkingSpaceId: null,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // ----- PARKING SPACES -----
  const lotsSpaces = [
    { lotId: "L01", count: 3 },
    { lotId: "L02", count: 3 },
    { lotId: "L03", count: 2 },
  ];

  for (const { lotId, count } of lotsSpaces) {
    for (let i = 1; i <= count; i++) {
      const spaceId = `${lotId}-${String(i).padStart(2, "0")}`;
      const isOccupied = Math.random() > 0.6; // 40% chance occupied

      await setDoc(
        doc(db, PARKING_SPACES_COLLECTION, spaceId),
        {
          parkingSpaceId: spaceId,
          parkingLotId: lotId,
          status: isOccupied ? "occupied" : "available",
          dateTime: new Date().toISOString(),
          customerId: isOccupied ? Number(["101", "102"][Math.floor(Math.random() * 2)]) : null,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  return {
    users: users.map((u) => u.id),
    parkingLots: lots.map((l) => l.id),
    parkingSpaces: lotsSpaces.reduce((acc, { lotId, count }) => {
      for (let i = 1; i <= count; i++) {
        acc.push(`${lotId}-${String(i).padStart(2, "0")}`);
      }
      return acc;
    }, [] as string[]),
  };
}

