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
      
      const sorted = (existing || []).sort((a: any, b: any) => {
        const dayA = a.details?.day || 0;
        const dayB = b.details?.day || 0;
        if (dayA !== dayB) return dayA - dayB;
        return (a.details?.time || '').localeCompare(b.details?.time || '');
      });

      return NextResponse.json({
        ok: true,
        count: sorted.length,
        bookings: sorted,
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

    // await supabase
    //   .from('trips')
    //   .update({ status: 'booked' })
    //   .eq('id', tripId);

      const { error: updateError } = await supabase
      .from('trips')
      .update({ status: 'booked' })
      .eq('id', tripId);

      if (updateError) {
        console.error('❌ Failed to update trip status:', updateError);
      } else {
        console.log(`✅ Trip ${tripId} marked as booked`);
      }

      const sorted = [...bookings].sort((a: any, b: any) => {
      const dayA = a.details?.day || 0;
      const dayB = b.details?.day || 0;
      if (dayA !== dayB) return dayA - dayB;
      return (a.details?.time || '').localeCompare(b.details?.time || '');
    });

    return NextResponse.json({
      ok: true,
      count: sorted.length,
      bookings: sorted,
      alreadyBooked: false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}