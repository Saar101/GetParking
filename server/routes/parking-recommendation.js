import { Router } from 'express';
import { getFollowupResponse, getRecommendation } from '../services/parkingRecommendation.service.js';

const router = Router();

function logRequest(label, req) {
  console.info(`[GetParking Server] ${label}`, {
    method: req.method,
    path: req.originalUrl,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    hasLots: Array.isArray(req.body?.parkingLotsInRadius) ? req.body.parkingLotsInRadius.length : 0,
  });
}

router.post('/parking-recommendation', async (req, res) => {
  try {
    logRequest('received recommendation request', req);
    const payload = req.body;
    const result = await getRecommendation(payload);
    console.info('[GetParking Server] sending recommendation response', {
      source: result.source,
      sourceReason: result.sourceReason ?? null,
      recommendedLotId: result.recommendedLotId ?? null,
    });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

router.post('/parking-recommendation-followup', async (req, res) => {
  try {
    logRequest('received follow-up request', req);
    const payload = req.body;
    const result = await getFollowupResponse(payload);
    console.info('[GetParking Server] sending follow-up response', {
      source: result.source,
      sourceReason: result.sourceReason ?? null,
    });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

export default router;
