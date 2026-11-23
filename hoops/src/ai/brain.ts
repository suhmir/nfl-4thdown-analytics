import { COURT, SHOT } from '../config';
import { chance, clamp, distToSegment, gauss, rand } from '../core/math';
import type { Match } from '../sim/Match';
import type { Player } from '../sim/Player';
import { expectedShotValue, isThree } from '../sim/shooting';

const H = COURT.HOOP;

/** Perimeter and interior spacing slots used by off-ball offense. */
const SPOTS = [
  { x: 3.5, y: 6, tag: 'corner' },
  { x: 46.5, y: 6, tag: 'corner' },
  { x: 7, y: 20, tag: 'wing' },
  { x: 43, y: 20, tag: 'wing' },
  { x: 25, y: 31, tag: 'top' },
  { x: 15, y: 29, tag: 'slot' },
  { x: 35, y: 29, tag: 'slot' },
  { x: 18.5, y: 15, tag: 'elbow' },
  { x: 31.5, y: 15, tag: 'elbow' },
  { x: 19, y: 4.5, tag: 'dunker' },
  { x: 31, y: 4.5, tag: 'dunker' },
] as const;

export function runAI(m: Match, p: Player, dt: number) {
  p.sprint = false;
  const b = m.ball;
  // Loose ball or shot in the air: rebounding behaviour for everyone.
  if (b.state === 'loose' || b.state === 'shot') {
    reboundAI(m, p);
    return;
  }
  if (p.side === m.offense) {
    if (b.owner === p && b.state === 'held') handlerAI(m, p, dt);
    else offBallAI(m, p, dt);
  } else {
    defenseAI(m, p, dt);
  }
}

// --------------------------------------------------------------- movement helpers

function steer(p: Player, tx: number, ty: number, opts: { sprintBeyond?: number; slowRadius?: number; speed?: number } = {}) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const slow = opts.slowRadius ?? 2.2;
  if (d < 0.3) { p.mx = 0; p.my = 0; return d; }
  const s = Math.min(1, d / slow) * (opts.speed ?? 1);
  p.mx = (dx / d) * s;
  p.my = (dy / d) * s;
  p.sprint = d > (opts.sprintBeyond ?? 9) && p.stamina > 0.25;
  return d;
}

function clampTarget(ai: { tx: number; ty: number }) {
  ai.tx = clamp(ai.tx, 1, COURT.W - 1);
  ai.ty = clamp(ai.ty, 1.5, COURT.L - 3);
}

// --------------------------------------------------------------- offense: ball handler

function handlerAI(m: Match, p: Player, dt: number) {
  const ai = p.ai;
  ai.holdT += dt;

  // Already shooting: decide when to let go
  if (p.action === 'jumpshot') {
    if (p.charging && p.charge >= ai.releaseAt) m.releaseJumper(p);
    return;
  }
  if (p.locked) return;

  const defs = m.opponents(p);
  const mates = m.teammates(p);
  const tune = m.tune;
  const dHoop = p.distToHoop();
  const myDef = defs.reduce((a, c) => (c.distTo(p) < a.distTo(p) ? c : a));
  const defDist = myDef.distTo(p);

  ai.decideT -= dt;
  if (ai.decideT <= 0) {
    ai.decideT = rand(0.18, 0.34);

    // 1) Must clear?
    if (m.needsClear && !isThree(p.x, p.y)) {
      ai.plan = 'clear';
      const a = Math.atan2(p.y - H.y, p.x - H.x);
      const r = COURT.THREE_R + 2.5;
      ai.tx = H.x + Math.cos(a) * r;
      ai.ty = Math.max(COURT.CORNER_Y + 2, H.y + Math.sin(a) * r);
      clampTarget(ai);
    } else {
      const myEv = expectedShotValue(p, p.x, p.y, defs);
      // Shot clock pressure lowers the bar
      const urgency = clamp((5 - m.shotClock) / 5, 0, 1);
      const patience = clamp(ai.holdT / 4, 0, 1);
      let bar = 1.28 - urgency * 0.6 - patience * 0.2 + (m.time < 4 ? 0.2 : 0);
      if (m.needsClear) bar = 99;

      // At the rim: finish
      if (dHoop < SHOT.LAYUP_RANGE - 0.4 && !m.needsClear) {
        m.beginShot(p);
        return;
      }

      // Look for a better pass
      let bestMate: Player | null = null;
      let bestMateEv = -1;
      for (const t of mates) {
        const lane = laneOpen(p, t, defs);
        if (lane < 2.2) continue;
        let ev = expectedShotValue(t, t.x, t.y, defs);
        if (t.distToHoop() < 8 && t.speed > 6) ev += 0.35; // cutter
        if (ev > bestMateEv) { bestMateEv = ev; bestMate = t; }
      }

      const passMargin = 0.18 - tune.aiIq * 0.1;
      if (m.shotClock < 1.4 && !m.needsClear) {
        m.beginShot(p);
        if (p.charging) ai.releaseAt = pickRelease(m, p);
        return;
      }
      if (myEv > bar && defDist > 3.6 && chance(0.85)) {
        if (m.beginShot(p) && p.charging) ai.releaseAt = pickRelease(m, p);
        return;
      }
      if (bestMate && ai.holdT > 0.5 && bestMateEv > myEv + passMargin && chance(0.45 + tune.aiIq * 0.4)) {
        m.passBall(p, bestMate);
        return;
      }
      if (bestMate && ai.holdT > 3.2 && chance(0.5)) {
        m.passBall(p, bestMate);
        return;
      }

      // Drive if the lane is open
      const between = distToSegment(myDef.x, myDef.y, p.x, p.y, H.x, H.y + 1.5);
      const defBehind = myDef.distToHoop() > dHoop + 0.5;
      const blowBy = chance(0.12 + (p.r.speed + p.r.handling - myDef.r.defense * 2) / 300);
      if ((between > 2.4 || defBehind || blowBy) && dHoop > 4 && chance(0.75)) {
        ai.plan = 'drive';
        ai.tx = H.x + (p.x - H.x) * 0.12;
        ai.ty = H.y + 2.5;
      } else if (chance(0.35) || ai.plan === 'clear' || Math.hypot(ai.tx - p.x, ai.ty - p.y) < 1) {
        ai.plan = 'probe';
        // Jab toward a spot away from the defender, staying near the arc.
        const away = Math.atan2(p.y - myDef.y, p.x - myDef.x);
        const base = Math.atan2(p.y - H.y, p.x - H.x) + gauss(0, 0.5) + (Math.sin(away) * 0.2);
        const r = clamp(dHoop + rand(-5, 3), 12, 26);
        ai.tx = H.x + Math.cos(base) * r;
        ai.ty = Math.max(3, H.y + Math.sin(base) * r);
        clampTarget(ai);
      }
    }
  }

  if (ai.plan === 'drive') {
    steer(p, ai.tx, ai.ty, { sprintBeyond: 4 });
    p.sprint = p.stamina > 0.2;
    if (dHoop < SHOT.LAYUP_RANGE - 0.3 && !m.needsClear) m.beginShot(p);
    else if (p.r.dunk >= 70 && dHoop < SHOT.DUNK_RANGE && p.speed > 9 && !m.needsClear && chance(0.4)) m.beginShot(p);
  } else {
    steer(p, ai.tx, ai.ty, { sprintBeyond: 12, speed: ai.plan === 'clear' ? 1 : 0.75 });
  }
}

function laneOpen(from: Player, to: Player, defs: Player[]): number {
  let best = 99;
  for (const d of defs) best = Math.min(best, distToSegment(d.x, d.y, from.x, from.y, to.x, to.y));
  return best;
}

function pickRelease(m: Match, p: Player): number {
  const sd = m.tune.aiReleaseError * (1.25 - p.r.shooting / 200);
  return clamp(SHOT.PERFECT + gauss(0, sd), 0.35, SHOT.AUTO_RELEASE - 0.02);
}

// --------------------------------------------------------------- offense: off ball

function offBallAI(m: Match, p: Player, dt: number) {
  const ai = p.ai;
  const b = m.ball;
  const handler = m.handler;

  // Receiving a pass: move to meet it
  if (b.state === 'pass' && b.pass?.to === p) {
    const T = Math.max(0, b.pass.T - b.pass.t);
    const lx = b.x + b.vx * T;
    const ly = b.y + b.vy * T;
    steer(p, lx, ly, { sprintBeyond: 3, slowRadius: 1 });
    p.faceTarget = { x: b.x, y: b.y };
    return;
  }

  ai.spotT -= dt;
  ai.cutT -= dt;

  // Cutting to the rim
  if (ai.cutT > 0) {
    const tx = H.x + (p.x < H.x ? -2 : 2);
    steer(p, tx, H.y + 3.5, { sprintBeyond: 2 });
    if (p.distTo({ x: tx, y: H.y + 3.5 }) < 1.5) ai.cutT = Math.min(ai.cutT, 0.6);
    return;
  }

  if (ai.spotT <= 0 || ai.spotIdx < 0) {
    ai.spotT = rand(1.6, 3.4);
    ai.spotIdx = chooseSpot(m, p);
    // Backdoor cut when the defender is ball-watching or far away
    const myDef = [...m.assign.entries()].find(([, man]) => man === p);
    const defender = myDef ? m.players.find((x) => x.id === myDef[0]) : null;
    const defGap = defender ? defender.distTo(p) : 99;
    if (handler && p.distToHoop() > 10 && (defGap > 6 || chance(0.12 * m.tune.aiIq)) && chance(0.4)) {
      ai.cutT = rand(1.1, 1.6);
      return;
    }
  }
  const s = SPOTS[ai.spotIdx];
  steer(p, s.x, s.y, { sprintBeyond: 10, speed: 0.8 });
  p.faceTarget = handler ? { x: handler.x, y: handler.y } : null;
}

function chooseSpot(m: Match, p: Player): number {
  const others = m.players.filter((o) => o.side === p.side && o !== p);
  const handler = m.handler;
  let best = 0;
  let bestScore = -Infinity;
  SPOTS.forEach((s, i) => {
    let minMate = 99;
    for (const o of others) {
      // Use a teammate's chosen spot if they have one, else their position
      const os = o !== handler && o.ai.spotIdx >= 0 ? SPOTS[o.ai.spotIdx] : o;
      minMate = Math.min(minMate, Math.hypot(os.x - s.x, os.y - s.y));
    }
    let score = Math.min(minMate, 16) * 1.0;
    score -= Math.hypot(s.x - p.x, s.y - p.y) * 0.18;
    // Shooters like the perimeter, bigs like the paint
    const shooter = (p.r.three - 60) / 20;
    if (s.tag === 'corner' || s.tag === 'wing' || s.tag === 'top' || s.tag === 'slot') score += shooter;
    else score += (p.r.finishing - 70) / 15 - shooter * 0.5;
    if (handler && Math.hypot(handler.x - s.x, handler.y - s.y) < 9) score -= 8;
    score += Math.random() * 2.5;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

// --------------------------------------------------------------- defense

function defenseAI(m: Match, p: Player, dt: number) {
  const ai = p.ai;
  const b = m.ball;
  const tune = m.tune;
  const userMatch = m.cfg.userSide !== null;
  // AI on the user's own team defends at a solid "pro" level regardless of difficulty.
  const react = userMatch && p.side === m.cfg.userSide ? 6 : tune.defReact;
  const gap = userMatch && p.side === m.cfg.userSide ? 3.2 : tune.defGap;

  let man = m.assign.get(p.id);
  if (!man) { m.reassignDefense(); man = m.assign.get(p.id); }
  if (!man) return;
  const handler = m.handler;

  // Pass in the air: jump the lane if it's close
  if (b.state === 'pass' && b.pass) {
    const end = { x: b.x + b.vx * (b.pass.T - b.pass.t), y: b.y + b.vy * (b.pass.T - b.pass.t) };
    const laneD = distToSegment(p.x, p.y, b.x, b.y, end.x, end.y);
    if (laneD < 4.5) {
      steer(p, end.x * 0.4 + b.x * 0.6, end.y * 0.4 + b.y * 0.6, { sprintBeyond: 0 });
      return;
    }
  }

  let tx: number;
  let ty: number;
  if (man === handler) {
    // On-ball: stay between man and hoop at a cushion
    const dx = H.x - man.x; const dy = H.y - man.y; const dl = Math.hypot(dx, dy) || 1;
    const g = man.distToHoop() < 9 ? Math.min(gap, 2.2) : gap;
    tx = man.x + (dx / dl) * g + man.vx * 0.12;
    ty = man.y + (dy / dl) * g + man.vy * 0.12;
    p.faceTarget = { x: man.x, y: man.y };

    // Contest shots
    if (man.action === 'jumpshot' || man.action === 'layup' || man.action === 'dunk') {
      tx = man.x + (dx / dl) * 1.6; ty = man.y + (dy / dl) * 1.6;
      if (ai.contestDelay <= 0) ai.contestDelay = rand(0.08, 0.26) * (10 / (react + 4));
      ai.contestDelay -= dt;
      if (ai.contestDelay <= 0.02 && !p.airborne && p.distTo(man) < 6.5 && chance(userMatch && p.side !== m.cfg.userSide ? tune.contestChance : 0.8)) {
        m.contestJump(p);
        ai.contestDelay = 9; // one jump per shot
      }
    } else {
      ai.contestDelay = 0;
      // Steal attempts
      const stealRate = (userMatch && p.side !== m.cfg.userSide ? tune.stealRate : 0.25) * (p.r.steal / 70);
      if (p.distTo(man) < 3.4 && p.stealCd <= 0 && Math.random() < stealRate * dt) m.attemptSteal(p);
    }
  } else {
    // Off-ball: sag toward the hoop and shade toward the ball
    const ballX = b.x; const ballY = b.y;
    tx = man.x + (H.x - man.x) * 0.32 + (ballX - man.x) * 0.16;
    ty = man.y + (H.y - man.y) * 0.32 + (ballY - man.y) * 0.16;
    p.faceTarget = { x: ballX, y: ballY };

    // Help defense: driver beat his man and is near the rim
    if (handler && handler.side !== p.side) {
      const hd = handler.distToHoop();
      const onBall = m.players.find((d) => m.assign.get(d.id) === handler);
      const beaten = onBall ? onBall.distToHoop() > hd + 1.2 : true;
      if (hd < 14 && beaten) {
        const helpers = m.team(p.side).filter((d) => d !== onBall).sort((a, c) => a.distTo(handler) - c.distTo(handler));
        if (helpers[0] === p) {
          tx = handler.x + (H.x - handler.x) * 0.45;
          ty = handler.y + (H.y - handler.y) * 0.45;
          if ((handler.action === 'layup' || handler.action === 'dunk') && !p.airborne && p.distTo(handler) < 5 && chance(0.6)) m.contestJump(p);
        }
      }
    }
  }

  // Reaction lag: smooth the target
  const k = Math.min(1, dt * react);
  ai.tx += (tx - ai.tx) * k;
  ai.ty += (ty - ai.ty) * k;
  const d = steer(p, ai.tx, ai.ty, { sprintBeyond: 5, slowRadius: 1.6 });
  if (d > 3 && man === handler) p.sprint = p.stamina > 0.15;
}

// --------------------------------------------------------------- rebounds / loose balls

function reboundAI(m: Match, p: Player) {
  const b = m.ball;
  // Predict where the ball comes down to around chest height
  let px = b.x; let py = b.y;
  if (b.state === 'shot' || b.z > 4) {
    let x = b.x, y = b.y, z = b.z, vz = b.vz;
    for (let i = 0; i < 60 && (z > 5 || vz > 0); i++) {
      x += b.vx * 0.03; y += b.vy * 0.03; vz -= 40 * 0.03; z += vz * 0.03;
    }
    px = x; py = y;
    if (b.state === 'shot') {
      // shots land near the rim: aim a couple of feet out
      const a = Math.atan2(p.y - H.y, p.x - H.x);
      px = H.x + Math.cos(a) * 4.5; py = Math.max(2, H.y + Math.sin(a) * 4.5);
    }
  } else {
    px = b.x + b.vx * 0.25; py = b.y + b.vy * 0.25;
  }

  // Shooter's follow-through: let them land first
  if (p.locked) return;

  // Two closest from each team crash; the third gets back for balance
  const mates = m.team(p.side).sort((a, c) => a.distTo({ x: px, y: py }) - c.distTo({ x: px, y: py }));
  const rank = mates.indexOf(p);
  if (rank <= 1 || b.state === 'loose') {
    const d = steer(p, px, py, { sprintBeyond: 3, slowRadius: 0.8 });
    p.sprint = d > 2 && p.stamina > 0.1;
    // Go up for it
    if (b.state === 'loose' && d < 2.2 && b.z > p.def.height * 1.15 && b.z < 11 && b.vz < 4 && !p.airborne && chance(0.25)) {
      m.contestJump(p);
    }
  } else {
    steer(p, 25, 28, { speed: 0.7 });
  }
  p.faceTarget = { x: b.x, y: b.y };
}
