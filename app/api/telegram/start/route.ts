import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegram';

export async function GET() {
  try {
    getBot(); // no await
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}