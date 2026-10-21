/**
 * Quiz leaderboard: +1 point per correct answer, final vote counts.
 * Answers can change until voting closes; votes already move on recast, so the
 * current stored votes ARE the final ones once the presenter closes voting.
 */
const ADJECTIVES = [
  'Amber', 'Brave', 'Calm', 'Dapper', 'Eager', 'Fizzy', 'Gentle', 'Happy',
  'Icy', 'Jolly', 'Kind', 'Lucky', 'Mellow', 'Nimble', 'Proud', 'Quick',
  'Rusty', 'Sunny', 'Tidy', 'Witty',
];
const ANIMALS = [
  'Otter', 'Fox', 'Panda', 'Lynx', 'Moose', 'Heron', 'Badger', 'Falcon',
  'Gecko', 'Walrus', 'Raven', 'Bison', 'Koala', 'Tiger', 'Seal', 'Crane',
  'Mole', 'Finch', 'Yak', 'Wolf',
];

/** Stable alias per participant id, so an unnamed voter still has a name. */
export function aliasFor(participantId) {
  let hash = 0;
  for (const ch of String(participantId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length];
  const number = (Math.floor(hash / (ADJECTIVES.length * ANIMALS.length)) % 89) + 10;
  return `${adjective} ${animal} ${number}`;
}

/** Nickname when the participant picked one, otherwise their stable alias. */
export function displayName(presentation, participantId) {
  const entry = (presentation.participants ?? []).find((p) => p.participantId === participantId);
  return entry?.nickname?.trim() || aliasFor(participantId);
}

/** Sorted board: score desc, name asc tiebreak; competition ranks (1, 2, 2, 4). */
export function computeLeaderboard(presentation) {
  const scores = new Map();
  const answered = new Set();
  for (const slide of presentation.slides ?? []) {
    if (slide.questionType !== 'quiz' || !slide.correctOptionId || !slide.revealed) continue;
    for (const option of slide.options ?? []) {
      for (const participantId of option.votes ?? []) answered.add(participantId);
    }
    const correct = (slide.options ?? []).find((option) => option.id && option.id === slide.correctOptionId);
    if (!correct) continue;
    for (const participantId of correct.votes ?? []) {
      scores.set(participantId, (scores.get(participantId) ?? 0) + 1);
    }
  }
  // Everyone who answered a revealed question is on the board, wrong answers
  // included - a 0-point player still sees their own rank.
  const entries = [...answered]
    .map((participantId) => ({ name: displayName(presentation, participantId), score: scores.get(participantId) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  entries.forEach((entry, i) => {
    entry.rank = i > 0 && entry.score === entries[i - 1].score ? entries[i - 1].rank : i + 1;
  });
  return entries;
}
