/** Mirrors server/src/lib/leaderboard.js aliasFor - must stay in sync so the
 *  client can find its own leaderboard row by name. */
export const ADJECTIVES = [
  'Amber', 'Brave', 'Calm', 'Dapper', 'Eager', 'Fizzy', 'Gentle', 'Happy',
  'Icy', 'Jolly', 'Kind', 'Lucky', 'Mellow', 'Nimble', 'Proud', 'Quick',
  'Rusty', 'Sunny', 'Tidy', 'Witty',
];
export const ANIMALS = [
  'Otter', 'Fox', 'Panda', 'Lynx', 'Moose', 'Heron', 'Badger', 'Falcon',
  'Gecko', 'Walrus', 'Raven', 'Bison', 'Koala', 'Tiger', 'Seal', 'Crane',
  'Mole', 'Finch', 'Yak', 'Wolf',
];

export function aliasFor(participantId: string): string {
  let hash = 0;
  for (const ch of String(participantId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length];
  const number = (Math.floor(hash / (ADJECTIVES.length * ANIMALS.length)) % 89) + 10;
  return `${adjective} ${animal} ${number}`;
}

/** A fun short nickname for the "Generate nickname" button: adjective + animal, no number.
 *  Random on every call (unlike aliasFor, which is stable per device). */
export function randomNickname(random: () => number = Math.random): string {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length]
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
}
