import { COURT, SHOT } from '../config';
import { clamp } from '../core/math';
import type { Player } from './Player';

export function isThree(x: number, y: number): boolean {
  if (y < COURT.CORNER_Y) return x < COURT.CORNER_X || x > COURT.W - COURT.CORNER_X;
  return Math.hypot(x - COURT.HOOP.x, y - COURT.HOOP.y) > COURT.THREE_R;
}

export function hoopDist(x: number, y: number): number {
  return Math.hypot(x - COURT.HOOP.x, y - COURT.HOOP.y);
}

export type ReleaseGrade = 'PERFECT' | 'GOOD' | 'SLIGHTLY EARLY' | 'SLIGHTLY LATE' | 'EARLY' | 'LATE' | 'VERY LATE';

/** Quality 0..1 of a release at meter value m. */
export function releaseQuality(m: number): { q: number; grade: ReleaseGrade } {
  const off = m - SHOT.PERFECT;
  const a = Math.abs(off);
  if (a <= SHOT.PERFECT_WINDOW) return { q: 1, grade: 'PERFECT' };
  if (a <= SHOT.GOOD_WINDOW) return { q: 0.82 - (a - SHOT.PERFECT_WINDOW) * 1.4, grade: 'GOOD' };
  const q = clamp(0.68 - (a - SHOT.GOOD_WINDOW) * 2.2, 0.05, 0.68);
  if (m >= SHOT.AUTO_RELEASE - 0.001) return { q: 0.05, grade: 'VERY LATE' };
  if (a <= 0.24) return { q, grade: off < 0 ? 'SLIGHTLY EARLY' : 'SLIGHTLY LATE' };
  return { q, grade: off < 0 ? 'EARLY' : 'LATE' };
}

/**
 * Contest level 0..1 from the closest defender: distance, whether they are
 * between shooter and hoop, and whether they are in the air.
 */
export function contestLevel(shooter: Player, defenders: Player[]): number {
  let best = 0;
  const hx = COURT.HOOP.x - shooter.x;
  const hy = COURT.HOOP.y - shooter.y;
  const hl = Math.hypot(hx, hy) || 1;
  for (const d of defenders) {
    const dx = d.x - shooter.x;
    const dy = d.y - shooter.y;
    const dd = Math.hypot(dx, dy);
    if (dd > 6) continue;
    const front = (dx * hx + dy * hy) / (dd * hl || 1); // 1 = squarely between
    let c = clamp((5.8 - dd) / 4.6, 0, 1);
    c *= front > 0.2 ? 1 : front > -0.3 ? 0.6 : 0.25;
    if (d.airborne || d.action === 'contest') c *= 1.25;
    c *= 0.75 + (d.r.defense + d.r.block) / 400 * 0.5;
    best = Math.max(best, c);
  }
  return clamp(best, 0, 1);
}

/** Base make probability given distance and the shooter's relevant rating. */
export function baseMakeChance(shooter: Player, x: number, y: number): number {
  const d = hoopDist(x, y);
  const three = isThree(x, y);
  let p: number;
  if (d < 4) p = 0.78;
  else if (d < 10) p = 0.6 - (d - 4) * 0.015;
  else if (d < 22) p = 0.51 - (d - 10) * 0.006;
  else if (d < 27) p = 0.42 - (d - 22) * 0.008;
  else p = Math.max(0.02, 0.38 - (d - 27) * 0.045);
  const rating = d < 6 ? shooter.r.finishing : three ? shooter.r.three : shooter.r.shooting;
  p *= 0.55 + (rating / 100) * 0.75;
  return p;
}

export interface ShotEval {
  p: number;
  contest: number;
  three: boolean;
  dist: number;
}

/** Full make probability for a jump shot. q = release quality (0..1). */
export function jumpShotChance(shooter: Player, defenders: Player[], q: number, moveSpeed: number): ShotEval {
  const three = isThree(shooter.x, shooter.y);
  const dist = hoopDist(shooter.x, shooter.y);
  const contest = contestLevel(shooter, defenders);
  let p = baseMakeChance(shooter, shooter.x, shooter.y);
  p *= 0.42 + 0.78 * q; // timing
  p *= 1 - 0.5 * contest;
  p *= 1 - clamp(moveSpeed / 26, 0, 0.25); // off-balance
  p *= 0.84 + 0.16 * Math.min(1, shooter.stamina * 1.6);
  // A perfect release on an open look from a reasonable distance is (nearly) automatic.
  if (q >= 1 && contest < 0.3 && dist < 28) p = Math.max(p, 0.9);
  return { p: clamp(p, 0.01, 0.97), contest, three, dist };
}

export function layupChance(shooter: Player, defenders: Player[], dunk: boolean): ShotEval {
  const contest = contestLevel(shooter, defenders);
  const dist = hoopDist(shooter.x, shooter.y);
  let p = dunk ? 0.9 + shooter.r.dunk / 1000 : 0.55 + shooter.r.finishing / 300;
  p *= 1 - (dunk ? 0.35 : 0.55) * contest;
  p *= 0.88 + 0.12 * Math.min(1, shooter.stamina * 1.6);
  return { p: clamp(p, 0.05, 0.98), contest, three: false, dist };
}

/** Rough expected value used by the AI to compare options (no timing randomness). */
export function expectedShotValue(shooter: Player, x: number, y: number, defenders: Player[]): number {
  const d = hoopDist(x, y);
  const pts = isThree(x, y) ? 3 : 2;
  const saveX = shooter.x; const saveY = shooter.y;
  shooter.x = x; shooter.y = y;
  const ev = d < SHOT.LAYUP_RANGE
    ? layupChance(shooter, defenders, false).p * 2
    : jumpShotChance(shooter, defenders, 0.85, 0).p * pts;
  shooter.x = saveX; shooter.y = saveY;
  return ev;
}
