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
