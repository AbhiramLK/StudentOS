# StudentOS MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native mobile app that tracks attendance and tells students whether they can safely skip class today.

**Architecture:** SQLite (expo-sqlite) stores all data locally. A pure `predict()` function computes skip verdicts from attendance records + timetable. Zustand stores bridge the DB and UI. Expo Router handles tab navigation with an onboarding gate on first launch.

**Tech Stack:** React Native + Expo SDK 52, Expo Router, expo-sqlite v14, Zustand, expo-notifications, expo-crypto, TypeScript, Jest (jest-expo)

---

## File Map

```
app/
  _layout.tsx                  ← Root: init DB, gate to onboarding if no settings
  (tabs)/
    _layout.tsx                ← Tab bar (Home / Timetable / Attendance)
    index.tsx                  ← Home Dashboard
    timetable.tsx              ← Weekly timetable view + add/delete slots
    attendance.tsx             ← Subject list with attendance %
  subject/
    [id].tsx                   ← Subject detail + mark attendance history
  onboarding/
    _layout.tsx                ← Stack layout
    index.tsx                  ← Step 1: semester end date
    subjects.tsx               ← Step 2: add subjects
    timetable.tsx              ← Step 3: add timetable slots
    done.tsx                   ← Step 4: all done

src/
  types.ts                     ← All shared TypeScript interfaces
  db/
    schema.ts                  ← CREATE TABLE statements
    index.ts                   ← getDb() singleton, runs schema on first call
    settings.ts                ← getSettings() / saveSettings()
    subjects.ts                ← getAllSubjects() / createSubject() / etc.
    timetable.ts               ← getAllSlots() / createSlot() / countFutureSlots()
    attendance.ts              ← getRecordsForSubject() / upsertRecord()
  engine/
    predictionEngine.ts        ← predict() pure function
    predictionEngine.test.ts   ← Jest unit tests
    notifications.ts           ← scheduleNotification() / requestPermissions()
  stores/
    subjectsStore.ts           ← Zustand: subjects CRUD + reactive state
    timetableStore.ts          ← Zustand: slots CRUD + triggers reschedule
  components/
    VerdictChip.tsx            ← Colored chip: ✅ / ⚠️ / 🚫
    AttendanceBar.tsx          ← Progress bar with threshold marker
    ClassCard.tsx              ← Today's class card with mark buttons
```

---

## Task 1: Scaffold Expo Project

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `jest.config.js` (via template)
- Modify: `app.json` (add scheme for Expo Router)

- [ ] **Step 1: Scaffold with tabs template**

```bash
cd "D:\New folder\StudentOS"
npx create-expo-app@latest . --template tabs
```

When prompted about existing files, confirm overwrite. This installs Expo Router, TypeScript, jest-expo, and @expo/vector-icons.

- [ ] **Step 2: Install additional dependencies**

```bash
npx expo install expo-sqlite zustand expo-notifications expo-crypto @react-native-community/datetimepicker
```

- [ ] **Step 3: Verify jest config exists**

Open `package.json`. Confirm it contains:
```json
"jest": {
  "preset": "jest-expo"
}
```

If `jest.config.js` exists instead, that's fine too. Either works.

- [ ] **Step 4: Remove template example files**

Delete these files (they're boilerplate from the template):
```bash
rm app/\(tabs\)/explore.tsx
rm -rf components/
rm -rf constants/
rm -rf hooks/
```

Keep: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`

- [ ] **Step 5: Create src/ directory structure**

```bash
mkdir -p src/db src/engine src/stores src/components
```

- [ ] **Step 6: Verify app runs**

```bash
npx expo start
```

Expected: Metro bundler starts, QR code shown. Press `w` to open in browser (Expo Go web preview). App should show the default tab layout without crashing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold expo tabs project with dependencies"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types**

```typescript
// src/types.ts
export type AttendanceStatus = 'present' | 'absent' | 'cancelled';
export type Verdict = 'safe' | 'warning' | 'danger';

export interface Subject {
  id: string;
  name: string;
  threshold: number;
  created_at: number;
}

export interface TimetableSlot {
  id: string;
  subject_id: string;
  day_of_week: number; // 0=Mon … 6=Sun
  start_time: string;  // "09:00"
  end_time: string;    // "10:00"
}

export interface AttendanceRecord {
  id: string;
  subject_id: string;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
}

export interface Settings {
  semester_end_date: string; // "YYYY-MM-DD"
}

export interface PredictionResult {
  currentPct: number;
  safeSkips: number;
  verdict: Verdict;
  message: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Database Schema + Init

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`

- [ ] **Step 1: Write schema**

```typescript
// src/db/schema.ts
export const CREATE_SETTINGS = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    semester_end_date TEXT NOT NULL
  )
`;

export const CREATE_SUBJECTS = `
  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    threshold INTEGER NOT NULL DEFAULT 75,
    created_at INTEGER NOT NULL
  )
`;

export const CREATE_TIMETABLE_SLOTS = `
  CREATE TABLE IF NOT EXISTS timetable_slots (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  )
`;

export const CREATE_ATTENDANCE_RECORDS = `
  CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'cancelled')),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  )
`;
```

- [ ] **Step 2: Write DB singleton**

```typescript
// src/db/index.ts
import * as SQLite from 'expo-sqlite';
import {
  CREATE_SETTINGS,
  CREATE_SUBJECTS,
  CREATE_TIMETABLE_SLOTS,
  CREATE_ATTENDANCE_RECORDS,
} from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('studentos.db');
    _db.execSync('PRAGMA foreign_keys = ON');
    _db.execSync(CREATE_SETTINGS);
    _db.execSync(CREATE_SUBJECTS);
    _db.execSync(CREATE_TIMETABLE_SLOTS);
    _db.execSync(CREATE_ATTENDANCE_RECORDS);
  }
  return _db;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts src/db/index.ts
git commit -m "feat: add SQLite schema and db singleton"
```

---

## Task 4: Settings, Subjects, Timetable, Attendance CRUD

**Files:**
- Create: `src/db/settings.ts`
- Create: `src/db/subjects.ts`
- Create: `src/db/timetable.ts`
- Create: `src/db/attendance.ts`

- [ ] **Step 1: Settings CRUD**

```typescript
// src/db/settings.ts
import { getDb } from './index';
import type { Settings } from '../types';

export function getSettings(): Settings | null {
  return getDb().getFirstSync<Settings>('SELECT * FROM settings LIMIT 1');
}

export function saveSettings(semester_end_date: string): void {
  const existing = getSettings();
  if (existing) {
    getDb().runSync('UPDATE settings SET semester_end_date = ?', semester_end_date);
  } else {
    getDb().runSync('INSERT INTO settings (id, semester_end_date) VALUES (1, ?)', semester_end_date);
  }
}
```

- [ ] **Step 2: Subjects CRUD**

```typescript
// src/db/subjects.ts
import * as Crypto from 'expo-crypto';
import { getDb } from './index';
import type { Subject } from '../types';

export function getAllSubjects(): Subject[] {
  return getDb().getAllSync<Subject>('SELECT * FROM subjects ORDER BY created_at ASC');
}

export function getSubjectById(id: string): Subject | null {
  return getDb().getFirstSync<Subject>('SELECT * FROM subjects WHERE id = ?', id);
}

export function createSubject(name: string, threshold = 75): Subject {
  const id = Crypto.randomUUID();
  const created_at = Date.now();
  getDb().runSync(
    'INSERT INTO subjects (id, name, threshold, created_at) VALUES (?, ?, ?, ?)',
    id, name, threshold, created_at
  );
  return { id, name, threshold, created_at };
}

export function updateSubject(id: string, name: string, threshold: number): void {
  getDb().runSync('UPDATE subjects SET name = ?, threshold = ? WHERE id = ?', name, threshold, id);
}

export function deleteSubject(id: string): void {
  getDb().runSync('DELETE FROM subjects WHERE id = ?', id);
}
```

- [ ] **Step 3: Timetable CRUD**

```typescript
// src/db/timetable.ts
import * as Crypto from 'expo-crypto';
import { getDb } from './index';
import type { TimetableSlot } from '../types';

export function getAllSlots(): TimetableSlot[] {
  return getDb().getAllSync<TimetableSlot>(
    'SELECT * FROM timetable_slots ORDER BY day_of_week, start_time'
  );
}

export function getSlotsForDay(day_of_week: number): TimetableSlot[] {
  return getDb().getAllSync<TimetableSlot>(
    'SELECT * FROM timetable_slots WHERE day_of_week = ? ORDER BY start_time',
    day_of_week
  );
}

export function getSlotsForSubject(subject_id: string): TimetableSlot[] {
  return getDb().getAllSync<TimetableSlot>(
    'SELECT * FROM timetable_slots WHERE subject_id = ? ORDER BY day_of_week, start_time',
    subject_id
  );
}

export function createSlot(
  subject_id: string,
  day_of_week: number,
  start_time: string,
  end_time: string
): TimetableSlot {
  const id = Crypto.randomUUID();
  getDb().runSync(
    'INSERT INTO timetable_slots (id, subject_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
    id, subject_id, day_of_week, start_time, end_time
  );
  return { id, subject_id, day_of_week, start_time, end_time };
}

export function deleteSlot(id: string): void {
  getDb().runSync('DELETE FROM timetable_slots WHERE id = ?', id);
}

/** Count how many times this subject's slots recur from fromDate to toDate (inclusive). */
export function countFutureSlots(subject_id: string, fromDate: string, toDate: string): number {
  const slots = getSlotsForSubject(subject_id);
  if (slots.length === 0) return 0;

  const from = new Date(fromDate);
  const to = new Date(toDate);
  let count = 0;
  const cursor = new Date(from);

  while (cursor <= to) {
    // JS getDay(): 0=Sun,1=Mon...6=Sat → convert to 0=Mon...6=Sun
    const dow = (cursor.getDay() + 6) % 7;
    count += slots.filter(s => s.day_of_week === dow).length;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
```

- [ ] **Step 4: Attendance CRUD**

```typescript
// src/db/attendance.ts
import * as Crypto from 'expo-crypto';
import { getDb } from './index';
import type { AttendanceRecord, AttendanceStatus } from '../types';

export function getRecordsForSubject(subject_id: string): AttendanceRecord[] {
  return getDb().getAllSync<AttendanceRecord>(
    'SELECT * FROM attendance_records WHERE subject_id = ? ORDER BY date DESC',
    subject_id
  );
}

export function getRecordForDate(subject_id: string, date: string): AttendanceRecord | null {
  return getDb().getFirstSync<AttendanceRecord>(
    'SELECT * FROM attendance_records WHERE subject_id = ? AND date = ?',
    subject_id, date
  );
}

export function upsertRecord(
  subject_id: string,
  date: string,
  status: AttendanceStatus
): AttendanceRecord {
  const existing = getRecordForDate(subject_id, date);
  if (existing) {
    getDb().runSync('UPDATE attendance_records SET status = ? WHERE id = ?', status, existing.id);
    return { ...existing, status };
  }
  const id = Crypto.randomUUID();
  getDb().runSync(
    'INSERT INTO attendance_records (id, subject_id, date, status) VALUES (?, ?, ?, ?)',
    id, subject_id, date, status
  );
  return { id, subject_id, date, status };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/db/settings.ts src/db/subjects.ts src/db/timetable.ts src/db/attendance.ts
git commit -m "feat: add CRUD modules for all four tables"
```

---

## Task 5: Prediction Engine (TDD)

**Files:**
- Create: `src/engine/predictionEngine.ts`
- Create: `src/engine/predictionEngine.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// src/engine/predictionEngine.test.ts
import { predict } from './predictionEngine';
import type { Subject, AttendanceRecord } from '../types';

const subject: Subject = { id: '1', name: 'Maths', threshold: 75, created_at: 0 };

function rec(status: 'present' | 'absent' | 'cancelled', date: string): AttendanceRecord {
  return { id: date + status, subject_id: '1', date, status };
}

describe('predict', () => {
  it('safe when many skips remain', () => {
    // 10 classes: 8 present, 2 absent = 80%. 20 future slots.
    // maxAbsences = floor(30 * 0.25) = 7, currentAbsences = 2, safeSkips = 5
    const records = [
      ...Array.from({ length: 8 }, (_, i) => rec('present', `2026-04-${String(i + 1).padStart(2, '0')}`)),
      ...Array.from({ length: 2 }, (_, i) => rec('absent', `2026-04-${String(i + 9).padStart(2, '0')}`)),
    ];
    const result = predict(subject, records, 20);
    expect(result.currentPct).toBe(80);
    expect(result.safeSkips).toBe(5);
    expect(result.verdict).toBe('safe');
  });

  it('warning when 1 skip left', () => {
    // 10 classes: 8 present, 2 absent. 2 future slots.
    // maxAbsences = floor(12 * 0.25) = 3, currentAbsences = 2, safeSkips = 1
    const records = [
      ...Array.from({ length: 8 }, (_, i) => rec('present', `2026-04-${String(i + 1).padStart(2, '0')}`)),
      ...Array.from({ length: 2 }, (_, i) => rec('absent', `2026-04-${String(i + 9).padStart(2, '0')}`)),
    ];
    const result = predict(subject, records, 2);
    expect(result.verdict).toBe('warning');
    expect(result.safeSkips).toBe(1);
  });

  it('danger when at skip limit', () => {
    // 10 classes: 7 present, 3 absent = 70%. 4 future slots.
    // maxAbsences = floor(14 * 0.25) = 3, currentAbsences = 3, safeSkips = 0
    const records = [
      ...Array.from({ length: 7 }, (_, i) => rec('present', `2026-04-${String(i + 1).padStart(2, '0')}`)),
      ...Array.from({ length: 3 }, (_, i) => rec('absent', `2026-04-${String(i + 8).padStart(2, '0')}`)),
    ];
    const result = predict(subject, records, 4);
    expect(result.verdict).toBe('danger');
    expect(result.safeSkips).toBe(0);
  });

  it('cancelled records do not count toward total', () => {
    const records = [
      rec('present', '2026-04-01'),
      rec('cancelled', '2026-04-02'),
      rec('absent', '2026-04-03'),
    ];
    const result = predict(subject, records, 10);
    // total = 2 (not 3), attended = 1
    expect(result.currentPct).toBe(50);
  });

  it('returns safe when no classes at all', () => {
    const result = predict(subject, [], 0);
    expect(result.verdict).toBe('safe');
    expect(result.currentPct).toBe(100);
  });

  it('handles no prior records with future slots', () => {
    // total=0, future=10, maxAbsences=floor(10*0.25)=2, safeSkips=2
    const result = predict(subject, [], 10);
    expect(result.safeSkips).toBe(2);
    expect(result.verdict).toBe('safe');
    expect(result.currentPct).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests — confirm all fail**

```bash
npx jest src/engine/predictionEngine.test.ts
```

Expected: FAIL — `Cannot find module './predictionEngine'`

- [ ] **Step 3: Implement the engine**

```typescript
// src/engine/predictionEngine.ts
import type { Subject, AttendanceRecord, PredictionResult, Verdict } from '../types';

export function predict(
  subject: Subject,
  records: AttendanceRecord[],
  futureSlotsCount: number
): PredictionResult {
  const countable = records.filter(r => r.status !== 'cancelled');
  const attended = countable.filter(r => r.status === 'present').length;
  const total = countable.length;

  if (total + futureSlotsCount === 0) {
    return { currentPct: 100, safeSkips: 0, verdict: 'safe', message: '✅ No classes scheduled' };
  }

  const currentPct = total === 0 ? 100 : Math.round((attended / total) * 100);
  const maxAbsences = Math.floor((total + futureSlotsCount) * (1 - subject.threshold / 100));
  const currentAbsences = total - attended;
  const safeSkips = maxAbsences - currentAbsences;

  const verdict: Verdict = safeSkips >= 2 ? 'safe' : safeSkips === 1 ? 'warning' : 'danger';

  const messages: Record<Verdict, string> = {
    safe: '✅ Safe to skip',
    warning: '⚠️ Skip carefully — 1 skip left',
    danger: "🚫 Don't skip — attendance at risk",
  };

  return { currentPct, safeSkips, verdict, message: messages[verdict] };
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx jest src/engine/predictionEngine.test.ts
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/engine/predictionEngine.ts src/engine/predictionEngine.test.ts
git commit -m "feat: add prediction engine with full test coverage"
```

---

## Task 6: Notifications

**Files:**
- Create: `src/engine/notifications.ts`

- [ ] **Step 1: Write notifications module**

```typescript
// src/engine/notifications.ts
import * as Notifications from 'expo-notifications';
import { getAllSubjects } from '../db/subjects';
import { getSlotsForDay, countFutureSlots } from '../db/timetable';
import { getRecordsForSubject } from '../db/attendance';
import { getSettings } from '../db/settings';
import { predict } from './predictionEngine';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleNotification(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const settings = getSettings();
  if (!settings) return;

  const today = new Date();
  // Convert JS day (0=Sun) to app day (0=Mon)
  const dayOfWeek = (today.getDay() + 6) % 7;
  const todaySlots = getSlotsForDay(dayOfWeek);
  if (todaySlots.length === 0) return;

  const subjects = getAllSubjects();
  const todayStr = today.toISOString().split('T')[0];

  const parts = subjects
    .filter(s => todaySlots.some(slot => slot.subject_id === s.id))
    .map(subject => {
      const records = getRecordsForSubject(subject.id);
      const futureSlotsCount = countFutureSlots(subject.id, todayStr, settings.semester_end_date);
      const result = predict(subject, records, futureSlotsCount);
      const icon = result.verdict === 'safe' ? '✅' : result.verdict === 'warning' ? '⚠️' : '🚫';
      return `${subject.name} ${icon}`;
    });

  if (parts.length === 0) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Today's Classes",
      body: parts.join('  ·  '),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 7,
      minute: 30,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/notifications.ts
git commit -m "feat: add daily notification scheduler"
```

---

## Task 7: Zustand Stores

**Files:**
- Create: `src/stores/subjectsStore.ts`
- Create: `src/stores/timetableStore.ts`

- [ ] **Step 1: Subjects store**

```typescript
// src/stores/subjectsStore.ts
import { create } from 'zustand';
import {
  getAllSubjects, createSubject, updateSubject, deleteSubject,
} from '../db/subjects';
import type { Subject } from '../types';

interface SubjectsState {
  subjects: Subject[];
  load: () => void;
  add: (name: string, threshold?: number) => void;
  update: (id: string, name: string, threshold: number) => void;
  remove: (id: string) => void;
}

export const useSubjectsStore = create<SubjectsState>((set) => ({
  subjects: [],
  load: () => set({ subjects: getAllSubjects() }),
  add: (name, threshold = 75) => {
    createSubject(name, threshold);
    set({ subjects: getAllSubjects() });
  },
  update: (id, name, threshold) => {
    updateSubject(id, name, threshold);
    set({ subjects: getAllSubjects() });
  },
  remove: (id) => {
    deleteSubject(id);
    set({ subjects: getAllSubjects() });
  },
}));
```

- [ ] **Step 2: Timetable store**

```typescript
// src/stores/timetableStore.ts
import { create } from 'zustand';
import { getAllSlots, createSlot, deleteSlot } from '../db/timetable';
import { scheduleNotification } from '../engine/notifications';
import type { TimetableSlot } from '../types';

interface TimetableState {
  slots: TimetableSlot[];
  load: () => void;
  addSlot: (subject_id: string, day_of_week: number, start_time: string, end_time: string) => void;
  removeSlot: (id: string) => void;
}

export const useTimetableStore = create<TimetableState>((set) => ({
  slots: [],
  load: () => set({ slots: getAllSlots() }),
  addSlot: (subject_id, day_of_week, start_time, end_time) => {
    createSlot(subject_id, day_of_week, start_time, end_time);
    set({ slots: getAllSlots() });
    scheduleNotification();
  },
  removeSlot: (id) => {
    deleteSlot(id);
    set({ slots: getAllSlots() });
    scheduleNotification();
  },
}));
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/subjectsStore.ts src/stores/timetableStore.ts
git commit -m "feat: add Zustand stores for subjects and timetable"
```

---

## Task 8: Shared UI Components

**Files:**
- Create: `src/components/VerdictChip.tsx`
- Create: `src/components/AttendanceBar.tsx`
- Create: `src/components/ClassCard.tsx`

- [ ] **Step 1: VerdictChip**

```typescript
// src/components/VerdictChip.tsx
import { View, Text, StyleSheet } from 'react-native';
import type { Verdict } from '../types';

const COLOR: Record<Verdict, string> = {
  safe: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
};

export function VerdictChip({ verdict, message }: { verdict: Verdict; message: string }) {
  const color = COLOR[verdict];
  return (
    <View style={[styles.chip, { backgroundColor: color + '18', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontSize: 13, fontWeight: '600' },
});
```

- [ ] **Step 2: AttendanceBar**

```typescript
// src/components/AttendanceBar.tsx
import { View, Text, StyleSheet } from 'react-native';

interface Props { pct: number; threshold: number; label: string }

export function AttendanceBar({ pct, threshold, label }: Props) {
  const color = pct >= threshold ? '#16a34a' : pct >= threshold - 5 ? '#d97706' : '#dc2626';
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.pct, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
        <View style={[styles.marker, { left: `${threshold}%` as any }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 14, color: '#374151' },
  pct: { fontSize: 14, fontWeight: '700' },
  track: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4 },
  fill: { height: '100%', borderRadius: 4 },
  marker: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: '#9ca3af' },
});
```

- [ ] **Step 3: ClassCard**

```typescript
// src/components/ClassCard.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VerdictChip } from './VerdictChip';
import type { TimetableSlot, Subject, PredictionResult } from '../types';

interface Props {
  slot: TimetableSlot;
  subject: Subject;
  prediction: PredictionResult;
  markedStatus: 'present' | 'absent' | null;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
}

export function ClassCard({ slot, subject, prediction, markedStatus, onMarkPresent, onMarkAbsent }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.name}>{subject.name}</Text>
        <Text style={styles.time}>{slot.start_time} – {slot.end_time}</Text>
      </View>
      <VerdictChip verdict={prediction.verdict} message={prediction.message} />
      {markedStatus == null ? (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.presentBtn]} onPress={onMarkPresent}>
            <Text style={styles.btnText}>Present</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.absentBtn]} onPress={onMarkAbsent}>
            <Text style={styles.btnText}>Absent</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.marked}>
          {markedStatus === 'present' ? '✓ Marked present' : '✗ Marked absent'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 6, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600', color: '#111827' },
  time: { fontSize: 13, color: '#6b7280' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  presentBtn: { backgroundColor: '#dcfce7' },
  absentBtn: { backgroundColor: '#fee2e2' },
  btnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  marked: { marginTop: 8, fontSize: 13, color: '#6b7280' },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: add VerdictChip, AttendanceBar, ClassCard components"
```

---

## Task 9: Root Layout + Tab Navigation

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Root layout with DB init and onboarding gate**

```typescript
// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { getDb } from '../src/db';
import { getSettings } from '../src/db/settings';
import { requestPermissions } from '../src/engine/notifications';

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getDb(); // initialize tables
    requestPermissions();
    const settings = getSettings();
    if (!settings) {
      router.replace('/onboarding');
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="subject/[id]" options={{ headerShown: true, title: '' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Tab bar**

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(focused: boolean, on: IconName, off: IconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={focused ? on : off} size={size} color={color} />
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#3b82f6' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) =>
            icon(focused, 'home', 'home-outline')({ color, size }),
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: 'Timetable',
          tabBarIcon: ({ focused, color, size }) =>
            icon(focused, 'calendar', 'calendar-outline')({ color, size }),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ focused, color, size }) =>
            icon(focused, 'checkmark-circle', 'checkmark-circle-outline')({ color, size }),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx app/(tabs)/_layout.tsx
git commit -m "feat: root layout with db init and tab navigation"
```

---

## Task 10: Onboarding Screens

**Files:**
- Create: `app/onboarding/_layout.tsx`
- Create: `app/onboarding/index.tsx`
- Create: `app/onboarding/subjects.tsx`
- Create: `app/onboarding/timetable.tsx`
- Create: `app/onboarding/done.tsx`

- [ ] **Step 1: Onboarding stack layout**

```typescript
// app/onboarding/_layout.tsx
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Step 1 — Semester end date**

```typescript
// app/onboarding/index.tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { saveSettings } from '../../src/db/settings';

export default function OnboardingSemester() {
  const router = useRouter();
  // Default: December 1st of current year
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMonth(11, 1);
    return d;
  });

  const handleNext = () => {
    saveSettings(date.toISOString().split('T')[0]);
    router.push('/onboarding/subjects');
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>When does your semester end?</Text>
      <Text style={s.sub}>Used to predict how many classes you can skip.</Text>
      <DateTimePicker
        value={date}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        minimumDate={new Date()}
        onChange={(_, selected) => selected && setDate(selected)}
      />
      <TouchableOpacity style={s.btn} onPress={handleNext}>
        <Text style={s.btnText}>Next →</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
        <Text style={s.skip}>Skip setup</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15, color: '#6b7280', marginBottom: 32 },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skip: { textAlign: 'center', marginTop: 16, color: '#9ca3af' },
});
```

- [ ] **Step 3: Step 2 — Add subjects**

```typescript
// app/onboarding/subjects.tsx
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';

export default function OnboardingSubjects() {
  const router = useRouter();
  const { subjects, load, add, remove } = useSubjectsStore();
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState('75');

  useEffect(() => { load(); }, []);

  const handleAdd = () => {
    if (!name.trim()) return;
    add(name.trim(), parseInt(threshold, 10) || 75);
    setName('');
    setThreshold('75');
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Add Your Subjects</Text>
      <Text style={s.sub}>Add courses you want to track.</Text>
      <TextInput style={s.input} placeholder="Subject name" value={name} onChangeText={setName} />
      <TextInput
        style={s.input}
        placeholder="Min attendance % (default 75)"
        value={threshold}
        onChangeText={setThreshold}
        keyboardType="numeric"
      />
      <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
        <Text style={s.addBtnText}>+ Add Subject</Text>
      </TouchableOpacity>
      <FlatList
        data={subjects}
        keyExtractor={s => s.id}
        style={s.list}
        renderItem={({ item }) => (
          <View style={s.row}>
            <Text style={s.itemText}>{item.name} ({item.threshold}%)</Text>
            <TouchableOpacity onPress={() => remove(item.id)}>
              <Text style={s.del}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <TouchableOpacity
        style={[s.btn, subjects.length === 0 && s.btnOff]}
        disabled={subjects.length === 0}
        onPress={() => router.push('/onboarding/timetable')}
      >
        <Text style={s.btnText}>Next →</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 8 },
  addBtn: { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#3b82f6', fontWeight: '600' },
  list: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  itemText: { fontSize: 15 },
  del: { color: '#ef4444', fontSize: 18, paddingHorizontal: 8 },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnOff: { backgroundColor: '#9ca3af' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 4: Step 3 — Add timetable slots**

```typescript
// app/onboarding/timetable.tsx
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { useTimetableStore } from '../../src/stores/timetableStore';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function OnboardingTimetable() {
  const router = useRouter();
  const { subjects, load: loadSubjects } = useSubjectsStore();
  const { slots, load: loadSlots, addSlot, removeSlot } = useTimetableStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [startTime, setStartTime] = useState(new Date(2000, 0, 1, 9, 0));
  const [endTime, setEndTime] = useState(new Date(2000, 0, 1, 10, 0));

  useEffect(() => { loadSubjects(); loadSlots(); }, []);

  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const handleAdd = () => {
    if (!selectedSubject) return;
    addSlot(selectedSubject, selectedDay, fmt(startTime), fmt(endTime));
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Build Your Timetable</Text>
      <Text style={s.sub}>Add weekly recurring class slots.</Text>

      <Text style={s.label}>Subject</Text>
      <View style={s.chips}>
        {subjects.map(sub => (
          <TouchableOpacity
            key={sub.id}
            style={[s.chip, selectedSubject === sub.id && s.chipActive]}
            onPress={() => setSelectedSubject(sub.id)}
          >
            <Text style={[s.chipText, selectedSubject === sub.id && s.chipTextActive]}>{sub.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Day</Text>
      <View style={s.chips}>
        {DAYS.map((day, i) => (
          <TouchableOpacity
            key={day}
            style={[s.chip, selectedDay === i && s.chipActive]}
            onPress={() => setSelectedDay(i)}
          >
            <Text style={[s.chipText, selectedDay === i && s.chipTextActive]}>{day}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Start time</Text>
      <DateTimePicker value={startTime} mode="time" display="default" onChange={(_, d) => d && setStartTime(d)} />

      <Text style={s.label}>End time</Text>
      <DateTimePicker value={endTime} mode="time" display="default" onChange={(_, d) => d && setEndTime(d)} />

      <TouchableOpacity style={[s.addBtn, !selectedSubject && s.addBtnOff]} onPress={handleAdd} disabled={!selectedSubject}>
        <Text style={s.addBtnText}>+ Add Slot</Text>
      </TouchableOpacity>

      <FlatList
        data={slots}
        keyExtractor={slot => slot.id}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const sub = subjects.find(s => s.id === item.subject_id);
          return (
            <View style={s.row}>
              <Text style={s.rowText}>{DAYS[item.day_of_week]}  {sub?.name}  {item.start_time}–{item.end_time}</Text>
              <TouchableOpacity onPress={() => removeSlot(item.id)}>
                <Text style={s.del}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <TouchableOpacity style={s.btn} onPress={() => router.push('/onboarding/done')}>
        <Text style={s.btnText}>Next →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { color: '#fff' },
  addBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  addBtnOff: { backgroundColor: '#9ca3af' },
  addBtnText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  rowText: { fontSize: 14 },
  del: { color: '#ef4444', fontSize: 18, paddingHorizontal: 8 },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 5: Done screen**

```typescript
// app/onboarding/done.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function OnboardingDone() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <Text style={s.emoji}>🎓</Text>
      <Text style={s.title}>You're all set!</Text>
      <Text style={s.sub}>StudentOS will now track your attendance and help you decide when it's safe to skip.</Text>
      <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)')}>
        <Text style={s.btnText}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  sub: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  btn: { backgroundColor: '#3b82f6', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 6: Commit**

```bash
git add app/onboarding/
git commit -m "feat: add 4-step onboarding flow"
```

---

## Task 11: Home Dashboard

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Write home screen**

```typescript
// app/(tabs)/index.tsx
import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { useTimetableStore } from '../../src/stores/timetableStore';
import { ClassCard } from '../../src/components/ClassCard';
import { AttendanceBar } from '../../src/components/AttendanceBar';
import { getRecordsForSubject, upsertRecord } from '../../src/db/attendance';
import { getSettings } from '../../src/db/settings';
import { countFutureSlots } from '../../src/db/timetable';
import { predict } from '../../src/engine/predictionEngine';

export default function HomeScreen() {
  const { subjects, load: loadSubjects } = useSubjectsStore();
  const { slots, load: loadSlots } = useTimetableStore();
  // Incremented after marking attendance to force predictions to recompute
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadSubjects();
      loadSlots();
    }, [])
  );

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDow = (today.getDay() + 6) % 7;
  const settings = getSettings();

  const todaySlots = useMemo(
    () => slots.filter(s => s.day_of_week === todayDow).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [slots, todayDow]
  );

  const predictions = useMemo(() => {
    return subjects.map(subject => {
      const records = getRecordsForSubject(subject.id);
      const futureSlotsCount = settings
        ? countFutureSlots(subject.id, todayStr, settings.semester_end_date)
        : 0;
      return { subject, prediction: predict(subject, records, futureSlotsCount), records };
    });
  }, [subjects, slots, refreshKey]);

  const worstSubject = useMemo(() => {
    if (predictions.length === 0) return null;
    return predictions.reduce((worst, curr) =>
      curr.prediction.currentPct < worst.prediction.currentPct ? curr : worst
    );
  }, [predictions]);

  const handleMark = (subjectId: string, status: 'present' | 'absent') => {
    upsertRecord(subjectId, todayStr, status);
    setRefreshKey(k => k + 1); // triggers predictions recompute
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Today</Text>
      <Text style={styles.date}>{today.toDateString()}</Text>

      {worstSubject && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ATTENDANCE HEALTH</Text>
          <AttendanceBar
            pct={worstSubject.prediction.currentPct}
            threshold={worstSubject.subject.threshold}
            label={worstSubject.subject.name}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TODAY'S CLASSES</Text>
        {todaySlots.length === 0 && (
          <Text style={styles.empty}>No classes today 🎉</Text>
        )}
        {todaySlots.map(slot => {
          const entry = predictions.find(p => p.subject.id === slot.subject_id);
          if (!entry) return null;
          const todayRecord = entry.records.find(r => r.date === todayStr);
          return (
            <ClassCard
              key={slot.id}
              slot={slot}
              subject={entry.subject}
              prediction={entry.prediction}
              markedStatus={todayRecord?.status === 'cancelled' ? null : (todayRecord?.status ?? null)}
              onMarkPresent={() => handleMark(entry.subject.id, 'present')}
              onMarkAbsent={() => handleMark(entry.subject.id, 'absent')}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingTop: 56 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111827' },
  date: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, marginBottom: 8 },
  empty: { fontSize: 15, color: '#6b7280', textAlign: 'center', paddingVertical: 24 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: home dashboard with today's classes and verdict chips"
```

---

## Task 12: Timetable Screen

**Files:**
- Modify: `app/(tabs)/timetable.tsx`

- [ ] **Step 1: Write timetable screen**

```typescript
// app/(tabs)/timetable.tsx
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { useTimetableStore } from '../../src/stores/timetableStore';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TimetableScreen() {
  const { subjects, load: loadSubjects } = useSubjectsStore();
  const { slots, load: loadSlots, addSlot, removeSlot } = useTimetableStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [startTime, setStartTime] = useState(new Date(2000, 0, 1, 9, 0));
  const [endTime, setEndTime] = useState(new Date(2000, 0, 1, 10, 0));
  const [adding, setAdding] = useState(false);

  useFocusEffect(useCallback(() => { loadSubjects(); loadSlots(); }, []));

  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const handleAdd = () => {
    if (!selectedSubject) return;
    addSlot(selectedSubject, selectedDay, fmt(startTime), fmt(endTime));
    setAdding(false);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.heading}>Timetable</Text>

      {DAYS.map((day, dow) => {
        const daySlots = slots
          .filter(sl => sl.day_of_week === dow)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <View key={day} style={s.daySection}>
            <Text style={s.dayLabel}>{day}</Text>
            {daySlots.length === 0 && <Text style={s.noClass}>No classes</Text>}
            {daySlots.map(slot => {
              const sub = subjects.find(s => s.id === slot.subject_id);
              return (
                <View key={slot.id} style={s.slotRow}>
                  <Text style={s.slotText}>{slot.start_time}–{slot.end_time}  {sub?.name}</Text>
                  <TouchableOpacity onPress={() => removeSlot(slot.id)}>
                    <Text style={s.del}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      })}

      {!adding && (
        <TouchableOpacity style={s.addBtn} onPress={() => setAdding(true)}>
          <Text style={s.addBtnText}>+ Add Slot</Text>
        </TouchableOpacity>
      )}

      {adding && (
        <View style={s.form}>
          <Text style={s.formLabel}>Subject</Text>
          <View style={s.chips}>
            {subjects.map(sub => (
              <TouchableOpacity
                key={sub.id}
                style={[s.chip, selectedSubject === sub.id && s.chipActive]}
                onPress={() => setSelectedSubject(sub.id)}
              >
                <Text style={[s.chipText, selectedSubject === sub.id && s.chipTextActive]}>{sub.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.formLabel}>Day</Text>
          <View style={s.chips}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={d}
                style={[s.chip, selectedDay === i && s.chipActive]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[s.chipText, selectedDay === i && s.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.formLabel}>Start</Text>
          <DateTimePicker value={startTime} mode="time" display="default" onChange={(_, d) => d && setStartTime(d)} />
          <Text style={s.formLabel}>End</Text>
          <DateTimePicker value={endTime} mode="time" display="default" onChange={(_, d) => d && setEndTime(d)} />
          <View style={s.formActions}>
            <TouchableOpacity style={s.saveBtn} onPress={handleAdd} disabled={!selectedSubject}>
              <Text style={s.saveBtnText}>Save Slot</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setAdding(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  daySection: { marginBottom: 16 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' },
  noClass: { fontSize: 13, color: '#d1d5db' },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 4 },
  slotText: { fontSize: 14 },
  del: { color: '#ef4444', fontSize: 16 },
  addBtn: { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: '#3b82f6', fontWeight: '600' },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  cancelBtn: { flex: 1, backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: '#374151', fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/timetable.tsx
git commit -m "feat: timetable screen with weekly view and add/remove slots"
```

---

## Task 13: Attendance Screen + Subject Detail

**Files:**
- Modify: `app/(tabs)/attendance.tsx`
- Create: `app/subject/[id].tsx`

- [ ] **Step 1: Attendance list screen**

```typescript
// app/(tabs)/attendance.tsx
import { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { AttendanceBar } from '../../src/components/AttendanceBar';
import { getRecordsForSubject } from '../../src/db/attendance';
import { getSettings } from '../../src/db/settings';
import { countFutureSlots } from '../../src/db/timetable';
import { predict } from '../../src/engine/predictionEngine';

export default function AttendanceScreen() {
  const router = useRouter();
  const { subjects, load } = useSubjectsStore();
  const settings = getSettings();
  const todayStr = new Date().toISOString().split('T')[0];

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={s.screen}>
      <Text style={s.heading}>Attendance</Text>
      <FlatList
        data={subjects}
        keyExtractor={sub => sub.id}
        contentContainerStyle={s.list}
        renderItem={({ item: subject }) => {
          const records = getRecordsForSubject(subject.id);
          const futureSlotsCount = settings
            ? countFutureSlots(subject.id, todayStr, settings.semester_end_date)
            : 0;
          const prediction = predict(subject, records, futureSlotsCount);
          return (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/subject/${subject.id}`)}>
              <AttendanceBar pct={prediction.currentPct} threshold={subject.threshold} label={subject.name} />
              <Text style={s.detail}>
                {prediction.safeSkips > 0
                  ? `${prediction.safeSkips} safe skips left`
                  : 'No more skips — attend all classes'}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>No subjects yet. Add them in onboarding.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb', paddingTop: 56 },
  heading: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, marginBottom: 16 },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  detail: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48 },
});
```

- [ ] **Step 2: Subject detail screen**

```typescript
// app/subject/[id].tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { getSubjectById } from '../../src/db/subjects';
import { getRecordsForSubject, upsertRecord } from '../../src/db/attendance';
import { getSettings } from '../../src/db/settings';
import { countFutureSlots } from '../../src/db/timetable';
import { predict } from '../../src/engine/predictionEngine';
import { VerdictChip } from '../../src/components/VerdictChip';
import { AttendanceBar } from '../../src/components/AttendanceBar';
import type { AttendanceRecord } from '../../src/types';

export default function SubjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];

  const subject = getSubjectById(id);
  const settings = getSettings();

  const reload = () => {
    if (!id) return;
    setRecords(getRecordsForSubject(id));
  };

  useFocusEffect(useCallback(() => {
    if (subject) navigation.setOptions({ title: subject.name });
    reload();
  }, [id]));

  if (!subject) return <View style={s.screen}><Text>Subject not found.</Text></View>;

  const futureSlotsCount = settings ? countFutureSlots(id, todayStr, settings.semester_end_date) : 0;
  const prediction = predict(subject, records, futureSlotsCount);

  const handleMark = (date: string, status: 'present' | 'absent') => {
    upsertRecord(id, date, status);
    reload();
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <AttendanceBar pct={prediction.currentPct} threshold={subject.threshold} label={subject.name} />
        <VerdictChip verdict={prediction.verdict} message={prediction.message} />
        <Text style={s.skips}>
          {prediction.safeSkips > 0
            ? `${prediction.safeSkips} safe skip${prediction.safeSkips !== 1 ? 's' : ''} remaining`
            : 'No safe skips left'}
        </Text>
      </View>

      <Text style={s.sectionLabel}>HISTORY</Text>
      <FlatList
        data={records}
        keyExtractor={r => r.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={s.record}>
            <Text style={s.date}>{item.date}</Text>
            <View style={s.recordActions}>
              <TouchableOpacity
                style={[s.statusBtn, item.status === 'present' && s.statusPresent]}
                onPress={() => handleMark(item.date, 'present')}
              >
                <Text style={s.statusText}>P</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.statusBtn, item.status === 'absent' && s.statusAbsent]}
                onPress={() => handleMark(item.date, 'absent')}
              >
                <Text style={s.statusText}>A</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No records yet. Mark attendance from the home screen.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#fff', padding: 16, marginBottom: 8 },
  skips: { marginTop: 8, fontSize: 14, color: '#6b7280' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 4 },
  list: { padding: 16 },
  record: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 6 },
  date: { fontSize: 14 },
  recordActions: { flexDirection: 'row', gap: 8 },
  statusBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  statusPresent: { backgroundColor: '#dcfce7' },
  statusAbsent: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 24, fontSize: 14 },
});
```

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/attendance.tsx app/subject/
git commit -m "feat: attendance screen and subject detail with history"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npx jest
```

Expected: 6 tests pass (predictionEngine.test.ts). 0 failures.

- [ ] **Step 2: Start dev server and verify golden path**

```bash
npx expo start
```

Open on device or simulator. Verify:
1. First launch → redirected to onboarding
2. Set semester end date → tap Next
3. Add 2+ subjects → tap Next
4. Add at least 2 timetable slots → tap Next
5. Done screen → tap "Go to Dashboard"
6. Home screen shows today's classes
7. Tap "Present" on a class → card updates to "Marked present"
8. Switch to Attendance tab → shows subjects with % bars
9. Tap a subject → shows detail with VerdictChip
10. Switch to Timetable tab → shows weekly grid, can add/delete slots

- [ ] **Step 3: Verify notifications (requires real device)**

After completing onboarding, run:
```bash
npx expo start --dev-client
```

On device: open app, complete onboarding. Verify in device notification settings that StudentOS has a scheduled daily notification. (Cannot test on simulator — notifications require physical device or Expo Go on device.)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete StudentOS MVP — attendance tracker with prediction engine"
```
