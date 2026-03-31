# Investment Tracker Dashboard — Final Plan (v4)

## Context
A beautiful, local-first investment tracking dashboard for Indian investments (INR ₹). Tracks multiple family members (dynamic — add/rename/remove) with independent bucket strategies, plus a combined household dashboard. Data is 100% on-device (localStorage + auto-backup JSON). PIN-protected. Installable as a PWA (works offline). Monthly effort is minimal: download CAS PDF from email → drag into app → done.

**Shareable**: Not hardcoded to any family structure. Anyone can use this — add "Husband", "Wife", "Self", "Parent", etc. as members.

---

## Data Source (Key Change from v1)
**Single source of truth: NSDL CAS (Me) + CDSL CAS (Wife)**
- Replaces: Zerodha XLSX + Kuvera XLSX (dropped entirely)
- Each member's CAS email arrives monthly → download PDF → drag into app → auto-imports
- App auto-identifies which member by trying each stored PAN to decrypt (no manual selection)
- **Drag-and-drop** is the primary import method (works in any browser, no folder permissions needed)
- Also supports file picker button as fallback
- PDFs are password-protected with PAN number → entered once in setup → stored encrypted → auto-decrypted on every future import
- Statement date parsed from PDF → shown as "Portfolio as on 31 Jan 2026" on dashboard
- **Portfolio Value Trend table** (12 months) parsed from CAS → pre-populates history chart on first import
- **NPS data in CAS**: If user opts in at NSDL/CDSL, NPS shows in CAS → parsed automatically, no manual entry needed

### What NSDL CAS contains
| Section in PDF | Contains | Asset Type |
|---|---|---|
| Equities (E) — demat | Stocks — ISIN, qty, price, value | stock |
| Mutual Funds (M) — demat | ETFs (BeES etc.) — ISIN, qty, price, value | etf |
| Mutual Fund Folios (F) | MF schemes — ISIN, folio, units, invested, NAV, value | mf |

### What CDSL CAS contains
| Section in PDF | Contains | Asset Type |
|---|---|---|
| Mutual Fund Folios | MF schemes — ISIN, folio, units, invested, NAV, value | mf |
| Demat holdings | Stocks/ETFs if any | stock/etf |

### Auto-detect Logic
```
if PDF text contains "National Securities Depository" → NSDL parser
if PDF text contains "Central Depository Services"   → CDSL parser
```

### CDSL Parsing Note
CDSL CAS PDFs have garbled text from pdftotext (extra spaces in words: "Ce ntral DepositoryS ervi(ces"). Parsers use flexible regex that tolerates variable spacing. Holdings table (last pages) is the reliable source.

---

## Tech Stack
| Layer | Choice | Reason |
|---|---|---|
| Framework | React + Vite | Fast, component-based |
| Styling | Tailwind CSS | Clean, utility-first, premium look |
| Charts | Recharts | Native React, highly customizable |
| Icons | Lucide React | Lightweight, clean |
| Storage | localStorage + JSON file backup | 100% local, no cloud |
| PDF parsing | pdfjs-dist (PDF.js) | Browser-side PDF text extraction, supports password-protected PDFs |
| PIN security | SHA-256 (Web Crypto API) | Browser-native, no dependency |
| File access | File System Access API (Chrome) | Backup export only (not for CAS import) |
| PWA | vite-plugin-pwa | Offline support, installable as desktop app |

**Removed from v1**: SheetJS (xlsx) — no longer needed (no XLSX imports)
**Added in v3**: PWA support — works offline after first load, can be "installed" on Windows as a standalone app

---

## Investment Categories (Per Member)

Each member can have any combination of these categories. The app shows only what exists.

| Category | Source | Tracking |
|---|---|---|
| Stocks | CAS — Equities/demat section | All stocks → one bucket |
| ETFs | CAS — MF-demat section | All ETFs → one bucket |
| Mutual Funds | CAS — MF Folios section | Each scheme individually → own bucket |
| Fixed Deposits | Manual entry | Each FD → own bucket; auto-calculated |
| PPF | Manual (opening bal + contributions) | Auto-calculated at 7.1% p.a. |
| PF / EPF | Manual (opening bal + contributions) | Auto-calculated at 8.25% p.a. |
| NPS Tier 1 | CAS (if opted in) or manual fallback | Bucket = Retirement |

*Categories with no data are hidden in the UI — no empty rows.*

---

## Goal Buckets (Per Person — Independent)

Each person has their own bucket configuration. Combined dashboard aggregates both.

### Default Buckets (same names, configured independently)
| Bucket | Target Logic | Color |
|---|---|---|
| Emergency Fund | 6× monthly expenses | Amber |
| Child School Education | User-defined ₹ + year | Cyan |
| Child College Education | User-defined ₹ + year | Purple |
| Retirement Fund | FIRE number | Green |
| Others | Unassigned | Gray |

**Per-member investment → bucket mapping:**
- Stocks: all → single bucket per member (set in Settings)
- ETFs: all → single bucket per member (set in Settings)
- MF schemes: each ISIN → individual bucket (smart-suggested on first import, remembered by ISIN)
- FD / PPF / PF / NPS: each → bucket (set when adding)

**Smart bucket suggestions for MF schemes (first import):**
- Liquid funds → Emergency Fund
- Large Cap / Index / Hybrid funds → Retirement
- Flexi Cap / Multi Cap → Retirement (default)
- User confirms or overrides each suggestion — faster than manual assignment

**Insurance** (no investment mapping — reference cards only, shared):
- Health Insurance: Provider, plan name, coverage ₹, annual premium, renewal date, policy number
- Term Insurance: Provider, coverage ₹, annual premium, policy term, nominee, policy number

---

## CAS Import Flow (Drag-and-Drop)

```
One-time setup:
  Add members → each with name + PAN (stored encrypted)

Every month:
  CAS emails arrive → user downloads PDF attachments
  User opens tracker → drags PDF(s) into drop zone (can drop multiple at once)
  For each PDF:
    App tries each member's PAN to decrypt → identifies member automatically
    Auto-detects format (NSDL/CDSL) from content
    Parses holdings → updates that member's data
    New MF schemes → smart-suggests buckets → user confirms
    Shows "Imported Jan 2026 CAS for Senthil — 7 MF, 1 stock, 3 ETFs"
    First import also parses 12-month trend table → pre-populates history
```

**Member auto-identification via PAN:**
1. User drops CAS PDF
2. App tries to decrypt with each stored member's PAN
3. First successful decryption = that member
4. Name in CAS verified against member name as safety check
5. If no PAN matches → prompt "Who does this belong to?" or "Add new member?"

**Why drag-and-drop over folder watching:**
- Works in any browser (not just Chrome)
- No File System Access API permissions needed for import
- Simpler to implement, fewer failure modes
- File System Access API still used for backup export only

---

## CAS Parser Architecture

```
src/utils/parsers/
  pdf-extract.js       — pdfjs-dist wrapper: load PDF with password, extract text per page
  cas-detector.js      — detect NSDL vs CDSL + identify person from extracted text
  nsdl-parser.js       — parse NSDL CAS (stocks + ETFs + MF folios + NPS if present + trend table)
  cdsl-parser.js       — parse CDSL CAS (MF folios + NPS if present + trend table; handles garbled text)
  bucket-suggester.js  — suggest buckets for MF schemes based on fund name/category keywords
```

### Data extracted from NSDL CAS
```js
{
  statementDate: "2026-01-31",
  person: "SENTHIL KUMAR R",
  stocks: [
    { isin: "INE154A01025", name: "ITC LIMITED", qty: 265, price: 322.20, value: 85383 }
  ],
  etfs: [
    { isin: "INF204KC1402", name: "NIPPON INDIA ETF NIFTY BEES", qty: 20, price: 286.56, value: 5731.20 }
  ],
  mfFolios: [
    { isin: "INF879O01027", name: "Parag Parikh Flexi Cap Fund - Direct Plan Growth",
      folio: "11362303", units: 20291.919, avgCost: 72.44, invested: 1470000,
      nav: 93.5212, value: 1897724.62, unrealisedPL: 427724.62, xirr: 17.24 }
  ],
  nps: null,  // null if not opted in; { value: 250000 } if present in CAS
  portfolioTrend: [  // 12-month history from CAS trend table — pre-populates history
    { month: "2025-01", value: 3375408.27 },
    { month: "2025-02", value: 2820526.04 },
    // ... up to current month
  ]
}
```

### Data extracted from CDSL CAS
```js
{
  statementDate: "2026-02-28",
  person: "MURUGANANDHAM ABIRAMI",
  stocks: [],
  etfs: [],
  mfFolios: [
    { isin: "INF760K01FR2", name: "Canara Robeco Large Cap Fund - Direct Growth",
      folio: "17733442025/0", units: 15822.539, invested: 865000,
      nav: 73.08, value: 1156311.15, unrealisedPL: 291311.15, xirr: 33.68 }
  ],
  nps: null,  // null if not opted in
  portfolioTrend: [
    { month: "2025-03", value: 3484952.72 },
    // ... 12-month history
  ]
}
```

---

## Data Model (localStorage)

```json
{
  "settings": {
    "pin": "<sha256-hashed>",
    "backupFolderGranted": true,
    "fire": {
      "household": { "annualExpenses": 1200000, "multiplier": 25, "manualTarget": null }
    },
    "monthlyExpenses": 100000,
    "ppfRate": 7.1,
    "pfRate": 8.25
  },
  "members": [
    {
      "id": "m1",
      "name": "Senthil",
      "pan": "<aes-encrypted PAN>",
      "fire": { "annualExpenses": 800000, "multiplier": 25, "manualTarget": null },
      "buckets": [
        { "id": "emergency",    "name": "Emergency Fund",          "targetMonths": 6,       "color": "#F59E0B" },
        { "id": "child_school", "name": "Child School Education",  "targetAmount": 2000000, "targetYear": 2033, "color": "#06B6D4" },
        { "id": "child_college","name": "Child College Education", "targetAmount": 5000000, "targetYear": 2036, "color": "#8B5CF6" },
        { "id": "retirement",   "name": "Retirement Fund",         "useFireTarget": true,   "color": "#10B981" },
        { "id": "others",       "name": "Others",                  "targetAmount": null,    "color": "#6B7280" }
      ],
      "isinBucketMap": {
        "INF879O01027": "child_college",
        "INF769K01DH9": "retirement"
      },
      "stocksBucket": "retirement",
      "etfsBucket": "retirement",
      "fds": [
        { "id": "fd1", "label": "SBI FD", "principal": 200000, "rate": 7.0,
          "compounding": "quarterly", "startDate": "2025-04-01",
          "tenureMonths": 24, "bucket": "emergency", "active": true }
      ],
      "ppf": { "openingBalance": 500000, "openingDate": "2025-03-01", "bucket": "retirement",
               "contributions": [] },
      "pf":  { "openingBalance": 300000, "openingDate": "2025-03-01", "bucket": "retirement",
               "employeeMonthly": 5000, "employerMonthly": 5000 },
      "nps": { "openingBalance": 100000, "openingDate": "2025-03-01", "bucket": "retirement",
               "contributions": [] },
      "monthly": {
        "2026-01": {
          "casDate": "2026-01-31",
          "stocks": [
            { "isin": "INE154A01025", "name": "ITC LIMITED", "qty": 265, "price": 322.20, "value": 85383 }
          ],
          "etfs": [
            { "isin": "INF204KC1402", "name": "NIPPON NIFTY BEES", "qty": 20, "price": 286.56, "value": 5731.20 }
          ],
          "mfFolios": [
            { "isin": "INF879O01027", "name": "Parag Parikh Flexi Cap", "folio": "11362303",
              "units": 20291.919, "invested": 1470000, "nav": 93.52, "value": 1897724 }
          ],
          "nps": { "current": 112000 }
        }
      }
    },
    {
      "id": "m2",
      "name": "Abirami",
      "pan": "<aes-encrypted PAN>",
      "fire": { "annualExpenses": 400000, "multiplier": 25, "manualTarget": null },
      "buckets": [ /* same structure, independently configured */ ],
      "isinBucketMap": { "INF760K01FR2": "retirement" },
      "stocksBucket": "retirement",
      "etfsBucket": "retirement",
      "fds": [],
      "ppf": { "openingBalance": 0, "openingDate": "", "bucket": "retirement", "contributions": [] },
      "pf":  { "openingBalance": 0, "openingDate": "", "bucket": "retirement",
               "employeeMonthly": 0, "employerMonthly": 0 },
      "nps": { "openingBalance": 0, "openingDate": "", "bucket": "retirement", "contributions": [] },
      "monthly": { /* same structure */ }
    }
  ],
  "insurance": {
    "health": [{ "id": "h1", "provider": "", "planName": "", "coverageAmount": 0, "annualPremium": 0, "renewalDate": "", "policyNumber": "" }],
    "term":   [{ "id": "t1", "provider": "", "coverageAmount": 0, "annualPremium": 0, "policyTerm": 0, "policyNumber": "", "nominee": "" }]
  }
}
```
*FD, PPF, PF values computed on-the-fly — not stored per month.*
*Each member is a self-contained unit — easy to add/remove/export individually.*

---

## Auto-Backup System
- Every save → write `investment-tracker-backup.json` to user-chosen folder
- Settings → "Restore from Backup" → user picks JSON → data restored
- File never leaves the machine

---

## App Screens & Navigation

**Sidebar nav**: Dashboard | Goals | [Member Names...] | History | Assets | Settings

Sidebar dynamically shows each member's name. E.g.: Dashboard | Goals | Senthil | Abirami | History | Assets | Settings

### 0. PIN Lock + Setup Wizard (First Launch)
Steps:
1. Set 4-digit PIN
2. Add yourself: name + PAN → first member created
3. Add family member(s): name + PAN → additional members (can skip, add later in Settings)
4. Import first CAS: drag PDF(s) → auto-identifies member by PAN → parses → pre-populates 12-month history
5. Smart bucket assignment: app suggests buckets per scheme → user confirms/adjusts
6. FIRE settings (household + per-member targets)
7. PPF / PF / NPS opening balances per member — NPS skipped if already in CAS
8. FD setup (optional)
9. Insurance cards (optional)
10. Grant backup folder (optional)
11. Done

### 1. Dashboard (Combined Overview)
- **"Portfolio as on [date]"** — shows each member's latest CAS date
- **Cards**: Total household portfolio, MoM change %, Household FIRE %
- **Charts**:
  - Portfolio Growth Line (Combined / per-member toggle)
  - Category Breakdown Donut (combined current month)
  - Invested vs Current Bar (by category)
  - Member Comparison Bar
- **FIRE Panel**: Household corpus vs target, circular ring, years-to-FIRE estimate

### 2. Goals (Bucket View — Per Member)
- Toggle: **[Member Names] | Combined**
- One card per bucket:
  - Current ₹ allocated (sum of mapped investments)
  - Target ₹ + % achieved + progress bar
  - Time horizon countdown (education buckets)
  - List of investments in this bucket
- Insurance section: Health + Term reference cards

### 3. Member Pages (dynamic — one per member)
- Individual portfolio total, "as on [CAS date]"
- Category breakdown donut + growth chart
- Individual FIRE ring + panel
- Bucket summary (their own buckets)

### 4. Monthly Entry
- **Drag-and-drop zone** (or "Upload CAS" file picker button)
  - Drop one or multiple CAS PDFs at once
  - Auto-identifies member by PAN → auto-detects NSDL/CDSL format
  - New MF schemes → smart-suggests bucket → user confirms
  - Summary: "Imported Jan 2026 CAS for Senthil — 7 MF, 1 stock, 3 ETFs"
- **Per-member tabs** (dynamically generated):
  - CAS import status: "Jan 2026 imported" / "No CAS yet"
  - FD / PPF / PF: auto-computed read-only rows
  - NPS: auto-filled if in CAS, otherwise 1 number input
- Returns shown inline; Save → localStorage + backup

### 5. Asset Manager
Member selector + sub-sections: FD Manager | MF Bucket Assignments | PPF Log | PF Setup | NPS Contributions | Stocks & ETFs Bucket

### 6. History
- Month table: total, invested, current, returns %, MoM change
- Per-member / Combined toggle; Export CSV

### 7. Settings
- Change PIN
- **Manage Members**: Add / rename / remove family members + PAN
- FIRE numbers (household + per-member)
- PPF / PF rates
- Bucket targets (per member)
- Stocks bucket + ETFs bucket assignment (per member)
- Backup folder re-grant
- Restore from backup | Export data | Reset all data

---

## Project File Structure

```
investment-tracker/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── README.md                            # Full documentation for git
├── .gitignore
└── src/
    ├── main.jsx
    ├── App.jsx                          # Routing + PIN gate
    ├── index.css
    ├── utils/
    │   ├── storage.js                   # localStorage helpers + backup trigger
    │   ├── pin.js                       # SHA-256 hash/verify
    │   ├── crypto.js                    # AES encrypt/decrypt for PAN storage
    │   ├── calculations.js              # FD compound, PPF, PF, FIRE, bucket totals, MoM
    │   ├── parsers/
    │   │   ├── pdf-extract.js           # pdfjs-dist: load PDF with password, extract text
    │   │   ├── cas-detector.js          # Detect NSDL vs CDSL + identify person
    │   │   ├── nsdl-parser.js           # Parse NSDL CAS → stocks + ETFs + MF folios + NPS + trend
    │   │   ├── cdsl-parser.js           # Parse CDSL CAS → MF folios + NPS + trend (garbled text)
    │   │   └── bucket-suggester.js      # Smart bucket suggestions based on fund name keywords
    │   └── backup.js                    # File System Access API: backup export/restore
    ├── hooks/
    │   └── usePortfolio.js              # Central state: assets + monthly + computed values
    ├── components/
    │   ├── PinLock.jsx
    │   ├── SetupWizard.jsx              # Multi-step first-run wizard
    │   ├── Layout.jsx                   # Sidebar + shell
    │   ├── CasDropZone.jsx              # Drag-and-drop CAS import component
    │   ├── Dashboard.jsx
    │   ├── Goals.jsx                    # Per-member bucket cards + insurance cards
    │   ├── MemberPage.jsx               # Reused for each member (dynamic route)
    │   ├── MonthlyEntry.jsx             # CAS drag-drop + NPS entry
    │   ├── AssetManager.jsx
    │   ├── History.jsx
    │   ├── Settings.jsx
    │   └── charts/
    │       ├── GrowthLineChart.jsx
    │       ├── CategoryDonut.jsx
    │       ├── InvestedVsCurrentBar.jsx
    │       ├── MemberComparisonBar.jsx
    │       └── FireProgressRing.jsx
```

---

## Visual Design
- **Dark mode**: slate-900/800 backgrounds, premium feel
- **Category colors** (consistent across all charts):
  - Stocks: Indigo | ETFs: Blue | MF: Emerald | FD: Amber | PPF: Sky | PF: Violet | NPS: Rose
- **Bucket colors**: Emergency=Amber, Child School=Cyan, Child College=Purple, Retirement=Green, Others=Gray
- **"as on [date]"** shown subtly on dashboard and person pages
- Card-based, rounded-xl, subtle shadows; animated number counters on load
- Green/red return badges; responsive (laptop + tablet)

---

## Monthly Effort Summary (After Setup)

| Task | Per Member |
|---|---|
| CAS | Download PDF from email → drag into app (auto-identifies member) |
| FD | Auto ✓ |
| PPF | Auto ✓ (log only when depositing) |
| PF | Auto ✓ |
| NPS | Auto if in CAS, else type 1 number |

**Total effort per month**: Download N PDFs (one per member) → open app → drag all in at once. ~1 minute regardless of family size.

---

## Dependencies
```
pdfjs-dist        — PDF text extraction (browser-side, supports password-protected PDFs)
recharts          — Charts
lucide-react      — Icons
tailwindcss       — Styling
vite-plugin-pwa   — PWA support (offline + installable)
```

---

## Prerequisites
Node.js must be installed before building:
```
winget install OpenJS.NodeJS
```
Then restart terminal.

## To Build This App
1. Install Node.js (see Prerequisites above)
2. Open terminal in your workspace folder (`D:\Senthil's workspace`)
3. Run: `npm create vite@latest investment-tracker -- --template react`
4. Run: `cd investment-tracker && npm install`
5. Run: `npm install pdfjs-dist recharts lucide-react`
6. Run: `npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa && npx tailwindcss init -p`
7. Initialize git: `git init && git add . && git commit -m "Initial scaffold"`
8. Tell Claude: "Build the investment tracker app as per the plan in investment-tracker-plan.md"

## Verification Steps
1. `npm run dev` → opens in Chrome
2. Setup wizard: PIN → add members (name + PAN) → drag CAS PDFs → smart bucket assign → FIRE → PPF/PF/NPS → backup
3. Drag NSDL CAS → auto-identifies member → imports stocks + ETFs + MF schemes + 12-month history
4. Drag CDSL CAS → auto-identifies member → imports MF schemes + history
5. New MF scheme shows smart bucket suggestion; existing schemes auto-assigned
6. Dashboard: total = all members, "as on" dates shown, history chart pre-populated
7. Goals: each member's buckets independent; Combined view sums all
8. FD compound interest correct; PPF/PF auto-calculated
9. FIRE ring: correct % household + individual
10. PIN lock on refresh; backup JSON written after save
11. Restore from backup → data reloads correctly
12. App installable as PWA; works offline after first load
13. git log shows clean commit history; README complete
