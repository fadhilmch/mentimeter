const DEFAULT_ALPHABET = '0123456789';

export function generateAccessCode({ length = 6, alphabet = DEFAULT_ALPHABET, random = Math.random } = {}) {
  if (length < 1) throw new RangeError('Access code length must be at least 1');
  if (alphabet.length < 2) throw new RangeError('Access code alphabet needs at least 2 characters');
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(random() * alphabet.length)];
  }
  return code;
}

/**
 * Generates a code that does not collide with existing records.
 * `exists` is an async predicate returning true when the code is taken.
 */
export async function generateUniqueAccessCode(exists, { maxAttempts = 25, ...options } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateAccessCode(options);
    if (!(await exists(code))) return code;
  }
  throw new Error(`Could not allocate a unique access code after ${maxAttempts} attempts`);
}
