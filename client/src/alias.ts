/** Mirrors server/src/lib/leaderboard.js aliasFor - must stay in sync so the
 *  client can find its own leaderboard row by name. */
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

export function aliasFor(participantId: string): string {
  let hash = 0;
  for (const ch of String(participantId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length];
  const number = (Math.floor(hash / (ADJECTIVES.length * ANIMALS.length)) % 89) + 10;
  return `${adjective} ${animal} ${number}`;
}
