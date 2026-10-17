import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalRateLimiter } from './middleware/rateLimit.js';

const app = express();

// Behind Render's proxy — needed so rate limiting keys on the client IP,
// not the proxy's, and secure cookies work over the forwarded proto.
app.set('trust proxy', 1);

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
