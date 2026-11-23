import { COURT, PHYS } from '../config';
import type { Player, Side } from './Player';

export type BallState = 'held' | 'shot' | 'pass' | 'loose' | 'dead';

export type ShotResult = 'swish' | 'rimIn' | 'rimOut' | 'boardOut' | 'airball' | 'dunk' | 'layupIn' | 'layupOut';

export interface ShotInfo {
  shooter: Player;
  result: ShotResult;
  points: 2 | 3;
  t: number;
  T: number;
  stage: 0 | 1; // 0 = initial flight, 1 = scripted second hop (rim-in)
  releasedBeforeBuzzer: boolean;
  blockChecked: Set<number>;
  quality: number;
}

export interface PassInfo {
  from: Player;
  to: Player;
  t: number;
  T: number;
  checked: Set<number>;
}

/** Events emitted from ball physics that the match turns into sounds / effects. */
export type BallContact = 'floor' | 'rim' | 'board' | null;

export class Ball {
  x = 25; y = 30; z = 3;
  vx = 0; vy = 0; vz = 0;
  state: BallState = 'held';
  owner: Player | null = null;
  lastTouch: Side = 0;
  shot: ShotInfo | null = null;
  pass: PassInfo | null = null;
  /** True after a rim/board contact until someone secures the ball. */
  touchedRim = false;
  /** Ball was shot and has not been secured: next pickup is a rebound. */
  reboundable = false;
  spin = 0;
  dribblePhase = 0;
  /** Time since last floor contact – used to throttle bounce sounds. */
  sinceBounce = 0;
  throughHoop = false;

  /** Ballistic velocity so the ball goes from current position to (tx,ty,tz) in T seconds. */
  aimAt(tx: number, ty: number, tz: number, T: number) {
    this.vx = (tx - this.x) / T;
    this.vy = (ty - this.y) / T;
    this.vz = (tz - this.z) / T + 0.5 * PHYS.G * T;
  }

  /** Flight time for an arc that peaks `apex` feet above the higher endpoint. */
  static flightTime(z0: number, z1: number, apex: number): number {
    const top = Math.max(z0, z1) + apex;
    const up = Math.sqrt((2 * (top - z0)) / PHYS.G);
    const down = Math.sqrt((2 * (top - z1)) / PHYS.G);
    return up + down;
  }

  integrate(dt: number) {
    this.vz -= PHYS.G * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.spin += Math.hypot(this.vx, this.vy) * dt * 0.9;
  }

  /** Free physics with floor, rim and backboard. Returns the strongest contact this step. */
  physics(dt: number): BallContact {
    let contact: BallContact = null;
    const steps = 3;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.integrate(h);
      const c = this.collide();
      if (c) contact = c;
    }
    this.sinceBounce += dt;
    return contact;
  }

  private collide(): BallContact {
    const R = PHYS.BALL_R;
    let contact: BallContact = null;
    // Floor
    if (this.z < R) {
      this.z = R;
      if (this.vz < 0) {
        const impact = -this.vz;
        this.vz = impact > 2 ? impact * PHYS.FLOOR_RESTITUTION : 0;
        this.vx *= 0.86;
        this.vy *= 0.86;
        if (impact > 3) contact = 'floor';
      }
      // rolling friction
      if (this.vz === 0) {
        this.vx *= 0.985;
        this.vy *= 0.985;
      }
    }

    // Backboard (vertical plane y = BOARD.y facing +y)
    const B = COURT.BOARD;
    if (this.x > B.x0 - R && this.x < B.x1 + R && this.z > B.z0 - R && this.z < B.z1 + R) {
      if (this.y - R < B.y && this.y > B.y - 0.6 && this.vy < 0) {
        this.y = B.y + R;
        this.vy = -this.vy * PHYS.BOARD_RESTITUTION;
        contact = 'board';
      }
    }

    // Rim: torus approximated by closest point on the rim circle.
    const H = COURT.HOOP;
    const dx = this.x - H.x;
    const dy = this.y - H.y;
    const dh = Math.hypot(dx, dy) || 0.0001;
    const cx = H.x + (dx / dh) * COURT.RIM_R;
    const cy = H.y + (dy / dh) * COURT.RIM_R;
    const nx = this.x - cx;
    const ny = this.y - cy;
    const nz = this.z - H.z;
    const nd = Math.hypot(nx, ny, nz);
    const rimTube = 0.05;
    if (nd < R + rimTube) {
      const ux = nx / nd; const uy = ny / nd; const uz = nz / nd;
      const vn = this.vx * ux + this.vy * uy + this.vz * uz;
      if (vn < 0) {
        this.vx -= (1 + PHYS.RIM_RESTITUTION) * vn * ux;
        this.vy -= (1 + PHYS.RIM_RESTITUTION) * vn * uy;
        this.vz -= (1 + PHYS.RIM_RESTITUTION) * vn * uz;
        // a little randomness keeps rebounds from being robotic
        this.vx += (Math.random() - 0.5) * 2.2;
        this.vy += (Math.random() - 0.5) * 2.2;
        contact = 'rim';
      }
      const push = R + rimTube - nd;
      this.x += ux * push; this.y += uy * push; this.z += uz * push;
    }

    // Net/stanchion: stop balls from flying through the support behind the board
    if (this.y < -2 && this.vy < 0) { this.vy = -this.vy * 0.4; this.y = -2; }
    return contact;
  }
}
