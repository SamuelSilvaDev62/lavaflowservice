# Recovery Engine MVP — validation contract

This file documents the first Recovery Engine experiment and avoids hidden assumptions in code or dashboards.

## Eligibility

- Uses delivered service orders from the last 365 days.
- Learns the client's median return interval when enough history exists.
- A client becomes eligible after exceeding roughly 125% of their normal interval, with conservative fallbacks for sparse history.
- Excludes clients contacted by a recovery campaign in the last 14 days.
- Excludes clients who already have an active future appointment.

## Execution

- The Recovery Engine never sends WhatsApp directly from the analysis screen.
- It creates a tracked campaign and target list.
- The owner opens WhatsApp from the Campaigns flow and explicitly confirms each real send.

## Attribution

- The attribution window is 14 days after a confirmed send.
- Revenue is recorded only when a service order is delivered.
- A service order receives at most one campaign attribution.
- Dashboard language must call this **attributed revenue by LavaFlow's operational rule**, not perfect causal proof.

## ROI

- Recovery ROI counts only campaigns marked `metadata.generated_by = recovery_engine`.
- Historical inactive-campaign results may inform expected conversion rates but cannot be counted as Recovery Engine revenue.
- AI cost is read from `ai_usage_logs`; the current deterministic engine should normally cost zero in LLM usage.
- Messaging cost is not tracked yet and must be shown as such.

## Current commercial reference

The dashboard may compare attributed revenue with the current Growth list price (R$ 99/month), but this is a product metric, not a promise or guarantee of return.
