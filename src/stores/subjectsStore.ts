import { create } from 'zustand';
import {
  getAllSubjects, createSubject, updateSubject, deleteSubject,
} from '../db/subjects';
import type { Subject } from '../types';

interface SubjectsState {
  subjects: Subject[];
  load: () => void;
  add: (name: string, threshold?: number) => void;
  update: (id: string, name: string, threshold: number) => void;
  remove: (id: string) => void;
}

export const useSubjectsStore = create<SubjectsState>((set) => ({
  subjects: [],
  load: () => set({ subjects: getAllSubjects() }),
  add: (name, threshold = 75) => {
    createSubject(name, threshold);
    set({ subjects: getAllSubjects() });
  },
  update: (id, name, threshold) => {
    updateSubject(id, name, threshold);
    set({ subjects: getAllSubjects() });
  },
  remove: (id) => {
    deleteSubject(id);
    set({ subjects: getAllSubjects() });
  },
}));
