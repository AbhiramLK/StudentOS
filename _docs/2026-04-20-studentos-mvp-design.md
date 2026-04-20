# StudentOS MVP — Design Spec
**Date:** 2026-04-20  
**Scope:** v1 MVP — Attendance Tracker, Smart Timetable, Home Dashboard

---

## Overview

StudentOS is a mobile app (iOS + Android) that acts as a daily decision engine for college students. The core question it answers: **"Can I skip today?"**

MVP is limited to three features: attendance tracking with prediction, timetable management, and a home dashboard that surfaces verdicts and quick actions.

---

## Tech Stack

- **Framework:** React Native + Expo (managed workflow)
- **Routing:** Expo Router (file-based)
- **Storage:** SQLite via `expo-sqlite`
- **State:** Zustand (lightweight stores)
- **Notifications:** `expo-notifications` (local push)
- **Language:** TypeScript

---

## Architecture

```
app/
  (tabs)/
    index.tsx               ← Home Dashboard
    timetable.tsx           ← Weekly Timetable
    attendance.tsx          ← Attendance list
  subject/[id].tsx          ← Subject detail + mark attendance
  onboarding/               ← Setup flow (subjects → timetable → done)

src/
  db/
    schema.ts               ← Table definitions + migrations
    subjects.ts             ← CRUD for subjects
    attendance.ts           ← CRUD for attendance records
    timetable.ts            ← CRUD for timetable slots
  engine/
    predictionEngine.ts     ← Pure function: computes verdict + stats
    notifications.ts        ← Schedules daily push via expo-notifications
  stores/
    subjectsStore.ts        ← Zustand store
    timetableStore.ts       ← Zustand store
  components/               ← Shared UI (VerdictChip, AttendanceBar, etc.)
```

---

## Data Model

### `settings` (global, single row)
| column | type | notes |
|---|---|---|
| semester_end_date | TEXT | "2026-11-30" — used to count future slots |

### `subjects`
| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| name | TEXT | e.g. "Engineering Maths" |
| threshold | INTEGER | default 75 |
| created_at | INTEGER | unix timestamp |

### `timetable_slots`
| column | type | notes |
|---|---|---|
| id | TEXT | primary key |
| subject_id | TEXT | foreign key → subjects |
| day_of_week | INTEGER | 0=Mon … 6=Sun |
| start_time | TEXT | "09:00" |
| end_time | TEXT | "10:00" |

### `attendance_records`
| column | type | notes |
|---|---|---|
| id | TEXT | primary key |
| subject_id | TEXT | foreign key → subjects |
| date | TEXT | "2026-04-20" |
| status | TEXT | `present` \| `absent` \| `cancelled` |

`cancelled` records do not count toward total classes.

---

## Prediction Engine

`src/engine/predictionEngine.ts` — pure function, no side effects.

**Input:**
```ts
{
  subject: { id, name, threshold },
  records: AttendanceRecord[],
  futureSlotsCount: number  // timetable slots remaining this semester
}
```

**Output:**
```ts
{
  currentPct: number,
  safeSkips: number,
  verdict: "safe" | "warning" | "danger",
  message: string
}
```

**Logic:**
- `attended` = count of `present` records
- `total` = count of `present` + `absent` records
- `currentPct` = `attended / total × 100`
- `futureSlotsCount` = count of timetable slots from today → `semester_end_date`
- `safeSkips` = `floor((total + futureSlotsCount) × (1 - threshold/100)) - (total - attended)`
- `verdict`: `safe` if safeSkips ≥ 2, `warning` if safeSkips = 1, `danger` if safeSkips ≤ 0

---

## Notifications

Scheduled daily at **7:30am** via `expo-notifications` (local, no backend needed).

- Queries today's timetable slots
- Runs prediction engine per subject
- Sends one notification summarizing all classes: `"Maths ✅  Physics ⚠️ skip carefully"`
- Re-schedules whenever timetable is modified

---

## Home Dashboard

- **Next class card** — subject name, time, verdict chip (✅ / ⚠️ / 🚫)
- **Today's schedule list** — all classes for today, each with verdict + inline "Mark" button
- **Attendance health bar** — worst-performing subject shown prominently
- Quick-mark attendance without leaving the home screen

**Tab navigation (3 tabs):**
1. Home (dashboard)
2. Timetable (weekly grid, edit slots)
3. Attendance (per-subject list → tap for detail and history)

---

## Onboarding

First-launch flow, skippable:
1. Set semester end date (used by prediction engine for future slot count)
2. Add subjects (name + optional custom threshold, default 75%)
3. Build timetable (pick day → add slots per subject)
4. "You're set" screen → navigates to dashboard

No login required. All data stored locally on device.

---

## Out of Scope (v1)

- Right Now feed
- Anonymous Wall
- Notes & Resources Hub
- Mess Menu System
- Cloud backup / sync
- Authentication

---

## Testing

- `predictionEngine.ts` is a pure function — unit test with Jest using fixture data
- DB layer: integration tests using an in-memory SQLite instance
- Notification scheduling: mock `expo-notifications` and verify schedule calls on timetable mutations
- Manual: onboarding flow, mark attendance, verify verdict updates on home screen, verify morning notification fires
