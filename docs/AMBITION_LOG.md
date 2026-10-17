# Ambition Log

Running log of the approved plan (`docs/AMBITION_PLAN.md`). Each entry: what changed, the
judge that verified it, before → after numbers.

## 2026-10-17 — Plan approved
Decisions: Render free (server DB disposable → device-as-backup in Bet 4), drop no-spread rule,
theme follows OS.

Baseline (from plan §1/§7): cold start → Focus ≈ 2.3–3.9 s (emulator, release); offline cold
start → Login; startup = 7 requests, p50 149 / p95 267 ms; 4/11 actions ≤ 2 taps; 3/~25 write
types offline; tests: mobile utils 7/17, backend services 0/14, routes 2/59, e2e 1/5;
WCAG pairs failing 69/160; Hermes 3.46 MB, assets 8.24 MB.
