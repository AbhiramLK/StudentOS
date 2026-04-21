# StudentOS V2 — Design Spec

**Date:** 2026-04-22  
**Platform:** React Native (Expo)  
**Target users:** NIT Calicut students  

---

## 1. Overview

StudentOS V2 is a full rewrite of V1. All data moves to Supabase — no local SQLite. The app becomes a campus operating system: attendance + timetable (V1 core), plus a live campus feed, anonymous wall, notes hub, mess menu, gym tracker, AI suggestions, and in-app messaging.

**Design reference:** Dark theme (`#0b0c10` bg, `#66fcf1` accent). 2-tab bottom nav — Home dashboard and All features grid.

---

## 2. Architecture

```
App (Expo React Native)
  └── supabase-js
        ├── Auth      — @nitc.ac.in email + OTP verification
        ├── Postgres  — all application data (14 tables)
        ├── Realtime  — Feed, Wall, Messages live updates
        └── Storage   — Notes PDFs and images

Supabase Edge Functions (Deno)
  ├── ai-suggest   — receives user context, calls Gemini Flash, returns suggestion cards
  └── mess-admin   — admin-only endpoint for writing mess menus and academic calendar
```

- **No SQLite.** No offline mode. Internet required.
- **RLS** on every user table: `auth.uid() = user_id`.
- **Gemini Flash** API key stored only in Edge Function environment — never in the app bundle.
- Admin access controlled via a boolean `is_admin` field on `profiles`, enforced in Edge Function and RLS policies.

---

## 3. Data Model

### Admin-managed (read-only for users)

| Table | Key columns |
|-------|-------------|
| `timetable_slots` | `id`, `day_of_week`, `start_time`, `end_time`, `slot_number` |
| `academic_calendar` | `id`, `date`, `type` (holiday \| day_change \| event), `description`, `substitute_day?` |
| `messes` | `id`, `name` |
| `mess_menus` | `id`, `mess_id`, `day_cycle`, `meal` (breakfast \| lunch \| evening \| dinner), `items[]` |

### User data (RLS: user_id = auth.uid())

| Table | Key columns |
|-------|-------------|
| `profiles` | `id`, `email`, `name`, `roll_number`, `mess_id`, `semester_end_date`, `is_admin` |
| `subjects` | `id`, `user_id`, `name`, `target_pct` |
| `user_timetable` | `id`, `user_id`, `slot_id` (→ timetable_slots), `subject_name` |
| `attendance_records` | `id`, `user_id`, `subject_id`, `date`, `status` (present \| absent) |
| `gym_sessions` | `id`, `user_id`, `date`, `start_time`, `duration_min`, `notes?` |

### Social (partially public)

| Table | Key columns | Access |
|-------|-------------|--------|
| `feed_posts` | `id`, `user_id`, `title`, `body`, `location?`, `expires_at` | Authenticated read, owner write |
| `wall_entries` | `id`, `content`, `color`, `created_at`, `expires_at` | Public read/insert, no user_id |
| `notes` | `id`, `user_id`, `subject_name`, `semester`, `title`, `file_path`, `download_count` | Authenticated read, owner write |
| `conversations` | `id`, `user_a`, `user_b`, `last_message_id`, `updated_at` | Participants only |
| `messages` | `id`, `sender_id`, `receiver_id`, `content`, `created_at`, `read_at?` | Participants only |

### Calendar logic
- `holiday` → no classes, excluded from attendance prediction future count
- `day_change` → use `substitute_day`'s timetable slots instead of the actual weekday
- `event` → informational; shown on Home and Feed

---

## 4. Visual Style

| Token | Value |
|-------|-------|
| Background | `#0b0c10` |
| Card | `#111217` |
| Accent | `#66fcf1` |
| Text | `#eaeaea` |
| Muted | `#8a8f98` |
| Danger | `#ff5c5c` |
| Warning | `#ffc857` |

Font: system font stack (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`).

---

## 5. Navigation

**Bottom bar — 2 tabs:**

```
Home  |  All
```

**All screen — 3×3 grid:**

```
📅 Timetable   ⚡ Feed       ✔️ Attendance
📝 Notes       🍽️ Mess       🏋️ Gym
🧱 Wall        🤖 AI         💬 Messages
```

**Expo Router file structure:**
```
app/
  _layout.tsx                  — root (auth gate → onboarding or tabs)
  (auth)/
    login.tsx                  — email + name + roll number sign-up / sign-in
    verify.tsx                 — OTP verification
  onboarding/
    _layout.tsx
    subjects.tsx               — add subjects with target %
    timetable.tsx              — fill user_timetable slots
    mess.tsx                   — pick registered mess
    done.tsx
  (tabs)/
    _layout.tsx                — 2-tab bar
    index.tsx                  — Home dashboard
    all.tsx                    — All grid
  attendance/
    index.tsx                  — subject list + verdict chips
    [subjectId].tsx            — subject detail + history + mark attendance
  timetable/
    index.tsx                  — weekly slot grid
  feed/
    index.tsx                  — scrollable posts + create FAB
  wall/
    index.tsx                  — anonymous text cards + create FAB
  notes/
    index.tsx                  — browse by subject/semester + upload FAB
  mess/
    index.tsx                  — today's 4-meal breakdown
  gym/
    index.tsx                  — weekly session calendar + log FAB
  ai/
    index.tsx                  — suggestion cards + refresh
  messages/
    index.tsx                  — conversation inbox + search
    [conversationId].tsx       — chat screen
  settings/
    index.tsx                  — profile, mess change, semester end date, sign out
```

---

## 6. Screen Specs

### Auth
- **login.tsx** — email field (validates `@nitc.ac.in` suffix before submit), name, roll number. Supabase `signInWithOtp` or `signUp`.
- **verify.tsx** — 6-digit OTP input. On success, check if `profiles` row exists; if not, redirect to onboarding.

### Onboarding
- **subjects.tsx** — add subjects (name + target %). At least 1 required. Writes to `subjects` table.
- **timetable.tsx** — shows admin-defined `timetable_slots` grouped by day. User taps a slot to enter their subject name. Writes to `user_timetable`.
- **mess.tsx** — list of messes from `messes` table. User selects one. Updates `profiles.mess_id`.
- **done.tsx** — confirmation screen, navigates to Home.

### Home (`index.tsx`)
- **Header:** Greeting ("Good Morning/Afternoon/Evening, {name}") + ⚙️ → settings
- **Stored Updates button** — shows unread `feed_posts` count as notification dot. Taps → Feed screen.
- **Today section** — classes from `user_timetable` for today's effective day (respecting `academic_calendar`). Each row: time + subject name + attendance %. Colour: good (≥ target), warning (within 5% of threshold), bad (below threshold).
- **Suggested section** — free time gaps between today's slots, plus active `feed_posts` tagged as events.
- **Food Today section** — today's meals from `mess_menus` for user's registered mess, based on current day cycle.

### Attendance
- **index.tsx** — list of subjects with `AttendanceBar` and verdict chip (safe / warning / danger). Prediction engine runs same logic as V1 but reads from Supabase.
- **[subjectId].tsx** — subject name, percentage, history list (date + status). Mark present/absent for today (and past dates). Upserts `attendance_records`.

### Timetable
- Weekly grid of admin-defined slots. User's filled slots show subject name in accent colour. Empty slots show "+". Tap to set/change subject name (updates `user_timetable`). Academic calendar events shown as banners.

### Feed
- Scrollable list of `feed_posts` ordered by `created_at` desc, filtered to non-expired. Each card: title, body, optional location, time remaining badge, author name.
- FAB → modal: title, body, location (optional), expiry (1h / 6h / 24h / custom).
- Supabase Realtime subscription — new posts appear instantly.

### Wall
- Scrollable list of `wall_entries` ordered by `created_at` desc, filtered to non-expired (24h expiry hardcoded).
- Each card: text content, random accent colour background, time ago.
- FAB → text input modal (max 280 chars). No name, no user_id stored.
- Supabase Realtime subscription — new entries appear instantly.

### Notes
- Tabs: browse by subject | by semester.
- Each note: title, subject, semester, download count, upload date. Tap → download via Supabase Storage URL.
- FAB → upload: pick PDF/image from device, enter title + subject + semester. Writes to `notes` table + Storage.
- Sorted by `download_count` desc within each tab.

### Mess
- Shows user's registered mess name.
- 4-meal rows: Breakfast, Lunch, Evening, Dinner — items from `mess_menus` for today's day cycle.
- Day cycle calculated: `academic_calendar` checked first; if holiday, shows "No classes today"; otherwise uses a cycle counter from `profiles.semester_start_date`.

### Gym
- Weekly calendar (Mon–Sun). Sessions shown as coloured blocks.
- FAB → log session: date picker, start time, duration (30 / 45 / 60 / 90 min / custom), optional notes.
- Reads/writes `gym_sessions` for `auth.uid()`.

### AI
- Cards layout — 3–5 suggestion cards regenerated on demand.
- **Refresh** button → calls `ai-suggest` Edge Function with context payload:
  - subjects + attendance percentages
  - today's timetable
  - free gaps today
  - active feed events
- Gemini Flash returns structured JSON array of suggestions. Each card: icon, title, 1-sentence explanation.
- Example suggestions: "You can safely skip Physics today (93%)", "2-hour gap at 2pm — good study window", "Event in LT7 at 4pm".

### Messages
- **index.tsx** — conversation list sorted by `updated_at`. Each row: other user's name, last message preview, unread count. Search bar to find student by name → starts new conversation.
- **[conversationId].tsx** — chat bubbles, input field + send. Supabase Realtime subscription on `messages` filtered by conversation participants. Marks messages as read on view (`read_at` updated).

### Settings
- Display name, roll number (read-only after onboarding), change mess, change semester end date, sign out.

---

## 7. Edge Functions

### `ai-suggest`
- **Auth:** requires valid Supabase JWT (authenticated users only)
- **Input:** `{ subjects, attendance, todaySlots, freeGaps, feedEvents }`
- **Action:** constructs a concise prompt, calls Gemini Flash (`gemini-1.5-flash`), parses JSON response
- **Output:** `{ suggestions: [{ icon, title, body }] }`

### `mess-admin`
- **Auth:** requires valid JWT + `profiles.is_admin = true`
- **Input:** mess menu rows or academic calendar entries
- **Action:** bulk upserts into `mess_menus` or `academic_calendar`
- **Output:** `{ success: true, count: N }`

---

## 8. Notifications

Daily reminder at 7:30am (same as V1) using `expo-notifications`. Content built from today's effective timetable (respecting `academic_calendar`) + attendance verdicts per subject. Requires development build (not Expo Go) for Android push.

---

## 9. Out of Scope for V2

- Offline / local-first mode
- Admin UI within the app (mess/calendar admin uses Edge Function directly or a separate web tool)
- Group chats (Messages is 1:1 only)
- Post editing (Feed and Wall are create/expire only)
- Anonymous Wall drawing (text only)
