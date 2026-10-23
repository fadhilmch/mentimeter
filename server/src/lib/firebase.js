import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from '../config.js';

// Firebase Authentication is optional. It is switched on by FIREBASE_PROJECT_ID (or by
// FIREBASE_AUTH_EMULATOR_HOST for local work). Without it the app keeps its own login.
export function firebaseEnabled() {
  return Boolean(config.firebase.projectId);
}

let override;
// Tests inject a fake so no network or emulator is needed.
export function setFirebaseAuthForTests(fake) {
  override = fake;
}

function adminAuth() {
  if (override) return override;
  if (!getApps().length) {
    const { projectId, serviceAccountJson } = config.firebase;
    initializeApp({
      projectId,
      // Verifying sign-in tokens needs only the project id. Deleting a Firebase user needs a
      // service account, supplied as JSON in FIREBASE_SERVICE_ACCOUNT (never committed).
      ...(serviceAccountJson ? { credential: cert(JSON.parse(serviceAccountJson)) } : {}),
    });
  }
  return getAuth();
}

/**
 * Whether the Admin API can answer revocation questions (a service account, or the local emulator).
 */
export function canCheckRevocation() {
  return canDeleteFirebaseUsers();
}

const LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

/**
 * Keyless revocation check. Firebase's public accounts:lookup accepts the user's own ID token plus the public
 * web API key. It reports when the account's tokens became valid (`validSince`, moved forward by sign-out
 * everywhere or a password reset) and whether the account is disabled or gone. A token issued before
 * `validSince`, or for a missing or disabled account, or when the lookup fails, is rejected. The comparison is the
 * Admin SDK's own: `auth_time` against the account's tokens-valid-after time (base-auth.js, verifyDecodedJWTNotRevokedOrDisabled).
 */
export async function assertNotRevokedKeyless(token, authTime) {
  const { webApiKey } = config.firebase;
  if (!webApiKey) throw new Error('FIREBASE_API_KEY is required to check token revocation without a service account');
  const res = await fetch(`${LOOKUP_URL}?key=${encodeURIComponent(webApiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  });
  if (!res.ok) throw Object.assign(new Error('Token is no longer valid'), { code: 'auth/id-token-revoked' });
  const user = (await res.json()).users?.[0];
  if (!user || user.disabled || !Number.isFinite(Number(authTime)) || Number(user.validSince ?? 0) > Number(authTime)) {
    throw Object.assign(new Error('Token is no longer valid'), { code: 'auth/id-token-revoked' });
  }
}

/** Verifies a Firebase ID token. `checkRevoked` adds a network lookup, so only sensitive routes use it. */
export async function verifyFirebaseToken(token, { checkRevoked = false } = {}) {
  const useAdminCheck = checkRevoked && canCheckRevocation();
  const decoded = await adminAuth().verifyIdToken(token, useAdminCheck);
  if (checkRevoked && !useAdminCheck) await assertNotRevokedKeyless(token, decoded.auth_time);
  return {
    uid: decoded.uid,
    email: decoded.email ? String(decoded.email).toLowerCase() : undefined,
    emailVerified: Boolean(decoded.email_verified),
    authTime: decoded.auth_time,
  };
}

/**
 * The server can delete a Firebase login only with a service account (or the local emulator). Without
 * one, the signed-in browser deletes its own login after the server has removed the data.
 */
export function canDeleteFirebaseUsers() {
  return Boolean(override || config.firebase.serviceAccountJson || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

/** Returns true when the login was removed (or was already gone), false when this server cannot remove it. */
export async function deleteFirebaseUser(uid) {
  if (!canDeleteFirebaseUsers()) return false;
  try {
    await adminAuth().deleteUser(uid);
    return true;
  } catch (err) {
    if (err?.code === 'auth/user-not-found') return true; // already gone, so a retry is safe
    throw err;
  }
}

/** The Google sign-in popup loads its iframe client from Google's script host. */
export function firebaseScriptSources() {
  return ['https://apis.google.com'];
}

/** The Google popup's helper page loads in a frame from the project's auth domain (or the local emulator). */
export function firebaseFrameSources() {
  const { projectId, authDomain } = config.firebase;
  const sources = [`https://${authDomain || `${projectId}.firebaseapp.com`}`];
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) sources.push(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  return sources;
}

export function firebaseConnectSources() {
  const sources = ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'];
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) sources.push(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  return sources;
}
