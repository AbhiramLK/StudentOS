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
