import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(req: Request) {
  const rawTripId = new URL(req.url).searchParams.get('tripId');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 API /photos GET');
  console.log('   raw tripId received:', JSON.stringify(rawTripId));
  console.log('   type:', typeof rawTripId);
  console.log('   length:', rawTripId?.length);
  console.log('   charCodes:', rawTripId?.split('').map(c => c.charCodeAt(0)));

  if (!rawTripId) {
    return NextResponse.json({ error: 'tripId required' }, { status: 400 });
  }

  // Query 1: with the tripId filter
  const q1 = await supabase
    .from('photos')
    .select('*')
    .eq('trip_id', rawTripId);

  console.log('🔍 Filtered query:');
  console.log('   error:', q1.error);
  console.log('   count:', q1.data?.length);

  // Query 2: fetch ALL photos (no filter) to prove data exists
  const q2 = await supabase.from('photos').select('id, trip_id, url');
  console.log('🔍 Unfiltered query:');
  console.log('   error:', q2.error);
  console.log('   count:', q2.data?.length);
  console.log('   trip_ids in DB:', q2.data?.map(p => p.trip_id));

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (q1.error) {
    return NextResponse.json({ error: q1.error.message }, { status: 500 });
  }

  return NextResponse.json(q1.data ?? []);
}

// ... rest of file (PATCH, DELETE) unchanged