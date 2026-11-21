# Sprint 1 — Stability and regression baseline (2026-11-21)

## Scope
Read-only production HTTP smoke and deterministic regression tests for subscription
entitlements. No production deploy, database write or Stripe action.

## Current evidence
- Latest main commit `1c28a29e` restores public connection configuration.
- Main GitHub CI passed on 2026-11-21. This verifies TypeScript/build, **not** browser startup.
- The earlier production error was the TanStack root ErrorComponent, while Lovable preview loaded.
- The draft security PR #14 is still unmerged. Its tenant selection changes must be reviewed independently.

## Verification matrix
| Concern | Automated in this PR | Not yet covered |
| --- | --- | --- |
| TypeScript/build | Existing CI | Production deploy correctness |
| Plan tiers | Node unit regression tests | Stripe webhook + live subscription lifecycle |
| Public routes | HTTP GET plus Chromium guest-page hydration for /, /auth, /lp | Authenticated routes and real user workflows |
| Auth | None | Login/logout, expired JWT, protected route redirect, multiple memberships |
| Booking | None | Public booking contention, capacity, write permissions |
| Multi-tenant isolation | None | Actual Supabase RLS SELECT/INSERT/UPDATE/DELETE across two accounts |
| PWA | None | Fresh browser vs returning visitor, service-worker update |
| Payment | None | Signed/unsigned webhook, event replay and idempotency |

## Rollout rules
1. Keep PR draft until checks run and results are understood.
2. Never run synthetic booking against the real production database.
3. Use a staging Supabase project with two seeded test organizations for authenticated e2e.
4. HTTP smoke checks availability only; the separate Chromium test detects guest root error boundaries and uncaught page errors, not authenticated flows.
5. Only merge regression tests after check results are reviewed.

## Follow-up
- Fix production browser errors using actual runtime logs or a controlled browser E2E.
- Build staging tests for auth/booking/entitlements/webhooks.
- Resolve multi-tenant RLS semantics before adding an active-organization switcher.
- Revisit CI dependency lock reproducibility separately.
