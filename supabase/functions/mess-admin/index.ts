import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UpsertCycleBody = {
  action: 'upsert_cycle';
  mess_name: string;
  cycle_length: number;
  cycle_start_date: string;
  meals: Array<{
    day_number: number;
    meal_type: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
    items: string[];
  }>;
};

type DeactivateBody = {
  action: 'deactivate_cycle';
  cycle_id: string;
};

type Body = UpsertCycleBody | DeactivateBody;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: CORS });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: CORS });
  }

  const body = await req.json() as Body;

  if (body.action === 'deactivate_cycle') {
    await db.from('mess_cycles').update({ active: false }).eq('id', body.cycle_id);
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  if (body.action === 'upsert_cycle') {
    const { mess_name, cycle_length, cycle_start_date, meals } = body;

    await db.from('mess_cycles')
      .update({ active: false })
      .eq('mess_name', mess_name)
      .eq('active', true);

    const { data: cycle, error: cycleErr } = await db
      .from('mess_cycles')
      .insert({ mess_name, cycle_length, cycle_start_date, active: true })
      .select('id')
      .single();

    if (cycleErr || !cycle) {
      return new Response(JSON.stringify({ error: cycleErr?.message ?? 'Insert failed' }), { status: 500, headers: CORS });
    }

    const mealRows = meals.map(m => ({
      cycle_id: cycle.id,
      day_number: m.day_number,
      meal_type: m.meal_type,
      items: m.items,
    }));

    const { error: mealsErr } = await db.from('mess_meals').insert(mealRows);
    if (mealsErr) {
      return new Response(JSON.stringify({ error: mealsErr.message }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true, cycle_id: cycle.id }), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS });
});
