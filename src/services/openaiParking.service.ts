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
  reply: string;
};

const API_BASE = import.meta.env.VITE_PARKING_API_BASE_URL ?? "http://localhost:5174";

export async function requestParkingRecommendation(
  payload: ParkingRecommendationPayload
): Promise<ParkingRecommendationResult> {
  try {
    const response = await fetch(`${API_BASE}/api/parking-recommendation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "הבקשה להמלצה נכשלה");
    }

    return response.json();
  } catch (error: any) {
    const message = String(error?.message ?? error ?? "");

    if (
      message.includes("Failed to fetch") ||
      message.includes("ERR_CONNECTION_REFUSED") ||
      message.includes("NetworkError")
    ) {
      throw new Error(
        "לא הצלחתי להתחבר לשרת ההמלצות. ודא שהשרת המקומי רץ עם npm run dev:server ואז נסה שוב."
      );
    }

    throw error instanceof Error ? error : new Error("הבקשה להמלצה נכשלה");
  }
}

export async function requestParkingFollowup(
  payload: ParkingFollowupPayload
): Promise<ParkingFollowupResult> {
  try {
    const response = await fetch(`${API_BASE}/api/parking-recommendation-followup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "שיחת ההמשך נכשלה");
    }

    return response.json();
  } catch (error: any) {
    const message = String(error?.message ?? error ?? "");

    if (
      message.includes("Failed to fetch") ||
      message.includes("ERR_CONNECTION_REFUSED") ||
      message.includes("NetworkError")
    ) {
      throw new Error(
        "לא הצלחתי להתחבר לשרת ההמלצות. ודא שהשרת המקומי רץ עם npm run dev:server ואז נסה שוב."
      );
    }

    throw error instanceof Error ? error : new Error("שיחת ההמשך נכשלה");
  }
}
