/**
 * analyticsService.js
 * All analytics computed server-side from MongoDB, no AI involved.
 */

const Transaction = require('../models/Transaction');
const { formatDate, formatShort, startOfWeek, startOfMonth, startOfYear } = require('./dateService');
const { renderTimeline, renderBarChart, formatAmount } = require('../utils/chart');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─────────────────────────────────────────────────────────────
// WEEKLY SPENDING  (current week Mon–Sun)
// ─────────────────────────────────────────────────────────────
const getWeeklySpending = async (userId) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const weekStart = startOfWeek(new Date());
  weekStart.setHours(0, 0, 0, 0);

  const raw = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'expense',
        date: { $gte: weekStart, $lte: today }
      }
    },
    {
      $group: {
        _id: { $dayOfWeek: '$date' }, // 1=Sun, 2=Mon, … 7=Sat
        total: { $sum: '$amount' }
      }
    }
  ]);

  // MongoDB $dayOfWeek: 1=Sun … 7=Sat. Map to Mon=0 … Sun=6
  const byDay = {};
  for (const r of raw) {
    const mongoDay = r._id; // 1–7
    const idx = (mongoDay + 5) % 7; // Convert: Mon=0, Tue=1 … Sun=6
    byDay[idx] = r.total;
  }

  const items = DAY_NAMES_SHORT.map((label, idx) => ({
    label,
    value: byDay[idx] || 0
  }));

  const total = items.reduce((s, i) => s + i.value, 0);
  const maxDay = items.reduce((best, i) => (i.value > best.value ? i : best), items[0]);

  const chart = renderTimeline(items, { title: '📅 Weekly Spending' });
  let msg = chart + '\n\n';
  msg += `💰 *Total this week:* ${formatAmount(total)} sum\n`;
  if (maxDay.value > 0) {
    msg += `📌 *Biggest day:* ${maxDay.label} — ${formatAmount(maxDay.value)} sum`;
  }
  return msg;
};

// ─────────────────────────────────────────────────────────────
// MONTHLY SPENDING  (current month, grouped by week)
// ─────────────────────────────────────────────────────────────
const getMonthlySpending = async (userId) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const mStart = startOfMonth(new Date());
  mStart.setHours(0, 0, 0, 0);

  const raw = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'expense',
        date: { $gte: mStart, $lte: today }
      }
    },
    {
      $group: {
        _id: { $week: '$date' },
        total: { $sum: '$amount' },
        minDate: { $min: '$date' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  const items = raw.map((r, i) => ({
    label: `Week ${i + 1}`,
    value: r.total
  }));

  if (items.length === 0) {
    return '📆 *Monthly Spending*\n\n_No expenses recorded this month yet._';
  }

  const total = items.reduce((s, i) => s + i.value, 0);
  const monthName = MONTH_NAMES[new Date().getMonth()];
  const chart = renderTimeline(items, { title: `📆 ${monthName} Spending` });

  return chart + `\n\n💰 *Total this month:* ${formatAmount(total)} sum`;
};

// ─────────────────────────────────────────────────────────────
// YEARLY SPENDING  (current year, grouped by month)
// ─────────────────────────────────────────────────────────────
const getYearlySpending = async (userId) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const yStart = startOfYear(new Date());
  yStart.setHours(0, 0, 0, 0);

  const raw = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'expense',
        date: { $gte: yStart, $lte: today }
      }
    },
    {
      $group: {
        _id: { $month: '$date' }, // 1–12
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  const byMonth = {};
  for (const r of raw) byMonth[r._id] = r.total;

  const currentMonth = new Date().getMonth() + 1;
  const items = [];
  for (let m = 1; m <= currentMonth; m++) {
    items.push({ label: MONTH_NAMES[m - 1], value: byMonth[m] || 0 });
  }

  const total = items.reduce((s, i) => s + i.value, 0);
  const year = new Date().getFullYear();
  const chart = renderTimeline(items, { title: `📈 ${year} Yearly Spending` });

  return chart + `\n\n💰 *Total this year:* ${formatAmount(total)} sum`;
};

// ─────────────────────────────────────────────────────────────
// SPENDING BY CUSTOM RANGE  (day-by-day)
// ─────────────────────────────────────────────────────────────
const getSpendingByRange = async (userId, fromDate, toDate) => {
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999);

  const diffDays = Math.round((to - from) / (1000 * 60 * 60 * 24));

  let groupBy, labelFn;

  if (diffDays <= 31) {
    // Day-by-day for ranges ≤ 31 days
    groupBy = {
      year: { $year: '$date' },
      month: { $month: '$date' },
      day: { $dayOfMonth: '$date' }
    };
    labelFn = (id) => {
      const d = new Date(id.year, id.month - 1, id.day);
      return formatShort(d);
    };
  } else if (diffDays <= 180) {
    // Week-by-week for ranges ≤ 6 months
    groupBy = { year: { $year: '$date' }, week: { $week: '$date' } };
    labelFn = (id) => `W${id.week}`;
  } else {
    // Month-by-month for longer ranges
    groupBy = { year: { $year: '$date' }, month: { $month: '$date' } };
    labelFn = (id) => `${MONTH_NAMES[id.month - 1]} ${id.year}`;
  }

  const raw = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'expense',
        date: { $gte: from, $lte: to }
      }
    },
    { $group: { _id: groupBy, total: { $sum: '$amount' } } },
    { $sort: { '_id': 1 } }
  ]);

  if (raw.length === 0) {
    return `🗓️ *Custom Range: ${formatDate(from)} – ${formatDate(to)}*\n\n_No expenses in this period._`;
  }

  const items = raw.map(r => ({ label: labelFn(r._id), value: r.total }));
  const total = items.reduce((s, i) => s + i.value, 0);

  const chart = renderTimeline(items, {
    title: `🗓️ ${formatDate(from)} – ${formatDate(to)}`
  });

  return chart + `\n\n💰 *Total:* ${formatAmount(total)} sum`;
};

// ─────────────────────────────────────────────────────────────
// TOP SPENDING DAYS OF WEEK  (all time or current month)
// ─────────────────────────────────────────────────────────────
const getTopSpendingDays = async (userId) => {
  const raw = await Transaction.aggregate([
    { $match: { userId, type: 'expense' } },
    {
      $group: {
        _id: { $dayOfWeek: '$date' }, // 1=Sun … 7=Sat
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (raw.length === 0) return 'No data yet.';

  // Convert MongoDB $dayOfWeek (1=Sun) to Mon=0 … Sun=6
  const byDay = {};
  for (const r of raw) {
    const idx = (r._id + 5) % 7;
    byDay[idx] = { total: r.total, count: r.count };
  }

  const items = DAY_NAMES_SHORT.map((label, idx) => ({
    label,
    value: byDay[idx] ? Math.round(byDay[idx].total / Math.max(byDay[idx].count, 1)) : 0
  }));

  const chart = renderBarChart(items, { title: '📊 Avg Spending by Day of Week' });
  return chart;
};

// ─────────────────────────────────────────────────────────────
// YEAR-OVER-YEAR Comparison
// ─────────────────────────────────────────────────────────────
const getYearComparison = async (userId, year1, year2) => {
  const years = [year1, year2];
  const results = {};

  for (const yr of years) {
    const from = new Date(yr, 0, 1);
    const to = new Date(yr, 11, 31, 23, 59, 59);

    const raw = await Transaction.aggregate([
      { $match: { userId, type: 'expense', date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    results[yr] = raw.length > 0 ? raw[0].total : 0;
  }

  const items = years.map(yr => ({ label: yr.toString(), value: results[yr] }));
  const chart = renderBarChart(items, { title: `📊 Year Comparison` });
  const diff = results[year2] - results[year1];
  const sign = diff >= 0 ? '+' : '';
  const pct = results[year1] > 0 ? ` (${sign}${Math.round((diff / results[year1]) * 100)}%)` : '';

  return chart + `\n\n${sign}${formatAmount(diff)} sum${pct} vs previous year`;
};

module.exports = {
  getWeeklySpending,
  getMonthlySpending,
  getYearlySpending,
  getSpendingByRange,
  getTopSpendingDays,
  getYearComparison
};
