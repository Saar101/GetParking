import { callOpenAI } from './openaiClient.js';

function normalizeParkingLot(lot) {
  const distanceMeters = Number(lot?.distanceMeters ?? lot?.distance ?? lot?.distanceValue ?? 0);
  const price = Number(lot?.basePrice ?? lot?.price ?? 0);
  const salePrice = lot?.salePrice == null ? null : Number(lot.salePrice);
  const recommendationCount = Number(lot?.recommendationCount ?? lot?.recommendations ?? lot?.reviews ?? 0);

  return {
    id: String(lot?.id ?? lot?.parkingLotId ?? ''),
    name: String(lot?.name ?? lot?.title ?? ''),
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : 0,
    price: Number.isFinite(price) ? price : 0,
    salePrice: Number.isFinite(salePrice) ? salePrice : null,
    recommendationCount: Number.isFinite(recommendationCount) ? recommendationCount : 0,
    available: lot?.available !== false,
  };
}

function normalizeRecommendationPayload(payload) {
  const parkingLots = payload?.parkingLotsInRadius ?? payload?.lots ?? [];
  return {
    mapCenter: payload?.mapCenter ?? null,
    radiusMeters: Number(payload?.radiusMeters ?? payload?.radius ?? 0),
    selectedLotId: payload?.selectedLotId ?? payload?.selectedLot?.id ?? null,
    parkingLots: Array.isArray(parkingLots) ? parkingLots.map(normalizeParkingLot).filter((lot) => lot.id) : [],
  };
}

function buildPrompt(normalizedPayload) {
  const examples = normalizedPayload.parkingLots
    .map((p) => `- id: ${p.id}, name: ${p.name}, distanceMeters: ${p.distanceMeters}, price: ${p.price}, salePrice: ${p.salePrice ?? 'null'}, recommendationCount: ${p.recommendationCount}, available: ${p.available}`)
    .join('\n');

  return `תפקידך: לבחור את החניון הטוב ביותר מתוך רשימת חניונים לפי המרחק, מחיר, הנחה (salePrice) ומספר המלצות.

חניונים:\n${examples}

כלל בדיקה מומלצים: נמוך מרחק, מחיר נמוך, הנחה עדיפה, מספר המלצות גבוה.

אם יש חניון לא זמין, יש להעדיף חניון זמין אחר.

פלט מבוקש: JSON בלבד בפורמט {"recommendedLotId":"<id>", "explanation":"<Hebrew explanation, short>"}
`;
}

function buildRecommendationMessages(normalizedPayload) {
  return [
    {
      role: 'system',
      content: 'אתה עוזר חכם לבחירת חניונים. תחזיר JSON בלבד עם recommendedLotId, explanation, source. source חייב להיות openai.',
    },
    {
      role: 'user',
      content: buildPrompt(normalizedPayload),
    },
  ];
}

function buildFollowupMessages(payload, parsedConversation) {
  const parkingLotSummary = payload.parkingLotsInRadius
    .map((lot) => `- ${lot.id}: ${lot.name}, מרחק ${lot.distanceMeters} מ', מחיר ₪${lot.price}, הנחה ${lot.salePrice ?? 'אין'}, המלצות ${lot.recommendationCount}, זמין ${lot.available ? 'כן' : 'לא'}`)
    .join('\n');

  return [
    {
      role: 'system',
      content:
        'אתה ממשיך שיחה בעברית על חניונים. ענה קצר, ברור, ואישי. תסביר למה נבחר החניון, ותוכל להשוות בין חניונים אם נשאלת. אם המשתמש שואל על אותו חניון, הסתמך על נתוני ההקשר. החזר טקסט רגיל ולא JSON.',
    },
    {
      role: 'system',
      content: `הקשר ההמלצה:\nselectedLotId: ${payload.selectedLotId ?? 'null'}\nradiusMeters: ${payload.radiusMeters ?? 'null'}\nparkingLotsInRadius:\n${parkingLotSummary}`,
    },
    ...parsedConversation,
  ];
}

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function scoreParkingLot(lot) {
  const distancePenalty = Math.max(0, Number(lot.distanceMeters) || 0) * 0.03;
  const pricePenalty = Math.max(0, Number(lot.price) || 0) * 1.2;
  const saleBonus = lot.salePrice != null ? 8 : 0;
  const recommendationBonus = Math.max(0, Number(lot.recommendationCount) || 0) * 0.4;
  const availabilityPenalty = lot.available ? 0 : 100;

  return 100 - distancePenalty - pricePenalty + saleBonus + recommendationBonus - availabilityPenalty;
}

function rankParkingLots(parkingLots) {
  return [...parkingLots]
    .map((lot) => ({
      ...lot,
      score: scoreParkingLot(lot),
    }))
    .sort((a, b) => b.score - a.score);
}

function localRank(parkingLots) {
  let best = null;
  const rankedLots = rankParkingLots(parkingLots);

  for (const p of rankedLots) {
    const score = p.score;
    if (!best || score > best.score) {
      best = { lot: p, score };
    }
  }
  return {
    recommendedLotId: best?.lot?.id ?? null,
    explanation: `נבחר על סמך דירוג מקומי (קרבה, מחיר, מבצעים והמלצות).`,
    source: 'local',
    rankedLots: rankedLots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      score: lot.score,
      distanceMeters: lot.distanceMeters,
      price: lot.price,
      salePrice: lot.salePrice,
      recommendationCount: lot.recommendationCount,
      available: lot.available,
    })),
  };
}

export async function getRecommendation(payload) {
  const normalizedPayload = normalizeRecommendationPayload(payload);
  const parkingLots = normalizedPayload.parkingLots;

  if (!Array.isArray(parkingLots) || parkingLots.length === 0) {
    return { recommendedLotId: null, explanation: 'אין חניונים ברדיוס המבוקש', source: 'local' };
  }

  try {
    const ai = await callOpenAI(buildRecommendationMessages(normalizedPayload));
    const text = ai?.choices?.[0]?.message?.content ?? ai?.choices?.[0]?.text ?? JSON.stringify(ai);
    const parsed = tryParseJSON(text);
    if (parsed && parsed.recommendedLotId) {
      return {
        recommendedLotId: parsed.recommendedLotId,
        explanation: parsed.explanation ?? 'התקבלה המלצה מהמודל',
        source: 'openai',
        rankedLots: rankParkingLots(parkingLots).map((lot) => ({
          id: lot.id,
          name: lot.name,
          score: lot.score,
          distanceMeters: lot.distanceMeters,
          price: lot.price,
          salePrice: lot.salePrice,
          recommendationCount: lot.recommendationCount,
          available: lot.available,
        })),
        raw: text,
      };
    }
  } catch (e) {
    console.warn('OpenAI failed, falling back to local ranking', e?.message ?? e);
  }

  // fallback
  return localRank(parkingLots);
}

export async function getFollowupResponse(payload) {
  const normalizedPayload = normalizeRecommendationPayload(payload);
  const parkingLots = normalizedPayload.parkingLots;
  const priorMessages = Array.isArray(payload?.messages)
    ? payload.messages
        .filter((message) => message && typeof message.role === 'string' && typeof message.content === 'string')
        .map((message) => ({ role: message.role, content: message.content }))
    : [];

  if (payload?.source !== 'openai') {
    return {
      source: 'local',
      reply: 'כרגע אפשר להמשיך שיחה רק אם ההמלצה הראשונית הגיעה מה־OpenAI. כרגע התקבלה תשובה מקומית.',
    };
  }

  if (!parkingLots.length) {
    return {
      source: 'local',
      reply: 'אין מספיק נתונים להמשך שיחה כרגע.',
    };
  }

  const followupMessages = buildFollowupMessages(normalizedPayload, priorMessages);

  try {
    const ai = await callOpenAI(followupMessages, process.env.OPENAI_MODEL || 'gpt-4o-mini');
    const reply = ai?.choices?.[0]?.message?.content ?? 'לא הצלחתי לנסח תשובה כרגע';
    return {
      source: 'openai',
      reply,
    };
  } catch (e) {
    console.warn('OpenAI follow-up failed', e?.message ?? e);
    return {
      source: 'local',
      reply: 'לא הצלחתי להמשיך את השיחה כרגע. נסה שוב כששרת המודל זמין.',
    };
  }
}
