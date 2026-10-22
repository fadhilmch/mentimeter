import { tallySlide, isPublicResponse } from './results.js';
import { computeLeaderboard } from './leaderboard.js';

/**
 * One CSV cell, safe for spreadsheets. Values that start with = + - @ (or tab / carriage return)
 * would be run as formulas by Excel or Sheets, so they get a leading apostrophe. Titles,
 * questions, nicknames and free text are all user-controlled, so every text cell goes through this.
 * Numbers pass through untouched, so a negative number stays a number.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value) : String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header, rows) {
  // UTF-8 byte-order mark so Excel opens accents and non-Latin text correctly.
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

const iso = (date) => (date ? new Date(date).toISOString() : '');

/**
 * Aggregate results, one row per answer item. All numbers come from the same functions as the
 * live screen, so the export cannot disagree with it. No participant ids or nicknames.
 * Definitions: `answers` counts submissions that are currently stored (a changed vote counts once);
 * it is not the number of connected clients and not proof of distinct people.
 */
export function summaryCsv(presentation, now = new Date()) {
  const header = ['presentation', 'exported_at_utc', 'slide', 'type', 'question', 'item', 'measure', 'value', 'is_correct'];
  const rows = [];
  (presentation.slides ?? []).forEach((slide, i) => {
    const base = [presentation.title, iso(now), i + 1, slide.questionType, slide.question];
    const tally = tallySlide(slide);
    if (slide.questionType === 'multiple-choice' || slide.questionType === 'quiz') {
      const correct = slide.questionType === 'quiz' && slide.revealed ? tally.correctOptionIndex : -1;
      slide.options.forEach((option, k) => {
        const flag = slide.questionType === 'quiz' ? (slide.revealed ? String(k === correct) : '') : '';
        rows.push([...base, option.text, 'votes', tally.counts[k], flag]);
        rows.push([...base, option.text, 'percent', tally.percentages[k], flag]);
      });
    } else if (slide.questionType === 'word-cloud') {
      for (const w of tally.words) rows.push([...base, w.text, 'count', w.count, '']);
    } else if (slide.questionType === 'rating') {
      rows.push([...base, 'average', 'rating_1_to_10', tally.average, '']);
      tally.buckets.forEach((count, k) => rows.push([...base, String(k + 1), 'count', count, '']));
    } else if (slide.questionType === 'ranking') {
      slide.options.forEach((option, k) => rows.push([...base, option.text, 'borda_points', tally.points?.[k] ?? 0, '']));
    } else {
      rows.push([...base, '', 'responses', tally.total ?? (slide.responses ?? []).filter(isPublicResponse).length, '']);
    }
    rows.push([...base, '', 'answers_total', tally.total ?? '', '']);
  });
  return toCsv(header, rows);
}

/**
 * Open-ended text with its upvote count and time. Author ids are never included.
 * Inclusion rule: only responses the audience can currently see. Pending, hidden and deleted
 * responses are left out, and so are they from every count and word-cloud total in the summary.
 */
export function responsesCsv(presentation, now = new Date()) {
  const header = ['presentation', 'exported_at_utc', 'slide', 'question', 'response', 'upvotes', 'submitted_at_utc'];
  const rows = [];
  (presentation.slides ?? []).forEach((slide, i) => {
    if (slide.questionType !== 'open-ended') return;
    for (const r of (slide.responses ?? []).filter(isPublicResponse)) {
      rows.push([presentation.title, iso(now), i + 1, slide.question, r.text, (r.upvotes ?? []).length, iso(r.createdAt)]);
    }
  });
  return toCsv(header, rows);
}

/**
 * Quiz scores with display names. Names are what players chose (or the generated alias), so this
 * is a separate export the owner asks for on purpose. Follows the live rule: only revealed
 * questions score. Ties share a rank.
 */
export function leaderboardCsv(presentation, now = new Date()) {
  const header = ['presentation', 'exported_at_utc', 'rank', 'name', 'score'];
  const rows = (computeLeaderboard(presentation) ?? []).map((e) => [presentation.title, iso(now), e.rank, e.name, e.score]);
  return toCsv(header, rows);
}
