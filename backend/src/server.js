import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, closeDB, query } from './database/db.js';
import publicRoutes from './routes/public.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import paymentRoutes, { processMercadoPagoWebhook } from './routes/payment.routes.js';
import { releaseExpiredReservations } from './services/orderService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3002);

app.set('trust proxy', 1);

const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || 'https://odontekstore.com,https://www.odontekstore.com,http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origem não permitida pelo CORS.'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  immutable: false
}));

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'postgresql', service: 'odontek-api' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.post('/api/webhooks/mercadopago', processMercadoPagoWebhook);
app.use('/api', publicRoutes);
app.use('/api/pagamentos', paymentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error.statusCode || 500);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    message: status >= 500 ? 'Erro interno do servidor.' : error.message,
    ...(process.env.NODE_ENV !== 'production' && error.details ? { details: error.details } : {})
  });
});

await initDB();
await releaseExpiredReservations().catch(console.error);

const reservationTimer = setInterval(() => {
  releaseExpiredReservations().catch((error) => console.error('Erro ao revisar reservas:', error.message));
}, 5 * 60 * 1000);
reservationTimer.unref();

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Odontek API rodando em http://127.0.0.1:${PORT}`);
});

async function shutdown(signal) {
  console.log(`\nEncerrando backend (${signal})...`);
  clearInterval(reservationTimer);
  server.close(async () => {
    try {
      await closeDB();
      console.log('Conexões PostgreSQL encerradas com segurança.');
      process.exit(0);
    } catch (error) {
      console.error('Erro ao fechar PostgreSQL:', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
