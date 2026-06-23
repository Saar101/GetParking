import { callOpenAI } from './openaiClient.js';

function normalizePricingTier(tier) {
  if (!tier || typeof tier !== 'object') {
    return null;
  }

  const price = Number(tier.price);
  const durationUnit = tier.durationUnit === 'minutes' || tier.durationUnit === 'hours' || tier.durationUnit === 'day'
    ? tier.durationUnit
    : 'hours';
  const durationValue = durationUnit === 'day'
    ? 1
    : Math.max(1, Math.round(Number(tier.durationValue ?? 1) || 1));

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    price,
    durationUnit,
    durationValue,
    label: typeof tier.label === 'string' && tier.label.trim() ? tier.label.trim() : null,
  };
}

function normalizePricingTiers(tiers) {
  if (!Array.isArray(tiers)) {
    return [];
  }

  return tiers
    .map(normalizePricingTier)
    .filter(Boolean);
}

function formatTierLabel(tier) {
  if (!tier) {
    return '';
  }

  if (tier.label) {
    return tier.label;
  }

  if (tier.durationUnit === 'day') {
    return 'עד יום שלם';
  }

  if (tier.durationUnit === 'minutes') {
    return `עד ${tier.durationValue} דקות`;
  }

  if (tier.durationValue === 1) {
    return 'עד שעה';
  }

  return `עד ${tier.durationValue} שעות`;
}

function formatTierSummary(tiers) {
  if (!tiers.length) {
    return 'אין';
  }

  return tiers
    .map((tier) => `₪${tier.price} ${formatTierLabel(tier)}`)
    .join(', ');
}

function normalizeParkingLot(lot) {
  const distanceMeters = Number(lot?.distanceMeters ?? lot?.distance ?? lot?.distanceValue ?? 0);
  const price = Number(lot?.basePrice ?? lot?.price ?? 0);
  const salePrice = lot?.salePrice == null ? null : Number(lot.salePrice);
  const recommendationCount = Number(lot?.recommendationCount ?? lot?.recommendations ?? lot?.reviews ?? 0);
  const basePricingTiers = normalizePricingTiers(lot?.basePricingTiers);
  const salePricingTiers = normalizePricingTiers(lot?.salePricingTiers);
  const activeSalePricingTiers = normalizePricingTiers(lot?.activeSalePricingTiers);

  return {
    id: String(lot?.id ?? lot?.parkingLotId ?? ''),
    name: String(lot?.name ?? lot?.title ?? ''),
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : 0,
    price: Number.isFinite(price) ? price : 0,
    salePrice: Number.isFinite(salePrice) ? salePrice : null,
    pricingLabel: typeof lot?.pricingLabel === 'string' ? lot.pricingLabel : null,
    salePricingLabel: typeof lot?.salePricingLabel === 'string' ? lot.salePricingLabel : null,
    basePricingTiers,
    salePricingTiers,
    activeSalePricingTiers,
    saleStartsAt: lot?.saleStartsAt ?? null,
    saleEndsAt: lot?.saleEndsAt ?? null,
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
    .map((p) => `- id: ${p.id}, name: ${p.name}, distanceMeters: ${p.distanceMeters}, price: ${p.price}, pricingLabel: ${p.pricingLabel ?? 'null'}, salePrice: ${p.salePrice ?? 'null'}, salePricingLabel: ${p.salePricingLabel ?? 'null'}, basePricingTiers: ${formatTierSummary(p.basePricingTiers)}, salePricingTiers: ${formatTierSummary(p.salePricingTiers)}, activeSalePricingTiers: ${formatTierSummary(p.activeSalePricingTiers)}, saleWindow: ${p.saleStartsAt ?? 'null'} -> ${p.saleEndsAt ?? 'null'}, recommendationCount: ${p.recommendationCount}, available: ${p.available}`)
    .join('\n');

  return `תפקידך: לבחור את החניון הטוב ביותר מתוך רשימת חניונים לפי המרחק, כל מדרגות המחיר, מדרגות המבצע, זמינות ומספר המלצות.

חניונים:\n${examples}

כללי בדיקה מומלצים: נמוך מרחק, מחיר נמוך, מבצע אמיתי עדיף רק בטווחים שהוא מכסה, מספר המלצות גבוה.

חשוב: אם יש basePricingTiers / salePricingTiers / activeSalePricingTiers, אלה הנתונים העיקריים לחישוב. אל תסתמך רק על price או salePrice אם יש מדרגות מפורטות.

אם יש חניון לא זמין, יש להעדיף חניון זמין אחר.

פלט מבוקש: JSON בלבד בפורמט {"recommendedLotId":"<id>", "explanation":"<Hebrew explanation, short>"}
`;
}

function buildRecommendationMessages(normalizedPayload) {
  return [
    {
      role: 'system',
      content: 'אתה עוזר חכם לבחירת חניונים. תחזיר אובייקט JSON תקין בלבד עם שני שדות בדיוק: recommendedLotId, explanation.',
    },
    {
      role: 'user',
      content: buildPrompt(normalizedPayload),
    },
  ];
}

function buildFollowupMessages(payload, parsedConversation) {
  const parkingLots = Array.isArray(payload?.parkingLots)
    ? payload.parkingLots
    : Array.isArray(payload?.parkingLotsInRadius)
      ? payload.parkingLotsInRadius
      : [];

  const parkingLotSummary = parkingLots
    .map((lot) => `- ${lot.id}: ${lot.name}, מרחק ${lot.distanceMeters} מ', מחיר מוביל ₪${lot.price} ${lot.pricingLabel ?? ''}, מבצע מוביל ${lot.salePrice != null ? `₪${lot.salePrice} ${lot.salePricingLabel ?? ''}` : 'אין'}, מדרגות בסיס: ${formatTierSummary(lot.basePricingTiers)}, מדרגות מבצע: ${formatTierSummary(lot.salePricingTiers)}, מדרגות מבצע פעילות: ${formatTierSummary(lot.activeSalePricingTiers)}, חלון מבצע: ${lot.saleStartsAt ?? 'null'} -> ${lot.saleEndsAt ?? 'null'}, המלצות ${lot.recommendationCount}, זמין ${lot.available ? 'כן' : 'לא'}`)
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
    const cleanedText = String(text ?? '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '');

    if (cleanedText !== String(text ?? '').trim()) {
      try {
        return JSON.parse(cleanedText);
      } catch (innerError) {
        return null;
      }
    }

    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slicedText = cleanedText.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slicedText);
      } catch (innerError) {
        return null;
      }
    }

    return null;
  }
}

function normalizeAIRecommendation(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const recommendedLotId = parsed.recommendedLotId ?? parsed.lotId ?? parsed.id ?? null;
  const explanation = typeof parsed.explanation === 'string'
    ? parsed.explanation
    : typeof parsed.reason === 'string'
      ? parsed.reason
      : typeof parsed.message === 'string'
        ? parsed.message
        : null;

  if (!recommendedLotId) {
    return null;
  }

  return {
    recommendedLotId: String(recommendedLotId),
    explanation: explanation ?? 'התקבלה המלצה מהמודל',
  };
}

function scoreParkingLot(lot) {
  const distancePenalty = Math.max(0, Number(lot.distanceMeters) || 0) * 0.03;
  const pricePenalty = Math.max(0, Number(lot.price) || 0) * 1.2;
  const saleBonus = Array.isArray(lot.activeSalePricingTiers) && lot.activeSalePricingTiers.length > 0 ? 8 : lot.salePrice != null ? 6 : 0;
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

function localRank(parkingLots, sourceReason = 'local_rank') {
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
    sourceReason,
    rankedLots: rankedLots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      score: lot.score,
      distanceMeters: lot.distanceMeters,
      price: lot.price,
      salePrice: lot.salePrice,
      pricingLabel: lot.pricingLabel,
      salePricingLabel: lot.salePricingLabel,
      basePricingTiers: lot.basePricingTiers,
      salePricingTiers: lot.salePricingTiers,
      activeSalePricingTiers: lot.activeSalePricingTiers,
      saleStartsAt: lot.saleStartsAt,
      saleEndsAt: lot.saleEndsAt,
      recommendationCount: lot.recommendationCount,
      available: lot.available,
    })),
  };
}

export async function getRecommendation(payload) {
  const normalizedPayload = normalizeRecommendationPayload(payload);
  const parkingLots = normalizedPayload.parkingLots;

  console.info('[GetParking Server] recommendation payload normalized', {
    radiusMeters: normalizedPayload.radiusMeters,
    selectedLotId: normalizedPayload.selectedLotId ?? null,
    lotCount: parkingLots.length,
  });

  if (!Array.isArray(parkingLots) || parkingLots.length === 0) {
    console.info('[GetParking Server] no lots available for recommendation');
    return { recommendedLotId: null, explanation: 'אין חניונים ברדיוס המבוקש', source: 'local', sourceReason: 'no_lots' };
  }

  try {
    console.info('[GetParking Server] sending recommendation prompt to OpenAI', {
      lotCount: parkingLots.length,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
    const ai = await callOpenAI(
      buildRecommendationMessages(normalizedPayload),
      process.env.OPENAI_MODEL || 'gpt-4o-mini',
      { responseFormat: { type: 'json_object' } }
    );
    const text = ai?.choices?.[0]?.message?.content ?? ai?.choices?.[0]?.text ?? JSON.stringify(ai);
    console.info('[GetParking Server] received recommendation response from OpenAI', {
      hasText: Boolean(text),
      textPreview: String(text).slice(0, 160),
    });
    const parsed = normalizeAIRecommendation(tryParseJSON(text));
    if (parsed && parsed.recommendedLotId) {
      console.info('[GetParking Server] parsed OpenAI recommendation successfully', {
        recommendedLotId: parsed.recommendedLotId,
      });
      return {
        recommendedLotId: parsed.recommendedLotId,
        explanation: parsed.explanation ?? 'התקבלה המלצה מהמודל',
        source: 'openai',
        sourceReason: 'openai_success',
        rankedLots: rankParkingLots(parkingLots).map((lot) => ({
          id: lot.id,
          name: lot.name,
          score: lot.score,
          distanceMeters: lot.distanceMeters,
          price: lot.price,
          salePrice: lot.salePrice,
          pricingLabel: lot.pricingLabel,
          salePricingLabel: lot.salePricingLabel,
          basePricingTiers: lot.basePricingTiers,
          salePricingTiers: lot.salePricingTiers,
          activeSalePricingTiers: lot.activeSalePricingTiers,
          saleStartsAt: lot.saleStartsAt,
          saleEndsAt: lot.saleEndsAt,
          recommendationCount: lot.recommendationCount,
          available: lot.available,
        })),
        raw: text,
      };
    }
  } catch (e) {
    console.warn('[GetParking Server] OpenAI failed, falling back to local ranking', e?.message ?? e);
  }

  // fallback
  return localRank(parkingLots, 'openai_failed');
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
    console.info('[GetParking Server] follow-up blocked because source is local');
    return {
      source: 'local',
      sourceReason: 'followup_blocked_local',
      reply: 'כרגע אפשר להמשיך שיחה רק אם ההמלצה הראשונית הגיעה מה־OpenAI. כרגע התקבלה תשובה מקומית.',
    };
  }

  if (!parkingLots.length) {
    return {
      source: 'local',
      sourceReason: 'no_lots',
      reply: 'אין מספיק נתונים להמשך שיחה כרגע.',
    };
  }

  const followupMessages = buildFollowupMessages(normalizedPayload, priorMessages);

  try {
    console.info('[GetParking Server] sending follow-up prompt to OpenAI', {
      messageCount: followupMessages.length,
      lotCount: parkingLots.length,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
    const ai = await callOpenAI(followupMessages, process.env.OPENAI_MODEL || 'gpt-4o-mini');
    const reply = ai?.choices?.[0]?.message?.content ?? 'לא הצלחתי לנסח תשובה כרגע';
    console.info('[GetParking Server] received follow-up response from OpenAI', {
      hasReply: Boolean(reply),
      replyPreview: String(reply).slice(0, 160),
    });
    return {
      source: 'openai',
      sourceReason: 'openai_followup_success',
      reply,
    };
  } catch (e) {
    console.warn('[GetParking Server] OpenAI follow-up failed', e?.message ?? e);
    return {
      source: 'local',
      sourceReason: 'openai_followup_failed',
      reply: 'לא הצלחתי להמשיך את השיחה כרגע. נסה שוב כששרת המודל זמין.',
    };
  }
}
