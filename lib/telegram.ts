// lib/telegram.ts
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
];

const globalForBot = globalThis as unknown as {
  telegramBot: any;
};

let bot: any = globalForBot.telegramBot || null;
const userChatIds = new Set<number>();

// In-memory conversation history (last 10 messages per chat)
const conversationHistory: Record<number, Array<{ role: 'user' | 'model'; text: string }>> = {};

function remember(chatId: number, role: 'user' | 'model', text: string) {
  if (!conversationHistory[chatId]) conversationHistory[chatId] = [];
  conversationHistory[chatId].push({ role, text });
  if (conversationHistory[chatId].length > 10) {
    conversationHistory[chatId] = conversationHistory[chatId].slice(-10);
  }
}

function getHistory(chatId: number) {
  return conversationHistory[chatId] || [];
}

// Build a rich system prompt from the trip data
function buildSystemPrompt(trip: any): string {
  const plan = trip.plan || {};
  const days = plan.dailyPlans || plan.days || [];
  const travelers = plan.travelers || [];
  const budget = plan.budgetBreakdown || {};
  const today = new Date().toISOString().slice(0, 10);

  const itineraryText = days
    .map((d: any) => {
      const acts = (d.activities || [])
        .map(
          (a: any) =>
            `    ${a.time} — ${a.title} ($${a.cost_usd || 0})\n      ${a.description || ''}`
        )
        .join('\n');
      return `Day ${d.day} (${d.date || ''}) — ${d.theme || ''}\n${acts}`;
    })
    .join('\n\n');

  const travelerNames = travelers
    .map((t: any) => `${t.name} (${t.role})`)
    .join(', ') || 'Family';

  const parentsDayOff = plan.parentsDayOff
    ? `\nPARENTS' DAY OFF (Day ${plan.parentsDayOff.day}):
  Parents: ${plan.parentsDayOff.parentsActivity?.title || ''} — ${plan.parentsDayOff.parentsActivity?.description || ''}
  Kids: ${plan.parentsDayOff.kidsActivity?.title || ''} — ${plan.parentsDayOff.kidsActivity?.description || ''}
  Kids app: ${plan.parentsDayOff.kidsActivity?.appSuggestion || ''}
  Toy claim code: ${plan.parentsDayOff.kidsActivity?.toyClaimCode || ''}`
    : '';

  const rentalCar = plan.rentalCar?.recommended
    ? `\nRENTAL CAR: ${plan.rentalCar.type || 'rental car'} at $${plan.rentalCar.dailyPrice || 0}/day. Pickup: ${plan.rentalCar.pickupLocation || 'N/A'}. Dropoff: ${plan.rentalCar.dropoffLocation || 'N/A'}.`
    : '\nTRANSPORT: Public transit only (no rental car).';

  return `You are the family's personal trip concierge for their upcoming trip. You know everything about their itinerary, budget, and travelers.

Today's date is ${today}.

TRIP SUMMARY:
- Destination: ${plan.destination || trip.destination || 'Unknown'}
- Dates: ${plan.startDate || trip.start_date || ''} to ${plan.returnDate || ''}
- Duration: ${plan.days || trip.days || '?'} days
- Travelers: ${travelerNames}
- Budget: $${trip.budget_usd || plan.budgetBreakdown?.total || 0} USD${rentalCar}${parentsDayOff}

FULL ITINERARY:
${itineraryText || '(No activities planned yet)'}

BUDGET BREAKDOWN:
  Accommodation: $${budget.accommodation || 0}
  Food: $${budget.food || 0}
  Transport: $${budget.transport || 0}
  Activities: $${budget.activities || 0}
  Rental car: $${budget.rentalCar || 0}
  Total: $${budget.total || 0}

YOUR ROLE:
- Be warm, brief, and helpful — like a knowledgeable local friend.
- Answer questions using the REAL trip data above.
- When they ask "what's today?", look at today's date (${today}) and find the matching day.
- If they're tired or stressed, suggest lighter alternatives from the plan.
- If they ask about food, weather, or local tips, be helpful even if it's not in the plan.
- Match their energy: short question → short answer. Long question → thoughtful answer.
- Keep most replies under 100 words unless they ask for detail.
- Use emojis sparingly — 1 per message max.
- Never invent activities that aren't in their plan without making it clear it's a suggestion.
- If they ask about photos or the recap, tell them to send photos anytime and view the recap at ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/recap/${trip.id}`;
}

// Ask Gemini with retry + fallback
async function askGemini(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  userMessage: string
): Promise<string> {
  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const contents: any[] = [];
        contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
        contents.push({
          role: 'model',
          parts: [{ text: 'Understood. I am ready to assist this family with their trip.' }],
        });

        for (const h of history) {
          contents.push({ role: h.role, parts: [{ text: h.text }] });
        }
        contents.push({ role: 'user', parts: [{ text: userMessage }] });

        const response = await ai.models.generateContent({
          model,
          contents,
        });

        const text = response.text ?? '';
        if (!text) throw new Error('Empty response');
        return text.trim();
      } catch (err: any) {
        lastError = err;
        const msg = err.message || '';
        const isBusy =
          msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (!isBusy) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw lastError;
}

export function getBot() {
  if (bot) return bot;

  console.log('🤖 Starting Telegram bot with Gemini...');
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
  globalForBot.telegramBot = bot;

  bot.on('message', async (msg: any) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const firstName = msg.from?.first_name || 'there';
    const hasPhoto = msg.photo && msg.photo.length > 0;

    userChatIds.add(chatId);

    const reply = async (t: string) => {
      try {
        await bot.sendMessage(chatId, t);
      } catch (e: any) {
        console.error('Reply failed:', e.message);
      }
    };

    // ─── /start TRIP_ID ───
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

      await supabase.from('telegram_links').delete().eq('telegram_chat_id', chatId);

      const { error: linkError } = await supabase.from('telegram_links').insert({
        trip_id: tripId,
        telegram_chat_id: chatId,
        telegram_username: msg.from?.username || null,
        telegram_first_name: firstName,
      });

      if (linkError) {
        console.error('Link save failed:', linkError);
        await reply(`Sorry, couldn't save: ${linkError.message}`);
        return;
      }

      console.log(`✅ Linked chat ${chatId} to trip ${tripId}`);

      conversationHistory[chatId] = [];

      await reply(
        `✨ Hi ${firstName}! I'm your personal concierge for your ${trip.destination} trip.\n\n` +
          `Ask me anything:\n` +
          `• "What's my plan for today?"\n` +
          `• "I'm tired, any lighter options?"\n` +
          `• "Where should we eat?"\n` +
          `• "What's the weather like?"\n\n` +
          `Or send me a photo 📸 to add to your recap.`
      );
      return;
    }

    // ─── Photo handling ───
    if (hasPhoto) {
      const largest = msg.photo[msg.photo.length - 1];
      const fileId = largest.file_id;
      const caption = msg.caption || '';

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
        const fileInfo: any = await bot.getFile(fileId);
        const filePath = fileInfo?.file_path;

        if (!filePath) {
          await reply(`Couldn't fetch the photo. Try again.`);
          return;
        }

        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
        const imageRes = await fetch(fileUrl);
        const buffer = Buffer.from(await imageRes.arrayBuffer());

        const storagePath = `${link.trip_id}/${Date.now()}-${fileId}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('trip-photos')
          .upload(storagePath, buffer, { contentType: 'image/jpeg' });

        if (uploadError) {
          console.error('Storage upload failed:', uploadError);
          await reply(`Upload failed: ${uploadError.message}`);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('trip-photos')
          .getPublicUrl(storagePath);

        await supabase.from('photos').insert({
          trip_id: link.trip_id,
          url: urlData.publicUrl,
          caption: caption || null,
          source: 'telegram',
        });

        const { count } = await supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('trip_id', link.trip_id);

        console.log(`📸 Photo saved for trip ${link.trip_id}. Total: ${count}`);
        await reply(
          `📸 Saved! You now have ${count} photo${count === 1 ? '' : 's'} in your recap.\n\nSend more, or ask me anything about your trip.`
        );
      } catch (e: any) {
        console.error('Photo handler error:', e);
        await reply(`Something went wrong with the photo: ${e.message}`);
      }
      return;
    }

    // ─── Everything else → Gemini ───
    if (!text) {
      await reply(`Send me text or a photo 📸`);
      return;
    }

    const { data: link } = await supabase
      .from('telegram_links')
      .select('trip_id')
      .eq('telegram_chat_id', chatId)
      .single();

    if (!link) {
      await reply(
        `You're not linked to a trip yet. Use the link from your booking page to get started.`
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

    try {
      await bot.sendChatAction(chatId, 'typing');
    } catch {}

    try {
      const systemPrompt = buildSystemPrompt(trip);
      const history = getHistory(chatId).slice(-8);

      const response = await askGemini(systemPrompt, history, text);

      remember(chatId, 'user', text);
      remember(chatId, 'model', response);

      await reply(response);
    } catch (e: any) {
      console.error('Gemini chat error:', e);
      await reply(`I'm having trouble thinking right now. Try again in a moment. 🛠️`);
    }
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
    bot.sendMessage(chatId, message);
  }
  return userChatIds.size;
}

export function getUserCount() {
  return userChatIds.size;
}