const Transaction = require('../models/Transaction');
const { categorizeTransaction, checkWarnings } = require('../utils/ai');

const processTransaction = async (userId, text, history = [], bot = null, chatId = null) => {
  const summaryContext = await getRawCategorySummary(userId);
  const result = await categorizeTransaction(text, history, summaryContext);
  
  if (!result) {
    if (bot && chatId) bot.sendMessage(chatId, "I couldn't understand that. Please try again with more details.");
    return { success: false, message: "I couldn't understand that. Please try again with more details." };
  }

  // Handle Chat Intent
  if (result.intent === 'chat') {
    if (bot && chatId) await bot.sendMessage(chatId, result.answer, { parse_mode: 'Markdown' });
    return { success: true, message: result.answer };
  }

  // Handle Record Intent
  if (!result.transactions || result.transactions.length === 0) {
    const errorMsg = "I couldn't identify any clear expenses. Please try again with details like '50000 for taxi'.";
    if (bot && chatId) bot.sendMessage(chatId, errorMsg);
    return { success: false, message: errorMsg };
  }

  let fullResponse = "";
  
  for (const data of result.transactions) {
    // Validation: Skip if data is incomplete or invalid
    if (!data.amount || isNaN(data.amount) || !data.type || !['income', 'expense'].includes(data.type)) {
      console.warn(`Skipping invalid transaction: ${JSON.stringify(data)}`);
      continue;
    }

    const transaction = new Transaction({
      userId,
      amount: data.amount,
      description: data.description || 'No description',
      category: data.category || 'General',
      type: data.type,
      rawInput: text
    });

    await transaction.save();

    const response = `✅ Saved: **${data.amount.toLocaleString()} sum** for "${data.description}"\nCategory: **${data.category}**`;
    
    if (bot && chatId) {
      let botMsg = `✅ **${data.amount.toLocaleString()} sum** for "${data.description}"\nCategory: **${data.category}**`;
      const warning = checkWarnings(data.category, data.amount);
      if (warning) {
        botMsg += `\n⚠️ **WARNING**: ${warning}`;
      }
      await bot.sendMessage(chatId, botMsg, { parse_mode: 'Markdown' });
    }

    fullResponse += response + "\n\n";
  }

  if (bot && chatId) {
    await bot.sendMessage(chatId, "✨ **All categories updated**", { parse_mode: 'Markdown' });
  }

  return { success: true, message: fullResponse.trim() };
};

const getRawCategorySummary = async (userId) => {
  try {
    const summary = await Transaction.aggregate([
      { $match: { userId: userId, type: 'expense' } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } }
    ]);
    
    if (summary.length === 0) return "User has no recorded expenses yet.";

    return summary.map(item => `${item._id}: ${item.total} sum`).join(', ');
  } catch (err) {
    console.error(err);
    return "Error fetching context.";
  }
};

const getRecentStats = async (userId) => {
  const transactions = await Transaction.find({ userId }).limit(5).sort({ date: -1 });
  let statsMsg = "📊 **Recent Transactions**\n\n";
  
  if (transactions.length === 0) {
    statsMsg += "No transactions found yet.";
  } else {
    transactions.forEach(t => {
      statsMsg += `• ${t.amount} sum - ${t.category} (${t.description})\n`;
    });
  }
  return statsMsg;
};

const getCategorySummary = async (userId) => {
  try {
    const summary = await Transaction.aggregate([
      { $match: { userId: userId, type: 'expense' } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } }
    ]);
    
    if (summary.length === 0) return "No spending data available.";

    let report = "📊 **Spending by Category**\n\n";
    report += "`Category          | Total Sum` \n";
    report += "`---------------------------` \n";
    
    summary.forEach(item => {
      const cat = item._id.padEnd(16);
      report += `\`${cat} | ${item.total.toLocaleString()} sum\`\n`;
    });
    
    return report;
  } catch (err) {
    console.error(err);
    return "Error generating summary.";
  }
};

module.exports = { processTransaction, getRecentStats, getCategorySummary };
