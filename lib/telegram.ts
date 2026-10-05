// lib/telegram.ts
import { Bot } from 'node-telegram-bot-api';

let bot: any = null;
const userChatIds = new Set<number>();

export function getBot() {
  if (!bot) {
    bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
    bot.startPolling();

    bot.on('message', (ctx: any) => {
      const chatId = ctx.chat.id;
      const text = (ctx.message?.text || '').toLowerCase();

      userChatIds.add(chatId);

      let reply = "Hi! I'm your trip assistant. Ask me about weather, packing, or flights ✈️";

      if (text.includes('weather')) {
        reply = 'Tokyo this week: 18-24°C, light rain Tuesday. Pack a light jacket! 🌧️';
      } else if (text.includes('pack')) {
        reply = 'Check your family checklist dashboard — every traveler has their own list.';
      } else if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
        reply = 'Hey! Ready for your trip? Ask me about weather, packing, or flights. 🌏';
      }

      ctx.reply(reply);
    });

    console.log('🤖 Telegram bot is running...');
  }
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