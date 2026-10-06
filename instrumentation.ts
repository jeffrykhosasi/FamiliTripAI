export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getBot } = await import('@/lib/telegram');
    try {
      getBot();
      console.log('🤖 Bot auto-started via instrumentation');
    } catch (e: any) {
      console.error('Bot auto-start failed:', e.message);
    }
  }
}