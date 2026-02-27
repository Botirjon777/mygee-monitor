const Transaction = require('../models/Transaction');
const { categorizeTransaction, checkWarnings } = require('../utils/ai');

const processTransaction = async (userId, text, history = []) => {
  const data = await categorizeTransaction(text, history);
  
  if (!data || !data.amount) {
    return { success: false, message: "I couldn't understand that. Please try again with details like amount and what you spent it on." };
  }

  const transaction = new Transaction({
    userId,
    amount: data.amount,
    description: data.description,
    category: data.category,
    type: data.type,
    rawInput: text
  });

  await transaction.save();

  let response = `✅ Saved: **${data.amount} sum** for "${data.description}"\nCategory: **${data.category}**`;
  
  const warning = checkWarnings(data.category, data.amount);
  if (warning) {
    response += `\n\n⚠️ **WARNING**: ${warning}`;
  }

  return { success: true, message: response };
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
