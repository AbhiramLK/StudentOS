# StudentOS V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **UI/UX note:** Before implementing any frontend screen or component, invoke the `ui-ux-pro-max:ui-ux-pro-max` skill for design guidance. This is mandatory for every screen task.

**Goal:** Full rewrite of StudentOS as a cloud-first campus app — attendance, timetable, feed, wall, notes, mess, gym, AI suggestions, and messaging — all powered by Supabase.

**Architecture:** React Native (Expo) + Supabase (Auth, Postgres, Realtime, Storage). All data in Supabase — no SQLite. Two Supabase Edge Functions: `ai-suggest` (Gemini Flash proxy) and `mess-admin` (admin writes). No offline mode.

**Tech Stack:** Expo SDK 55, Expo Router, Supabase JS v2, Zustand, expo-notifications, expo-document-picker, @react-native-async-storage/async-storage

---

## File Map

```
src/
  lib/supabase.ts              — Supabase client singleton
  types/index.ts               — all shared TypeScript types
  db/
    profiles.ts                — profile queries
    subjects.ts                — subject CRUD
    timetable.ts               — slot + user_timetable queries
    attendance.ts              — attendance record CRUD
    calendar.ts                — academic calendar queries
    feed.ts                    — feed post CRUD
    wall.ts                    — wall entry CRUD
    notes.ts                   — notes CRUD + Storage upload
    mess.ts                    — mess + menu queries
    gym.ts                     — gym session CRUD
    messages.ts                — conversations + message CRUD
  engine/
    predictionEngine.ts        — predict() pure function
    predictionEngine.test.ts   — 6 unit tests
    notifications.ts           — daily notification scheduler
  stores/
    authStore.ts               — session + profile state
    subjectsStore.ts           — subjects list
    timetableStore.ts          — user timetable entries
  components/
    VerdictChip.tsx
    AttendanceBar.tsx
    ClassCard.tsx
    FeedCard.tsx
    WallCard.tsx
    NoteCard.tsx
    MealRow.tsx
    GymSessionCard.tsx
    SuggestionCard.tsx
    MessageBubble.tsx

app/
  _layout.tsx                  — root auth gate
  (auth)/login.tsx
  (auth)/verify.tsx
  onboarding/_layout.tsx
  onboarding/subjects.tsx
  onboarding/timetable.tsx
  onboarding/mess.tsx
  onboarding/done.tsx
  (tabs)/_layout.tsx           — 2-tab bar (Home | All)
  (tabs)/index.tsx             — Home dashboard
  (tabs)/all.tsx               — 3×3 grid launcher
  attendance/index.tsx
  attendance/[subjectId].tsx
  timetable/index.tsx
  feed/index.tsx
  wall/index.tsx
  notes/index.tsx
  mess/index.tsx
  gym/index.tsx
  ai/index.tsx
  messages/index.tsx
  messages/[conversationId].tsx
  settings/index.tsx

supabase/
  migrations/001_initial_schema.sql
  functions/
    ai-suggest/index.ts
    mess-admin/index.ts
```

---

## Task 1: Project Reset + Dependencies

**Files:**
- Delete: `src/db/` (V1 SQLite modules), `src/stores/` (V1 stores)
- Modify: `package.json`
- Create: `.env.local`

- [ ] **Step 1: Remove V1 source files**

```bash
cd /d/StudentOS
rm -rf src/db src/stores src/engine src/components src/types.ts
rm -rf app/\(tabs\) app/onboarding app/subject app/_layout.tsx app/modal.tsx
```

- [ ] **Step 2: Install new dependencies**

```bash
npm install @supabase/supabase-js
npx expo install @react-native-async-storage/async-storage expo-document-picker expo-file-system
npm uninstall expo-sqlite expo-crypto
```

Expected: no errors. `package.json` now has `@supabase/supabase-js` and `@react-native-async-storage/async-storage`.

- [ ] **Step 3: Create .env.local with Supabase credentials**

Create `.env.local` at project root (fill in your actual values from Supabase dashboard → Project Settings → API):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 4: Add .env.local to .gitignore**

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 5: Recreate empty src directories**

```bash
mkdir -p src/lib src/types src/db src/engine src/stores src/components
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: reset V1 source, install Supabase dependencies"
```

---

## Task 2: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create supabase directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Write migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── ADMIN-MANAGED TABLES ─────────────────────────────────────────────────

create table public.messes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cycle_start_date date not null,
  cycle_length int not null
);

create table public.timetable_slots (
  id uuid primary key default uuid_generate_v4(),
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_number int not null
);

create table public.academic_calendar (
  id uuid primary key default uuid_generate_v4(),
  date date not null unique,
  type text not null check (type in ('holiday', 'day_change', 'event')),
  description text,
  substitute_day int check (substitute_day between 0 and 6)
);

create table public.mess_menus (
  id uuid primary key default uuid_generate_v4(),
  mess_id uuid not null references public.messes(id) on delete cascade,
  day_cycle int not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'evening', 'dinner')),
  items text[] not null default '{}'
);

-- ─── USER TABLES ──────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  roll_number text,
  mess_id uuid references public.messes(id),
  semester_end_date date,
  is_admin boolean not null default false
);

create table public.subjects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_pct int not null default 75
);

create table public.user_timetable (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot_id uuid not null references public.timetable_slots(id) on delete cascade,
  subject_name text not null,
  unique(user_id, slot_id)
);

create table public.attendance_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent')),
  unique(user_id, subject_id, date)
);

create table public.gym_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  start_time time not null,
  duration_min int not null,
  notes text
);

-- ─── SOCIAL TABLES ────────────────────────────────────────────────────────

create table public.feed_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  location text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.wall_entries (
  id uuid primary key default uuid_generate_v4(),
  content text not null check (char_length(content) <= 280),
  color text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_name text not null,
  semester text not null,
  title text not null,
  file_path text not null,
  download_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  last_message_id uuid,
  updated_at timestamptz not null default now(),
  unique(user_a, user_b)
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.user_timetable enable row level security;
alter table public.attendance_records enable row level security;
alter table public.gym_sessions enable row level security;
alter table public.feed_posts enable row level security;
alter table public.wall_entries enable row level security;
alter table public.notes enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.messes enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.academic_calendar enable row level security;
alter table public.mess_menus enable row level security;

-- Admin tables: public read
create policy "public read messes" on public.messes for select using (true);
create policy "public read timetable_slots" on public.timetable_slots for select using (true);
create policy "public read academic_calendar" on public.academic_calendar for select using (true);
create policy "public read mess_menus" on public.mess_menus for select using (true);

-- User tables: own data only
create policy "own profile" on public.profiles for all using (auth.uid() = id);
create policy "own subjects" on public.subjects for all using (auth.uid() = user_id);
create policy "own timetable" on public.user_timetable for all using (auth.uid() = user_id);
create policy "own attendance" on public.attendance_records for all using (auth.uid() = user_id);
create policy "own gym" on public.gym_sessions for all using (auth.uid() = user_id);

-- Feed: authenticated read, owner insert/delete
create policy "auth read feed" on public.feed_posts for select using (auth.role() = 'authenticated');
create policy "own feed insert" on public.feed_posts for insert with check (auth.uid() = user_id);
create policy "own feed delete" on public.feed_posts for delete using (auth.uid() = user_id);

-- Wall: public read/insert, no ownership
create policy "public read wall" on public.wall_entries for select using (true);
create policy "anyone insert wall" on public.wall_entries for insert with check (true);

-- Notes: authenticated read, owner insert
create policy "auth read notes" on public.notes for select using (auth.role() = 'authenticated');
create policy "own notes insert" on public.notes for insert with check (auth.uid() = user_id);

-- Messages: participants only
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_a or auth.uid() = user_b);
create policy "own messages" on public.messages
  for all using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- ─── STORAGE BUCKET ───────────────────────────────────────────────────────

-- Run in Supabase Dashboard → Storage → New bucket:
-- Name: "notes", Public: false
-- Then add policy: authenticated users can upload (INSERT), all authenticated can read (SELECT)
```

- [ ] **Step 3: Apply migration in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run the entire migration file.

Expected: All 14 tables created, RLS enabled, policies applied.

- [ ] **Step 4: Enable Realtime on social tables**

Supabase Dashboard → Database → Replication → enable `feed_posts`, `wall_entries`, `messages`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase schema migration with 14 tables and RLS"
```

---

## Task 3: TypeScript Types + Supabase Client

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Write shared types**

Create `src/types/index.ts`:

```typescript
export type AttendanceStatus = 'present' | 'absent';
export type Verdict = 'safe' | 'warning' | 'danger';
export type MealType = 'breakfast' | 'lunch' | 'evening' | 'dinner';
export type CalendarEventType = 'holiday' | 'day_change' | 'event';

export interface Profile {
  id: string;
  email: string;
  name: string;
  roll_number: string | null;
  mess_id: string | null;
  semester_end_date: string | null;
  is_admin: boolean;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  target_pct: number;
}

export interface TimetableSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_number: number;
}

export interface UserTimetableEntry {
  id: string;
  user_id: string;
  slot_id: string;
  subject_name: string;
  slot?: TimetableSlot;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  subject_id: string;
  date: string;
  status: AttendanceStatus;
}

export interface AcademicCalendarEntry {
  id: string;
  date: string;
  type: CalendarEventType;
  description: string | null;
  substitute_day: number | null;
}

export interface Mess {
  id: string;
  name: string;
  cycle_start_date: string;
  cycle_length: number;
}

export interface MessMenu {
  id: string;
  mess_id: string;
  day_cycle: number;
  meal: MealType;
  items: string[];
}

export interface FeedPost {
  id: string;
  user_id: string;
  title: string;
  body: string;
  location: string | null;
  expires_at: string;
  created_at: string;
  author_name?: string;
}

export interface WallEntry {
  id: string;
  content: string;
  color: string;
  created_at: string;
  expires_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  subject_name: string;
  semester: string;
  title: string;
  file_path: string;
  download_count: number;
  created_at: string;
}

export interface GymSession {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  duration_min: number;
  notes: string | null;
}

export interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  last_message_id: string | null;
  updated_at: string;
  other_user?: Profile;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export interface PredictionResult {
  pct: number;
  verdict: Verdict;
  safeSkips: number;
  classesNeeded: number;
}

export interface AISuggestion {
  icon: string;
  title: string;
  body: string;
}
```

- [ ] **Step 2: Write Supabase client**

Create `src/lib/supabase.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

- [ ] **Step 3: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit
```

Expected: 0 errors (only the two new files, no app files yet).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/supabase.ts
git commit -m "feat: add shared TypeScript types and Supabase client"
```

---

## Task 4: Auth Store + Root Layout + Login + Verify Screens

> **UI/UX:** Invoke `ui-ux-pro-max:ui-ux-pro-max` before implementing login and verify screens.

**Files:**
- Create: `src/stores/authStore.ts`
- Create: `src/db/profiles.ts`
- Create: `app/_layout.tsx`
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/verify.tsx`

- [ ] **Step 1: Write auth store**

Create `src/stores/authStore.ts`:

```typescript
import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));
```

- [ ] **Step 2: Write profiles DB helper**

Create `src/db/profiles.ts`:

```typescript
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function createProfile(
  profile: Omit<Profile, 'is_admin'>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ ...profile, is_admin: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'email' | 'is_admin'>>
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(20);
  return data ?? [];
}
```

- [ ] **Step 3: Write root layout (auth gate)**

Create `app/_layout.tsx`:

```typescript
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { getProfile } from '../src/db/profiles';

export default function RootLayout() {
  const { setSession, setProfile } = useAuthStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (!session) {
          setProfile(null);
          router.replace('/(auth)/login');
          return;
        }
        const profile = await getProfile(session.user.id);
        setProfile(profile);
        if (!profile) {
          router.replace('/onboarding/subjects');
        } else if (!profile.mess_id) {
          router.replace('/onboarding/mess');
        } else {
          router.replace('/(tabs)');
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="timetable" />
      <Stack.Screen name="feed" />
      <Stack.Screen name="wall" />
      <Stack.Screen name="notes" />
      <Stack.Screen name="mess" />
      <Stack.Screen name="gym" />
      <Stack.Screen name="ai" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
```

- [ ] **Step 4: Write (auth) layout**

Create `app/(auth)/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 5: Write login screen**

Create `app/(auth)/login.tsx`:

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!email.toLowerCase().endsWith('@nitc.ac.in')) {
      Alert.alert('Invalid email', 'Use your @nitc.ac.in college email.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter your full name.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
    });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    router.push({
      pathname: '/(auth)/verify',
      params: { email: email.toLowerCase(), name: name.trim(), roll: roll.trim() },
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Student OS</Text>
      <Text style={styles.subtitle}>Sign in with your NITC email</Text>
      <TextInput
        style={styles.input} placeholder="name@nitc.ac.in"
        placeholderTextColor="#8a8f98" value={email}
        onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
      />
      <TextInput
        style={styles.input} placeholder="Full name"
        placeholderTextColor="#8a8f98" value={name}
        onChangeText={setName} autoCapitalize="words"
      />
      <TextInput
        style={styles.input} placeholder="Roll number (optional)"
        placeholderTextColor="#8a8f98" value={roll}
        onChangeText={setRoll} autoCapitalize="characters"
      />
      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.6 }]}
        onPress={handleContinue} disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Sending…' : 'Continue'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#eaeaea', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8a8f98', marginBottom: 40 },
  input: {
    backgroundColor: '#111217', borderRadius: 12,
    padding: 14, color: '#eaeaea', fontSize: 15, marginBottom: 12,
  },
  btn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});
```

- [ ] **Step 6: Write verify screen**

Create `app/(auth)/verify.tsx`:

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getProfile, createProfile } from '../../src/db/profiles';
import { useAuthStore } from '../../src/stores/authStore';

export default function VerifyScreen() {
  const { email, name, roll } = useLocalSearchParams<{
    email: string; name: string; roll: string;
  }>();
  const { setProfile } = useAuthStore();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (token.length !== 6) { Alert.alert('Enter the 6-digit code.'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) { setLoading(false); Alert.alert('Invalid code', error.message); return; }
    const userId = data.user!.id;
    let profile = await getProfile(userId);
    if (!profile) {
      profile = await createProfile({
        id: userId, email, name,
        roll_number: roll || null, mess_id: null, semester_end_date: null,
      });
      setProfile(profile);
      setLoading(false);
      router.replace('/onboarding/subjects');
    } else if (!profile.mess_id) {
      setProfile(profile); setLoading(false);
      router.replace('/onboarding/mess');
    } else {
      setProfile(profile); setLoading(false);
      router.replace('/(tabs)');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>6-digit code sent to {email}</Text>
      <TextInput
        style={styles.input} placeholder="000000"
        placeholderTextColor="#8a8f98" value={token}
        onChangeText={setToken} keyboardType="number-pad" maxLength={6} autoFocus
      />
      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.6 }]}
        onPress={handleVerify} disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, alignItems: 'center' }}>
        <Text style={{ color: '#8a8f98' }}>← Back</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#eaeaea', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#8a8f98', marginBottom: 40 },
  input: {
    backgroundColor: '#111217', borderRadius: 12, padding: 14,
    color: '#eaeaea', fontSize: 28, letterSpacing: 14, textAlign: 'center', marginBottom: 12,
  },
  btn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/stores/authStore.ts src/db/profiles.ts app/_layout.tsx app/\(auth\)/
git commit -m "feat: auth store, root layout auth gate, login and verify screens"
```

---

## Task 5: Onboarding Flow

> **UI/UX:** Invoke `ui-ux-pro-max:ui-ux-pro-max` before implementing onboarding screens.

**Files:**
- Create: `src/db/subjects.ts`
- Create: `src/db/timetable.ts`
- Create: `app/onboarding/_layout.tsx`
- Create: `app/onboarding/subjects.tsx`
- Create: `app/onboarding/timetable.tsx`
- Create: `app/onboarding/mess.tsx`
- Create: `app/onboarding/done.tsx`

- [ ] **Step 1: Write subjects DB helper**

Create `src/db/subjects.ts`:

```typescript
import { supabase } from '../lib/supabase';
import type { Subject } from '../types';

export async function getSubjects(userId: string): Promise<Subject[]> {
  const { data } = await supabase
    .from('subjects').select('*').eq('user_id', userId).order('name');
  return data ?? [];
}

export async function createSubject(
  userId: string, name: string, targetPct: number
): Promise<Subject> {
  const { data, error } = await supabase
    .from('subjects')
    .insert({ user_id: userId, name, target_pct: targetPct })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Write timetable DB helper**

Create `src/db/timetable.ts`:

```typescript
import { supabase } from '../lib/supabase';
import type { TimetableSlot, UserTimetableEntry } from '../types';

export async function getAllSlots(): Promise<TimetableSlot[]> {
  const { data } = await supabase
    .from('timetable_slots').select('*')
    .order('day_of_week').order('slot_number');
  return data ?? [];
}

export async function getUserTimetable(userId: string): Promise<UserTimetableEntry[]> {
  const { data } = await supabase
    .from('user_timetable')
    .select('*, slot:timetable_slots(*)')
    .eq('user_id', userId);
  return data ?? [];
}

export async function upsertUserTimetableEntry(
  userId: string, slotId: string, subjectName: string
): Promise<void> {
  const { error } = await supabase
    .from('user_timetable')
    .upsert(
      { user_id: userId, slot_id: slotId, subject_name: subjectName },
      { onConflict: 'user_id,slot_id' }
    );
  if (error) throw error;
}

export async function deleteUserTimetableEntry(
  userId: string, slotId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_timetable')
    .delete().eq('user_id', userId).eq('slot_id', slotId);
  if (error) throw error;
}

export async function getSlotsForEffectiveDay(
  userId: string, dayOfWeek: number
): Promise<UserTimetableEntry[]> {
  const { data } = await supabase
    .from('user_timetable')
    .select('*, slot:timetable_slots(*)')
    .eq('user_id', userId)
    .eq('slot.day_of_week', dayOfWeek);
  return (data ?? []).filter((e) => e.slot !== null);
}
```

- [ ] **Step 3: Write onboarding layout**

Create `app/onboarding/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 4: Write subjects onboarding screen**

Create `app/onboarding/subjects.tsx`:

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { createSubject } from '../../src/db/subjects';
import type { Subject } from '../../src/types';

export default function OnboardingSubjects() {
  const { profile } = useAuthStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState('');
  const [targetPct, setTargetPct] = useState('75');
  const [loading, setLoading] = useState(false);

  async function addSubject() {
    if (!name.trim()) return;
    const pct = parseInt(targetPct, 10);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      Alert.alert('Invalid target', 'Enter a percentage between 1 and 100.');
      return;
    }
    setLoading(true);
    const subject = await createSubject(profile!.id, name.trim(), pct);
    setSubjects((prev) => [...prev, subject]);
    setName(''); setTargetPct('75');
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Subjects</Text>
      <Text style={styles.subtitle}>Add subjects you are enrolled in this semester</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Subject name" placeholderTextColor="#8a8f98"
          value={name} onChangeText={setName}
        />
        <TextInput
          style={[styles.input, { width: 60, marginLeft: 8, textAlign: 'center' }]}
          placeholder="75" placeholderTextColor="#8a8f98"
          value={targetPct} onChangeText={setTargetPct}
          keyboardType="number-pad" maxLength={3}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addSubject} disabled={loading}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={subjects} keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={styles.subjectRow}>
            <Text style={styles.subjectName}>{item.name}</Text>
            <Text style={styles.subjectPct}>{item.target_pct}%</Text>
          </View>
        )}
        style={{ flex: 1, marginTop: 16 }}
      />
      <TouchableOpacity
        style={styles.nextBtn}
        onPress={() => subjects.length === 0
          ? Alert.alert('Add at least one subject.')
          : router.push('/onboarding/timetable')
        }
      >
        <Text style={styles.nextBtnText}>Next →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#eaeaea', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8a8f98', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { backgroundColor: '#111217', borderRadius: 10, padding: 12, color: '#eaeaea', fontSize: 14 },
  addBtn: {
    backgroundColor: '#66fcf1', borderRadius: 10,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  addBtnText: { color: '#0b0c10', fontSize: 22, fontWeight: '700' },
  subjectRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#111217', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  subjectName: { color: '#eaeaea', fontSize: 14 },
  subjectPct: { color: '#66fcf1', fontSize: 14 },
  nextBtn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 12 },
  nextBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});
```

- [ ] **Step 5: Write timetable onboarding screen**

Create `app/onboarding/timetable.tsx`:

```typescript
import { useEffect, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  TextInput, StyleSheet, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { getAllSlots, upsertUserTimetableEntry } from '../../src/db/timetable';
import type { TimetableSlot } from '../../src/types';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function OnboardingTimetable() {
  const { profile } = useAuthStore();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [filled, setFilled] = useState<Record<string, string>>({});
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => { getAllSlots().then(setSlots); }, []);

  const sections = DAY_NAMES
    .map((day, i) => ({ title: day, data: slots.filter((s) => s.day_of_week === i) }))
    .filter((s) => s.data.length > 0);

  async function saveEdit() {
    if (!editingSlot) return;
    const val = inputValue.trim();
    if (val) {
      await upsertUserTimetableEntry(profile!.id, editingSlot.id, val);
      setFilled((prev) => ({ ...prev, [editingSlot.id]: val }));
    }
    setEditingSlot(null);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Timetable</Text>
      <Text style={styles.subtitle}>Tap a slot to enter your subject</Text>
      <SectionList
        sections={sections} keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.dayHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.slotRow}
            onPress={() => { setEditingSlot(item); setInputValue(filled[item.id] ?? ''); }}
          >
            <Text style={styles.slotTime}>
              {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
            </Text>
            <Text style={filled[item.id] ? styles.slotFilled : styles.slotEmpty}>
              {filled[item.id] ?? '+ Add subject'}
            </Text>
          </TouchableOpacity>
        )}
        style={{ flex: 1, marginTop: 8 }}
      />
      <TouchableOpacity style={styles.nextBtn} onPress={() => router.push('/onboarding/mess')}>
        <Text style={styles.nextBtnText}>Next →</Text>
      </TouchableOpacity>
      <Modal visible={!!editingSlot} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingSlot?.start_time.slice(0, 5)}–{editingSlot?.end_time.slice(0, 5)}
            </Text>
            <TextInput
              style={styles.modalInput} placeholder="Subject name"
              placeholderTextColor="#8a8f98" value={inputValue}
              onChangeText={setInputValue} autoFocus
            />
            <TouchableOpacity style={styles.nextBtn} onPress={saveEdit}>
              <Text style={styles.nextBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditingSlot(null)}
              style={{ marginTop: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#8a8f98' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#eaeaea', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8a8f98', marginBottom: 12 },
  dayHeader: { color: '#8a8f98', fontSize: 12, marginTop: 16, marginBottom: 4 },
  slotRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#111217', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  slotTime: { color: '#8a8f98', fontSize: 13 },
  slotFilled: { color: '#66fcf1', fontSize: 13 },
  slotEmpty: { color: '#444', fontSize: 13 },
  nextBtn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 12 },
  nextBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111217', borderRadius: 20, padding: 24, margin: 16 },
  modalTitle: { color: '#8a8f98', fontSize: 13, marginBottom: 12 },
  modalInput: {
    backgroundColor: '#0b0c10', borderRadius: 10,
    padding: 12, color: '#eaeaea', fontSize: 15, marginBottom: 12,
  },
});
```

- [ ] **Step 6: Write mess selection screen**

Create `app/onboarding/mess.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { updateProfile } from '../../src/db/profiles';
import { useAuthStore } from '../../src/stores/authStore';
import type { Mess } from '../../src/types';

export default function OnboardingMess() {
  const { profile, setProfile } = useAuthStore();
  const [messes, setMesses] = useState<Mess[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('messes').select('*').order('name').then(({ data }) => setMesses(data ?? []));
  }, []);

  async function handleNext() {
    if (!selected) { Alert.alert('Select your mess first.'); return; }
    setLoading(true);
    await updateProfile(profile!.id, { mess_id: selected });
    setProfile({ ...profile!, mess_id: selected });
    setLoading(false);
    router.replace('/onboarding/done');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Mess</Text>
      <Text style={styles.subtitle}>Select the mess you are registered at</Text>
      <FlatList
        data={messes} keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.messRow, selected === item.id && styles.messRowSelected]}
            onPress={() => setSelected(item.id)}
          >
            <Text style={styles.messName}>{item.name}</Text>
            {selected === item.id && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        )}
        style={{ flex: 1, marginTop: 12 }}
      />
      <TouchableOpacity
        style={[styles.nextBtn, loading && { opacity: 0.6 }]}
        onPress={handleNext} disabled={loading}
      >
        <Text style={styles.nextBtnText}>{loading ? 'Saving…' : 'Done →'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#eaeaea', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8a8f98', marginBottom: 12 },
  messRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111217', borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'transparent',
  },
  messRowSelected: { borderColor: '#66fcf1' },
  messName: { color: '#eaeaea', fontSize: 15 },
  check: { color: '#66fcf1', fontSize: 16, fontWeight: '700' },
  nextBtn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 12 },
  nextBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});
```

- [ ] **Step 7: Write done screen**

Create `app/onboarding/done.tsx`:

```typescript
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function OnboardingDone() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/(tabs)'), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.title}>You are all set</Text>
      <Text style={styles.subtitle}>Taking you to your dashboard…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 56, color: '#66fcf1', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#eaeaea', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#8a8f98' },
});
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/db/subjects.ts src/db/timetable.ts app/onboarding/
git commit -m "feat: onboarding flow — subjects, timetable, mess selection, done"
```
