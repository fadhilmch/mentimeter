/** Deterministic, locally generated participant avatars.
 *  Derived from the display name (nickname or auto-alias) only - no network,
 *  no photos, no extra data leaves the server. The same name always yields the
 *  same avatar, so it stays consistent for the whole session. */
export function hashName(name: string): number {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

export interface AvatarSpec {
  gradId: string;
  from: string;
  to: string;
  initials: string;
}

export function avatarFor(name: string): AvatarSpec {
  const clean = String(name).trim() || '?';
  const hash = hashName(clean);
  const hue = hash % 360;
  const hue2 = (hue + 40 + (hash % 40)) % 360;
  const initials =
    clean
      .split(/\s+/)
      .map((word) => word[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return {
    gradId: `av-${hash.toString(36)}`,
    from: `hsl(${hue}, 74%, 58%)`,
    to: `hsl(${hue2}, 74%, 44%)`,
    initials,
  };
}
