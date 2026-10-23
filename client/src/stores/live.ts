import { defineStore } from 'pinia';
import { createLiveTransport } from '../live';
import type { ConnectionState, LiveAction, LiveTransport, PresentationState } from '../types';
import { clockOffset } from '../quizTimer';
import { participantId, participantToken, ensureCredential } from '../participant';

export const useLiveStore = defineStore('live', {
  state: () => ({
    transport: null as LiveTransport | null,
    state: null as PresentationState | null,
    error: '',
    connected: false,
    /** What the transport reports after the first join: connected, reconnecting or offline. */
    connection: 'connected' as ConnectionState,
    presence: null as number | null,
    /** The browser itself reports no network. */
    browserOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
    /** Counts successful reconnects, so a view can drop an error that the reconnect has resolved. */
    reconnects: 0,
    /** Server clock minus this device's clock, for the quiz countdown. */
    clockOffsetMs: 0,
  }),
  getters: {
    /** One value for the banner: browser offline wins, then whatever the transport says. */
    connectionStatus(state): ConnectionState {
      return state.browserOffline ? 'offline' : state.connection;
    },
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
      this.connection = 'connected';
      transport.onConnection?.((next) => {
        this.connection = next;
      });
      transport.onPresence?.((connected) => {
        this.presence = connected
      })
      transport.onReconnect?.(() => {
        this.reconnects += 1;
      });
      try {
        await ensureCredential(accessCode);
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
      if (next.timer?.serverNow) this.clockOffsetMs = clockOffset(next.timer.serverNow);
      return true;
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
    upvote(slideIndex: number, target: { id?: string; index: number }, on?: boolean) {
      // The stable id wins; the stored position is only for answers saved before ids existed.
      return this.act({ type: 'response:upvote', slideIndex, ...(target.id ? { responseId: target.id } : { responseIndex: target.index }), participantId: participantId(), on });
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
    setBrowserOnline(online: boolean) {
      this.browserOffline = !online;
    },
    leave() {
      this.transport?.leave();
      this.transport = null;
      this.state = null;
      this.connected = false;
    },
  },
});
