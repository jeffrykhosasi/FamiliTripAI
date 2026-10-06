import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegram';

export async function GET() {
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