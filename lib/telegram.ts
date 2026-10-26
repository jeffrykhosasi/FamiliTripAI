// lib/telegram.ts
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

// ─── Prevent unhandled rejections ───
process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason);
  if (msg === 'CANCELLED' || msg.includes('aborted')) return;
  console.error('Unhandled rejection:', reason);
});

// ─── Reminder scheduler ───
let reminderInterval: NodeJS.Timeout | null = null;
const sentReminders = new Set<string>();

function startReminderScheduler() {
  if (reminderInterval) return;
  console.log('⏰ Starting reminder scheduler');
  reminderInterval = setInterval(async () => {
    try { await checkAndSendReminders(); } catch (e: any) { }
  }, 60000);
}

async function checkAndSendReminders() {
  const { data: links } = await supabase.from('telegram_links').select('trip_id, telegram_chat_id');
  if (!links || links.length === 0) return;

  const now = new Date();
  for (const link of links) {
    const { data: trip } = await supabase.from('trips').select('*').eq('id', link.trip_id).single();
    if (!trip?.plan || !trip.plan.startDate) continue;

    const tripStart = new Date(trip.plan.startDate);
    tripStart.setHours(0, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const currentDayNum = Math.floor((todayStart.getTime() - tripStart.getTime()) / 86400000) + 1;
    const currentDay = (trip.plan.dailyPlans || []).find((d: any) => d.day === currentDayNum);
    if (!currentDay) continue;

    for (let i = 0; i < (currentDay.activities || []).length; i++) {
      const activity = currentDay.activities[i];
      const timeMatch = (activity.time || '').match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) continue;

      const actTime = new Date(todayStart);
      actTime.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
      const diffMinutes = (actTime.getTime() - now.getTime()) / 60000;
      const reminderKey = `${link.trip_id}-${currentDayNum}-${i}`;

      if (diffMinutes >= 28 && diffMinutes <= 32 && !sentReminders.has(reminderKey)) {
        sentReminders.add(reminderKey);
        const t = activity.transport || {};
        const transportInfo = t.recommended === 'car' ? `🚗 Drive: ${t.car?.details}` : `🚇 ${t.public?.details}`;
        const msg = `⏰ *Heads up — ${Math.round(diffMinutes)} minutes*\n\n*${activity.title}* at ${activity.time}\n\n${transportInfo}`;
        await bot.sendMessage(link.telegram_chat_id, msg, { parse_mode: 'Markdown' }).catch(() => {});
      }
    }
  }
}

// ─── Bot state ───
const globalForBot = globalThis as unknown as { telegramBot: any };
let bot: any = globalForBot.telegramBot || null;
const userChatIds = new Set<number>();
const conversationHistory: Record<number, Array<{ role: 'user' | 'model'; text: string }>> = {};

function remember(chatId: number, role: 'user' | 'model', text: string) {
  if (!conversationHistory[chatId]) conversationHistory[chatId] = [];
  conversationHistory[chatId].push({ role, text });
  if (conversationHistory[chatId].length > 10) conversationHistory[chatId] = conversationHistory[chatId].slice(-10);
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

  const itineraryText = days.map((d: any) => {
    const acts = (d.activities || []).map((a: any) => `    ${a.time} — ${a.title} (HK$${a.cost_usd || 0})\n      ${a.description || ''}`).join('\n');
    return `Day ${d.day} (${d.date || ''}) — ${d.theme || ''}\n${acts}`;
  }).join('\n\n');

  const flightInfo = plan.flight ? `
FLIGHT DETAILS:
- Airline: ${plan.flight.airline || 'Cathay Pacific'}
- Route: ${plan.flight.route || `${trip.destination} route`}
- Departure: ${plan.flight.departureTime || 'Unknown'}
- Arrival: ${plan.flight.arrivalTime || 'Unknown'}
- Duration: ${plan.flight.duration || 'Unknown'}` : '\nFLIGHT DETAILS: Not yet booked.';

  const travelerNames = travelers.map((t: any) => `${t.name} (${t.role})`).join(', ') || 'Family';
  const rentalCar = plan.rentalCar?.recommended ? `\nRENTAL CAR: ${plan.rentalCar.type} · HK$${plan.rentalCar.dailyPrice}/day` : '';

  const checklistText = checklistItems.length > 0
    ? Object.entries(checklistItems.reduce((acc: any, item: any) => {
        if (!acc[item.traveler]) acc[item.traveler] = [];
        acc[item.traveler].push(item.item);
        return acc;
      }, {})).map(([traveler, items]: any) => `  ${traveler}: ${items.join(', ')}`).join('\n')
    : '(No checklist generated yet)';

  return `You are the family's travel concierge. You know their trip AND you're a knowledgeable local expert on their destination.

Today: ${today}
DESTINATION: ${plan.destination || trip.destination}
DATES: ${plan.startDate} → ${plan.returnDate} (${plan.days} days)
TRAVELERS: ${travelerNames}
BUDGET: HK$${trip.budget_usd || plan.budgetBreakdown?.total || 0}${rentalCar}
${flightInfo}

THEIR FULL ITINERARY:
${itineraryText || '(No activities planned yet)'}

BUDGET BREAKDOWN:
${Object.entries(budget).map(([k, v]) => `  ${k}: HK$${v}`).join('\n')}

FAMILY PACKING CHECKLIST SUMMARY:
${checklistText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**NEVER output generic system messages like "User Safety: safe" or "Response Safety".**
If a user asks to change, cancel, or modify a booking, you MUST reply to them warmly and add the [CREATE_TICKET] tag at the end.

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

**When to use the itinerary/flight:**
- "What's today?" / "What's my schedule?" → use itinerary
- "What is my flight?" → READ from the FLIGHT DETAILS block above. Do NOT create a ticket or say it's missing.
- "How much does this cost?" → use itinerary

**When to use your own knowledge:**
- "What should I see/do/eat in [destination]?" → local knowledge
- "What's popular/famous/must-see?" → local knowledge
- "Is it safe?" / "Is it worth it?" / "Should I?" → local knowledge
- "What's the weather?" → general knowledge

**Combining both is best:**
If the answer connects to their itinerary, mention it: "You're already going to X — great choice! Also try Y nearby."

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
✅ RIGHT: "Of course — I've flagged this to our admin team and they'll reach out to you within 2 hours with refund options for your Disney VIP booking. Is there a specific reason for the cancellation I should pass along?\n\n[CREATE_TICKET]"

User: "I want to change my flight."
✅ RIGHT: "Got it — I've notified our admin team and they'll contact you within 2 hours to arrange the flight change. Do you have a preferred new date in mind?\n\n[CREATE_TICKET]"

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

async function askGemini(systemPrompt: string, history: any[], userMessage: string): Promise<string> {
  const startTime = Date.now();
  const MAX_WAIT_MS = 20000;
  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    const remainingMs = MAX_WAIT_MS - (Date.now() - startTime);
    if (remainingMs <= 0) break;

    try {
      const contents: any[] = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood.' }] },
        ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: userMessage }] },
      ];

      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), remainingMs));
      const geminiPromise = ai.models.generateContent({ model, contents });
      
      const response: any = await Promise.race([geminiPromise, timeoutPromise]);
      const text = response.text ?? '';
      if (!text) throw new Error('Empty response');
      
      console.log(`✅ Gemini ${model} succeeded in ${Date.now() - startTime}ms`);
      return text.trim();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.error?.code || 0;
      const isBusy = err.message?.includes('503') || err.message?.includes('UNAVAILABLE') || status === 503;
      if (!isBusy && err.message !== 'GEMINI_TIMEOUT') throw err;
      if (err.message === 'GEMINI_TIMEOUT') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

async function askOpenRouter(systemPrompt: string, history: any[], userMessage: string): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const openrouter = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY!, baseURL: 'https://openrouter.ai/api/v1' });

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
    { role: 'user', content: userMessage },
  ];

  const FREE_MODELS = ['openrouter/free'];
  let lastError: any = null;

  for (const model of FREE_MODELS) {
    try {
      console.log(`🔄 OpenRouter trying ${model}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await openrouter.chat.completions.create(
        { model, messages, max_tokens: 800 },
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      const text = response.choices[0]?.message?.content || '';
      if (!text) throw new Error('Empty response');
      
      console.log(`✅ OpenRouter succeeded with ${model}`);
      return text;
    } catch (err: any) {
      lastError = err;
      console.log(`❌ OpenRouter failed: ${err.message}`);
    }
  }
  throw lastError;
}

function localFallback(trip: any, text: string): string {
  const plan = trip.plan || {};
  const days = plan.dailyPlans || plan.days || [];
  const lower = text.toLowerCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (lower.includes('today') || lower.includes('plan') || lower.includes('schedule')) {
    const start = new Date(plan.startDate || '');
    const todayNum = Math.floor((new Date().getTime() - start.getTime()) / 86400000) + 1;
    const todayDay = days.find((d: any) => d.day === todayNum) || days[0];
    if (todayDay) {
      const acts = (todayDay.activities || []).map((a: any) => `⏰ ${a.time} — ${a.title}`).join('\n');
      return `📍 Day ${todayDay.day} — ${todayDay.theme || ''}\n\n${acts}`;
    }
  }
  
  if (lower.includes('flight')) {
    return plan.flight ? `Your flight is with ${plan.flight.airline}, departing at ${plan.flight.departureTime} and arriving at ${plan.flight.arrivalTime}.` : `I couldn't find flight details.`;
  }

  if (lower.includes('weather') || lower.includes('rain')) return `I can't check the live forecast right now. Please check your weather app! ☀️`;
  if (lower.includes('eat') || lower.includes('food')) return `Check your itinerary for today's dining plans! 🍜`;
  if (lower.includes('cancel') || lower.includes('refund') || lower.includes('change')) return `I've noted this! Because I'm having a brief connection delay, our admin team will review this and contact you within 2 hours. 🙏`;

  return `Sorry — I'm having a brief connection issue. 🙏\n\nView your itinerary here:\n${appUrl}/itinerary/${trip.id}`;
}

export function getBot() {
  if (bot) return bot;
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
  globalForBot.telegramBot = bot;

  bot.on('message', async (msg: any) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const firstName = msg.from?.first_name || 'there';
    const hasPhoto = msg.photo && msg.photo.length > 0;
    userChatIds.add(chatId);

    const reply = async (t: string) => {
      try { await bot.sendMessage(chatId, t, { parse_mode: 'Markdown' }); } catch (e) {}
    };

    if (text.startsWith('/start')) {
      const tripId = text.split(' ')[1];
      if (!tripId) return reply(`Hi ${firstName}! Use the link from your booking page.`);
      const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
      if (!trip) return reply(`Trip not found.`);

      await supabase.from('telegram_links').delete().eq('telegram_chat_id', chatId);
      await supabase.from('telegram_links').insert({ trip_id: tripId, telegram_chat_id: chatId, telegram_first_name: firstName });
      
      console.log(`✅ Linked chat ${chatId} to trip ${tripId}`);

      conversationHistory[chatId] = [];
      return reply(`✨ Hi ${firstName}! I'm your personal concierge for your ${trip.plan?.destination || 'trip'}.\n\nAsk me anything:\n• "What's my plan for today?"\n• "What's on my mom's checklist?"\n• "Where should we eat?"\n• "What's the weather like?"\n\nOr send me a photo 📸 to add to your recap.`);
    }

    const { data: link } = await supabase.from('telegram_links').select('trip_id').eq('telegram_chat_id', chatId).single();
    if (!link) return reply(`Please link your trip from the booking page first.`);
    const { data: trip } = await supabase.from('trips').select('*').eq('id', link.trip_id).single();
    if (!trip) return reply(`Trip lost. Please re-link.`);

    if (hasPhoto) {
      try {
        const largest = msg.photo[msg.photo.length - 1];
        const fileInfo: any = await bot.getFile(largest.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
        const buffer = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());
        const storagePath = `${trip.id}/${Date.now()}-${largest.file_id}.jpg`;
        
        await supabase.storage.from('trip-photos').upload(storagePath, buffer, { contentType: 'image/jpeg' });
        const { data: urlData } = supabase.storage.from('trip-photos').getPublicUrl(storagePath);
        await supabase.from('photos').insert({ trip_id: trip.id, url: urlData.publicUrl, source: 'telegram' });
        const { count } = await supabase.from('photos').select('*', { count: 'exact', head: true }).eq('trip_id', trip.id);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        return reply(`📸 *Saved!* (${count} total)\n\n[👉 View album](${appUrl}/recap/${trip.id})`);
      } catch (e: any) {
        return reply(`Failed to save photo: ${e.message}`);
      }
    }

    if (!text) return reply(`Send me text or a photo 📸`);

    const lowerText = text.toLowerCase();
    
    // Direct Checklist Handler
    if (lowerText.includes('checklist') || lowerText.includes('pack')) {
      const { data: checklistData } = await supabase.from('checklists').select('traveler, item, packed').eq('trip_id', trip.id);
      if (!checklistData || checklistData.length === 0) return reply(`You haven't generated a packing list yet.`);
      
      const travelers = Array.from(new Set(checklistData.map((i: any) => i.traveler)));
      let target = travelers.find(t => lowerText.includes(t.toLowerCase()));
      
      if (target) {
        const items = checklistData.filter(i => i.traveler === target);
        const list = items.map((i: any) => `${i.packed ? '✅' : '⬜'} ${i.item}`).join('\n');
        return reply(`*${target}'s Packing List:*\n\n${list}`);
      }
      return reply(`Ask me for a specific person's checklist (e.g., "mom's checklist").`);
    }

    // Direct Album Handler
    if (lowerText.includes('album') || lowerText.includes('recap') || lowerText.includes('photo')) {
      const { count } = await supabase.from('photos').select('*', { count: 'exact', head: true }).eq('trip_id', trip.id);
      if (!count) return reply(`You haven't sent any photos yet!`);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return reply(`📸 You have *${count} photos*!\n\n[👉 Tap here to open your Trip Album](${appUrl}/recap/${trip.id})`);
    }

    // AI Handler
    try { await bot.sendChatAction(chatId, 'typing'); } catch {}
    const { data: checklistData } = await supabase.from('checklists').select('traveler, item, packed').eq('trip_id', trip.id);
    
    const systemPrompt = buildSystemPrompt(trip, checklistData || []);
    const history = getHistory(chatId).slice(-8);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📨 Message received: "${text}"`);

    let cancelled = false;

    const geminiCall = (async () => {
      try {
        const res = await askGemini(systemPrompt, history, text);
        if (!cancelled) console.log(`🏆 Winner: Gemini`);
        return res;
      } catch (e: any) {
        if (!cancelled) console.log(`❌ Gemini failed: ${e.message}`);
        throw e;
      }
    })();

    const openRouterCall = (async () => {
      try {
        const res = await askOpenRouter(systemPrompt, history, text);
        if (!cancelled) console.log(`🏆 Winner: OpenRouter`);
        return res;
      } catch (e: any) {
        if (!cancelled) console.log(`❌ OpenRouter failed: ${e.message}`);
        throw e;
      }
    })();

    try {
      // 1. Try Gemini
      let response = await Promise.race([
        geminiCall,
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
      ]);
      cancelled = true;
      
      // Check for ticket BEFORE remembering and replying
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
        } catch (e: any) { console.error('Failed to create ticket:', e.message); }
        
        remember(chatId, 'user', text);
        remember(chatId, 'model', cleanResponse);
        await reply(cleanResponse);
      } else {
        remember(chatId, 'user', text);
        remember(chatId, 'model', response);
        await reply(response);
      }
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        console.log('⏱️ Gemini slow — racing against OpenRouter...');
        try {
          let response = await Promise.race([geminiCall, openRouterCall]);
          cancelled = true;

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
            } catch (e: any) { console.error('Failed to create ticket:', e.message); }
            
            remember(chatId, 'user', text);
            remember(chatId, 'model', cleanResponse);
            await reply(cleanResponse);
          } else {
            remember(chatId, 'user', text);
            remember(chatId, 'model', response);
            await reply(response);
          }
        } catch {
          console.log('🛟 Using local fallback');
          await reply(localFallback(trip, text));
        }
      } else {
        try {
          let response = await openRouterCall;
          cancelled = true;

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
            } catch (e: any) { console.error('Failed to create ticket:', e.message); }
            
            remember(chatId, 'user', text);
            remember(chatId, 'model', cleanResponse);
            await reply(cleanResponse);
          } else {
            remember(chatId, 'user', text);
            remember(chatId, 'model', response);
            await reply(response);
          }
        } catch {
          console.log('🛟 Using local fallback');
          await reply(localFallback(trip, text));
        }
      }
    }
  });

  bot.on('polling_error', (e: any) => {
    if (!e.message?.includes('409')) console.log('Polling error:', e.message);
  });

  console.log('🤖 Telegram bot is running...');
  startReminderScheduler();
  return bot;
}

export function broadcast(message: string) {
  if (userChatIds.size === 0) return 0;
  for (const chatId of userChatIds) bot.sendMessage(chatId, message);
  return userChatIds.size;
}