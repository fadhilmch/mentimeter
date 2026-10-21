import { defineStore } from 'pinia';
import { api, ApiError, setTokenRefresher, type PublicUser } from '../api';
import { firebaseEnabled, friendlyAuthError, loadFirebase } from '../firebaseClient';

type Firebase = Awaited<ReturnType<typeof loadFirebase>>;

const emailName = (email: string) => email.split('@')[0] || 'Presenter';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('livepoll.token') ?? '',
    user: JSON.parse(localStorage.getItem('livepoll.user') ?? 'null') as PublicUser | null,
    ready: !firebaseEnabled,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
    usesFirebase: () => firebaseEnabled,
  },
  actions: {
    /** Firebase restores its own session asynchronously. The router waits for this before checking login. */
    async init() {
      if (!firebaseEnabled || this.ready) return;
      const fb = await loadFirebase();
      setTokenRefresher(async () => (fb.auth.currentUser ? fb.auth.currentUser.getIdToken() : undefined));
      await fb.auth.authStateReady();
      if (fb.auth.currentUser) {
        this.token = await fb.auth.currentUser.getIdToken();
      } else {
        this.clear();
      }
      fb.onIdTokenChanged(fb.auth, async (u) => {
        if (u) this.token = await u.getIdToken();
      });
      this.ready = true;
    },

    // Built-in login (used when Firebase is off).
    async login(username: string, password: string) {
      const res = await api.login(username, password);
      this.setSession(res.token, res.user);
    },
    async signup(name: string, username: string, password: string) {
      const res = await api.signup(name, username, password);
      this.setSession(res.token, res.user);
    },

    // Firebase sign-in.
    async loginWithEmail(email: string, password: string) {
      const fb = await this.firebase();
      try {
        const cred = await fb.signInWithEmailAndPassword(fb.auth, email, password);
        const token = await cred.user.getIdToken();
        let user: PublicUser;
        try {
          user = (await api.me(token)).user;
        } catch (err) {
          // Signed up with Firebase but the profile step never finished: finish it now.
          if (!(err instanceof ApiError) || err.body.code !== 'PROFILE_REQUIRED') throw err;
          user = (await api.createProfile(token, emailName(email))).user;
        }
        this.setSession(token, user);
      } catch (err) {
        throw this.explain(err);
      }
    },
    async signupWithEmail(name: string, email: string, password: string) {
      const fb = await this.firebase();
      try {
        const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, password);
        const token = await cred.user.getIdToken();
        try {
          const { user } = await api.createProfile(token, name);
          this.setSession(token, user);
        } catch (err) {
          await fb.deleteUser(cred.user).catch(() => undefined); // no half-made accounts
          throw err;
        }
      } catch (err) {
        throw this.explain(err);
      }
    },
    /** Moves an old username account onto an email login. Presentations keep the same owner. */
    async claimLegacyAccount(username: string, oldPassword: string, email: string, newPassword: string) {
      const fb = await this.firebase();
      try {
        const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, newPassword);
        const token = await cred.user.getIdToken();
        try {
          const { user } = await api.claimLegacy(token, username, oldPassword);
          this.setSession(token, user);
        } catch (err) {
          await fb.deleteUser(cred.user).catch(() => undefined);
          throw err;
        }
      } catch (err) {
        throw this.explain(err);
      }
    },
    /** Always resolves the same way, so the form cannot be used to find out which emails have accounts. */
    async sendPasswordReset(email: string) {
      const fb = await this.firebase();
      try {
        await fb.sendPasswordResetEmail(fb.auth, email);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'auth/user-not-found') return;
        throw this.explain(err);
      }
    },
    async deleteAccount(password: string) {
      if (!firebaseEnabled) {
        await api.deleteAccount(this.token, password);
        return this.logout();
      }
      const fb = await this.firebase();
      try {
        const current = fb.auth.currentUser;
        if (!current?.email) throw new Error('You are not signed in.');
        await fb.reauthenticateWithCredential(current, fb.EmailAuthProvider.credential(current.email, password));
        this.token = await current.getIdToken(true);
        await api.deleteAccount(this.token);
        await this.logout();
      } catch (err) {
        throw this.explain(err);
      }
    },

    async firebase(): Promise<Firebase> {
      const fb = await loadFirebase();
      setTokenRefresher(async () => (fb.auth.currentUser ? fb.auth.currentUser.getIdToken() : undefined));
      return fb;
    },
    explain(err: unknown): Error {
      if (err instanceof ApiError) return err;
      return new Error(friendlyAuthError(err));
    },
    setSession(token: string, user: PublicUser) {
      this.token = token;
      this.user = user;
      localStorage.setItem('livepoll.token', token);
      localStorage.setItem('livepoll.user', JSON.stringify(user));
    },
    clear() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('livepoll.token');
      localStorage.removeItem('livepoll.user');
    },
    async logout() {
      this.clear();
      if (firebaseEnabled) {
        const fb = await loadFirebase().catch(() => undefined);
        await fb?.signOut(fb.auth).catch(() => undefined);
      }
    },
  },
});
