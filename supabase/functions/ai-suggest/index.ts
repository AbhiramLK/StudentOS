import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { user_id } = await req.json() as { user_id: string };
  if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: CORS });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: slots } = await db
    .from('user_timetable')
    .select('subject_name, slot_id')
    .eq('user_id', user_id);

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: records } = await db
    .from('attendance_records')
    .select('slot_id, status')
    .eq('user_id', user_id)
    .gte('date', since);

  const subjectMap: Record<string, { present: number; total: number }> = {};
  for (const slot of (slots ?? [])) {
    const name = slot.subject_name;
    if (!subjectMap[name]) subjectMap[name] = { present: 0, total: 0 };
    const subjectRecords = (records ?? []).filter(r => r.slot_id === slot.slot_id);
    subjectMap[name].total += subjectRecords.length;
    subjectMap[name].present += subjectRecords.filter(r => r.status === 'present').length;
  }

  const attendanceSummary = Object.entries(subjectMap)
    .map(([subject, { present, total }]) => {
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;
      return `${subject}: ${pct}% (${present}/${total} classes)`;
    })
    .join('\n');

  const { data: gymSessions } = await db
    .from('gym_sessions')
    .select('scheduled_at, done')
    .eq('user_id', user_id)
    .eq('done', false)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);

  const gymSummary = gymSessions?.length
    ? gymSessions.map(s => new Date(s.scheduled_at).toDateString()).join(', ')
    : 'No upcoming gym sessions';

  const prompt = `You are a helpful student assistant for a college campus app.
Analyze this student's data and give 3–4 specific, actionable suggestions.
Be direct and concise. Each suggestion should be 1–2 sentences.

Attendance (last 90 days):
${attendanceSummary || 'No attendance data yet.'}

Upcoming gym sessions: ${gymSummary}

Focus on: attendance risk subjects (below 75%), study/revision suggestions, gym consistency, and overall balance. Do not greet the user.`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    },
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 502, headers: CORS });
  }

  const geminiJson = await geminiRes.json();
  const suggestion: string = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No suggestion generated.';

  await db.from('ai_suggestions').insert({ user_id, suggestion });

  return new Response(JSON.stringify({ suggestion }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
