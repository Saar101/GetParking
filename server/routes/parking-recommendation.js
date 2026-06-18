import { Router } from 'express';
import { getFollowupResponse, getRecommendation } from '../services/parkingRecommendation.service.js';

const router = Router();

router.post('/parking-recommendation', async (req, res) => {
  try {
    const payload = req.body;
    const result = await getRecommendation(payload);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

router.post('/parking-recommendation-followup', async (req, res) => {
  try {
    const payload = req.body;
    const result = await getFollowupResponse(payload);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

export default router;
