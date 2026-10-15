import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegram';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    // Get all linked chats
    const { data: links, error } = await supabase
      .from('telegram_links')
      .select('telegram_chat_id, telegram_first_name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!links || links.length === 0) {
      return NextResponse.json(
        { error: 'No linked users yet. Link at least one Telegram chat first.' },
        { status: 400 }
      );
    }

    const bot = getBot();

    // A few different activities so the demo looks varied if multiple people
    const demoActivities = [
      {
        title: 'Senso-ji Temple Visit',
        time: new Date(Date.now() + 30 * 60000).toTimeString().slice(0, 5),
        description:
          "Tokyo's oldest Buddhist temple. Flat stone pathways make it accessible for seniors.",
        transport: {
          recommended: 'public',
          public: {
            available: true,
            duration: '35 min',
            cost: 3,
            details:
              'Take the Toei Asakusa Line from Shinjuku to Asakusa Station. 5-min walk from Exit 4.',
          },
        },
      },
      {
        title: 'TeamLab Planets Tokyo',
        time: new Date(Date.now() + 30 * 60000).toTimeString().slice(0, 5),
        description:
          'Immersive digital art museum. Flat floors make it manageable for seniors.',
        transport: {
          recommended: 'car',
          car: {
            available: true,
            duration: '20 min',
            distance: '8 km',
            cost: 5,
            details: 'Drive to Toyosu area. Parking available on-site.',
          },
        },
      },
      {
        title: 'Dinner at Omoide Yokocho',
        time: new Date(Date.now() + 30 * 60000).toTimeString().slice(0, 5),
        description:
          'Atmospheric narrow alleyways with small yakitori eateries. A taste of old Tokyo.',
        transport: {
          recommended: 'public',
          public: {
            available: true,
            duration: '10 min',
            cost: 2,
            details: 'Take the JR Yamanote Line from Shinjuku Station, 1 stop.',
          },
        },
      },
    ];

    let sentCount = 0;
    let failedCount = 0;
    const sentTo: string[] = [];

    // Send to every linked user
    for (const link of links) {
      try {
        const chatId = Number(link.telegram_chat_id);
        const firstName = link.telegram_first_name || 'there';

        // Pick a random activity for variety
        const activity = demoActivities[Math.floor(Math.random() * demoActivities.length)];
        const t = activity.transport;
        const transportInfo =
          t.recommended === 'car' && t.car?.available
            ? `🚗 Drive: ${t.car.details}`
            : t.public?.available
            ? `🚇 ${t.public.details}`
            : '';

        const message =
          `⏰ *Heads up, ${firstName}! — 30 minutes*\n\n` +
          `*${activity.title}* at ${activity.time}\n\n` +
          `${activity.description}\n\n` +
          (transportInfo ? `${transportInfo}\n\n` : '') +
          `_Ask me "what's today?" for full details._`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        sentCount++;
        sentTo.push(firstName);
        console.log(`⏰ Demo reminder sent to ${firstName} (${chatId})`);
      } catch (e: any) {
        failedCount++;
        console.error(`Failed to send to ${link.telegram_chat_id}:`, e.message);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Demo reminder sent to ${sentCount} user${sentCount === 1 ? '' : 's'}`,
      sentCount,
      failedCount,
      recipients: sentTo,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}