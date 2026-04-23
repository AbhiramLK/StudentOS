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

export async function getMessages(myId: string, otherId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`,
    )
    .order('created_at', { ascending: true });
  return (data ?? []) as Message[];
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
