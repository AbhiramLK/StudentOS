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
