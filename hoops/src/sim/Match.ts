import { CHAR_VIS, COURT, DIFFICULTY, PHYS, RULES, SHOT, type Difficulty, type DifficultyTuning } from '../config';
import { Emitter } from '../core/Emitter';
import { chance, clamp, rand } from '../core/math';
import type { TeamDef } from '../data/teams';
import { Ball, type ShotResult } from './Ball';
import { Player, type Side } from './Player';
import { hoopDist, isThree, jumpShotChance, layupChance, releaseQuality, type ReleaseGrade } from './shooting';
import { runAI } from '../ai/brain';

export interface MatchConfig {
  teams: [TeamDef, TeamDef];
  userSide: Side | null;
  starIndex: number;
  difficulty: Difficulty;
  gameTime: number;
}

export interface InputState {
  mx: number;
  my: number;
  sprint: boolean;
  shootHeld: boolean;
  shootPressed: boolean;
  shootReleased: boolean;
  passPressed: boolean;
  switchPressed: boolean;
  aim: { x: number; y: number } | null;
}

export const NO_INPUT: InputState = {
  mx: 0, my: 0, sprint: false, shootHeld: false, shootPressed: false, shootReleased: false,
  passPressed: false, switchPressed: false, aim: null,
};

export type Phase = 'intro' | 'check' | 'live' | 'dead' | 'over';

export interface MatchEvents extends Record<string, unknown> {
  release: { p: Player; grade: ReleaseGrade | null; q: number; three: boolean; chance: number };
  score: { side: Side; pts: number; p: Player | null; kind: ShotResult | 'putback'; assist: Player | null };
  miss: { p: Player };
  rim: { strength: number };
  board: { strength: number };
  bounce: { strength: number; x: number; y: number };
  dribble: { x: number; y: number };
  steal: { p: Player; from: Player | null; intercept: boolean };
  block: { p: Player; shooter: Player };
  pass: { from: Player; to: Player };
  catch: { p: Player };
  turnover: { side: Side; reason: string };
  whistle: null;
  buzzer: null;
  banner: { text: string; sub?: string; tone?: 'home' | 'away' | 'neutral' | 'warn' };
  possession: { side: Side };
  shake: { amount: number; ms: number };
  net: { strength: number };
  dunk: { p: Player };
  jump: { p: Player };
  squeak: { p: Player };
  gameover: null;
  rebound: { p: Player; offensive: boolean };
}

const OFF_SPOTS = [
  { x: 25, y: 31 },
  { x: 8.5, y: 19 },
  { x: 41.5, y: 19 },
];

export class Match {
  readonly ev = new Emitter<MatchEvents>();
  readonly cfg: MatchConfig;
  readonly tune: DifficultyTuning;
  readonly players: Player[] = [];
  readonly ball = new Ball();

  time = 0;
  phase: Phase = 'intro';
  phaseT = 0;
  gameClock: number;
  shotClock: number = RULES.SHOT_CLOCK;
  score: [number, number] = [0, 0];
  offense: Side = 0;
  nextOffense: Side = 1;
  needsClear = false;
  overtime = false;
  buzzerPending = false;
  ended = false;
  /** Who each defender is guarding, keyed by defender id. */
  assign = new Map<number, Player>();
  /** Formation targets during check / dead ball. */
  formation = new Map<number, { x: number; y: number; face: { x: number; y: number } | null }>();
  user: Player | null = null;
  /** Small seconds-long multiplier for slow-motion moments. */
  timeScale = 1;
  slowmoT = 0;
  private prevSprint = new Map<number, boolean>();

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.tune = DIFFICULTY[cfg.difficulty];
    this.gameClock = cfg.gameTime;
    let id = 0;
    for (const side of [0, 1] as Side[]) {
      for (const def of cfg.teams[side].players) this.players.push(new Player(id++, def, side, cfg.teams[side]));
    }
    // User's team starts with the ball (or a coin flip in demo mode).
    const first: Side = cfg.userSide ?? (chance(0.5) ? 0 : 1);
    this.setupCheck(first, true);
    this.phase = 'intro';
  }

  team(side: Side): Player[] { return this.players.filter((p) => p.side === side); }
  opponents(p: Player): Player[] { return this.players.filter((o) => o.side !== p.side); }
  teammates(p: Player): Player[] { return this.players.filter((o) => o.side === p.side && o !== p); }
  get handler(): Player | null { return this.ball.state === 'held' ? this.ball.owner : null; }
  get defense(): Side { return (1 - this.offense) as Side; }
  isUserControlled(p: Player): boolean { return this.user === p; }

  // ------------------------------------------------------------------ setup

  private setupCheck(side: Side, intro = false) {
    this.phase = intro ? 'intro' : 'check';
    this.phaseT = 0;
    this.offense = side;
    this.needsClear = false;
    this.shotClock = RULES.SHOT_CLOCK;
    const off = this.team(side);
    const def = this.team((1 - side) as Side);

    // Ball handler: the user's star if it is their ball, else the best handler.
    let handler: Player;
    if (this.cfg.userSide === side) handler = off[this.cfg.starIndex] ?? off[0];
    else handler = [...off].sort((a, b) => b.r.handling + b.r.passing - (a.r.handling + a.r.passing))[0];
    const others = off.filter((p) => p !== handler);
    const order = [handler, ...others];

    this.assign.clear();
    this.formation.clear();
    order.forEach((p, i) => {
      const s = OFF_SPOTS[i];
      this.formation.set(p.id, { x: s.x, y: s.y, face: { x: COURT.HOOP.x, y: COURT.HOOP.y } });
    });
    // Defenders mirror roster slots (guard on guard, big on big) where possible.
    const offByRoster = [...off];
    def.forEach((d, i) => {
      const man = offByRoster[i];
      this.assign.set(d.id, man);
      const ms = this.formation.get(man.id)!;
      const tx = ms.x + (COURT.HOOP.x - ms.x) * 0.16;
      const ty = ms.y + (COURT.HOOP.y - ms.y) * 0.16;
      this.formation.set(d.id, { x: tx, y: ty, face: { x: ms.x, y: ms.y } });
    });

    this.giveBallRaw(handler);
    this.ball.reboundable = false;
    this.ball.touchedRim = false;
    this.ball.shot = null;
    this.ball.pass = null;

    if (intro) {
      for (const p of this.players) {
        const f = this.formation.get(p.id)!;
        p.x = f.x; p.y = f.y + 6; p.vx = 0; p.vy = 0; p.z = 0; p.vz = 0;
        p.facing = -Math.PI / 2;
      }
    }

    // User control
    if (this.cfg.userSide !== null) {
      if (this.cfg.userSide === side) this.setUser(handler);
      else {
        const guard = def.find((d) => this.assign.get(d.id) === handler) ?? def[0];
        this.setUser(guard);
      }
    }
    for (const p of this.players) { p.setAction('none'); p.charging = false; p.released = false; }
  }

  private setUser(p: Player | null) {
    if (this.user) this.user.isUser = false;
    this.user = p;
    if (p) p.isUser = true;
  }

  // ------------------------------------------------------------------ main loop

  update(rawDt: number, input: InputState) {
    if (this.slowmoT > 0) {
      this.slowmoT -= rawDt;
      this.timeScale = this.slowmoT > 0 ? 0.45 : 1;
    }
    const dt = Math.min(rawDt, 1 / 30) * this.timeScale;
    this.time += dt;
    this.phaseT += dt;

    switch (this.phase) {
      case 'intro':
      case 'check':
        this.formationStep();
        if (this.phaseT > (this.phase === 'intro' ? 2.6 : RULES.CHECK_TIME)) this.goLive();
        break;
      case 'live':
        this.liveStep(dt, input);
        break;
      case 'dead':
        this.formationStep();
        if (this.phaseT > RULES.DEAD_TIME) {
          if (this.ended) { this.finish(); break; }
          this.setupCheck(this.nextOffense);
        }
        break;
      case 'over':
        for (const p of this.players) { p.mx = 0; p.my = 0; p.sprint = false; }
        break;
    }

    // Physics for everyone
    for (const p of this.players) {
      if (p.sprint && !this.prevSprint.get(p.id) && p.speed > 6) this.ev.emit('squeak', { p });
      this.prevSprint.set(p.id, p.sprint);
      const speedMult = p.side === this.defense && !p.isUser && this.cfg.userSide !== null ? this.tune.defSpeed : 1;
      p.update(dt, this.ball.owner === p && this.ball.state === 'held', speedMult);
    }
    this.separatePlayers();
    if (this.phase === 'live') this.updateActions(dt);
    this.updateBall(dt);
  }

  private goLive() {
    this.phase = 'live';
    this.phaseT = 0;
    this.formation.clear();
    this.ev.emit('banner', { text: this.overtime ? 'NEXT BUCKET WINS' : 'CHECK', tone: 'neutral' });
    this.ev.emit('whistle', null);
  }

  private formationStep() {
    for (const p of this.players) {
      const f = this.formation.get(p.id);
      p.sprint = false;
      if (!f) { p.mx = 0; p.my = 0; continue; }
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.35) { p.mx = 0; p.my = 0; }
      else { const s = Math.min(1, d / 3) * 0.85; p.mx = (dx / d) * s; p.my = (dy / d) * s; }
      p.sprint = d > 14;
      p.faceTarget = d < 3 ? f.face : null;
    }
  }

  private liveStep(dt: number, input: InputState) {
    // Clocks
    const ballLive = this.ball.state !== 'dead';
    if (!this.overtime && this.gameClock > 0) {
      this.gameClock = Math.max(0, this.gameClock - dt);
      if (this.gameClock === 0) this.onBuzzer();
    }
    const shotClockRuns = ballLive && !(this.ball.state === 'loose' && this.ball.touchedRim) && this.ball.state !== 'shot';
    if (shotClockRuns && this.phase === 'live') {
      this.shotClock = Math.max(0, this.shotClock - dt);
      if (this.shotClock === 0) {
        this.turnover(this.offense, 'SHOT CLOCK');
        return;
      }
    }
    if (this.phase !== 'live') return;
    if (this.buzzerPending && this.ball.state !== 'shot') { this.resolveBuzzer(); return; }

    // Clearing rule
    const h = this.handler;
    if (this.needsClear && h && h.side === this.offense && isThree(h.x, h.y)) {
      this.needsClear = false;
      if (h.side === this.cfg.userSide) this.ev.emit('banner', { text: 'CLEARED', tone: 'neutral' });
    }

    // Input / AI (switching happens once, before anyone acts)
    if (input.switchPressed) this.switchUser();
    for (const p of this.players) {
      p.faceTarget = null;
      if (p === this.user) this.applyUserInput(p, input, dt);
      else runAI(this, p, dt);
    }
  }

  // ------------------------------------------------------------------ user input

  private applyUserInput(p: Player, input: InputState, _dt: number) {
    p.mx = input.mx;
    p.my = input.my;
    p.sprint = input.sprint;
    const hasBall = this.ball.owner === p && this.ball.state === 'held';

    if (hasBall) {
      if (input.shootPressed) this.beginShot(p);
      if (p.charging && (input.shootReleased || !input.shootHeld) && p.actionT > 0.04) this.releaseJumper(p);
      if (input.passPressed && !p.locked) {
        const target = this.choosePassTarget(p, input);
        if (target) this.passBall(p, target);
      }
      // Face the hoop when standing still with the ball
      if (Math.hypot(input.mx, input.my) < 0.1) p.faceTarget = { x: COURT.HOOP.x, y: COURT.HOOP.y };
    } else if (p.side !== this.offense || this.ball.state === 'loose' || this.ball.state === 'shot') {
      if (input.shootPressed) this.contestJump(p);
      if (input.passPressed && p.side !== this.offense) this.attemptSteal(p);
      // face the ball while defending
      if (p.side !== this.offense && Math.hypot(input.mx, input.my) < 0.1) p.faceTarget = { x: this.ball.x, y: this.ball.y };
    } else {
      // Offense without the ball: E calls for the pass
      if (input.passPressed) {
        const h = this.handler;
        if (h && h.side === p.side && !h.locked) this.passBall(h, p);
      }
      if (input.shootPressed && this.ball.state === 'pass') this.contestJump(p);
    }
  }

  switchUser() {
    const cur = this.user;
    if (!cur || this.cfg.userSide === null) return;
    const mine = this.team(cur.side);
    if (cur.side === this.offense && this.ball.owner === cur && this.ball.state === 'held') return;
    const ref = { x: this.ball.x, y: this.ball.y };
    const sorted = mine.filter((m) => m !== cur).sort((a, b) => a.distTo(ref) - b.distTo(ref));
    if (sorted[0]) {
      cur.charging = false;
      this.setUser(sorted[0]);
    }
  }

  choosePassTarget(p: Player, input: InputState): Player | null {
    const mates = this.teammates(p);
    let dir: { x: number; y: number } | null = null;
    if (Math.hypot(input.mx, input.my) > 0.3) dir = { x: input.mx, y: input.my };
    else if (input.aim) dir = { x: input.aim.x - p.x, y: input.aim.y - p.y };
    if (dir) {
      const dl = Math.hypot(dir.x, dir.y) || 1;
      let best: Player | null = null;
      let bestScore = -Infinity;
      for (const m of mates) {
        const mx = m.x - p.x; const my = m.y - p.y;
        const ml = Math.hypot(mx, my) || 1;
        const cos = (mx * dir.x + my * dir.y) / (ml * dl);
        const score = cos * 2 - ml / 60;
        if (cos > -0.2 && score > bestScore) { bestScore = score; best = m; }
      }
      if (best) return best;
    }
    // fallback: most open
    return this.mostOpen(mates);
  }

  mostOpen(list: Player[]): Player | null {
    let best: Player | null = null;
    let bestD = -1;
    for (const m of list) {
      const d = this.nearestOpponentDist(m);
      if (d > bestD) { bestD = d; best = m; }
    }
    return best;
  }

  nearestOpponentDist(p: Player): number {
    let best = 99;
    for (const o of this.players) if (o.side !== p.side) best = Math.min(best, p.distTo(o));
    return best;
  }

  // ------------------------------------------------------------------ actions

  beginShot(p: Player): boolean {
    if (this.ball.owner !== p || this.ball.state !== 'held' || p.locked || p.airborne) return false;
    const d = p.distToHoop();
    const canDunk = p.r.dunk >= 55 && p.stamina > 0.12 && (d < 3.6 || (d < SHOT.DUNK_RANGE && p.sprint && p.speed > 9));
    if (d < SHOT.LAYUP_RANGE || canDunk) {
      p.setAction(canDunk ? 'dunk' : 'layup');
      const tgt = this.attackPoint(p);
      p.shotTarget = tgt;
      // travel to the attack point over the gather + rise
      const T = canDunk ? 0.5 : 0.46;
      p.vx = (tgt.x - p.x) / T;
      p.vy = (tgt.y - p.y) / T;
      p.faceTarget = { x: COURT.HOOP.x, y: COURT.HOOP.y };
      p.facing = Math.atan2(COURT.HOOP.y - p.y, COURT.HOOP.x - p.x);
      p.released = false;
      p.stats.fga++;
      return true;
    }
    p.setAction('jumpshot');
    p.charging = true;
    p.released = false;
    p.charge = 0;
    p.facing = Math.atan2(COURT.HOOP.y - p.y, COURT.HOOP.x - p.x);
    p.ai.releaseAt = SHOT.PERFECT;
    return true;
  }

  /** Point just in front of the rim on the shooter's side. */
  private attackPoint(p: Player): { x: number; y: number } {
    const dx = p.x - COURT.HOOP.x;
    const dy = Math.max(0.6, p.y - COURT.HOOP.y);
    const l = Math.hypot(dx, dy) || 1;
    return { x: COURT.HOOP.x + (dx / l) * 1.7, y: COURT.HOOP.y + (dy / l) * 1.7 };
  }

  releaseJumper(p: Player) {
    if (!p.charging || this.ball.owner !== p) return;
    p.charging = false;
    p.released = true;
    const { q, grade } = releaseQuality(p.charge);
    const evals = jumpShotChance(p, this.opponents(p), q, Math.hypot(p.vx, p.vy));
    p.stats.fga++;
    if (evals.three) p.stats.tpa++;
    const make = Math.random() < evals.p;
    let result: ShotResult;
    if (make) result = q >= 0.95 && evals.contest < 0.5 ? 'swish' : chance(0.55) ? 'swish' : 'rimIn';
    else if (q < 0.15 && evals.dist > 12 && chance(0.6)) result = 'airball';
    else result = chance(0.25) && evals.dist > 6 ? 'boardOut' : 'rimOut';
    this.ev.emit('release', { p, grade, q, three: evals.three, chance: evals.p });
    this.launchShot(p, result, evals.three ? 3 : 2, q);
  }

  private launchShot(p: Player, result: ShotResult, points: 2 | 3, quality: number) {
    const b = this.ball;
    const H = COURT.HOOP;
    b.state = 'shot';
    b.owner = null;
    b.lastTouch = p.side;
    b.x = p.x + Math.cos(p.facing) * 0.5;
    b.y = p.y + Math.sin(p.facing) * 0.5;
    b.z = p.z + p.def.height * 1.12 * CHAR_VIS;
    b.reboundable = true;
    b.touchedRim = false;
    b.throughHoop = false;
    p.touchLock = 0.3;
    const dist = hoopDist(b.x, b.y);
    const apex = 2.6 + dist * 0.12;
    let tx = H.x; let ty = H.y; let tz = H.z + 0.05;
    const ang = Math.atan2(b.y - H.y, b.x - H.x);
    switch (result) {
      case 'rimIn': {
        const a = ang + rand(-0.5, 0.5);
        tx = H.x + Math.cos(a) * COURT.RIM_R * 0.9; ty = H.y + Math.sin(a) * COURT.RIM_R * 0.9; tz = H.z + 0.42;
        break;
      }
      case 'rimOut':
      case 'layupOut': {
        const a = ang + rand(-1.3, 1.3) + (chance(0.4) ? Math.PI : 0);
        const r = COURT.RIM_R + 0.18;
        tx = H.x + Math.cos(a) * r; ty = H.y + Math.sin(a) * r; tz = H.z + 0.3;
        break;
      }
      case 'boardOut':
        tx = H.x + rand(-1.4, 1.4); ty = COURT.BOARD.y + PHYS.BALL_R + 0.02; tz = H.z + rand(1.2, 2.4);
        break;
      case 'airball': {
        const short = rand(2.5, 4.5);
        tx = H.x + Math.cos(ang) * short + rand(-1.5, 1.5); ty = H.y + Math.sin(ang) * short; tz = 8.6;
        break;
      }
      default:
        break;
    }
    const T = result === 'layupIn' || result === 'layupOut'
      ? Ball.flightTime(b.z, tz, 1.2)
      : Ball.flightTime(b.z, tz, apex);
    b.aimAt(tx, ty, tz, T);
    b.shot = {
      shooter: p, result, points, t: 0, T, stage: 0,
      releasedBeforeBuzzer: this.gameClock > 0 || this.overtime,
      blockChecked: new Set(), quality,
    };
    this.shotIllegal = this.needsClear && p.side === this.offense;
  }

  private shotIllegal = false;

  passBall(from: Player, to: Player) {
    const b = this.ball;
    if (b.owner !== from || b.state !== 'held') return;
    const dist = from.distTo(to);
    let T = Ball.flightTime(4, 4, 0.5 + dist * 0.018);
    const passSkill = 0.9 + from.r.passing / 500;
    T /= passSkill;
    // lead the receiver
    const lx = to.x + to.vx * T * 0.8;
    const ly = to.y + to.vy * T * 0.8;
    b.state = 'pass';
    b.owner = null;
    b.lastTouch = from.side;
    b.x = from.x + Math.cos(from.facing) * 0.8;
    b.y = from.y + Math.sin(from.facing) * 0.8;
    b.z = 4.2;
    b.aimAt(lx, ly, 4.0, T);
    b.pass = { from, to, t: 0, T, checked: new Set() };
    from.setAction('pass');
    from.facing = Math.atan2(ly - from.y, lx - from.x);
    from.touchLock = 0.35;
    to.lastPasser = from;
    this.ev.emit('pass', { from, to });
  }

  attemptSteal(d: Player) {
    if (d.stealCd > 0 || d.locked || d.airborne) return;
    d.setAction('reach');
    d.stealCd = 0.85;
    const h = this.handler;
    const b = this.ball;
    if (!h || h.side === d.side) return;
    const reach = Math.hypot(b.x - d.x, b.y - d.y);
    const handDist = d.distTo(h);
    if (reach > 3.1 || handDist > 4.2) {
      return; // whiff
    }
    let p = 0.26 + (d.r.steal - h.r.handling) / 170 + (3.1 - reach) * 0.06;
    if (h.action === 'jumpshot' || h.action === 'layup') p *= 0.4;
    if (!d.isUser && this.cfg.userSide !== null && d.side !== this.cfg.userSide) p *= 0.85;
    p = clamp(p, 0.06, 0.7);
    if (Math.random() < p) {
      h.touchLock = 0.6;
      h.charging = false;
      if (h.locked) h.setAction('none');
      if (chance(0.55)) {
        // Clean pick-pocket
        d.stats.stl++;
        h.stats.tov++;
        this.ev.emit('steal', { p: d, from: h, intercept: false });
        this.giveBall(d);
        return;
      }
      // Poke it loose so it skids out in front of the defender
      b.state = 'loose';
      b.owner = null;
      b.lastTouch = d.side;
      const ax = d.x - h.x; const ay = d.y - h.y; const al = Math.hypot(ax, ay) || 1;
      b.x = (b.x + d.x) / 2; b.y = (b.y + d.y) / 2; b.z = Math.min(b.z, 2.5);
      b.vx = (ax / al) * rand(3, 6) + rand(-2, 2);
      b.vy = (ay / al) * rand(3, 6) + rand(-2, 2);
      b.vz = rand(1, 3);
      b.reboundable = false;
      this.pendingSteal = { d, h };
    } else if (chance(0.5)) {
      d.setAction('stumble');
    }
  }

  /** A poked-loose ball only counts as a steal if the defense recovers it. */
  private pendingSteal: { d: Player; h: Player } | null = null;

  contestJump(p: Player) {
    if (p.airborne || p.locked) return;
    p.setAction('contest');
    p.startJump(1);
    this.ev.emit('jump', { p });
  }

  private updateActions(dt: number) {
    for (const p of this.players) {
      if (p.action === 'jumpshot') {
        if (p.charging) {
          // meter speed depends a little on the shooter
          const rate = 1 / (SHOT.METER_TIME * (1.08 - p.r.shooting / 900));
          p.charge += dt * rate;
          if (p.actionT > 0.07 && !p.airborne && p.z === 0 && p.vz === 0) {
            p.vz = 12.5 + p.def.height * 0.3;
            this.ev.emit('jump', { p });
          }
          if (p.charge >= SHOT.AUTO_RELEASE) this.releaseJumper(p);
        } else if (p.released && p.z <= 0 && p.actionT > 0.2) {
          p.setAction('none');
          p.released = false;
        }
      } else if (p.action === 'layup' || p.action === 'dunk') {
        const isDunk = p.action === 'dunk';
        if (p.actionT > 0.1 && !p.airborne && !p.released && p.vz === 0) {
          p.vz = isDunk ? 17.5 + p.r.dunk / 25 : 14;
          this.ev.emit('jump', { p });
        }
        const releaseT = isDunk ? 0.5 : 0.42;
        if (!p.released && p.actionT >= releaseT) {
          p.released = true;
          p.vx *= 0.25; p.vy *= 0.25;
          if (this.ball.owner === p) this.finishAtRim(p, isDunk);
        }
        if (p.released && p.z <= 0 && p.actionT > releaseT + 0.1) {
          p.setAction('none');
          p.released = false;
          p.vx = 0; p.vy = 0;
        }
      }
    }
  }

  private finishAtRim(p: Player, dunk: boolean) {
    const defs = this.opponents(p);
    const ev = layupChance(p, defs, dunk);
    // Rim protection: an airborne defender near the rim can reject it outright.
    for (const d of defs) {
      if (!d.airborne) continue;
      const near = Math.hypot(d.x - p.x, d.y - p.y);
      if (near < 2.8 && Math.random() < (dunk ? 0.04 : 0.1) + d.r.block / 600) {
        this.ev.emit('release', { p, grade: null, q: 0.5, three: false, chance: ev.p });
        this.ball.state = 'shot';
        this.ball.owner = null;
        this.ball.lastTouch = p.side;
        this.ball.reboundable = true;
        this.doBlock(d, p);
        return;
      }
    }
    const make = Math.random() < ev.p;
    this.ev.emit('release', { p, grade: null, q: 0.8, three: false, chance: ev.p });
    if (dunk && make) {
      const b = this.ball;
      b.state = 'loose';
      b.owner = null;
      b.lastTouch = p.side;
      b.x = COURT.HOOP.x; b.y = COURT.HOOP.y; b.z = COURT.HOOP.z - 0.2;
      b.vx = 0; b.vy = 0; b.vz = -18;
      b.reboundable = false;
      b.throughHoop = true;
      p.vz = Math.max(p.vz, 1.5);
      this.ev.emit('dunk', { p });
      this.ev.emit('shake', { amount: 0.012, ms: 260 });
      this.ev.emit('net', { strength: 1.6 });
      this.ev.emit('rim', { strength: 1.4 });
      this.scoreBasket(p.side, 2, p, 'dunk');
      return;
    }
    if (dunk && !make) {
      // Rattles off the back of the rim
      const b = this.ball;
      b.state = 'loose';
      b.owner = null;
      b.lastTouch = p.side;
      b.x = COURT.HOOP.x; b.y = COURT.HOOP.y + 0.3; b.z = COURT.HOOP.z + 0.6;
      b.vx = rand(-6, 6); b.vy = rand(5, 10); b.vz = rand(8, 12);
      b.reboundable = true;
      b.touchedRim = true;
      this.ev.emit('rim', { strength: 1.2 });
      this.ev.emit('miss', { p });
      return;
    }
    this.launchShot(p, make ? 'layupIn' : 'layupOut', 2, 0.8);
  }

  private doBlock(d: Player, shooter: Player) {
    const b = this.ball;
    b.state = 'loose';
    b.owner = null;
    const ax = b.x - COURT.HOOP.x; const ay = b.y - COURT.HOOP.y; const al = Math.hypot(ax, ay) || 1;
    b.vx = (ax / al) * rand(6, 11) + rand(-3, 3);
    b.vy = (ay / al) * rand(6, 11) + rand(-1, 3);
    b.vz = rand(-5, 4);
    b.lastTouch = d.side;
    b.shot = null;
    b.reboundable = true;
    d.stats.blk++;
    this.ev.emit('block', { p: d, shooter });
    this.ev.emit('shake', { amount: 0.009, ms: 220 });
  }

  // ------------------------------------------------------------------ ball

  private updateBall(dt: number) {
    const b = this.ball;
    switch (b.state) {
      case 'held': this.updateHeldBall(dt); break;
      case 'shot': this.updateShot(dt); break;
      case 'pass': this.updatePass(dt); break;
      case 'loose': this.updateLoose(dt); break;
      case 'dead': break;
    }
  }

  private updateHeldBall(dt: number) {
    const b = this.ball;
    const p = b.owner;
    if (!p) { b.state = 'loose'; return; }
    const fx = Math.cos(p.facing); const fy = Math.sin(p.facing);
    const rx = -fy; const ry = fx;
    const shooting = p.action === 'jumpshot' || p.action === 'layup' || p.action === 'dunk';
    if (shooting) {
      const lift = p.action === 'jumpshot' ? 6.6 + Math.min(1, p.charge) * 0.7 : p.action === 'dunk' ? 7.6 : 7.0;
      b.x = p.x + fx * 0.55;
      b.y = p.y + fy * 0.55;
      b.z = p.z + lift * (p.def.height / 6.6) * CHAR_VIS;
      b.vx = p.vx; b.vy = p.vy; b.vz = 0;
      return;
    }
    if (this.phase !== 'live' || p.action === 'pass') {
      // holding at the chest during check
      b.x = p.x + fx * 0.8; b.y = p.y + fy * 0.8; b.z = 4.1;
      return;
    }
    // Dribble: bounce period shortens when running
    const speed = p.speed;
    const prev = b.dribblePhase;
    b.dribblePhase += dt * (3.6 + speed * 0.16) * Math.PI;
    const side = 0.95;
    const fwd = 0.55 + Math.min(1, speed / 14) * 0.7;
    b.x = p.x + fx * fwd + rx * side + p.vx * 0.03;
    b.y = p.y + fy * fwd + ry * side + p.vy * 0.03;
    b.z = PHYS.BALL_R + Math.abs(Math.cos(b.dribblePhase)) * 2.7;
    b.vx = p.vx; b.vy = p.vy;
    b.spin += dt * 4;
    if (Math.floor(prev / Math.PI - 0.5) !== Math.floor(b.dribblePhase / Math.PI - 0.5)) {
      this.ev.emit('dribble', { x: b.x, y: b.y });
    }
  }

  private updateShot(dt: number) {
    const b = this.ball;
    const s = b.shot;
    if (!s) { b.state = 'loose'; return; }
    s.t += dt;
    b.integrate(dt);

    // Blocks in the first part of the flight
    if (s.stage === 0 && s.t < 0.38) {
      for (const d of this.opponents(s.shooter)) {
        if (!d.airborne || s.blockChecked.has(d.id)) continue;
        const handZ = d.z + d.def.height * 1.3;
        const dd = Math.hypot(d.x - b.x, d.y - b.y, (handZ - b.z) * 0.8);
        if (dd < 1.35) {
          s.blockChecked.add(d.id);
          // Must be in front of the shooter (between them and the rim)
          const sh = s.shooter;
          const front = (d.x - sh.x) * (COURT.HOOP.x - sh.x) + (d.y - sh.y) * (COURT.HOOP.y - sh.y) > 0;
          if (front && Math.random() < 0.08 + d.r.block / 500) { this.doBlock(d, s.shooter); return; }
        }
      }
    }

    if (s.t < s.T) return;

    const H = COURT.HOOP;
    switch (s.result) {
      case 'swish':
      case 'layupIn':
        this.makeThrough(s.shooter, s.points, s.result);
        return;
      case 'rimIn':
        if (s.stage === 0) {
          s.stage = 1;
          s.t = 0;
          s.T = 0.42;
          this.ev.emit('rim', { strength: 0.6 });
          b.touchedRim = true;
          b.aimAt(H.x, H.y, H.z - 0.05, s.T);
        } else this.makeThrough(s.shooter, s.points, 'rimIn');
        return;
      default:
        // Miss: hand off to real physics from the contact point.
        b.state = 'loose';
        if (s.result === 'rimOut' || s.result === 'layupOut') {
          // Carom off the iron: away from the rim center, biased back toward the shooter.
          const ox = b.x - H.x; const oy = b.y - H.y; const ol = Math.hypot(ox, oy) || 1;
          const sx = s.shooter.x - H.x; const sy = s.shooter.y - H.y; const sl = Math.hypot(sx, sy) || 1;
          let dx = (ox / ol) * 0.6 + (sx / sl) * 0.4; let dy = (oy / ol) * 0.6 + (sy / sl) * 0.4;
          const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
          const spd = rand(3.5, 8) + hoopDist(s.shooter.x, s.shooter.y) * 0.12;
          b.vx = dx * spd; b.vy = Math.max(-2, dy * spd); b.vz = rand(5, 11);
          b.z = Math.max(b.z, H.z + PHYS.BALL_R + 0.1);
          this.ev.emit('rim', { strength: 0.9 });
        }
        b.touchedRim = s.result !== 'airball';
        if (s.result === 'airball') this.ev.emit('banner', { text: 'AIRBALL', tone: 'warn' });
        this.ev.emit('miss', { p: s.shooter });
        if (s.result === 'boardOut') { this.ev.emit('board', { strength: 1 }); b.touchedRim = true; }
        if (this.buzzerPending) this.resolveBuzzer();
        return;
    }
  }

  private makeThrough(shooter: Player, pts: 2 | 3, kind: ShotResult) {
    const b = this.ball;
    b.state = 'loose';
    b.x = COURT.HOOP.x + (b.x - COURT.HOOP.x) * 0.3;
    b.y = COURT.HOOP.y + (b.y - COURT.HOOP.y) * 0.3;
    b.vx *= 0.15; b.vy *= 0.15; b.vz = Math.min(b.vz, -7);
    b.throughHoop = true;
    b.reboundable = false;
    this.ev.emit('net', { strength: kind === 'swish' ? 1.2 : 0.9 });
    if (kind === 'rimIn') this.ev.emit('rim', { strength: 0.35 });
    this.scoreBasket(shooter.side, pts, shooter, kind);
  }

  private updatePass(dt: number) {
    const b = this.ball;
    const ps = b.pass;
    if (!ps) { b.state = 'loose'; return; }
    ps.t += dt;
    b.integrate(dt);

    // Interceptions
    for (const d of this.opponents(ps.from)) {
      if (ps.checked.has(d.id) || d.locked && d.action !== 'contest') continue;
      const dd = Math.hypot(d.x - b.x, d.y - b.y);
      if (dd < 1.7 && b.z < 7 + d.z) {
        ps.checked.add(d.id);
        let p = 0.28 + d.r.steal / 260 + (d.airborne ? 0.15 : 0);
        if (this.cfg.userSide !== null && d.side !== this.cfg.userSide) p *= this.cfg.difficulty === 'rookie' ? 0.6 : this.cfg.difficulty === 'pro' ? 0.85 : 1;
        if (Math.random() < p) {
          d.stats.stl++;
          ps.from.stats.tov++;
          this.ev.emit('steal', { p: d, from: ps.from, intercept: true });
          this.giveBall(d);
          return;
        }
        if (chance(0.35)) {
          // deflection
          b.state = 'loose';
          b.pass = null;
          b.vx = b.vx * 0.3 + rand(-6, 6);
          b.vy = b.vy * 0.3 + rand(-6, 6);
          b.vz = rand(2, 6);
          b.lastTouch = d.side;
          return;
        }
      }
    }

    // Catch
    const r = ps.to;
    if (ps.t > ps.T * 0.35 && r.touchLock <= 0) {
      const dd = Math.hypot(r.x - b.x, r.y - b.y);
      if (dd < 2.1 && b.z < 7.5 + r.z) {
        this.giveBall(r);
        r.catchTime = this.time;
        this.ev.emit('catch', { p: r });
        return;
      }
    }
    // Anyone else on the passing team can grab an errant pass
    if (ps.t > ps.T + 0.3) {
      b.state = 'loose';
      b.pass = null;
    }
  }

  private updateLoose(dt: number) {
    const b = this.ball;
    const prevZ = b.z;
    const contact = b.physics(dt);
    if (contact === 'floor') {
      const strength = clamp(Math.abs(b.vz) / 12, 0.15, 1);
      this.ev.emit('bounce', { strength, x: b.x, y: b.y });
    } else if (contact === 'rim') {
      b.touchedRim = true;
      this.ev.emit('rim', { strength: 0.8 });
    } else if (contact === 'board') {
      b.touchedRim = true;
      this.ev.emit('board', { strength: 0.8 });
    }

    // A loose ball falling through the hoop after a rim bounce counts (roll-in / put-back).
    if (!b.throughHoop && this.phase === 'live' && prevZ >= COURT.HOOP.z && b.z < COURT.HOOP.z && b.vz < 0) {
      const dh = Math.hypot(b.x - COURT.HOOP.x, b.y - COURT.HOOP.y);
      if (dh < COURT.RIM_R - 0.12) {
        b.throughHoop = true;
        const shooter = b.shot?.shooter ?? null;
        const pts = (b.shot?.points ?? 2);
        this.ev.emit('net', { strength: 0.8 });
        if (shooter && shooter.side === b.lastTouch) this.scoreBasket(shooter.side, pts, shooter, 'rimIn');
        else this.scoreBasket(b.lastTouch, 2, null, 'putback');
        return;
      }
    }
    if (b.throughHoop && b.z < 5) b.throughHoop = b.z > 0.5; // allow future roll-ins once it's on the floor

    if (this.phase !== 'live') return;

    // Out of bounds
    if (b.z < 4 && (b.x < -1 || b.x > COURT.W + 1 || b.y > COURT.L + 0.5 || b.y < -1.2)) {
      const side = (1 - b.lastTouch) as Side;
      this.ev.emit('whistle', null);
      this.ev.emit('banner', { text: 'OUT OF BOUNDS', tone: 'neutral' });
      this.deadBall(side);
      return;
    }

    // Pickups
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const p of this.players) {
      if (p.touchLock > 0 || p.action === 'stumble') continue;
      const dd = Math.hypot(p.x - b.x, p.y - b.y);
      const reachZ = p.def.height * 1.2 + p.z;
      if (dd < 1.7 && b.z < reachZ) {
        const score = -dd + (p.r.rebound / 100) * (b.reboundable ? 1.2 : 0.3) + Math.random() * 0.8;
        if (score > bestScore) { bestScore = score; best = p; }
      }
    }
    if (best) {
      const ps = this.pendingSteal;
      this.pendingSteal = null;
      if (ps && best.side === ps.d.side) {
        ps.d.stats.stl++;
        ps.h.stats.tov++;
        this.ev.emit('steal', { p: ps.d, from: ps.h, intercept: false });
      }
      this.giveBall(best);
    }
  }

  /** Hand the ball to a player during live play, applying possession rules. */
  giveBall(p: Player) {
    const b = this.ball;
    const wasReboundable = b.reboundable;
    const touchedRim = b.touchedRim;
    const changed = p.side !== this.offense;
    this.giveBallRaw(p);
    if (wasReboundable) {
      p.stats.reb++;
      this.ev.emit('rebound', { p, offensive: !changed });
    }
    if (changed) {
      this.offense = p.side;
      this.needsClear = !isThree(p.x, p.y);
      this.shotClock = RULES.SHOT_CLOCK;
      this.reassignDefense();
      this.ev.emit('possession', { side: p.side });
      if (this.needsClear && p.side === this.cfg.userSide) this.ev.emit('banner', { text: 'CLEAR THE BALL', sub: 'Take it beyond the arc', tone: 'warn' });
    } else if (touchedRim) {
      this.shotClock = RULES.SHOT_CLOCK;
    }
    if (this.cfg.userSide !== null) {
      if (p.side === this.cfg.userSide) this.setUser(p);
      else if (changed && this.user) {
        // switch to whoever is guarding the new ball handler
        const guard = this.team(this.cfg.userSide).find((d) => this.assign.get(d.id) === p);
        if (guard) this.setUser(guard);
      }
    }
  }

  private giveBallRaw(p: Player) {
    const b = this.ball;
    b.state = 'held';
    b.owner = p;
    b.lastTouch = p.side;
    b.shot = null;
    b.pass = null;
    b.reboundable = false;
    b.touchedRim = false;
    b.throughHoop = false;
    b.vx = 0; b.vy = 0; b.vz = 0;
    p.ai.holdT = 0;
    p.ai.decideT = 0.25;
    p.ai.plan = 'probe';
  }

  reassignDefense() {
    const off = this.team(this.offense);
    const def = this.team(this.defense);
    // Greedy nearest assignment
    const free = new Set(off);
    this.assign.clear();
    const pairs: { d: Player; o: Player; dist: number }[] = [];
    for (const d of def) for (const o of off) pairs.push({ d, o, dist: d.distTo(o) });
    pairs.sort((a, b) => a.dist - b.dist);
    const done = new Set<Player>();
    for (const pr of pairs) {
      if (done.has(pr.d) || !free.has(pr.o)) continue;
      this.assign.set(pr.d.id, pr.o);
      done.add(pr.d);
      free.delete(pr.o);
    }
  }

  // ------------------------------------------------------------------ scoring / rules

  private scoreBasket(side: Side, pts: number, shooter: Player | null, kind: ShotResult | 'putback') {
    if (this.phase !== 'live') return;
    if (this.shotIllegal && side === this.offense && kind !== 'putback') {
      this.shotIllegal = false;
      this.ev.emit('banner', { text: 'NO BASKET', sub: 'Ball was not cleared', tone: 'warn' });
      this.ev.emit('whistle', null);
      this.deadBall((1 - side) as Side);
      return;
    }
    this.shotIllegal = false;
    this.score[side] += pts;
    let assist: Player | null = null;
    if (shooter) {
      shooter.stats.pts += pts;
      shooter.stats.fgm++;
      if (pts === 3) shooter.stats.tpm++;
      if (shooter.lastPasser && shooter.lastPasser.side === shooter.side && this.time - shooter.catchTime < 5) {
        assist = shooter.lastPasser;
        assist.stats.ast++;
      }
      shooter.lastPasser = null;
    }
    this.ev.emit('score', { side, pts, p: shooter, kind, assist });
    if (pts === 3) this.ev.emit('shake', { amount: 0.006, ms: 200 });
    if (this.overtime) {
      this.ended = true;
    }
    if (this.buzzerPending) { this.buzzerPending = false; this.endRegulation(); return; }
    this.deadBall((1 - side) as Side);
  }

  private turnover(side: Side, reason: string) {
    const h = this.handler;
    if (h && h.side === side) h.stats.tov++;
    this.ev.emit('whistle', null);
    this.ev.emit('turnover', { side, reason });
    this.ev.emit('banner', { text: reason, sub: 'TURNOVER', tone: 'warn' });
    this.deadBall((1 - side) as Side);
  }

  private deadBall(nextOffense: Side) {
    if (this.phase === 'dead' || this.phase === 'over') return;
    this.phase = 'dead';
    this.phaseT = 0;
    this.nextOffense = nextOffense;
    const b = this.ball;
    if (b.state === 'held') {
      // drop it
      b.state = 'loose'; b.owner = null; b.vz = 2;
    }
    if (b.state === 'pass' || b.state === 'shot') b.state = 'loose';
    for (const p of this.players) { p.charging = false; if (p.action === 'jumpshot' && !p.airborne) p.setAction('none'); }
    // Walk toward next-possession spots during the dead ball
    this.prepareFormation(nextOffense);
  }

  private prepareFormation(side: Side) {
    this.formation.clear();
    const off = this.team(side);
    const def = this.team((1 - side) as Side);
    off.forEach((p, i) => {
      const s = OFF_SPOTS[(i + 1) % 3];
      this.formation.set(p.id, { x: s.x, y: s.y + 2, face: null });
    });
    def.forEach((p, i) => {
      const s = OFF_SPOTS[(i + 1) % 3];
      this.formation.set(p.id, { x: s.x, y: s.y - 3, face: null });
    });
  }

  private onBuzzer() {
    this.ev.emit('buzzer', null);
    if (this.ball.state === 'shot' && this.ball.shot?.releasedBeforeBuzzer) {
      this.buzzerPending = true;
      return;
    }
    this.endRegulation();
  }

  private resolveBuzzer() {
    this.buzzerPending = false;
    this.endRegulation();
  }

  private endRegulation() {
    if (this.score[0] === this.score[1]) {
      this.overtime = true;
      this.ev.emit('banner', { text: 'OVERTIME', sub: 'Next bucket wins', tone: 'neutral' });
      this.phase = 'dead';
      this.phaseT = -0.8;
      this.nextOffense = chance(0.5) ? 0 : 1;
      this.prepareFormation(this.nextOffense);
      return;
    }
    this.ended = true;
    this.phase = 'dead';
    this.phaseT = 0;
    this.prepareFormation(this.offense);
  }

  private finish() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.phaseT = 0;
    this.formation.clear();
    const winner: Side = this.score[0] > this.score[1] ? 0 : 1;
    for (const p of this.players) if (p.side === winner) p.setAction('celebrate');
    this.ev.emit('buzzer', null);
    this.ev.emit('gameover', null);
  }

  // ------------------------------------------------------------------ physics helpers

  private separatePlayers() {
    const ps = this.players;
    const R2 = Player.RADIUS * 2;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]; const b = ps[j];
        if (Math.abs(a.z - b.z) > 3) continue;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= R2 || d === 0) continue;
        const nx = dx / d; const ny = dy / d;
        const overlap = R2 - d;
        // Defenders in a stance are harder to push (they "wall up").
        const wa = a.side === this.defense ? 0.35 : 0.65;
        const wb = b.side === this.defense ? 0.35 : 0.65;
        const tw = wa + wb;
        a.x -= nx * overlap * (wa / tw); a.y -= ny * overlap * (wa / tw);
        b.x += nx * overlap * (wb / tw); b.y += ny * overlap * (wb / tw);
        // remove closing velocity
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          a.vx += nx * rv * (wa / tw); a.vy += ny * rv * (wa / tw);
          b.vx -= nx * rv * (wb / tw); b.vy -= ny * rv * (wb / tw);
        }
      }
    }
  }

  /** Used by AI / HUD: is the shot by p from here a three? */
  isThree(p: Player): boolean { return isThree(p.x, p.y); }

  slowmo(seconds: number) { this.slowmoT = seconds; }
}
