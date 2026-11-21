# P0 — Tenant isolation, phase 1

## Implemented
- Shared deterministic tenant resolver used by core server functions, entitlement checks, and the client owner hook.
- Keeps current self-owned tenant precedence and existing single-company flows.
- Refuses to choose arbitrarily between two different external company memberships.
- Node regression tests added to CI.

## Security boundary and known limitations
This is a **fail-closed guard**, not complete multitenant switching. The RLS function `public.current_owner_id()` still chooses a tenant using the legacy rule. The guard must **not** be removed until RLS and every direct browser query use one authoritative server-validated active tenant. RLS can apply independently of frontend checks.

Before enabling switching:
1. Model active organization selection server-side, verify membership on every request, and decide how RLS receives the validated selection without trusting mutable client claims.
2. Migrate `current_owner_id()` and all policies to the same selection semantics.
3. Revalidate public booking endpoints, privileged functions and any service-role access.
4. Run allow/deny integration tests for SELECT/INSERT/UPDATE/DELETE across two test tenants, including a staff user who belongs to both.
5. Validate database policies locally or in an isolated staging database before production migration.

## Release
Do not deploy this branch as an announcement of multi-company switching. This change prevents ambiguous selection in covered application paths; it does not guarantee complete isolation without database integration testing.
