import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import recommendationRouter from './routes/parking-recommendation.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', recommendationRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PARKING_API_PORT || process.env.PORT || 5175;
app.listen(port, () => console.log(`Server listening on ${port}`));
