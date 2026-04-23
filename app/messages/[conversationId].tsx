import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getMessages, sendMessage } from '../../src/db/messages';
import { supabase } from '../../src/lib/supabase';
import type { Message } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const data = await getMessages(conversationId, profile.id);
    setMessages(data);
    // Derive receiver from conversation (first message or conversation row)
    if (!receiverId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('user_a, user_b')
        .eq('id', conversationId)
        .single();
      if (conv) {
        setReceiverId(conv.user_a === profile.id ? conv.user_b : conv.user_a);
      }
    }
  }, [conversationId, profile, receiverId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${profile.id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, profile]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || !profile || !receiverId) return;
    setDraft('');
    setSending(true);
    try {
      await sendMessage(conversationId, profile.id, receiverId, body);
    } catch {
      setDraft(body);
    }
    setSending(false);
  }, [draft, profile, receiverId, conversationId]);

  function isMine(msg: Message) {
    return msg.sender_id === profile?.id;
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Chat</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const mine = isMine(item);
          return (
            <View style={[s.bubbleWrap, mine && s.bubbleWrapMine]}>
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                <Text style={[s.bubbleText, mine && s.bubbleTextMine]}>
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="Message…"
          placeholderTextColor={C.muted}
          value={draft}
          onChangeText={setDraft}
          multiline
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          style={[s.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          accessibilityLabel="Send message"
        >
          <Ionicons name="send" size={18} color="#0b0c10" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: C.text, flex: 1 },
  list: { paddingHorizontal: 16, paddingVertical: 12 },
  bubbleWrap: { marginBottom: 8, alignItems: 'flex-start' },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.card,
  },
  bubbleMine: { backgroundColor: C.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleTextMine: { color: '#0b0c10' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#1a1b20',
    backgroundColor: C.bg,
  },
  input: {
    flex: 1, backgroundColor: C.card, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    color: C.text, fontSize: 14, maxHeight: 120, marginRight: 8,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
});
