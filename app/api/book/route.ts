import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { tripId } = await req.json();

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      throw new Error('Trip not found');
    }

    // If already booked, return existing bookings
    if (trip.status === 'booked') {
      const { data: existing } = await supabase
        .from('bookings')
        .select('*')
        .eq('trip_id', tripId);

      return NextResponse.json({
        ok: true,
        count: existing?.length || 0,
        bookings: existing || [],
        alreadyBooked: true,
      });
    }

    // First-time booking — create them
    const plan = trip.plan;
    const days = plan.dailyPlans || plan.days || [];

    const bookings = days.flatMap((day: any) =>
      (day.activities || []).map((activity: any) => ({
        trip_id: tripId,
        type: 'activity',
        details: {
          day: day.day,
          date: day.date,
          time: activity.time,
          title: activity.title,
          description: activity.description,
          cost_usd: activity.cost_usd,
        },
        confirmation_id:
          'CONF-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      }))
    );

    if (bookings.length === 0) {
      throw new Error('No activities to book');
    }

    const { error: insertError } = await supabase
      .from('bookings')
      .insert(bookings);

    if (insertError) throw new Error(insertError.message);

    await supabase
      .from('trips')
      .update({ status: 'booked' })
      .eq('id', tripId);

    return NextResponse.json({
      ok: true,
      count: bookings.length,
      bookings,
      alreadyBooked: false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}