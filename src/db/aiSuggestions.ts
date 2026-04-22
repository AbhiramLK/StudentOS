import { supabase } from '../lib/supabase';

export type AiSuggestion = {
  id: string;
  user_id: string;
  suggestion: string;
  created_at: string;
};

export async function getAiSuggestions(userId: string): Promise<AiSuggestion[]> {
  const { data } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function callAiSuggest(userId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-suggest', {
    body: { user_id: userId },
  });
  if (error) throw error;
  return (data as { suggestion: string }).suggestion;
}
