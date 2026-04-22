import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getAiSuggestions, callAiSuggest, type AiSuggestion } from '../../src/db/aiSuggestions';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH[d.getMonth()]} · ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function AiScreen() {
  const { profile } = useAuthStore();
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setSuggestions(await getAiSuggestions(profile.id));
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAnalyze = useCallback(async () => {
    if (!profile) return;
    setAnalyzing(true);
    try {
      const text = await callAiSuggest(profile.id);
      setSuggestions(prev => [{
        id: Date.now().toString(),
        user_id: profile.id,
        suggestion: text,
        created_at: new Date().toISOString(),
      }, ...prev]);
    } catch {
      Alert.alert('Analysis failed', 'Could not reach AI. Check your connection and try again.');
    }
    setAnalyzing(false);
  }, [profile]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Analysis</Text>
      </View>

      <TouchableOpacity
        style={[styles.analyzeBtn, analyzing && { opacity: 0.6 }]}
        onPress={handleAnalyze}
        disabled={analyzing}
        accessibilityLabel="Get AI analysis"
      >
        {analyzing ? (
          <View style={styles.analyzeBtnInner}>
            <ActivityIndicator color="#0b0c10" size="small" />
            <Text style={styles.analyzeBtnText}>Analyzing…</Text>
          </View>
        ) : (
          <View style={styles.analyzeBtnInner}>
            <Ionicons name="sparkles-outline" size={18} color="#0b0c10" />
            <Text style={styles.analyzeBtnText}>Analyze My Data</Text>
          </View>
        )}
      </TouchableOpacity>

      <FlatList
        data={suggestions}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardMeta}>{fmtDateTime(item.created_at)}</Text>
            <Text style={styles.cardText}>{item.suggestion}</Text>
          </View>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyWrap}>
              <Ionicons name="sparkles-outline" size={40} color={C.muted} />
              <Text style={styles.emptyText}>Tap "Analyze My Data" to get personalized suggestions based on your attendance and schedule.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  analyzeBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    marginHorizontal: 16, marginVertical: 16,
    padding: 14, alignItems: 'center',
  },
  analyzeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzeBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: C.card, borderRadius: 14,
    padding: 16, marginBottom: 12,
  },
  cardMeta: { fontSize: 11, color: C.muted, marginBottom: 8 },
  cardText: { fontSize: 14, color: C.text, lineHeight: 22 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 16, fontSize: 14, lineHeight: 22 },
});
