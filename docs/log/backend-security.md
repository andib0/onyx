# Bet 3: backend security log

Branch `worktree-agent-a1d63cf661a8db5c7`, based on `main` @ `3275a4e`. Scope: the
findings in `docs/audit/03-security.md`. Only the local Postgres was used (`onyx_sec_test`);
production was never contacted.

## Before and after

| Measure                                                      | Before                                                                                    | After                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Routes with both a 2xx test and a 4xx (auth/validation) test | 1/59 (health)                                                                             | **59/59**, enforced on every full run                                                  |
| API tests                                                    | 1 file, 4 tests (1 `it.fails`)                                                            | 17 files, 117 tests, all green 3 runs in a row                                         |
| Unit tests (`npx vitest run`)                                | 15                                                                                        | 29                                                                                     |
| IDOR matrix                                                  | none                                                                                      | 20 cases (18 `:param` routes + 2 body-referenced ids); 7 of them failed before the fix |
| POST/PUT/PATCH routes without the `validate` middleware      | 9 of 27 (5 of those had ad-hoc checks in the controller)                                  | 0 (route-coverage test walks `app._router`)                                            |
| `:param` routes with param validation                        | 0 of 19                                                                                   | 19 of 19                                                                               |
| GET routes that read a query and validate it                 | 0                                                                                         | 13                                                                                     |
| Rotated refresh token reused                                 | 200 (accepted)                                                                            | 401, and the whole token family is revoked                                             |
| Refresh cost                                                 | bcrypt: about 129 ms floor (1 compare + 1 hash, measured) plus 1 compare per live session | sha256 lookup: 5.3 ms median, 9.4 ms p90 (30 sequential refreshes, local)              |
| `npm audit --omit=dev`                                       | 5 (1 critical, 1 high, 3 moderate)                                                        | **0**                                                                                  |
| `npm audit` (all deps)                                       | 16                                                                                        | 11, all dev-only tooling (see below)                                                   |

## Commits

1. `04999b5` **F1: refresh tokens.** Each token carries a random `jti` (`crypto.randomUUID`)
   and a family id `fam`. The DB stores `sha256(token)` hex under a unique index
   (`RefreshToken.tokenHash @unique`, new nullable `familyId` + index). The only schema
   change is this model.
   - Rotation consumes the row atomically (`deleteMany` by hash, `count === 1`), so of N
     concurrent refreshes exactly one wins.
   - A validly signed token without a row means it was rotated, revoked, or logged out. The
     server then deletes that family and answers 401.
   - Logout revokes only this device's family. The family comes from the refresh token in the
     body or cookie, or else from the access token's `fam` claim, because the app sends no
     body on logout.
   - `/auth/refresh` reads the token from the body or the cookie.
   - The `it.fails` test is now a normal test. New tests cover: rotation returns a new token,
     sha256 storage, reuse → 401 with the family revoked, logout on device B leaves device A
     valid, logout with an explicit token, 5 concurrent refreshes → exactly 1×200 and 4×401,
     and the cookie path.
2. `408e8fd` **F13/F5: JWT checks and env validation.**
   - Every `jwt.verify` pins `algorithms: ['HS256']` and checks `typ` (`access`/`refresh`).
   - `config/env.ts` (Zod: secrets ≥ 32 chars and different from each other) is imported
     first by `server.ts` and used by `jwt.ts`. The lazy `utils/env.ts` is deleted.
   - Tests: typ swaps both ways, a missing typ, HS512 and `none` are rejected; a child process
     with a bad env exits with code 1 and doesn't print the value.
3. `fad7942` **F2/F3/F12: ownership checks.**
   - `supplements.toggleLog`, `meals.toggleLog` and `schedule.toggleCompletion` check
     ownership before the upsert (404 otherwise).
   - `meals.updateTemplate` checks ownership before touching tags and runs in a
     `$transaction`. The tag `deleteMany` calls (here and in `updateGrams`) are scoped by
     `mealTemplate.userId`.
   - `DELETE /user-foods/:id` returns 404 when nothing was deleted.
   - `test/idor.api.test.ts`: user A owns one of every resource. User B calls every
     `:param` route (the list is read from the Express stack, so a new route fails the test
     until it is added to the matrix) plus the body references (`blockId`,
     `selectedProgramId`). Every call must answer 404/403, A's rows must be byte-identical (a
     Prisma snapshot of 12 tables), and B must have no rows pointing at A. With the service
     fixes reverted, 7 cases fail.
4. `fbc9458` **F4/F10/F11: validation.**
   - `validate(schema, 'body'|'query'|'params')` marks itself with
     `Symbol.for('onyx.validates')`.
   - `test/routeCoverage.test.ts` (no DB needed) fails if:
     - any POST/PUT/PATCH route has no body validator,
     - any `:param` route has no params validator,
     - any non-public route has no `authMiddleware`.
   - New schemas:
     - preferences: an allowlist, IANA timezone check, `H:MM` times, and program/day ids that
       must be visible to the user (else 404);
     - scores (0–100, bounded counters);
     - user-foods;
     - profile (the old controller silently dropped bad values; now they get a 400);
     - refresh and logout;
     - an empty body for seed-starter;
     - query schemas for 13 GETs (`/foods?limit` ≤ 100, `/scores?days` ≤ 365, etc.).
   - `isoDate` rejects impossible dates (2026-02-31, 2025-02-29) everywhere a date is
     accepted.
   - `POST /foods`: the schema used to send a `verified` field that Prisma rejected, so every
     create failed. The field is removed, so users also can't self-verify foods (F11). Sugar
     and sodium are accepted now.
5. `7f49746` **F6/F9: rate limits, body limits, error handling.**
   - `/auth/refresh` gets its own limiter (30/min/IP).
   - `DISABLE_RATE_LIMIT` is ignored when `NODE_ENV=production`.
   - The general limiter now runs before body parsing.
   - JSON body limit is 100 kB everywhere and 10 MB only on `/api/sync/import`.
   - `errorHandler` responses:

     | Case           | Response                          |
     | -------------- | --------------------------------- |
     | malformed JSON | 400 `Malformed JSON body`         |
     | body too large | 413                               |
     | CORS rejection | 403                               |
     | other 4xx      | keeps its status, generic message |
     | anything else  | generic 500                       |

   - The 500 never includes a stack or the raw message, in development as well as production.
     Both are tested.
   - Unknown `/api/*` paths get a 404 JSON envelope.

6. `47777ec` **Per-route API tests.**
   - There is one file per resource.
   - `helpers.http()` records every request against the route table (`test/apiCoverage.ts`).
   - The globalSetup teardown prints `API route coverage: 59/59 …`, writes
     `node_modules/.cache/onyx-api-coverage/report.json`, and sets exit code 1 on an
     unfiltered run if any route is missing a 2xx or a 4xx test. I verified this by injecting
     a fake route: the run exited with 1.
   - `GET /api/health` has no failure mode and is exempt from the 4xx requirement.
7. `bbd509d` **`npm audit fix` (production dependencies, lockfile only).** express 4.22.1 →
   4.22.3, which brings body-parser 1.20.8, qs 6.16.1, path-to-regexp 0.1.13 and proxy-addr
   2.0.8.

## Evidence (final state)

```
npx tsc --noEmit            OK
npx eslint src/             OK
npx prettier --check src test   All matched files use Prettier code style
npx vitest run              29 passed (5 files, incl. test/routeCoverage.test.ts)
npm run test:api  x3        17 files, 117 passed each run
                            API route coverage: 59/59 (2xx: 59/59, 4xx: 59/59)
npm audit --omit=dev        found 0 vulnerabilities
Boot (NODE_ENV=production, test DB): /api/health 200, malformed JSON 400 envelope, /api/nope 404 envelope
```

## Notes, deviations, not done

- **Test DB name:** the brief said `onyx_test_sec`, but `test/globalSetup.ts` refuses to
  reset any database whose name doesn't end in `_test`. I created **`onyx_sec_test`**
  instead, and left the guard as is.
- **Worktree base:** the worktree started at `c4434f1`, behind `main`. I moved it to `main`
  (`3275a4e`) before starting, without touching the untracked `.claude/settings.local.json`.
  The 57 backend files that were checked out with CRLF were normalised to LF; their content is
  unchanged.
- **Deploy effect:** every existing session is logged out once. Old access tokens have no
  `typ`, and old refresh rows hold bcrypt hashes that can never match. The plan accepted
  this. `familyId` is nullable so that `prisma db push` on Render can add it to a table that
  already has rows. No migration file was added, because Bet 4 owns the migration baseline.
  It must include `RefreshToken.tokenHash` unique and `familyId`.
- **Concurrent refresh:** the losers of a race count as reuse, so the family is revoked. The
  winner's new token may die too, depending on timing. This is standard rotation behaviour;
  the app already single-flights refreshes (`mobile/api/client.ts` `refreshPromise`). A short
  grace window would need rotated rows to be kept and is not implemented.
- **Not changed, to avoid conflicts with the parallel sync work:**
  - `validators/sync.schema.ts`: no `.max()` caps on import arrays/strings, and dates are
    not validated inside imports. The 10 MB route-scoped limit bounds it for now.
  - `sync.service.ts`.
- **F7 (trust proxy hop count on Render, in-memory limiter store) and F8 (access tokens stay
  valid for up to 15 min after logout):** not addressed. F7 needs a production `req.ip`
  check; F8 would need a deny-list or shorter tokens.
- **Remaining `npm audit` advisories, all devDependencies** (vitest/@vitest/mocker, and the
  eslint/vite chains: ajv, brace-expansion, flatted, js-yaml, minimatch, nanoid, postcss,
  source-map-js, @humanfs/node): 7 high and 4 moderate. All can be fixed with a non-major
  `npm audit fix`. I left them alone to keep lockfile churn away from the parallel branch;
  none of them ship at runtime.
- **AGENTS.md** still lists `env` under `utils/`. That file is gone; env lives in
  `config/env.ts`. This is left for the final AGENTS.md pass in the plan.

## F7 and F8 (follow-up)

Branch `worktree-agent-a98749400d33ce866`, based on `main` @ `bddd7a0`. Local Postgres only: a
throwaway cluster on port 5434 with `onyx_sec2_test` and `onyx_mig_check` (the system
Postgres service was stopped and can't be started without admin). Production was never
contacted.

### F8: access tokens revoked on logout

- Access tokens already carried the session family as `fam` (since F1). I kept that name
  rather than adding a second `fid` claim.
- A family is live while it has a `RefreshToken` row. `authMiddleware` now rejects tokens
  with no `fam` and tokens whose family is dead (401 `Session has been logged out`). The
  logic is in `src/services/sessionRevocation.ts`.
  - **Revoked cache:** an LRU of up to 10k ids. Its TTL equals the access-token lifetime
    (15 min, exported as `ACCESS_TOKEN_TTL_MS`), after which every token of the family has
    expired anyway.
  - **Live cache:** an LRU with a 60 s TTL.
  - **On a miss:** one `findFirst` on the indexed `RefreshToken.familyId`, and the result is
    cached either way.
- Logout and refresh-token reuse detection call `markFamilyRevoked()` synchronously. On the
  single Render instance, the very next request with that access token gets a 401. After a
  restart the caches are empty, so the DB decides. With several instances, another instance
  could keep accepting the token for up to 60 s (the live-cache TTL).
- Refresh rotation now runs as consume, find user and insert successor in one
  `$transaction`. Before, there was a moment between delete and create when the family had
  zero rows, which the middleware would read as a logout. Concurrency is unchanged: of N
  parallel refreshes exactly 1 wins (the existing test still passes).
- No schema change.
- **Overhead:** measured with `isFamilyLive` over 200 samples on local Postgres. A cache hit
  costs p50 0.027 ms and p95 0.099 ms. A miss costs p50 1.66 ms and p95 3.77 ms, and happens
  at most once per family per minute.
- **Tests:** `test/sessionRevocation.api.test.ts`
  - logout on device B: B's access token gets 401 immediately and A's gets 200;
  - the same after a cache reset (simulated restart), so the DB fallback is exercised;
  - refresh-token reuse kills the family's access tokens;
  - 5 rotations racing `/auth/me` on an empty cache give no false 401s;
  - an access token without `fam` gets 401;
  - the overhead measurement.

### F7: rate-limit keying behind Render

- **Hop count is not verified.**
  - The brief assumed one hop. Render's own article "How Render handles DDoS attacks"
    (render.com/articles/how-render-handles-ddos-attacks) says traffic passes through
    Cloudflare *and* Render's load balancers.
  - One public project (github.com/wandersonpjbkn/ecos-api PR #13) replayed Render logs and
    found that `trust proxy 1` yielded rotating internal `10.x` load-balancer addresses, and
    `3` yielded the client.
  - Other projects use `1`. I could not measure this without contacting production.
- **Default stays at 1.** The two possible errors are not equally risky:
  - Hops set too low: clients share a bucket per proxy address. Spoofing is impossible.
  - Hops set too high: a client-prepended X-Forwarded-For value becomes `req.ip`, which
    bypasses the limit.
- **What changed:**
  - `trust proxy` now comes from the `TRUST_PROXY_HOPS` environment variable. It is
    validated in `config/env.ts` (an integer from 0 to 5, default `1`) and is never `true`.
  - `logProxyChainShape` logs the shape of the chain for the first 5 production requests
    after each boot. The line reads `[proxy-chain] xff+socket hops=N [public, public, private, ...]`,
    with no addresses.
  - **How to set it:** load the app once from a normal client (one that sends no
    X-Forwarded-For) and read N from Render's logs. Set `TRUST_PROXY_HOPS = N - 1` on the
    service. The ecos-api finding predicts 3.
- **Limiter key:**
  - All three limiters use `clientKey(req.ip)`. It never reads the raw header.
  - IPv4-mapped IPv6 addresses are unwrapped.
  - IPv6 addresses are collapsed to their /64, so a client can't rotate through addresses in
    its own prefix.
- **Store:** the limiters keep their counters in process memory, so a free-tier restart or
  spin-down resets them. This is accepted for a single instance with 1-minute windows. A
  shared store (Redis or Postgres) would only matter with more than one instance.
- **Tests:**
  - `src/middleware/rateLimit.test.ts` (unit) covers IPv4, mapped and IPv6 /64 keys.
  - `test/ratelimit-proxy.api.test.ts` sets 1 hop and sends 101 requests, each with
    different spoofed leftmost XFF values and the same rightmost "real" client. Requests
    1-100 get 200 and request 101 gets 429. A different rightmost client still gets 200,
    and a /64 IPv6 rotation is limited.
  - The spoofing test fails when run with `TRUST_PROXY_HOPS=5` (an over-trusting setting),
    which shows the test can detect the bypass.

### Evidence

```
npm run check (backend)   tsc, eslint, prettier, unit (84), api (25 files, 183), migrations: PASSED
API route coverage: 62/62 (2xx: 62/62, 4xx: 62/62)
```
