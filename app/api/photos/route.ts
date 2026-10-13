import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(req: Request) {
  const tripId = new URL(req.url).searchParams.get('tripId');
  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 });

  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('trip_id', tripId)
    .order('display_order', { ascending: true })
    .order('uploaded_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: Request) {
  const { updates } = await req.json();
  for (const u of updates) {
    const patch: any = {};
    if (u.display_order !== undefined) patch.display_order = u.display_order;
    if (u.caption !== undefined) patch.caption = u.caption;

    const { error } = await supabase
      .from('photos')
      .update(patch)
      .eq('id', u.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: photo } = await supabase
    .from('photos')
    .select('url')
    .eq('id', id)
    .single();

  if (photo?.url) {
    const path = photo.url.split('/trip-photos/')[1];
    if (path) {
      await supabase.storage.from('trip-photos').remove([path]);
    }
  }

  const { error } = await supabase.from('photos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}