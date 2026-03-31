# Senthil's Workspace

## Active Projects

### Bali Trip Tracker (`bali-trip-tracker.html`)
- Single-file HTML expense tracker for Bali trip (27 Apr – 5 May 2026)
- 2 families: Senthil (2A+1K, 3 pax) + Bala (2A+2K, 4 pax). Total 7 people.
- Senthil books & pays everything, Bala pays their share
- Context doc: `C:\Users\sweet\Downloads\Bali_Trip_Context_For_App.md`
- Features: Home tab (Budget/Actual toggle), Days tab (itinerary + actual spend per day), Add tab, Settle tab
- Split logic: Flights/Visa = per-family (own); Activities = per-person (adult vs kid rates, 4:3 ratio); Everything else = 50-50
- Pre-loaded: All estimated costs from context doc, including optional activities (except Nusa Penida)
- Days tab: Shows itinerary + estimated vs actual comparison table + quick-add expenses
- Settlement: Bala's total share - payments received = balance owed
- Booked/fixed rows: flight, visa, ubud_hotel, kuta_hotel, airport1, airport2, driver
- Variable rows: food, waterbom_food, rafting, alas_harum, waterbom, entrance, misc + custom rows
- Data stored in localStorage, version 8

### Investment Tracker (`investment-tracker/`)
- Local-first Indian investment tracker (INR), React + Vite + Tailwind
- Tauri v2 desktop app (migration complete)
- Goal-based investing features planned (5 sprints, not yet started)

## User Preferences
- Prefers concise responses
- Wants context remembered across sessions
- Save progress to memory after every meaningful exchange
