# Daily Tracker - Backend Integration Implementation Guide

## Quick Start

### 1. Start the Backend

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database (create tables)
npm run db:push

# Seed the database with foods, supplements, and gym programs
npm run db:seed

# Start the development server
npm run dev
```

### 2. Start the Frontend

```bash
# In the root directory
npm run dev
```

### 3. Database Setup

You need PostgreSQL running. Options:
- **Local:** Install PostgreSQL and create a database called `daily_tracker`
- **Docker:** `docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres`
- **Cloud:** Use Supabase, Railway, or Neon (free tiers available)

Update `backend/.env` with your database URL:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/daily_tracker"
```

---

## What's Implemented

### Backend (Node.js + Express + TypeScript + Prisma)

**Location:** `/backend`

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Login |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Get current user |
| `/api/schedule` | GET/POST | Schedule blocks |
| `/api/schedule/:id` | PUT/DELETE | Update/delete block |
| `/api/schedule/completions` | GET/POST | Completion tracking |
| `/api/supplements` | GET/POST | Supplements list |
| `/api/supplements/:id` | PUT/DELETE | Update/delete supplement |
| `/api/supplements/:id/log` | POST | Log supplement taken |
| `/api/meals/templates` | GET/POST | Meal templates |
| `/api/meals/templates/:id` | PUT/DELETE | Update/delete template |
| `/api/meals/:id/log` | POST | Log meal eaten |
| `/api/logs` | GET/POST | Daily logs |
| `/api/logs/:id` | DELETE | Delete log |
| `/api/logs/stats` | GET | Statistics |
| `/api/foods` | GET/POST | Food database (500+ foods) |
| `/api/sync/import` | POST | Import localStorage data |
| `/api/sync/export` | GET | Export user data |
| `/api/sync/state` | GET | Get full current state |

#### Database Schema

- **Users & Auth:** User, UserPreferences, RefreshToken
- **Tracking:** ScheduleBlock, Completion, Supplement, SupplementLog, MealTemplate, MealLog, DailyLog
- **Reference Data:** Food (500+ entries), SupplementDatabase (50+ entries), GymProgram (6 programs)

### Frontend Integration

**New Files:**
- `/src/api/` - API client modules
- `/src/contexts/AuthContext.tsx` - Authentication state
- `/src/views/AuthView/` - Login/Register UI

**Modified Files:**
- `/src/main.tsx` - Added AuthProvider
- `/src/App.tsx` - Auth check, logout button
- `/src/components/layout/Topbar.tsx` - User email, logout button

---

## How Authentication Works

1. **Register/Login:** User submits email + password
2. **Server:** Validates, hashes password (bcrypt, cost 12), returns JWT + refresh token
3. **Access Token:** 15 min expiry, stored in memory
4. **Refresh Token:** 7 days, stored in httpOnly cookie
5. **Auto-refresh:** Frontend automatically refreshes on 401

### Password Requirements
- Minimum 8 characters
- At least 1 number
- At least 1 special character (!@#$%^&*(),.?":{}|<>)

---

## Data Migration from localStorage

When a new user registers and has existing localStorage data:

1. App detects `andi_weekday_os_v1` in localStorage
2. Prompts: "Import your local data?"
3. If yes, sends full state to `/api/sync/import`
4. Server maps old IDs to new UUIDs
5. Creates all records in database
6. Clears localStorage

---

## Seed Data

### Foods (500+ entries)
Categories: Proteins, Dairy, Grains, Vegetables, Fruits, Legumes, Nuts & Seeds, Oils, Supplements

Each food includes per 100g:
- Calories, Protein, Carbs, Fat, Fiber, Sugar, Sodium

### Supplements (50+ entries)
Categories: Essential, Performance, Recovery, Health, Joint, Cognitive, Sleep, Hormones

Each includes:
- Name, Category, Typical Dose, Timing, Benefits, Precautions

### Gym Programs (6 programs)
1. Lean Bulk - 3 Day PPL
2. Fat Loss - High Volume
3. Strength Focus - 5x5
4. Beginner Full Body 3x/Week
5. Body Recomposition
6. Push Pull Legs 6-Day

---

## Environment Variables

### Backend (`/backend/.env`)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/daily_tracker
JWT_SECRET=your-32-char-secret
JWT_REFRESH_SECRET=different-32-char-secret
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Frontend (`/.env`)
```
VITE_API_URL=http://localhost:3001/api
```

---

## Deployment

### Backend Options
- **Railway:** Easy PostgreSQL + Node.js hosting
- **Render:** Free tier available
- **Fly.io:** Good for global distribution

### Database Options
- **Supabase:** Generous free tier, managed PostgreSQL
- **Neon:** Serverless PostgreSQL
- **Railway PostgreSQL:** Simple, integrated

### Frontend Options
- **Vercel:** Recommended for Vite/React
- **Netlify:** Easy deployment
- Same platform as backend

---

## Security Features

- [x] HTTPS only in production
- [x] CORS whitelist
- [x] Rate limiting on auth endpoints (5/min)
- [x] Password hashing with bcrypt (cost 12)
- [x] JWT short expiry (15 min)
- [x] Refresh tokens in httpOnly cookies
- [x] Input validation with Zod
- [x] SQL injection prevention (Prisma)
- [x] User data isolation (all queries filtered by userId)
- [x] Helmet.js security headers

---

## TODO: Remaining Tasks

### High Priority
- [ ] Add loading states to all API calls
- [ ] Add error handling UI for API failures
- [ ] Test complete user flow

### Medium Priority
- [ ] Update existing hooks to sync with backend
- [ ] Add offline support (localStorage fallback)
- [ ] Add sync status indicator

### Low Priority (Can Defer)
- [ ] Food search UI
- [ ] Supplement database search UI
- [ ] Custom program builder
- [ ] Analytics/trends charts
- [ ] Progress visualization

---

## File Structure

```
/daily
├── /backend
│   ├── /prisma
│   │   ├── schema.prisma        # Database schema
│   │   └── /seed                # Seed data files
│   ├── /src
│   │   ├── /config              # Database, env config
│   │   ├── /middleware          # Auth, rate limit, errors
│   │   ├── /routes              # Express routes
│   │   ├── /controllers         # Request handlers
│   │   ├── /services            # Business logic
│   │   ├── /validators          # Zod schemas
│   │   ├── /types               # TypeScript types
│   │   ├── /utils               # JWT, password, response helpers
│   │   ├── app.ts               # Express app
│   │   └── server.ts            # Server entry
│   ├── package.json
│   └── tsconfig.json
├── /src
│   ├── /api                     # API client modules
│   ├── /contexts                # React contexts
│   ├── /views/AuthView          # Auth UI
│   └── ... (existing files)
├── .env                         # Frontend env
├── Implementing.md              # This file
└── package.json
```

---

## Testing the API

### With curl

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'

# Use the returned accessToken for authenticated requests
curl http://localhost:3001/api/schedule \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Search foods
curl "http://localhost:3001/api/foods?search=chicken" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### With Thunder Client / Postman
Import the endpoints and test with the UI.

---

## Quick Commands Reference

```bash
# Backend
cd backend
npm install              # Install dependencies
npm run dev              # Start dev server
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to DB
npm run db:migrate       # Create migration
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio

# Frontend
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run typecheck        # Run TypeScript checks
```

---

## Support

For issues or questions:
- Check the plan file: `~/.claude/plans/gentle-petting-castle.md`
- Review API error responses
- Check browser console for frontend errors
- Check backend logs for server errors
