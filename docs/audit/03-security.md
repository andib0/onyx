# 03 — Security Audit (backend API + mobile token handling)

Date: 2026-10-17 · Scope: `backend/` (Express 4.22.1, Prisma 5.22, jsonwebtoken 9.0.3, bcryptjs 2.4.3, express-rate-limit 7.5.1), `mobile/` token storage, `render.yaml`, git history.
Context: a personal app with one real user, but the API is reachable from the internet (Render free tier) and **anyone can call `/api/auth/register`**. So any "user A vs user B" bug can be used by a stranger against the owner's account.

Method: read the source, plus runtime probes against the **local** API only (`http://localhost:3001/api`, dev DB). Production was never contacted. Secret values were not printed. Scratch evidence: `%TEMP%\claude\...\scratchpad\security\` (`auth_tests.mjs`, `auth_tests.out`, `audit-*.json`).

> Note on coverage: the JWT/refresh findings were **verified at runtime**. The cross-user data-access (IDOR) findings below were **verified by code review only**; they have not been tested against the running API.

---

## Findings summary

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| F1 | **High** | Refresh-token rotation, reuse detection and logout revocation do not work. bcrypt only hashes the first 72 bytes, and every refresh JWT for the same user shares that prefix | runtime: rotated token reused → 200; pre-logout token accepted after re-login → 200 |
| F2 | **High** | IDOR (code-verified): a user can attach log rows to another user's supplement or meal template by id, and the logs GET then `include`s the other user's record | `supplements.service.ts:63-80` + `:59`; `meals.service.ts:117-135` + `:112` |
| F3 | **Med** | IDOR (code-verified): `PUT /meals/templates/:id` with `tags` deletes another user's template tags *before* the ownership-scoped update fails | `meals.service.ts:81-86` |
| F4 | **Med** | Mass assignment: `PUT /preferences` passes the raw `req.body` to `prisma.userPreferences.update` (no Zod). That allows nested relation writes (`user: { update: {...} }`) and arbitrary `selectedProgramId` values | `preferences.controller.ts:19-21`, `preferences.service.ts:17` |
| F5 | **Med** | `config/env.ts` (Zod, `min(32)`) is dead code: nothing imports it. The validation actually used (`utils/env.ts`) only checks the values are present, lazily, at first use, so the "process exits on bad env" promise is false | `grep "config/env" src` → no hits; `utils/jwt.ts:3` imports `utils/env.ts` |
| F6 | **Med** | `/auth/refresh` has no auth rate limiter, and each call bcrypt-compares against every live token row for the user (CPU amplification). The 10 MB JSON body limit applies globally, including unauthenticated routes | `auth.routes.ts:16`, `auth.service.ts:110-117`, `app.ts:38` |
| F7 | **Med** | Rate-limit keying depends on `trust proxy 1` matching Render's real hop count (not verified). Limits are in memory and reset on every free-tier restart/spin-down | `app.ts:13`, `rateLimit.ts` |
| F8 | Low | Access tokens (15 min) stay valid after logout. Logout without a cookie revokes *all* sessions; logout with the cookie deletes an arbitrary matching row (see F1) | runtime: old access token → 200 after logout |
| F9 | Low | Error-message leakage: `register`/`login`/`me`/`updateProfile` return raw `error.message` (Prisma/DB text) for non-`AppError`. The dev error handler returns the stack. In prod, malformed JSON returns 500 instead of 400 | `auth.controller.ts:38-40,59-61,123-126,143-146`; `errorHandler.ts:17-24`; runtime dev stack leak |
| F10 | Low | Missing input validation: `POST /scores`, `POST /user-foods`, `PUT /auth/profile`, all GET query params, all `:id` params. `/foods?limit=` is unbounded. `/sync/import` arrays and strings have no size limits | see route table |
| F11 | Low | `POST /foods` writes to the **global** `Food` table shared by all users (reference-data poisoning by any registrant) | `foods.service.ts:24-37` |
| F12 | Low | `toggleCompletion` accepts another user's `blockId` (creates a dangling Completion row; no data is disclosed because the GET does not include the block) | `schedule.service.ts:60-77` |
| F13 | Low | Access and refresh tokens carry no `typ`/`aud` claim; they are told apart only by having different secrets (runtime: cross-use rejected because the secrets differ) | `utils/jwt.ts:8-22` |
| F14 | Info | Dependency advisories: backend prod 5 (1 crit, 1 high, 3 mod), all **not reachable** with this config; mobile advisories are almost all build tooling | see §5 |
| F15 | Info | Git history: no real `.env` or production secret was ever committed. Placeholders only, plus an old hardcoded dev fallback secret in `jwt.ts` (removed in `020024e`) | see §6 |

What's good: HS256 only (`alg:none`, a swapped header and a tampered payload all rejected → 401); bcrypt cost 12 for passwords; refresh tokens stored hashed; helmet defaults; CORS allowlist; login error message the same for unknown email and wrong password; every non-auth router uses `router.use(authMiddleware)`; most mutations scope `where: { id, userId }`; Zod `validate` replaces `req.body` with the parsed object (unknown keys stripped); mobile keeps tokens in SecureStore, not AsyncStorage.

---

## 1. JWT / refresh tokens

Config (`backend/src/utils/jwt.ts`): access 15 min, refresh 7 days, HS256 (the library default). `jwt.verify` is called **without** `algorithms: ['HS256']` (`jwt.ts:26,34`). jsonwebtoken 9 still rejects `none` and asymmetric/symmetric mixing, but pinning the algorithm is cheap defence in depth.

Refresh storage: `bcrypt.hash(refreshToken, 10)` in the `RefreshToken` table (`auth.service.ts:45,83,152`). Rotation happens on `/refresh` (`:140-156`). Reuse "detection" deletes all of the user's tokens when nothing matches (`:124-127`). Expired rows are pruned on login and refresh. There is **no change-password endpoint**, so there is no revocation on password change.

### F1 — bcrypt 72-byte truncation defeats rotation (High, runtime-verified)
A refresh JWT is 248 chars. bcryptjs 2.4.3 only uses the first 72 bytes: the fixed header `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.` plus the start of the payload `{"sub":"<uuid…`. That prefix is the same for **every** refresh token of a given user. So `bcrypt.compare(anyOldToken, newestHash)` succeeds.

Runtime (`auth_tests.out`):
```
refresh token length: 248 (bcrypt only hashes first 72 bytes)
[refresh rt0 (first use)] HTTP 200
rt0 !== rt1: true | common prefix length: 178
[REUSE rotated rt0] HTTP 200 -> {"success":true,...}          <- should be 401 + family revoke
[logout A (bearer, no cookie)] HTTP 200
[refresh after logout (old rt0)] HTTP 401                      <- only because 0 rows exist
[login A again] HTTP 200
[REPLAY pre-logout rt1 after a new login] HTTP 200             <- revoked token works again
```
Impact: a stolen refresh token keeps working for its full 7-day JWT lifetime, as long as the owner has any live session. Logout and "reuse detection" give no protection. The `@@index([tokenHash])` is also useless, since lookups do an O(n) bcrypt scan.
Fix: add a random `jti` (`crypto.randomUUID()`) to refresh tokens and store `sha256(token)` (or the `jti`) in a unique column. Look the row up directly; if a valid-signature token has no row, revoke all of the user's tokens. Do not bcrypt high-entropy tokens.

## 2. Route table

Auth = `authMiddleware`. Validated = Zod `validate()` on the body (no route validates params or query). Ownership = whether the service scopes by `userId`.

| Route | Method | Auth | Validated | Ownership / notes |
|---|---|---|---|---|
| /health | GET | no | n/a | public |
| /auth/register | POST | no (5/min) | Zod in controller | — |
| /auth/login | POST | no (5/min) | Zod in controller | — |
| /auth/refresh | POST | no (**general limit only**) | none (`refreshSchema` unused) | F1, F6 |
| /auth/logout | POST | yes | n/a | F8 |
| /auth/me | GET | yes | n/a | self |
| /auth/profile | PUT | yes | manual typeof checks | self, explicit fields |
| /schedule | GET/POST | yes | POST ✓ | userId |
| /schedule/:id | PUT/DELETE | yes | PUT ✓ | `where {id,userId}` ✓ |
| /schedule/completions | GET/POST | yes | POST ✓ | **F12**: blockId not ownership-checked |
| /supplements | GET/POST | yes | POST ✓ | userId |
| /supplements/:id | PUT/DELETE | yes | PUT ✓ | `{id,userId}` ✓ |
| /supplements/logs | GET | yes | query unvalidated | **F2**: `include: supplement` |
| /supplements/:id/log | POST | yes | ✓ | **F2**: supplementId not ownership-checked |
| /meals/templates | GET/POST | yes | POST ✓ | userId; foodId → global Food |
| /meals/templates/:id | PUT/DELETE | yes | PUT ✓ | **F3** tag delete before check |
| /meals/templates/:id/grams | PATCH | yes | ✓ | ownership checked first ✓ |
| /meals/logs | GET | yes | query unvalidated | **F2**: `include: mealTemplate` |
| /meals/:id/log | POST | yes | ✓ | **F2**: template id not ownership-checked |
| /logs, /logs/stats, /logs/:date | GET | yes | query clamped (limit ≤200) | userId |
| /logs | POST | yes | ✓ | upsert by (userId,date) |
| /logs/:id | DELETE | yes | — | `{id,userId}` ✓ |
| /foods | GET | yes | `limit` **unbounded** | global data |
| /foods/:id | GET | yes | — | global data |
| /foods | POST | yes | ✓ | **F11** global write |
| /programs | GET/POST | yes | POST ✓ | system OR own |
| /programs/:id | GET/PUT/DELETE | yes | PUT ✓ | `findFirst {id,userId,isSystem:false}` ✓ |
| /supplement-db | GET | yes | limit clamped ≤200 | global |
| /exercises | GET | yes | limit clamped ≤50 | global |
| /sync/import | POST | yes | ✓ shape only, no size caps | userId; destructive replace |
| /sync/export, /sync/state | GET | yes | — | userId |
| /sync/seed-starter | POST | yes | — | userId |
| /preferences | GET | yes | — | userId |
| /preferences | PUT | yes | **none** | **F4** raw body |
| /user-foods | GET/POST | yes | manual `foodId` check | userId |
| /user-foods/:id | DELETE | yes | — | `deleteMany {id,userId}` ✓ |
| /workouts/sessions | GET/POST | yes | POST ✓ | userId, limit ≤100 |
| /workouts/sessions/:id/sets | POST | yes | ✓ | session ownership checked ✓ |
| /workouts/sessions/:id/finish | PATCH | yes | ✓ | ownership checked ✓ |
| /workouts/sets/:id | DELETE | yes | — | `deleteMany {id,userId}` ✓ |
| /workouts/exercise-history, /exercise-sessions | GET | yes | query manual | userId |
| /scores | GET/POST | yes | POST: date regex only | upsert by userId; fields coerced |

### F2 — cross-user record disclosure via log toggles (High, code-verified, not runtime-tested)
`supplementsService.toggleLog(userId, supplementId, …)` (`supplements.service.ts:63-80`) upserts a `SupplementLog` with the caller's `userId` and **any** `supplementId`, with no check that the supplement belongs to the caller. The FK only requires that it exists. `getLogs` then does `include: { supplement: true }` (`:59`), which returns the other user's full supplement row. The same pattern exists for meals: `toggleLog` (`meals.service.ts:117-135`) plus `getLogs` with `include: { mealTemplate: { include: { tags: true } } }` (`:112`). Exploitation needs a target id. The ids are UUIDv4 (not guessable), which lowers the practical risk for a stranger, but this is still a broken authorization check. Fix: verify ownership (`findFirst({ where: { id, userId } })`) before the upsert, as `workouts.service.ts:17-21` already does.

### F3 — tag deletion before ownership check (Med, code-verified)
`updateTemplate` runs `mealTemplateTag.deleteMany({ where: { mealTemplateId: templateId } })` (`meals.service.ts:83-85`) before `update({ where: { id, userId } })`. A non-owner gets a 404, but the owner's tags are already gone (no transaction). `updateGrams` is safe because the controller checks ownership first (`meals.controller.ts:52-55`). Fix: check ownership first, or scope the delete with `mealTemplate: { userId }` and wrap it in `$transaction`.

### F4 — `/preferences` mass assignment (Med)
`preferences.controller.ts:19-21` passes `req.body` straight into `prisma.userPreferences.update({ data })`. Prisma accepts relation writes in `data`, so a client can send `user: { update: { email, passwordHash, … } }` for **its own** user, bypassing every validator. It can also set `selectedProgramId` to anything, or `userId`/`id` (FK/unique errors → 409/400). This is limited to the caller's own account, so it can't take over another account. Fix: a Zod schema with an explicit field allowlist.

## 3. Rate limiting
- `generalRateLimiter`: 100 req/min/IP on everything (`app.ts:43`). `authRateLimiter`: 5/min on register and login only (`auth.routes.ts:13-14`). Brute force of login is ~7,200 guesses/day per IP. That's acceptable for a strong password, but there is no per-account lockout.
- `/auth/refresh` has only the general limit (F6) and does an O(n) bcrypt scan per call.
- `trust proxy 1` (`app.ts:13`) is right **only if** Render puts exactly one proxy in front, with the client IP last in `X-Forwarded-For`. If there's an extra hop (e.g. a CDN), every client shares the proxy's key (a self-DoS for the owner). If the app is reached directly, any spoofed XFF value rotates the key. Verify in prod logs (`req.ip` vs the known client IP). The in-memory store resets on every free-tier spin-down.

## 4. Headers, CORS, errors, bodies, validation, passwords
- helmet 8 defaults are present (CSP, HSTS, nosniff, frame options; runtime headers captured on `/api/health`).
- CORS: no `Origin` header → allowed (needed by the native app). Browser origins must be in `CORS_ORIGIN`; there's no wildcard. `credentials: true` + a `SameSite=None; Secure` cookie in prod (`auth.controller.ts:10-16`): a cross-site POST to `/auth/refresh` from a non-allowlisted origin is rejected by CORS for reading, but the request still **executes** server-side and rotates the cookie token. Low impact. Since the mobile app sends the refresh token in the body, consider dropping the cookie entirely.
- Error handler: dev returns `err.message` + `stack` (runtime: a malformed JSON body on `/auth/login` leaked the stack with local file paths). Prod returns a generic 500, but body-parser errors (`err.status` 400/413) are turned into 500. Controllers leak raw messages (F9).
- Body limit: `express.json({ limit: '10mb' })` applies globally (`app.ts:38`), including unauthenticated routes. Scope the large limit to `/api/sync/import`.
- `/sync/import`: Zod checks shape only. No `.max()` on arrays or strings, sequential `create`s inside one interactive `$transaction` (5 s default timeout). A large import can tie up the DB or time out. The endpoint wipes the user's data first (inside the transaction, so it is atomic).
- Password policy: min 8 characters plus a digit and a special character, at registration only. bcrypt cost 12 ✓. No max length (bcrypt truncates at 72; fine).

## 5. Dependencies (`npm audit`)
| Package set | crit | high | mod | low |
|---|---|---|---|---|
| backend `--omit=dev` | 1 | 1 | 3 | 0 |
| backend all | 1 | 8 | 7 | 0 |
| mobile `--omit=dev` | 2 | 33 | 17 | 1 |
| mobile all | 2 | 34 | 21 | 1 |

Reachability (backend prod):
- `proxy-addr` (crit, IPv4-mapped IPv6 *subnet* trust): app uses hop-count `trust proxy 1` → not reachable.
- `path-to-regexp` (high, ReDoS with multiple params per segment): all routes use a single `:id` → not reachable.
- `body-parser` (invalid `limit` disables enforcement): limit is a valid `'10mb'` → not reachable.
- `qs` (comma `arrayLimit` bypass): Express doesn't enable `comma` → not reachable.

Still, `npm update express` is cheap. Backend dev-only advisories (vitest, minimatch, flatted…) don't apply at runtime. Mobile: almost everything is Metro, Expo CLI or Jest build tooling (`tar`, `shell-quote`, `node-forge`, `ws`, `compression`…), which runs on the dev machine and isn't shipped in the bundle. Upgrade on the next Expo SDK bump.

## 6. Secrets
- `backend/src/config/env.ts` defines a good Zod schema (`JWT_SECRET` min 32 etc.) but **is never imported** (F5). Runtime uses `utils/env.ts`, which only checks presence, at first token use. Local `.env` has 6 keys (`DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, PORT, NODE_ENV, CORS_ORIGIN`); JWT secret lengths are 43 and 39 and the two differ (values not printed).
- `render.yaml`: `JWT_SECRET`/`JWT_REFRESH_SECRET` use `generateValue: true` ✓, `DATABASE_URL` comes from the DB ✓, `CORS_ORIGIN` is `sync: false` ✓. `startCommand` runs `prisma db push` on every boot (a schema-drift / data-loss risk, not a secret issue).
- Git history (81 commits): a real `.env` was never committed. Only `backend/.env.example` (placeholders like `your-32-char-secret`), docs with placeholder `postgres:postgres@localhost` URLs, test config, and AppleDouble `._.env` files (contain only `com.apple.provenance`; verified). Commit `2fb69b9` `backend/src/utils/jwt.ts:4-5` had a hardcoded **dev fallback** JWT secret (`process.env.JWT_SECRET || '…'`), removed in `020024e`. If production ever ran that code without env vars, tokens could have been forged. Render's `generateValue` makes that unlikely, but rotating the prod secrets once is cheap.
- Mobile: tokens are only in `expo-secure-store` (`onyx_access_token`/`onyx_refresh_token`, `mobile/api/client.ts:10-60`). No tokens are logged and none go to AsyncStorage. The API base falls back to `http://localhost:3001/api` (`client.ts:5-8`); make sure release builds set an `https://` `apiUrl`.

## Recommended order
1. F1: `jti` + sha256 lookup, real reuse detection (≈30 lines).
2. F2/F3/F12: ownership checks before log upserts and tag deletes.
3. F4/F10: Zod schemas for preferences, scores, user-foods, profile; `.max()` on sync arrays; clamp `/foods` limit.
4. F5: import `config/env.ts` at the top of `server.ts`; pin `algorithms: ['HS256']`; add a `typ` claim.
5. F6/F7: rate-limit `/auth/refresh`; scope the 10 MB limit to `/sync/import`; verify `req.ip` on Render.
6. F9: return generic messages; respect `err.status` in `errorHandler`.
