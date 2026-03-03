const userService = require('../services/userService');
const transactionService = require('../services/transactionService');
const contextService = require('../services/contextService');
const analyticsService = require('../services/analyticsService');
const { resolveDate, formatDate } = require('../services/dateService');

// ─────────────────────────────────────────────────────────────
// KEYBOARDS
// ─────────────────────────────────────────────────────────────
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📊 Recent Stats', '📂 Categories'],
      ['📅 Weekly', '📆 Monthly', '📈 Yearly'],
      ['🗓️ Custom Range', '📌 Top Days'],
      ['👤 My Profile', '🤖 AI Assistant'],
      ['⚙️ Settings']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// Shown during any multi-step waiting state
const cancelKeyboard = {
  reply_markup: {
    keyboard: [['❌ Cancel']],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// All main menu button labels — pressing any of these while in a state cancels it
const MENU_BUTTONS = [
  '📊 Recent Stats', '📂 Categories',
  '📅 Weekly', '📆 Monthly', '📈 Yearly',
  '🗓️ Custom Range', '📌 Top Days',
  '👤 My Profile', '🤖 AI Assistant',
  '⚙️ Settings', '/start', '/help'
];

// ─────────────────────────────────────────────────────────────
// MESSAGE HANDLER
// ─────────────────────────────────────────────────────────────
const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  const user = await userService.getOrCreateUser(msg.from);

  // Save user message to history
  await contextService.saveMessage(user._id, 'user', text);

  // ── State Machine ──────────────────────────────────────────
  if (user.state && user.state !== 'idle') {
    const handledByState = await handleUserState(bot, msg, user, chatId, text);
    if (handledByState) return;
  }

  // ── Menu Commands ──────────────────────────────────────────
  if (text === '/start') {
    return sendStart(bot, chatId, msg.from.first_name, user._id);
  }

  if (text === '/help') {
    return sendHelp(bot, chatId, user._id);
  }

  if (text === '👤 My Profile') {
    const profileMsg = `👤 *Your Profile*\n\nName: ${user.name}\nEmail: ${user.email || '—'}\nDaily Limit: ${user.preferences.dailyLimit.toLocaleString()} sum\nMonthly Limit: ${user.preferences.monthlyLimit.toLocaleString()} sum`;
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

  if (text === '📂 Categories') {
    const summaryMsg = await transactionService.getCategorySummary(user._id);
    await bot.sendMessage(chatId, summaryMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', summaryMsg);
    return;
  }

  if (text === '📅 Weekly') {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Loading weekly chart...');
    const weekMsg = await analyticsService.getWeeklySpending(user._id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, weekMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', weekMsg);
    return;
  }

  if (text === '📆 Monthly') {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Loading monthly chart...');
    const monthMsg = await analyticsService.getMonthlySpending(user._id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, monthMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', monthMsg);
    return;
  }

  if (text === '📈 Yearly') {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Loading yearly chart...');
    const yearMsg = await analyticsService.getYearlySpending(user._id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, yearMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', yearMsg);
    return;
  }

  if (text === '📌 Top Days') {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Analyzing spending patterns...');
    const topMsg = await analyticsService.getTopSpendingDays(user._id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, topMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', topMsg);
    return;
  }

  if (text === '🗓️ Custom Range') {
    await userService.updateUserState(user._id, 'awaiting_range_from');
    const prompt = `🗓️ *Custom Date Range*\n\nEnter the *start date* in format: \`DD.MM.YYYY\`\nExample: \`01.02.2026\``;
    await bot.sendMessage(chatId, prompt, { parse_mode: 'Markdown', ...cancelKeyboard });
    await contextService.saveMessage(user._id, 'assistant', prompt);
    return;
  }

  if (text === '🤖 AI Assistant') {
    const aiMsg = "🤖 *AI Financial Assistant*\n\nYou can ask me anything about your spending, or just tell me what you spent:\n• _'How much did I spend on food this week?'_\n• _'Give me some saving tips.'_\n• _'yesterday I paid 15000 for taxi'_\n• _'50000 for groceries, 20000 for transport'_\n\nJust type your message!";
    await bot.sendMessage(chatId, aiMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', aiMsg);
    return;
  }

  if (text === '⚙️ Settings') {
    const settingsMsg = "⚙️ *Settings*\n\nChoose what you want to edit:";
    const settingsOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Edit Name', callback_data: 'edit_name' }],
          [{ text: '📧 Edit Email', callback_data: 'edit_email' }],
          [{ text: '💳 Edit Daily Limit', callback_data: 'edit_limit' }],
          [{ text: '📊 Year Comparison', callback_data: 'year_compare' }]
        ]
      }
    };
    await bot.sendMessage(chatId, settingsMsg, settingsOptions);
    await contextService.saveMessage(user._id, 'assistant', settingsMsg);
    return;
  }

  // ── Default: Process Expense/Income input via AI ────────────
  const processingMsg = await bot.sendMessage(chatId, "🤖 Analyzing your request...");

  try {
    const history = await contextService.getRecentHistory(user._id);
    const result = await transactionService.processTransaction(user._id, text, history, bot, chatId);
    
    try {
      await bot.deleteMessage(chatId, processingMsg.message_id);
    } catch (delErr) {
      console.warn('Could not delete processing message');
    }

    await contextService.saveMessage(user._id, 'assistant', result.message);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Oops, something went wrong while processing your request.");
  }
};

// ─────────────────────────────────────────────────────────────
// STATE HANDLER  (editing profile / date range flow)
// ─────────────────────────────────────────────────────────────
const handleUserState = async (bot, msg, user, chatId, text) => {
  // ─ Cancel: user typed Cancel or pressed any main menu button ─
  const isCancelRequest = text === '❌ Cancel' || MENU_BUTTONS.includes(text);
  if (isCancelRequest) {
    await userService.updateUserState(user._id, 'idle');
    if (text === '❌ Cancel') {
      await bot.sendMessage(chatId, '↩️ Cancelled. What would you like to do?', mainMenu);
      return true; // consumed — don't re-process as a menu command
    }
    // Let normal menu handling take over (return false so handleMessage continues)
    return false;
  }

  // ─ Profile editing states ─
  if (user.state === 'editing_name') {
    await userService.updateUserProfile(user._id, { name: text });
    await userService.updateUserState(user._id, 'idle');
    const msgText = `✅ Name updated to: *${text}*`;
    await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', msgText);
    return true;
  }

  if (user.state === 'editing_email') {
    try {
      await userService.updateUserProfile(user._id, { email: text });
      await userService.updateUserState(user._id, 'idle');
      const msgText = `✅ Email updated to: *${text}*`;
      await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
      await contextService.saveMessage(user._id, 'assistant', msgText);
    } catch (err) {
      if (err.code === 'DUPLICATE_EMAIL') {
        await bot.sendMessage(chatId, "⚠️ This email is already registered. Please enter a different email:");
      } else {
        console.error(err);
        await bot.sendMessage(chatId, "❌ Something went wrong while updating your email.");
      }
    }
    return true;
  }

  if (user.state === 'editing_limit') {
    const limit = parseInt(text);
    if (isNaN(limit) || limit <= 0) {
      await bot.sendMessage(chatId, "⚠️ Please enter a valid positive number for the limit:");
      return true;
    }
    await userService.updateUserProfile(user._id, { dailyLimit: limit });
    await userService.updateUserState(user._id, 'idle');
    const msgText = `✅ Daily limit updated to: *${limit.toLocaleString()} sum*`;
    await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', msgText);
    return true;
  }

  // ─ Custom date range states ─
  if (user.state === 'awaiting_range_from') {
    const { date } = resolveDate(text);
    // Validate: check if it looks like a date input
    const dateOk = /\d{2}\.\d{2}\.\d{4}/.test(text) || /\d{4}-\d{2}-\d{2}/.test(text) || text.toLowerCase().includes('ago') || text.toLowerCase().includes('week') || text.toLowerCase().includes('month');
    if (!dateOk) {
      await bot.sendMessage(chatId, `⚠️ I couldn't read that date. Please enter it as \`DD.MM.YYYY\`, e.g. \`01.02.2026\`:`, { parse_mode: 'Markdown' });
      return true;
    }
    // Store start date in state metadata
    await userService.updateUserState(user._id, `awaiting_range_to:${date.toISOString()}`);
    const prompt = `✅ Start date: \`${formatDate(date)}\`\n\nNow enter the *end date* in format: \`DD.MM.YYYY\``;
    await bot.sendMessage(chatId, prompt, { parse_mode: 'Markdown', ...cancelKeyboard });
    return true;
  }

  if (user.state && user.state.startsWith('awaiting_range_to:')) {
    const fromISO = user.state.replace('awaiting_range_to:', '');
    const fromDate = new Date(fromISO);
    const { date: toDate } = resolveDate(text);

    if (toDate < fromDate) {
      await bot.sendMessage(chatId, `⚠️ End date must be after start date. Please enter end date as \`DD.MM.YYYY\`:`, { parse_mode: 'Markdown' });
      return true;
    }

    await userService.updateUserState(user._id, 'idle');
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Loading custom range chart...');
    const rangeMsg = await analyticsService.getSpendingByRange(user._id, fromDate, toDate);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, rangeMsg, { parse_mode: 'Markdown' });
    await contextService.saveMessage(user._id, 'assistant', rangeMsg);
    return true;
  }

  // Year comparison state
  if (user.state === 'awaiting_year_compare') {
    const parts = text.trim().split(/[\s,\/\-]+/);
    if (parts.length < 2 || isNaN(parseInt(parts[0])) || isNaN(parseInt(parts[1]))) {
      await bot.sendMessage(chatId, `⚠️ Please enter two years separated by a comma, e.g. \`2025, 2026\`:`);
      return true;
    }
    const y1 = parseInt(parts[0]);
    const y2 = parseInt(parts[1]);
    await userService.updateUserState(user._id, 'idle');
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Loading year comparison...');
    const compareMsg = await analyticsService.getYearComparison(user._id, y1, y2);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, compareMsg, { parse_mode: 'Markdown' });
    return true;
  }

  return false;
};

// ─────────────────────────────────────────────────────────────
// CALLBACK QUERY HANDLER
// ─────────────────────────────────────────────────────────────
const handleCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const user = await userService.getOrCreateUser(query.from);

  await bot.answerCallbackQuery(query.id);

  if (data === 'edit_name') {
    await userService.updateUserState(user._id, 'editing_name');
    await bot.sendMessage(chatId, "✏️ Please enter your new name:");

  } else if (data === 'edit_email') {
    await userService.updateUserState(user._id, 'editing_email');
    await bot.sendMessage(chatId, "📧 Please enter your new email:");

  } else if (data === 'edit_limit') {
    await userService.updateUserState(user._id, 'editing_limit');
    await bot.sendMessage(chatId, "💳 Please enter your new daily limit (in sum):");

  } else if (data === 'year_compare') {
    await userService.updateUserState(user._id, 'awaiting_year_compare');
    const currentYear = new Date().getFullYear();
    await bot.sendMessage(chatId, `📊 Enter two years to compare (e.g. \`${currentYear - 1}, ${currentYear}\`):`, { parse_mode: 'Markdown' });

  } else if (data === 'analytics_weekly') {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Loading weekly chart...');
    const msg = await analyticsService.getWeeklySpending(user._id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });

  } else if (data === 'analytics_monthly') {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Loading monthly chart...');
    const msg = await analyticsService.getMonthlySpending(user._id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });

  } else if (data === 'analytics_yearly') {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Loading yearly chart...');
    const msg = await analyticsService.getYearlySpending(user._id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  }
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const sendStart = async (bot, chatId, firstName, userId) => {
  const welcomeMsg = `👋 Hello *${firstName}*! I'm your *Expense Monitor Bot* 💰

I help you track your spending and income with smart date detection and beautiful charts.

*How to record expenses:*
• \`15000 for taxi\` — records today
• \`yesterday I paid 50000 for groceries\`
• \`last Monday 30000 for medicine\`
• \`01.02.2026 120000 salary\`

*Analytics (no AI — instant):*
📅 Weekly chart per day
📆 Monthly chart per week
📈 Yearly chart per month
🗓️ Custom date range
📌 Your top spending days

Just type what you spent, or use the menu below! ⬇️`;

  await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown', ...mainMenu });
  await contextService.saveMessage(userId, 'assistant', welcomeMsg);
};

const sendHelp = async (bot, chatId, userId) => {
  const helpMsg = `ℹ️ *Help & Commands*

*Record a transaction:*
Just type naturally — I understand:
• _"15000 for taxi"_
• _"yesterday I paid 50000 for groceries"_
• _"last Monday 200000 salary"_
• Multiple: _"30000 taxi, 50000 food"_

*Analytics buttons:*
📅 \`Weekly\` — This week, day by day
📆 \`Monthly\` — This month, week by week
📈 \`Yearly\` — This year, month by month
🗓️ \`Custom Range\` — Pick any from/to date
📌 \`Top Days\` — Which days you spend most

*Other buttons:*
📊 \`Recent Stats\` — Last 10 transactions
📂 \`Categories\` — Spending by category
👤 \`My Profile\` — Your account info
🤖 \`AI Assistant\` — Ask me anything
⚙️ \`Settings\` — Edit name, limit, compare years`;

  await bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown', ...mainMenu });
  await contextService.saveMessage(userId, 'assistant', helpMsg);
};

module.exports = { handleMessage, handleCallback };
