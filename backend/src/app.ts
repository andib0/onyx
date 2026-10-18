import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalRateLimiter, logProxyChainShape } from './middleware/rateLimit.js';
import { env } from './config/env.js';

const app = express();

// Behind Render's proxy: trust exactly TRUST_PROXY_HOPS entries of
// X-Forwarded-For (a hop count, never `true`, so a client-prepended value is
// never req.ip). Default 1; see middleware/rateLimit.ts and audit F7.
app.set('trust proxy', env.TRUST_PROXY_HOPS);

// Security middleware
app.use(helmet());

// Native app requests carry no Origin header, so they always pass; this list
// only matters for browser clients (e.g. Expo web during development).
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Rate limiting before any body parsing, so floods are cheap to reject.
app.use(logProxyChainShape);
app.use(generalRateLimiter);

// Parsing middleware. Bodies are small everywhere except the full-state
// import, which alone gets 10 MB (audit F6).
export const IMPORT_PATH = '/api/sync/import';
const smallJson = express.json({ limit: '100kb' });
const largeJson = express.json({ limit: '10mb' });
app.use((req, res, next) =>
  req.path === IMPORT_PATH ? largeJson(req, res, next) : smallJson(req, res, next)
);
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// API routes
app.use('/api', routes);

// Unknown API paths get the JSON envelope, not Express' HTML page.
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use(errorHandler);

export default app;
