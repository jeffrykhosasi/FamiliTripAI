// lib/telegram.ts
import { Bot } from 'node-telegram-bot-api';
import { supabase } from '@/lib/db';

const globalForBot = globalThis as unknown as {
  telegramBot: any;
};

let bot: any = globalForBot.telegramBot || null;
const userChatIds = new Set<number>();

export function getBot() {
  if (bot) return bot;

  console.log('🤖 Starting Telegram bot...');
  bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
  bot.startPolling();
  globalForBot.telegramBot = bot;

  bot.on('message', async (ctx: any) => {
    const chatId = ctx.chat?.id || ctx.message?.chat?.id;
    const text = ctx.message?.text || ctx.text || '';
    const lower = text.toLowerCase();
    const from = ctx.from || ctx.message?.from || {};
    const firstName = from.first_name || 'there';

    if (!chatId) return;
    userChatIds.add(chatId);

    // Reply helper — works with v2 API
    const reply = async (msg: string) => {
      try {
        await bot.api.sendMessage({ chat_id: chatId, text: msg });
      } catch (e: any) {
        console.error('Reply failed:', e.message);
      }
    };
    // ─── Handle photo messages ───
    if (ctx.message?.photo || ctx.photo) {
      const photos = ctx.message?.photo || ctx.photo || [];
      const largest = photos[photos.length - 1]; // Last = highest resolution
      const fileId = largest?.file_id;
      const caption = ctx.message?.caption || ctx.caption || '';

      if (!fileId) {
        await reply(`Hmm, I couldn't read that photo. Try again?`);
        return;
      }

      // Look up the user's linked trip
      const { data: link } = await supabase
        .from('telegram_links')
        .select('trip_id')
        .eq('telegram_chat_id', chatId)
        .single();

      if (!link) {
        await reply(
          `You're not linked to a trip yet. Use the link from your booking page.`
        );
        return;
      }

      try {
        // Get the file path from Telegram
        const fileInfo: any = await bot.api.getFile({ file_id: fileId });
        const filePath = fileInfo?.result?.file_path || fileInfo?.file_path;

        if (!filePath) {
          await reply(`Couldn't fetch the photo from Telegram. Try again.`);
          return;
        }

        // Download from Telegram
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
        const imageRes = await fetch(fileUrl);

        if (!imageRes.ok) {
          await reply(`Couldn't download the photo. Try again.`);
          return;
        }

        const arrayBuffer = await imageRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const filename = `${fileId}.jpg`;
        const storagePath = `${link.trip_id}/${Date.now()}-${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('trip-photos')
          .upload(storagePath, buffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          console.error('Storage upload failed:', uploadError);
          await reply(`Upload failed: ${uploadError.message}`);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('trip-photos')
          .getPublicUrl(storagePath);

        // Save to photos table
        const { error: dbError } = await supabase.from('photos').insert({
          trip_id: link.trip_id,
          url: urlData.publicUrl,
          caption: caption || null,
          source: 'telegram',
        });

        if (dbError) {
          console.error('Photo DB insert failed:', dbError);
          await reply(`Saved to storage but failed to record: ${dbError.message}`);
          return;
        }

        // Count total photos
        const { count } = await supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('trip_id', link.trip_id);

        console.log(`📸 Photo saved for trip ${link.trip_id}. Total: ${count}`);

        await reply(
          `📸 Saved! You now have ${count} photo${count === 1 ? '' : 's'} in your recap.\n\nSend more, or type "recap" to view.`
        );
      } catch (e: any) {
        console.error('Photo handler error:', e);
        await reply(`Something went wrong: ${e.message}`);
      }
      return;
    }
    
    // /start TRIP_ID
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const tripId = parts[1];

      if (!tripId) {
        await reply(
          `Hi ${firstName}! 👋\n\nTo connect a trip, use the link from your booking confirmation page.`
        );
        return;
      }

      const { data: trip } = await supabase
        .from('trips')
        .select('id, destination, start_date, days')
        .eq('id', tripId)
        .single();

      if (!trip) {
        await reply(`I couldn't find that trip. Please try the link again.`);
        return;
      }

      // Delete any existing link for this chat, then insert
      await supabase.from('telegram_links').delete().eq('telegram_chat_id', chatId);

      const { error: linkError } = await supabase.from('telegram_links').insert({
        trip_id: tripId,
        telegram_chat_id: chatId,
        telegram_username: from.username || null,
        telegram_first_name: firstName,
      });

      if (linkError) {
        console.error('Link save failed:', linkError);
        await reply(`Sorry, couldn't save: ${linkError.message}`);
        return;
      }

      console.log(`✅ Linked chat ${chatId} to trip ${tripId}`);

      await reply(
        `✨ Hi ${firstName}! I'm your assistant for your ${trip.destination} trip.\n\n` +
          `Try asking me:\n• "What's my plan?"\n• "What's today?"\n• "Budget"\n\n` +
          `Or send me a photo 📸`
      );
      return;
    }

    // Look up linked trip
    const { data: link } = await supabase
      .from('telegram_links')
      .select('trip_id')
      .eq('telegram_chat_id', chatId)
      .single();

    console.log(`🔍 chat ${chatId} lookup:`, link);

    if (!link) {
      await reply(
        `You're not linked to a trip yet. Use the link from your booking page.`
      );
      return;
    }

    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', link.trip_id)
      .single();

    if (!trip) {
      await reply(`I lost your trip. Please re-link from the booking page.`);
      return;
    }

    const plan = trip.plan;
    const days = plan.dailyPlans || plan.days || [];

    if (lower.includes('plan') || lower.includes('itinerary')) {
      const summary = days
        .map(
          (d: any) =>
            `📅 Day ${d.day} — ${d.theme || ''}\n` +
            (d.activities || [])
              .slice(0, 3)
              .map((a: any) => `  • ${a.time} ${a.title}`)
              .join('\n')
        )
        .join('\n\n');
      await reply(`Your ${trip.destination} itinerary:\n\n${summary}`);
      return;
    }

    if (lower.includes('today')) {
      const start = new Date(trip.start_date);
      const now = new Date();
      const dayNum =
        Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const today = days.find((d: any) => d.day === dayNum);

      if (!today) {
        await reply(
          `Today isn't a trip day. Trip runs from ${trip.start_date} for ${trip.days} days.`
        );
        return;
      }

      const activities = (today.activities || [])
        .map((a: any) => `⏰ ${a.time} — ${a.title}\n   ${a.description || ''}`)
        .join('\n\n');

      await reply(`Today (Day ${today.day}) — ${today.theme || ''}\n\n${activities}`);
      return;
    }

    if (lower.includes('budget')) {
      const b = plan.budgetBreakdown || {};
      await reply(
        `Budget:\n🏨 $${b.accommodation || 0}\n🍽️ $${b.food || 0}\n🚇 $${b.transport || 0}\n🎫 $${b.activities || 0}\n🚗 $${b.rentalCar || 0}\n\n💰 Total: $${b.total || 0}`
      );
      return;
    }

    await reply(
      `I'm your ${trip.destination} trip assistant. Try:\n\n• "What's my plan?"\n• "What's today?"\n• "Budget"`
    );
  });

  bot.on('polling_error', (error: any) => {
    if (!error.message?.includes('409')) {
      console.log('Telegram polling error:', error.message);
    }
  });

  console.log('🤖 Telegram bot is running...');
  return bot;
}

export function rememberUser(chatId: number) {
  userChatIds.add(chatId);
}

export function broadcast(message: string) {
  if (userChatIds.size === 0) return 0;
  for (const chatId of userChatIds) {
    bot.api.sendMessage({ chat_id: chatId, text: message });
  }
  return userChatIds.size;
}

export function getUserCount() {
  return userChatIds.size;
}