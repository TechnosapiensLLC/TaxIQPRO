# TaxIQ Pro — Product Requirements Document (PRD)

**Version:** 1.0  
**Last Updated:** June 2026  
**Status:** MVP Complete

---

## 1. Product Overview

### 1.1 Product Name
TaxIQ Pro

### 1.2 Product Vision
Empower gig workers to keep more of what they earn through AI-powered tax tracking and optimization.

### 1.3 Target Users
- Rideshare drivers (Uber, Lyft)
- Delivery drivers (DoorDash, Instacart, UberEats)
- Freelancers and independent contractors
- Small business owners

---

## 2. Feature Inventory

### 2.1 Completed Features (MVP)

| Feature | Status | Screen | API Endpoint |
|---------|--------|--------|--------------|
| User Authentication | ✅ Done | `/login`, `/signup` | `/api/auth/*` |
| Dashboard | ✅ Done | `/` (tabs/index) | `/api/dashboard` |
| Receipt Tracking | ✅ Done | `/receipts`, `/add-receipt` | `/api/receipts` |
| AI Receipt Classification | ✅ Done | Auto on upload | `/api/receipts/classify` |
| Mileage Tracking | ✅ Done | `/mileage`, `/add-mileage` | `/api/mileage` |
| Live Trip Tracker (GPS) | ✅ Done | `/live-trip` | `/api/mileage` |
| Income Tracking | ✅ Done | `/income` | `/api/income` |
| AI Tax Coach | ✅ Done | `/tax-coach` | Gemini AI |
| Gas Finder | ✅ Done | `/gas-finder` | `/api/gas-stations` |
| Bank Statement Upload | ✅ Done | `/bank-statement` | `/api/upload/statement` |
| CSV Import | ✅ Done | `/import-csv` | `/api/upload/csv` |
| Swipe to Classify | ✅ Done | `/swipe-classify` | `/api/receipts/classify` |
| Tax Filing Analyzer | ✅ Done | `/tax-analyzer` | `/api/analyze-filing` |
| Deduction Maximizer | ✅ Done | `/deduction-maximizer` | `/api/deduction-maximizer` |
| Quarterly Tax Estimator | ✅ Done | `/quarterly-estimator` | `/api/quarterly-estimator` |
| Export Reports | ✅ Done | `/export-report` | `/api/export/*` |
| Tax Dates & Reminders | ✅ Done | Settings | `/api/tax-dates` |

**Important Note on Tax Filing Analyzer:**
- All analysis is marked "For Informational Purposes Only"
- Prominent disclaimer advises verification by a qualified tax professional (CPA)
- AI is instructed to ONLY extract data it can actually read from documents
- System does NOT infer, estimate, or improvise values that are not visible
- All recommendations include "verify with your CPA" language

### 2.2 Pending Features

| Feature | Priority | Complexity | Notes |
|---------|----------|------------|-------|
| Push Notifications | P3 | Medium | Requires native build |
| Audit Risk Analysis | P3 | Medium | UI placeholder exists |
| Background Trip Detection | P2 | High | Expo Go limitation |
| CPA Dashboard | P4 | High | Enterprise feature |

### 2.3 Known Issues

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Browser cache on web preview | Low | User-side | Hard refresh resolves |
| Map crashes on web | Low | Mitigated | List view fallback |

---

## 3. Technical Architecture

### 3.1 Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Frontend Framework** | React Native | 0.79.x |
| **Frontend Platform** | Expo | SDK 54 |
| **Navigation** | Expo Router | 6.x |
| **State Management** | Zustand | 5.x |
| **Backend Framework** | FastAPI | 0.115.x |
| **Backend Language** | Python | 3.11 |
| **Database** | MongoDB | 7.x |
| **AI/LLM** | Gemini 2.5 Flash | via Emergent |
| **External APIs** | EIA, Distance Matrix | — |

### 3.2 Directory Structure

```
/app
├── backend/
│   ├── server.py          # Main FastAPI application (2000+ lines)
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables
│
├── frontend/
│   ├── app/              # Expo Router screens
│   │   ├── (tabs)/       # Tab navigation screens
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx        # Dashboard
│   │   │   ├── receipts.tsx
│   │   │   ├── mileage.tsx
│   │   │   ├── income.tsx
│   │   │   └── settings.tsx
│   │   ├── _layout.tsx   # Root layout
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── add-receipt.tsx
│   │   ├── add-mileage.tsx
│   │   ├── live-trip.tsx
│   │   ├── tax-coach.tsx
│   │   ├── gas-finder.tsx
│   │   ├── bank-statement.tsx
│   │   ├── import-csv.tsx
│   │   ├── swipe-classify.tsx
│   │   ├── tax-analyzer.tsx
│   │   ├── deduction-maximizer.tsx
│   │   ├── quarterly-estimator.tsx
│   │   └── export-report.tsx
│   │
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts    # API client
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   └── store/
│   │
│   ├── app.json          # Expo configuration
│   ├── package.json
│   └── .env
│
└── memory/
    ├── BLUEPRINT.md      # Business blueprint (this companion doc)
    └── PRD.md           # This document
```

### 3.3 Database Schema

```javascript
// Users Collection
{
  _id: ObjectId,
  email: String,
  password_hash: String,
  profession: String,        // "rideshare", "delivery", "freelance"
  subscription_tier: String, // "free", "pro", "max"
  created_at: DateTime
}

// Receipts Collection
{
  _id: ObjectId,
  user_id: ObjectId,
  vendor: String,
  amount: Decimal,
  date: Date,
  category: String,
  image_base64: String,
  is_deductible: Boolean,
  ai_confidence: Float,
  notes: String,
  created_at: DateTime
}

// Mileage (Trips) Collection
{
  _id: ObjectId,
  user_id: ObjectId,
  date: Date,
  start_location: String,
  end_location: String,
  distance_miles: Float,
  purpose: String,
  deduction_amount: Float,
  start_time: DateTime,
  end_time: DateTime,
  gps_coordinates: Array,
  created_at: DateTime
}

// Income Collection
{
  _id: ObjectId,
  user_id: ObjectId,
  source: String,
  amount: Decimal,
  date: Date,
  is_1099: Boolean,
  platform: String,
  description: String,
  created_at: DateTime
}
```

---

## 4. API Reference

### 4.1 Authentication

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/auth/signup` | POST | `{email, password, profession}` | `{token, user}` |
| `/api/auth/login` | POST | `{email, password}` | `{token, user}` |

### 4.2 Dashboard

| Endpoint | Method | Auth | Response |
|----------|--------|------|----------|
| `/api/dashboard` | GET | Yes | `{total_income, total_deductions, trips_count, receipts_count, tax_savings}` |

### 4.3 Receipts

| Endpoint | Method | Auth | Body/Params | Response |
|----------|--------|------|-------------|----------|
| `/api/receipts` | GET | Yes | `?skip=0&limit=50` | `[{receipt}]` |
| `/api/receipts` | POST | Yes | `{vendor, amount, date, category, image_base64}` | `{receipt}` |
| `/api/receipts/{id}` | DELETE | Yes | — | `{success}` |
| `/api/receipts/classify` | POST | Yes | `{image_base64}` | `{category, confidence, is_deductible}` |

### 4.4 Mileage

| Endpoint | Method | Auth | Body/Params | Response |
|----------|--------|------|-------------|----------|
| `/api/mileage` | GET | Yes | `?skip=0&limit=50` | `[{trip}]` |
| `/api/mileage` | POST | Yes | `{date, start_location, end_location, distance_miles, purpose}` | `{trip}` |
| `/api/calculate-distance` | GET | Yes | `?start=...&end=...` | `{distance_miles, deduction_amount}` |

### 4.5 Income

| Endpoint | Method | Auth | Body/Params | Response |
|----------|--------|------|-------------|----------|
| `/api/income` | GET | Yes | `?skip=0&limit=50` | `[{income}]` |
| `/api/income` | POST | Yes | `{source, amount, date, is_1099}` | `{income}` |

### 4.6 File Uploads

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/api/upload/statement` | POST | Yes | `multipart/form-data (file)` | `{transactions, summary}` |
| `/api/upload/csv` | POST | Yes | `multipart/form-data (file, platform)` | `{imported, total_amount}` |
| `/api/analyze-filing` | POST | Yes | `multipart/form-data (file)` | `{analysis}` |

### 4.7 Tax Tools

| Endpoint | Method | Auth | Response |
|----------|--------|------|----------|
| `/api/deduction-maximizer` | GET | Yes | `{deduction_score, missing_deductions, tips}` |
| `/api/quarterly-estimator` | GET | Yes | `{quarterly_payment, schedule, breakdown}` |
| `/api/tax-dates` | GET | Yes | `[{date, description, days_left}]` |
| `/api/gas-stations` | GET | Yes | `[{station, price, distance}]` |

---

## 5. Environment Variables

### 5.1 Backend (.env)

```
MONGO_URL=mongodb://localhost:27017/taxiq
EMERGENT_LLM_KEY=<provided>
EIA_API_KEY=<optional>
JWT_SECRET=<generated>
```

### 5.2 Frontend (.env)

```
EXPO_PUBLIC_BACKEND_URL=<auto-configured>
EXPO_PACKAGER_PROXY_URL=<auto-configured>
EXPO_PACKAGER_HOSTNAME=<auto-configured>
```

---

## 6. Deployment

### 6.1 Current Environment
- **Platform:** Emergent Kubernetes
- **Frontend Port:** 3000 (proxied)
- **Backend Port:** 8001 (via /api/*)
- **Database:** MongoDB (local)

### 6.2 Production Checklist

| Item | Status | Notes |
|------|--------|-------|
| app.json permissions | ✅ Done | Camera, Location, Photos configured |
| App Store metadata | ⏳ Pending | Screenshots, description needed |
| Privacy policy | ⏳ Pending | Required for App Store |
| Terms of service | ⏳ Pending | Required for App Store |
| API rate limiting | ⏳ Pending | Add before scale |
| Error monitoring | ⏳ Pending | Sentry integration |
| Analytics | ⏳ Pending | Mixpanel/Amplitude |

---

## 7. Testing

### 7.1 Test Credentials

See `/app/memory/test_credentials.md` for test accounts.

### 7.2 Test Scenarios

| Flow | Steps | Expected Result |
|------|-------|-----------------|
| **Signup** | Enter email, password, profession | Account created, dashboard shown |
| **Add Receipt** | Tap +, take photo, confirm | Receipt saved, categorized by AI |
| **Track Trip** | Start trip, drive, end trip | Miles + deduction calculated |
| **Upload Tax Return** | Settings → Tax Analyzer → Upload PDF | Analysis with missed deductions |
| **View Quarterly Tax** | Settings → Quarterly Estimates | Payment amount + schedule |

---

## 8. Changelog

| Date | Version | Changes |
|------|---------|---------|
| June 2026 | 1.0 | MVP complete with all core features |

---

## 9. Backlog

### P1 (Next Sprint)
- [ ] Final QA testing on real devices
- [ ] App Store submission preparation

### P2 (Future)
- [ ] Backend refactoring (modular routers)
- [ ] Background trip detection (native build)
- [ ] Audit Risk Analysis feature

### P3 (Backlog)
- [ ] Push notifications
- [ ] CPA/Enterprise dashboard
- [ ] Multi-language support

---

*Document maintained by Engineering team. For business context, see BLUEPRINT.md.*
