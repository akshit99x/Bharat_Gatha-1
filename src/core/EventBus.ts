/**
 * Tiny typed pub/sub. Systems talk through this instead of holding references
 * to each other, which keeps the world, UI and quiz layers independently testable.
 */

export type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private readonly map = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
    let set = this.map.get(event);
    if (!set) {
      set = new Set();
      this.map.set(event, set);
    }
    set.add(fn as Listener<never>);
    return () => this.off(event, fn);
  }

  once<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off<K extends keyof Events>(event: K, fn: Listener<Events[K]>): void {
    this.map.get(event)?.delete(fn as Listener<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.map.get(event);
    if (!set) return;
    // Copy so handlers may unsubscribe during dispatch.
    for (const fn of [...set]) {
      try {
        (fn as Listener<Events[K]>)(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${String(event)}" threw`, err);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

/** Events emitted across the game. */
export interface GameEvents {
  'zone:enter': { zoneId: string };
  'zone:exit': { zoneId: string };
  'objective:update': { questId: string };
  'quest:complete': { questId: string; zoneId: string };
  'challenge:start': { challengeId: string };
  'challenge:finish': { challengeId: string; success: boolean; score: number };
  'codex:unlock': { entryId: string };
  'quiz:request': { zoneId: string; count: number; reason: 'challenge' | 'seal' | 'practice' };
  'quiz:finish': { zoneId: string; correct: number; total: number };
  /** A chapter assessment was passed for the first time. */
  'chapter:sealed': { zoneId: string; percent: number };
  'story:plaque': { plaqueId: string; correct: boolean };
  'story:panel': { zoneId: string };
  'vidya:gain': { amount: number; reason: string };
  'toast': { kind: ToastKind; title: string; body?: string; icon?: string; ttl?: number };
  'ui:open': { screen: string };
  'ui:close': { screen: string };
  'player:landed': Record<string, never>;
  'dialogue:open': Record<string, never>;
  'dialogue:close': Record<string, never>;
  'save:dirty': Record<string, never>;
}

export type ToastKind = 'info' | 'good' | 'bad' | 'codex' | 'vidya';

export const bus = new EventBus<GameEvents>();
