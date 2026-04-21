import { supabase } from '../lib/supabase';
import type { FeedPost } from '../types';

export async function getFeedPosts(): Promise<FeedPost[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*, profiles(name)')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as FeedPost[];
}

export async function createFeedPost(
  userId: string,
  title: string,
  body: string,
  location: string | null,
  expiresAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('feed_posts')
    .insert({ user_id: userId, title, body, location, expires_at: expiresAt });
  if (error) throw error;
}
