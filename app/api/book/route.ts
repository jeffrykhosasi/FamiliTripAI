import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { tripId } = await req.json();

    // Load the trip to get the plan
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      throw new Error('Trip not found');
    }

    // Flatten all activities into a list of "bookings"
    const bookings = trip.plan.days.flatMap((day: any) =>
      day.activities.map((activity: any) => ({
        trip_id: tripId,
        type: 'activity',
        details: {
          day: day.day,
          date: day.date,
          time: activity.time,
          title: activity.title,
          description: activity.description,
        },
        confirmation_id:
          'CONF-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      }))
    );

    // Insert bookings into DB
    const { error: insertError } = await supabase
      .from('bookings')
      .insert(bookings);

    if (insertError) throw new Error(insertError.message);

    // Update trip status
    await supabase
      .from('trips')
      .update({ status: 'booked' })
      .eq('id', tripId);

    return NextResponse.json({
      ok: true,
      count: bookings.length,
      bookings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}