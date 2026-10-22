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

/** cyrb53: small synchronous 53-bit string hash. Not a secret, only an opaque stable label. */
function cyrb53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Opaque per-room label for one player. Two players can share a display name (the same chosen
 * nickname, or the same alias), so a phone finds its own leaderboard row by this label instead.
 * The raw participant id is a bearer-like secret and never leaves the server; this label cannot
 * be turned back into it. Mirrored in client/src/alias.ts (a shared test vector keeps them equal).
 */
export function playerKey(accessCode, participantId) {
  return cyrb53(`${accessCode}:${participantId}`).toString(36);
}

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
    .map((participantId) => ({
      key: playerKey(presentation.accessCode, participantId),
      name: displayName(presentation, participantId),
      score: scores.get(participantId) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  entries.forEach((entry, i) => {
    entry.rank = i > 0 && entry.score === entries[i - 1].score ? entries[i - 1].rank : i + 1;
  });
  return entries;
}
