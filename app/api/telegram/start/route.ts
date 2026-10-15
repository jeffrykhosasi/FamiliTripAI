import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegram';

export async function GET() {
  // Block bot from starting on Vercel — it can't poll properly
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        error: 'Bot is disabled in production (Vercel). Run locally.',
        vercel: true,
      },
      { status: 403 }
    );
  }

  try {
    const bot = getBot();
    return NextResponse.json({
      ok: true,
      message: 'Bot is running',
      hasBot: !!bot,
    });
  } catch (error: any) {
    console.error('Bot start error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}