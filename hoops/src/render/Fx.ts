import Phaser from 'phaser';
import { PHYS, SHOT } from '../config';
import { project, Z_SCALE } from '../core/projection';
import type { Ball } from '../sim/Ball';
import type { Player } from '../sim/Player';
import { depthOf } from './Arena';

const BALL_COL = 0xe8742c;

/** Ball, trail, shadow, floating text, rings and particles. */
export class Fx {
  private scene: Phaser.Scene;
  private ballG: Phaser.GameObjects.Graphics;
  private trailG: Phaser.GameObjects.Graphics;
  private ringG: Phaser.GameObjects.Graphics;
  private trail: { x: number; y: number; r: number }[] = [];
  private rings: { x: number; y: number; r: number; t: number; color: number; life: number }[] = [];
  private confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.makeTextures();
    this.trailG = scene.add.graphics();
    this.ballG = scene.add.graphics();
    this.ringG = scene.add.graphics().setDepth(5000);
    this.confetti = scene.add.particles(0, 0, 'fx_confetti', {
      speed: { min: 180, max: 520 }, angle: { min: 200, max: 340 }, gravityY: 700, lifespan: { min: 900, max: 1500 },
      rotate: { start: 0, end: 540 }, scale: { start: 1, end: 0.6 }, alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(4000);
    this.sparks = scene.add.particles(0, 0, 'fx_spark', {
      speed: { min: 120, max: 420 }, lifespan: 420, scale: { start: 0.9, end: 0 }, blendMode: 'ADD', emitting: false,
    }).setDepth(4001);
    this.dust = scene.add.particles(0, 0, 'fx_dust', {
      speed: { min: 20, max: 90 }, angle: { min: 180, max: 360 }, lifespan: 500, scale: { start: 0.6, end: 1.4 },
      alpha: { start: 0.35, end: 0 }, emitting: false,
    }).setDepth(depthOf(-1));
  }

  private makeTextures() {
    const t = this.scene.textures;
    if (!t.exists('fx_spark')) {
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8);
      g.generateTexture('fx_spark', 16, 16); g.destroy();
    }
    if (!t.exists('fx_confetti')) {
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 10, 6);
      g.generateTexture('fx_confetti', 10, 6); g.destroy();
    }
    if (!t.exists('fx_dust')) {
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(0xd8c7a8, 0.6); g.fillCircle(10, 10, 10);
      g.generateTexture('fx_dust', 20, 20); g.destroy();
    }
  }

  drawBall(ball: Ball, shadowG: Phaser.GameObjects.Graphics, reflectG: Phaser.GameObjects.Graphics, holderDepth: number | null) {
    const g = this.ballG;
    g.clear();
    const p = project(ball.x, ball.y, ball.z);
    const r = PHYS.BALL_R * p.k * 1.25;

    // depth: in front of the holder when dribbling on their near side
    let depth = depthOf(ball.y) + 0.5;
    if (holderDepth !== null) depth = Math.max(depth, holderDepth + 0.2);
    g.setDepth(depth);
    this.trailG.setDepth(depth - 0.1);

    // shadow
    const sp = project(ball.x + 0.2, ball.y - 0.2, 0);
    const lift = Math.max(0, ball.z - PHYS.BALL_R);
    const sh = 1 / (1 + lift * 0.12);
    shadowG.fillStyle(0x000000, 0.35 * sh);
    shadowG.fillEllipse(sp.x, sp.y, r * 2.1 * sh, r * 2.1 * Z_SCALE * 0.75 * sh);

    // reflection on the glossy floor
    const rp = project(ball.x, ball.y, -ball.z);
    reflectG.fillStyle(BALL_COL, 0.18 * sh);
    reflectG.fillCircle(rp.x, rp.y, r);

    // body
    g.fillStyle(0x2a140a, 1);
    g.fillCircle(p.x, p.y, r + 1.6);
    g.fillStyle(0xb9521c, 1);
    g.fillCircle(p.x, p.y, r);
    g.fillStyle(BALL_COL, 1);
    g.fillCircle(p.x - r * 0.12, p.y - r * 0.12, r * 0.86);
    // seams (rotate with spin): one straight seam and two curved ones, all inside the ball
    const a = ball.spin;
    const dx = Math.cos(a); const dy = Math.sin(a);
    const nx = -dy; const ny = dx;
    g.lineStyle(Math.max(1, r * 0.11), 0x3a1a0a, 0.85);
    g.lineBetween(p.x - dx * r, p.y - dy * r, p.x + dx * r, p.y + dy * r);
    for (const bulge of [0.62, -0.62]) {
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const t = -1 + i / 5;
        const off = bulge * (1 - t * t);
        const px = p.x + (nx * t + dx * off) * r * 0.97;
        const py = p.y + (ny * t + dy * off) * r * 0.97;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();
    }
    // highlight
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(p.x - r * 0.38, p.y - r * 0.42, r * 0.55, r * 0.35);

    // trail while in flight
    const flying = ball.state === 'shot' || ball.state === 'pass';
    this.trail.unshift({ x: p.x, y: p.y, r });
    if (this.trail.length > 12) this.trail.pop();
    this.trailG.clear();
    if (flying) {
      for (let i = 1; i < this.trail.length; i++) {
        const t = this.trail[i];
        const al = (1 - i / this.trail.length) * 0.35;
        this.trailG.fillStyle(ball.state === 'shot' ? 0xffd08a : 0xffffff, al);
        this.trailG.fillCircle(t.x, t.y, t.r * (1 - i / 16));
      }
    } else if (this.trail.length > 2) {
      this.trail.length = 2;
    }
  }

  ring(wx: number, wy: number, wz: number, color: number, maxR = 60, life = 0.45) {
    const p = project(wx, wy, wz);
    this.rings.push({ x: p.x, y: p.y, r: maxR, t: 0, color, life });
  }

  updateRings(dt: number) {
    const g = this.ringG;
    g.clear();
    this.rings = this.rings.filter((r) => (r.t += dt) < r.life);
    for (const r of this.rings) {
      const u = r.t / r.life;
      g.lineStyle(6 * (1 - u) + 1, r.color, 1 - u);
      g.strokeCircle(r.x, r.y, r.r * (0.2 + u * 0.8));
    }
  }

  burst(wx: number, wy: number, wz: number, colors: number[], count = 40) {
    const p = project(wx, wy, wz);
    this.confetti.setParticleTint(colors[0]);
    for (const c of colors) {
      this.confetti.setParticleTint(c);
      this.confetti.explode(Math.round(count / colors.length), p.x, p.y);
    }
  }

  spark(wx: number, wy: number, wz: number, color: number, count = 14) {
    const p = project(wx, wy, wz);
    this.sparks.setParticleTint(color);
    this.sparks.explode(count, p.x, p.y);
  }

  dustAt(wx: number, wy: number, count = 6) {
    const p = project(wx, wy, 0);
    this.dust.explode(count, p.x, p.y);
  }

  /** Floating text that rises and fades (world-anchored). */
  popText(wx: number, wy: number, wz: number, text: string, color: string, size = 56, rise = 90, hold = 650) {
    const p = project(wx, wy, wz);
    const t = this.scene.add.text(p.x, p.y, text, {
      fontFamily: 'Teko', fontSize: `${size}px`, color, fontStyle: '700',
      stroke: '#120d16', strokeThickness: Math.round(size / 7),
    }).setOrigin(0.5).setDepth(6000).setScale(0.4);
    t.setShadow(0, 4, 'rgba(0,0,0,0.5)', 8, true, true);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: t, y: p.y - rise, alpha: 0, delay: hold, duration: 600, ease: 'Cubic.In',
      onComplete: () => t.destroy(),
    });
  }

  /** Shot meter next to the shooter. */
  drawMeter(g: Phaser.GameObjects.Graphics, p: Player, frozenValue: number | null, frozenColor: number) {
    const base = project(p.x, p.y, p.z + p.def.height * 0.75);
    const h = 92;
    const w = 13;
    const x = base.x + base.k * 1.5;
    const y = base.y - h / 2;
    const v = Math.min(1.12, frozenValue ?? p.charge);
    const toY = (m: number) => y + h - (m / SHOT.AUTO_RELEASE) * h;
    g.fillStyle(0x0b0d14, 0.85);
    g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 5);
    // windows
    g.fillStyle(0x2f6b3a, 0.9);
    g.fillRect(x, toY(SHOT.PERFECT + SHOT.GOOD_WINDOW), w, toY(SHOT.PERFECT - SHOT.GOOD_WINDOW) - toY(SHOT.PERFECT + SHOT.GOOD_WINDOW));
    g.fillStyle(0x5cff7a, 1);
    g.fillRect(x, toY(SHOT.PERFECT + SHOT.PERFECT_WINDOW), w, toY(SHOT.PERFECT - SHOT.PERFECT_WINDOW) - toY(SHOT.PERFECT + SHOT.PERFECT_WINDOW));
    // fill
    const col = frozenValue !== null ? frozenColor : v > SHOT.PERFECT + SHOT.GOOD_WINDOW ? 0xff5a3c : 0xffd24a;
    g.fillStyle(col, frozenValue !== null ? 1 : 0.85);
    g.fillRect(x + 3, toY(v), w - 6, y + h - toY(v));
    g.lineStyle(3, 0xffffff, 1);
    g.lineBetween(x - 4, toY(v), x + w + 4, toY(v));
  }
}
