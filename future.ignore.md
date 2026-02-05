# BACKEND.md

## Purpose
Design and implement a backend + database that is the primary source of truth while preserving offline capability. The backend will also provide canonical datasets (supplements, nutrients, foods, exercises, programs), recommendations, and safe multi-device syncing.

This plan is based on current localStorage schema in `andi_weekday_os_v1` and the project structure in `AGENTS.md`, with a shift to a backend-first model.

---

## Goals (non-negotiable)
- Backend-first: server is the canonical data store.
- Offline-capable: app still works without network and syncs safely later.
- Fast, safe sync: push local changes, pull remote changes, resolve conflicts deterministically.
- Multi-device: support concurrent edits on multiple devices per user.
- Data ownership: user can export/import data.
- Clear schema with migrations and versioning.

## Recommended Stack (performance-focused)
- **API**: Rust + Axum (Tokio async runtime).
- **DB**: PostgreSQL 16 (managed), with SQLx (compile-time checked queries).
- **Auth**: Email/password + magic link (or OAuth later), JWT access + refresh tokens.
- **Hosting**: Fly.io / Railway / Render (Docker), managed Postgres (Neon / Supabase / Railway).
- **Migrations**: SQLx migrations; app-level data versioning in payloads.

This stack prioritizes runtime performance and predictable resource usage, while still keeping the backend surface area small and the sync model straightforward.

---

## Architecture Overview

1. **Server is the source of truth.**
2. **Client caches a working set** for offline use.
3. **Server stores user snapshots + mutation logs** to enable multi-device sync.
4. **Sync API** provides:
   - `pull`: fetch server changes since last sync
   - `push`: upload local changes with versioning
5. **Conflict resolution** is explicit and deterministic.
6. **Canonical datasets** live on the server and are referenced by user data.

---

## Data Model (Postgres)

### Core Entities

**users**
- id (uuid, pk)
- email (unique)
- password_hash
- created_at
- updated_at

**devices**
- id (uuid, pk)
- user_id (fk)
- name
- last_sync_at
- created_at

**app_state_versions**
- id (uuid, pk)
- user_id (fk)
- version (int) // monotonically increasing
- snapshot (jsonb) // full state snapshot for recovery
- created_at

**mutations**
- id (uuid, pk)
- user_id (fk)
- device_id (fk)
- entity (text)
- entity_id (text)
- op (enum: upsert | delete)
- payload (jsonb)
- client_timestamp
- server_timestamp
- version (int)

### Domain Tables (user data)
These tables map to current localStorage keys (now server-first):

- schedule_blocks
- completion
- top3
- mechanism
- supplements
- supplement_log
- meals
- meal_log
- log_entries
- workout_programs
- workout_history
- settings

### Canonical Library Tables (global data)
These tables provide the built-in catalog the app can reference:

- supplement_library
- nutrient_library
- food_library
- exercise_library
- program_templates
- nutrition_templates
- recommendation_rules

**Note**: Phase 1 can start with `snapshot + mutations` for user data, but canonical libraries should be normalized from the start.

---

## Sync Strategy

### Versioning
- Each client keeps `localVersion` (int).
- Server keeps `latestVersion` per user.
- Each push increments version for accepted mutations.

### Conflict Resolution (simple deterministic rules)
- Default: **last-write-wins** based on `server_timestamp`.
- For arrays (schedule, supplements, meals): use **entity_id** with per-item timestamps.
- For completion/meal/supp logs: **per-day/per-id** last-write-wins.
- Always store previous value in mutation log for auditing.

### Multi-device concurrency
- Accept concurrent pushes from multiple devices.
- Use per-entity conflict handling:
  - If same entity modified with different payloads and timestamps are close, store both versions in a conflict table and surface to client.
  - If no logical conflict (different entities), merge both.
- Provide `conflicts` endpoint to fetch unresolved conflicts for user review.

### Sync API Surface
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/verify-email`
- `POST /sync/pull` (clientVersion -> changes + latestVersion)
- `POST /sync/push` (mutations -> accepted + rejected)
- `GET /sync/conflicts` (list unresolved conflicts)
- `GET /export` (full snapshot export)
- `POST /import` (replace or merge snapshot)
- `GET /library/supplements`
- `GET /library/nutrients`
- `GET /library/foods`
- `GET /library/exercises`
- `GET /library/programs`
- `POST /recommendations/programs`
- `POST /recommendations/nutrition`

---

## Security and Privacy
- Passwords: bcrypt/argon2.
- JWT access tokens short-lived, refresh token rotation.
- Rate limiting on auth endpoints.
- Email verification required before sync or recommendations.
- Encrypt PII at rest if hosted in shared environments.
- Optional: client-side encryption of `snapshot` payloads.

---

## Step-by-Step Implementation Plan

### Phase 0 — Discovery and decisions
1. Confirm product requirements: multi-device sync, canonical libraries, recommendations, admin needs.
2. Choose hosting provider + managed Postgres.
3. Decide on snapshot-only vs normalized schema for user data in v1.
4. Define the canonical library scope (supplements, foods, nutrients, exercises, programs).

### Phase 1 — Backend foundation (Rust)
5. Create `/server` Rust workspace with Axum + Tokio.
6. Add SQLx and initialize Postgres connection + migrations.
7. Define `users`, `devices`, `app_state_versions`, `mutations` models.
8. Add auth endpoints (register/login/refresh/verify-email).
9. Add `sync/pull` and `sync/push` endpoints with request validation (Serde + custom validators).
10. Implement mutation logging, version bumping, and conflict recording.
11. Add `export`/`import` endpoints.

### Phase 2 — Canonical libraries + recommendations
12. Create library tables and seed pipeline for supplements/nutrients/foods/exercises/programs.
13. Add read-only library endpoints with filtering and search.
14. Implement recommendation services for programs and nutrition templates.

### Phase 3 — Client sync integration (Axios + TanStack Query)
15. Create `useSync.ts` hook:
    - queue local mutations
    - debounce push
    - pull on app start + interval
    - retry and backoff on network failures
16. Add `deviceId` generation and storage.
17. Add `lastSyncVersion` storage in localStorage.
18. Implement conflict resolution UI and flow in client.
19. Add Axios interceptor for auth refresh + standard error mapping.
20. Use TanStack Query for `pull` caching + background refetch.

### Phase 4 — Data migration + versioning
21. Add `version` field to localStorage schema.
22. Implement `migrations.ts` with versioned transforms.
23. Add snapshot export/import with integrity checks.

### Phase 5 — Observability + QA
24. Add logging (tracing + structured logs) and request tracing.
25. Add health checks + uptime monitoring.
26. Add minimal integration tests for sync, auth, and conflicts.

### Phase 6 — Advanced analytics (optional future)
27. Build server-side aggregation endpoints (trend charts, streaks).
28. Add background jobs for cleanup and compaction.

---

## Suggested File Layout (backend)

```
server/
├── migrations/
├── src/
│   ├── main.rs
│   ├── config.rs
│   ├── routes/
│   │   ├── auth.rs
│   │   ├── sync.rs
│   │   └── export.rs
│   ├── services/
│   │   ├── auth_service.rs
│   │   ├── sync_service.rs
│   │   └── export_service.rs
│   ├── utils/
│   │   ├── crypto.rs
│   │   └── validation.rs
│   └── types/
│       └── api.rs
├── Cargo.toml
└── Dockerfile
```

---

## Open Questions
- Should we enable end-to-end encryption for snapshots?
- Do we need admin tools or user-facing audit history?
- Should sync be purely snapshot-based or mutation-based for v1?
- Which conflict resolution UX is preferred: auto-merge + review, or strict blocking on conflicts?

---

## Next Actions (if approved)
1. Scaffold backend folder with Rust + Axum + SQLx.
2. Implement auth + sync + conflict endpoints.
3. Add canonical library tables + seed pipeline.
4. Add client-side sync hook + Axios interceptor + TanStack Query integration.
