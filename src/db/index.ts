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
