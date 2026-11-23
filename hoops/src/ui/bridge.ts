import type { Match, MatchEvents } from '../sim/Match';

/** Hooks the HTML UI registers so the Phaser scene can report to it. */
export interface UiHooks {
  onFrame(match: Match, demo: boolean): void;
  onEvent<K extends keyof MatchEvents>(name: K, payload: MatchEvents[K], match: Match, demo: boolean): void;
  onMatchStart(match: Match, demo: boolean): void;
}

export const bridge: { hooks: UiHooks | null; settings: { shake: boolean; hints: boolean } } = {
  hooks: null,
  settings: { shake: true, hints: true },
};
