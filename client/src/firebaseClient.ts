// Firebase is optional and loaded on demand, so the built-in login pays no download cost.
// It is on only when VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID are set at build time.
// These values identify the project to the browser. They are not secrets.
const env = import.meta.env

export const firebaseEnabled = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID)

export async function loadFirebase() {
  const [{ initializeApp, getApps }, authLib] = await Promise.all([import('firebase/app'), import('firebase/auth')])
  const app = getApps()[0] ?? initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
  })
  const auth = authLib.getAuth(app)
  // Local work only: points the SDK at the Firebase Auth emulator instead of a real project.
  if (env.VITE_FIREBASE_AUTH_EMULATOR_URL && !(auth as unknown as { emulatorConfig?: unknown }).emulatorConfig) {
    authLib.connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_URL, { disableWarnings: true })
  }
  return { auth, ...authLib }
}

/** Plain-language messages for Firebase sign-in errors. Unknown codes get a generic line. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Wrong email or password.'
    case 'auth/email-already-in-use':
      return 'That email already has an account. Log in instead.'
    case 'auth/weak-password':
      return 'Use a password with at least 8 characters.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'auth/network-request-failed':
      return 'Could not reach the sign-in service. Check your connection.'
    case 'auth/requires-recent-login':
      return 'For safety, enter your password again.'
    default:
      return err instanceof Error && !code ? err.message : 'Something went wrong. Please try again.'
  }
}
