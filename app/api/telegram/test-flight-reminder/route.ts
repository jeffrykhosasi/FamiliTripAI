import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegram';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const { data: links } = await supabase
      .from('telegram_links')
      .select('trip_id, telegram_chat_id');

    if (!links || links.length === 0) {
      return NextResponse.json({ error: 'No linked users' }, { status: 400 });
    }

    const bot = getBot();
    let sentCount = 0;

    for (const link of links) {
      const { data: trip } = await supabase
        .from('trips')
        .select('*')
        .eq('id', link.trip_id)
        .single();

      if (!trip?.plan?.flight) continue;

      const flight = trip.plan.flight;

      // Construct a realistic "2 hours before" message using the trip's real flight data
      const message = 
        `✈️ *Flight Reminder* ✈️\n\n` +
        `Your flight to ${trip.plan.destination} is in 2 hours!\n\n` +
        `*${flight.airline || 'Cathay Pacific'} ${flight.flightNumber || ''}*\n` +
        `📍 Route: ${flight.route}\n` +
        `🕒 Departs: ${flight.departureTime}\n` +
        `🛬 Arrives: ${flight.arrivalTime}\n\n` +
        `Make sure you have your passport and boarding pass ready. Have a safe flight! 🛫`;

      await bot.sendMessage(link.telegram_chat_id, message, { parse_mode: 'Markdown' });
      console.log(`✈️ Flight reminder sent to chat ${link.telegram_chat_id}`);
      sentCount++;
    }

    return NextResponse.json({ ok: true, sentCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}