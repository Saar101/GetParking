export type ParkingRecommendationLot = {
  id: string;
  name: string;
  distanceMeters: number;
  price: number;
  salePrice: number | null;
  recommendationCount: number;
  available: boolean;
};

export type ParkingRecommendationPayload = {
  mapCenter?: { lat: number; lng: number } | null;
  radiusMeters?: number;
  selectedLotId?: string | null;
  parkingLotsInRadius: ParkingRecommendationLot[];
};

export type ParkingRecommendationResult = {
  recommendedLotId: string | null;
  explanation: string;
  source: "openai" | "local";
  sourceReason?: string;
  rankedLots?: Array<ParkingRecommendationLot & { score: number }>;
};

export type ParkingFollowupMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ParkingFollowupPayload = {
  source: "openai" | "local";
  selectedLotId?: string | null;
  mapCenter?: { lat: number; lng: number } | null;
  radiusMeters?: number;
  parkingLotsInRadius: ParkingRecommendationLot[];
  messages: ParkingFollowupMessage[];
};

export type ParkingFollowupResult = {
  source: "openai" | "local";
  sourceReason?: string;
  reply: string;
};

const API_BASE = import.meta.env.VITE_PARKING_API_BASE_URL ?? "http://localhost:5174";

function logParkingApi(message: string, details?: unknown) {
  if (details !== undefined) {
    console.info(`[GetParking API] ${message}`, details);
    return;
  }

  console.info(`[GetParking API] ${message}`);
}

function logParkingApiResponse(label: string, response: Response, details?: unknown) {
  console.info(`[GetParking API] ${label}`, {
    status: response.status,
    ok: response.ok,
    url: response.url,
    ...((details as Record<string, unknown>) ?? {}),
  });
}

export async function requestParkingRecommendation(
  payload: ParkingRecommendationPayload
): Promise<ParkingRecommendationResult> {
  try {
    logParkingApi("שולח בקשת המלצה לשרת", {
      hasCenter: Boolean(payload.mapCenter),
      radiusMeters: payload.radiusMeters,
      lotCount: payload.parkingLotsInRadius.length,
      selectedLotId: payload.selectedLotId ?? null,
    });

    const response = await fetch(`${API_BASE}/api/parking-recommendation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    logParkingApiResponse("השרת החזיר תשובה לבקשת ההמלצה", response);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("[GetParking API] תשובת השרת לבקשת ההמלצה לא הייתה תקינה", {
        status: response.status,
        body: errorText,
      });
      throw new Error(errorText || "הבקשה להמלצה נכשלה");
    }

    const result: ParkingRecommendationResult = await response.json();

    logParkingApi(
      result.source === "openai"
        ? "התקבלה תשובה מ־OpenAI"
        : "התקבלה תשובה מהחישוב המקומי",
      {
        source: result.source,
        sourceReason: result.sourceReason ?? null,
        recommendedLotId: result.recommendedLotId,
      }
    );

    return result;
  } catch (error: any) {
    const message = String(error?.message ?? error ?? "");

    if (
      message.includes("Failed to fetch") ||
      message.includes("ERR_CONNECTION_REFUSED") ||
      message.includes("NetworkError")
    ) {
      console.warn("[GetParking API] הבקשה לא נשלחה לשרת או שהחיבור נדחה", {
        error: message,
      });

      throw new Error(
        "לא הצלחתי להתחבר לשרת ההמלצות. ודא שהשרת המקומי רץ עם npm run dev:server ואז נסה שוב."
      );
    }

    console.error("[GetParking API] שגיאה בבקשת ההמלצה", error);

    throw error instanceof Error ? error : new Error("הבקשה להמלצה נכשלה");
  }
}

export async function requestParkingFollowup(
  payload: ParkingFollowupPayload
): Promise<ParkingFollowupResult> {
  try {
    logParkingApi("שולח שאלת המשך לשרת", {
      source: payload.source,
      selectedLotId: payload.selectedLotId ?? null,
      lotCount: payload.parkingLotsInRadius.length,
      messageCount: payload.messages.length,
    });

    const response = await fetch(`${API_BASE}/api/parking-recommendation-followup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    logParkingApiResponse("השרת החזיר תשובה לשאלת ההמשך", response);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("[GetParking API] תשובת השרת לשאלת ההמשך לא הייתה תקינה", {
        status: response.status,
        body: errorText,
      });
      throw new Error(errorText || "שיחת ההמשך נכשלה");
    }

    const result: ParkingFollowupResult = await response.json();

    logParkingApi(
      result.source === "openai"
        ? "התקבלה תשובת המשך מ־OpenAI"
        : "שיחת ההמשך חזרה ממסלול מקומי",
      {
        source: result.source,
        sourceReason: result.sourceReason ?? null,
      }
    );

    return result;
  } catch (error: any) {
    const message = String(error?.message ?? error ?? "");

    if (
      message.includes("Failed to fetch") ||
      message.includes("ERR_CONNECTION_REFUSED") ||
      message.includes("NetworkError")
    ) {
      console.warn("[GetParking API] בקשת ההמשך לא נשלחה לשרת או שהחיבור נדחה", {
        error: message,
      });

      throw new Error(
        "לא הצלחתי להתחבר לשרת ההמלצות. ודא שהשרת המקומי רץ עם npm run dev:server ואז נסה שוב."
      );
    }

    console.error("[GetParking API] שגיאה בשיחת ההמשך", error);

    throw error instanceof Error ? error : new Error("שיחת ההמשך נכשלה");
  }
}
