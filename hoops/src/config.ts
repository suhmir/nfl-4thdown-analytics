/**
 * Central tuning values. World units are feet; time is seconds.
 * World axes: x runs sideline to sideline (0..50), y runs from the baseline
 * under the hoop (0) toward half court (47), z is height above the floor.
 */

export const VIEW = { W: 1920, H: 1080 } as const;

/** Characters are drawn a little larger than life so they read well from the broadcast camera. */
export const CHAR_VIS = 1.12;

export const COURT = {
  W: 50,
  L: 47,
  HOOP: { x: 25, y: 5.25, z: 10 },
  /** Arcade-sized rim (real: 0.75) so the hoop reads clearly from the broadcast camera. */
  RIM_R: 0.95,
  BOARD: { y: 4, x0: 21.4, x1: 28.6, z0: 9.4, z1: 13.6 },
  THREE_R: 23.75,
  CORNER_X: 3,
  CORNER_Y: 14.2,
  KEY: { x0: 17, x1: 33, y1: 19 },
  FT_R: 6,
  RESTRICTED_R: 4,
  CENTER_R: 6,
} as const;

export const PHYS = {
  /** Gravity used for ball flight (slightly arcade-heavy for snappy arcs). */
  G: 40,
  /** Gravity for player jumps. */
  JUMP_G: 44,
  BALL_R: 0.39,
  FLOOR_RESTITUTION: 0.62,
  RIM_RESTITUTION: 0.48,
  BOARD_RESTITUTION: 0.55,
  PLAYER_R: 1.05,
} as const;

export const MOVE = {
  BASE_SPEED: 13.5,
  SPRINT_MULT: 1.36,
  BALL_MULT: 0.93,
  ACCEL: 62,
  DECEL: 75,
  STAMINA_DRAIN: 0.2,
  STAMINA_REGEN: 0.11,
} as const;

export const SHOT = {
  /** Seconds for the meter to fill from 0 to 1. */
  METER_TIME: 0.62,
  /** Meter value of a perfect release. */
  PERFECT: 0.8,
  PERFECT_WINDOW: 0.055,
  GOOD_WINDOW: 0.14,
  /** Holding past this auto-releases (very late). */
  AUTO_RELEASE: 1.12,
  LAYUP_RANGE: 5.2,
  DUNK_RANGE: 6.2,
} as const;

export const RULES = {
  SHOT_CLOCK: 12,
  DEFAULT_GAME_TIME: 120,
  CHECK_TIME: 1.7,
  DEAD_TIME: 1.25,
} as const;

export type Difficulty = 'rookie' | 'pro' | 'allstar';

export interface DifficultyTuning {
  label: string;
  /** How quickly AI defenders react to the ball handler (higher is quicker). */
  defReact: number;
  /** On-ball cushion in feet. */
  defGap: number;
  /** AI steal attempts per second when in range. */
  stealRate: number;
  /** Chance an AI defender bothers to contest a shot. */
  contestChance: number;
  /** Std-dev of AI shot-meter release error. */
  aiReleaseError: number;
  /** Multiplier on AI defender top speed. */
  defSpeed: number;
  /** How willing the AI is to pass for a better shot (0..1). */
  aiIq: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyTuning> = {
  rookie: { label: 'Rookie', defReact: 3.2, defGap: 4.2, stealRate: 0.12, contestChance: 0.45, aiReleaseError: 0.17, defSpeed: 0.88, aiIq: 0.35 },
  pro: { label: 'Pro', defReact: 6, defGap: 3.2, stealRate: 0.3, contestChance: 0.75, aiReleaseError: 0.11, defSpeed: 0.97, aiIq: 0.7 },
  allstar: { label: 'All-Star', defReact: 9.5, defGap: 2.6, stealRate: 0.5, contestChance: 0.95, aiReleaseError: 0.075, defSpeed: 1.04, aiIq: 1 },
};
