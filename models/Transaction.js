const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  rawInput: { type: String },
  date: { type: Date, default: Date.now, index: true }
});

// Compound index for analytics queries (getWeeklySpending, getMonthlySpending, etc.)
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1, date: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
