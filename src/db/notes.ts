import { supabase } from '../lib/supabase';
import type { Note } from '../types';

export async function getNotesBySubject(subjectName: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('subject_name', subjectName)
    .order('download_count', { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function getNotesBySemester(semester: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('semester', semester)
    .order('download_count', { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function uploadNote(
  userId: string,
  subjectName: string,
  semester: string,
  title: string,
  filePath: string,
): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .insert({ user_id: userId, subject_name: subjectName, semester, title, file_path: filePath, download_count: 0 });
  if (error) throw error;
}

export async function incrementDownloadCount(noteId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_download_count', { note_id: noteId });
  if (error) throw error;
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('notes')
    .createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}
