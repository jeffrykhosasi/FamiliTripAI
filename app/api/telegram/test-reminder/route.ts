import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegram';

export async function GET(req: Request) {
  try {
    const chatId = new URL(req.url).searchParams.get('chatId');
    if (!chatId) {
      return NextResponse.json({ error: 'chatId required' }, { status: 400 });
    }

    const bot = getBot();
    const numericChatId = Number(chatId);

    if (isNaN(numericChatId)) {
      return NextResponse.json(
        { error: 'chatId must be numeric (e.g. 800179555, not a UUID)' },
        { status: 400 }
      );
    }

    const activity = {
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
    };

    const message =
      `⏰ *Heads up — 30 minutes*\n\n` +
      `*${activity.title}* at ${activity.time}\n\n` +
      `${activity.description}\n\n` +
      `🚇 ${activity.transport.public.details}\n\n` +
      `_Ask me "what's today?" for full details._`;

    await bot.sendMessage(numericChatId, message, { parse_mode: 'Markdown' });

    return NextResponse.json({ ok: true, message: 'Reminder sent' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}