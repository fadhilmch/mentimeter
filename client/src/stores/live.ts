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
      try {
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
      await this.transport.send(action);
    },
    vote(slideIndex: number, optionIndex: number) {
      return this.act({ type: 'vote:cast', slideIndex, optionIndex, participantId: participantId() });
    },
    respond(slideIndex: number, text: string) {
      return this.act({ type: 'response:add', slideIndex, text, participantId: participantId() });
    },
    upvote(slideIndex: number, responseIndex: number) {
      return this.act({ type: 'response:upvote', slideIndex, responseIndex, participantId: participantId() });
    },
    goToSlide(slideIndex: number) {
      return this.act({ type: 'slide:change', slideIndex });
    },
    leave() {
      this.transport?.leave();
      this.transport = null;
      this.state = null;
      this.connected = false;
    },
  },
});
