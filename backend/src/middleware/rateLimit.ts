import { isIP } from 'node:net';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/*
 * Client identity for rate limiting (audit F7).
 *
 * The key is always `req.ip`, which Express derives from X-Forwarded-For using
 * the `trust proxy` hop count set in app.ts (TRUST_PROXY_HOPS). With N hops
 * Express walks N entries in from the right (socket address included) and
 * stops: values a client prepends to X-Forwarded-For sit further left and are
 * never used. The raw header is never read here.
 *
 * Too few hops -> clients behind the same proxy share a bucket (safe, coarse).
 * Too many hops -> a client-supplied value becomes req.ip (bypass). So the
 * default stays at the conservative 1 until the real chain is measured with
 * `logProxyChainShape` (see docs/log/backend-security.md).
 *
 * Counters live in process memory: a free-tier restart or spin-down resets
 * them. Accepted for a single-instance deploy; the window is one minute.
 */

/** IPv4 (and IPv4-mapped IPv6) as is; IPv6 collapsed to its /64. */
export function clientKey(ip: string | undefined): string {
  if (!ip) return 'unknown';
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  if (isIP(ip) !== 6) return ip;
  // One subscriber usually owns a whole /64; keying per address would let a
  // client rotate through 2^64 buckets.
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? left.concat(Array(8 - left.length - right.length).fill('0'), right)
    : left;
  return (
    groups
      .slice(0, 4)
      .map((g) => parseInt(g || '0', 16).toString(16))
      .join(':') + '::/64'
  );
}

const keyGenerator = (req: Request) => clientKey(req.ip);

const PRIVATE =
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd]|fe80:)/i;

let chainSamples = 0;
/**
 * Logs the *shape* of the proxy chain (entry count and private/public per
 * hop, never the addresses) for the first few production requests, so the
 * right TRUST_PROXY_HOPS can be read off Render's logs without exposing IPs.
 */
export function logProxyChainShape(req: Request, _res: Response, next: NextFunction) {
  if (chainSamples < 5 && process.env.NODE_ENV === 'production') {
    chainSamples += 1;
    const xff = String(req.headers['x-forwarded-for'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const socket = req.socket.remoteAddress ?? '';
    const shape = xff
      .concat(socket)
      .map((ip) => (PRIVATE.test(ip.replace(/^::ffff:/i, '')) ? 'private' : 'public'));
    console.log(`[proxy-chain] xff+socket hops=${shape.length} [${shape.join(', ')}]`);
  }
  next();
}

// API tests register many users per second; they opt out explicitly. The
// switch is ignored in production so a stray env var can't disable limits.
const skip = () =>
  process.env.DISABLE_RATE_LIMIT === '1' && process.env.NODE_ENV !== 'production';

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute for auth endpoints
  message: {
    success: false,
    error: 'Too many attempts. Please try again in a minute.',
  },
  standardHeaders: true,
  skip,
  legacyHeaders: false,
  keyGenerator,
});

/**
 * /auth/refresh is unauthenticated and does a DB write per call (audit F6).
 * A real client refreshes at most every ~15 minutes per device.
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many refresh attempts. Please try again in a minute.',
  },
  standardHeaders: true,
  skip,
  legacyHeaders: false,
  keyGenerator,
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  skip,
  legacyHeaders: false,
  keyGenerator,
});
