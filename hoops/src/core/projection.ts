import { VIEW } from '../config';

/**
 * Broadcast-style angled camera. A pinhole projection gives true perspective
 * (the far baseline is narrower than half court); heights are additionally
 * foreshortened by Z_SCALE to mimic a camera tilted down toward the floor.
 *
 * Key property used by the court renderer: a world line of constant y maps to
 * a horizontal screen row, and x maps linearly along it.
 */

const FAR_W = 1080; // screen width of the 50 ft baseline
const NEAR_W = 1390; // screen width of the 50 ft half-court line
const BASE_Y = 262; // screen y of the baseline
const NEAR_Y = 1068; // screen y of the half-court line

const R = NEAR_W / FAR_W;
const D = 47 / (R - 1);
export const FOCAL = (FAR_W * (D + 47)) / 50;
const CAM_Y = D + 47;
const CAM_H = (NEAR_Y - BASE_Y) / (FOCAL * (1 / D - 1 / (D + 47)));
const HORIZON = BASE_Y - (FOCAL * CAM_H) / (D + 47);
const CX = VIEW.W / 2;
export const Z_SCALE = 0.66;

export interface Projected { x: number; y: number; k: number }

/** px per foot (horizontal) at depth y. */
export function scaleAt(y: number): number {
  return FOCAL / (CAM_Y - y);
}

export function project(x: number, y: number, z = 0, out: Projected = { x: 0, y: 0, k: 0 }): Projected {
  const d = CAM_Y - y;
  const k = FOCAL / d;
  out.x = CX + (x - 25) * k;
  out.y = HORIZON + (FOCAL * CAM_H) / d - z * k * Z_SCALE;
  out.k = k;
  return out;
}

export function screenYOfGround(y: number): number {
  return HORIZON + (FOCAL * CAM_H) / (CAM_Y - y);
}

/** Inverse of project() for points on the floor (z = 0). */
export function unproject(sx: number, sy: number): { x: number; y: number } {
  const d = (FOCAL * CAM_H) / Math.max(1, sy - HORIZON);
  const y = CAM_Y - d;
  const x = 25 + ((sx - CX) * d) / FOCAL;
  return { x, y };
}
