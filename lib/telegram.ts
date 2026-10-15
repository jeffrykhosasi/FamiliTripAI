// lib/telegram.ts
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

// ─── Prevent unhandled rejections from race-losing promises ───
process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason);
  if (msg === 'CANCELLED' || msg.includes('aborted')) {
    return;
  }
  console.error('Unhandled rejection:', reason);
});

// ─── Reminder scheduler ───
let reminderInterval: NodeJS.Timeout | null = null;
const sentReminders = new Set<string>();

function startReminderScheduler() {
  if (reminderInterval) return;

  console.log('⏰ Starting reminder scheduler (checks every 60s)');

  reminderInterval = setInterval(async () => {
    try {
      await checkAndSendReminders();
    } catch (e: any) {
      console.error('Reminder check failed:', e.message);
    }
  }, 60 * 1000);
}

async function checkAndSendReminders() {
  const { data: links } = await supabase
    .from('telegram_links')
    .select('trip_id, telegram_chat_id');

  if (!links || links.length === 0) return;

  const now = new Date();

  for (const link of links) {
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', link.trip_id)
      .single();

    if (!trip?.plan) continue;

    const plan = trip.plan;
    const days = plan.dailyPlans || plan.days || [];
    if (!plan.startDate) continue;

    const tripStart = new Date(plan.startDate);
    tripStart.setHours(0, 0, 0, 0);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const currentDayNum =
      Math.floor((todayStart.getTime() - tripStart.getTime()) / 86400000) + 1;

    const currentDay = days.find((d: any) => d.day === currentDayNum);
    if (!currentDay) continue;

    for (let i = 0; i < (currentDay.activities || []).length; i++) {
      const activity = currentDay.activities[i];
      const timeMatch = (activity.time || '').match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) continue;

      const actTime = new Date(todayStart);
      actTime.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);

      const diffMinutes = (actTime.getTime() - now.getTime()) / 60000;

      const reminderKey = `${link.trip_id}-${currentDayNum}-${i}`;
      if (
        diffMinutes >= 28 &&
        diffMinutes <= 32 &&
        !sentReminders.has(reminderKey)
      ) {
        sentReminders.add(reminderKey);
        await sendActivityReminder(
          link.telegram_chat_id,
          activity,
          diffMinutes,
          trip
        );
      }
    }
  }
}

async function sendActivityReminder(
  chatId: number,
  activity: any,
  minutesUntil: number,
  trip: any
) {
  const t = activity.transport || {};
  const transportInfo =
    t.recommended === 'car' && t.car?.available
      ? `🚗 Drive: ${t.car.details}`
      : t.public?.available
      ? `🚇 ${t.public.details}`
      : '';

  const message =
    `⏰ *Heads up — ${Math.round(minutesUntil)} minutes*\n\n` +
    `*${activity.title}* at ${activity.time}\n\n` +
    (activity.description ? `${activity.description}\n\n` : '') +
    (transportInfo ? `${transportInfo}\n\n` : '') +
    `_Ask me "what's today?" for full details._`;

  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    console.log(`⏰ Reminder sent to chat ${chatId}: ${activity.title}`);
  } catch (e: any) {
    console.error('Failed to send reminder:', e.message);
  }
}

// ─── Bot state ───
const globalForBot = globalThis as unknown as {
  telegramBot: any;
};

let bot: any = globalForBot.telegramBot || null;
const userChatIds = new Set<number>();

const conversationHistory: Record<
  number,
  Array<{ role: 'user' | 'model'; text: string }>
> = {};

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

// ─── Build system prompt ───
function buildSystemPrompt(trip: any, checklistItems: any[] = []): string {
  const plan = trip.plan || {};
  const days = plan.dailyPlans || plan.days || [];
  const travelers = plan.travelers || [];
  const budget = plan.budgetBreakdown || {};
  const today = new Date().toISOString().slice(0, 10);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const itineraryText = days
    .map((d: any) => {
      const acts = (d.activities || [])
        .map(
          (a: any) =>
            `    ${a.time} — ${a.title} (HK$${a.cost_usd || 0})\n      ${a.description || ''}`
        )
        .join('\n');
      return `Day ${d.day} (${d.date || ''}) — ${d.theme || ''}\n${acts}`;
    })
    .join('\n\n');

  const travelerNames =
    travelers.map((t: any) => `${t.name} (${t.role})`).join(', ') || 'Family';

  const rentalCar = plan.rentalCar?.recommended
    ? `\nRENTAL CAR: ${plan.rentalCar.type} · HK$${plan.rentalCar.dailyPrice}/day`
    : '';

  return `You are the family's travel concierge. You know their trip AND you're a knowledgeable local expert on their destination.

Today: ${today}
DESTINATION: ${plan.destination || trip.destination}
DATES: ${plan.startDate} → ${plan.returnDate} (${plan.days} days)
TRAVELERS: ${travelerNames}
BUDGET: HK$${trip.budget_usd || plan.budgetBreakdown?.total || 0}${rentalCar}

THEIR FULL ITINERARY:
${itineraryText || '(No activities planned yet)'}

BUDGET BREAKDOWN:
${Object.entries(budget)
  .map(([k, v]) => `  ${k}: HK$${v}`)
  .join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The itinerary above is a SCHEDULE. It tells you what they have BOOKED. It is NOT the sum total of everything they might want to know.

**Examples of questions and CORRECT answers:**

1. User: "What's the most popular attraction in Disneyland?"
   ❌ WRONG: "Your Disneyland VIP Experience is the highlight of your trip!"
   ✅ RIGHT: "The must-do attractions at Hong Kong Disneyland are Mystic Manor (unique to HK!), Hyperspace Mountain, and the Iron Man Experience. Your VIP pass includes queue-skipping for all of them. 🎢"

2. User: "What should I eat in Hong Kong?"
   ❌ WRONG: "You have dinner at Crystal Lotus in your itinerary."
   ✅ RIGHT: "Hong Kong classics: dim sum at Tim Ho Wan, egg waffles in Mong Kok, roast goose at Yat Lok. You're already booked at Crystal Lotus on Day 2 — try their character dim sum! 🍜"

3. User: "Is it safe in Hong Kong?"
   ❌ WRONG: "Your itinerary includes a hotel in Kowloon."
   ✅ RIGHT: "Hong Kong is very safe — one of the lowest crime rates in Asia. Just watch for pickpockets in crowded areas like Mong Kok. You'll be fine. 😊"

4. User: "What's the weather like?"
   ❌ WRONG: "I don't have weather data in your itinerary."
   ✅ RIGHT: "Late October in Hong Kong is gorgeous — 22-28°C, low humidity, mostly sunny. Pack light layers. ☀️"

**The rule:** Ask yourself, "What does the USER want to know?"

**When to use the itinerary:**
- "What's today?" / "What's my schedule?" → use itinerary
- "How much does this cost?" → use itinerary
- "Who's traveling?" → use travelers list

**When to use your own knowledge:**
- "What should I see/do/eat in [destination]?" → local knowledge
- "What's popular/famous/must-see?" → local knowledge
- "Is it safe?" / "Is it worth it?" / "Should I?" → local knowledge
- "What's the weather?" → general knowledge

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HANDLING REQUESTS BEYOND YOUR CAPABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are the first layer of a full-service concierge team. When a user asks for something you can't complete instantly (cancellations, refunds, re-bookings, special requests, complaints), don't say "I can't."

Instead:
1. Acknowledge warmly and reassure them.
2. Tell them you've flagged it to the admin team.
3. Give a realistic time estimate (within 2 hours during daytime).
4. Ask one clarifying question if needed.

CRITICAL: When you handle such a request, you MUST end your reply with the exact tag [CREATE_TICKET] on its own line.

EXAMPLES:

User: "Can I cancel my Disney ticket and get a refund?"
✅ RIGHT: "Of course — I've flagged this to our admin team and they'll reach out to you within 2 hours with refund options. Is there a specific reason for the cancellation I should pass along?\n\n[CREATE_TICKET]"

RULES:
- Never say "I can't help with that"
- Never suggest they "contact the vendor directly" — that's OUR job
- Always reassure with a specific timeframe (2 hours)
- Always end with [CREATE_TICKET] for these requests
- Do NOT end with [CREATE_TICKET] for normal questions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENCY:
- All prices are in HK$ (Hong Kong Dollars). Never USD or $.

TONE:
- Warm and helpful like a savvy local friend.
- Match their energy (short → short, long → thoughtful).
- Under 100 words usually. Use 1-2 emojis max.
- Use contractions and casual phrasing.

LINKS:
- Full itinerary: ${appUrl}/itinerary/${trip.id}
- Recap: ${appUrl}/recap/${trip.id}`;
}

// ─── Gemini with 15s budget ───
async function askGemini(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  userMessage: string
): Promise<string> {
  const startTime = Date.now();
  const MAX_WAIT_MS = 15000;
  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_WAIT_MS) {
      console.log(`⏰ Gemini budget exceeded (${elapsed}ms)`);
      break;
    }

    const remainingMs = MAX_WAIT_MS - elapsed;

    try {
      const contents: any[] = [];
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({
        role: 'model',
        parts: [
          { text: 'Understood. I am ready to assist this family with their trip.' },
        ],
      });

      for (const h of history) {
        contents.push({ role: h.role, parts: [{ text: h.text }] });
      }
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      console.log(`🔄 Gemini ${model}... (timeout: ${remainingMs}ms)`);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), remainingMs)
      );

      const geminiPromise = ai.models.generateContent({
        model,
        contents,
      });

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);

      const text = response.text ?? '';
      if (!text) throw new Error('Empty response');
      console.log(`✅ Gemini ${model} succeeded in ${Date.now() - startTime}ms`);
      return text.trim();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const status = err?.status || err?.error?.code || 0;

      if (msg === 'GEMINI_TIMEOUT') {
        console.log(`⏰ Gemini ${model} timed out at ${Date.now() - startTime}ms`);
        break;
      }

      const isBusy =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('high demand') ||
        status === 503 ||
        status === 429;

      console.log(
        `❌ Gemini ${model} failed: status=${status} busy=${isBusy} (${Date.now() - startTime}ms)`
      );

      if (!isBusy) throw err;

      const afterAttempt = Date.now() - startTime;
      if (afterAttempt + 3000 < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError;
}

// ─── OpenRouter fallback ───
async function askOpenRouter(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  userMessage: string
): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text,
    })),
    { role: 'user', content: userMessage },
  ];

  const FREE_MODELS = [
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-chat-v3.1:free',
    'qwen/qwen-2.5-72b-instruct:free',
  ];

  let lastError: any = null;

  for (const model of FREE_MODELS) {
    try {
      console.log(`🔄 OpenRouter trying ${model}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await openrouter.chat.completions.create(
        {
          model,
          messages,
          max_tokens: 800,
        },
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      const text = response.choices[0]?.message?.content || '';
      if (!text) throw new Error('Empty response');

      console.log(`✅ OpenRouter succeeded with ${model}`);
      return text;
    } catch (err: any) {
      lastError = err;
      console.log(`❌ OpenRouter ${model} failed: ${err.message}`);
    }
  }

  throw lastError;
}

// ─── Simple honest fallback ───
function localFallback(trip: any, text: string): string {
  return (
    `Sorry — I'm having a brief connection issue and couldn't process that just now. 🙏\n\n` +
    `Could you try again in a moment?\n\n` +
    `If it keeps happening, you can reach the full itinerary anytime here:\n` +
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/itinerary/${trip.id}`
  );
}

// ─── Bot initialization ───
export function getBot() {
  if (bot) return bot;

  console.log('🤖 Starting Telegram bot with Gemini + OpenRouter...');
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

      await supabase
        .from('telegram_links')
        .delete()
        .eq('telegram_chat_id', chatId);

      const { error: linkError } = await supabase
        .from('telegram_links')
        .insert({
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
          `• "What's on my mom's checklist?"\n` +
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
          `📸 Saved! You now have ${count} photo${
            count === 1 ? '' : 's'
          } in your recap.\n\nSend more, or ask me anything about your trip.`
        );
      } catch (e: any) {
        console.error('Photo handler error:', e);
        await reply(`Something went wrong with the photo: ${e.message}`);
      }
      return;
    }

    // ─── Everything else → AI ───
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

    // ─── DIRECT CHECKLIST HANDLING (bypass AI) ───
    const lowerText = text.toLowerCase();
    const isChecklistQuestion =
      lowerText.includes('checklist') ||
      lowerText.includes('packing list') ||
      lowerText.includes('what should i pack') ||
      lowerText.includes('what to pack') ||
      (lowerText.includes('pack') &&
        (lowerText.includes('mom') ||
          lowerText.includes('dad') ||
          lowerText.includes('kid') ||
          lowerText.includes('grandma') ||
          lowerText.includes('grandpa') ||
          lowerText.includes('grandmom') ||
          lowerText.includes('granddad')));

    if (isChecklistQuestion) {
      console.log('✅ CHECKLIST HANDLER TRIGGERED for:', text);

      const { data: checklistData, error: checklistError } = await supabase
        .from('checklists')
        .select('traveler, item, packed')
        .eq('trip_id', link.trip_id)
        .order('traveler');

      console.log('📋 Checklist query result:', {
        count: checklistData?.length,
        error: checklistError?.message,
      });

      if (!checklistData || checklistData.length === 0) {
        await reply(
          `You haven't generated a packing list yet. Open your trip → Family Checklist → click "✨ AI-generate checklist" first.`
        );
        return;
      }

      const travelers = Array.from(
        new Set(checklistData.map((i: any) => i.traveler))
      ) as string[];

      let targetTraveler: string | null = null;

      // Match travelers by name — check LONGEST names first to avoid "grandmom" matching "mom"
      const sortedTravelers = [...travelers].sort(
        (a, b) => b.length - a.length
      );
      for (const t of sortedTravelers) {
        const tName = t.toLowerCase().split(' ')[0];
        const wordBoundary = new RegExp(`\\b${tName}\\b`, 'i');
        if (wordBoundary.test(lowerText)) {
          targetTraveler = t;
          break;
        }
      }

      // Special aliases (grandparents FIRST because they may contain "mom"/"dad")
      if (!targetTraveler) {
        const aliases: Array<[string[], RegExp]> = [
          [
            ['grandmom', 'grand mom', 'grandma', 'grandmother'],
            /grandma|grandmother|grandmom|grand\s*mom/i,
          ],
          [
            ['granddad', 'grand dad', 'grandad', 'grandpa', 'grandfather'],
            /grandpa|grandfather|granddad|grand\s*dad|grandad/i,
          ],
          [
            ['kid', 'child', 'children', 'son', 'daughter'],
            /kid|child|son|daughter/i,
          ],
          [['mom', 'mother', 'mum'], /mom|mother|mum/i],
          [['dad', 'father'], /dad|father/i],
        ];
        for (const [keywords, regex] of aliases) {
          if (keywords.some((k) => lowerText.includes(k))) {
            const found = travelers.find((t) => regex.test(t));
            if (found) {
              targetTraveler = found;
              break;
            }
          }
        }
      }

      console.log(`🎯 Matched traveler: ${targetTraveler || '(summary)'}`);

      // Specific traveler
      if (targetTraveler) {
        const items = checklistData.filter(
          (i: any) => i.traveler === targetTraveler
        );
        const packed = items.filter((i: any) => i.packed).length;
        const list = items
          .map((i: any) => `${i.packed ? '✅' : '⬜'} ${i.item}`)
          .join('\n');
        await reply(
          `Here's ${targetTraveler}'s packing list:\n\n${list}\n\nYou've packed ${packed} of ${items.length} items.`
        );
        return;
      }

      // Summary of all travelers
      const summary = travelers
        .map((traveler: string) => {
          const items = checklistData.filter(
            (i: any) => i.traveler === traveler
          );
          const packed = items.filter((i: any) => i.packed).length;
          const list = items
            .slice(0, 5)
            .map((i: any) => `  ${i.packed ? '✅' : '⬜'} ${i.item}`)
            .join('\n');
          const more =
            items.length > 5 ? `\n  ...and ${items.length - 5} more` : '';
          return `👤 ${traveler} (${packed}/${items.length}):\n${list}${more}`;
        })
        .join('\n\n');

      await reply(
        `Here's your family packing checklist:\n\n${summary}\n\nAsk "what's on [name]'s checklist?" for details.`
      );
      return;
    }

    // ─── Everything else → AI ───
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', link.trip_id)
      .single();

    const { data: checklistItems } = await supabase
      .from('checklists')
      .select('traveler, item, packed')
      .eq('trip_id', link.trip_id)
      .order('traveler');

    if (!trip) {
      await reply(`I lost your trip. Please re-link from the booking page.`);
      return;
    }

    try {
      await bot.sendChatAction(chatId, 'typing');
    } catch {}

    try {
      const systemPrompt = buildSystemPrompt(trip, checklistItems || []);
      const history = getHistory(chatId).slice(-8);
      let response = '';
      let winner: 'gemini' | 'openrouter' | 'local' | null = null;

      let cancelled = false;

      const geminiCall = (async (): Promise<string | null> => {
        const t0 = Date.now();
        try {
          const result = await askGemini(systemPrompt, history, text);
          if (cancelled) {
            console.log(`🚫 Gemini finished but was cancelled (${Date.now() - t0}ms)`);
            return null;
          }
          console.log(`✅ Gemini won race in ${Date.now() - t0}ms`);
          return result;
        } catch (e: any) {
          if (cancelled) {
            console.log(`🚫 Gemini cancelled (${Date.now() - t0}ms)`);
            return null;
          }
          console.log(`❌ Gemini failed: ${e.message}`);
          throw e;
        }
      })().catch((err) => {
        console.log(`🚫 Gemini swallowed error: ${err.message}`);
        return null;
      });

      const openRouterCall = (async (): Promise<string | null> => {
        const t0 = Date.now();
        try {
          const result = await askOpenRouter(systemPrompt, history, text);
          if (cancelled) {
            console.log(`🚫 OpenRouter finished but was cancelled (${Date.now() - t0}ms)`);
            return null;
          }
          console.log(`✅ OpenRouter won race in ${Date.now() - t0}ms`);
          return result;
        } catch (e: any) {
          if (cancelled) {
            console.log(`🚫 OpenRouter cancelled (${Date.now() - t0}ms)`);
            return null;
          }
          console.log(`❌ OpenRouter failed: ${e.message}`);
          throw e;
        }
      })().catch((err) => {
        console.log(`🚫 OpenRouter swallowed error: ${err.message}`);
        return null;
      });

      try {
        const result = await Promise.race([
          geminiCall,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (result) {
          response = result;
          winner = 'gemini';
        } else {
          throw new Error('HEADSTART_EXPIRED');
        }
      } catch (headErr: any) {
        if (headErr.message === 'HEADSTART_EXPIRED') {
          console.log('⏱️ Gemini slow — racing against OpenRouter...');
          try {
            const result = await Promise.race([geminiCall, openRouterCall]);
            if (result) {
              response = result;
              winner = 'openrouter';
            } else {
              throw new Error('BOTH_NULL');
            }
          } catch {
            console.log('❌ Both failed — using local fallback');
            response = localFallback(trip, text);
            winner = 'local';
          }
        } else {
          console.log('❌ Gemini errored fast — trying OpenRouter...');
          const result = await openRouterCall;
          if (result) {
            response = result;
            winner = 'openrouter';
          } else {
            console.log('❌ OpenRouter failed — using local fallback');
            response = localFallback(trip, text);
            winner = 'local';
          }
        }
      }

      cancelled = true;
      console.log(`🏆 Winner: ${winner}`);

      if (response.includes('[CREATE_TICKET]')) {
        const cleanResponse = response.replace(/\[CREATE_TICKET\]/g, '').trim();

        try {
          await supabase.from('support_tickets').insert({
            trip_id: trip.id,
            telegram_chat_id: chatId,
            telegram_username: msg.from?.username || null,
            message: text,
            status: 'open',
          });
          console.log(`🎫 Support ticket created for chat ${chatId}`);
        } catch (e: any) {
          console.error('Failed to create ticket:', e.message);
        }

        remember(chatId, 'user', text);
        remember(chatId, 'model', cleanResponse);
        await reply(cleanResponse);
      } else {
        remember(chatId, 'user', text);
        remember(chatId, 'model', response);
        await reply(response);
      }
    } catch (e: any) {
      console.error('Chat error:', e);
      await reply(localFallback(trip, text));
    }
  });

  bot.on('polling_error', (error: any) => {
    if (!error.message?.includes('409')) {
      console.log('Telegram polling error:', error.message);
    }
  });

  console.log('🤖 Telegram bot is running...');
  startReminderScheduler();
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