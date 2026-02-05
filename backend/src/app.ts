import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalRateLimiter } from './middleware/rateLimit.js';

const app = express();

// Security middleware
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

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
