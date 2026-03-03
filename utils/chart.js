/**
 * chart.js
 * Renders spending data as emoji bar charts for Telegram (Markdown-safe).
 */

const BAR_CHAR = '█';
const EMPTY_CHAR = '░';
const MAX_BAR_WIDTH = 10;

/**
 * Renders a bar chart from an array of { label, value } items.
 * @param {Array<{ label: string, value: number }>} items
 * @param {{ title?: string, unit?: string, maxBars?: number }} options
 * @returns {string} Telegram Markdown-formatted string
 */
const renderBarChart = (items, { title = '', unit = 'sum', maxBars = 10 } = {}) => {
  if (!items || items.length === 0) return '_No data available._';

  // Limit + sort descending
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, maxBars);
  const maxVal = sorted[0].value || 1;

  let out = title ? `*${title}*\n\n` : '';
  out += '```\n';

  for (const item of sorted) {
    const barLen = Math.round((item.value / maxVal) * MAX_BAR_WIDTH);
    const bar = BAR_CHAR.repeat(barLen) + EMPTY_CHAR.repeat(MAX_BAR_WIDTH - barLen);
    const label = item.label.padEnd(10).slice(0, 10);
    const valueStr = formatAmount(item.value).padStart(10);
    out += `${label} ${bar} ${valueStr}\n`;
  }

  out += '```';
  return out;
};

/**
 * Renders a horizontal timeline chart (days of week or months).
 * Each entry: { label: "Mon", value: number }
 * @returns {string}
 */
const renderTimeline = (items, { title = '', unit = 'sum' } = {}) => {
  if (!items || items.length === 0) return '_No data available._';

  const maxVal = Math.max(...items.map(i => i.value)) || 1;

  let out = title ? `*${title}*\n\n` : '';
  out += '```\n';

  for (const item of items) {
    const barLen = Math.round((item.value / maxVal) * MAX_BAR_WIDTH);
    const bar = BAR_CHAR.repeat(barLen) + EMPTY_CHAR.repeat(MAX_BAR_WIDTH - barLen);
    const label = item.label.padEnd(12).slice(0, 12);
    const valueStr = item.value > 0 ? formatAmount(item.value) : '—';
    out += `${label} ${bar} ${valueStr}\n`;
  }

  out += '```';
  return out;
};

/**
 * Formats a number with thousands separators.
 */
const formatAmount = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
};

module.exports = { renderBarChart, renderTimeline, formatAmount };
