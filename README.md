# MACS — Military Administration & Command System

React + TypeScript + Tailwind + Supabase. Arabic-first, RTL.

## Setup

1. Create a Supabase project. Auth → Providers → Email: turn **off** "Allow new users to sign up".
2. SQL editor: run in order the five files in `supabase/migrations/` (`..._schema`, `_security`, `_seed`, `_storage`, `_rpc`), or `supabase db push`.
3. Auth → Users → Add user: email `minister@macs.internal`, strong password, Auto Confirm. Then edit and run `supabase/bootstrap_admin.sql`.
4. Deploy the account function (needs Supabase CLI): `supabase functions deploy admin-users` (service key is injected by Supabase; set secret `AUTH_EMAIL_DOMAIN` only if you changed the domain).
5. `cp .env.example .env`, fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only, never service_role).
6. `npm install && npm run dev`.

Login uses **username**; it maps to `<username>@<VITE_AUTH_EMAIL_DOMAIN>` internally.

## Security model

- RLS on every table. UI hiding is cosmetic; `has_perm(code, dept)` runs in the DB.
- Rank ≠ permission. Permissions come from `user_roles → role_permissions`. Roles are `global` or `department` scoped (department roles apply only to the holder's own department).
- Users cannot edit own rank/department/status, grant themselves roles, or review own requests (policies + triggers).
- Every change on sensitive tables is written to `audit_logs` by trigger (old/new JSON, actor).
- Account creation / password reset need the service-role key → must be a Supabase Edge Function (Phase 4), never frontend.

## Modules (all phases built)

Ranks, departments (+ detail tabs), personnel (+ promote/transfer/status/notes), laws, decisions, announcements, promotion/leave requests, admin hub (accounts, roles & permission matrix, site settings + updates, audit log), warehouses (stock, serials, custody, movement ledger, stocktake), intelligence (cases, investigations, evidence in private bucket, statements, anonymous-to-reader report filing), discipline, command dashboard.

Atomic workflows are SQL functions in the `_rpc` migration (`change_personnel`, `review_promotion`, `review_leave`, `stock_move`, `issue_custody`, `return_custody`, `command_stats`); all run as the caller so RLS still applies.

## Known limits

- Laws content is not seeded (only the 19 categories). Add through the Laws page.
- Tested on local Supabase (Docker): API/RLS/RPC suite, edge function, and UI flows (login, create account, promote, role-restricted nav). Not tested on a hosted project; no visual/screenshot review yet.
- Penalties are records; actual demotion/dismissal is applied from the personnel file.
- No pagination yet (lists capped at 100–300 rows); single JS bundle (~600 kB).

## Local testing (verified)

Needs Docker + Supabase CLI: `supabase start`, create users `minister`, `soldier1`, `soldier2` (password `Test12345!`, domain `macs.internal`) through the auth admin API, run `scripts/seed-test-users.sql`, then `node scripts/test-api.mjs` (48 RLS/RPC/embed checks) and, with `supabase functions serve --no-verify-jwt`, `node scripts/test-functions.mjs`. Migrations use timestamped names so the CLI applies them.
