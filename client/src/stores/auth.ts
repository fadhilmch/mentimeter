import { defineStore } from 'pinia';
import { api, type PublicUser } from '../api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('livepoll.token') ?? '',
    user: JSON.parse(localStorage.getItem('livepoll.user') ?? 'null') as PublicUser | null,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
  },
  actions: {
    async login(username: string, password: string) {
      const res = await api.login(username, password);
      this.setSession(res.token, res.user);
    },
    async signup(name: string, username: string, password: string) {
      const res = await api.signup(name, username, password);
      this.setSession(res.token, res.user);
    },
    setSession(token: string, user: PublicUser) {
      this.token = token;
      this.user = user;
      localStorage.setItem('livepoll.token', token);
      localStorage.setItem('livepoll.user', JSON.stringify(user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('livepoll.token');
      localStorage.removeItem('livepoll.user');
    },
  },
});
