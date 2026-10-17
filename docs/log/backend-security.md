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
