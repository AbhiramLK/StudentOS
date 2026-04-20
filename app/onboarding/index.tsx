import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { saveSettings } from '../../src/db/settings';

export default function OnboardingSemester() {
  const router = useRouter();
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMonth(11, 1);
    return d;
  });

  const handleNext = () => {
    saveSettings(date.toISOString().split('T')[0]);
    router.push('/onboarding/subjects');
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>When does your semester end?</Text>
      <Text style={s.sub}>Used to predict how many classes you can skip.</Text>
      <DateTimePicker
        value={date}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        minimumDate={new Date()}
        onChange={(_, selected) => selected && setDate(selected)}
      />
      <TouchableOpacity style={s.btn} onPress={handleNext}>
        <Text style={s.btnText}>Next →</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
        <Text style={s.skip}>Skip setup</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15, color: '#6b7280', marginBottom: 32 },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skip: { textAlign: 'center', marginTop: 16, color: '#9ca3af' },
});
