import { supabase } from '../lib/supabase';
import type { Conversation, Message } from '../types';

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, user_a_profile:profiles!user_a(id,name), user_b_profile:profiles!user_b(id,name), last_message:messages!last_message_id(content,created_at)')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Conversation[];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${conversationId},receiver_id.eq.${conversationId}`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Message[];
}

export async function getMessagesByConversation(userId: string, otherUserId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`,
    )
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(senderId: string, receiverId: string, content: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markMessagesRead(senderId: string, receiverId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .is('read_at', null);
  if (error) throw error;
}

export async function searchProfiles(query: string): Promise<{ id: string; name: string; roll_number: string }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, roll_number')
    .ilike('name', `%${query}%`)
    .limit(10);
  if (error) throw error;
  return data as { id: string; name: string; roll_number: string }[];
}

export async function getOrCreateConversation(userA: string, userB: string): Promise<string> {
  const { data: existing, error: fetchError } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(user_a.eq.${userA},user_b.eq.${userB}),and(user_a.eq.${userB},user_b.eq.${userA})`,
    )
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_a: userA, user_b: userB })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
