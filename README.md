# Bonner Hour Dashboard

Local checkpoint dashboard for reviewing service-hour progress, risk status, partner activity, reflection completion, exemptions, exports, and Slack-ready messages. Works for any Bonner-style program — a first-run wizard walks you through exporting your GivePulse CSVs and configuring checkpoints, cohorts, reflections, and theme.

The bundled `csv/users-bonner-demo-*.csv`, `csv/impacts-bonner-demo-*.csv`, `exemptions.json`, and `backend/bonner.db` contain fabricated demo records only. Names, emails, partners, reflections, exemptions, notes, and outreach state are demo data and do not represent real people.

## Run

### Dev (two servers, hot reload)

1. `cd backend && uv sync`
2. `cd ../frontend && bun install`
3. `cd .. && ./start.sh`

The backend runs at `http://127.0.0.1:8000` and the frontend runs at `http://127.0.0.1:3000`.

### Desktop app (one window)

Run the whole thing as a single native-window app — the FastAPI backend serves the
built React UI on a private localhost port and opens it in an OS webview:

```
cd frontend && bun run build          # once, to produce frontend/dist
cd ../backend && uv sync --extra desktop
uv run python desktop.py
```

`pywebview` (in the `desktop` extra) gives a native window; without it the launcher
falls back to your default browser.

### Ship a standalone binary (cross-platform)

`./packaging/build.sh` builds the frontend and packages everything into a single
self-contained app with PyInstaller — **no Python or Node needed on the machine that
runs it**. Output lands in `backend/dist/` (a folder app, plus `BonnerDashboard.app`
on macOS). Run the script on each OS you want to target (macOS/Windows/Linux); the
spec is in `packaging/bonner.spec`. This is lighter than Electron, which would have to
bundle both Chromium *and* the Python backend for the same result.

### Where state lives

Settings, the onboarding flag, exemptions, outreach state and uploaded CSVs persist in
a SQLite DB so onboarding shows **only on the true first run** and your preferences
survive every relaunch. From a source checkout that DB is `backend/bonner.db`; the
desktop/packaged app uses a per-user app-data folder instead
(`~/Library/Application Support/BonnerDashboard` on macOS,
`%APPDATA%\BonnerDashboard` on Windows, `~/.local/share/BonnerDashboard` on Linux).
Override any path with `BONNER_DATA_DIR`.

## Deploy

Use a single Docker web service. The container builds the React app, starts FastAPI, and serves both the API and frontend from one origin.

Recommended path for a demo:

1. Push this folder to a GitHub repository.
2. In Render, create a new Blueprint from the repo.
3. Render reads `render.yaml`, builds the root `Dockerfile`, and exposes the app at the generated `onrender.com` URL.

The app binds to `0.0.0.0:$PORT`, which is what Render expects for web services. The same Dockerfile can also run on Railway, Fly, or any container host.

## Data: GivePulse CSV exports

The dashboard runs on your GivePulse CSV exports — nothing is hardcoded to one
organization. The first-run wizard (and **Settings → Data**) walks you through it:

**Users export:** GivePulse → Manage → your group → Users → Manage Users → sort/filter
the dates to this semester → blue **Actions** button → Export → All Data → download
(or grab it from the emailed link).

**Impacts export:** GivePulse → Impacts → Manage Impacts → refine the dates → blue
**Actions** button → Export → All Data → download (or use the email link).

Upload both files in the wizard or Settings → Data. They're stored locally and the
newest upload of each kind is used automatically; the bundled demo CSVs are used
until you upload your own.

## Configurable in Settings

- **Checkpoints & cohorts** — program start, any number of checkpoints (date +
  hour target per cohort), and named requirement cohorts by graduation year. The
  last checkpoint's date is the program end; "Today's pace" is interpolated.
- **Class & senior detection** — pick which CSV column holds the graduation year
  (its first four digits are read, so "Spring 2029" → 2029) and map years to class
  labels (2029 → Freshman, …). Falls back to a text class column, or a by-hand
  senior picker, when no graduation year exists.
- **Reflections** — which impact fields count as a reflection (pick them straight
  from your CSV columns), what values count as empty, and whether a row is blank
  when all/any fields are empty (or off).
- **Roster export** — paste your spreadsheet's name column; exports emit hours in
  that exact order for copy-paste.
- **Exemptions** — members excused from checkpoint status logic.
- **Appearance** — dark/light theme, plus **portable settings**: export your whole
  configuration to a JSON file and re-import it on another machine or after a reset.

## State & overrides

- Local app state (config, exemptions, outreach) lives in `backend/bonner.db`.
  Uploaded CSVs persist in `backend/uploads/`. Seed data: `exemptions.json`,
  `support_tracking.json`.
- Path overrides: `BONNER_CSV_DIR`, `BONNER_UPLOAD_DIR`, `BONNER_ROSTER_PATH`
  (optional Slack-ID roster), `BONNER_EXEMPTIONS_PATH`, `BONNER_SUPPORT_SEED_PATH`,
  `BONNER_FRONTEND_DIST_PATH`.

## Demo Notes

- All included emails use `example.edu` or `example.org` domains.
- Slack tokens, if used, are stored locally in `.env`.
- The Critical page uses generic support-outreach tracking for red and blue members.
