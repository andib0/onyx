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

// Parsing middleware
app.use(express.json({ limit: '10mb' })); // Larger limit for import
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
app.use(generalRateLimiter);

// API routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

export default app;
