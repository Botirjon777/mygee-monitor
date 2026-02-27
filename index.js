const TelegramBot = require('node-telegram-bot-api');
const connectDB = require('./config/db');
const botController = require('./controllers/botController');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

connectDB();

console.log('Telegram Bot is running...');

bot.on('message', (msg) => botController.handleMessage(bot, msg));
bot.on('callback_query', (query) => botController.handleCallback(bot, query));
