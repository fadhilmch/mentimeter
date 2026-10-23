import { defineStore } from 'pinia';
import { api, ApiError, setTokenRefresher, type PublicUser } from '../api';
import { firebaseEnabled, friendlyAuthError, isPopupCancelled, loadFirebase } from '../firebaseClient';

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
    /** Name the sign-in provider suggested (e.g. the Google name), used to prefill finish-setup. */
    pendingName: '',
    /** False for Google-only logins: they confirm sensitive actions with Google, not a password. */
    hasPasswordLogin: true,
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
      this.hasPasswordLogin = (fbUser.providerData ?? []).some((p) => p?.providerId === 'password');
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
          this.pendingName = fbUser.displayName ?? '';
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
    /** Google sign-in. A brand-new Google login still finishes its profile (name) on the next screen. */
    async loginWithGoogle() {
      const fb = await this.firebase();
      try {
        const cred = await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider());
        await this.loadProfile(cred.user);
      } catch (err) {
        if (isPopupCancelled(err)) return; // backed out of the popup: nothing to report
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
        this.setSession(token, await this.reconcile(fb, cred.user, token, err), cred.user.uid);
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
        this.setSession(token, await this.reconcile(fb, cred.user, token, err), cred.user.uid);
      }
    },
    /**
     * After a write failed, the Firebase login is removed only when the server confirms it has no profile for it
     * AND had clearly refused the write. An error code alone never proves nothing was saved (a repeat can be
     * refused because the first try worked). If a profile exists, that is the outcome. If unsure, keep the login.
     */
    async reconcile(fb: Firebase, fbUser: FbUser, token: string, err: unknown): Promise<PublicUser> {
      let absent = false;
      try {
        return (await api.me(token)).user;
      } catch (check) {
        absent = needsProfile(check);
      }
      if (absent && definitive(err)) {
        try {
          await fb.deleteUser(fbUser);
        } catch {
          throw new Error('Your login was created but setup did not finish. Log in with that email to try again.');
        }
        throw err;
      }
      this.token = token;
      this.uid = fbUser.uid;
      this.user = null;
      this.pendingProfile = true;
      throw new Error(UNSURE);
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
    /** True when the account is gone. Backing out of the Google re-check is a quiet no. */
    async deleteAccount(password: string): Promise<boolean> {
      if (!firebaseEnabled) {
        await api.deleteAccount(this.token, password);
        await this.logout();
        return true;
      }
      const fb = await this.firebase();
      try {
        const current = fb.auth.currentUser;
        if (!current) throw new Error('You are not signed in.');
        const providers = (current.providerData ?? []).map((p) => p?.providerId);
        if (providers.includes('password')) {
          if (!current.email) throw new Error('You are not signed in.');
          await fb.reauthenticateWithCredential(current, fb.EmailAuthProvider.credential(current.email, password));
        } else if (providers.includes('google.com')) {
          await fb.reauthenticateWithPopup(current, new fb.GoogleAuthProvider());
        } else {
          throw new Error('Log in again before deleting your account.');
        }
        this.token = await current.getIdToken(true);
        const result = await api.deleteAccount(this.token);
        // Without a server-side service account the server cannot remove the login, so this browser does.
        // The data is already gone at that point; if this step fails the login still works and can be removed by retrying.
        if (result.firebaseLoginRemoved === false) {
          try {
            await fb.deleteUser(current);
          } catch {
            throw new ApiError(500, { code: 'LOGIN_REMOVAL_INCOMPLETE', message: 'Your presentations and profile were deleted, but your login could not be removed yet. Log in again and delete the account to finish.' });
          }
        }
        await this.logout();
        return true;
      } catch (err) {
        if (isPopupCancelled(err)) return false;
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
      this.pendingName = '';
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
