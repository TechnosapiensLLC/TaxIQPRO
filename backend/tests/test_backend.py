"""TaxIQ Pro comprehensive backend tests: auth, isolation, exports, org, qbo."""
import os
import time
import uuid
import requests
from datetime import datetime

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://quick-revenue-apps.preview.emergentagent.com").rstrip("/")

CURRENT_YEAR = datetime.now().year


def _unique_email(prefix="usr"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}@taxiqpro.app"


def _register(email=None, password="Password123!", name="Test User", invite_code=None):
    email = email or _unique_email()
    body = {"email": email, "password": password, "name": name}
    if invite_code:
        body["invite_code"] = invite_code
    r = requests.post(f"{BASE_URL}/api/auth/register", json=body, timeout=30)
    return r, email


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


# ---------- AUTH ----------
class TestAuth:
    def test_register_success(self):
        r, email = _register()
        assert r.status_code == 201, r.text
        j = r.json()
        assert "access_token" in j and j["user"]["email"] == email

    def test_register_duplicate_email(self):
        r1, email = _register()
        assert r1.status_code == 201
        r2, _ = _register(email=email)
        assert r2.status_code == 409

    def test_register_short_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": _unique_email(), "password": "short", "name": "x"}, timeout=15)
        assert r.status_code == 422

    def test_login_ok_and_bad(self):
        r, email = _register()
        assert r.status_code == 201
        r_ok = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Password123!"}, timeout=15)
        assert r_ok.status_code == 200 and "access_token" in r_ok.json()
        r_bad = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "wrong123!"}, timeout=15)
        assert r_bad.status_code == 401

    def test_me_requires_token(self):
        assert requests.get(f"{BASE_URL}/api/auth/me", timeout=15).status_code == 401

    def test_me_and_patch(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        r_me = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(tok), timeout=15)
        assert r_me.status_code == 200
        r_p = requests.patch(f"{BASE_URL}/api/auth/me", headers=_hdr(tok), json={"name": "New Name", "profession": "Driver", "onboarded": True}, timeout=15)
        assert r_p.status_code == 200
        j = r_p.json()
        assert j["name"] == "New Name" and j["profession"] == "Driver" and j["onboarded"] is True


# ---------- AUTH ENFORCEMENT ----------
class TestAuthEnforcement:
    ENDPOINTS = [
        ("GET", "/api/dashboard"),
        ("GET", "/api/receipts"),
        ("GET", "/api/mileage"),
        ("GET", "/api/income"),
        ("GET", "/api/reminders"),
        ("GET", "/api/trips/settings"),
        ("GET", "/api/trips/pending"),
        ("GET", "/api/export/turbotax"),
        ("GET", "/api/export/turbotax.csv"),
        ("GET", "/api/export/schedule-c.csv"),
        ("GET", "/api/export/schedule-c.pdf"),
        ("GET", "/api/export/mileage-log.csv"),
        ("GET", "/api/export/cpa-package"),
        ("GET", "/api/export/accounting/formats"),
        ("GET", "/api/export/coa-mapping"),
        ("GET", "/api/org/me"),
        ("GET", "/api/org/stores"),
        ("GET", "/api/org/members"),
    ]

    def test_all_data_endpoints_require_auth(self):
        failures = []
        for method, path in self.ENDPOINTS:
            r = requests.request(method, f"{BASE_URL}{path}", timeout=15)
            if r.status_code != 401:
                failures.append((path, r.status_code))
        assert not failures, f"Endpoints not 401 without token: {failures}"


# ---------- MULTI-TENANT ISOLATION ----------
class TestMultiTenantIsolation:
    def _seed(self, tok, business=True):
        rc = requests.post(f"{BASE_URL}/api/receipts", headers=_hdr(tok), json={
            "vendor": "TEST_Vendor", "amount": 100.0, "date": f"{CURRENT_YEAR}-06-15",
            "category": "Vehicle & Gas", "is_business": business,
        }, timeout=15)
        assert rc.status_code == 200, rc.text
        rid = rc.json()["id"]
        mm = requests.post(f"{BASE_URL}/api/mileage", headers=_hdr(tok), json={
            "start_location": "A", "end_location": "B", "distance": 25.0,
            "purpose": "Business", "date": f"{CURRENT_YEAR}-06-15",
        }, timeout=15)
        assert mm.status_code == 200, mm.text
        mid = mm.json()["id"]
        ic = requests.post(f"{BASE_URL}/api/income", headers=_hdr(tok), json={
            "source": "Uber", "amount": 500.0, "date": f"{CURRENT_YEAR}-06-10",
        }, timeout=15)
        assert ic.status_code == 200
        return rid, mid

    def test_user_b_cannot_see_user_a(self):
        ra, _ = _register()
        rb, _ = _register()
        tok_a = ra.json()["access_token"]
        tok_b = rb.json()["access_token"]
        rid, mid = self._seed(tok_a)

        # B lists should not contain A's ids
        r_receipts_b = requests.get(f"{BASE_URL}/api/receipts", headers=_hdr(tok_b), timeout=15).json()
        r_mileage_b = requests.get(f"{BASE_URL}/api/mileage", headers=_hdr(tok_b), timeout=15).json()
        r_income_b = requests.get(f"{BASE_URL}/api/income", headers=_hdr(tok_b), timeout=15).json()
        assert all(x["id"] != rid for x in r_receipts_b)
        assert all(x["id"] != mid for x in r_mileage_b)
        # dashboard for B should be zero for these
        db_b = requests.get(f"{BASE_URL}/api/dashboard", headers=_hdr(tok_b), timeout=15).json()
        assert db_b["total_income"] == 0 and db_b["total_expenses"] == 0

        # cross access to A's receipt -> 404
        r_get = requests.get(f"{BASE_URL}/api/receipts/{rid}", headers=_hdr(tok_b), timeout=15)
        assert r_get.status_code == 404
        r_del = requests.delete(f"{BASE_URL}/api/receipts/{rid}", headers=_hdr(tok_b), timeout=15)
        assert r_del.status_code == 404

        # A's turbotax export must have data, B's must be zero
        exp_a = requests.get(f"{BASE_URL}/api/export/turbotax", headers=_hdr(tok_a), timeout=30).json()
        exp_b = requests.get(f"{BASE_URL}/api/export/turbotax", headers=_hdr(tok_b), timeout=30).json()
        assert exp_a["record_counts"]["expenses"] >= 1
        assert exp_b["record_counts"]["expenses"] == 0
        assert exp_b["record_counts"]["income"] == 0


# ---------- CRUD new fields ----------
class TestCrudNewFields:
    def test_receipt_stores_is_business_and_barcode(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        payload = {
            "vendor": "TEST_Store", "amount": 42.0, "date": f"{CURRENT_YEAR}-06-01",
            "category": "Food & Meals", "is_business": True, "barcode": "1234567890",
            "line_items": [{"name": "Item A", "qty": 1, "price": 42.0}],
        }
        rc = requests.post(f"{BASE_URL}/api/receipts", headers=_hdr(tok), json=payload, timeout=15)
        assert rc.status_code == 200
        j = rc.json()
        assert j["is_business"] is True
        assert j["barcode"] == "1234567890"
        assert j["line_items"] and j["line_items"][0]["name"] == "Item A"

        # classify to personal
        rid = j["id"]
        r_cls = requests.patch(f"{BASE_URL}/api/receipts/{rid}/classify", headers={"Authorization": f"Bearer {tok}"}, data={"is_deductible": "false"}, timeout=15)
        assert r_cls.status_code == 200
        # verify
        r_get = requests.get(f"{BASE_URL}/api/receipts/{rid}", headers=_hdr(tok), timeout=15).json()
        assert r_get["is_business"] is False

    def test_mileage_stores_both_distances(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        rc = requests.post(f"{BASE_URL}/api/mileage", headers=_hdr(tok), json={
            "start_location": "X", "end_location": "Y", "distance": 30.0,
            "purpose": "Business", "date": f"{CURRENT_YEAR}-05-01",
        }, timeout=15)
        assert rc.status_code == 200
        j = rc.json()
        assert j["distance"] == 30.0 and j.get("distance_miles") == 30.0
        assert j["is_business"] is True
        assert j["deduction_amount"] > 0


# ---------- EXPORTS ----------
class TestExports:
    def _seed_full(self, tok):
        # business receipt
        requests.post(f"{BASE_URL}/api/receipts", headers=_hdr(tok), json={
            "vendor": "TEST_Biz", "amount": 120.5, "date": f"{CURRENT_YEAR}-03-15",
            "category": "Vehicle & Gas", "is_business": True,
        }, timeout=15)
        # personal receipt
        requests.post(f"{BASE_URL}/api/receipts", headers=_hdr(tok), json={
            "vendor": "TEST_Personal", "amount": 200.0, "date": f"{CURRENT_YEAR}-03-16",
            "category": "Food & Meals", "is_business": False,
        }, timeout=15)
        # mileage
        requests.post(f"{BASE_URL}/api/mileage", headers=_hdr(tok), json={
            "start_location": "A", "end_location": "B", "distance": 50.0,
            "purpose": "Business", "date": f"{CURRENT_YEAR}-04-10",
        }, timeout=15)
        # income
        requests.post(f"{BASE_URL}/api/income", headers=_hdr(tok), json={
            "source": "Uber", "amount": 1000.0, "date": f"{CURRENT_YEAR}-04-05",
        }, timeout=15)

    def test_all_exports(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        self._seed_full(tok)
        h = _hdr(tok)

        # 1. TurboTax preview JSON
        pv = requests.get(f"{BASE_URL}/api/export/turbotax", headers=h, timeout=30)
        assert pv.status_code == 200 and "summary" in pv.json()

        # 2. TurboTax CSV
        csv_r = requests.get(f"{BASE_URL}/api/export/turbotax.csv", headers=h, timeout=30)
        assert csv_r.status_code == 200
        assert "text/csv" in csv_r.headers.get("content-type", "")
        assert "attachment" in csv_r.headers.get("content-disposition", "")
        assert b"TEST_Biz" in csv_r.content
        assert len(csv_r.content) > 100

        # 3. Schedule C CSV
        sc_csv = requests.get(f"{BASE_URL}/api/export/schedule-c.csv", headers=h, timeout=30)
        assert sc_csv.status_code == 200 and "text/csv" in sc_csv.headers.get("content-type", "")

        # 4. Schedule C PDF
        sc_pdf = requests.get(f"{BASE_URL}/api/export/schedule-c.pdf", headers=h, timeout=30)
        assert sc_pdf.status_code == 200
        assert "application/pdf" in sc_pdf.headers.get("content-type", "")
        assert sc_pdf.content.startswith(b"%PDF")

        # 5. Mileage CSV & PDF
        ml_csv = requests.get(f"{BASE_URL}/api/export/mileage-log.csv", headers=h, timeout=30)
        assert ml_csv.status_code == 200 and "text/csv" in ml_csv.headers.get("content-type", "")
        ml_pdf = requests.get(f"{BASE_URL}/api/export/mileage-log.pdf", headers=h, timeout=30)
        assert ml_pdf.status_code == 200 and ml_pdf.content.startswith(b"%PDF")

        # 6. Receipt summary PDF
        rs_pdf = requests.get(f"{BASE_URL}/api/export/receipt-summary.pdf", headers=h, timeout=30)
        assert rs_pdf.status_code == 200 and rs_pdf.content.startswith(b"%PDF")

        # 7. CPA package JSON + PDF
        cpa = requests.get(f"{BASE_URL}/api/export/cpa-package", headers=h, timeout=30)
        assert cpa.status_code == 200
        cpa_pdf = requests.get(f"{BASE_URL}/api/export/cpa-package.pdf", headers=h, timeout=30)
        assert cpa_pdf.status_code == 200 and cpa_pdf.content.startswith(b"%PDF")

    def test_scope_and_year(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        self._seed_full(tok)
        h = _hdr(tok)
        biz = requests.get(f"{BASE_URL}/api/export/turbotax.csv?scope=business", headers=h, timeout=30).content
        per = requests.get(f"{BASE_URL}/api/export/turbotax.csv?scope=personal", headers=h, timeout=30).content
        assert b"TEST_Biz" in biz
        assert b"TEST_Biz" not in per
        assert b"TEST_Personal" in per
        yr = requests.get(f"{BASE_URL}/api/export/turbotax.csv?year={CURRENT_YEAR}", headers=h, timeout=30)
        assert yr.status_code == 200


# ---------- ACCOUNTING EXPORTS ----------
class TestAccountingExports:
    def test_formats_list(self, ):
        r, _ = _register()
        tok = r.json()["access_token"]
        h = _hdr(tok)
        rf = requests.get(f"{BASE_URL}/api/export/accounting/formats", headers=h, timeout=15)
        assert rf.status_code == 200
        j = rf.json()
        # 6 formats
        keys = j.get("formats") if isinstance(j, dict) else j
        # try flexible
        if isinstance(j, dict) and "formats" in j:
            fmts = [f.get("id") or f.get("value") or f.get("format") for f in j["formats"]]
        else:
            fmts = [f.get("id") or f.get("value") or f.get("format") for f in j]
        assert len(fmts) >= 6, f"Expected >=6 formats, got {fmts}"

    def _seed(self, tok):
        requests.post(f"{BASE_URL}/api/receipts", headers=_hdr(tok), json={
            "vendor": "TEST_Acct", "amount": 55.5, "date": f"{CURRENT_YEAR}-02-02",
            "category": "Vehicle & Gas", "is_business": True,
        }, timeout=15)
        requests.post(f"{BASE_URL}/api/mileage", headers=_hdr(tok), json={
            "start_location": "M", "end_location": "N", "distance": 10.0,
            "purpose": "Business", "date": f"{CURRENT_YEAR}-02-03",
        }, timeout=15)
        requests.post(f"{BASE_URL}/api/income", headers=_hdr(tok), json={
            "source": "Lyft", "amount": 300.0, "date": f"{CURRENT_YEAR}-02-04",
        }, timeout=15)

    def test_qbo_online_csv(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        self._seed(tok)
        h = _hdr(tok)
        rc = requests.get(f"{BASE_URL}/api/export/accounting?format=quickbooks_online_csv", headers=h, timeout=30)
        assert rc.status_code == 200
        assert "text/csv" in rc.headers.get("content-type", "")
        text = rc.content.decode("utf-8-sig", errors="ignore")  # strip Excel BOM if any
        first_line = text.splitlines()[0].strip()
        assert first_line == "Date,Description,Amount", f"Header mismatch: {first_line!r}"
        # expenses negative, income positive
        lines = text.splitlines()[1:]
        has_neg = any(",-" in ln for ln in lines)
        has_pos = any(ln.rstrip().split(",")[-1].replace(".", "").isdigit() and not ln.rstrip().split(",")[-1].startswith("-") for ln in lines)
        assert has_neg and has_pos

    def test_iif_balanced(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        self._seed(tok)
        h = _hdr(tok)
        rc = requests.get(f"{BASE_URL}/api/export/accounting?format=quickbooks_iif", headers=h, timeout=30)
        assert rc.status_code == 200
        text = rc.content.decode("utf-8", errors="ignore")
        assert "!TRNS" in text and "!SPL" in text and "!ENDTRNS" in text
        # tab-separated
        assert "\t" in text
        # check TRNS+SPL pairs balance to zero
        total = 0.0
        for line in text.splitlines():
            if line.startswith("TRNS\t") or line.startswith("SPL\t"):
                parts = line.split("\t")
                # amount usually last numeric col — try each
                for p in reversed(parts):
                    try:
                        total += float(p)
                        break
                    except ValueError:
                        continue
            elif line.startswith("ENDTRNS"):
                assert abs(total) < 0.01, f"Unbalanced TRNS group, net={total}"
                total = 0.0

    def test_sage_balanced(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        self._seed(tok)
        h = _hdr(tok)
        rc = requests.get(f"{BASE_URL}/api/export/accounting?format=sage_csv", headers=h, timeout=30)
        assert rc.status_code == 200
        # try to parse debit/credit columns
        import csv, io
        rd = csv.DictReader(io.StringIO(rc.content.decode("utf-8")))
        total_dr = 0.0
        total_cr = 0.0
        for row in rd:
            for k, v in row.items():
                if not k:
                    continue
                lk = k.lower()
                try:
                    val = float(v) if v else 0.0
                except ValueError:
                    val = 0.0
                if "debit" in lk:
                    total_dr += val
                elif "credit" in lk:
                    total_cr += val
        # allow small tolerance
        assert abs(total_dr - total_cr) < 0.05, f"Sage not balanced: dr={total_dr} cr={total_cr}"

    def test_invalid_format(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        h = _hdr(tok)
        rc = requests.get(f"{BASE_URL}/api/export/accounting?format=bogus_fmt", headers=h, timeout=15)
        assert rc.status_code == 400

    def test_all_five_formats_download(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        self._seed(tok)
        h = _hdr(tok)
        for f in ["quickbooks_online_csv", "quickbooks_desktop_csv", "quickbooks_iif", "xero_csv", "sage_csv", "generic_journal_csv"]:
            rr = requests.get(f"{BASE_URL}/api/export/accounting?format={f}", headers=h, timeout=30)
            assert rr.status_code == 200, f"{f} -> {rr.status_code} {rr.text[:200]}"
            assert "attachment" in rr.headers.get("content-disposition", "").lower()


# ---------- COA MAPPING ----------
class TestCoaMapping:
    def test_get_and_save(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        h = _hdr(tok)
        g = requests.get(f"{BASE_URL}/api/export/coa-mapping", headers=h, timeout=15)
        assert g.status_code == 200
        j = g.json()
        assert "mapping" in j and "defaults" in j and "categories" in j and "special_accounts" in j
        # save custom mapping
        put = requests.put(f"{BASE_URL}/api/export/coa-mapping", headers=h, json={"mapping": {"Vehicle & Gas": "MyCustomGasAcct"}}, timeout=15)
        assert put.status_code == 200
        assert put.json()["mapping"].get("Vehicle & Gas") == "MyCustomGasAcct"
        # verify reflected in xero/iif output
        # seed one expense
        requests.post(f"{BASE_URL}/api/receipts", headers=h, json={
            "vendor": "TEST_gasstation", "amount": 20.0, "date": f"{CURRENT_YEAR}-01-05",
            "category": "Vehicle & Gas", "is_business": True,
        }, timeout=15)
        xero = requests.get(f"{BASE_URL}/api/export/accounting?format=xero_csv", headers=h, timeout=30)
        assert xero.status_code == 200
        assert b"MyCustomGasAcct" in xero.content


# ---------- ORG / STORE CHAIN ----------
class TestOrgFlow:
    def test_full_org_flow(self):
        # Owner
        r_own, own_email = _register()
        tok_own = r_own.json()["access_token"]
        h_own = _hdr(tok_own)

        # create chain
        cc = requests.post(f"{BASE_URL}/api/org", headers=h_own, json={"name": "TEST_Chain"}, timeout=15)
        assert cc.status_code == 201, cc.text
        org_id = cc.json()["id"]

        # cannot create twice
        cc2 = requests.post(f"{BASE_URL}/api/org", headers=h_own, json={"name": "Other"}, timeout=15)
        assert cc2.status_code == 409

        # /me
        me = requests.get(f"{BASE_URL}/api/org/me", headers=h_own, timeout=15).json()
        assert me["organization"]["id"] == org_id and me["role"] == "chain_owner"

        # add store
        st = requests.post(f"{BASE_URL}/api/org/stores", headers=h_own, json={"name": "Store 1"}, timeout=15)
        assert st.status_code == 201
        store_id = st.json()["id"]

        # invite driver
        inv_drv = requests.post(f"{BASE_URL}/api/org/invites", headers=h_own, json={"role": "driver_employee", "store_id": store_id}, timeout=15)
        assert inv_drv.status_code == 201
        drv_code = inv_drv.json()["code"]

        # register a driver with invite code
        r_drv, drv_email = _register(invite_code=drv_code)
        assert r_drv.status_code == 201
        drv_user = r_drv.json()["user"]
        assert drv_user["role"] == "driver_employee"
        assert drv_user["organization_id"] == org_id
        assert drv_user["store_id"] == store_id
        tok_drv = r_drv.json()["access_token"]

        # driver cannot add store or create invite
        assert requests.post(f"{BASE_URL}/api/org/stores", headers=_hdr(tok_drv), json={"name": "Nope"}, timeout=15).status_code == 403
        assert requests.post(f"{BASE_URL}/api/org/invites", headers=_hdr(tok_drv), json={"role": "driver_employee"}, timeout=15).status_code == 403

        # members list
        members = requests.get(f"{BASE_URL}/api/org/members", headers=h_own, timeout=15)
        assert members.status_code == 200
        emails = [m["email"] for m in members.json()]
        assert own_email in emails and drv_email in emails

        # role change by owner
        pu = requests.patch(f"{BASE_URL}/api/org/members/{drv_user['id']}", headers=h_own, json={"role": "store_manager"}, timeout=15)
        assert pu.status_code == 200 and pu.json()["role"] == "store_manager"

        # ORG PRIVACY: create receipts as driver, one business, one personal
        # need to relog driver to pick up new role
        h_drv = _hdr(tok_drv)
        requests.post(f"{BASE_URL}/api/receipts", headers=h_drv, json={
            "vendor": "TEST_BusExp", "amount": 77.0, "date": f"{CURRENT_YEAR}-06-01",
            "category": "Vehicle & Gas", "is_business": True, "store_id": store_id,
        }, timeout=15)
        requests.post(f"{BASE_URL}/api/receipts", headers=h_drv, json={
            "vendor": "TEST_PersonalExp", "amount": 999.99, "date": f"{CURRENT_YEAR}-06-02",
            "category": "Food & Meals", "is_business": False, "store_id": store_id,
        }, timeout=15)

        # owner reads reports/summary — only business
        rep = requests.get(f"{BASE_URL}/api/org/reports/summary", headers=h_own, timeout=15)
        assert rep.status_code == 200
        j = rep.json()
        assert j["totals"]["expenses"] == 77.0, j
        # per_employee/per_store must sum matches business only
        assert all(row["expenses"] == 77.0 or row["expenses"] == 0 for row in j["per_store"])

        # service token — only chain owner
        stok = requests.post(f"{BASE_URL}/api/org/service-token", headers=h_own, json={"service_name": "test-bos", "scopes": ["reports:read"]}, timeout=15)
        assert stok.status_code == 201
        service_token = stok.json()["token"]

        # driver (now store_manager) cannot
        stok2 = requests.post(f"{BASE_URL}/api/org/service-token", headers=h_drv, json={"service_name": "x"}, timeout=15)
        assert stok2.status_code == 403

        # service token rejected on /auth/me
        sh = {"Authorization": f"Bearer {service_token}"}
        me_svc = requests.get(f"{BASE_URL}/api/auth/me", headers=sh, timeout=15)
        assert me_svc.status_code == 403


# ---------- QBO ----------
class TestQBOGraceful:
    def test_qbo_endpoints_do_not_500(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        h = _hdr(tok)
        s = requests.get(f"{BASE_URL}/api/qbo/status", headers=h, timeout=15)
        assert s.status_code == 200
        js = s.json()
        # Credentials are configured in sandbox mode
        assert js.get("configured") is True and js.get("connected") is False

        a = requests.get(f"{BASE_URL}/api/qbo/authorize", headers=h, timeout=15)
        # 200 when configured (returns Intuit OAuth URL), 503 when not
        assert a.status_code in (200, 503)

        ac = requests.get(f"{BASE_URL}/api/qbo/accounts", headers=h, timeout=15)
        assert ac.status_code in (409, 503)

        sy = requests.post(f"{BASE_URL}/api/qbo/sync", headers=h, json={"clearing_account_id": "1"}, timeout=15)
        assert sy.status_code in (409, 503), f"QBO sync unexpected: {sy.status_code} {sy.text[:200]}"


# ---------- AI/misc still working ----------
class TestMiscEndpoints:
    def test_categories_includes_new(self):
        r = requests.get(f"{BASE_URL}/api/categories", timeout=15)
        assert r.status_code == 200
        j = r.json()
        for cat in ["Inventory & Stock", "Fuel", "Travel", "Bank Fees"]:
            assert cat in j, f"Missing {cat}"

    def test_tax_dates(self):
        r = requests.get(f"{BASE_URL}/api/tax-dates", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_gas_stations(self):
        r = requests.get(f"{BASE_URL}/api/gas-stations?lat=37.77&lng=-122.42", timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert "stations" in j and len(j["stations"]) > 0

    def test_deduction_max_and_quarterly_require_auth(self):
        assert requests.get(f"{BASE_URL}/api/deduction-maximizer", timeout=15).status_code == 401
        assert requests.get(f"{BASE_URL}/api/quarterly-estimator", timeout=15).status_code == 401

    def test_reminders_setup_defaults(self):
        r, _ = _register()
        tok = r.json()["access_token"]
        h = _hdr(tok)
        rr = requests.post(f"{BASE_URL}/api/reminders/setup-defaults", headers=h, timeout=15)
        assert rr.status_code == 200
        lst = requests.get(f"{BASE_URL}/api/reminders", headers=h, timeout=15)
        assert lst.status_code == 200 and len(lst.json()) > 0

    def test_tax_coach_needs_auth(self):
        assert requests.post(f"{BASE_URL}/api/tax-coach", json={"message": "hi"}, timeout=15).status_code == 401


# ---------- Demo user login ----------
class TestDemoLogin:
    def test_demo_login_dashboard(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@taxiqpro.app", "password": "TaxIQdemo2026!"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        d = requests.get(f"{BASE_URL}/api/dashboard", headers=_hdr(tok), timeout=15)
        assert d.status_code == 200
