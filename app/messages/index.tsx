import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import {
  getConversations, searchProfiles, getOrCreateConversation,
} from '../../src/db/messages';
import { supabase } from '../../src/lib/supabase';
import type { Conversation, Profile } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export default function InboxScreen() {
  const { profile } = useAuthStore();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const data = await getConversations(profile.id);
    setConvos(data);

    // Batch-fetch names for all other participants
    const otherIds = data.map(c => c.user_a === profile.id ? c.user_b : c.user_a);
    const uniqueIds = [...new Set(otherIds)];
    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', uniqueIds);
      if (profiles) {
        const map: Record<string, string> = {};
        for (const p of profiles) {
          map[p.id] = p.name;
        }
        setNameMap(map);
      }
    }

    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (!text.trim()) { setResults([]); return; }
    setSearching(true);
    setResults(await searchProfiles(text.trim()));
    setSearching(false);
  }, []);

  const openConversation = useCallback(async (otherUserId: string) => {
    if (!profile) return;
    setOpening(otherUserId);
    try {
      const convId = await getOrCreateConversation(profile.id, otherUserId);
      setShowSearch(false);
      setQuery('');
      setResults([]);
      router.push(`/messages/${convId}` as any);
    } catch {
      // ignore
    }
    setOpening(null);
  }, [profile]);

  function otherParticipantId(conv: Conversation): string {
    return conv.user_a === profile?.id ? conv.user_b : conv.user_a;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Messages</Text>
      </View>

      <FlatList
        data={convos}
        keyExtractor={c => c.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => {
          const otherId = otherParticipantId(item);
          const displayName = nameMap[otherId] ?? otherId;
          return (
            <TouchableOpacity
              style={s.convoRow}
              onPress={() => router.push(`/messages/${item.id}` as any)}
              accessibilityLabel={`Open conversation with ${displayName}`}
            >
              <View style={s.avatar}>
                <Ionicons name="person-outline" size={20} color={C.muted} />
              </View>
              <View style={s.convoInfo}>
                <Text style={s.convoName} numberOfLines={1}>{displayName}</Text>
                <Text style={s.convoLast} numberOfLines={1}>
                  {item.updated_at ? fmtTime(item.updated_at) : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? null : (
            <Text style={s.emptyText}>No conversations yet. Tap + to message someone.</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowSearch(true)}
        accessibilityLabel="New message"
      >
        <Ionicons name="create-outline" size={22} color="#0b0c10" />
      </TouchableOpacity>

      <Modal visible={showSearch} animationType="slide" transparent onRequestClose={() => setShowSearch(false)}>
        <View style={s.modalWrap}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>New Message</Text>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search by name…"
                placeholderTextColor={C.muted}
                value={query}
                onChangeText={handleSearch}
                autoFocus
                accessibilityLabel="Search users by name"
              />
              {searching && <ActivityIndicator size="small" color={C.muted} />}
            </View>
            <FlatList
              data={results}
              keyExtractor={p => p.id}
              style={s.resultList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.resultRow}
                  onPress={() => openConversation(item.id)}
                  disabled={opening === item.id}
                  accessibilityLabel={`Message ${item.name}`}
                >
                  <View style={s.avatar}>
                    <Ionicons name="person-outline" size={18} color={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultName}>{item.name}</Text>
                    {item.roll_number && <Text style={s.resultSub}>{item.roll_number}</Text>}
                  </View>
                  {opening === item.id && <ActivityIndicator size="small" color={C.accent} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => { setShowSearch(false); setQuery(''); setResults([]); }}
              style={s.cancelBtn}
              accessibilityLabel="Cancel new message"
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  list: { paddingBottom: 100 },
  convoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1b20',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  convoInfo: { flex: 1 },
  convoName: { fontSize: 15, fontWeight: '600', color: C.text },
  convoLast: { fontSize: 13, color: C.muted, marginTop: 2 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: C.text, fontSize: 14 },
  resultList: { maxHeight: 300 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1b20',
  },
  resultName: { fontSize: 14, fontWeight: '600', color: C.text },
  resultSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  cancelBtn: { alignItems: 'center', padding: 12, marginTop: 8 },
  cancelText: { color: C.muted, fontSize: 14 },
});
