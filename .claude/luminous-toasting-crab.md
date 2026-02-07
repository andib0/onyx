# Fix: Empty Programs, Foods, and Supplements in Production

## Problem
The production database has no seed data. The `Food`, `SupplementDatabase`, and `GymProgram` tables are empty because the seed script was never executed on the production DB.

## Fix (2 file changes)

### 1. `backend/package.json`
Move `tsx` from devDependencies to dependencies so it's available at runtime on Render:
```
- devDependencies: remove "tsx": "^4.19.2"
+ dependencies: add "tsx": "^4.19.2"
```

### 2. `backend/render.yaml` (or just update the Render dashboard Start Command)
Update `startCommand` to run the seed after schema push:
```yaml
startCommand: npx prisma db push --skip-generate && npm run db:seed && npm start
```

The seed is idempotent — checks if data already exists before inserting, so it's safe to run on every deploy.

## Verification
After deploy, hit `GET /api/foods?search=chicken` — should return food items.
Hit `GET /api/programs` — should return 6 gym programs.
Hit `GET /api/supplement-db` — should return 66+ supplements.
