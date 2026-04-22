import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getFeedPosts, createFeedPost } from '../../src/db/feed';
import { supabase } from '../../src/lib/supabase';
import FeedCard from '../../src/components/FeedCard';
import type { FeedPost } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const EXPIRY_OPTIONS = [
  { label: '1 hour',  hours: 1 },
  { label: '3 hours', hours: 3 },
  { label: '6 hours', hours: 6 },
  { label: '24 hours', hours: 24 },
];

export default function FeedScreen() {
  const { profile } = useAuthStore();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [location, setLocation] = useState('');
  const [expiryHours, setExpiryHours] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const data = await getFeedPosts();
    setPosts(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadPosts(); }, [loadPosts]));

  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_posts' },
        () => { loadPosts(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPosts]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if (!body.trim()) { Alert.alert('Body required'); return; }
    if (!profile) return;
    setSubmitting(true);
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();
    await createFeedPost(
      profile.id,
      title.trim(),
      body.trim(),
      location.trim() || null,
      expiresAt,
    );
    setSubmitting(false);
    setShowCreate(false);
    setTitle(''); setBody(''); setLocation(''); setExpiryHours(3);
    loadPosts();
  }, [profile, title, body, location, expiryHours, loadPosts]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Feed</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={loadPosts}
        renderItem={({ item }) => <FeedCard post={item} />}
        ListEmptyComponent={
          loading ? null : (
            <Text style={s.emptyText}>No active posts. Be the first to post!</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowCreate(true)}
        accessibilityLabel="Create post"
      >
        <Ionicons name="add" size={28} color="#0b0c10" />
      </TouchableOpacity>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView
          style={s.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>New Post</Text>

            <TextInput
              style={s.input}
              placeholder="Title"
              placeholderTextColor={C.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              accessibilityLabel="Post title"
            />
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="What's happening? (free food, event, announcement…)"
              placeholderTextColor={C.muted}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={400}
              accessibilityLabel="Post body"
            />
            <TextInput
              style={s.input}
              placeholder="Location (optional)"
              placeholderTextColor={C.muted}
              value={location}
              onChangeText={setLocation}
              maxLength={80}
              accessibilityLabel="Post location"
            />

            <Text style={s.fieldLabel}>Expires in</Text>
            <View style={s.expiryRow}>
              {EXPIRY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.hours}
                  style={[s.expiryBtn, expiryHours === opt.hours && s.expiryBtnActive]}
                  onPress={() => setExpiryHours(opt.hours)}
                  accessibilityLabel={`Expire in ${opt.label}`}
                >
                  <Text style={[
                    s.expiryBtnText,
                    expiryHours === opt.hours && { color: '#0b0c10' },
                  ]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={submitting}
              accessibilityLabel="Submit post"
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
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
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
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16 },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 13, color: C.text, fontSize: 14, marginBottom: 10,
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12, color: C.muted, marginBottom: 8 },
  expiryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  expiryBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 8,
    backgroundColor: '#1a1b20', alignItems: 'center',
  },
  expiryBtnActive: { backgroundColor: C.accent },
  expiryBtnText: { fontSize: 12, color: C.muted, fontWeight: '500' },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  submitBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: C.muted, fontSize: 14 },
});
