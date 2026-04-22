import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getMessMenuForDay, computeDayCycle } from '../../src/db/mess';
import { supabase } from '../../src/lib/supabase';
import MealRow from '../../src/components/MealRow';
import type { Mess, MessMenu } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const MEAL_ORDER = ['breakfast', 'lunch', 'evening', 'dinner'] as const;

export default function MessScreen() {
  const { profile } = useAuthStore();
  const [mess, setMess] = useState<Mess | null>(null);
  const [menus, setMenus] = useState<MessMenu[]>([]);
  const [dayCycle, setDayCycle] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.mess_id) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('messes')
      .select('*')
      .eq('id', profile.mess_id)
      .single()
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        const typedMess = data as Mess;
        const cycle = computeDayCycle(typedMess.cycle_start_date, typedMess.cycle_length);
        setMess(typedMess);
        setDayCycle(cycle);
        const menuData = await getMessMenuForDay(typedMess.id, cycle);
        setMenus(menuData);
        setLoading(false);
      });
  }, [profile?.mess_id]);

  const meals = useMemo(() =>
    MEAL_ORDER.map(meal => ({
      meal,
      items: menus.find(m => m.meal === meal)?.items ?? [],
    })),
    [menus],
  );

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Mess Menu</Text>
          {mess && <Text style={s.messName}>{mess.name}</Text>}
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : !profile?.mess_id ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No mess selected.</Text>
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Go to settings to select mess"
          >
            <Text style={s.settingsBtnText}>Select in Settings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.dateBadge}>
            <Text style={s.dateText}>{todayStr}</Text>
            {dayCycle !== null && (
              <View style={s.cycleBadge}>
                <Text style={s.cycleText}>Day {dayCycle}</Text>
              </View>
            )}
          </View>

          <View style={s.card}>
            {meals.map(({ meal, items }) => (
              <MealRow key={meal} meal={meal} items={items} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 20, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  messName: { fontSize: 13, color: C.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 14, color: C.muted },
  settingsBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  settingsBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 80 },
  dateBadge: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  dateText: { fontSize: 14, color: C.muted },
  cycleBadge: {
    backgroundColor: '#1a3a38', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  cycleText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  card: {
    backgroundColor: C.card, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 4,
  },
});
