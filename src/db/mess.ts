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

  const dayNumber = cycleDayNumber(cycle.cycle_start_date as string, cycle.cycle_length as number);

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

export async function callMessAdmin(
  body:
    | {
        action: 'upsert_cycle';
        mess_name: string;
        cycle_length: number;
        cycle_start_date: string;
        meals: Array<{ day_number: number; meal_type: string; items: string[] }>;
      }
    | { action: 'deactivate_cycle'; cycle_id: string },
): Promise<void> {
  const { error } = await supabase.functions.invoke('mess-admin', { body });
  if (error) throw error;
}
