# Test Credentials — TaxIQ Pro

Backend auth is real JWT (email + password) at `POST /api/auth/login`.

## Chain owner / primary demo account
- email: `demo@taxiqpro.app`
- password: `TaxIQdemo2026!`
- role: `chain_owner` (organization "QuickStop Chain")

Notes:
- Passwords must be at least 8 characters on registration.
- `.test` / `.local` TLDs are rejected by email validation — use `.app` or `.com`.
- Employees join a chain with an invite code from `POST /api/org/invites`
  (chain owner only), then register with `invite_code` in the body.
