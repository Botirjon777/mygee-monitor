const userService = require('../services/userService');
const transactionService = require('../services/transactionService');
const contextService = require('../services/contextService');

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['👤 My Profile', '📊 Recent Stats'],
      ['📊 Category Summary', '⚙️ Settings'],
      ['📋 Menu']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  const user = await userService.getOrCreateUser(msg.from);

  // Save user message to history
  await contextService.saveMessage(user._id, 'user', text);

  await contextService.saveMessage(user._id, 'user', text);

  // Handle User States (Editing Profile)
  if (user.state && user.state !== 'idle') {
    if (user.state === 'editing_name') {
      await userService.updateUserProfile(user._id, { name: text });
      await userService.updateUserState(user._id, 'idle');
      const msgText = `✅ Name updated to: **${text}**`;
      await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
      await contextService.saveMessage(user._id, 'assistant', msgText);
      return;
    }

    if (user.state === 'editing_email') {
      await userService.updateUserProfile(user._id, { email: text });
      await userService.updateUserState(user._id, 'idle');
      const msgText = `✅ Email updated to: **${text}**`;
      await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
      await contextService.saveMessage(user._id, 'assistant', msgText);
      return;
    }

    if (user.state === 'editing_limit') {
      const limit = parseInt(text);
      if (isNaN(limit)) {
        await bot.sendMessage(chatId, "⚠️ Please enter a valid number for the limit:");
        return;
      }
      await userService.updateUserProfile(user._id, { dailyLimit: limit });
      await userService.updateUserState(user._id, 'idle');
      const msgText = `✅ Daily limit updated to: **${limit} sum**`;
      await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
      await contextService.saveMessage(user._id, 'assistant', msgText);
      return;
    }
  }

  if (text === '/start') {
    const welcomeMsg = `👋 Hello ${msg.from.first_name}! I'm your **Expense Monitoring Bot**.

I'm here to help you track your spending, manage your income, and give you smart financial advice using AI.

Simply type what you spent, for example:
_"I spent 20000 on lunch"_`;
    
    await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown', ...mainMenu });
    await contextService.saveMessage(user._id, 'assistant', welcomeMsg);
    return;
  }

  if (text === '👤 My Profile') {
    const profileMsg = `👤 **Your Profile**\n\nName: ${user.name}\nEmail: ${user.email}\nDaily Limit: ${user.preferences.dailyLimit} sum`;
    await bot.sendMessage(chatId, profileMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', profileMsg);
    return;
  }

  if (text === '📊 Recent Stats') {
    const statsMsg = await transactionService.getRecentStats(user._id);
    await bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', statsMsg);
    return;
  }

  if (text === '📊 Category Summary') {
    const summaryMsg = await transactionService.getCategorySummary(user._id);
    await bot.sendMessage(chatId, summaryMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', summaryMsg);
    return;
  }

  if (text === '📋 Menu') {
    const menuMsg = "📋 **Available Commands**\n\nJust type your expense like '50000 for gas' and I'll handle the rest!";
    await bot.sendMessage(chatId, menuMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', menuMsg);
    return;
  }

  if (text === '⚙️ Settings') {
    const settingsMsg = "⚙️ **Settings**\n\nChoose what you want to edit:";
    const settingsOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Edit Name', callback_data: 'edit_name' }],
          [{ text: '📧 Edit Email', callback_data: 'edit_email' }],
          [{ text: '💳 Edit Limit', callback_data: 'edit_limit' }]
        ]
      }
    };
    await bot.sendMessage(chatId, settingsMsg, settingsOptions);
    await contextService.saveMessage(user._id, 'assistant', settingsMsg);
    return;
  }

  // Default: Process Expense Input
  bot.sendMessage(chatId, "Processing your input with AI... 🤖");

  try {
    const history = await contextService.getRecentHistory(user._id);
    const result = await transactionService.processTransaction(user._id, text, history);
    
    await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', result.message);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "Oops, something went wrong while processing your request.");
  }
};

const handleCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const user = await userService.getOrCreateUser(query.from);

  if (data === 'edit_name') {
    await userService.updateUserState(user._id, 'editing_name');
    await bot.sendMessage(chatId, "Please enter your new name:");
  } else if (data === 'edit_email') {
    await userService.updateUserState(user._id, 'editing_email');
    await bot.sendMessage(chatId, "Please enter your new email:");
  } else if (data === 'edit_limit') {
    await userService.updateUserState(user._id, 'editing_limit');
    await bot.sendMessage(chatId, "Please enter your new daily limit (in sum):");
  }

  await bot.answerCallbackQuery(query.id);
};

module.exports = { handleMessage, handleCallback };
