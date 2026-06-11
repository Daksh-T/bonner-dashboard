# Bonner Hour Dashboard — User Guide

A complete guide to setting up and using the dashboard for any Bonner-style
service program. For developer/deployment details see the [README](README.md).

---

## Contents

1. [What the app does](#what-the-app-does)
2. [Installing and running it locally](#installing-and-running-it-locally)
3. [Getting your data out of GivePulse](#getting-your-data-out-of-givepulse)
4. [First-run setup (the wizard)](#first-run-setup-the-wizard)
5. [The pages, one by one](#the-pages-one-by-one)
6. [Settings reference](#settings-reference)
7. [Where your data lives](#where-your-data-lives)
8. [Troubleshooting](#troubleshooting)

---

## What the app does

The dashboard tracks every member's service hours against your program's
checkpoints and tells you, at a glance, who is on track and who needs help:

- **Status colors** — each member is Green (met the checkpoint goal), Yellow
  (within 75% of it), Red (below 75%), Blue (no hours logged at all), or
  Exempt. The 75% threshold and the colors come from your config.
- **Checkpoints & cohorts** — you define any number of checkpoints (a date +
  an hour goal per cohort) and any number of cohorts (requirement tiers, e.g.
  seniors vs. everyone else, matched by graduation year). "Today's pace" is an
  interpolated goal for the current date, so you can run a report any day of
  the semester.
- **Risk & pace analytics** — average weekly hours, pace needed to finish,
  projected final hours, and a composite risk score that surfaces the members
  most likely to fall short.
- **Reflections** — finds impacts whose reflection fields are blank, grouped
  by member and severity, so you can chase missing reflections.
- **Partners** — pending-verification hours by community partner, partner
  engagement totals, and per-partner drilldowns.
- **Outreach** — generates ready-to-send checkpoint messages (Green / Yellow /
  Red / Blue templates, editable in config) and tracks who has been contacted
  on the Critical page.
- **Exports** — checkpoint hour tables and a paste-into-your-spreadsheet
  roster export that emits hours in the exact row order of your sheet.

Everything runs **locally** from CSV exports — no live connection to GivePulse
is required, and nothing leaves your machine.

## Installing and running it locally

### Prerequisites

| Tool | Why | Install |
|------|-----|---------|
| [uv](https://docs.astral.sh/uv/) | Python runtime & deps | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [Bun](https://bun.sh) | Builds the web UI | `curl -fsSL https://bun.sh/install \| bash` |

(Or skip both by using a **packaged release binary** — see below.)

### Option A — desktop app from source (recommended)

One window, no terminals left open:

```bash
cd frontend && bun install && bun run build   # build the UI once
cd ../backend && uv sync --extra desktop      # install Python deps + pywebview
uv run python desktop.py                      # launch
```

The app opens in a native window (or your browser if `pywebview` isn't
available). Your settings and uploads persist between launches.

### Option B — dev mode (hot reload, two servers)

```bash
cd backend && uv sync
cd ../frontend && bun install
cd .. && ./start.sh
```

Backend: `http://127.0.0.1:8000` · Frontend: `http://127.0.0.1:3000`

### Option C — packaged binary

If you downloaded a release build (or ran `./packaging/build.sh`), there is no
install at all: unzip and run `BonnerDashboard` (`BonnerDashboard.app` on
macOS). Python and Node are **not** required on that machine.

> macOS will warn about an unsigned app the first time: right-click →
> **Open** → Open. On Windows, choose **More info → Run anyway**.

## Getting your data out of GivePulse

The dashboard needs two CSV exports, made fresh whenever you want updated
numbers. You need GivePulse **admin/manager access** to your group.

### Users export (the roster)

1. In GivePulse go to **Manage** → your group name.
2. Open **Users → Manage Users**.
3. Sort/filter the date columns so the list covers **this semester's members**.
4. Click the blue **Actions** button → **Export** → **All Data**.
5. Small exports download immediately; large ones are **emailed to you** —
   download the file from the link in that email.

### Impacts export (the hours)

1. In GivePulse go to **Impacts → Manage Impacts**.
2. **Refine the dates to this semester** — this matters, otherwise you'll pull
   thousands of old rows.
3. Blue **Actions** button → **Export** → **All Data**.
4. Download the file (or grab it from the emailed link).

### Loading the exports into the dashboard

Open **Settings → Data** (or the first-run wizard) and upload both files —
click the tiles to browse, or just **drag and drop** the CSVs onto them. The
app stores them locally and always uses the newest upload of each kind. Any
demo data (including the demo exemptions) is cleared automatically the moment
you upload your own files.

Notes on how the data is read:

- Rows are matched by **email address**, lowercased.
- Impacts dated before your program start or after the selected checkpoint
  are ignored; **disputed** impacts are excluded; **pending** hours count
  toward totals and are also reported separately.
- Column names can vary between GivePulse groups — the Settings pickers for
  reflection fields and the graduation-year column always show the columns of
  *your* uploaded files.

## First-run setup (the wizard)

The first launch opens a guided walkthrough (replayable any time from
**Settings → Help**):

1. **Export & upload** — the GivePulse steps above, with upload tiles.
2. **Program** — name and start date.
3. **Checkpoints & cohorts** — define your requirement tiers and per-cohort
   hour goals for each checkpoint date.
4. **Confirm cohorts** — a live count of how your members landed in each
   class/cohort, so you can catch misconfigured graduation years immediately.
5. **Reflections** — which impact fields count as a reflection.
6. **Appearance** — dark or light theme.
7. **Finish** — saves everything and downloads a portable `settings.json` you
   can re-import next semester or on another machine.

## The pages, one by one

- **Overview** — status totals, cohort pulse (hours this week, pending hours),
  class-by-class distribution, and drilldowns. Start here every week.
- **Members** — the full roster with hours, goal, progress, pace, and status;
  filter by class or status, click a member for their full profile (weekly
  activity chart, per-partner hours, checkpoint history, every impact).
- **Partners** — pending verification by partner (who to nudge) and overall
  partner engagement; click a partner for a detailed pending breakdown.
- **Reflections** — members with blank reflections, ranked by severity, with
  the actual blank/filled impacts listed so you can follow up specifically.
- **Slack** — a message queue for the selected checkpoint: each member gets a
  pre-filled message from your status templates, editable before you send it.
- **Export** — checkpoint hour tables and the **roster-order export**: paste
  your spreadsheet's name column into Settings once, then copy a single
  column of hours that lines up row-for-row with your sheet.
- **Critical** — red/blue members with outreach tracking: mark who has been
  contacted, keep notes, and reset between checkpoints.
- **Settings** — see below.

The sidebar's checkpoint selector re-runs everything against any checkpoint,
or **Today's pace** for an interpolated goal as of today.

## Settings reference

- **Data** — upload/replace the two CSV exports (drag & drop supported).
- **Checkpoints & cohorts** — program name/start, cohorts (label + graduation
  years + default flag), checkpoint table (date + hours per cohort), class
  labels (graduation year → display label), and **class & senior detection**:
  pick which CSV column holds the graduation year (first four digits are
  read, so "Spring 2029" → 2029), set a fallback text class column, or mark
  seniors by hand when the export has neither.
- **Reflections** — the impact columns that count as a reflection (pick them
  from your CSV's actual columns), the values treated as empty ("n/a",
  "none", …), and whether a row is blank when *all* or *any* fields are
  empty. Leave the list empty to turn reflection tracking off.
- **Roster export** — paste your spreadsheet's name column; blank lines are
  preserved as blank rows. A match preview shows unmatched names.
- **Exemptions** — excuse members from status logic (they show as Exempt and
  are skipped by outreach/exports).
- **Appearance** — theme, plus **portable settings**: export the entire
  configuration as JSON and re-import it anywhere.
- **Help** — replay the walkthrough.

## Where your data lives

Everything is local:

| What | From a source checkout | Desktop/packaged app |
|------|------------------------|----------------------|
| Settings, exemptions, outreach (SQLite) | `backend/bonner.db` | per-user app-data dir¹ |
| Uploaded CSVs | `backend/uploads/` | per-user app-data dir¹ |

¹ `~/Library/Application Support/BonnerDashboard` (macOS),
`%APPDATA%\BonnerDashboard` (Windows), `~/.local/share/BonnerDashboard`
(Linux). Override with the `BONNER_DATA_DIR` environment variable.

To migrate machines: export settings from **Settings → Appearance**, copy your
two newest CSVs, and import on the new machine.

## Troubleshooting

- **"Missing export files" / no data** — upload both a users and an impacts
  CSV in Settings → Data. Both are required.
- **Everyone shows 0 hours** — the impacts export's date range doesn't
  overlap your program start → last checkpoint. Re-export with this
  semester's dates, or fix your program dates in Settings.
- **Seniors in the wrong tier** — check the cohort graduation years and the
  graduation-year column in Settings → Checkpoints & cohorts; use the manual
  senior picker if the export has no usable year.
- **A name won't match the roster export** — edit the pasted name to match
  the member's display name shown on the Members page.
- **Start over** — delete the data dir (table above) and relaunch; the wizard
  runs again. Demo data reappears only on a truly fresh install.
