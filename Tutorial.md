# Onyx Backend Tutorial

> A step-by-step guide for a frontend JS engineer to understand how this Express + TypeScript + Prisma + PostgreSQL backend works, how we built it, and how we deployed it.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Tech Stack Explained](#2-tech-stack-explained)
3. [Project Structure](#3-project-structure)
4. [How the Server Starts](#4-how-the-server-starts)
5. [The Middleware Chain](#5-the-middleware-chain)
6. [Routing: How URLs Map to Code](#6-routing-how-urls-map-to-code)
7. [The Service-Controller Pattern](#7-the-service-controller-pattern)
8. [Authentication Deep Dive](#8-authentication-deep-dive)
9. [Prisma & The Database](#9-prisma--the-database)
10. [How Frontend Talks to Backend](#10-how-frontend-talks-to-backend)
11. [What We Built Together](#11-what-we-built-together)
12. [Deployment: How We Went Live](#12-deployment-how-we-went-live)
13. [Key Patterns to Remember](#13-key-patterns-to-remember)

---

## 1. The Big Picture

Think of a restaurant:

- **Frontend (React)** = the dining room where customers sit
- **Backend (Express)** = the kitchen where food is prepared
- **Database (PostgreSQL)** = the pantry where ingredients are stored
- **Prisma** = the inventory system that tracks what's in the pantry
- **JWT Tokens** = the ticket system that proves you ordered something

When you click a button in the React app, here's what happens:

```
React App  →  HTTP Request  →  Express Server  →  Prisma  →  PostgreSQL
   ↑                                                              |
   └──────────────  HTTP Response (JSON)  ←───────────────────────┘
```

Every request goes through this pipeline:

```
Request → Helmet → CORS → JSON Parser → Cookie Parser → Rate Limiter → Auth Check → Controller → Service → Database
```

---

## 2. Tech Stack Explained

| Tool | What It Does | Frontend Equivalent |
|------|-------------|-------------------|
| **Express** | HTTP server framework | Like React Router but for the server |
| **TypeScript** | Type safety | Same as frontend TS |
| **Prisma** | Database ORM (talks to PostgreSQL) | Like a typed API client but for databases |
| **PostgreSQL** | Relational database | Like localStorage but persistent, structured, and shared |
| **JWT** | Authentication tokens | Like a VIP wristband at a concert |
| **bcrypt** | Password hashing | Scrambles passwords so nobody can read them |
| **Zod** | Input validation | Like form validation but on the server |
| **Helmet** | Security headers | Sets HTTP headers that protect against common attacks |
| **CORS** | Cross-origin control | Decides which domains can talk to your API |

---

## 3. Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database models (like TypeScript interfaces for your DB)
│   └── seed/
│       ├── index.ts           # Seeds the DB with initial data
│       ├── foods.ts           # 183 foods with nutrition info
│       ├── supplements.ts     # 66+ supplements with dosage info
│       └── programs.ts        # 6 gym programs with exercises
│
├── src/
│   ├── server.ts              # Entry point: starts everything
│   ├── app.ts                 # Express app: middleware + routes
│   │
│   ├── config/
│   │   ├── database.ts        # Prisma client setup + connect/disconnect
│   │   └── env.ts             # Environment variable validation
│   │
│   ├── middleware/
│   │   ├── auth.ts            # Checks JWT token on protected routes
│   │   ├── errorHandler.ts    # Catches unhandled errors
│   │   └── rateLimit.ts       # Prevents spam (100 req/min)
│   │
│   ├── routes/
│   │   ├── index.ts           # Mounts all route modules at /api
│   │   ├── auth.routes.ts     # /api/auth/*
│   │   ├── meals.routes.ts    # /api/meals/*
│   │   ├── schedule.routes.ts # /api/schedule/*
│   │   └── ...                # 8 more route files
│   │
│   ├── controllers/           # Handle HTTP request/response
│   │   ├── auth.controller.ts
│   │   ├── meals.controller.ts
│   │   └── ...
│   │
│   ├── services/              # Business logic + database queries
│   │   ├── auth.service.ts
│   │   ├── meals.service.ts
│   │   └── ...
│   │
│   ├── validators/
│   │   └── auth.schema.ts     # Zod schemas for input validation
│   │
│   ├── utils/
│   │   ├── jwt.ts             # Generate/verify JWT tokens
│   │   ├── password.ts        # Hash/compare passwords with bcrypt
│   │   └── response.ts        # Standardized JSON response helpers
│   │
│   └── types/
│       └── index.ts           # TypeScript interfaces
│
├── package.json
├── tsconfig.json
├── render.yaml                # Deployment config for Render
└── .env                       # Secrets (never committed to git)
```

---

## 4. How the Server Starts

### Step 1: `server.ts` — The entry point

```typescript
import 'dotenv/config';        // Loads .env file into process.env
import app from './app.js';     // The Express app
import { connectDatabase } from './config/database.js';

const PORT = process.env.PORT || 3001;

async function main() {
  await connectDatabase();      // Connect to PostgreSQL via Prisma

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);
```

**What's happening**: Load environment variables → connect to database → start listening for HTTP requests.

### Step 2: `config/database.ts` — Prisma connection

```typescript
import { PrismaClient } from '@prisma/client';

// One Prisma instance for the whole app (singleton pattern)
export const prisma = new PrismaClient();

export async function connectDatabase() {
  await prisma.$connect();     // Opens connection pool to PostgreSQL
  console.log('Database connected successfully');
}
```

**Why a singleton?** You only want ONE connection pool to the database, not a new connection per request. This `prisma` object is imported everywhere.

### Step 3: `app.ts` — The middleware chain

```typescript
const app = express();

app.use(helmet());             // 1. Security headers
app.use(cors({ ... }));        // 2. Allow frontend origin
app.use(express.json());       // 3. Parse JSON bodies
app.use(cookieParser());       // 4. Parse cookies
app.use(generalRateLimiter);   // 5. Rate limiting
app.use('/api', routes);       // 6. All our routes
app.use(errorHandler);         // 7. Catch-all error handler
```

**Key concept**: `app.use()` adds middleware. Each request passes through these in ORDER, top to bottom. Think of it like a pipeline — each step can modify the request, block it, or pass it along with `next()`.

---

## 5. The Middleware Chain

### What is middleware?

Middleware is a function that sits between the request and your route handler. It's like a bouncer at a club — it can let you in, turn you away, or check your ID before you enter.

```typescript
// Every middleware has this signature:
function myMiddleware(req, res, next) {
  // Do something with the request
  // Then either:
  next();              // Pass to next middleware
  // OR:
  res.status(403).json({ error: 'Nope' });  // Block the request
}
```

### Helmet — Security headers

```typescript
app.use(helmet());
```

Automatically sets HTTP headers like `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, etc. These prevent common web attacks. You don't configure it — it just works.

### CORS — Who can call your API

```typescript
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);      // Allow
    } else {
      callback(new Error('Not allowed by CORS'));  // Block
    }
  },
  credentials: true,  // Allow cookies to be sent cross-origin
}));
```

**Why this matters**: Without CORS, browsers block requests from `localhost:5173` (frontend) to `localhost:3001` (backend) because they're different origins. `credentials: true` is critical — it allows the httpOnly cookie (refresh token) to be sent with requests.

### Auth Middleware — The Bouncer

```typescript
export function authMiddleware(req, res, next) {
  // 1. Get the token from the Authorization header
  const authHeader = req.headers.authorization;
  // Header looks like: "Bearer eyJhbGciOi..."

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'No token provided');  // Blocked!
  }

  // 2. Extract and verify the JWT
  const token = authHeader.slice(7);  // Remove "Bearer " prefix
  const payload = verifyAccessToken(token);

  if (!payload) {
    return sendUnauthorized(res, 'Invalid or expired token');  // Blocked!
  }

  // 3. Attach user info to the request object
  req.userId = payload.sub;    // sub = subject = user ID
  req.user = { id: payload.sub, email: payload.email };

  next();  // Let them through!
}
```

**This is applied to protected routes only.** Public routes (login, register, health check) skip this.

### Rate Limiter — Spam Protection

```typescript
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 100,               // Max 100 requests per minute per IP
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,                 // Only 5 login/register attempts per minute
});
```

Prevents brute-force attacks on login and general API abuse.

---

## 6. Routing: How URLs Map to Code

### The Route Tree

```
/api
├── /auth
│   ├── POST /register       → auth.controller.register
│   ├── POST /login          → auth.controller.login
│   ├── POST /refresh        → auth.controller.refresh
│   ├── POST /logout         → auth.controller.logout      [protected]
│   └── GET  /me             → auth.controller.me           [protected]
│
├── /meals                    [all protected]
│   ├── GET    /templates     → meals.controller.getTemplates
│   ├── POST   /templates     → meals.controller.createTemplate
│   ├── PUT    /templates/:id → meals.controller.updateTemplate
│   ├── PATCH  /templates/:id/grams → meals.controller.updateGrams
│   ├── DELETE /templates/:id → meals.controller.deleteTemplate
│   ├── GET    /logs          → meals.controller.getLogs
│   └── POST   /:id/log      → meals.controller.toggleLog
│
├── /schedule                 [all protected]
│   ├── GET    /              → schedule.controller.getBlocks
│   ├── POST   /              → schedule.controller.createBlock
│   ├── PUT    /:id           → schedule.controller.updateBlock
│   ├── DELETE /:id           → schedule.controller.deleteBlock
│   ├── GET    /completions   → schedule.controller.getCompletions
│   └── POST   /completions   → schedule.controller.toggleCompletion
│
├── /foods                    [all protected]
│   ├── GET    /              → foods.controller.searchFoods
│   └── GET    /:id           → foods.controller.getFood
│
├── /programs                 [all protected]
│   ├── GET    /              → programs.controller.listPrograms
│   └── GET    /:id           → programs.controller.getProgram
│
├── /supplement-db            [all protected]
│   └── GET    /              → supplementDb.controller.listSupplements
│
└── /health                   [public]
    └── GET    /              → { status: 'ok' }
```

### How a route file works

```typescript
// meals.routes.ts
import { Router } from 'express';
import { getTemplates, createTemplate, ... } from '../controllers/meals.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);  // ALL routes in this file require authentication

router.get('/templates', getTemplates);         // GET  /api/meals/templates
router.post('/templates', createTemplate);       // POST /api/meals/templates
router.put('/templates/:id', updateTemplate);    // PUT  /api/meals/templates/abc-123
router.patch('/templates/:id/grams', updateGrams); // PATCH /api/meals/templates/abc-123/grams
router.delete('/templates/:id', deleteTemplate); // DELETE /api/meals/templates/abc-123

export default router;
```

**`:id` is a route parameter.** When someone hits `/api/meals/templates/abc-123`, Express makes `req.params.id = "abc-123"`.

### HTTP Methods Cheat Sheet

| Method | Purpose | Example |
|--------|---------|---------|
| GET | Read data | Get all meals |
| POST | Create new | Add a new meal |
| PUT | Replace/update | Update a whole meal |
| PATCH | Partial update | Update just the grams |
| DELETE | Remove | Delete a meal |

---

## 7. The Service-Controller Pattern

This is the most important architecture pattern in this backend. Every feature follows the same flow:

```
Route → Controller → Service → Database
```

### Controller = Handles HTTP stuff

The controller's job is simple:
1. Extract data from the request (params, query, body)
2. Call the service
3. Send a response

```typescript
// controllers/meals.controller.ts
export async function getTemplates(req: AuthenticatedRequest, res: Response) {
  try {
    // 1. Extract data from request
    const dayOfWeek = req.query.day as string | undefined;

    // 2. Call service (req.userId comes from auth middleware)
    const templates = await mealsService.getTemplates(req.userId!, dayOfWeek);

    // 3. Send response
    return sendSuccess(res, templates);
  } catch (error) {
    return sendError(res, 'Failed to get meal templates', 500);
  }
}
```

### Service = Business logic + Database

The service doesn't know about HTTP, requests, or responses. It just does work.

```typescript
// services/meals.service.ts
export class MealsService {
  async getTemplates(userId: string, dayOfWeek?: string) {
    // Build the query filter
    const where: { userId: string; dayOfWeek?: string } = { userId };
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;

    // Query the database
    return prisma.mealTemplate.findMany({
      where,
      include: { tags: true },          // Also fetch related tags
      orderBy: [{ sortOrder: 'asc' }],  // Sort by order
    });
  }
}
```

### Why separate them?

- **Testability**: You can test business logic without HTTP
- **Reusability**: Multiple controllers can use the same service
- **Clarity**: Each file has one job

### Response Helpers

Every API response follows the same format:

```typescript
// Success:
{ "success": true, "data": { ... }, "message": "optional" }

// Error:
{ "success": false, "error": "What went wrong" }
```

The helpers enforce this:

```typescript
sendSuccess(res, data);           // 200 + { success: true, data }
sendCreated(res, data);           // 201 + { success: true, data }
sendError(res, 'Bad input');      // 400 + { success: false, error }
sendUnauthorized(res);            // 401 + { success: false, error }
sendNotFound(res);                // 404 + { success: false, error }
```

---

## 8. Authentication Deep Dive

This is the most complex part of the backend. Here's how it works end-to-end.

### The Two-Token Strategy

We use **two tokens** because each solves a different problem:

| | Access Token | Refresh Token |
|---|---|---|
| **Stored in** | JavaScript memory | httpOnly cookie |
| **Lifetime** | 15 minutes | 7 days |
| **Sent via** | `Authorization: Bearer xxx` header | Automatically by browser (cookie) |
| **Can JavaScript read it?** | Yes (needed for Authorization header) | No (httpOnly prevents XSS) |
| **If stolen** | Attacker has 15 min access | Can't be stolen via XSS |

### Registration Flow

```
Frontend                          Backend                        Database
   |                                |                               |
   |  POST /auth/register           |                               |
   |  { email, password, username } |                               |
   |  ----------------------------→ |                               |
   |                                |  Validate with Zod            |
   |                                |  Hash password (bcrypt 12)    |
   |                                |                               |
   |                                |  INSERT User                  |
   |                                |  ----------------------------→|
   |                                |                               |
   |                                |  Generate access token (15m)  |
   |                                |  Generate refresh token (7d)  |
   |                                |  Hash the refresh token       |
   |                                |                               |
   |                                |  INSERT RefreshToken (hashed) |
   |                                |  ----------------------------→|
   |                                |                               |
   |  Set-Cookie: refreshToken=xxx  |                               |
   |  { accessToken, user }         |                               |
   |  ←---------------------------- |                               |
   |                                |                               |
   |  Store accessToken in memory   |                               |
   |  Cookie stored by browser      |                               |
```

### Login Flow

Same as registration, but instead of creating a user, it:
1. Looks up user by email
2. Compares password with stored hash using `bcrypt.compare()`
3. Generates new tokens

### Making Authenticated Requests

```
Frontend                          Backend
   |                                |
   |  GET /api/meals/templates      |
   |  Authorization: Bearer <token> |
   |  Cookie: refreshToken=xxx      |  ← Browser sends automatically
   |  ----------------------------→ |
   |                                |
   |                                |  authMiddleware:
   |                                |  1. Extract "Bearer xxx" from header
   |                                |  2. jwt.verify(token, secret)
   |                                |  3. Attach req.userId = payload.sub
   |                                |  4. next()
   |                                |
   |                                |  Controller → Service → DB
   |                                |
   |  { success: true, data: [...] }|
   |  ←---------------------------- |
```

### Token Refresh (the clever part)

After 15 minutes, the access token expires. Here's what happens transparently:

```
Frontend                          Backend
   |                                |
   |  GET /api/meals/templates      |
   |  Authorization: Bearer <expired>|
   |  ----------------------------→ |
   |                                |
   |  401 Unauthorized              |
   |  ←---------------------------- |
   |                                |
   |  (Client detects 401)          |
   |                                |
   |  POST /auth/refresh            |
   |  Cookie: refreshToken=xxx      |  ← Sent automatically
   |  ----------------------------→ |
   |                                |
   |                                |  1. Read refresh token from cookie
   |                                |  2. jwt.verify(refreshToken, refreshSecret)
   |                                |  3. Find matching hash in DB
   |                                |  4. Generate NEW access token
   |                                |
   |  { accessToken: "new-token" }  |
   |  ←---------------------------- |
   |                                |
   |  (Client retries original req) |
   |                                |
   |  GET /api/meals/templates      |
   |  Authorization: Bearer <new>   |
   |  ----------------------------→ |
   |                                |
   |  { success: true, data: [...] }|
   |  ←---------------------------- |
```

The user never sees any of this — it all happens in `src/api/client.ts`.

### Password Security

```typescript
// When registering:
const hash = await bcrypt.hash("MyPassword123!", 12);
// hash = "$2a$12$LJ3m4FLuE..." (60 chars, irreversible)

// When logging in:
const isMatch = await bcrypt.compare("MyPassword123!", hash);
// isMatch = true
```

**12 salt rounds** means bcrypt runs its algorithm 2^12 = 4,096 times. This makes it computationally expensive to brute-force.

### Cookie Settings Explained

```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,    // JavaScript CAN'T read this cookie (XSS protection)
  secure: true,      // Only sent over HTTPS (production)
  sameSite: 'none',  // Allow cross-origin (Vercel → Render)
  maxAge: 604800000, // 7 days in milliseconds
  path: '/',         // Available on all paths
};
```

In development: `secure: false` + `sameSite: 'strict'` (same origin).
In production: `secure: true` + `sameSite: 'none'` (cross-origin needed because frontend and backend are on different domains).

---

## 9. Prisma & The Database

### What is Prisma?

Prisma is an ORM (Object-Relational Mapper). Instead of writing raw SQL:

```sql
SELECT * FROM "MealTemplate" WHERE "userId" = 'abc' AND "dayOfWeek" = 'Monday';
```

You write type-safe TypeScript:

```typescript
const meals = await prisma.mealTemplate.findMany({
  where: { userId: 'abc', dayOfWeek: 'Monday' },
  include: { tags: true },
});
```

Prisma generates TypeScript types from your schema, so you get autocomplete and type checking on every query.

### The Schema (your database blueprint)

`prisma/schema.prisma` defines all your tables. Here's the User model:

```prisma
model User {
  id           String   @id @default(uuid())    // Primary key, auto-generated UUID
  email        String   @unique                  // Must be unique
  passwordHash String                            // bcrypt hash
  username     String?                           // ? means nullable
  age          Int?
  weight       Decimal?
  createdAt    DateTime @default(now())          // Auto-set on creation
  updatedAt    DateTime @updatedAt               // Auto-set on update

  // Relations (one user has many of each):
  mealTemplates  MealTemplate[]
  scheduleBlocks ScheduleBlock[]
  supplements    Supplement[]
  refreshTokens  RefreshToken[]
  // ... more relations
}
```

### Common Prisma Operations

```typescript
// CREATE
const user = await prisma.user.create({
  data: { email: 'andi@test.com', passwordHash: '...' },
});

// READ (find one)
const user = await prisma.user.findUnique({
  where: { email: 'andi@test.com' },
});

// READ (find many)
const meals = await prisma.mealTemplate.findMany({
  where: { userId: 'abc', dayOfWeek: 'Monday' },
  include: { tags: true },         // JOIN with tags table
  orderBy: { sortOrder: 'asc' },   // Sort
});

// UPDATE
const updated = await prisma.mealTemplate.update({
  where: { id: 'template-123', userId: 'abc' },
  data: { grams: 150 },
});

// DELETE
await prisma.mealTemplate.delete({
  where: { id: 'template-123', userId: 'abc' },
});

// UPSERT (create if not exists, update if exists)
const log = await prisma.mealLog.upsert({
  where: {
    userId_mealTemplateId_date: {  // Composite unique key
      userId: 'abc',
      mealTemplateId: 'template-123',
      date: '2026-02-06',
    },
  },
  create: { userId: 'abc', mealTemplateId: 'template-123', date: '2026-02-06', isEaten: true },
  update: { isEaten: true },
});
```

### Schema Changes Workflow

When you change `schema.prisma`:

```bash
# Development: Push schema changes directly (no migration files)
npx prisma db push

# Regenerate the TypeScript client
npx prisma generate

# Seed reference data
npm run db:seed
```

`prisma db push` syncs the schema to the database. `prisma generate` creates the TypeScript types you use in your code.

### Relations

```prisma
model MealTemplate {
  id     String @id @default(uuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  //     ↑ TypeScript type    ↑ FK column         ↑ Points to User.id  ↑ Delete meals when user is deleted

  tags MealTemplateTag[]  // One meal has many tags
}

model MealTemplateTag {
  id             String       @id @default(uuid())
  mealTemplateId String
  mealTemplate   MealTemplate @relation(fields: [mealTemplateId], references: [id], onDelete: Cascade)
  label          String       // "Protein"
  value          String       // "32"
}
```

Using `include: { tags: true }` in a query JOINs the tags automatically:

```typescript
// Returns: { id, name, ..., tags: [{ label: "Protein", value: "32" }, ...] }
const meal = await prisma.mealTemplate.findUnique({
  where: { id: 'abc' },
  include: { tags: true },
});
```

---

## 10. How Frontend Talks to Backend

### The API Client (`src/api/client.ts`)

This is the bridge between React and Express:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Access token lives in memory (not localStorage — more secure)
let accessToken: string | null = null;

export async function apiClient(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
  };

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',  // CRITICAL: sends cookies cross-origin
  });

  // If 401, try refreshing the token
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry with the new token
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
        credentials: 'include',
      });
    }
  }

  return response.json();
}

// Convenience methods:
export const api = {
  get:    (url) => apiClient(url, { method: 'GET' }),
  post:   (url, body) => apiClient(url, { method: 'POST', body: JSON.stringify(body) }),
  put:    (url, body) => apiClient(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch:  (url, body) => apiClient(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => apiClient(url, { method: 'DELETE' }),
};
```

### Using it in React

```typescript
// src/api/meals.ts
import { api } from './client';

export function getMealTemplates(day?: string) {
  const query = day ? `?day=${day}` : '';
  return api.get(`/meals/templates${query}`);
}

export function createMealTemplate(data) {
  return api.post('/meals/templates', data);
}

export function updateMealGrams(id: string, grams: number) {
  return api.patch(`/meals/templates/${id}/grams`, { grams });
}
```

### The `credentials: 'include'` Explained

Without it, the browser won't send cookies to a different domain. Since our frontend (Vercel) and backend (Render) are on different domains, this is required for the refresh token cookie to travel with requests.

---

## 11. What We Built Together

### The 6 Features We Added

#### 1. Username, Age, Weight in Registration

**Backend changes:**

- `schema.prisma`: Added `username String?`, `age Int?`, `weight Decimal?` to User model
- `auth.schema.ts`: Added Zod validation for new fields
- `auth.service.ts`: Accept profile fields in `register()`, return them in `login()`/`getUser()`
- `auth.controller.ts`: Extract new fields from request body, pass to service

**Frontend changes:**

- `AuthView.tsx`: Added 3 new form fields (username, age, weight)
- `AuthContext.tsx`: Updated User type and register function signature
- `api/auth.ts`: Updated register API call to send profile fields

#### 2. Nutrition: Grams-Based Auto-Calculation

**Backend:**

- `schema.prisma`: Added `grams Decimal?`, `foodId String?` to MealTemplate
- `meals.service.ts`: New `updateGrams()` method that:
  1. Looks up the food's per-100g nutrition values
  2. Calculates: `protein = proteinPer100g * (grams / 100)`
  3. Deletes old tags, creates new calculated tags
- `meals.controller.ts`: New `updateGrams` handler
- `meals.routes.ts`: New `PATCH /templates/:id/grams` route

**Frontend:**

- `MealCard.tsx`: Complete rewrite — removed edit mode, added grams input with 500ms debounce
- `NutritionView/index.tsx`: Removed all edit state, added `handleGramsChange`
- `api/meals.ts`: Added `updateMealGrams()` function
- `api/client.ts`: Added `patch` method

**How the grams calculation works:**

```
User changes grams to 150 →
  Frontend debounces 500ms →
    PATCH /api/meals/templates/abc/grams { grams: 150 } →
      Backend looks up food: chicken has 31g protein/100g →
        factor = 150 / 100 = 1.5 →
          protein = 31 * 1.5 = 46.5 → rounds to 47 →
            Deletes old tags, creates: [{ label: "Protein", value: "47" }, ...] →
              Returns updated meal with new tags →
                Frontend updates UI
```

#### 3. Time Slot Picker

**Frontend only** — created `TimeSlotPicker.tsx`:

```typescript
// Generates 96 time slots: 00:00, 00:15, 00:30, ..., 23:45
const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}
```

- Replaced text inputs in `QuickActions.tsx` and `BlockItem.tsx`
- End picker filters out times ≤ start time using `minTime` prop
- Added validation: `if (start >= end) return;`

#### 4. Focus Greeting

**Frontend only** — added to `FocusView/index.tsx`:

```typescript
const getGreeting = (minutes) => {
  const hours = Math.floor(minutes / 60);
  if (hours >= 5 && hours < 12) return 'Good morning';
  if (hours >= 12 && hours < 14) return 'Good day';
  if (hours >= 14 && hours < 17) return 'Good afternoon';
  if (hours >= 17 && hours < 21) return 'Good evening';
  return 'Good night';
};
```

Uses `useAuth()` context to get the username.

#### 5. Sidebar Logout

**Frontend:**

- `Sidebar.tsx`: Restructured with `sidebarTop` (brand + nav) and `sidebarBottom` (logout button)
- `App.tsx`: Passed `onLogout={logout}` prop
- `components.css`: Added flex layout, red-colored logout button styles

#### 6. Auth Page Theming

**Frontend only** — `AuthView.css`: Complete restyle with glass morphism (backdrop-filter blur), radial gradients matching the app's dark theme, Palatino brand font, blue accent buttons.

### Production Fixes We Made

- **Cookie sameSite**: Changed from `'strict'` to `'none'` in production (required for cross-domain Vercel→Render)
- **CORS**: Updated to support multiple origins via comma-separated `CORS_ORIGIN` env var
- **TypeScript strict params**: Changed `AuthenticatedRequest` to extend `Request<Record<string, string>>` to fix Express v5 type narrowing
- **Prisma generate in build**: Added `prisma generate` to the build script
- **tsx in dependencies**: Moved from devDependencies so the seed script can run in production

---

## 12. Deployment: How We Went Live

### Architecture

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Vercel (Frontend)   │────→│  Render (Backend)    │────→│ Render PostgreSQL │
│  React + Vite        │     │  Express + Prisma    │     │  Database         │
│  onyx-bay-theta.     │     │  onyx-api-xxx.       │     │  onyx-db          │
│  vercel.app          │     │  onrender.com        │     │                   │
└──────────────────────┘     └──────────────────────┘     └──────────────────┘
```

### Vercel (Frontend)

**What it does**: Builds the React app and serves static files.

- **Build command**: `npm run build` (runs `vite build`)
- **Output**: `dist/` folder with `index.html` + JS/CSS bundles
- **Environment variable**: `VITE_API_URL=https://onyx-api-xxx.onrender.com/api`
- **Routing**: `vercel.json` rewrites all paths to `index.html` (SPA routing)

The `VITE_API_URL` is baked into the JS bundle at build time (that's how Vite env vars work — they're replaced during compilation, not read at runtime).

### Render (Backend)

**What it does**: Runs the Express server and manages the PostgreSQL database.

- **Build command**: `npm install --include=dev && npm run build`
  - `--include=dev` because Render sets `NODE_ENV=production` which skips devDependencies
  - `npm run build` runs `prisma generate && tsc` (generates Prisma client + compiles TypeScript)
- **Start command**: `npx prisma db push --skip-generate && npm run db:seed && npm start`
  - `prisma db push`: Syncs schema to production DB
  - `npm run db:seed`: Seeds reference data (idempotent — safe to run multiple times)
  - `npm start`: Runs `node dist/server.js`

**Environment variables on Render:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Internal PostgreSQL connection string |
| `JWT_SECRET` | Random 32+ char string |
| `JWT_REFRESH_SECRET` | Different random 32+ char string |
| `CORS_ORIGIN` | `https://onyx-bay-theta.vercel.app` |

### Why the CORS_ORIGIN Matters

The browser enforces same-origin policy. Without setting `CORS_ORIGIN` to the Vercel URL, the browser would block all API requests from the frontend. The backend reads this env var and tells the browser "yes, requests from this origin are allowed."

### The Cross-Domain Cookie Challenge

Since Vercel and Render are different domains, cookies need special settings:
- `secure: true` — HTTPS only
- `sameSite: 'none'` — allows cross-origin cookies
- Frontend must use `credentials: 'include'` on every fetch

This is why we had to update the cookie options for production.

---

## 13. Key Patterns to Remember

### Pattern 1: Always filter by userId

Every database query includes `userId` to ensure users only see their own data:

```typescript
// GOOD: User can only see their own meals
prisma.mealTemplate.findMany({ where: { userId: req.userId } });

// BAD: Would return ALL users' meals
prisma.mealTemplate.findMany();
```

### Pattern 2: Upsert for toggle operations

When something can be toggled (eaten/not eaten, complete/incomplete), use `upsert`:

```typescript
prisma.mealLog.upsert({
  where: { userId_mealTemplateId_date: { userId, mealTemplateId, date } },
  create: { userId, mealTemplateId, date, isEaten: true },   // First time
  update: { isEaten: true },                                   // Already exists
});
```

### Pattern 3: Cascade deletes

`onDelete: Cascade` in the schema means: when a user is deleted, ALL their meals, schedules, logs, etc. are automatically deleted too. No orphaned data.

### Pattern 4: Standardized error handling

Every controller follows this exact pattern:

```typescript
export async function handler(req, res) {
  try {
    const result = await service.doSomething(req.userId!, ...);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 'Human-readable error message');
  }
}
```

### Pattern 5: Environment-based configuration

Never hardcode secrets or URLs. Use environment variables:

```typescript
// .env (local development)
DATABASE_URL="postgresql://postgres:password@localhost:5432/daily_tracker"

// Accessed in code:
process.env.DATABASE_URL
```

Different values for dev vs production, same code.

### Pattern 6: Validation at the edge

Validate input as early as possible (in the controller, before calling the service):

```typescript
const parsed = registerSchema.safeParse(req.body);
if (!parsed.success) {
  return sendError(res, parsed.error.errors[0].message);
}
// Now parsed.data is guaranteed to be valid
```

---

## Quick Reference: Running Locally

```bash
# 1. Start PostgreSQL (must be running)

# 2. Backend
cd backend
cp .env.example .env          # Create env file, fill in your DB credentials
npm install                   # Install dependencies
npx prisma db push            # Create/sync database tables
npx prisma generate           # Generate TypeScript client
npm run db:seed               # Seed reference data (foods, supplements, programs)
npm run dev                   # Start dev server on :3001

# 3. Frontend
cd ..                         # Back to root
npm install
npm run dev                   # Start Vite dev server on :5173

# 4. Open http://localhost:5173
```

## Quick Reference: Deploying Changes

```bash
# After making code changes:
git add -A
git commit -m "Description of changes"
git push

# Render auto-deploys from the push (backend)
# Vercel auto-deploys from the push (frontend)
```

---

That's everything. The backend follows a clear, repeatable pattern for every feature: **Route → Controller → Service → Database**. Once you understand that flow and how JWT authentication wraps around it, you understand the entire architecture.
