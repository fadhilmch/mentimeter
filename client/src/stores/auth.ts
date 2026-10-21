import { defineStore } from 'pinia';
import { api, ApiError, setTokenRefresher, type PublicUser } from '../api';
import { firebaseEnabled, friendlyAuthError, loadFirebase } from '../firebaseClient';

type Firebase = Awaited<ReturnType<typeof loadFirebase>>;
type FbUser = NonNullable<Firebase['auth']['currentUser']>;

/** The server answered with a client error, so it did not do the write. Anything else (network loss, 5xx) is uncertain. */
const definitive = (err: unknown) => err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
const needsProfile = (err: unknown) => err instanceof ApiError && err.body.code === 'PROFILE_REQUIRED';

const UNSURE = 'We could not confirm that your account was set up. Log in with your email to check and finish.';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('livepoll.token') ?? '',
    user: JSON.parse(localStorage.getItem('livepoll.user') ?? 'null') as PublicUser | null,
    uid: localStorage.getItem('livepoll.uid') ?? '',
    /** Signed in with Firebase but no app profile yet (setup was interrupted). */
    pendingProfile: false,
    ready: !firebaseEnabled,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token) && Boolean(state.user),
    usesFirebase: () => firebaseEnabled,
  },
  actions: {
    /** Firebase restores its own session asynchronously. The router waits for this before checking login. */
    async init() {
      if (!firebaseEnabled || this.ready) return;
      const fb = await this.firebase();
      await fb.auth.authStateReady();
      if (fb.auth.currentUser) await this.loadProfile(fb.auth.currentUser);
      else this.clear();
      fb.onIdTokenChanged(fb.auth, async (u) => {
        if (!u) return this.clear(); // signed out elsewhere, or the login was removed
        if (u.uid !== this.uid) await this.loadProfile(u); // a different person: never keep the last one's data
        else this.token = await u.getIdToken();
      });
      this.ready = true;
    },

    /** Loads who this Firebase login is from the server. The stored copy is trusted only for the same login and only offline. */
    async loadProfile(fbUser: FbUser) {
      const token = await fbUser.getIdToken();
      const stored = this.uid === fbUser.uid ? this.user : null;
      this.pendingProfile = false;
      try {
        const { user } = await api.me(token);
        this.setSession(token, user, fbUser.uid);
      } catch (err) {
        if (needsProfile(err)) {
          this.clear();
          this.token = token;
          this.uid = fbUser.uid;
          this.pendingProfile = true;
        } else if (err instanceof ApiError && err.status === 401) {
          this.clear();
        } else if (stored) {
          this.setSession(token, stored, fbUser.uid); // offline or server error: same login, keep the saved profile
        } else {
          this.clear();
          throw this.explain(err);
        }
      }
    },

    /** Creates the profile. Safe to repeat on the server, so an uncertain outcome is retried instead of guessed. */
    async createProfileReconciled(token: string, name: string): Promise<PublicUser> {
      try {
        return (await api.createProfile(token, name)).user;
      } catch (err) {
        if (definitive(err)) throw err;
        try {
          return (await api.me(token)).user; // it may have been saved, with the answer lost
        } catch (check) {
          if (!needsProfile(check)) throw err;
          return (await api.createProfile(token, name)).user;
        }
      }
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
        await this.loadProfile(cred.user);
      } catch (err) {
        throw this.explain(err);
      }
    },
    async signupWithEmail(name: string, email: string, password: string) {
      const fb = await this.firebase();
      let cred;
      try {
        cred = await fb.createUserWithEmailAndPassword(fb.auth, email, password);
      } catch (err) {
        throw this.explain(err);
      }
      const token = await cred.user.getIdToken();
      try {
        this.setSession(token, await this.createProfileReconciled(token, name), cred.user.uid);
      } catch (err) {
        throw await this.undoOrKeep(fb, cred.user, token, err);
      }
    },
    /** Moves an old username account onto an email login. Presentations keep the same owner. */
    async claimLegacyAccount(username: string, oldPassword: string, email: string, newPassword: string) {
      const fb = await this.firebase();
      let cred;
      try {
        cred = await fb.createUserWithEmailAndPassword(fb.auth, email, newPassword);
      } catch (err) {
        throw this.explain(err);
      }
      const token = await cred.user.getIdToken();
      try {
        let user: PublicUser;
        try {
          user = (await api.claimLegacy(token, username, oldPassword)).user;
        } catch (err) {
          if (definitive(err)) throw err;
          user = (await api.claimLegacy(token, username, oldPassword)).user; // the move is safe to repeat
        }
        this.setSession(token, user, cred.user.uid);
      } catch (err) {
        throw await this.undoOrKeep(fb, cred.user, token, err);
      }
    },
    /** After a failed write: remove the new login only if the server clearly refused. If unsure, keep it and say so. */
    async undoOrKeep(fb: Firebase, fbUser: FbUser, token: string, err: unknown): Promise<Error> {
      if (definitive(err)) {
        try {
          await fb.deleteUser(fbUser);
        } catch {
          return new Error('Your login was created but setup did not finish. Log in with that email to try again.');
        }
        return err as Error;
      }
      this.token = token;
      this.uid = fbUser.uid;
      this.user = null;
      this.pendingProfile = true;
      return new Error(UNSURE);
    },
    /** Finishes an interrupted signup. */
    async finishProfile(name: string) {
      const fb = await this.firebase();
      const current = fb.auth.currentUser;
      if (!current) throw new Error('You are not signed in.');
      try {
        const token = await current.getIdToken();
        this.setSession(token, await this.createProfileReconciled(token, name), current.uid);
        this.pendingProfile = false;
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
    setSession(token: string, user: PublicUser, uid = '') {
      this.token = token;
      this.user = user;
      this.uid = uid;
      this.pendingProfile = false;
      localStorage.setItem('livepoll.token', token);
      localStorage.setItem('livepoll.user', JSON.stringify(user));
      if (uid) localStorage.setItem('livepoll.uid', uid);
      else localStorage.removeItem('livepoll.uid');
    },
    clear() {
      this.token = '';
      this.user = null;
      this.uid = '';
      this.pendingProfile = false;
      localStorage.removeItem('livepoll.token');
      localStorage.removeItem('livepoll.user');
      localStorage.removeItem('livepoll.uid');
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
