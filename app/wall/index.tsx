import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWallEntries, createWallEntry } from '../../src/db/wall';
import { supabase } from '../../src/lib/supabase';
import WallCard from '../../src/components/WallCard';
import type { WallEntry } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const COLORS = ['#66fcf1', '#ffc857', '#ff5c5c', '#a78bfa', '#34d399', '#fb923c'];

export default function WallScreen() {
  const [entries, setEntries] = useState<WallEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const data = await getWallEntries();
    setEntries(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadEntries(); }, [loadEntries]));

  useEffect(() => {
    const channel = supabase
      .channel('wall-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wall_entries' },
        payload => {
          setEntries(prev => [payload.new as WallEntry, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleCreate() {
    if (!content.trim()) return;
    setSubmitting(true);
    await createWallEntry(content.trim(), selectedColor);
    setSubmitting(false);
    setShowCreate(false);
    setContent('');
    setSelectedColor(COLORS[0]);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Wall</Text>
          <Text style={s.subtitle}>Anonymous · expires in 24h</Text>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={loadEntries}
        renderItem={({ item }) => <WallCard entry={item} />}
        ListEmptyComponent={
          loading ? null : (
            <Text style={s.emptyText}>The wall is empty. Leave a message.</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowCreate(true)}
        accessibilityLabel="Add to wall"
      >
        <Ionicons name="pencil" size={22} color="#0b0c10" />
      </TouchableOpacity>

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={s.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Leave a message</Text>
            <Text style={s.sheetSub}>Anonymous · disappears in 24 hours</Text>

            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Say something…"
              placeholderTextColor={C.muted}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={280}
              autoFocus
            />
            <Text style={s.charCount}>{content.length}/280</Text>

            <Text style={s.fieldLabel}>Colour</Text>
            <View style={s.colorRow}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    s.colorDot,
                    { backgroundColor: color },
                    selectedColor === color && s.colorDotSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                  accessibilityLabel={`Select color ${color}`}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, (!content.trim() || submitting) && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!content.trim() || submitting}
              accessibilityLabel="Post to wall"
            >
              {submitting
                ? <ActivityIndicator color="#0b0c10" />
                : <Text style={s.submitBtnText}>Post</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowCreate(false)}
              style={s.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  subtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 60, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  sheetSub: { fontSize: 12, color: C.muted, marginBottom: 16 },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 13, color: C.text, fontSize: 14, marginBottom: 4,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: C.muted, textAlign: 'right', marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: C.muted, marginBottom: 10 },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff' },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  submitBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: C.muted, fontSize: 14 },
});
