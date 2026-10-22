import { defineStore } from 'pinia';
import { createLiveTransport } from '../live';
import type { LiveAction, LiveTransport, PresentationState } from '../types';
import { participantId, participantToken, ensureCredential } from '../participant';

export const useLiveStore = defineStore('live', {
  state: () => ({
    transport: null as LiveTransport | null,
    state: null as PresentationState | null,
    error: '',
    connected: false,
    /** Counts successful reconnects, so a view can drop an error that the reconnect has resolved. */
    reconnects: 0,
  }),
  getters: {
    currentSlide(state) {
      if (!state.state) return null;
      return state.state.slides[state.state.currentSlide] ?? null;
    },
  },
  actions: {
    async join(accessCode: string) {
      this.error = '';
      this.leave();
      const transport = createLiveTransport();
      this.transport = transport;
      transport.onState((state) => {
        this.state = state;
      });
      transport.onReconnect?.(() => {
        this.reconnects += 1;
      });
      try {
        await ensureCredential(accessCode);
        this.state = await transport.join(accessCode);
        this.connected = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Could not join';
        this.connected = false;
        throw err;
      }
    },
    async act(action: LiveAction) {
      if (!this.transport) throw new Error('Not connected');
      const code = this.state?.accessCode;
      const token = code ? participantToken(code) : null;
      await this.transport.send((token ? { ...action, token } : action) as LiveAction);
    },
    vote(slideIndex: number, optionIndex: number) {
      return this.act({ type: 'vote:cast', slideIndex, optionIndex, participantId: participantId() });
    },
    respond(slideIndex: number, text: string, clientId?: string) {
      return this.act({ type: 'response:add', slideIndex, text, participantId: participantId(), clientId });
    },
    upvote(slideIndex: number, responseIndex: number, on?: boolean) {
      return this.act({ type: 'response:upvote', slideIndex, responseIndex, participantId: participantId(), on });
    },
    submitWord(slideIndex: number, text: string) {
      return this.act({ type: 'word:submit', slideIndex, text, participantId: participantId() });
    },
    castRating(slideIndex: number, value: number) {
      return this.act({ type: 'rating:cast', slideIndex, value, participantId: participantId() });
    },
    submitRanking(slideIndex: number, order: string[]) {
      return this.act({ type: 'ranking:submit', slideIndex, order, participantId: participantId() });
    },
    async identify(nickname: string) {
      const cleaned = nickname.trim().slice(0, 24);
      await this.act({ type: 'participant:identify', participantId: participantId(), nickname: cleaned });
      // Keep it on the device only once the server has it, so a failed save never counts as chosen.
      if (cleaned) localStorage.setItem('livepoll.nickname', cleaned);
      else localStorage.removeItem('livepoll.nickname');
    },
    leave() {
      this.transport?.leave();
      this.transport = null;
      this.state = null;
      this.connected = false;
    },
  },
});
