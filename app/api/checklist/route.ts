import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// GET: fetch all items for a trip
export async function GET(req: Request) {
  const tripId = new URL(req.url).searchParams.get('tripId');
  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 });

  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('trip_id', tripId)
    .order('traveler', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: seed default items for a trip
export async function POST(req: Request) {
  const { tripId, items } = await req.json();

  const rows = Object.entries(items).flatMap(([traveler, list]: any) =>
    list.map((item: string) => ({ trip_id: tripId, traveler, item }))
  );

  const { error } = await supabase.from('checklists').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH: toggle packed status
export async function PATCH(req: Request) {
  const { id, packed } = await req.json();
  const { error } = await supabase
    .from('checklists')
    .update({ packed })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: remove an item
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('checklists').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}