import Phaser from 'phaser';
import { COURT } from '../config';
import { lighten, mixColor } from '../core/math';
import { project, Z_SCALE } from '../core/projection';
import type { TeamDef } from '../data/teams';

/** Depth for an object at world y (painter's algorithm). */
export const depthOf = (y: number) => 100 + y * 10;

const FAN_SHIRTS = [0x2d3a5a, 0x5a2d2d, 0x3a3a3a, 0xd9d9d9, 0x6b5a3a, 0x2d5a4a, 0x7a6a9a, 0xb07a3a];
const FAN_SKIN = [0x5a3825, 0x9c6644, 0xe0ac86, 0x7a4b2e, 0xf1c9a5, 0x3b2219];

interface Fan {
  img: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
  side: 0 | 1; // which team they support
  cheerTex: string;
  sitTex: string;
}

export class Arena {
  private scene: Phaser.Scene;
  private fans: Fan[] = [];
  private excitement = [0, 0];
  private hoopG: Phaser.GameObjects.Graphics;
  private rimBackG: Phaser.GameObjects.Graphics;
  private rimFrontG: Phaser.GameObjects.Graphics;
  private netG: Phaser.GameObjects.Graphics;
  private flashG: Phaser.GameObjects.Graphics;
  private flashes: { x: number; y: number; t: number }[] = [];

  // Net springs: per ring level [drop, squeeze, swayX, swayY] with velocities
  private net = [0, 1, 2, 3].map(() => ({ drop: 0, vdrop: 0, sq: 0, vsq: 0, sx: 0, vsx: 0, sy: 0, vsy: 0 }));
  private rimDip = 0;
  private rimDipV = 0;

  constructor(scene: Phaser.Scene, home: TeamDef, away: TeamDef) {
    this.scene = scene;
    this.makeFanTextures(home, away);
    this.buildStands(home);
    this.buildCrowd(home, away);
    this.buildBoards(home, away);
    this.hoopG = scene.add.graphics().setDepth(depthOf(-6));
    this.drawStanchion(home);
    this.rimBackG = scene.add.graphics().setDepth(depthOf(COURT.HOOP.y - 0.6));
    this.netG = scene.add.graphics().setDepth(depthOf(COURT.HOOP.y + 0.05));
    this.rimFrontG = scene.add.graphics().setDepth(depthOf(COURT.HOOP.y + 0.7));
    this.flashG = scene.add.graphics().setDepth(depthOf(-30));
  }

  // ------------------------------------------------------------- stands & crowd

  private makeFanTextures(home: TeamDef, away: TeamDef) {
    const shirts = [...FAN_SHIRTS, home.primary, home.primary, home.primary, away.primary];
    let n = 0;
    for (const shirt of shirts) {
      for (let si = 0; si < 3; si++) {
        const skin = FAN_SKIN[(n + si * 2) % FAN_SKIN.length];
        for (const cheer of [false, true]) {
          const key = `fan_${shirt.toString(16)}_${si}_${cheer ? 1 : 0}`;
          if (this.scene.textures.exists(key)) continue;
          const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
          const W = 30; const H = 46;
          // arms
          g.lineStyle(5, skin);
          if (cheer) { g.lineBetween(7, 22, 2, 4); g.lineBetween(23, 22, 28, 4); }
          // torso
          g.fillStyle(0x111111); g.fillRoundedRect(4, 19, 22, 27, 7);
          g.fillStyle(shirt); g.fillRoundedRect(5.5, 20.5, 19, 25, 6);
          g.fillStyle(0x000000, 0.18); g.fillRect(17, 21, 7, 24);
          // head
          g.fillStyle(0x111111); g.fillCircle(15, 12, 8.5);
          g.fillStyle(skin); g.fillCircle(15, 12, 7.2);
          const hair = [0x1a1210, 0x3b2a1a, 0x7a5a30, 0x101010][(n + si) % 4];
          g.fillStyle(hair); g.slice(15, 12, 7.4, Math.PI * 1.05, Math.PI * 1.95, false); g.fillPath();
          g.generateTexture(key, W, H);
          g.destroy();
        }
        n++;
      }
    }
  }

  private buildStands(home: TeamDef) {
    const g = this.scene.add.graphics().setDepth(depthOf(-60));
    const base = 0x1d2130;
    const accent = mixColor(home.primary, 0x1d2130, 0.55);
    const quad = (pts: [number, number, number][], color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.beginPath();
      pts.forEach(([x, y, z], i) => {
        const p = project(x, y, z);
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      });
      g.closePath();
      g.fillPath();
    };
    const tiers = 7;
    // Back stands (behind the baseline), outermost first
    for (let i = tiers - 1; i >= 0; i--) {
      const y = -8.5 - i * 2.3;
      const z = 1 + i * 1.6;
      const zPrev = i === 0 ? 0 : 1 + (i - 1) * 1.6;
      quad([[-40, y - 2.3, z], [90, y - 2.3, z], [90, y, z], [-40, y, z]], lighten(base, 0.04 + i * 0.01));
      quad([[-40, y, zPrev], [90, y, zPrev], [90, y, z], [-40, y, z]], i % 2 ? accent : lighten(accent, -0.15));
    }
    // Side stands
    for (const side of [-1, 1]) {
      for (let i = tiers - 1; i >= 0; i--) {
        const x = side < 0 ? -8.5 - i * 2.3 : 58.5 + i * 2.3;
        const xo = x + side * 2.3;
        const z = 1 + i * 1.6;
        const zPrev = i === 0 ? 0 : 1 + (i - 1) * 1.6;
        quad([[xo, -8.5, z], [xo, 60, z], [x, 60, z], [x, -8.5, z]], lighten(base, 0.04 + i * 0.01));
        quad([[x, -8.5, zPrev], [x, 60, zPrev], [x, 60, z], [x, -8.5, z]], i % 2 ? accent : lighten(accent, -0.15));
      }
    }
    // Railing glow line at the front of the stands
    g.lineStyle(3, lighten(home.primary, 0.2), 0.6);
    const a = project(-40, -8.5, 1.05); const b = project(90, -8.5, 1.05);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }

  private buildCrowd(home: TeamDef, away: TeamDef) {
    const seats: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const y = -9.4 - i * 2.3;
      const z = 1 + i * 1.6;
      for (let x = -30; x < 80; x += 1.85) seats.push({ x: x + (Math.random() - 0.5) * 0.4, y, z });
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const x = side < 0 ? -9.4 - i * 2.3 : 59.4 + i * 2.3;
        const z = 1 + i * 1.6;
        for (let y = -7; y < 56; y += 1.85) seats.push({ x, y: y + (Math.random() - 0.5) * 0.4, z });
      }
    }
    // Draw far-to-near so nearer fans overlap farther ones
    seats.sort((a, b) => a.y - b.y || b.z - a.z);
    const homeShirts = [home.primary];
    for (const s of seats) {
      if (Math.random() < 0.1) continue; // empty seat
      const p = project(s.x, s.y, s.z);
      if (p.x < -40 || p.x > 1960 || p.y < -40 || p.y > 1120) continue;
      const supportsHome = Math.random() < 0.7;
      const r = Math.random();
      let shirt: number;
      if (supportsHome && r < 0.45) shirt = homeShirts[0];
      else if (!supportsHome && r < 0.4) shirt = away.primary;
      else shirt = FAN_SHIRTS[Math.floor(Math.random() * FAN_SHIRTS.length)];
      const si = Math.floor(Math.random() * 3);
      const sitTex = `fan_${shirt.toString(16)}_${si}_0`;
      const cheerTex = `fan_${shirt.toString(16)}_${si}_1`;
      const img = this.scene.add.image(p.x, p.y, sitTex).setOrigin(0.5, 0.92);
      const sc = (p.k / 22) * 0.78 * (0.92 + Math.random() * 0.16);
      img.setScale(sc);
      img.setDepth(depthOf(-58) + s.y * 0.01);
      // atmospheric dimming for farther rows
      const dim = Math.min(0.45, (s.z / 12) * 0.35);
      img.setTint(mixColor(0xffffff, 0x404660, dim));
      this.fans.push({ img, baseY: p.y, phase: Math.random() * 10, side: supportsHome ? 0 : 1, cheerTex, sitTex });
    }
  }

  private buildBoards(home: TeamDef, away: TeamDef) {
    const g = this.scene.add.graphics().setDepth(depthOf(-7));
    const y = -6.5;
    const a = project(-14, y, 0); const b = project(64, y, 2.4);
    g.fillStyle(0x0a0c12, 1);
    g.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
    g.lineStyle(2, 0x2a3350, 1);
    g.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y);
    const k = a.k;
    const messages = [
      { text: 'HARDWOOD HEAT', color: '#ffb547' },
      { text: `${home.city.toUpperCase()} ${home.name.toUpperCase()}`, color: '#' + lighten(home.primary, 0.35).toString(16).padStart(6, '0') },
      { text: '3 × 3 SERIES', color: '#7fe3ff' },
      { text: `${away.city.toUpperCase()} ${away.name.toUpperCase()}`, color: '#' + lighten(away.primary, 0.35).toString(16).padStart(6, '0') },
      { text: 'HARDWOOD HEAT', color: '#ffb547' },
    ];
    const segW = (b.x - a.x) / messages.length;
    messages.forEach((m, i) => {
      const t = this.scene.add.text(a.x + segW * (i + 0.5), (a.y + b.y) / 2, m.text, {
        fontFamily: 'Teko', fontSize: `${Math.round(k * 1.55)}px`, color: m.color, fontStyle: '600',
      }).setOrigin(0.5).setDepth(depthOf(-6.9));
      t.setShadow(0, 0, m.color, 10, false, true);
      if (i < messages.length - 1) {
        g.lineStyle(1, 0x2a3350, 1);
        g.lineBetween(a.x + segW * (i + 1), b.y + 4, a.x + segW * (i + 1), a.y - 4);
      }
    });
    // Side boards
    for (const x of [-5.5, 55.5]) {
      g.fillStyle(0x0a0c12, 1);
      g.beginPath();
      const pts = [project(x, -6.5, 0), project(x, 50, 0), project(x, 50, 2.4), project(x, -6.5, 2.4)];
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.closePath();
      g.fillPath();
      g.lineStyle(3, lighten(home.primary, 0.25), 0.8);
      const m0 = project(x, -6.5, 1.2); const m1 = project(x, 50, 1.2);
      g.lineBetween(m0.x, m0.y, m1.x, m1.y);
    }
  }

  // ------------------------------------------------------------- hoop

  private drawStanchion(home: TeamDef) {
    const g = this.hoopG;
    const B = COURT.BOARD;
    const P = (x: number, y: number, z: number) => project(x, y, z);
    const pad = home.secondary === 0xffffff ? 0x22252e : mixColor(home.secondary, 0x111111, 0.3);
    // Base pad
    const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, top: number, front: number) => {
      const f = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
      const t = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
      g.fillStyle(top, 1);
      g.beginPath(); g.moveTo(t[0].x, t[0].y); t.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.closePath(); g.fillPath();
      g.fillStyle(front, 1);
      g.beginPath(); g.moveTo(f[0].x, f[0].y); f.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.closePath(); g.fillPath();
    };
    box(22.6, 27.4, -9, -5.2, 0, 3.4, lighten(pad, 0.15), pad);
    // padding stripe
    const s0 = P(22.6, -5.2, 2.6); const s1 = P(27.4, -5.2, 2.6);
    g.lineStyle(4, home.primary, 1); g.lineBetween(s0.x, s0.y, s1.x, s1.y);
    // Pole + arm
    const pole0 = P(25, -6.8, 3.4); const pole1 = P(25, -6.8, 12.2);
    g.lineStyle(pole0.k * 0.75, 0x2b2f3a, 1); g.lineBetween(pole0.x, pole0.y, pole1.x, pole1.y);
    g.lineStyle(pole0.k * 0.35, 0x3d4352, 1); g.lineBetween(pole0.x - pole0.k * 0.15, pole0.y, pole1.x - pole0.k * 0.15, pole1.y);
    const arm0 = P(25, -6.8, 12.0); const arm1 = P(25, B.y - 0.3, 11.2);
    g.lineStyle(arm0.k * 0.5, 0x2b2f3a, 1); g.lineBetween(arm0.x, arm0.y, arm1.x, arm1.y);
    const brace0 = P(25, -6.8, 8.5);
    g.lineStyle(arm0.k * 0.3, 0x2b2f3a, 1); g.lineBetween(brace0.x, brace0.y, arm1.x, arm1.y);

    // Backboard glass
    const c = [P(B.x0, B.y, B.z0), P(B.x1, B.y, B.z0), P(B.x1, B.y, B.z1), P(B.x0, B.y, B.z1)];
    g.fillStyle(0xbfe3ff, 0.22);
    g.beginPath(); g.moveTo(c[0].x, c[0].y); c.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.closePath(); g.fillPath();
    // glass reflection streak
    g.fillStyle(0xffffff, 0.12);
    const r0 = P(B.x0 + 0.6, B.y, B.z1); const r1 = P(B.x0 + 1.6, B.y, B.z1); const r2 = P(B.x0 + 0.3, B.y, B.z0); const r3 = P(B.x0 - 0.0, B.y, B.z0);
    g.beginPath(); g.moveTo(r0.x, r0.y); g.lineTo(r1.x, r1.y); g.lineTo(r2.x, r2.y); g.lineTo(r3.x, r3.y); g.closePath(); g.fillPath();
    g.lineStyle(c[0].k * 0.17, 0xffffff, 0.95);
    g.strokeRect(c[3].x, c[3].y, c[1].x - c[3].x, c[1].y - c[3].y);
    // padding on the bottom edge
    g.lineStyle(c[0].k * 0.22, pad, 1);
    g.lineBetween(c[0].x, c[0].y, c[1].x, c[1].y);
    // shooter's square
    const q0 = P(23.75, B.y, 10.0); const q1 = P(26.25, B.y, 11.8);
    g.lineStyle(c[0].k * 0.11, 0xffffff, 0.9);
    g.strokeRect(q0.x, q1.y, q1.x - q0.x, q0.y - q1.y);
    // shot clock housing on top
    const sc0 = P(23.4, B.y - 0.2, B.z1 + 0.1); const sc1 = P(26.6, B.y - 0.2, B.z1 + 1.1);
    g.fillStyle(0x111318, 1); g.fillRect(sc0.x, sc1.y, sc1.x - sc0.x, sc0.y - sc1.y);
  }

  /** Called every frame: rim, net and crowd animation. */
  update(dt: number, time: number, shotClock: number | null) {
    // Rim springs
    this.rimDipV += (-120 * this.rimDip - 9 * this.rimDipV) * dt;
    this.rimDip += this.rimDipV * dt;
    for (const n of this.net) {
      n.vdrop += (-90 * n.drop - 7 * n.vdrop) * dt; n.drop += n.vdrop * dt;
      n.vsq += (-110 * n.sq - 8 * n.vsq) * dt; n.sq += n.vsq * dt;
      n.vsx += (-60 * n.sx - 5 * n.vsx) * dt; n.sx += n.vsx * dt;
      n.vsy += (-60 * n.sy - 5 * n.vsy) * dt; n.sy += n.vsy * dt;
    }
    this.drawRimAndNet(shotClock);

    // Crowd
    for (let s = 0; s < 2; s++) this.excitement[s] = Math.max(0, this.excitement[s] - dt * 0.35);
    for (const f of this.fans) {
      const e = this.excitement[f.side];
      const amp = 1.2 + e * 9;
      const bob = Math.max(0, Math.sin(time * (2 + e * 5) + f.phase)) * amp;
      f.img.y = f.baseY - bob;
      const cheering = e > 0.35 && Math.sin(f.phase * 7.3) > -0.2;
      const tex = cheering ? f.cheerTex : f.sitTex;
      if (f.img.texture.key !== tex) f.img.setTexture(tex);
    }

    // Camera flashes
    this.flashG.clear();
    this.flashes = this.flashes.filter((fl) => (fl.t -= dt) > 0);
    for (const fl of this.flashes) {
      this.flashG.fillStyle(0xffffff, Math.min(1, fl.t * 8));
      this.flashG.fillCircle(fl.x, fl.y, 4 + fl.t * 30);
    }
  }

  private drawRimAndNet(shotClock: number | null) {
    const H = COURT.HOOP;
    const N = 14;
    const rimZ = H.z - this.rimDip;
    const back = this.rimBackG; const front = this.rimFrontG; const net = this.netG;
    back.clear(); front.clear(); net.clear();
    const rimCol = 0xe2471b;
    const pts: { x: number; y: number; k: number; wy: number }[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const wx = H.x + Math.cos(a) * COURT.RIM_R;
      const wy = H.y + Math.sin(a) * COURT.RIM_R;
      const p = project(wx, wy, rimZ);
      pts.push({ x: p.x, y: p.y, k: p.k, wy });
    }
    // bracket to backboard
    const br0 = project(H.x, COURT.BOARD.y, rimZ - 0.1); const br1 = project(H.x, H.y - COURT.RIM_R, rimZ);
    back.lineStyle(br0.k * 0.22, 0xb83a17, 1); back.lineBetween(br0.x, br0.y, br1.x, br1.y);
    // Shot clock digits on the housing
    if (shotClock !== null) {
      const sc = project(25, COURT.BOARD.y - 0.25, COURT.BOARD.z1 + 0.6);
      back.fillStyle(shotClock <= 3 ? 0xff3b30 : 0xffb547, 1);
      drawDigits(back, String(Math.ceil(shotClock)).padStart(2, '0'), sc.x, sc.y, sc.k * 0.75);
    }
    for (let i = 0; i < 32; i++) {
      const a = pts[i]; const b = pts[i + 1];
      const g = a.wy < H.y ? back : front;
      g.lineStyle(a.k * 0.2, rimCol, 1);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    front.lineStyle(pts[0].k * 0.05, 0xff8a5c, 0.9);
    for (let i = 8; i < 24; i++) {
      const a = pts[i]; const b = pts[i + 1];
      if (a.wy >= H.y) front.lineBetween(a.x, a.y - a.k * 0.04, b.x, b.y - b.k * 0.04);
    }

    // Net lattice
    const levels = [
      { r: COURT.RIM_R, z: 0 },
      { r: COURT.RIM_R * 0.86, z: -0.7 },
      { r: COURT.RIM_R * 0.74, z: -1.4 },
      { r: COURT.RIM_R * 0.62, z: -2.05 },
    ];
    const ring = (l: number, i: number) => {
      const s = this.net[l];
      const lv = levels[l];
      const a = ((i + l * 0.5) / N) * Math.PI * 2;
      const r = lv.r * (1 - s.sq * 0.4);
      const wx = H.x + Math.cos(a) * r + s.sx * l * 0.25;
      const wy = H.y + Math.sin(a) * r + s.sy * l * 0.25;
      return project(wx, wy, rimZ + lv.z - s.drop * l * 0.35);
    };
    net.lineStyle(2, 0xffffff, 0.9);
    for (let l = 0; l < levels.length - 1; l++) {
      for (let i = 0; i < N; i++) {
        const a = ring(l, i);
        const b1 = ring(l + 1, i);
        const b0 = ring(l + 1, i - 1);
        net.lineBetween(a.x, a.y, b1.x, b1.y);
        net.lineBetween(a.x, a.y, b0.x, b0.y);
      }
    }
    // bottom ring
    net.lineStyle(1.2, 0xffffff, 0.6);
    for (let i = 0; i < N; i++) {
      const a = ring(3, i); const b = ring(3, i + 1);
      net.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  swish(strength: number, vx = 0, vy = 0) {
    for (let l = 1; l < 4; l++) {
      const n = this.net[l];
      n.vdrop += 9 * strength;
      n.vsq += 5 * strength;
      n.vsx += vx * 0.6;
      n.vsy += vy * 0.6;
    }
  }

  rimHit(strength: number) {
    this.rimDipV -= 6 * strength;
    for (let l = 1; l < 4; l++) { this.net[l].vsx += (Math.random() - 0.5) * 6 * strength; this.net[l].vsy += (Math.random() - 0.5) * 4 * strength; }
  }

  cheer(side: 0 | 1, amount: number) {
    this.excitement[side] = Math.min(1.4, this.excitement[side] + amount);
    this.excitement[1 - side] = Math.min(1.4, this.excitement[1 - side] + amount * 0.15);
    const n = Math.round(amount * 14);
    for (let i = 0; i < n; i++) {
      const f = this.fans[Math.floor(Math.random() * this.fans.length)];
      if (f) this.flashes.push({ x: f.img.x, y: f.img.y - 10, t: 0.12 + Math.random() * 0.1 });
    }
  }

  static zScale = Z_SCALE;
}

/** Simple LED-style digits for the shot clock. */
function drawDigits(g: Phaser.GameObjects.Graphics, text: string, cx: number, cy: number, h: number) {
  const SEGS: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd' };
  const S: Record<string, [number, number, number, number]> = {
    a: [0, 0, 1, 0], b: [1, 0, 1, 0.5], c: [1, 0.5, 1, 1], d: [0, 1, 1, 1], e: [0, 0.5, 0, 1], f: [0, 0, 0, 0.5], g: [0, 0.5, 1, 0.5],
  };
  const w = h * 0.5;
  const gap = h * 0.25;
  let x = cx - (text.length * w + (text.length - 1) * gap) / 2;
  const t = Math.max(1.5, h * 0.14);
  for (const ch of text) {
    for (const s of SEGS[ch] ?? '') {
      const [x0, y0, x1, y1] = S[s];
      g.fillRect(Math.min(x + x0 * w, x + x1 * w) - t / 2, cy - h / 2 + Math.min(y0, y1) * h - t / 2, Math.abs(x1 - x0) * w + t, Math.abs(y1 - y0) * h + t);
    }
    x += w + gap;
  }
}
