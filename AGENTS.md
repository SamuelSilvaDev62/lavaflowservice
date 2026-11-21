# Architecture rules

- Read tenant billing state through the validated user's client and an explicit owner filter; reserve the administrative client for privileged writes so ordinary navigation does not require a service credential and remains protected by RLS.
- Keep the paginated orders contract separate from listOrdens; scan the tenant's lean period index in bounded batches for complete search and period KPIs, returning details only for the selected page without schema changes.