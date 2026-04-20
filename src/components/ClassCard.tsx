import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VerdictChip } from './VerdictChip';
import type { TimetableSlot, Subject, PredictionResult } from '../types';

interface Props {
  slot: TimetableSlot;
  subject: Subject;
  prediction: PredictionResult;
  markedStatus: 'present' | 'absent' | null;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
}

export function ClassCard({ slot, subject, prediction, markedStatus, onMarkPresent, onMarkAbsent }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.name}>{subject.name}</Text>
        <Text style={styles.time}>{slot.start_time} – {slot.end_time}</Text>
      </View>
      <VerdictChip verdict={prediction.verdict} message={prediction.message} />
      {markedStatus == null ? (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.presentBtn]} onPress={onMarkPresent}>
            <Text style={styles.btnText}>Present</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.absentBtn]} onPress={onMarkAbsent}>
            <Text style={styles.btnText}>Absent</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.marked}>
          {markedStatus === 'present' ? '✓ Marked present' : '✗ Marked absent'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 6, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600', color: '#111827' },
  time: { fontSize: 13, color: '#6b7280' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  presentBtn: { backgroundColor: '#dcfce7' },
  absentBtn: { backgroundColor: '#fee2e2' },
  btnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  marked: { marginTop: 8, fontSize: 13, color: '#6b7280' },
});
