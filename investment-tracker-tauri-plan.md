# Investment Tracker: Tauri v2 Migration Plan (Audit v2)

## Context

React frontend (Vite) + Express backend (server.js). Issues: two servers, data loss when backend missing, not distributable. **Goal**: Single .exe via Tauri v2, data in OS AppData, shareable.

---

## Complete Audit: Every File That Needs Changes

### API fetch calls (3 files, 6 calls)
| File | Line | Call | Replace with |
|---|---|---|---|
| `src/utils/storage.js` | 7 | `GET /api/data/:pinHash` | `invoke('load_data')` |
| `src/utils/storage.js` | 18 | `POST /api/data/:pinHash` | `invoke('save_data')` |
| `src/utils/storage.js` | 30 | `DELETE /api/data/:pinHash` | `invoke('reset_data')` |
| `src/components/GmailSync.jsx` | 28 | `POST /api/gmail/scan` | `invoke('gmail_scan')` |
| `src/components/GmailSync.jsx` | 181 | `POST /api/gmail/fetch-pdfs` | `invoke('gmail_fetch_pdfs')` |
| `src/utils/parsers/cdsl-parser.js` | 44 | `POST /api/debug-text` | `console.log` |

### Browser APIs that won't work in Tauri WebView2 (2 files)
| File | Line | API | Fix |
|---|---|---|---|
| `src/utils/backup.js` | 5 | `showSaveFilePicker()` | Tauri dialog plugin `save()` |
| `src/utils/backup.js` | 18 | `createWritable()` | Tauri fs plugin `writeTextFile()` |
| `src/utils/backup.js` | 30-35 | `createObjectURL` + `a.click()` download | Tauri dialog `save()` + fs `writeTextFile()` |
| `src/utils/backup.js` | 54-59 | Same blob download for CSV | Same fix |
| `src/components/Settings.jsx` | 275 | `window.location.reload()` | Reset app state (clear pinHash) |

### Browser APIs that DO work but behave differently
| File | Line | API | Issue | Action |
|---|---|---|---|---|
| `src/components/Settings.jsx` | 68,69 | `alert()` | Returns Promise in Tauri, not sync | **Low risk** — used after action, not blocking. Keep as-is initially, replace later if issues. |
| `src/components/Settings.jsx` | 151 | `prompt()` | Returns Promise, not sync string | **Must fix** — return value used (`const newName = prompt(...)`) |
| `src/components/Settings.jsx` | 157 | `confirm()` | Returns Promise, not sync bool | **Must fix** — return value used in `if (confirm(...))` |
| `src/components/Layout.jsx` | 22 | `window.innerWidth` | Works in WebView2 | **No change needed** — WebView2 is Chromium |
| `src/utils/storage.js` | 61,69 | `localStorage` | Works in WebView2 | **No change needed** — only used for one-time migration, then cleared |
| `src/utils/backup.js` | 40 | `FileReader` | Works in WebView2 | **No change needed** |

### pdfjs-dist Web Worker (RISK)
| File | Line | Issue |
|---|---|---|
| `src/utils/parsers/pdf-extract.js` | 4-7 | Worker path uses `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`. Known issues in Tauri v2.2.5+ with worker creation. |

**Mitigation**: Test early in Phase 1. If worker fails, options:
1. Use `pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(...)` explicit construction
2. Disable worker (`pdfjsLib.GlobalWorkerOptions.workerSrc = ''`) — slower but works
3. Pin pdfjs-dist version that's known compatible

### Files with NO changes needed (confirmed)
- `src/App.jsx` — no browser-specific APIs
- `src/hooks/usePortfolio.js` — calls storage.js (our abstraction point)
- `src/main.jsx` — standard React entry
- `src/components/CasDropZone.jsx` — HTML5 drag-drop works in WebView2
- All `src/utils/parsers/*.js` (except cdsl-parser.js debug line)
- `src/utils/calculations.js`, `crypto.js`, `pin.js`
- All chart components
- `index.html` — clean, no PWA references (VitePWA injects at build time only)

### Files to delete
- `server.js`
- `dist/registerSW.js`, `dist/sw.js`, `dist/manifest.webmanifest` (build artifacts, regenerated)

---

## Phase 1: Scaffold Tauri + Smoke Test

**Prerequisites** (Windows 11):
- Rust toolchain via rustup
- Visual Studio C++ Build Tools (for Rust linker)
- WebView2 (pre-installed on Windows 11)

**Steps**:
1. Install Rust if missing: `winget install Rustlang.Rustup`
2. `cd "D:\Senthil workspace\investment-tracker"`
3. `npm install -D @tauri-apps/cli@^2`
4. `npm install @tauri-apps/api@^2 @tauri-apps/plugin-fs@^2 @tauri-apps/plugin-dialog@^2`
5. `npx tauri init` — answer prompts:
   - App name: "Investment Tracker"
   - Window title: "Investment Tracker"
   - Dev URL: http://localhost:5173
   - Frontend dist: ../dist
   - Dev command: npm run dev (will change later)
   - Build command: npm run build
6. Edit `src-tauri/tauri.conf.json`: window 1280×800, identifier `com.senthil.investment-tracker`
7. Edit `src-tauri/capabilities/default.json`: add fs + dialog permissions

**Critical smoke test**:
- Run `npm run dev` (starts Express + Vite as before)
- Run `npx tauri dev` in another terminal
- Verify: native window opens, loads app, PIN login works, data loads via Express proxy
- **Test pdfjs-dist worker**: drag-drop a CAS PDF → verify it parses. If worker fails, fix before proceeding.

## Phase 2: Data Persistence

**Rust** (`src-tauri/src/lib.rs`):
```
load_data(pin_hash) → Option<Value>
  - Read {AppData}/com.senthil.investment-tracker/data/{pin_hash}.json
  - If file missing → return None (triggers setup wizard, correct behavior)
  - If JSON parse fails → try auto-backup, if that fails → return None + log error

save_data(pin_hash, data) → ()
  - Atomic: write .tmp → rename
  - Also write rotating backup: {AppData}/backups/{pin_hash}-{N}.json (keep last 5)
  - Create dirs if missing

reset_data(pin_hash) → ()
  - Delete file

migrate_legacy_data(old_dir) → count
  - Copy *.json from old_dir to AppData/data/
  - Copy gmail-config.json to AppData/
  - Return count of files migrated
```

**Frontend** (`src/utils/storage.js`):
- Add `IS_TAURI` check: `'__TAURI_INTERNALS__' in window`
- Tauri path: `invoke('load_data', { pinHash })` / `invoke('save_data', { pinHash, data })`
- Browser path: existing fetch (dual-path during dev)
- **NEW: Error handling** — if invoke/fetch fails, throw error instead of returning null silently. Let App.jsx show "Failed to load data" banner instead of setup wizard.

**200KB JSON performance note**: Tauri IPC serializes JSON between JS↔Rust. At 200KB this is fine (~1ms). If it grows to MB+ in future, consider debouncing saves or using Raw Requests API. For now, fire-and-forget pattern from usePortfolio.js works as-is.

**Verify**: Login → data loads from AppData → change something → close → reopen → persists

## Phase 3: Gmail IMAP in Rust

**Cargo.toml additions**: `async-imap`, `async-native-tls`, `mail-parser`, `base64`, `serde`

**Rust commands**:
```
gmail_get_config() → Option<{email}>
gmail_save_config(email, app_password) → ()
  - Encrypt app_password with AES before writing (use key derived from app identifier)
gmail_scan() → Vec<{uid, subject, from, date, attachments: [{name, size}]}>
  - Connect imap.gmail.com:993 TLS
  - INBOX, search all, fetch envelope+bodyStructure per UID
  - Find PDF parts by MIME or .pdf extension
gmail_fetch_pdfs(uid) → Vec<{filename, data: base64}>
  - Fetch full message, parse with mail-parser
  - Recursively extract PDFs (handle message/rfc822 nesting)
  - Set 10min timeout for large emails
```

**Frontend** (`src/components/GmailSync.jsx`):
- `scanInbox()`: `invoke('gmail_scan')` instead of `fetch('/api/gmail/scan')`
- `importAll()`: `invoke('gmail_fetch_pdfs', { uid })` instead of `fetch('/api/gmail/fetch-pdfs')`
- Response shapes kept identical → rest of component unchanged

**Fallback**: If Rust IMAP proves too complex/buggy, can use Tauri sidecar with a small bundled Node.js script. But try Rust first.

**Verify**: Scan → same email count as Express → import → same parse results → byte-compare PDF content

## Phase 4: Cleanup + Fix Browser APIs

**Delete**: `server.js`

**`vite.config.js`**: Remove proxy + VitePWA:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
})
```

**`package.json`**:
- Remove: `express`, `imapflow`, `mailparser`, `concurrently`, `vite-plugin-pwa`
- Update `"dev"`: `"tauri dev"`
- Add: `"tauri:build": "tauri build"`

**`storage.js`**: Remove dual-path, keep only Tauri invoke

**`backup.js`**: Replace all export functions:
```js
import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

exportDataJSON(data) → save dialog + writeTextFile
exportCSV(rows, filename) → save dialog + writeTextFile
requestBackupFolder() + writeBackup() → save dialog + writeTextFile
importDataJSON → open dialog + readTextFile (or keep FileReader if using <input>)
```

**`cdsl-parser.js:44`**: Replace `fetch('/api/debug-text')` with `console.log`

**`Settings.jsx`**:
- Line 151: `prompt()` → small inline React edit state (already used elsewhere in the app for rename)
- Line 157: `confirm()` → use Tauri `confirm()` from `@tauri-apps/plugin-dialog` (async, needs await)
- Line 275: `window.location.reload()` → clear pinHash state to return to PIN screen
- Lines 68-69: `alert()` → either keep (works as fire-and-forget) or use Tauri `message()`

**PWA cleanup**: Delete `vite-plugin-pwa` config only. Build artifacts (`dist/`) are regenerated. No changes to `index.html` needed (VitePWA was injecting at build time).

## Phase 5: Build & Distribute

1. App icon: `npx tauri icon path/to/icon.png` (generates all sizes)
2. `src-tauri/tauri.conf.json` bundle config:
   - `targets: ["nsis"]` — Windows installer
   - `identifier: "com.senthil.investment-tracker"`
   - downloadBootstrapper mode (smallest, ~5-10MB installer)
3. `npx tauri build` → produces `.exe` + NSIS installer
4. Test on clean Windows machine
5. Share with friends

---

## Improvements Over v1 Plan

| # | Issue Found | Fix Added |
|---|---|---|
| 1 | `prompt()` and `confirm()` return Promise in Tauri, not sync — would silently break | Replace with React state / Tauri dialog (async await) |
| 2 | `window.location.reload()` won't work as expected | Reset app state instead |
| 3 | pdfjs-dist worker may fail in Tauri WebView2 (known issues v2.2.5+) | Test in Phase 1, have fallback (disable worker or pin version) |
| 4 | `alert()` after restore — non-blocking in Tauri | Low risk but noted |
| 5 | Gmail app password in plaintext | Encrypt with AES before storing |
| 6 | No error feedback when data load fails → shows setup wizard | Throw error + show banner instead of silent null |
| 7 | No auto-backup | Rotating backups on every save (keep last 5) |
| 8 | Data corruption → lost forever | Try auto-backup before giving up |
| 9 | 200KB JSON IPC performance | Fine for now, documented upgrade path if data grows |
| 10 | `exportCSV` blob download also broken (missed in v1) | Included in backup.js rewrite |
| 11 | Forgot to count Settings.jsx as a changed file | Now 7 files changed total, not 6 |

## Total Files Changed: 7

1. `src/utils/storage.js` — fetch → invoke
2. `src/components/GmailSync.jsx` — fetch → invoke
3. `src/utils/backup.js` — File System Access API → Tauri plugins
4. `src/utils/parsers/cdsl-parser.js` — remove debug fetch
5. `src/components/Settings.jsx` — fix prompt/confirm/reload
6. `vite.config.js` — remove proxy + PWA
7. `package.json` — swap deps

## Risk Matrix

| Risk | Likelihood | Impact | Phase | Mitigation |
|---|---|---|---|---|
| pdfjs-dist worker fails | Medium | **BLOCKER** | 1 | Test immediately, disable worker as fallback |
| Rust IMAP edge cases | Medium | High | 3 | Test same inbox, fallback to Node sidecar |
| prompt/confirm async break | Certain | Medium | 4 | Replace with React state / Tauri dialog |
| 200KB JSON IPC slow | Low | Low | 2 | Fine now, debounce later if needed |
| First Rust build slow | Certain | Low | 1 | ~5-10 min, fast incremental after |
| WebView2 missing | Low | Low | 5 | NSIS installer bundles bootstrapper |
