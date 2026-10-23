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

      if (!trip) continue;

      const { data: checklistItems } = await supabase
        .from('checklists')
        .select('packed')
        .eq('trip_id', link.trip_id);

      const total = checklistItems?.length || 0;
      const packed = checklistItems?.filter((i: any) => i.packed).length || 0;
      const pct = total > 0 ? Math.round((packed / total) * 100) : 0;

      const message =
        `🎒 *Packing Check-in*\n\n` +
        `Your trip to *${trip.plan.destination}* starts in 3 days! ✈️\n\n` +
        `I noticed you're only *${pct}%* packed (${packed}/${total} items).\n\n` +
        `Need a hand? Open your checklist to see what's missing:\n` +
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checklist/${trip.id}\n\n` +
        `Don't leave it to the last minute! 😉`;

      await bot.sendMessage(link.telegram_chat_id, message, { parse_mode: 'Markdown' });
      sentCount++;
    }

    return NextResponse.json({ ok: true, sentCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}