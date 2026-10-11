import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { tripId } = await req.json();

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('trip_id', tripId);

    if (error) throw new Error(error.message);

    const sorted = (data || []).sort((a: any, b: any) => {
      const dayA = a.details?.day || 0;
      const dayB = b.details?.day || 0;
      if (dayA !== dayB) return dayA - dayB;
      return (a.details?.time || '').localeCompare(b.details?.time || '');
    });

    return NextResponse.json({ ok: true, count: sorted.length, bookings: sorted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}