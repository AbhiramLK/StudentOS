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
