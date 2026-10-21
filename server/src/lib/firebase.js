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

/** Verifies a Firebase ID token. `checkRevoked` adds a network lookup, so only sensitive routes use it. */
export async function verifyFirebaseToken(token, { checkRevoked = false } = {}) {
  const decoded = await adminAuth().verifyIdToken(token, checkRevoked);
  return {
    uid: decoded.uid,
    email: decoded.email ? String(decoded.email).toLowerCase() : undefined,
    emailVerified: Boolean(decoded.email_verified),
    authTime: decoded.auth_time,
  };
}

export async function deleteFirebaseUser(uid) {
  try {
    await adminAuth().deleteUser(uid);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') return; // already gone, so a retry is safe
    throw err;
  }
}

export function firebaseConnectSources() {
  const sources = ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'];
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) sources.push(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  return sources;
}
