import type { GameEvent } from './types';

/** Snapshot history is for the log. Only newly delivered packets are effects. */
export class LiveEventStream {
  private ready = false;
  private lastSeq = 0;

  reset() { this.ready = false; this.lastSeq = 0; }

  hydrate(events: readonly GameEvent[]) {
    this.lastSeq = Math.max(this.lastSeq, ...events.map(event => event.seq), 0);
    this.ready = true;
  }

  accept(event: GameEvent): { event?: GameEvent; gap: boolean } {
    if (!this.ready || event.seq <= this.lastSeq) return { gap: false };
    if (event.seq !== this.lastSeq + 1) {
      this.ready = false;
      return { gap: true };
    }
    this.lastSeq = event.seq;
    return { ...(event.key !== 'event.hidden' ? { event } : {}), gap: false };
  }
}
