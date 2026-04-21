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
