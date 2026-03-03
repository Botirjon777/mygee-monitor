/**
 * dateService.js
 * Pure server-side utility to resolve relative date expressions to actual Date objects.
 * No AI dependency – fast and deterministic.
 */

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parses a relative date string from user input and returns a Date set to midnight local time.
 * Falls back to today if no date reference is found.
 * @param {string} text - Raw user message
 * @returns {{ date: Date, label: string }} - Resolved date and human-readable label
 */
const resolveDate = (text) => {
  const lower = text.toLowerCase();
  const now = new Date();
  const today = _startOfDay(now);

  // --- "today" ---
  if (/\btoday\b/.test(lower)) {
    return { date: today, label: formatDate(today) };
  }

  // --- "yesterday" ---
  if (/\byesterday\b/.test(lower)) {
    const d = _addDays(today, -1);
    return { date: d, label: formatDate(d) };
  }

  // --- "X days ago" ---
  const daysAgoMatch = lower.match(/(\d+)\s+days?\s+ago/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1]);
    const d = _addDays(today, -n);
    return { date: d, label: formatDate(d) };
  }

  // --- "last Monday / Tuesday / ..." ---
  const lastDayMatch = lower.match(/last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (lastDayMatch) {
    const targetDay = DAY_NAMES.indexOf(lastDayMatch[1]);
    const d = _lastWeekday(today, targetDay);
    return { date: d, label: formatDate(d) };
  }

  // --- "this Monday / Tuesday / ..." (within current week) ---
  const thisDayMatch = lower.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (thisDayMatch) {
    const targetDay = DAY_NAMES.indexOf(thisDayMatch[1]);
    const d = _thisWeekday(today, targetDay);
    return { date: d, label: formatDate(d) };
  }

  // --- Day name only (e.g. "on Monday", "monday i paid") ---
  for (const dayName of DAY_NAMES) {
    if (lower.includes(dayName)) {
      const targetDay = DAY_NAMES.indexOf(dayName);
      // Use the most recent occurrence of that weekday
      const d = _lastWeekday(today, targetDay);
      return { date: d, label: formatDate(d) };
    }
  }

  // --- "last week" ---
  if (/last\s+week/.test(lower)) {
    const d = _addDays(today, -7);
    return { date: d, label: formatDate(d) };
  }

  // --- Explicit date formats: "02.03.2026", "2026-03-02", "03/02/2026" ---
  const dotMatch = lower.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dotMatch) {
    const d = new Date(parseInt(dotMatch[3]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[1]));
    return { date: d, label: formatDate(d) };
  }

  const dashMatch = lower.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dashMatch) {
    const d = new Date(parseInt(dashMatch[1]), parseInt(dashMatch[2]) - 1, parseInt(dashMatch[3]));
    return { date: d, label: formatDate(d) };
  }

  const slashMatch = lower.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (slashMatch) {
    const d = new Date(parseInt(slashMatch[3]), parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]));
    return { date: d, label: formatDate(d) };
  }

  // Default: today
  return { date: today, label: formatDate(today) };
};

/**
 * Formats a Date to "DD.MM.YYYY"
 */
const formatDate = (date) => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
};

/**
 * Formats a Date to short weekday + date: "Mon 03.03"
 */
const formatShort = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${days[date.getDay()]} ${d}.${m}`;
};

/**
 * Returns start of week (Monday) for a given date
 */
const startOfWeek = (date) => {
  const d = _startOfDay(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  return _addDays(d, diff);
};

/**
 * Returns start of month for a given date
 */
const startOfMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/**
 * Returns start of year for a given date
 */
const startOfYear = (date) => {
  return new Date(date.getFullYear(), 0, 1);
};

/** @private */
const _startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** @private */
const _addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

/** @private – returns the most recent past occurrence of a weekday (could be today) */
const _lastWeekday = (today, targetDay) => {
  const diff = (today.getDay() - targetDay + 7) % 7 || 7;
  return _addDays(today, -diff);
};

/** @private – returns the current-week occurrence of a weekday */
const _thisWeekday = (today, targetDay) => {
  const weekStart = startOfWeek(today);
  const d = _addDays(weekStart, targetDay === 0 ? 6 : targetDay - 1);
  return d;
};

module.exports = { resolveDate, formatDate, formatShort, startOfWeek, startOfMonth, startOfYear };
