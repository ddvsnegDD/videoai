import express from 'express';
import cookieParser from 'cookie-parser';
import { resolve, join } from 'path';

const app = express();
const DIST = resolve('dist');

app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static(DIST));
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3000;

async function start() {
  app.listen(PORT, () => {
    console.log(`VideoAI server running on port ${PORT}`);
  });
}

start();
