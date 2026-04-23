import { supabase } from '../lib/supabase';
import type { Conversation, Message, Profile } from '../types';

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('updated_at', { ascending: false });
  return data ?? [];
}

export async function getOrCreateConversation(meId: string, otherUserId: string): Promise<string> {
  const ids = [meId, otherUserId].sort();
  const a = ids[0];
  const b = ids[1];

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_a: a, user_b: b })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getMessages(conversationId: string, myId: string): Promise<Message[]> {
  // Get the other participant from the conversation
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a, user_b')
    .eq('id', conversationId)
    .single();
  if (!conv) return [];

  const otherId = conv.user_a === myId ? conv.user_b : conv.user_a;

  // Fetch messages between both users (two directions)
  const [r1, r2] = await Promise.all([
    supabase.from('messages').select('*').eq('sender_id', myId).eq('receiver_id', otherId),
    supabase.from('messages').select('*').eq('sender_id', otherId).eq('receiver_id', myId),
  ]);
  const all: Message[] = [...(r1.data ?? []), ...(r2.data ?? [])];
  all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return all;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('conversations')
    .update({ last_message_id: data.id, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as Message;
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, roll_number, email, mess_id, semester_end_date, is_admin')
    .ilike('name', `%${query}%`)
    .limit(15);
  return (data ?? []) as Profile[];
}
