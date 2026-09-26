# TaxIQ Pro — Product Requirements Document

_Last updated: June 2026_

## 1. Product

TaxIQ Pro is a tax & expense platform for gig workers, self-employed people and
now **convenience-store (C-Store) chains**. It tracks income, receipts, mileage
and fuel, maximises deductions, and hands finished data to TurboTax, a CPA, or an
accounting system (QuickBooks / Xero / Sage).

Strategy (unchanged): **Phase 1 — be the ultimate tax *preparation* tool** that
complements TurboTax rather than replacing it. E-filing is a later phase.

New in this session: the tax engine is also packaged as a **module for the user's
separate C-Store BOS** (TypeScript + PostgreSQL) via a server-to-server API token.

---

## 2. What exists today

### Authentication & tenancy (built this session)
- Real JWT auth: `POST /api/auth/register`, `/api/auth/login`, `GET|PATCH /api/auth/me`.
  bcrypt via passlib, HS256 tokens, issuer/audience claims, timing-equalised login.
- Every data endpoint requires a Bearer token and is scoped to `user_id`.
  (Previously auth was a client-side mock and every export leaked all users' data.)
- Token stored in `expo-secure-store` on native, `localStorage` on web.
- `AuthGate` in `app/_layout.tsx` redirects unauthenticated users to `/login`.

### Store-chain module (built this session)
Hierarchy: **Store Chain → Store → Chain Owner / Store Owner / Store Manager / Driver-Employee**
(plus `individual` for solo gig workers).
- `POST /api/org` create chain, `POST|GET /api/org/stores`, `POST|GET /api/org/invites`
  (join codes), `GET /api/org/members`, `PATCH /api/org/members/{id}`.
- `GET /api/org/reports/summary` — consolidated totals, per-store and per-employee.
- **Privacy rule:** chain reports include *only* records flagged `is_business: true`.
  Personal receipts/trips are never exposed to owners or managers.
- `POST /api/org/service-token` — one-time hashed token for the external BOS
  backend (`Authorization: Bearer svc_xxx.yyy`), rejected on user-only routes.
- UI: `app/store-chain.tsx`.

### Real exports (replaced fake "Coming Soon" placeholders)
| Endpoint | Output |
|---|---|
| `GET /api/export/turbotax` | JSON preview for the on-screen summary |
| `GET /api/export/turbotax.csv` | Multi-section CSV: summary, Schedule C totals, income, expenses, mileage |
| `GET /api/export/schedule-c.csv` / `.pdf` | Schedule C line detail |
| `GET /api/export/mileage-log.csv` / `.pdf` | IRS Pub-463 compliant trip log |
| `GET /api/export/receipt-summary.pdf` | Receipts with category + deductible flag |
| `GET /api/export/cpa-package` / `.pdf` | Full CPA documentation package |

PDFs are generated with `reportlab`. All accept `?year=`, `?scope=business|personal|all`,
`?store_id=`. Downloads work on web (blob + anchor) and native (`expo-file-system`
`File.downloadFileAsync` + `expo-sharing`) via `src/services/download.ts`.

### Accounting integration
- `GET /api/export/accounting/formats`
- `GET /api/export/accounting?format=…` producing:
  `quickbooks_online_csv`, `quickbooks_desktop_csv` (3-column bank import, BOM-free),
  `quickbooks_iif` (balanced TRNS/SPL general journal), `xero_csv`,
  `sage_csv`, `generic_journal_csv`.
- Chart-of-accounts mapping: `GET|PUT /api/export/coa-mapping` + `app/coa-mapping.tsx`.
- **QuickBooks Online live sync** (`routes/qbo.py`): OAuth 2.0 authorize/callback,
  refresh-token rotation, `GET /api/qbo/accounts`, `POST /api/qbo/sync` posting one
  balanced JournalEntry per record with a stable `requestid` + `qbo_sync_log` so
  retries never duplicate. UI: `app/qbo-sync.tsx`.
  **Blocked:** needs `INTUIT_CLIENT_ID` / `INTUIT_CLIENT_SECRET` in `backend/.env`
  and the redirect URI registered in the Intuit Developer dashboard. Degrades
  gracefully (503 with a clear message) while unconfigured.

### Personal vs business + barcode capture
- `add-receipt.tsx` has a Business / Personal segmented control (Business default)
  with an explicit privacy note, plus an optional store chip picker.
- `app/barcode-scan.tsx` scans product barcodes (`expo-camera`, EAN/UPC/Code128)
  for warehouse stock purchases; result flows back via `src/store/scanStore.ts`.
- New categories for store operators: Inventory & Stock, Fuel, Travel, Bank Fees.

### Theme system (built this session)
- `src/theme.ts` + `src/context/ThemeContext.tsx`: full light **and** dark palettes,
  `useColors()` flat palette, plus a live `C` palette for module-scope constants.
- **Lufthansa centenary livery**: deep navy (`#05164D`) fuselage with crane-yellow
  (`#FFAD00`) accents in dark mode; navy-on-white with dark-gold accents in light mode.
- Light / Dark / Auto switcher in Settings → Appearance, persisted to AsyncStorage.
- All 30 screens migrated from hardcoded hex to `makeStyles(c)` + `useColors()`.

### Route scheduling (built this session)
- `routes/route_planner.py` — reusable route plans (2+ stops, haversine planned miles),
  weekly scheduling (idempotent per plan+date+driver), and a drive flow:
  `start` → `arrive` (GPS coords, falls back to planned coords) → `complete`.
- Completing a run writes exactly ONE `mileage` document (`purpose: Business`,
  `is_business: true`, `deduction_amount = miles * 0.70`) and returns 409 on a
  second attempt, so a route can never be double-logged.
- UI: `app/route-planner.tsx` (weekly grid + saved routes + schedule sheet) and
  `app/route-run.tsx` (stop-by-stop arrival confirmation with progress bar).

### Shopping Run Mode (built this session)
- `routes/shopping.py` — one open run per user, scan items into a cart, then
  check out into a single expense holding every line item.
- Re-scanning the same barcode bumps quantity instead of adding a row.
- `GET /api/shopping-runs/lookup/{barcode}` remembers the item name and last
  price from the user's own scan history (no external product database).
- Checkout accepts an explicit `receipt_total` or a receipt photo the AI reads,
  reports the `variance` vs the scanned total, and 409s on a second checkout.
- UI: `app/shopping-run.tsx`, feeding off `app/barcode-scan.tsx`.

### Owner Dashboard — chain spend (built this session)
- `GET /api/org/reports/spend?period=week|month` — business spend per store for
  the current period vs the previous one, with per-category breakdown, miles,
  and chain-wide category totals.
- A store is flagged only when it rises by **both** ≥25% and ≥$50, so small
  bases never raise false alarms. Personal records are excluded entirely.
- 404 when the caller has no chain, 403 for driver-employees.
- UI: `app/owner-dashboard.tsx`.

### Pre-existing features (still working)
Dashboard with tax estimates & audit-risk score, AI receipt scanning, AI Tax Coach,
Tax Filing Analyzer, Deduction Maximizer, Quarterly Tax Estimator, Gas Finder (EIA),
bank-statement PDF parsing, gig-platform CSV import, live GPS trip tracking,
swipe-to-classify, tax reminders, subscription tiers.

### Backend structure (refactored this session)
```
/app/backend
├── server.py            # 78 lines: app, CORS, router registration
├── core/database.py     # single shared motor client
├── core/security.py     # JWT, bcrypt, roles, service tokens, tenant filters
├── core/shared.py       # models, constants, AI helper functions
└── routes/
    ├── auth.py  org.py  exports.py  export_utils.py  qbo.py
    ├── records.py  geo.py  imports.py  trips.py  reminders.py
    ├── gas.py  taxtools.py
    ├── route_planner.py  shopping.py  spend.py
```
`server.py` went from 2,245 monolithic lines to 78.

---

## 3. Data model

- `users`: email, password_hash, name, role, organization_id, store_id, gig_types,
  profession, onboarded, subscription_tier, disabled
- `organizations`: name, type, owner_user_id
- `stores`: organization_id, name, address, store_number
- `invites`: code, organization_id, store_id, role, used, used_by
- `service_tokens`: public_id, token_hash (SHA-256), organization_id, scopes, revoked
- `receipts`: user_id, organization_id, store_id, vendor, amount, date, category,
  notes, image_base64, barcode, line_items, is_business, is_deductible
- `mileage`: user_id, organization_id, store_id, start/end location + coords,
  distance, distance_miles, purpose, is_business, deduction_amount, is_auto_detected
- `income`: user_id, organization_id, store_id, source, amount, date, is_1099, is_business
- `coa_mappings`: user_id, mapping
- `qbo_tokens` / `qbo_states` / `qbo_sync_log`
- `route_plans`: user_id, organization_id, store_id, name, stops, round_trip, planned_miles
- `route_runs`: plan_id, assignee_id, date, status, stops (with arrived_at + actual coords),
  planned_miles, actual_miles, deduction_amount, mileage_id
- `shopping_runs`: user_id, organization_id, store_id, vendor, category, status,
  items (barcode, name, qty, unit_price), receipt_total, receipt_id
- `reminders`, `trip_settings`, `filing_analyses`

---

## 4. Integrations

| Integration | Status |
|---|---|
| Emergent LLM Key — Claude `claude-sonnet-4-6` (receipt + tax coach) | Working |
| Emergent LLM Key — Gemini `gemini-2.5-flash` (tax document parsing) | Working |
| EIA gas price API (no key) | Working |
| QuickBooks Online OAuth 2.0 | **Configured** with Intuit sandbox credentials; authorize URL live |
| QuickBooks Desktop (IIF / CSV), Xero, Sage | File exports working |

---

## 5. Known gaps / backlog

1. **QuickBooks Online connect** — sandbox keys are in place; the user still needs
   to complete the Intuit consent screen once to link a company, and the redirect
   URI must stay registered in the Intuit Developer dashboard.
2. **Background trip detection** — needs a native build; not testable in Expo Go.
3. **Pricing routes** — route scheduling now exists; a dedicated pricing-route
   workflow (competitor price checks per stop) is not built.
4. **Audit Risk Analysis** deep-dive screen is still a placeholder.
5. **Plaid** direct bank/card import (Phase 2).
6. No `testID` attributes on interactive elements — makes automated UI testing brittle.
7. CPA marketplace and Simple Schedule C e-filing (future phases).

---

## 6. Test credentials

See `/app/memory/test_credentials.md`.
`demo@taxiqpro.app` / `TaxIQdemo2026!` — chain owner of "QuickStop Chain".
