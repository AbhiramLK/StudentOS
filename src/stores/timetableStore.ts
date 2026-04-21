import { create } from 'zustand';
import type { TimetableSlot, UserTimetableEntry, AcademicCalendarEntry } from '../types';
import { getAllSlots, getUserTimetable } from '../db/timetable';
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
      getAllSlots(),
      getUserTimetable(userId),
      getCalendarEntries(),
    ]);
    set({ slots, userEntries, calendarEntries, loading: false });
  },
  reset: () => set({ slots: [], userEntries: [], calendarEntries: [], loading: false }),
}));
