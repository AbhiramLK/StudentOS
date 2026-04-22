import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuthStore } from '../../src/stores/authStore';
import { getNotesBySubject, getNotesBySemester, uploadNote, getSignedUrl, incrementDownloadCount } from '../../src/db/notes';
import { supabase } from '../../src/lib/supabase';
import NoteCard from '../../src/components/NoteCard';
import type { Note } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

type FilterMode = 'subject' | 'semester';

export default function NotesScreen() {
  const { profile } = useAuthStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('subject');
  const [filterValue, setFilterValue] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadSemester, setUploadSemester] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function loadNotes() {
    if (!filterValue.trim()) { setNotes([]); return; }
    setLoading(true);
    const data = filterMode === 'subject'
      ? await getNotesBySubject(filterValue.trim())
      : await getNotesBySemester(filterValue.trim());
    setNotes(data);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { loadNotes(); }, [filterMode, filterValue]));

  useEffect(() => { loadNotes(); }, [filterMode, filterValue]);

  async function handleUpload() {
    if (!uploadTitle.trim() || !uploadSubject.trim() || !uploadSemester.trim()) {
      Alert.alert('All fields required');
      return;
    }
    if (!profile) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const ext = asset.name.split('.').pop() ?? 'pdf';
    const storagePath = `${profile.id}/${Date.now()}.${ext}`;

    setUploading(true);
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('notes')
      .upload(storagePath, blob, { contentType: asset.mimeType ?? 'application/octet-stream' });

    if (uploadError) {
      setUploading(false);
      Alert.alert('Upload failed', uploadError.message);
      return;
    }

    await uploadNote(profile.id, uploadSubject.trim(), uploadSemester.trim(), uploadTitle.trim(), storagePath);
    setUploading(false);
    setShowUpload(false);
    setUploadTitle(''); setUploadSubject(''); setUploadSemester('');
    loadNotes();
  }

  async function handleDownload(note: Note) {
    setDownloading(note.id);
    try {
      const url = await getSignedUrl(note.file_path);
      await incrementDownloadCount(note.id);
      await Linking.openURL(url);
      setNotes(prev => prev.map(n => n.id === note.id
        ? { ...n, download_count: n.download_count + 1 }
        : n,
      ));
    } catch {
      Alert.alert('Download failed', 'Could not open the file.');
    }
    setDownloading(null);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Notes</Text>
      </View>

      {/* Filter toggle */}
      <View style={s.segmentRow}>
        {(['subject', 'semester'] as FilterMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[s.segBtn, filterMode === mode && s.segBtnActive]}
            onPress={() => { setFilterMode(mode); setFilterValue(''); }}
            accessibilityLabel={`Filter by ${mode}`}
          >
            <Text style={[s.segBtnText, filterMode === mode && { color: '#0b0c10' }]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={C.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder={filterMode === 'subject' ? 'e.g. Maths' : 'e.g. S4'}
          placeholderTextColor={C.muted}
          value={filterValue}
          onChangeText={setFilterValue}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={loadNotes}
        renderItem={({ item }) => (
          <View style={s.noteWrap}>
            <NoteCard note={item} onPress={() => handleDownload(item)} />
            {downloading === item.id && (
              <ActivityIndicator
                color={C.accent}
                style={s.downloadSpinner}
                size="small"
              />
            )}
          </View>
        )}
        ListEmptyComponent={
          filterValue.trim() === '' ? (
            <Text style={s.emptyText}>Enter a subject or semester to browse notes.</Text>
          ) : loading ? null : (
            <Text style={s.emptyText}>No notes found for "{filterValue}".</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowUpload(true)}
        accessibilityLabel="Upload note"
      >
        <Ionicons name="cloud-upload-outline" size={24} color="#0b0c10" />
      </TouchableOpacity>

      <Modal
        visible={showUpload}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUpload(false)}
      >
        <KeyboardAvoidingView
          style={s.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Upload Note</Text>
            <TextInput
              style={s.input}
              placeholder="Title (e.g. Unit 3 Notes)"
              placeholderTextColor={C.muted}
              value={uploadTitle}
              onChangeText={setUploadTitle}
              maxLength={80}
            />
            <TextInput
              style={s.input}
              placeholder="Subject (e.g. Maths)"
              placeholderTextColor={C.muted}
              value={uploadSubject}
              onChangeText={setUploadSubject}
              maxLength={60}
            />
            <TextInput
              style={s.input}
              placeholder="Semester (e.g. S4)"
              placeholderTextColor={C.muted}
              value={uploadSemester}
              onChangeText={setUploadSemester}
              maxLength={10}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[s.submitBtn, uploading && { opacity: 0.6 }]}
              onPress={handleUpload}
              disabled={uploading}
              accessibilityLabel="Pick file and upload"
            >
              {uploading
                ? <ActivityIndicator color="#0b0c10" />
                : (
                  <View style={s.submitBtnInner}>
                    <Ionicons name="document-attach-outline" size={18} color="#0b0c10" />
                    <Text style={s.submitBtnText}>Pick File & Upload</Text>
                  </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowUpload(false)}
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
  segmentRow: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: C.card, borderRadius: 10,
    padding: 4, marginBottom: 12,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segBtnActive: { backgroundColor: C.accent },
  segBtnText: { fontSize: 13, fontWeight: '600', color: C.muted },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 10,
    marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: C.text, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  noteWrap: { position: 'relative' },
  downloadSpinner: { position: 'absolute', right: 16, top: 14 },
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
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 13, color: C.text, fontSize: 14, marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  submitBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: C.muted, fontSize: 14 },
});
