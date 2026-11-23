import { MOVE, PHYS, COURT } from '../config';
import { angleDiff, clamp } from '../core/math';
import type { PlayerDef, TeamDef } from '../data/teams';

export type Side = 0 | 1;

export type Action =
  | 'none'
  | 'jumpshot' // charging / releasing a jump shot
  | 'layup'
  | 'dunk'
  | 'contest' // defensive jump
  | 'reach' // steal attempt
  | 'stumble' // beaten / failed steal
  | 'pass' // brief passing pose
  | 'celebrate';

export interface PlayerStats {
  pts: number; fgm: number; fga: number; tpm: number; tpa: number;
  reb: number; ast: number; stl: number; blk: number; tov: number;
}

export const emptyStats = (): PlayerStats => ({ pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 });

/** Scratch space for the AI. */
export interface AiMemory {
  decideT: number;
  tx: number; ty: number; // smoothed target
  spotIdx: number;
  spotT: number;
  cutT: number;
  plan: 'probe' | 'drive' | 'clear' | 'reset' | 'post';
  holdT: number;
  contestDelay: number;
  releaseAt: number;
  helpT: number;
}

export class Player {
  readonly id: number;
  readonly def: PlayerDef;
  readonly side: Side;
  readonly team: TeamDef;
  x = 25; y = 30;
  vx = 0; vy = 0;
  z = 0; vz = 0;
  facing = -Math.PI / 2;
  stamina = 1;

  action: Action = 'none';
  actionT = 0;
  /** Jump-shot meter 0..~1.1 */
  charge = 0;
  charging = false;
  released = false;
  shotTarget: { x: number; y: number } | null = null;

  /** Desired movement this frame (unit-ish vector) and sprint flag. */
  mx = 0; my = 0; sprint = false;
  /** Optional point to face instead of the movement direction. */
  faceTarget: { x: number; y: number } | null = null;

  animPhase = Math.random() * 10;
  stealCd = 0;
  touchLock = 0; // cannot pick up the ball while > 0
  catchTime = 0; // match time when last caught a pass
  lastPasser: Player | null = null;

  isUser = false;
  stats: PlayerStats = emptyStats();
  ai: AiMemory = { decideT: 0, tx: 25, ty: 25, spotIdx: -1, spotT: 0, cutT: 0, plan: 'probe', holdT: 0, contestDelay: 0, releaseAt: 0.8, helpT: 0 };

  constructor(id: number, def: PlayerDef, side: Side, team: TeamDef) {
    this.id = id;
    this.def = def;
    this.side = side;
    this.team = team;
  }

  get r() { return this.def.ratings; }

  get airborne(): boolean { return this.z > 0.05 || this.vz > 0; }

  /** Busy players ignore movement input. */
  get locked(): boolean {
    return this.action === 'jumpshot' || this.action === 'layup' || this.action === 'dunk' || this.action === 'contest' || this.action === 'stumble';
  }

  maxSpeed(hasBall: boolean, speedMult = 1): number {
    let s = MOVE.BASE_SPEED * (0.78 + this.r.speed / 360) * speedMult;
    if (hasBall) s *= MOVE.BALL_MULT;
    if (this.sprint && this.stamina > 0.05) s *= MOVE.SPRINT_MULT;
    s *= 0.82 + 0.18 * Math.min(1, this.stamina * 2.5);
    return s;
  }

  jumpHeight(): number {
    return 2.2 + (this.r.dunk + this.r.block) / 200 * 1.6;
  }

  setAction(a: Action) {
    this.action = a;
    this.actionT = 0;
  }

  startJump(heightMult = 1) {
    if (this.airborne) return;
    const h = this.jumpHeight() * heightMult;
    this.vz = Math.sqrt(2 * 44 * h);
  }

  update(dt: number, hasBall: boolean, speedMult = 1) {
    this.actionT += dt;
    this.stealCd = Math.max(0, this.stealCd - dt);
    this.touchLock = Math.max(0, this.touchLock - dt);

    // Vertical motion
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 44 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; }
    }

    // Horizontal motion
    let tvx = 0;
    let tvy = 0;
    const len = Math.hypot(this.mx, this.my);
    const canMove = !this.locked && this.action !== 'celebrate';
    if (canMove && len > 0.05) {
      const ms = this.maxSpeed(hasBall, speedMult);
      const n = Math.min(1, len);
      tvx = (this.mx / len) * ms * n;
      tvy = (this.my / len) * ms * n;
    }
    const airborne = this.airborne;
    const scripted = this.action === 'layup' || this.action === 'dunk';
    if (!scripted) {
      const accel = airborne ? 3 : (len > 0.05 && canMove ? MOVE.ACCEL : MOVE.DECEL);
      const dvx = tvx - this.vx;
      const dvy = tvy - this.vy;
      const dv = Math.hypot(dvx, dvy);
      const step = Math.min(dv, accel * dt);
      if (dv > 0) { this.vx += (dvx / dv) * step; this.vy += (dvy / dv) * step; }
    }
    if (this.action === 'stumble') { this.vx *= Math.pow(0.02, dt); this.vy *= Math.pow(0.02, dt); }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Stay on the half court (with a little out-of-bounds slack).
    this.x = clamp(this.x, -1.5, COURT.W + 1.5);
    this.y = clamp(this.y, -1, COURT.L - 0.6);

    // Stamina
    const speed = Math.hypot(this.vx, this.vy);
    const drain = this.sprint && speed > 4 ? MOVE.STAMINA_DRAIN * (1.25 - this.r.stamina / 200) : 0;
    this.stamina = clamp(this.stamina - drain * dt + (drain ? 0 : MOVE.STAMINA_REGEN * dt * (speed < 6 ? 1.4 : 0.8)), 0, 1);

    // Facing
    let desired: number | null = null;
    if (this.faceTarget) desired = Math.atan2(this.faceTarget.y - this.y, this.faceTarget.x - this.x);
    else if (speed > 1.5) desired = Math.atan2(this.vy, this.vx);
    if (desired !== null) {
      const d = angleDiff(this.facing, desired);
      const rate = this.locked ? 6 : 14;
      this.facing += clamp(d, -rate * dt, rate * dt);
    }

    // Run cycle advances with speed
    this.animPhase += dt * (2 + speed * 0.75);

    if (this.action === 'reach' && this.actionT > 0.32) this.setAction('none');
    if (this.action === 'pass' && this.actionT > 0.25) this.setAction('none');
    if (this.action === 'stumble' && this.actionT > 0.45) this.setAction('none');
    if (this.action === 'contest' && this.actionT > 0.2 && this.z <= 0) this.setAction('none');
  }

  get speed(): number { return Math.hypot(this.vx, this.vy); }

  distTo(o: { x: number; y: number }): number { return Math.hypot(this.x - o.x, this.y - o.y); }

  distToHoop(): number { return Math.hypot(this.x - COURT.HOOP.x, this.y - COURT.HOOP.y); }

  static readonly RADIUS = PHYS.PLAYER_R;
}
