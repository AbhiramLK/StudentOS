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
