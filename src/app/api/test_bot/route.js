import { Bot, webhookCallback } from 'grammy';
const bot = new Bot('dummy');
bot.command('start', (ctx) => ctx.reply('hi'));
export const POST = async (req) => {
  return webhookCallback(bot, 'std/http')(req);
};
