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

---

### Task 6: Remaining DB helpers

**Files:**
- Create: `src/db/attendance.ts`
- Create: `src/db/calendar.ts`
- Create: `src/db/feed.ts`
- Create: `src/db/wall.ts`
- Create: `src/db/notes.ts`
- Create: `src/db/mess.ts`
- Create: `src/db/gym.ts`
- Create: `src/db/messages.ts`

- [ ] **Step 1: Create `src/db/attendance.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { AttendanceRecord, AttendanceStatus } from '../types';

export async function getAttendanceRecords(userId: string, subjectId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data as AttendanceRecord[];
}

export async function getAllAttendanceRecords(userId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data as AttendanceRecord[];
}

export async function upsertAttendance(
  userId: string,
  subjectId: string,
  date: string,
  status: AttendanceStatus,
): Promise<void> {
  const { error } = await supabase.from('attendance_records').upsert(
    { user_id: userId, subject_id: subjectId, date, status },
    { onConflict: 'user_id,subject_id,date' },
  );
  if (error) throw error;
}
```

- [ ] **Step 2: Create `src/db/calendar.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { AcademicCalendarEntry } from '../types';

export async function getCalendarEntries(): Promise<AcademicCalendarEntry[]> {
  const { data, error } = await supabase
    .from('academic_calendar')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  return data as AcademicCalendarEntry[];
}

export async function getCalendarEntryForDate(date: string): Promise<AcademicCalendarEntry | null> {
  const { data, error } = await supabase
    .from('academic_calendar')
    .select('*')
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data as AcademicCalendarEntry | null;
}
```

- [ ] **Step 3: Create `src/db/feed.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { FeedPost } from '../types';

export async function getFeedPosts(): Promise<FeedPost[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*, profiles(name)')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as FeedPost[];
}

export async function createFeedPost(
  userId: string,
  title: string,
  body: string,
  location: string | null,
  expiresAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('feed_posts')
    .insert({ user_id: userId, title, body, location, expires_at: expiresAt });
  if (error) throw error;
}
```

- [ ] **Step 4: Create `src/db/wall.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { WallEntry } from '../types';

export async function getWallEntries(): Promise<WallEntry[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('wall_entries')
    .select('*')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as WallEntry[];
}

export async function createWallEntry(content: string, color: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('wall_entries')
    .insert({ content, color, expires_at: expiresAt });
  if (error) throw error;
}
```

- [ ] **Step 5: Create `src/db/notes.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { Note } from '../types';

export async function getNotesBySubject(subjectName: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('subject_name', subjectName)
    .order('download_count', { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function getNotesBySemester(semester: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('semester', semester)
    .order('download_count', { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function uploadNote(
  userId: string,
  subjectName: string,
  semester: string,
  title: string,
  filePath: string,
): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .insert({ user_id: userId, subject_name: subjectName, semester, title, file_path: filePath, download_count: 0 });
  if (error) throw error;
}

export async function incrementDownloadCount(noteId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_download_count', { note_id: noteId });
  if (error) throw error;
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('notes')
    .createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 6: Create `src/db/mess.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { Mess, MessMenu } from '../types';

export async function getMesses(): Promise<Mess[]> {
  const { data, error } = await supabase.from('messes').select('*').order('name');
  if (error) throw error;
  return data as Mess[];
}

export async function getMessMenuForDay(messId: string, dayCycle: number): Promise<MessMenu[]> {
  const { data, error } = await supabase
    .from('mess_menus')
    .select('*')
    .eq('mess_id', messId)
    .eq('day_cycle', dayCycle)
    .order('meal');
  if (error) throw error;
  return data as MessMenu[];
}

export function computeDayCycle(cycleStartDate: string, cycleLength: number): number {
  const start = new Date(cycleStartDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return (diffDays % cycleLength) + 1;
}
```

- [ ] **Step 7: Create `src/db/gym.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { GymSession } from '../types';

export async function getGymSessions(userId: string, weekStart: string, weekEnd: string): Promise<GymSession[]> {
  const { data, error } = await supabase
    .from('gym_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: true });
  if (error) throw error;
  return data as GymSession[];
}

export async function logGymSession(
  userId: string,
  date: string,
  startTime: string,
  durationMin: number,
  notes: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('gym_sessions')
    .insert({ user_id: userId, date, start_time: startTime, duration_min: durationMin, notes });
  if (error) throw error;
}
```

- [ ] **Step 8: Create `src/db/messages.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { Conversation, Message } from '../types';

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, user_a_profile:profiles!user_a(id,name), user_b_profile:profiles!user_b(id,name), last_message:messages!last_message_id(content,created_at)')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Conversation[];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${conversationId},receiver_id.eq.${conversationId}`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Message[];
}

export async function getMessagesByConversation(userId: string, otherUserId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`,
    )
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(senderId: string, receiverId: string, content: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markMessagesRead(senderId: string, receiverId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .is('read_at', null);
  if (error) throw error;
}

export async function searchProfiles(query: string): Promise<{ id: string; name: string; roll_number: string }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, roll_number')
    .ilike('name', `%${query}%`)
    .limit(10);
  if (error) throw error;
  return data as { id: string; name: string; roll_number: string }[];
}

export async function getOrCreateConversation(userA: string, userB: string): Promise<string> {
  const { data: existing, error: fetchError } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(user_a.eq.${userA},user_b.eq.${userB}),and(user_a.eq.${userB},user_b.eq.${userA})`,
    )
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_a: userA, user_b: userB })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
```

- [ ] **Step 9: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/db/attendance.ts src/db/calendar.ts src/db/feed.ts src/db/wall.ts src/db/notes.ts src/db/mess.ts src/db/gym.ts src/db/messages.ts
git commit -m "feat: all DB query helpers"
```

---

### Task 7: Prediction Engine (TDD)

**Files:**
- Create: `src/engine/predictionEngine.test.ts`
- Create: `src/engine/predictionEngine.ts`

The prediction engine determines whether a student is safe to skip a class without dropping below their target attendance percentage. It also projects the minimum classes they must attend to recover if already below target.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/predictionEngine.test.ts`:

```typescript
import {
  computeAttendancePct,
  canSkip,
  classesToRecover,
  verdictForSubject,
} from './predictionEngine';

const BASE = { present: 80, total: 100, target: 75 };

describe('computeAttendancePct', () => {
  it('returns 0 when total is 0', () => {
    expect(computeAttendancePct(0, 0)).toBe(0);
  });
  it('rounds to 1 decimal place', () => {
    expect(computeAttendancePct(2, 3)).toBe(66.7);
  });
  it('returns 100 when all present', () => {
    expect(computeAttendancePct(10, 10)).toBe(100);
  });
});

describe('canSkip', () => {
  it('returns true when skipping keeps pct at or above target', () => {
    // 80/100 = 80%, target 75%. Skipping: 80/101 = 79.2% — still safe
    expect(canSkip(80, 100, 75)).toBe(true);
  });
  it('returns false when skipping drops below target', () => {
    // 75/100 = 75%, target 75%. Skipping: 75/101 = 74.3% — not safe
    expect(canSkip(75, 100, 75)).toBe(false);
  });
  it('returns false when already below target', () => {
    expect(canSkip(70, 100, 75)).toBe(false);
  });
});

describe('classesToRecover', () => {
  it('returns 0 when already at or above target', () => {
    expect(classesToRecover(80, 100, 75)).toBe(0);
  });
  it('returns correct number of consecutive classes needed', () => {
    // 70/100 = 70%, target 75%. Need to attend N in a row:
    // (70+N)/(100+N) >= 0.75 → N >= 20
    expect(classesToRecover(70, 100, 75)).toBe(20);
  });
  it('caps at 100 to prevent infinite loops', () => {
    expect(classesToRecover(0, 0, 75)).toBeLessThanOrEqual(100);
  });
});

describe('verdictForSubject', () => {
  it('returns safe when well above target', () => {
    expect(verdictForSubject(85, 100, 75)).toBe('safe');
  });
  it('returns warning when within 5% of threshold', () => {
    // 76/100 = 76%, target 75% — can skip once but barely
    expect(verdictForSubject(76, 100, 75)).toBe('warning');
  });
  it('returns danger when below target', () => {
    expect(verdictForSubject(70, 100, 75)).toBe('danger');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/engine/predictionEngine.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module './predictionEngine'"

- [ ] **Step 3: Implement the prediction engine**

Create `src/engine/predictionEngine.ts`:

```typescript
export type Verdict = 'safe' | 'warning' | 'danger';

export function computeAttendancePct(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 1000) / 10;
}

export function canSkip(present: number, total: number, targetPct: number): boolean {
  const afterSkip = present / (total + 1);
  return afterSkip * 100 >= targetPct;
}

export function classesToRecover(present: number, total: number, targetPct: number): number {
  const target = targetPct / 100;
  if (present / Math.max(total, 1) >= target) return 0;
  let n = 0;
  while (n < 100) {
    n++;
    if ((present + n) / (total + n) >= target) return n;
  }
  return n;
}

export function verdictForSubject(present: number, total: number, targetPct: number): Verdict {
  const pct = computeAttendancePct(present, total);
  if (pct < targetPct) return 'danger';
  // Warning: currently safe but skipping once would drop below
  if (!canSkip(present, total, targetPct)) return 'warning';
  // Warning: within 5 percentage points of threshold
  if (pct < targetPct + 5) return 'warning';
  return 'safe';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/engine/predictionEngine.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS — 10 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/engine/predictionEngine.ts src/engine/predictionEngine.test.ts
git commit -m "feat: prediction engine with TDD — canSkip, classesToRecover, verdict"
```

---

### Task 8: Zustand Stores

**Files:**
- Create: `src/stores/subjectsStore.ts`
- Create: `src/stores/timetableStore.ts`

These stores cache Supabase data in memory so screens don't re-fetch on every render. `authStore` already exists (Task 4).

- [ ] **Step 1: Create `src/stores/subjectsStore.ts`**

```typescript
import { create } from 'zustand';
import type { Subject, AttendanceRecord } from '../types';
import { getSubjects } from '../db/subjects';
import { getAllAttendanceRecords } from '../db/attendance';

interface SubjectsState {
  subjects: Subject[];
  records: AttendanceRecord[];
  loading: boolean;
  fetch: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useSubjectsStore = create<SubjectsState>((set) => ({
  subjects: [],
  records: [],
  loading: false,
  fetch: async (userId) => {
    set({ loading: true });
    const [subjects, records] = await Promise.all([
      getSubjects(userId),
      getAllAttendanceRecords(userId),
    ]);
    set({ subjects, records, loading: false });
  },
  reset: () => set({ subjects: [], records: [], loading: false }),
}));
```

- [ ] **Step 2: Create `src/stores/timetableStore.ts`**

```typescript
import { create } from 'zustand';
import type { TimetableSlot, UserTimetableEntry, AcademicCalendarEntry } from '../types';
import { getTimetableSlots } from '../db/timetable';
import { getCalendarEntries } from '../db/calendar';

interface TimetableState {
  slots: TimetableSlot[];
  userEntries: UserTimetableEntry[];
  calendarEntries: AcademicCalendarEntry[];
  loading: boolean;
  fetch: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useTimetableStore = create<TimetableState>((set) => ({
  slots: [],
  userEntries: [],
  calendarEntries: [],
  loading: false,
  fetch: async (userId) => {
    set({ loading: true });
    const [slots, userEntries, calendarEntries] = await Promise.all([
      getTimetableSlots(),
      getUserTimetable(userId),
      getCalendarEntries(),
    ]);
    set({ slots, userEntries, calendarEntries, loading: false });
  },
  reset: () => set({ slots: [], userEntries: [], calendarEntries: [], loading: false }),
}));
```

- [ ] **Step 3: Add `getUserTimetable` import in timetableStore**

The function `getUserTimetable` must be imported from `src/db/timetable.ts`. Confirm that file exports it (it was written in Task 5). Update the import at the top of `src/stores/timetableStore.ts`:

```typescript
import { getTimetableSlots, getUserTimetable } from '../db/timetable';
```

Full file after the fix:

```typescript
import { create } from 'zustand';
import type { TimetableSlot, UserTimetableEntry, AcademicCalendarEntry } from '../types';
import { getTimetableSlots, getUserTimetable } from '../db/timetable';
import { getCalendarEntries } from '../db/calendar';

interface TimetableState {
  slots: TimetableSlot[];
  userEntries: UserTimetableEntry[];
  calendarEntries: AcademicCalendarEntry[];
  loading: boolean;
  fetch: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useTimetableStore = create<TimetableState>((set) => ({
  slots: [],
  userEntries: [],
  calendarEntries: [],
  loading: false,
  fetch: async (userId) => {
    set({ loading: true });
    const [slots, userEntries, calendarEntries] = await Promise.all([
      getTimetableSlots(),
      getUserTimetable(userId),
      getCalendarEntries(),
    ]);
    set({ slots, userEntries, calendarEntries, loading: false });
  },
  reset: () => set({ slots: [], userEntries: [], calendarEntries: [], loading: false }),
}));
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/subjectsStore.ts src/stores/timetableStore.ts
git commit -m "feat: subjectsStore and timetableStore with Zustand"
```

---

### Task 9: Shared UI Components

**Files:**
- Create: `src/components/VerdictChip.tsx`
- Create: `src/components/AttendanceBar.tsx`
- Create: `src/components/ClassCard.tsx`
- Create: `src/components/FeedCard.tsx`
- Create: `src/components/WallCard.tsx`
- Create: `src/components/NoteCard.tsx`
- Create: `src/components/MealRow.tsx`
- Create: `src/components/GymSessionCard.tsx`
- Create: `src/components/SuggestionCard.tsx`
- Create: `src/components/MessageBubble.tsx`

Design rules applied:
- `@expo/vector-icons` (Ionicons) for all icons — no emojis in functional UI
- All pressable elements ≥ 44pt touch target
- 8dp spacing rhythm throughout
- Semantic color tokens via local `C` constant matching the spec palette
- `accessibilityLabel` on all interactive elements

- [ ] **Step 1: Create `src/components/VerdictChip.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import type { Verdict } from '../engine/predictionEngine';

const COLORS: Record<Verdict, { bg: string; text: string }> = {
  safe: { bg: '#1a3a38', text: '#66fcf1' },
  warning: { bg: '#3a2e10', text: '#ffc857' },
  danger: { bg: '#3a1010', text: '#ff5c5c' },
};

interface Props {
  verdict: Verdict;
}

export default function VerdictChip({ verdict }: Props) {
  const c = COLORS[verdict];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.text }]}>{verdict}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
```

- [ ] **Step 2: Create `src/components/AttendanceBar.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  present: number;
  total: number;
  targetPct: number;
}

export default function AttendanceBar({ present, total, targetPct }: Props) {
  const pct = total === 0 ? 0 : Math.round((present / total) * 1000) / 10;
  const fill = total === 0 ? 0 : Math.min(pct / 100, 1);
  const color = pct >= targetPct ? '#66fcf1' : pct >= targetPct - 5 ? '#ffc857' : '#ff5c5c';

  return (
    <View style={styles.wrapper} accessibilityLabel={`Attendance ${pct} percent`}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.label, { color }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 4, backgroundColor: '#1e2028', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  label: { fontSize: 13, fontWeight: '600', minWidth: 40, textAlign: 'right' },
});
```

- [ ] **Step 3: Create `src/components/ClassCard.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import type { TimetableSlot } from '../types';

interface Props {
  slot: TimetableSlot;
  subjectName: string;
  present: number;
  total: number;
  targetPct: number;
}

export default function ClassCard({ slot, subjectName, present, total, targetPct }: Props) {
  const pct = total === 0 ? 0 : Math.round((present / total) * 1000) / 10;
  const color = pct >= targetPct ? '#66fcf1' : pct >= targetPct - 5 ? '#ffc857' : '#ff5c5c';
  const time = `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`;

  return (
    <View style={styles.row} accessibilityLabel={`${subjectName} at ${time}, attendance ${pct} percent`}>
      <View style={styles.left}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.subject} numberOfLines={1}>{subjectName}</Text>
      </View>
      <Text style={[styles.pct, { color }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#111217', borderRadius: 10, marginBottom: 8 },
  left: { flex: 1, gap: 2 },
  time: { fontSize: 11, color: '#8a8f98' },
  subject: { fontSize: 15, color: '#eaeaea', fontWeight: '500' },
  pct: { fontSize: 15, fontWeight: '700', marginLeft: 12 },
});
```

- [ ] **Step 4: Create `src/components/FeedCard.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FeedPost } from '../types';

interface Props {
  post: FeedPost;
}

function timeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h left` : `${m}m left`;
}

export default function FeedCard({ post }: Props) {
  return (
    <View style={styles.card} accessibilityLabel={`Feed post: ${post.title}`}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{timeRemaining(post.expires_at)}</Text>
        </View>
      </View>
      <Text style={styles.body} numberOfLines={4}>{post.body}</Text>
      <View style={styles.footer}>
        {post.location ? (
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={12} color="#8a8f98" />
            <Text style={styles.metaText}>{post.location}</Text>
          </View>
        ) : null}
        <Text style={styles.author}>{(post as any).profiles?.name ?? ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111217', borderRadius: 12, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: '#eaeaea' },
  badge: { backgroundColor: '#1e2028', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, color: '#8a8f98' },
  body: { fontSize: 13, color: '#8a8f98', lineHeight: 19, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#8a8f98' },
  author: { fontSize: 12, color: '#66fcf1' },
});
```

- [ ] **Step 5: Create `src/components/WallCard.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import type { WallEntry } from '../types';

interface Props {
  entry: WallEntry;
}

function timeAgo(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function WallCard({ entry }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: entry.color, borderLeftWidth: 3 }]} accessibilityLabel={`Wall entry: ${entry.content}`}>
      <Text style={styles.content}>{entry.content}</Text>
      <Text style={styles.time}>{timeAgo(entry.created_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111217', borderRadius: 12, padding: 16, marginBottom: 10 },
  content: { fontSize: 14, color: '#eaeaea', lineHeight: 20, marginBottom: 8 },
  time: { fontSize: 11, color: '#8a8f98' },
});
```

- [ ] **Step 6: Create `src/components/NoteCard.tsx`**

```typescript
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Note } from '../types';

interface Props {
  note: Note;
  onPress: () => void;
}

export default function NoteCard({ note, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityLabel={`Note: ${note.title}, ${note.download_count} downloads`}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="document-text-outline" size={22} color="#66fcf1" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{note.title}</Text>
        <Text style={styles.sub}>{note.subject_name} · Sem {note.semester}</Text>
      </View>
      <View style={styles.right}>
        <Ionicons name="download-outline" size={14} color="#8a8f98" />
        <Text style={styles.count}>{note.download_count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111217', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  pressed: { opacity: 0.7 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1a3a38', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '500', color: '#eaeaea' },
  sub: { fontSize: 12, color: '#8a8f98' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontSize: 12, color: '#8a8f98' },
});
```

- [ ] **Step 7: Create `src/components/MealRow.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  meal: string;
  items: string[];
}

const MEAL_ICONS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  evening: 'Evening',
  dinner: 'Dinner',
};

export default function MealRow({ meal, items }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`${meal}: ${items.join(', ')}`}>
      <Text style={styles.label}>{MEAL_ICONS[meal] ?? meal}</Text>
      <Text style={styles.items} numberOfLines={2}>
        {items.length > 0 ? items.join(', ') : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1b20', gap: 16, alignItems: 'flex-start' },
  label: { width: 72, fontSize: 13, color: '#8a8f98', fontWeight: '500' },
  items: { flex: 1, fontSize: 13, color: '#eaeaea', lineHeight: 18 },
});
```

- [ ] **Step 8: Create `src/components/GymSessionCard.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import type { GymSession } from '../types';

interface Props {
  session: GymSession;
}

export default function GymSessionCard({ session }: Props) {
  const start = session.start_time.slice(0, 5);
  const label = `${start} · ${session.duration_min} min`;

  return (
    <View style={styles.card} accessibilityLabel={`Gym session: ${label}${session.notes ? ', ' + session.notes : ''}`}>
      <Text style={styles.time}>{label}</Text>
      {session.notes ? <Text style={styles.notes} numberOfLines={1}>{session.notes}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a3a38', borderRadius: 8, padding: 8, marginTop: 4 },
  time: { fontSize: 12, color: '#66fcf1', fontWeight: '600' },
  notes: { fontSize: 11, color: '#8a8f98', marginTop: 2 },
});
```

- [ ] **Step 9: Create `src/components/SuggestionCard.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  icon: string;
  title: string;
  body: string;
}

export default function SuggestionCard({ icon, title, body }: Props) {
  return (
    <View style={styles.card} accessibilityLabel={`AI suggestion: ${title}. ${body}`}>
      <Text style={styles.icon} accessibilityElementsHidden>{icon}</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111217', borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderColor: '#1e2028' },
  icon: { fontSize: 26, marginTop: 2 },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '600', color: '#eaeaea' },
  body: { fontSize: 13, color: '#8a8f98', lineHeight: 18 },
});
```

Note: `SuggestionCard` receives `icon` as an emoji string from the Gemini Edge Function JSON response — this is data content (like a chart label), not a structural UI icon, so emoji is appropriate here. `accessibilityElementsHidden` hides the raw emoji from screen readers while the full `accessibilityLabel` on the parent provides the readable description.

- [ ] **Step 10: Create `src/components/MessageBubble.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  content: string;
  isMine: boolean;
  createdAt: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ content, isMine, createdAt }: Props) {
  return (
    <View style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapTheirs]}>
      <View style={[styles.bubble, isMine ? styles.mine : styles.theirs]} accessibilityLabel={`${isMine ? 'You' : 'Them'}: ${content}`}>
        <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>{content}</Text>
        <Text style={styles.time}>{formatTime(createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginBottom: 8 },
  wrapMine: { alignItems: 'flex-end' },
  wrapTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  mine: { backgroundColor: '#66fcf1', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#111217', borderBottomLeftRadius: 4 },
  text: { fontSize: 14, lineHeight: 20 },
  textMine: { color: '#0b0c10' },
  textTheirs: { color: '#eaeaea' },
  time: { fontSize: 10, color: 'rgba(0,0,0,0.4)', alignSelf: 'flex-end' },
});
```

- [ ] **Step 11: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 12: Commit**

```bash
git add src/components/
git commit -m "feat: shared UI components — VerdictChip, AttendanceBar, ClassCard, FeedCard, WallCard, NoteCard, MealRow, GymSessionCard, SuggestionCard, MessageBubble"
```

---

### Task 10: Fix timetable import + Tab Layout + Home Screen + All Screen

**Files:**
- Modify: `src/db/timetable.ts` — rename `getAllSlots` → `getTimetableSlots`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx`
- Create: `app/(tabs)/all.tsx`

> **Note:** Task 8's `timetableStore.ts` imports `getTimetableSlots` but Task 5 exported it as `getAllSlots`. This step fixes that mismatch before any screen is wired up.

- [ ] **Step 1: Rename `getAllSlots` to `getTimetableSlots` in `src/db/timetable.ts`**

Open `src/db/timetable.ts` and rename the function definition from `getAllSlots` to `getTimetableSlots`. Every other function in that file stays unchanged.

Full updated file:

```typescript
import { supabase } from '../lib/supabase';
import type { TimetableSlot, UserTimetableEntry } from '../types';

export async function getTimetableSlots(): Promise<TimetableSlot[]> {
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

- [ ] **Step 2: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Create `app/(tabs)/_layout.tsx`**

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = { bg: '#0b0c10', accent: '#66fcf1', muted: '#8a8f98' };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: '#1a1b20', height: 56 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="all"
        options={{
          title: 'All',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Create `app/(tabs)/all.tsx`**

```typescript
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

const C = { bg: '#0b0c10', text: '#eaeaea', muted: '#8a8f98' };

const FEATURES = [
  { icon: '📅', label: 'Timetable', route: '/timetable' },
  { icon: '⚡', label: 'Feed',      route: '/feed' },
  { icon: '✔️', label: 'Attendance', route: '/attendance' },
  { icon: '📝', label: 'Notes',     route: '/notes' },
  { icon: '🍽️', label: 'Mess',      route: '/mess' },
  { icon: '🏋️', label: 'Gym',       route: '/gym' },
  { icon: '🧱', label: 'Wall',      route: '/wall' },
  { icon: '🤖', label: 'AI',        route: '/ai' },
  { icon: '💬', label: 'Messages',  route: '/messages' },
] as const;

export default function AllScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>All Features</Text>
        <View style={styles.grid}>
          {FEATURES.map(f => (
            <TouchableOpacity
              key={f.label}
              style={styles.cell}
              onPress={() => router.push(f.route as any)}
              accessibilityLabel={f.label}
              accessibilityRole="button"
            >
              <Text style={styles.icon} accessibilityElementsHidden>{f.icon}</Text>
              <Text style={styles.label}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 80 },
  title: { fontSize: 22, fontWeight: '600', color: C.text, marginBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  cell: { width: '28%', alignItems: 'center', gap: 8 },
  icon: { fontSize: 28 },
  label: { fontSize: 13, color: C.muted },
});
```

- [ ] **Step 5: Create `app/(tabs)/index.tsx`**

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { useTimetableStore } from '../../src/stores/timetableStore';
import { computeAttendancePct } from '../../src/engine/predictionEngine';
import { getMessMenuForDay, computeDayCycle } from '../../src/db/mess';
import { supabase } from '../../src/lib/supabase';
import MealRow from '../../src/components/MealRow';
import type { MessMenu } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c', warning: '#ffc857',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  return 'Good Evening,';
}

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const { subjects, records, fetch: fetchSubjects } = useSubjectsStore();
  const { userEntries, calendarEntries, fetch: fetchTimetable } = useTimetableStore();
  const [messMenus, setMessMenus] = useState<MessMenu[]>([]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDow = (today.getDay() + 6) % 7; // 0=Mon

  const calendarEntry = useMemo(
    () => calendarEntries.find(e => e.date === todayStr) ?? null,
    [calendarEntries, todayStr],
  );

  const isHoliday = calendarEntry?.type === 'holiday';
  const effectiveDow =
    calendarEntry?.type === 'day_change'
      ? (calendarEntry.substitute_day ?? todayDow)
      : todayDow;

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        fetchSubjects(profile.id);
        fetchTimetable(profile.id);
      }
    }, [profile?.id]),
  );

  useEffect(() => {
    if (!profile?.mess_id) return;
    supabase
      .from('messes')
      .select('*')
      .eq('id', profile.mess_id)
      .single()
      .then(({ data: mess }) => {
        if (!mess) return;
        const dayCycle = computeDayCycle(
          (mess as any).cycle_start_date,
          (mess as any).cycle_length,
        );
        getMessMenuForDay(mess.id, dayCycle).then(setMessMenus);
      });
  }, [profile?.mess_id]);

  const todayEntries = useMemo(
    () =>
      isHoliday
        ? []
        : userEntries
            .filter(e => e.slot?.day_of_week === effectiveDow)
            .sort((a, b) =>
              (a.slot?.start_time ?? '').localeCompare(b.slot?.start_time ?? ''),
            ),
    [userEntries, effectiveDow, isHoliday],
  );

  const todayEvents = useMemo(
    () => calendarEntries.filter(e => e.date === todayStr && e.type === 'event'),
    [calendarEntries, todayStr],
  );

  const meals = useMemo(() => {
    const order = ['breakfast', 'lunch', 'evening', 'dinner'] as const;
    return order.map(meal => ({
      meal,
      items: messMenus.find(m => m.meal === meal)?.items ?? [],
    }));
  }, [messMenus]);

  function getAttPct(subjectName: string): number {
    const subject = subjects.find(s => s.name === subjectName);
    if (!subject) return 0;
    const sr = records.filter(r => r.subject_id === subject.id);
    return computeAttendancePct(
      sr.filter(r => r.status === 'present').length,
      sr.length,
    );
  }

  function pctColor(pct: number, target: number): string {
    if (pct < target) return C.danger;
    if (pct < target + 5) return C.warning;
    return C.accent;
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getGreeting()}</Text>
            <Text style={s.name}>{profile?.name ?? ''}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            accessibilityLabel="Settings"
            style={s.iconBtn}
          >
            <Ionicons name="settings-outline" size={22} color={C.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.updatesBtn}
          onPress={() => router.push('/feed')}
          accessibilityLabel="Open feed"
        >
          <Ionicons name="flash-outline" size={15} color={C.text} />
          <Text style={s.updatesBtnText}>Stored Updates</Text>
          <View style={s.dot} />
        </TouchableOpacity>

        <View style={s.section}>
          <Text style={s.sectionTitle}>
            {isHoliday
              ? `Today — ${calendarEntry?.description ?? 'Holiday'}`
              : 'Today'}
          </Text>
          {isHoliday ? (
            <Text style={s.emptyText}>No classes today</Text>
          ) : todayEntries.length === 0 ? (
            <Text style={s.emptyText}>No classes scheduled</Text>
          ) : (
            todayEntries.map(entry => {
              const subject = subjects.find(sub => sub.name === entry.subject_name);
              const pct = getAttPct(entry.subject_name);
              const color = pctColor(pct, subject?.target_pct ?? 75);
              return (
                <View key={entry.id} style={s.classRow}>
                  <Text style={s.classLabel}>
                    {entry.slot?.start_time.slice(0, 5)} — {entry.subject_name}
                  </Text>
                  <Text style={[s.classPct, { color }]}>{pct}%</Text>
                </View>
              );
            })
          )}
        </View>

        {todayEvents.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Suggested</Text>
            {todayEvents.map(ev => (
              <Text key={ev.id} style={s.suggestedItem}>{ev.description}</Text>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Food Today</Text>
          {meals.map(({ meal, items }) => (
            <MealRow key={meal} meal={meal} items={items} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 80 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  greeting: { fontSize: 16, color: C.muted },
  name: { fontSize: 22, fontWeight: '600', color: C.text },
  iconBtn: { padding: 8 },
  updatesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 999,
    paddingVertical: 10, paddingHorizontal: 16,
    marginBottom: 28, alignSelf: 'flex-start', position: 'relative',
  },
  updatesBtnText: { fontSize: 14, color: C.text },
  dot: {
    width: 8, height: 8, backgroundColor: C.accent,
    borderRadius: 4, position: 'absolute', top: 6, right: 6,
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 12, color: C.muted, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  classRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  classLabel: { fontSize: 14, color: C.text },
  classPct: { fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 14, color: C.muted },
  suggestedItem: { fontSize: 14, color: C.text, marginBottom: 6 },
});
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/db/timetable.ts app/\(tabs\)/
git commit -m "feat: tab layout, home dashboard, all-features grid"
```

---

### Task 11: Attendance Screen + Subject Detail

**Files:**
- Create: `app/attendance/index.tsx`
- Create: `app/attendance/[subjectId].tsx`
- Create: `app/attendance/_layout.tsx`

- [ ] **Step 1: Create `app/attendance/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function AttendanceLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `app/attendance/index.tsx`**

```typescript
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { upsertAttendance } from '../../src/db/attendance';
import {
  computeAttendancePct,
  verdictForSubject,
} from '../../src/engine/predictionEngine';
import AttendanceBar from '../../src/components/AttendanceBar';
import VerdictChip from '../../src/components/VerdictChip';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c',
};

export default function AttendanceScreen() {
  const { profile } = useAuthStore();
  const { subjects, records, loading, fetch } = useSubjectsStore();
  const [marking, setMarking] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  useFocusEffect(
    useCallback(() => {
      if (profile) fetch(profile.id);
    }, [profile?.id]),
  );

  const subjectStats = useMemo(() =>
    subjects.map(subject => {
      const sr = records.filter(r => r.subject_id === subject.id);
      const present = sr.filter(r => r.status === 'present').length;
      const total = sr.length;
      const pct = computeAttendancePct(present, total);
      const verdict = verdictForSubject(present, total, subject.target_pct);
      const todayRecord = sr.find(r => r.date === todayStr);
      return { subject, present, total, pct, verdict, todayStatus: todayRecord?.status ?? null };
    }),
    [subjects, records, todayStr],
  );

  async function mark(subjectId: string, status: 'present' | 'absent') {
    if (!profile) return;
    setMarking(subjectId + status);
    await upsertAttendance(profile.id, subjectId, todayStr, status);
    await fetch(profile.id);
    setMarking(null);
  }

  if (loading && subjects.length === 0) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Attendance</Text>
      </View>
      <FlatList
        data={subjectStats}
        keyExtractor={item => item.subject.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={s.card}>
            <TouchableOpacity
              style={s.cardTop}
              onPress={() => router.push(`/attendance/${item.subject.id}`)}
              accessibilityLabel={`${item.subject.name} detail`}
            >
              <View style={s.cardLeft}>
                <Text style={s.subjectName}>{item.subject.name}</Text>
                <Text style={s.subjectStats}>
                  {item.present}/{item.total} classes
                </Text>
              </View>
              <VerdictChip verdict={item.verdict} />
            </TouchableOpacity>

            <AttendanceBar
              present={item.present}
              total={item.total}
              targetPct={item.subject.target_pct}
            />

            <View style={s.markRow}>
              <Text style={s.markLabel}>Today</Text>
              <View style={s.markBtns}>
                <TouchableOpacity
                  style={[
                    s.markBtn,
                    item.todayStatus === 'present' && s.markBtnActiveGood,
                  ]}
                  onPress={() => mark(item.subject.id, 'present')}
                  disabled={marking !== null}
                  accessibilityLabel={`Mark ${item.subject.name} present`}
                >
                  {marking === item.subject.id + 'present' ? (
                    <ActivityIndicator size="small" color={C.accent} />
                  ) : (
                    <Text style={[
                      s.markBtnText,
                      item.todayStatus === 'present' && { color: '#0b0c10' },
                    ]}>P</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.markBtn,
                    item.todayStatus === 'absent' && s.markBtnActiveBad,
                  ]}
                  onPress={() => mark(item.subject.id, 'absent')}
                  disabled={marking !== null}
                  accessibilityLabel={`Mark ${item.subject.name} absent`}
                >
                  {marking === item.subject.id + 'absent' ? (
                    <ActivityIndicator size="small" color={C.danger} />
                  ) : (
                    <Text style={[
                      s.markBtnText,
                      item.todayStatus === 'absent' && { color: '#fff' },
                    ]}>A</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={s.emptyText}>No subjects yet. Add them in Settings.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  list: { padding: 16, gap: 12, paddingBottom: 80 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, gap: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { gap: 2 },
  subjectName: { fontSize: 16, fontWeight: '600', color: C.text },
  subjectStats: { fontSize: 12, color: C.muted },
  markRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  markLabel: { fontSize: 13, color: C.muted },
  markBtns: { flexDirection: 'row', gap: 8 },
  markBtn: {
    width: 44, height: 36, borderRadius: 8,
    backgroundColor: '#1a1b20', alignItems: 'center', justifyContent: 'center',
  },
  markBtnActiveGood: { backgroundColor: C.accent },
  markBtnActiveBad: { backgroundColor: C.danger },
  markBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
});
```

- [ ] **Step 3: Create `app/attendance/[subjectId].tsx`**

```typescript
import { useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { upsertAttendance } from '../../src/db/attendance';
import {
  computeAttendancePct,
  canSkip,
  classesToRecover,
  verdictForSubject,
} from '../../src/engine/predictionEngine';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c', warning: '#ffc857',
};

export default function SubjectDetailScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { profile } = useAuthStore();
  const { subjects, records, fetch } = useSubjectsStore();

  const subject = subjects.find(s => s.id === subjectId);
  const subjectRecords = useMemo(
    () => records
      .filter(r => r.subject_id === subjectId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [records, subjectId],
  );

  useFocusEffect(
    useCallback(() => {
      if (profile) fetch(profile.id);
    }, [profile?.id]),
  );

  if (!subject) return null;

  const present = subjectRecords.filter(r => r.status === 'present').length;
  const total = subjectRecords.length;
  const pct = computeAttendancePct(present, total);
  const verdict = verdictForSubject(present, total, subject.target_pct);
  const skipsLeft = (() => {
    let n = 0;
    while (canSkip(present, total + n, subject.target_pct)) n++;
    return n;
  })();
  const needed = classesToRecover(present, total, subject.target_pct);

  const verdictColor =
    verdict === 'safe' ? C.accent : verdict === 'warning' ? C.warning : C.danger;

  async function toggleRecord(recordId: string, date: string, currentStatus: 'present' | 'absent') {
    if (!profile) return;
    const next = currentStatus === 'present' ? 'absent' : 'present';
    await upsertAttendance(profile.id, subject!.id, date, next);
    fetch(profile.id);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{subject.name}</Text>
      </View>

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: verdictColor }]}>{pct}%</Text>
          <Text style={s.statLabel}>Attendance</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statValue}>{present}/{total}</Text>
          <Text style={s.statLabel}>Present/Total</Text>
        </View>
        {verdict === 'danger' ? (
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: C.danger }]}>{needed}</Text>
            <Text style={s.statLabel}>Classes needed</Text>
          </View>
        ) : (
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: C.accent }]}>{skipsLeft}</Text>
            <Text style={s.statLabel}>Safe skips</Text>
          </View>
        )}
      </View>

      <FlatList
        data={subjectRecords}
        keyExtractor={r => r.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.record}
            onPress={() => toggleRecord(item.id, item.date, item.status)}
            accessibilityLabel={`${item.date} ${item.status}, tap to toggle`}
          >
            <Text style={s.recordDate}>{item.date}</Text>
            <View style={[
              s.badge,
              item.status === 'present' ? s.badgePresent : s.badgeAbsent,
            ]}>
              <Text style={[
                s.badgeText,
                item.status === 'present' ? { color: C.accent } : { color: C.danger },
              ]}>
                {item.status === 'present' ? 'Present' : 'Absent'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.emptyText}>No records yet. Mark attendance from the main screen.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 20, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '700', color: C.text, flex: 1 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: C.card, marginHorizontal: 16,
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  statBox: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 11, color: C.muted },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 80 },
  record: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: C.card,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
  },
  recordDate: { fontSize: 14, color: C.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePresent: { backgroundColor: '#1a3a38' },
  badgeAbsent: { backgroundColor: '#3a1010' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
});
```

- [ ] **Step 4: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/attendance/
git commit -m "feat: attendance screen with daily marking and subject detail with history"
```

---

### Task 12: Timetable Screen

**Files:**
- Create: `app/timetable/_layout.tsx`
- Create: `app/timetable/index.tsx`

- [ ] **Step 1: Create `app/timetable/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function TimetableLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `app/timetable/index.tsx`**

```typescript
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  Modal, TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useTimetableStore } from '../../src/stores/timetableStore';
import {
  upsertUserTimetableEntry,
  deleteUserTimetableEntry,
} from '../../src/db/timetable';
import type { TimetableSlot } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetableScreen() {
  const { profile } = useAuthStore();
  const { slots, userEntries, loading, fetch } = useTimetableStore();
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (profile) fetch(profile.id);
    }, [profile?.id]),
  );

  const sections = useMemo(() =>
    DAY_NAMES
      .map((day, i) => ({
        title: day,
        data: slots.filter(slot => slot.day_of_week === i),
      }))
      .filter(s => s.data.length > 0),
    [slots],
  );

  function getSubjectForSlot(slotId: string): string | null {
    return userEntries.find(e => e.slot_id === slotId)?.subject_name ?? null;
  }

  function openEdit(slot: TimetableSlot) {
    setEditingSlot(slot);
    setInputValue(getSubjectForSlot(slot.id) ?? '');
  }

  async function saveEdit() {
    if (!editingSlot || !profile) return;
    setSaving(true);
    const val = inputValue.trim();
    if (val) {
      await upsertUserTimetableEntry(profile.id, editingSlot.id, val);
    } else {
      await deleteUserTimetableEntry(profile.id, editingSlot.id);
    }
    await fetch(profile.id);
    setSaving(false);
    setEditingSlot(null);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Timetable</Text>
      </View>

      {loading && slots.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={s.dayHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const subjectName = getSubjectForSlot(item.id);
            return (
              <TouchableOpacity
                style={s.slotRow}
                onPress={() => openEdit(item)}
                accessibilityLabel={`${item.start_time.slice(0, 5)} to ${item.end_time.slice(0, 5)}, ${subjectName ?? 'empty'}`}
              >
                <Text style={s.slotTime}>
                  {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}
                </Text>
                <Text style={subjectName ? s.slotFilled : s.slotEmpty} numberOfLines={1}>
                  {subjectName ?? '+ Add subject'}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!editingSlot} transparent animationType="slide" onRequestClose={() => setEditingSlot(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>
              {editingSlot?.start_time.slice(0, 5)} – {editingSlot?.end_time.slice(0, 5)}
            </Text>
            <TextInput
              style={s.input}
              placeholder="Subject name (leave empty to clear)"
              placeholderTextColor={C.muted}
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={saving}
              accessibilityLabel="Save subject"
            >
              {saving
                ? <ActivityIndicator color="#0b0c10" />
                : <Text style={s.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditingSlot(null)}
              style={s.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 20, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  dayHeader: {
    fontSize: 12, color: C.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 20, marginBottom: 8,
  },
  slotRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: C.card,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  slotTime: { fontSize: 13, color: C.muted, minWidth: 90 },
  slotFilled: { fontSize: 14, color: C.accent, fontWeight: '500', flex: 1, textAlign: 'right' },
  slotEmpty: { fontSize: 13, color: '#333', flex: 1, textAlign: 'right' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 13, color: C.muted, marginBottom: 16 },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 14, color: C.text, fontSize: 15, marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  saveBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelBtnText: { color: C.muted, fontSize: 14 },
});
```

- [ ] **Step 3: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/timetable/
git commit -m "feat: timetable screen — weekly slots view with tap-to-edit subject names"
```

---

### Task 13: Feed Screen

**Files:**
- Create: `app/feed/_layout.tsx`
- Create: `app/feed/index.tsx`

- [ ] **Step 1: Create `app/feed/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function FeedLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `app/feed/index.tsx`**

```typescript
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getFeedPosts, createFeedPost } from '../../src/db/feed';
import { supabase } from '../../src/lib/supabase';
import FeedCard from '../../src/components/FeedCard';
import type { FeedPost } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const EXPIRY_OPTIONS = [
  { label: '1 hour',  hours: 1 },
  { label: '3 hours', hours: 3 },
  { label: '6 hours', hours: 6 },
  { label: '24 hours', hours: 24 },
];

export default function FeedScreen() {
  const { profile } = useAuthStore();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [location, setLocation] = useState('');
  const [expiryHours, setExpiryHours] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  async function loadPosts() {
    setLoading(true);
    const data = await getFeedPosts();
    setPosts(data);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { loadPosts(); }, []));

  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_posts' },
        () => { loadPosts(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleCreate() {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if (!body.trim()) { Alert.alert('Body required'); return; }
    if (!profile) return;
    setSubmitting(true);
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();
    await createFeedPost(
      profile.id,
      title.trim(),
      body.trim(),
      location.trim() || null,
      expiresAt,
    );
    setSubmitting(false);
    setShowCreate(false);
    setTitle(''); setBody(''); setLocation(''); setExpiryHours(3);
    loadPosts();
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Feed</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={loadPosts}
        renderItem={({ item }) => <FeedCard post={item} />}
        ListEmptyComponent={
          loading ? null : (
            <Text style={s.emptyText}>No active posts. Be the first to post!</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowCreate(true)}
        accessibilityLabel="Create post"
      >
        <Ionicons name="add" size={28} color="#0b0c10" />
      </TouchableOpacity>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView
          style={s.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>New Post</Text>

            <TextInput
              style={s.input}
              placeholder="Title"
              placeholderTextColor={C.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="What's happening? (free food, event, announcement…)"
              placeholderTextColor={C.muted}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={400}
            />
            <TextInput
              style={s.input}
              placeholder="Location (optional)"
              placeholderTextColor={C.muted}
              value={location}
              onChangeText={setLocation}
              maxLength={80}
            />

            <Text style={s.fieldLabel}>Expires in</Text>
            <View style={s.expiryRow}>
              {EXPIRY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.hours}
                  style={[s.expiryBtn, expiryHours === opt.hours && s.expiryBtnActive]}
                  onPress={() => setExpiryHours(opt.hours)}
                  accessibilityLabel={`Expire in ${opt.label}`}
                >
                  <Text style={[
                    s.expiryBtnText,
                    expiryHours === opt.hours && { color: '#0b0c10' },
                  ]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={submitting}
              accessibilityLabel="Submit post"
            >
              {submitting
                ? <ActivityIndicator color="#0b0c10" />
                : <Text style={s.submitBtnText}>Post</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowCreate(false)}
              style={s.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 20, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 60, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16 },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 13, color: C.text, fontSize: 14, marginBottom: 10,
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12, color: C.muted, marginBottom: 8 },
  expiryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  expiryBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 8,
    backgroundColor: '#1a1b20', alignItems: 'center',
  },
  expiryBtnActive: { backgroundColor: C.accent },
  expiryBtnText: { fontSize: 12, color: C.muted, fontWeight: '500' },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  submitBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: C.muted, fontSize: 14 },
});
```

- [ ] **Step 3: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/feed/
git commit -m "feat: feed screen with realtime posts, expiry options, and create modal"
```

---

### Task 14: Wall Screen

**Files:**
- Create: `app/wall/_layout.tsx`
- Create: `app/wall/index.tsx`

- [ ] **Step 1: Create `app/wall/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function WallLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `app/wall/index.tsx`**

```typescript
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWallEntries, createWallEntry } from '../../src/db/wall';
import { supabase } from '../../src/lib/supabase';
import WallCard from '../../src/components/WallCard';
import type { WallEntry } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const COLORS = ['#66fcf1', '#ffc857', '#ff5c5c', '#a78bfa', '#34d399', '#fb923c'];

export default function WallScreen() {
  const [entries, setEntries] = useState<WallEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  async function loadEntries() {
    setLoading(true);
    const data = await getWallEntries();
    setEntries(data);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { loadEntries(); }, []));

  useEffect(() => {
    const channel = supabase
      .channel('wall-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wall_entries' },
        payload => {
          setEntries(prev => [payload.new as WallEntry, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleCreate() {
    if (!content.trim()) return;
    setSubmitting(true);
    await createWallEntry(content.trim(), selectedColor);
    setSubmitting(false);
    setShowCreate(false);
    setContent('');
    setSelectedColor(COLORS[0]);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Wall</Text>
          <Text style={s.subtitle}>Anonymous · expires in 24h</Text>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={loadEntries}
        renderItem={({ item }) => <WallCard entry={item} />}
        ListEmptyComponent={
          loading ? null : (
            <Text style={s.emptyText}>The wall is empty. Leave a message.</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowCreate(true)}
        accessibilityLabel="Add to wall"
      >
        <Ionicons name="pencil" size={22} color="#0b0c10" />
      </TouchableOpacity>

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={s.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Leave a message</Text>
            <Text style={s.sheetSub}>Anonymous · disappears in 24 hours</Text>

            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Say something…"
              placeholderTextColor={C.muted}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={280}
              autoFocus
            />
            <Text style={s.charCount}>{content.length}/280</Text>

            <Text style={s.fieldLabel}>Colour</Text>
            <View style={s.colorRow}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    s.colorDot,
                    { backgroundColor: color },
                    selectedColor === color && s.colorDotSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                  accessibilityLabel={`Select color ${color}`}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, (!content.trim() || submitting) && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!content.trim() || submitting}
              accessibilityLabel="Post to wall"
            >
              {submitting
                ? <ActivityIndicator color="#0b0c10" />
                : <Text style={s.submitBtnText}>Post</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowCreate(false)}
              style={s.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 20, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 60, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  sheetSub: { fontSize: 12, color: C.muted, marginBottom: 16 },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 13, color: C.text, fontSize: 14, marginBottom: 4,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: C.muted, textAlign: 'right', marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: C.muted, marginBottom: 10 },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff' },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  submitBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: C.muted, fontSize: 14 },
});
```

- [ ] **Step 3: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/wall/
git commit -m "feat: anonymous wall with realtime updates, colour picker, 24h expiry"
```

---

### Task 15: Mess Screen

**Files:**
- Create: `app/mess/_layout.tsx`
- Create: `app/mess/index.tsx`

- [ ] **Step 1: Create `app/mess/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function MessLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `app/mess/index.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getMessMenuForDay, computeDayCycle } from '../../src/db/mess';
import { supabase } from '../../src/lib/supabase';
import MealRow from '../../src/components/MealRow';
import type { Mess, MessMenu } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const MEAL_ORDER = ['breakfast', 'lunch', 'evening', 'dinner'] as const;

export default function MessScreen() {
  const { profile } = useAuthStore();
  const [mess, setMess] = useState<Mess | null>(null);
  const [menus, setMenus] = useState<MessMenu[]>([]);
  const [dayCycle, setDayCycle] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.mess_id) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('messes')
      .select('*')
      .eq('id', profile.mess_id)
      .single()
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        const typedMess = data as Mess;
        const cycle = computeDayCycle(typedMess.cycle_start_date, typedMess.cycle_length);
        setMess(typedMess);
        setDayCycle(cycle);
        const menuData = await getMessMenuForDay(typedMess.id, cycle);
        setMenus(menuData);
        setLoading(false);
      });
  }, [profile?.mess_id]);

  const meals = MEAL_ORDER.map(meal => ({
    meal,
    items: menus.find(m => m.meal === meal)?.items ?? [],
  }));

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Mess Menu</Text>
          {mess && <Text style={s.messName}>{mess.name}</Text>}
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : !profile?.mess_id ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No mess selected.</Text>
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Go to settings to select mess"
          >
            <Text style={s.settingsBtnText}>Select in Settings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.dateBadge}>
            <Text style={s.dateText}>{todayStr}</Text>
            {dayCycle !== null && (
              <View style={s.cycleBadge}>
                <Text style={s.cycleText}>Day {dayCycle}</Text>
              </View>
            )}
          </View>

          <View style={s.card}>
            {meals.map(({ meal, items }) => (
              <MealRow key={meal} meal={meal} items={items} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 20, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  messName: { fontSize: 13, color: C.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 14, color: C.muted },
  settingsBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  settingsBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 80 },
  dateBadge: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  dateText: { fontSize: 14, color: C.muted },
  cycleBadge: {
    backgroundColor: '#1a3a38', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  cycleText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  card: {
    backgroundColor: C.card, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 4,
  },
});
```

- [ ] **Step 3: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/mess/
git commit -m "feat: mess screen with daily menu, day cycle indicator, and settings fallback"
```

---

### Task 16: Notes Screen

**Files:**
- Create: `app/notes/_layout.tsx`
- Create: `app/notes/index.tsx`

- [ ] **Step 1: Create `app/notes/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function NotesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `app/notes/index.tsx`**

```typescript
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuthStore } from '../../src/stores/authStore';
import { getNotesBySubject, getNotesBySemester, uploadNote, getSignedUrl, incrementDownloadCount } from '../../src/db/notes';
import { supabase } from '../../src/lib/supabase';
import NoteCard from '../../src/components/NoteCard';
import type { Note } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

type FilterMode = 'subject' | 'semester';

export default function NotesScreen() {
  const { profile } = useAuthStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('subject');
  const [filterValue, setFilterValue] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadSemester, setUploadSemester] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function loadNotes() {
    if (!filterValue.trim()) { setNotes([]); return; }
    setLoading(true);
    const data = filterMode === 'subject'
      ? await getNotesBySubject(filterValue.trim())
      : await getNotesBySemester(filterValue.trim());
    setNotes(data);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { loadNotes(); }, [filterMode, filterValue]));

  useEffect(() => { loadNotes(); }, [filterMode, filterValue]);

  async function handleUpload() {
    if (!uploadTitle.trim() || !uploadSubject.trim() || !uploadSemester.trim()) {
      Alert.alert('All fields required');
      return;
    }
    if (!profile) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const ext = asset.name.split('.').pop() ?? 'pdf';
    const storagePath = `${profile.id}/${Date.now()}.${ext}`;

    setUploading(true);
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('notes')
      .upload(storagePath, blob, { contentType: asset.mimeType ?? 'application/octet-stream' });

    if (uploadError) {
      setUploading(false);
      Alert.alert('Upload failed', uploadError.message);
      return;
    }

    await uploadNote(profile.id, uploadSubject.trim(), uploadSemester.trim(), uploadTitle.trim(), storagePath);
    setUploading(false);
    setShowUpload(false);
    setUploadTitle(''); setUploadSubject(''); setUploadSemester('');
    loadNotes();
  }

  async function handleDownload(note: Note) {
    setDownloading(note.id);
    try {
      const url = await getSignedUrl(note.file_path);
      await incrementDownloadCount(note.id);
      await Linking.openURL(url);
      setNotes(prev => prev.map(n => n.id === note.id
        ? { ...n, download_count: n.download_count + 1 }
        : n,
      ));
    } catch {
      Alert.alert('Download failed', 'Could not open the file.');
    }
    setDownloading(null);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Notes</Text>
      </View>

      {/* Filter toggle */}
      <View style={s.segmentRow}>
        {(['subject', 'semester'] as FilterMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[s.segBtn, filterMode === mode && s.segBtnActive]}
            onPress={() => { setFilterMode(mode); setFilterValue(''); }}
            accessibilityLabel={`Filter by ${mode}`}
          >
            <Text style={[s.segBtnText, filterMode === mode && { color: '#0b0c10' }]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={C.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder={filterMode === 'subject' ? 'e.g. Maths' : 'e.g. S4'}
          placeholderTextColor={C.muted}
          value={filterValue}
          onChangeText={setFilterValue}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={loadNotes}
        renderItem={({ item }) => (
          <View style={s.noteWrap}>
            <NoteCard note={item} onPress={() => handleDownload(item)} />
            {downloading === item.id && (
              <ActivityIndicator
                color={C.accent}
                style={s.downloadSpinner}
                size="small"
              />
            )}
          </View>
        )}
        ListEmptyComponent={
          filterValue.trim() === '' ? (
            <Text style={s.emptyText}>Enter a subject or semester to browse notes.</Text>
          ) : loading ? null : (
            <Text style={s.emptyText}>No notes found for "{filterValue}".</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowUpload(true)}
        accessibilityLabel="Upload note"
      >
        <Ionicons name="cloud-upload-outline" size={24} color="#0b0c10" />
      </TouchableOpacity>

      <Modal
        visible={showUpload}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUpload(false)}
      >
        <KeyboardAvoidingView
          style={s.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Upload Note</Text>
            <TextInput
              style={s.input}
              placeholder="Title (e.g. Unit 3 Notes)"
              placeholderTextColor={C.muted}
              value={uploadTitle}
              onChangeText={setUploadTitle}
              maxLength={80}
            />
            <TextInput
              style={s.input}
              placeholder="Subject (e.g. Maths)"
              placeholderTextColor={C.muted}
              value={uploadSubject}
              onChangeText={setUploadSubject}
              maxLength={60}
            />
            <TextInput
              style={s.input}
              placeholder="Semester (e.g. S4)"
              placeholderTextColor={C.muted}
              value={uploadSemester}
              onChangeText={setUploadSemester}
              maxLength={10}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[s.submitBtn, uploading && { opacity: 0.6 }]}
              onPress={handleUpload}
              disabled={uploading}
              accessibilityLabel="Pick file and upload"
            >
              {uploading
                ? <ActivityIndicator color="#0b0c10" />
                : (
                  <View style={s.submitBtnInner}>
                    <Ionicons name="document-attach-outline" size={18} color="#0b0c10" />
                    <Text style={s.submitBtnText}>Pick File & Upload</Text>
                  </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowUpload(false)}
              style={s.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 20, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  segmentRow: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: C.card, borderRadius: 10,
    padding: 4, marginBottom: 12,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segBtnActive: { backgroundColor: C.accent },
  segBtnText: { fontSize: 13, fontWeight: '600', color: C.muted },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 10,
    marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: C.text, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  noteWrap: { position: 'relative' },
  downloadSpinner: { position: 'absolute', right: 16, top: 14 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16 },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 13, color: C.text, fontSize: 14, marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  submitBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: C.muted, fontSize: 14 },
});
```

> **Note:** `incrementDownloadCount` in `src/db/notes.ts` calls `supabase.rpc('increment_download_count', { note_id })`. Add this Postgres function in the Supabase SQL Editor after running the migration:
>
> ```sql
> create or replace function increment_download_count(note_id uuid)
> returns void language sql as $$
>   update notes set download_count = download_count + 1 where id = note_id;
> $$;
> ```

- [ ] **Step 3: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/notes/
git commit -m "feat: notes screen with subject/semester filter, upload via document picker, signed-URL download"
```

---

### Task 17: Gym Screen

**Files:**
- Create: `src/db/gym.ts`
- Create: `app/gym/_layout.tsx`
- Create: `app/gym/index.tsx`

> **Migration:** Run in Supabase SQL Editor before testing:
>
> ```sql
> create table gym_sessions (
>   id uuid primary key default gen_random_uuid(),
>   user_id uuid references auth.users(id) on delete cascade not null,
>   scheduled_at timestamptz not null,
>   done boolean default false,
>   notes text,
>   created_at timestamptz default now()
> );
> alter table gym_sessions enable row level security;
> create policy "Users manage own gym sessions"
>   on gym_sessions for all using (auth.uid() = user_id);
> ```

- [ ] **Step 1: Create `src/db/gym.ts`**

```typescript
import { supabase } from '../lib/supabase';

export type GymSession = {
  id: string;
  user_id: string;
  scheduled_at: string;
  done: boolean;
  notes: string | null;
  created_at: string;
};

export async function getGymSessions(userId: string): Promise<GymSession[]> {
  const { data } = await supabase
    .from('gym_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: true });
  return data ?? [];
}

export async function addGymSession(
  userId: string,
  scheduledAt: string,
  notes?: string,
): Promise<void> {
  await supabase.from('gym_sessions').insert({
    user_id: userId,
    scheduled_at: scheduledAt,
    notes: notes ?? null,
  });
}

export async function markGymDone(sessionId: string): Promise<void> {
  await supabase
    .from('gym_sessions')
    .update({ done: true })
    .eq('id', sessionId);
}

export async function deleteGymSession(sessionId: string): Promise<void> {
  await supabase.from('gym_sessions').delete().eq('id', sessionId);
}
```

- [ ] **Step 2: Create `app/gym/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function GymLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Create `app/gym/index.tsx`**

```typescript
import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  StyleSheet, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../src/stores/authStore';
import {
  getGymSessions, addGymSession, markGymDone, deleteGymSession,
  type GymSession,
} from '../../src/db/gym';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c',
};

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export default function GymScreen() {
  const { profile } = useAuthStore();
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');
  const [pickedDate, setPickedDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!profile) return;
    setLoading(true);
    setSessions(await getGymSessions(profile.id));
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleAdd() {
    if (!profile) return;
    setSaving(true);
    await addGymSession(profile.id, pickedDate.toISOString());
    setSaving(false);
    setShowModal(false);
    setPickedDate(new Date());
    setPickerStep('date');
    load();
  }

  async function handleDone(session: GymSession) {
    await markGymDone(session.id);
    setSessions(prev =>
      prev.map(s => s.id === session.id ? { ...s, done: true } : s),
    );
  }

  async function handleDelete(session: GymSession) {
    Alert.alert('Remove session?', fmtDate(session.scheduled_at), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await deleteGymSession(session.id);
          setSessions(prev => prev.filter(s => s.id !== session.id));
        },
      },
    ]);
  }

  const upcoming = sessions.filter(s => !s.done && new Date(s.scheduled_at) >= new Date());
  const past = sessions.filter(s => s.done || new Date(s.scheduled_at) < new Date());

  function SessionCard({ item }: { item: GymSession }) {
    const isPast = item.done || new Date(item.scheduled_at) < new Date();
    return (
      <View style={[s.card, isPast && s.cardPast]}>
        <View style={s.cardLeft}>
          <Ionicons name="barbell-outline" size={20} color={item.done ? C.muted : C.accent} />
          <View style={{ marginLeft: 12 }}>
            <Text style={[s.cardDate, item.done && { color: C.muted }]}>
              {fmtDate(item.scheduled_at)}
            </Text>
            <Text style={s.cardTime}>{fmtTime(item.scheduled_at)}</Text>
          </View>
        </View>
        <View style={s.cardActions}>
          {!item.done && (
            <TouchableOpacity
              onPress={() => handleDone(item)}
              style={s.doneBtn}
              accessibilityLabel="Mark done"
            >
              <Ionicons name="checkmark-circle-outline" size={22} color={C.accent} />
            </TouchableOpacity>
          )}
          {item.done && (
            <Ionicons name="checkmark-circle" size={22} color={C.accent} style={{ marginRight: 8 }} />
          )}
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            accessibilityLabel="Delete session"
          >
            <Ionicons name="trash-outline" size={20} color={C.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const allSections = [
    ...(upcoming.length ? [{ type: 'header', label: 'Upcoming' }, ...upcoming.map(s => ({ type: 'session', ...s }))] : []),
    ...(past.length ? [{ type: 'header', label: 'Past' }, ...past.map(s => ({ type: 'session', ...s }))] : []),
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Gym</Text>
      </View>

      <FlatList
        data={allSections}
        keyExtractor={(item, i) => ('id' in item ? item.id : `hdr-${i}`)}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={s.sectionLabel}>{(item as { label: string }).label}</Text>;
          }
          return <SessionCard item={item as unknown as GymSession} />;
        }}
        ListEmptyComponent={
          loading ? null : (
            <Text style={s.emptyText}>No sessions scheduled. Tap + to add one.</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowModal(true)}
        accessibilityLabel="Add gym session"
      >
        <Ionicons name="add" size={28} color="#0b0c10" />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalWrap}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>
              {pickerStep === 'date' ? 'Pick a date' : 'Pick a time'}
            </Text>

            <DateTimePicker
              value={pickedDate}
              mode={pickerStep}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={pickerStep === 'date' ? new Date() : undefined}
              onChange={(_e, date) => {
                if (!date) return;
                setPickedDate(date);
              }}
              style={s.picker}
              themeVariant="dark"
            />

            {pickerStep === 'date' ? (
              <TouchableOpacity
                style={s.nextBtn}
                onPress={() => setPickerStep('time')}
                accessibilityLabel="Next: pick time"
              >
                <Text style={s.nextBtnText}>Next: Pick Time</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.nextBtn, saving && { opacity: 0.6 }]}
                onPress={handleAdd}
                disabled={saving}
                accessibilityLabel="Save session"
              >
                {saving
                  ? <ActivityIndicator color="#0b0c10" />
                  : <Text style={s.nextBtnText}>Save Session</Text>}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => { setShowModal(false); setPickerStep('date'); }}
              style={s.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionLabel: { fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardPast: { opacity: 0.6 },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  cardDate: { fontSize: 15, fontWeight: '600', color: C.text },
  cardTime: { fontSize: 13, color: C.muted, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneBtn: { marginRight: 4 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16, textAlign: 'center' },
  picker: { alignSelf: 'center', marginBottom: 16 },
  nextBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  nextBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: C.muted, fontSize: 14 },
});
```

- [ ] **Step 4: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/gym.ts app/gym/
git commit -m "feat: gym session scheduler with date/time picker and done/delete actions"
```

---

### Task 18: AI Screen + ai-suggest Edge Function

**Files:**
- Create: `supabase/functions/ai-suggest/index.ts`
- Create: `src/db/aiSuggestions.ts`
- Create: `app/ai/_layout.tsx`
- Create: `app/ai/index.tsx`

> **Migration:** Run in Supabase SQL Editor before testing:
>
> ```sql
> create table ai_suggestions (
>   id uuid primary key default gen_random_uuid(),
>   user_id uuid references auth.users(id) on delete cascade not null,
>   suggestion text not null,
>   created_at timestamptz default now()
> );
> alter table ai_suggestions enable row level security;
> create policy "Users read own suggestions"
>   on ai_suggestions for select using (auth.uid() = user_id);
> create policy "Service role insert"
>   on ai_suggestions for insert with check (true);
> ```
>
> **Secrets:** Set in Supabase Dashboard → Settings → Edge Functions → Secrets:
> - `GEMINI_API_KEY` — your Google AI Studio key (free tier is sufficient)

- [ ] **Step 1: Create `supabase/functions/ai-suggest/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { user_id } = await req.json() as { user_id: string };
  if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: CORS });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch user timetable with subject names
  const { data: slots } = await db
    .from('user_timetable')
    .select('subject_name, slot_id')
    .eq('user_id', user_id);

  // Fetch attendance records for the last 90 days
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: records } = await db
    .from('attendance_records')
    .select('slot_id, status')
    .eq('user_id', user_id)
    .gte('date', since);

  // Compute attendance % per subject
  const subjectMap: Record<string, { present: number; total: number }> = {};
  for (const slot of (slots ?? [])) {
    const name = slot.subject_name;
    if (!subjectMap[name]) subjectMap[name] = { present: 0, total: 0 };
    const subjectRecords = (records ?? []).filter(r => r.slot_id === slot.slot_id);
    subjectMap[name].total += subjectRecords.length;
    subjectMap[name].present += subjectRecords.filter(r => r.status === 'present').length;
  }

  const attendanceSummary = Object.entries(subjectMap)
    .map(([subject, { present, total }]) => {
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;
      return `${subject}: ${pct}% (${present}/${total} classes)`;
    })
    .join('\n');

  // Fetch upcoming gym sessions
  const { data: gymSessions } = await db
    .from('gym_sessions')
    .select('scheduled_at, done')
    .eq('user_id', user_id)
    .eq('done', false)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);

  const gymSummary = gymSessions?.length
    ? gymSessions.map(s => new Date(s.scheduled_at).toDateString()).join(', ')
    : 'No upcoming gym sessions';

  const prompt = `You are a helpful student assistant for a college campus app.
Analyze this student's data and give 3–4 specific, actionable suggestions.
Be direct and concise. Each suggestion should be 1–2 sentences.

Attendance (last 90 days):
${attendanceSummary || 'No attendance data yet.'}

Upcoming gym sessions: ${gymSummary}

Focus on: attendance risk subjects (below 75%), study/revision suggestions, gym consistency, and overall balance. Do not greet the user.`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    },
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 502, headers: CORS });
  }

  const geminiJson = await geminiRes.json();
  const suggestion: string = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No suggestion generated.';

  await db.from('ai_suggestions').insert({ user_id, suggestion });

  return new Response(JSON.stringify({ suggestion }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Create `src/db/aiSuggestions.ts`**

```typescript
import { supabase } from '../lib/supabase';

export type AiSuggestion = {
  id: string;
  user_id: string;
  suggestion: string;
  created_at: string;
};

export async function getAiSuggestions(userId: string): Promise<AiSuggestion[]> {
  const { data } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function callAiSuggest(userId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-suggest', {
    body: { user_id: userId },
  });
  if (error) throw error;
  return (data as { suggestion: string }).suggestion;
}
```

- [ ] **Step 3: Create `app/ai/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function AiLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 4: Create `app/ai/index.tsx`**

```typescript
import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getAiSuggestions, callAiSuggest, type AiSuggestion } from '../../src/db/aiSuggestions';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH[d.getMonth()]} · ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function AiScreen() {
  const { profile } = useAuthStore();
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  async function load() {
    if (!profile) return;
    setLoading(true);
    setSuggestions(await getAiSuggestions(profile.id));
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleAnalyze() {
    if (!profile) return;
    setAnalyzing(true);
    try {
      const text = await callAiSuggest(profile.id);
      setSuggestions(prev => [{
        id: Date.now().toString(),
        user_id: profile.id,
        suggestion: text,
        created_at: new Date().toISOString(),
      }, ...prev]);
    } catch {
      Alert.alert('Analysis failed', 'Could not reach AI. Check your connection and try again.');
    }
    setAnalyzing(false);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>AI Analysis</Text>
      </View>

      <TouchableOpacity
        style={[s.analyzeBtn, analyzing && { opacity: 0.6 }]}
        onPress={handleAnalyze}
        disabled={analyzing}
        accessibilityLabel="Get AI analysis"
      >
        {analyzing ? (
          <View style={s.analyzeBtnInner}>
            <ActivityIndicator color="#0b0c10" size="small" />
            <Text style={s.analyzeBtnText}>Analyzing…</Text>
          </View>
        ) : (
          <View style={s.analyzeBtnInner}>
            <Ionicons name="sparkles-outline" size={18} color="#0b0c10" />
            <Text style={s.analyzeBtnText}>Analyze My Data</Text>
          </View>
        )}
      </TouchableOpacity>

      <FlatList
        data={suggestions}
        keyExtractor={s => s.id}
        contentContainerStyle={st.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => (
          <View style={st.card}>
            <Text style={st.cardMeta}>{fmtDateTime(item.created_at)}</Text>
            <Text style={st.cardText}>{item.suggestion}</Text>
          </View>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={st.emptyWrap}>
              <Ionicons name="sparkles-outline" size={40} color={C.muted} />
              <Text style={st.emptyText}>Tap "Analyze My Data" to get personalized suggestions based on your attendance and schedule.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  analyzeBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    marginHorizontal: 16, marginVertical: 16,
    padding: 14, alignItems: 'center',
  },
  analyzeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzeBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});

const st = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: C.card, borderRadius: 14,
    padding: 16, marginBottom: 12,
  },
  cardMeta: { fontSize: 11, color: C.muted, marginBottom: 8 },
  cardText: { fontSize: 14, color: C.text, lineHeight: 22 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 16, fontSize: 14, lineHeight: 22 },
});
```

- [ ] **Step 5: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ai-suggest/ src/db/aiSuggestions.ts app/ai/
git commit -m "feat: AI analysis screen with Gemini Flash edge function, stores suggestions history"
```

---

### Task 19: Messages — Inbox + Chat Screen

**Files:**
- Create: `src/db/messages.ts`
- Create: `app/messages/_layout.tsx`
- Create: `app/messages/index.tsx`
- Create: `app/messages/[conversationId].tsx`

> **Migration:** Run in Supabase SQL Editor before testing:
>
> ```sql
> create table conversations (
>   id uuid primary key default gen_random_uuid(),
>   participant_a uuid references auth.users(id) on delete cascade not null,
>   participant_b uuid references auth.users(id) on delete cascade not null,
>   last_message text,
>   last_message_at timestamptz,
>   created_at timestamptz default now(),
>   unique (participant_a, participant_b)
> );
> alter table conversations enable row level security;
> create policy "Participants read own conversations"
>   on conversations for select
>   using (auth.uid() = participant_a or auth.uid() = participant_b);
> create policy "Participants update own conversations"
>   on conversations for update
>   using (auth.uid() = participant_a or auth.uid() = participant_b);
> create policy "Authenticated users create conversations"
>   on conversations for insert with check (auth.uid() = participant_a);
>
> create table messages (
>   id uuid primary key default gen_random_uuid(),
>   conversation_id uuid references conversations(id) on delete cascade not null,
>   sender_id uuid references auth.users(id) on delete cascade not null,
>   body text not null,
>   created_at timestamptz default now()
> );
> alter table messages enable row level security;
> create policy "Participants read messages"
>   on messages for select
>   using (
>     exists (
>       select 1 from conversations c
>       where c.id = conversation_id
>         and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
>     )
>   );
> create policy "Participants send messages"
>   on messages for insert
>   with check (
>     auth.uid() = sender_id and
>     exists (
>       select 1 from conversations c
>       where c.id = conversation_id
>         and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
>     )
>   );
>
> -- Helper: get or create a conversation between two users
> create or replace function get_or_create_conversation(other_user_id uuid)
> returns uuid language plpgsql security definer as $$
> declare
>   me uuid := auth.uid();
>   a uuid := least(me, other_user_id);
>   b uuid := greatest(me, other_user_id);
>   conv_id uuid;
> begin
>   select id into conv_id from conversations
>   where participant_a = a and participant_b = b;
>   if conv_id is null then
>     insert into conversations (participant_a, participant_b)
>     values (a, b) returning id into conv_id;
>   end if;
>   return conv_id;
> end;
> $$;
> ```

- [ ] **Step 1: Create `src/db/messages.ts`**

```typescript
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export type Conversation = {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  other_profile?: Profile;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  return data ?? [];
}

export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('conversations')
    .update({ last_message: body, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as Message;
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, roll_number, department, semester')
    .ilike('full_name', `%${query}%`)
    .limit(15);
  return (data ?? []) as Profile[];
}
```

- [ ] **Step 2: Create `app/messages/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function MessagesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Create `app/messages/index.tsx`**

```typescript
import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getConversations, searchProfiles, getOrCreateConversation, type Conversation } from '../../src/db/messages';
import type { Profile } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export default function InboxScreen() {
  const { profile } = useAuthStore();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const data = await getConversations(profile.id);
    setConvos(data);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleSearch(text: string) {
    setQuery(text);
    if (!text.trim()) { setResults([]); return; }
    setSearching(true);
    setResults(await searchProfiles(text.trim()));
    setSearching(false);
  }

  async function openConversation(otherUserId: string) {
    setOpening(otherUserId);
    try {
      const convId = await getOrCreateConversation(otherUserId);
      setShowSearch(false);
      setQuery('');
      setResults([]);
      router.push(`/messages/${convId}`);
    } catch {
      // ignore
    }
    setOpening(null);
  }

  function otherParticipant(conv: Conversation): string {
    return conv.participant_a === profile?.id ? conv.participant_b : conv.participant_a;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Messages</Text>
      </View>

      <FlatList
        data={convos}
        keyExtractor={c => c.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.convoRow}
            onPress={() => router.push(`/messages/${item.id}`)}
            accessibilityLabel="Open conversation"
          >
            <View style={s.avatar}>
              <Ionicons name="person-outline" size={20} color={C.muted} />
            </View>
            <View style={s.convoInfo}>
              <Text style={s.convoName} numberOfLines={1}>
                {otherParticipant(item)}
              </Text>
              <Text style={s.convoLast} numberOfLines={1}>
                {item.last_message ?? 'No messages yet'}
              </Text>
            </View>
            <Text style={s.convoTime}>{fmtTime(item.last_message_at)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <Text style={s.emptyText}>No conversations yet. Tap + to message someone.</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowSearch(true)}
        accessibilityLabel="New message"
      >
        <Ionicons name="create-outline" size={22} color="#0b0c10" />
      </TouchableOpacity>

      <Modal visible={showSearch} animationType="slide" transparent onRequestClose={() => setShowSearch(false)}>
        <View style={s.modalWrap}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>New Message</Text>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search by name…"
                placeholderTextColor={C.muted}
                value={query}
                onChangeText={handleSearch}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={C.muted} />}
            </View>
            <FlatList
              data={results}
              keyExtractor={p => p.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.resultRow}
                  onPress={() => openConversation(item.id)}
                  disabled={opening === item.id}
                >
                  <View style={s.avatar}>
                    <Ionicons name="person-outline" size={18} color={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultName}>{item.full_name}</Text>
                    <Text style={s.resultSub}>{item.department} · S{item.semester}</Text>
                  </View>
                  {opening === item.id && <ActivityIndicator size="small" color={C.accent} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => { setShowSearch(false); setQuery(''); setResults([]); }} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  list: { paddingBottom: 100 },
  convoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1b20',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  convoInfo: { flex: 1 },
  convoName: { fontSize: 15, fontWeight: '600', color: C.text },
  convoLast: { fontSize: 13, color: C.muted, marginTop: 2 },
  convoTime: { fontSize: 11, color: C.muted },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: C.text, fontSize: 14 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1b20',
  },
  resultName: { fontSize: 14, fontWeight: '600', color: C.text },
  resultSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  cancelBtn: { alignItems: 'center', padding: 12, marginTop: 8 },
  cancelText: { color: C.muted, fontSize: 14 },
});
```

- [ ] **Step 4: Create `app/messages/[conversationId].tsx`**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getMessages, sendMessage, type Message } from '../../src/db/messages';
import { supabase } from '../../src/lib/supabase';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function load() {
    const data = await getMessages(conversationId);
    setMessages(data);
  }

  useFocusEffect(useCallback(() => { load(); }, [conversationId]));

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !profile) return;
    setDraft('');
    setSending(true);
    try {
      await sendMessage(conversationId, profile.id, body);
    } catch {
      setDraft(body);
    }
    setSending(false);
  }

  function isMine(msg: Message) {
    return msg.sender_id === profile?.id;
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Chat</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const mine = isMine(item);
          return (
            <View style={[s.bubbleWrap, mine && s.bubbleWrapMine]}>
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                <Text style={[s.bubbleText, mine && s.bubbleTextMine]}>
                  {item.body}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="Message…"
          placeholderTextColor={C.muted}
          value={draft}
          onChangeText={setDraft}
          multiline
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          accessibilityLabel="Send message"
        >
          <Ionicons name="send" size={18} color="#0b0c10" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: C.text, flex: 1 },
  list: { paddingHorizontal: 16, paddingVertical: 12 },
  bubbleWrap: { marginBottom: 8, alignItems: 'flex-start' },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.card,
  },
  bubbleMine: { backgroundColor: C.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleTextMine: { color: '#0b0c10' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#1a1b20',
    backgroundColor: C.bg,
  },
  input: {
    flex: 1, backgroundColor: C.card, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    color: C.text, fontSize: 14, maxHeight: 120, marginRight: 8,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
});
```

- [ ] **Step 5: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/messages.ts app/messages/
git commit -m "feat: messages inbox and realtime chat screen with Supabase Realtime"
```

---

### Task 20: Settings Screen

**Files:**
- Create: `app/settings/_layout.tsx`
- Create: `app/settings/index.tsx`

- [ ] **Step 1: Create `app/settings/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `app/settings/index.tsx`**

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c',
};

const MESS_OPTIONS = ['North Mess', 'South Mess', 'New Mess'];

export default function SettingsScreen() {
  const { profile, setProfile, signOut } = useAuthStore();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [semester, setSemester] = useState(String(profile?.semester ?? ''));
  const [rollNumber, setRollNumber] = useState(profile?.roll_number ?? '');
  const [messName, setMessName] = useState(profile?.mess_name ?? MESS_OPTIONS[0]);
  const [semesterEndDate, setSemesterEndDate] = useState(profile?.semester_end_date ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const semNum = parseInt(semester, 10);
    if (!fullName.trim() || !department.trim() || isNaN(semNum)) {
      Alert.alert('Invalid input', 'Name, department, and semester are required.');
      return;
    }
    if (semesterEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(semesterEndDate)) {
      Alert.alert('Invalid date', 'Semester end date must be in YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    const updates = {
      full_name: fullName.trim(),
      department: department.trim(),
      semester: semNum,
      roll_number: rollNumber.trim() || null,
      mess_name: messName,
      semester_end_date: semesterEndDate.trim() || null,
    };
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile!.id);
    setSaving(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    setProfile({ ...profile!, ...updates });
    Alert.alert('Saved', 'Your profile has been updated.');
  }

  async function handleSignOut() {
    Alert.alert('Sign out?', 'You will need to verify your email again to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <Text style={s.sectionLabel}>Profile</Text>
        <View style={s.group}>
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Full Name</Text>
            <TextInput
              style={s.fieldInput}
              value={fullName}
              onChangeText={setFullName}
              placeholderTextColor={C.muted}
              placeholder="Your name"
              maxLength={80}
            />
          </View>
          <View style={s.divider} />
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Roll Number</Text>
            <TextInput
              style={s.fieldInput}
              value={rollNumber}
              onChangeText={setRollNumber}
              placeholderTextColor={C.muted}
              placeholder="e.g. B220001CS"
              autoCapitalize="characters"
              maxLength={20}
            />
          </View>
          <View style={s.divider} />
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Department</Text>
            <TextInput
              style={s.fieldInput}
              value={department}
              onChangeText={setDepartment}
              placeholderTextColor={C.muted}
              placeholder="e.g. CSE"
              autoCapitalize="characters"
              maxLength={20}
            />
          </View>
          <View style={s.divider} />
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Semester</Text>
            <TextInput
              style={s.fieldInput}
              value={semester}
              onChangeText={setSemester}
              placeholderTextColor={C.muted}
              placeholder="e.g. 4"
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>

        <Text style={s.sectionLabel}>Campus</Text>
        <View style={s.group}>
          <Text style={[s.fieldLabel, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }]}>Mess</Text>
          {MESS_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt}
              style={s.messRow}
              onPress={() => setMessName(opt)}
              accessibilityLabel={`Select ${opt}`}
            >
              <Text style={[s.messLabel, messName === opt && { color: C.accent }]}>{opt}</Text>
              {messName === opt && <Ionicons name="checkmark" size={18} color={C.accent} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionLabel}>Academic Calendar</Text>
        <View style={s.group}>
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Semester End Date</Text>
            <TextInput
              style={s.fieldInput}
              value={semesterEndDate}
              onChangeText={setSemesterEndDate}
              placeholderTextColor={C.muted}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
          <Text style={s.hint}>Used by the AI and attendance engine to compute urgency.</Text>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="Save settings"
        >
          {saving
            ? <ActivityIndicator color="#0b0c10" />
            : <Text style={s.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={18} color={C.danger} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={s.emailNote}>Signed in as {profile?.email}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  scroll: { paddingHorizontal: 16, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 12, color: C.muted, textTransform: 'uppercase',
    letterSpacing: 1, marginTop: 24, marginBottom: 8, marginLeft: 4,
  },
  group: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 4,
  },
  fieldLabel: { fontSize: 14, color: C.text, flex: 1 },
  fieldInput: {
    flex: 2, textAlign: 'right', color: C.text,
    fontSize: 14, paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: '#1a1b20', marginHorizontal: 16 },
  messRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#1a1b20',
  },
  messLabel: { fontSize: 14, color: C.muted },
  hint: { fontSize: 12, color: C.muted, paddingHorizontal: 16, paddingBottom: 12 },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginTop: 28,
  },
  saveBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16, padding: 14,
    backgroundColor: C.card, borderRadius: 999,
  },
  signOutText: { color: C.danger, fontWeight: '600', fontSize: 15 },
  emailNote: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 20 },
});
```

- [ ] **Step 3: Wire sign-out into `useAuthStore`**

Open `src/stores/authStore.ts` and ensure the store exposes a `signOut` action that calls `supabase.auth.signOut()` and clears the profile:

```typescript
signOut: async () => {
  await supabase.auth.signOut();
  set({ profile: null, session: null });
},
```

If `signOut` is already present, skip this step.

- [ ] **Step 4: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/settings/
git commit -m "feat: settings screen — edit profile, mess selector, semester end date, sign out"
```

---

### Task 21: Mess Admin Edge Function + Mess DB Layer

**Files:**
- Create: `supabase/functions/mess-admin/index.ts`
- Create: `src/db/mess.ts`

> **Migration:** Run in Supabase SQL Editor before testing:
>
> ```sql
> -- Add is_admin flag to profiles if not present
> alter table profiles add column if not exists is_admin boolean default false;
>
> create table if not exists mess_cycles (
>   id uuid primary key default gen_random_uuid(),
>   mess_name text not null,
>   cycle_length int not null check (cycle_length > 0),
>   cycle_start_date date not null,
>   active boolean default true,
>   created_at timestamptz default now()
> );
>
> create table if not exists mess_meals (
>   id uuid primary key default gen_random_uuid(),
>   cycle_id uuid references mess_cycles(id) on delete cascade not null,
>   day_number int not null check (day_number >= 1),
>   meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snacks', 'dinner')),
>   items text[] not null default '{}',
>   unique (cycle_id, day_number, meal_type)
> );
>
> alter table mess_cycles enable row level security;
> alter table mess_meals enable row level security;
>
> create policy "Public read mess cycles" on mess_cycles for select using (true);
> create policy "Public read mess meals" on mess_meals for select using (true);
> ```
>
> **Grant admin:** `update profiles set is_admin = true where email = '<admin-email>';`

- [ ] **Step 1: Create `supabase/functions/mess-admin/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UpsertCycleBody = {
  action: 'upsert_cycle';
  mess_name: string;
  cycle_length: number;
  cycle_start_date: string; // YYYY-MM-DD
  meals: Array<{
    day_number: number;
    meal_type: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
    items: string[];
  }>;
};

type DeactivateBody = {
  action: 'deactivate_cycle';
  cycle_id: string;
};

type Body = UpsertCycleBody | DeactivateBody;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: CORS });
  }

  // Verify caller is admin
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: CORS });
  }

  const body = await req.json() as Body;

  if (body.action === 'deactivate_cycle') {
    await db.from('mess_cycles').update({ active: false }).eq('id', body.cycle_id);
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  if (body.action === 'upsert_cycle') {
    const { mess_name, cycle_length, cycle_start_date, meals } = body;

    // Deactivate existing active cycles for this mess
    await db.from('mess_cycles')
      .update({ active: false })
      .eq('mess_name', mess_name)
      .eq('active', true);

    // Insert new cycle
    const { data: cycle, error: cycleErr } = await db
      .from('mess_cycles')
      .insert({ mess_name, cycle_length, cycle_start_date, active: true })
      .select('id')
      .single();

    if (cycleErr || !cycle) {
      return new Response(JSON.stringify({ error: cycleErr?.message ?? 'Insert failed' }), { status: 500, headers: CORS });
    }

    // Insert meals
    const mealRows = meals.map(m => ({
      cycle_id: cycle.id,
      day_number: m.day_number,
      meal_type: m.meal_type,
      items: m.items,
    }));

    const { error: mealsErr } = await db.from('mess_meals').insert(mealRows);
    if (mealsErr) {
      return new Response(JSON.stringify({ error: mealsErr.message }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true, cycle_id: cycle.id }), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS });
});
```

- [ ] **Step 2: Create `src/db/mess.ts`**

```typescript
import { supabase } from '../lib/supabase';

export type MessMeal = {
  meal_type: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  items: string[];
};

export type TodayMenu = {
  mess_name: string;
  day_number: number;
  meals: MessMeal[];
};

function cycleDayNumber(cycleStartDate: string, cycleLength: number): number {
  const start = new Date(cycleStartDate);
  const today = new Date();
  // Zero out time so we compare calendar days only
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return (((diff % cycleLength) + cycleLength) % cycleLength) + 1;
}

export async function getTodayMenu(messName: string): Promise<TodayMenu | null> {
  const { data: cycle } = await supabase
    .from('mess_cycles')
    .select('id, cycle_length, cycle_start_date')
    .eq('mess_name', messName)
    .eq('active', true)
    .single();

  if (!cycle) return null;

  const dayNumber = cycleDayNumber(cycle.cycle_start_date, cycle.cycle_length);

  const { data: meals } = await supabase
    .from('mess_meals')
    .select('meal_type, items')
    .eq('cycle_id', cycle.id)
    .eq('day_number', dayNumber)
    .order('meal_type');

  return {
    mess_name: messName,
    day_number: dayNumber,
    meals: (meals ?? []) as MessMeal[],
  };
}

export async function callMessAdmin(body: {
  action: 'upsert_cycle';
  mess_name: string;
  cycle_length: number;
  cycle_start_date: string;
  meals: Array<{ day_number: number; meal_type: string; items: string[] }>;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('mess-admin', { body });
  if (error) throw error;
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/mess-admin/ src/db/mess.ts
git commit -m "feat: mess-admin edge function for cycle upload, mess DB layer with cycle-day computation"
```

---

### Task 22: Notifications — Daily Reminder

**Files:**
- Modify: `src/engine/notifications.ts`
- Create: `src/hooks/useNotifications.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Replace `src/engine/notifications.ts`**

Open the file and replace its entire contents with:

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: asked } = await Notifications.requestPermissionsAsync();
  return asked === 'granted';
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  title: string,
  body: string,
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(n => n.content.data?.type === 'daily_reminder')
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { type: 'daily_reminder' } },
    trigger: { hour, minute, repeats: true } as Notifications.DailyTriggerInput,
  });
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
```

- [ ] **Step 2: Create `src/hooks/useNotifications.ts`**

```typescript
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { requestNotificationPermission, scheduleDailyReminder } from '../engine/notifications';
import { supabase } from '../lib/supabase';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function buildReminderContent(userId: string): Promise<{ title: string; body: string }> {
  const today = DAYS[new Date().getDay()];

  // Today's first class
  const { data: slots } = await supabase
    .from('user_timetable')
    .select('subject_name, timetable_slots(start_time, end_time, day)')
    .eq('user_id', userId);

  const todaySlots = (slots ?? [])
    .filter((s: any) => s.timetable_slots?.day === today)
    .sort((a: any, b: any) =>
      (a.timetable_slots?.start_time ?? '').localeCompare(b.timetable_slots?.start_time ?? ''),
    );

  // Attendance at-risk subjects (< 75% in last 90 days)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: records } = await supabase
    .from('attendance_records')
    .select('slot_id, status')
    .eq('user_id', userId)
    .gte('date', since);

  const subjectTotals: Record<string, { present: number; total: number; name: string }> = {};
  for (const slot of (slots ?? [])) {
    const name = (slot as any).subject_name as string;
    if (!subjectTotals[name]) subjectTotals[name] = { present: 0, total: 0, name };
  }
  for (const slot of (slots ?? [])) {
    const name = (slot as any).subject_name as string;
    const slotId = (slot as any).slot_id ?? (slot as any).id;
    const slotRecords = (records ?? []).filter((r: any) => r.slot_id === slotId);
    if (subjectTotals[name]) {
      subjectTotals[name].total += slotRecords.length;
      subjectTotals[name].present += slotRecords.filter((r: any) => r.status === 'present').length;
    }
  }
  const atRisk = Object.values(subjectTotals).filter(
    s => s.total > 0 && s.present / s.total < 0.75,
  );

  let body: string;
  if (todaySlots.length > 0) {
    const first = todaySlots[0] as any;
    body = `First class: ${first.subject_name} at ${first.timetable_slots?.start_time ?? ''}`;
  } else {
    body = 'No classes today. Good time to catch up!';
  }

  if (atRisk.length > 0) {
    body += `\n⚠️ ${atRisk[0].name} attendance below 75%`;
  }

  return { title: 'Good morning! 👋', body };
}

export function useNotifications() {
  const { profile } = useAuthStore();

  async function refresh() {
    if (!profile) return;
    const granted = await requestNotificationPermission();
    if (!granted) return;
    try {
      const { title, body } = await buildReminderContent(profile.id);
      await scheduleDailyReminder(7, 0, title, body);
    } catch {
      // Notification scheduling is best-effort — never crash the app
    }
  }

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [profile?.id]);
}
```

- [ ] **Step 3: Call the hook from `app/_layout.tsx`**

Open `app/_layout.tsx`. Find the root layout component body and add the hook call after existing hook calls:

```typescript
// At the top of the file, add:
import { useNotifications } from '../src/hooks/useNotifications';

// Inside the root layout component, add one line:
useNotifications();
```

The hook is side-effect only — it registers no UI, so placing it anywhere inside the component body is fine.

- [ ] **Step 4: TypeScript check**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/notifications.ts src/hooks/useNotifications.ts app/_layout.tsx
git commit -m "feat: daily notification reminder with today's first class and attendance risk warning"
```

---

### Task 23: Final Verification

**Files:** None created. This task validates the full build.

- [ ] **Step 1: TypeScript — zero errors**

```bash
cd /d/StudentOS && npx tsc --noEmit 2>&1
```

Expected: no output (zero errors). If errors appear, fix them before continuing.

- [ ] **Step 2: Run the test suite**

```bash
cd /d/StudentOS && npx jest --passWithNoTests 2>&1 | tail -20
```

Expected: all tests pass, test suites pass. The prediction engine tests from Task 5 should all be green.

- [ ] **Step 3: Verify all screen routes exist**

```bash
find /d/StudentOS/app -name "*.tsx" | sort
```

Expected output includes at minimum:
```
app/_layout.tsx
app/index.tsx               (or app/(auth)/login.tsx — onboarding entry)
app/(tabs)/_layout.tsx
app/(tabs)/index.tsx        (Home dashboard)
app/(tabs)/all.tsx          (All-features 3×3 grid)
app/timetable/_layout.tsx
app/timetable/index.tsx
app/attendance/_layout.tsx
app/attendance/index.tsx
app/attendance/[subject].tsx
app/feed/_layout.tsx
app/feed/index.tsx
app/wall/_layout.tsx
app/wall/index.tsx
app/notes/_layout.tsx
app/notes/index.tsx
app/gym/_layout.tsx
app/gym/index.tsx
app/ai/_layout.tsx
app/ai/index.tsx
app/messages/_layout.tsx
app/messages/index.tsx
app/messages/[conversationId].tsx
app/settings/_layout.tsx
app/settings/index.tsx
```

If any route file is missing, create a minimal stub:

```typescript
import { View, Text } from 'react-native';
export default function StubScreen() {
  return <View style={{ flex: 1, backgroundColor: '#0b0c10' }}><Text style={{ color: '#eaeaea', padding: 20 }}>Coming soon</Text></View>;
}
```

- [ ] **Step 4: Verify Supabase Edge Functions exist**

```bash
find /d/StudentOS/supabase/functions -name "index.ts" | sort
```

Expected:
```
supabase/functions/ai-suggest/index.ts
supabase/functions/mess-admin/index.ts
```

- [ ] **Step 5: Verify DB modules exist**

```bash
find /d/StudentOS/src/db -name "*.ts" | sort
```

Expected:
```
src/db/attendance.ts
src/db/feed.ts
src/db/gym.ts
src/db/aiSuggestions.ts
src/db/messages.ts
src/db/mess.ts
src/db/notes.ts
src/db/timetable.ts
src/db/wall.ts
```

- [ ] **Step 6: Review git log**

```bash
cd /d/StudentOS && git log --oneline | head -30
```

Expected: one commit per feature task. Confirm all tasks 1–22 have a corresponding commit.

- [ ] **Step 7: Commit the completed plan**

```bash
cd /d/StudentOS && git add docs/superpowers/plans/2026-04-22-studentos-v2.md && git commit -m "docs: complete V2 implementation plan (23 tasks)"
```

---

## Supabase Setup Checklist

Before running the app, complete these steps in the Supabase dashboard:

**SQL Editor — run all migrations in order:**
1. `profiles` table (Task 2)
2. `timetable_slots`, `user_timetable`, `attendance_records`, `academic_calendar` (Task 3)
3. `feed_posts`, `wall_entries`, `notes` tables (Tasks 13–15)
4. `gym_sessions` (Task 17)
5. `ai_suggestions` (Task 18)
6. `conversations`, `messages` (Task 19)
7. `mess_cycles`, `mess_meals`, add `is_admin` to profiles (Task 21)
8. `increment_download_count` RPC (Task 16 note)
9. `get_or_create_conversation` function (Task 19 note)

**Authentication:**
- Enable Email (OTP / magic link) provider
- Add allowed email domain restriction: `@nitc.ac.in`

**Storage:**
- Create bucket `notes`, set public = false
- RLS: allow authenticated users to upload; allow `getSignedUrl` reads

**Edge Function Secrets:**
- `GEMINI_API_KEY` (for `ai-suggest`)

**Realtime:**
- Enable Realtime on tables: `messages`, `wall_entries`, `feed_posts`

**Admin account:**
- `update profiles set is_admin = true where email = '<your-admin-email>';`
