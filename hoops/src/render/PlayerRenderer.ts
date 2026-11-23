import Phaser from 'phaser';
import { CHAR_VIS } from '../config';
import { lighten } from '../core/math';
import { project, Z_SCALE, type Projected } from '../core/projection';
import type { Ball } from '../sim/Ball';
import type { Player } from '../sim/Player';

/**
 * Procedural, fully 3D-posed character rig. Joints are posed in the player's
 * local frame (forward, side, up), transformed to world space and projected,
 * so animation works in every facing direction automatically. Body parts are
 * painter-sorted by depth and drawn with a cartoon outline.
 */

type J = { f: number; s: number; z: number };
interface Pose {
  footL: J; footR: J; kneeL: J; kneeR: J; hipL: J; hipR: J;
  shL: J; shR: J; elL: J; elR: J; hL: J; hR: J; head: J;
}

const OUTLINE = 0x17121c;
const VIS = CHAR_VIS;
const j = (f: number, s: number, z: number): J => ({ f, s, z });

export interface DrawOpts {
  reflect?: boolean;
  alpha?: number;
  onDefense: boolean;
  time: number;
}

/** Seven-segment style digits for jersey numbers (segment endpoints in a 0..1 x 0..2 box). */
const SEG: Record<string, [number, number, number, number]> = {
  a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1],
};
const DIGITS: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd',
};

export class PlayerRenderer {
  private tmp: Projected = { x: 0, y: 0, k: 0 };

  computePose(p: Player, ball: Ball, opts: DrawOpts): Pose {
    const hs = (p.def.height / 6.6) * VIS;
    const u = Math.min(1, p.speed / 14);
    const ph = p.animPhase;
    const sinp = Math.sin(ph);
    const cosp = Math.cos(ph);

    let hipZ = 3.1;
    let footSpread = 0.42;
    let kneeOut = 0.45;
    let lean = 0.3 * u;
    const stance = opts.onDefense && !p.airborne && p.action === 'none';
    if (stance) { hipZ = 2.65; footSpread = 0.85; kneeOut = 0.78; lean = 0.25; }

    const bob = Math.abs(sinp) * 0.16 * u + (u < 0.05 ? Math.sin(opts.time * 2.4 + p.id) * 0.03 : 0);
    const stride = (stance ? 0.6 : 1.35) * u;

    const footL = j(sinp * stride, -footSpread, 0.14 + Math.max(0, -cosp) * 0.85 * u);
    const footR = j(-sinp * stride, footSpread, 0.14 + Math.max(0, cosp) * 0.85 * u);
    const kneeL = j(footL.f * 0.45 + 0.28 + (stance ? 0.25 : 0), -kneeOut, 1.55 + footL.z * 0.55 - (stance ? 0.25 : 0));
    const kneeR = j(footR.f * 0.45 + 0.28 + (stance ? 0.25 : 0), kneeOut, 1.55 + footR.z * 0.55 - (stance ? 0.25 : 0));
    const hipL = j(lean * 0.2, -0.4, hipZ + bob);
    const hipR = j(lean * 0.2, 0.4, hipZ + bob);
    const shZ = hipZ + 1.85 + bob;
    const shL = j(lean, -0.78, shZ);
    const shR = j(lean, 0.78, shZ);
    const head = j(lean * 1.15, 0, shZ + 0.82);

    // Default arm swing
    let hL = j(-sinp * 1.0 * u + 0.2, -0.95, 3.05 + bob + Math.abs(sinp) * 0.3 * u);
    let hR = j(sinp * 1.0 * u + 0.2, 0.95, 3.05 + bob + Math.abs(cosp) * 0.3 * u);
    if (stance) {
      hL = j(0.6, -1.6, 3.9);
      hR = j(0.6, 1.6, 3.9 + Math.sin(opts.time * 7 + p.id) * 0.15);
    }

    const hasBall = ball.owner === p && ball.state === 'held';
    const toLocal = (wx: number, wy: number, wz: number): J => {
      const fx = Math.cos(p.facing); const fy = Math.sin(p.facing);
      const dx = wx - p.x; const dy = wy - p.y;
      return j(dx * fx + dy * fy, dx * -fy + dy * fx, wz - p.z);
    };

    switch (p.action) {
      case 'jumpshot': {
        if (!p.released) {
          const lift = Math.min(1, p.charge) * 0.4;
          hL = j(0.5, -0.25, 6.35 + lift); hR = j(0.55, 0.22, 6.2 + lift);
        } else {
          hR = j(0.95, 0.15, 7.0); hL = j(0.6, -0.4, 6.6);
        }
        break;
      }
      case 'layup':
        hR = j(0.75, 0.2, 7.4); hL = j(0.45, -0.45, 5.4);
        kneeL.f = 0.85; kneeL.z = 2.7; footL.f = 0.4; footL.z = 1.7;
        break;
      case 'dunk':
        hR = j(1.0, 0.3, 7.9); hL = j(1.0, -0.3, 7.9);
        kneeL.f = 0.6; kneeL.z = 2.4; footL.z = 1.4;
        kneeR.f = 0.3; kneeR.z = 2.0; footR.f = -0.5; footR.z = 1.0;
        break;
      case 'contest':
        hR = j(0.3, 0.45, 8.0); hL = j(0.3, -0.45, 8.0);
        break;
      case 'reach':
        hR = j(2.1, 0.35, 3.0); shR.f += 0.35;
        break;
      case 'pass':
        hR = j(1.5, 0.25, 4.2); hL = j(1.5, -0.25, 4.2);
        break;
      case 'stumble':
        hR = j(-0.4, 1.4, 5.3); hL = j(0.2, -1.4, 5.0);
        break;
      case 'celebrate': {
        const up = Math.abs(Math.sin(opts.time * 6 + p.id));
        hR = j(0.2, 0.6, 7.6 + up * 0.3); hL = j(0.2, -0.6, 7.6 + up * 0.3);
        break;
      }
      default:
        if (hasBall) {
          const b = toLocal(ball.x, ball.y, ball.z);
          // Ball coordinates are in world feet; the pose is scaled by hs afterwards, so pre-divide.
          if (ball.z > 3.9) {
            // holding the ball at the chest
            hR = j(b.f / hs - 0.1, 0.38, ball.z / hs); hL = j(b.f / hs - 0.1, -0.38, ball.z / hs);
          } else {
            hR = j(b.f / hs, b.s / Math.sqrt(hs), Math.max(2.35, Math.min(3.6, (b.z + 0.42) / hs)));
          }
        }
    }

    // Elbows: between shoulder and hand, pushed outward and down
    const elbow = (sh: J, h: J, side: number): J => {
      const mid = j((sh.f + h.f) / 2, (sh.s + h.s) / 2, (sh.z + h.z) / 2);
      const reachLen = Math.hypot(h.f - sh.f, h.s - sh.s, h.z - sh.z);
      const bend = Math.max(0, 2.6 - reachLen) * 0.38;
      return j(mid.f - bend * 0.3, mid.s + side * bend * 0.6, mid.z - bend * 0.5);
    };

    const pose: Pose = {
      footL, footR, kneeL, kneeR, hipL, hipR, shL, shR,
      elL: elbow(shL, hL, -1), elR: elbow(shR, hR, 1), hL, hR, head,
    };
    // Airborne: tuck legs a little
    if (p.z > 0.3 && p.action !== 'layup' && p.action !== 'dunk') {
      pose.footL.z += 0.35; pose.footR.z += 0.35; pose.footL.f -= 0.2; pose.footR.f -= 0.2;
      pose.kneeL.f += 0.25; pose.kneeR.f += 0.25;
    }
    // Scale by height
    for (const key of Object.keys(pose) as (keyof Pose)[]) {
      const q = pose[key];
      q.z *= hs; q.f *= hs; q.s *= Math.sqrt(hs);
    }
    return pose;
  }

  draw(g: Phaser.GameObjects.Graphics, p: Player, ball: Ball, opts: DrawOpts) {
    const pose = this.computePose(p, ball, opts);
    const fx = Math.cos(p.facing); const fy = Math.sin(p.facing);
    const rx = -fy; const ry = fx;
    const reflect = !!opts.reflect;
    const k0 = project(p.x, p.y, 0).k * VIS;
    const s = k0 / 22; // global pixel scale
    const ol = reflect ? 0 : 2.4 * s;

    type W = { x: number; y: number; z: number; sx: number; sy: number };
    const W = (q: J): W => {
      const wx = p.x + fx * q.f + rx * q.s;
      const wy = p.y + fy * q.f + ry * q.s;
      const wz = q.z + p.z;
      const pr = project(wx, wy, reflect ? -wz : wz, this.tmp);
      return { x: wx, y: wy, z: wz, sx: pr.x, sy: pr.y };
    };

    const L = p.def.look;
    const team = p.team;
    const skin = L.skin;
    const jersey = team.primary;
    const trim = team.secondary;
    const shorts = lighten(team.primary, -0.08);
    const alpha = opts.alpha ?? 1;

    const P = {
      footL: W(pose.footL), footR: W(pose.footR), kneeL: W(pose.kneeL), kneeR: W(pose.kneeR),
      hipL: W(pose.hipL), hipR: W(pose.hipR), shL: W(pose.shL), shR: W(pose.shR),
      elL: W(pose.elL), elR: W(pose.elR), hL: W(pose.hL), hR: W(pose.hR), head: W(pose.head),
    };

    const limb = (a: W, b: W, w: number, color: number, highlight = true) => {
      const wp = w * k0;
      if (ol > 0) {
        g.lineStyle(wp + ol * 2, OUTLINE, alpha);
        g.lineBetween(a.sx, a.sy, b.sx, b.sy);
        g.fillStyle(OUTLINE, alpha);
        g.fillCircle(a.sx, a.sy, wp / 2 + ol);
        g.fillCircle(b.sx, b.sy, wp / 2 + ol);
      }
      g.lineStyle(wp, color, alpha);
      g.lineBetween(a.sx, a.sy, b.sx, b.sy);
      g.fillStyle(color, alpha);
      g.fillCircle(a.sx, a.sy, wp / 2);
      g.fillCircle(b.sx, b.sy, wp / 2);
      if (highlight && !reflect) {
        g.lineStyle(wp * 0.28, lighten(color, 0.22), alpha * 0.8);
        g.lineBetween(a.sx - wp * 0.18, a.sy - wp * 0.1, b.sx - wp * 0.18, b.sy - wp * 0.1);
      }
    };

    const lerpW = (a: W, b: W, t: number): W => ({
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t,
    });

    const drawLeg = (hip: W, knee: W, foot: W, side: number) => {
      limb(hip, knee, 0.4, skin);
      const sock = lerpW(foot, knee, 0.42);
      limb(knee, sock, 0.33, skin);
      limb(sock, foot, 0.33, 0xf4f4f4, false);
      // shoe
      const tp = project(foot.x + fx * 0.42, foot.y + fy * 0.42, reflect ? -foot.z : foot.z);
      const toe: W = { x: foot.x + fx * 0.42, y: foot.y + fy * 0.42, z: foot.z, sx: tp.x, sy: tp.y };
      limb(foot, toe, 0.36, L.shoes, false);
      // shorts over the upper thigh
      const thigh = lerpW(hip, knee, 0.55);
      limb(hip, thigh, 0.64, shorts);
      if (!reflect) {
        g.lineStyle(0.07 * k0, trim, alpha);
        g.lineBetween(thigh.sx - side * 0.25 * k0, thigh.sy, thigh.sx + side * 0.25 * k0, thigh.sy);
      }
    };

    const drawArm = (sh: W, el: W, hand: W, right: boolean) => {
      const sleeveCol = right && L.sleeve !== undefined ? L.sleeve : null;
      limb(sh, el, 0.3, sleeveCol ?? skin);
      limb(el, hand, 0.27, sleeveCol ?? skin);
      if (!right && L.sleeve === undefined && L.headband !== undefined && !reflect) {
        const wb = lerpW(hand, el, 0.25);
        limb(hand, wb, 0.3, L.headband, false);
      }
      g.fillStyle(OUTLINE, alpha);
      g.fillCircle(hand.sx, hand.sy, 0.2 * k0 + ol);
      g.fillStyle(skin, alpha);
      g.fillCircle(hand.sx, hand.sy, 0.2 * k0);
    };

    const drawTorso = () => {
      const pts = [P.shL, P.shR, P.hipR, P.hipL];
      // widen at shoulders slightly for a jersey silhouette
      if (ol > 0) {
        g.lineStyle(ol * 2, OUTLINE, alpha);
        g.fillStyle(OUTLINE, alpha);
        g.beginPath();
        g.moveTo(pts[0].sx, pts[0].sy);
        for (let i = 1; i < 4; i++) g.lineTo(pts[i].sx, pts[i].sy);
        g.closePath();
        g.strokePath();
        g.fillPath();
      }
      g.fillStyle(jersey, alpha);
      g.beginPath();
      g.moveTo(pts[0].sx, pts[0].sy);
      for (let i = 1; i < 4; i++) g.lineTo(pts[i].sx, pts[i].sy);
      g.closePath();
      g.fillPath();
      // pelvis band (shorts waist)
      limb(P.hipL, P.hipR, 0.5, shorts, false);
      if (reflect) return;
      // side shading for volume
      const shade = fx * 1; // light from the left
      g.fillStyle(0x000000, 0.13 * alpha);
      const rs = shade > 0 ? [P.shR, P.hipR] : [P.shL, P.hipL];
      const ls = shade > 0 ? [P.shL, P.hipL] : [P.shR, P.hipR];
      g.beginPath();
      g.moveTo(rs[0].sx, rs[0].sy); g.lineTo(rs[1].sx, rs[1].sy);
      g.lineTo(lerpW(rs[1], ls[1], 0.3).sx, lerpW(rs[1], ls[1], 0.3).sy);
      g.lineTo(lerpW(rs[0], ls[0], 0.3).sx, lerpW(rs[0], ls[0], 0.3).sy);
      g.closePath(); g.fillPath();
      // trim: neckline and side stripes
      g.lineStyle(0.1 * k0, trim, alpha);
      g.lineBetween(P.shL.sx, P.shL.sy, P.hipL.sx, P.hipL.sy);
      g.lineBetween(P.shR.sx, P.shR.sy, P.hipR.sx, P.hipR.sy);
      const neck = lerpW(P.shL, P.shR, 0.5);
      const facingCam = fy > 0.2;
      if (facingCam) {
        const v = lerpW(neck, lerpW(P.hipL, P.hipR, 0.5), 0.2);
        g.lineBetween(lerpW(P.shL, P.shR, 0.33).sx, lerpW(P.shL, P.shR, 0.33).sy, v.sx, v.sy);
        g.lineBetween(lerpW(P.shL, P.shR, 0.67).sx, lerpW(P.shL, P.shR, 0.67).sy, v.sx, v.sy);
      }
      // jersey number (front: small, back: big)
      if (Math.abs(fy) > 0.3) {
        const c = lerpW(lerpW(P.shL, P.shR, 0.5), lerpW(P.hipL, P.hipR, 0.5), 0.45);
        const width = Math.abs(P.shR.sx - P.shL.sx);
        const size = (facingCam ? 0.16 : 0.24) * k0 * Math.min(1, width / (1.2 * k0) + 0.3);
        this.drawNumber(g, String(p.def.number), c.sx, c.sy, size, team.text, trim, alpha);
      }
    };

    const drawHead = () => {
      const c = P.head;
      const r = 0.52 * k0 * Math.pow(p.def.height / 6.6, 0.3);
      const front = fy; // >0 facing the camera
      const side = fx;
      // neck
      const neck = lerpW(P.shL, P.shR, 0.5);
      limb(neck, c, 0.3, skin, false);
      if (L.hair === 'afro') {
        g.fillStyle(OUTLINE, alpha); g.fillCircle(c.sx, c.sy - r * 0.25, r * 1.32 + ol);
        g.fillStyle(L.hairColor, alpha); g.fillCircle(c.sx, c.sy - r * 0.25, r * 1.32);
      }
      if (L.hair === 'bun' && front < 0.3) {
        g.fillStyle(OUTLINE, alpha); g.fillCircle(c.sx - side * r * 0.2, c.sy - r * 1.0, r * 0.42 + ol);
        g.fillStyle(L.hairColor, alpha); g.fillCircle(c.sx - side * r * 0.2, c.sy - r * 1.0, r * 0.42);
      }
      g.fillStyle(OUTLINE, alpha); g.fillCircle(c.sx, c.sy, r + ol);
      g.fillStyle(skin, alpha); g.fillCircle(c.sx, c.sy, r);
      if (reflect) return;
      // hair
      const hairCol = L.hair === 'buzz' ? lighten(L.hairColor, 0.08) : L.hairColor;
      const hairAlpha = L.hair === 'buzz' ? 0.75 : 1;
      if (L.hair !== 'bald' && L.hair !== 'afro') {
        g.fillStyle(hairCol, alpha * hairAlpha);
        if (front < -0.35) {
          g.fillCircle(c.sx, c.sy - r * 0.05, r * 0.98);
        } else {
          // cap of hair on top, shifted away from the face
          g.slice(c.sx, c.sy, r, Math.PI * (1.02 + side * 0.08), Math.PI * (1.98 + side * 0.08), false);
          g.fillPath();
          g.fillCircle(c.sx - side * r * 0.35, c.sy - r * 0.15, r * 0.72);
        }
        if (L.hair === 'mohawk') {
          g.fillStyle(L.hairColor, alpha);
          g.fillEllipse(c.sx, c.sy - r * 0.95, r * 0.45, r * 0.9);
        }
        if (L.hair === 'curly') {
          for (let i = 0; i < 6; i++) {
            const a = Math.PI * (1.05 + i * 0.18);
            g.fillCircle(c.sx + Math.cos(a) * r * 0.92, c.sy + Math.sin(a) * r * 0.92, r * 0.3);
          }
        }
        if (L.hair === 'braids') {
          g.lineStyle(r * 0.16, L.hairColor, alpha);
          for (let i = -2; i <= 2; i++) {
            const bx = c.sx + i * r * 0.32 - side * r * 0.3;
            g.lineBetween(bx, c.sy, bx - side * r * 0.4, c.sy + r * 1.25);
          }
        }
      } else if (L.hair === 'afro' && front >= -0.35) {
        // hairline over the forehead
        g.fillStyle(L.hairColor, alpha);
        g.slice(c.sx, c.sy, r, Math.PI * 1.02, Math.PI * 1.98, false);
        g.fillPath();
      } else if (L.hair === 'bald') {
        g.fillStyle(0xffffff, 0.22 * alpha);
        g.fillCircle(c.sx - r * 0.3, c.sy - r * 0.4, r * 0.25);
      }
      // face
      if (front > -0.35) {
        const ex = c.sx + side * r * 0.42;
        const ey = c.sy + r * 0.1;
        const spread = r * 0.3 * Math.max(0.25, front + 0.2);
        g.fillStyle(0x1a1212, alpha);
        if (Math.abs(side) < 0.85) g.fillCircle(ex - spread, ey, r * 0.1);
        g.fillCircle(ex + spread, ey, r * 0.1);
        if (L.beard) {
          g.fillStyle(L.hairColor, 0.85 * alpha);
          g.slice(c.sx + side * r * 0.25, c.sy + r * 0.15, r * 0.82, Math.PI * 0.12, Math.PI * 0.88, false);
          g.fillPath();
        }
      }
      if (L.headband !== undefined) {
        g.lineStyle(r * 0.26, L.headband, alpha);
        g.beginPath();
        g.arc(c.sx, c.sy + r * 0.1, r * 0.96, Math.PI * 1.08, Math.PI * 1.92, false);
        g.strokePath();
      }
    };

    // Painter's sort by world depth (y toward the camera)
    const avgY = (...ws: W[]) => ws.reduce((a, w) => a + w.y, 0) / ws.length;
    const torsoY = avgY(P.shL, P.shR, P.hipL, P.hipR);
    const parts: { y: number; fn: () => void }[] = [
      { y: avgY(P.hipL, P.kneeL, P.footL) - 0.05, fn: () => drawLeg(P.hipL, P.kneeL, P.footL, -1) },
      { y: avgY(P.hipR, P.kneeR, P.footR) - 0.05, fn: () => drawLeg(P.hipR, P.kneeR, P.footR, 1) },
      { y: torsoY, fn: drawTorso },
      { y: torsoY + 0.001, fn: drawHead },
      { y: avgY(P.shL, P.elL, P.hL), fn: () => drawArm(P.shL, P.elL, P.hL, false) },
      { y: avgY(P.shR, P.elR, P.hR), fn: () => drawArm(P.shR, P.elR, P.hR, true) },
    ];
    // In the back view the head always sits over the arms unless they're raised in front.
    parts.sort((a, b) => a.y - b.y);
    for (const part of parts) part.fn();
  }

  private drawNumber(g: Phaser.GameObjects.Graphics, num: string, cx: number, cy: number, h: number, color: number, stroke: number, alpha: number) {
    const w = h * 0.55;
    const gap = w * 0.45;
    const total = num.length * w + (num.length - 1) * gap;
    let x = cx - total / 2;
    const y = cy - h;
    for (const ch of num) {
      const segs = DIGITS[ch] ?? '';
      for (const pass of [0, 1]) {
        g.lineStyle(pass === 0 ? h * 0.38 : h * 0.22, pass === 0 ? stroke : color, alpha);
        for (const sname of segs) {
          const [x0, y0, x1, y1] = SEG[sname];
          g.lineBetween(x + x0 * w, y + y0 * h, x + x1 * w, y + y1 * h);
        }
      }
      x += w + gap;
    }
  }

  /** Floor shadow for a player (stays on the ground and shrinks when jumping). */
  drawShadow(g: Phaser.GameObjects.Graphics, p: Player) {
    const pr = project(p.x + 0.35, p.y - 0.35, 0);
    const shrink = 1 / (1 + p.z * 0.18);
    g.fillStyle(0x000000, 0.32 * shrink);
    g.fillEllipse(pr.x, pr.y, 2.3 * pr.k * shrink, 2.3 * pr.k * Z_SCALE * 0.8 * shrink);
  }
}
