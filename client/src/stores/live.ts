import { defineStore } from 'pinia';
import { createLiveTransport } from '../live';
import type { LiveAction, LiveTransport, PresentationState } from '../types';
import { participantId } from '../participant';

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
      transport.onState((state) => this.applyState(state));
      transport.onReconnect?.(() => {
        this.reconnects += 1;
      });
      try {
        this.state = null;
        this.applyState(await transport.join(accessCode));
        this.connected = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Could not join';
        this.connected = false;
        throw err;
      }
    },
    /**
     * Takes a snapshot unless it is older than what is already on screen. Broadcasts, resync
     * fetches and presenter HTTP responses can arrive out of order; the screen never goes backwards.
     * Returns whether the snapshot was applied.
     */
    applyState(next: PresentationState): boolean {
      const have = this.state?.revision;
      if (typeof have === 'number' && typeof next.revision === 'number' && next.revision < have) return false;
      this.state = next;
      return true;
    },
    async act(action: LiveAction) {
      if (!this.transport) throw new Error('Not connected');
      await this.transport.send(action);
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
