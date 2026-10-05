import { NextResponse } from 'next/server';
import { broadcast, getUserCount } from '@/lib/telegram';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const message = url.searchParams.get('message') || '⏰ Reminder: Your trip is coming up soon!';

  if (getUserCount() === 0) {
    return NextResponse.json({
      ok: false,
      error: 'No users have messaged the bot yet. Send a message to your bot on Telegram first.',
    });
  }

  const count = broadcast(message); // no await
  return NextResponse.json({ ok: true, sent: count, message });
}