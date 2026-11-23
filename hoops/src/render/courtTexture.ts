import { COURT, VIEW } from '../config';
import { hex, lighten, mixColor } from '../core/math';
import { project, screenYOfGround, unproject } from '../core/projection';
import type { TeamDef } from '../data/teams';

/**
 * Builds the floor as a flat top-down image in world space, then warps it row
 * by row into the perspective view. Because the projection maps each world
 * row (constant y) onto a single screen row with linear x, the warp is exact.
 */

const X0 = -20;
const X1 = 70;
const Y0 = -16;
const Y1 = 50;
const PX = 26; // source px per foot (x)
const PY = 20; // source px per foot (y)

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildCourtCanvas(home: TeamDef): HTMLCanvasElement {
  const flat = document.createElement('canvas');
  flat.width = Math.round((X1 - X0) * PX);
  flat.height = Math.round((Y1 - Y0) * PY);
  const c = flat.getContext('2d')!;
  c.setTransform(PX, 0, 0, PY, -X0 * PX, -Y0 * PY); // draw in feet

  const rnd = seeded(1337);

  // Arena floor beyond the apron
  c.fillStyle = '#15171d';
  c.fillRect(X0, Y0, X1 - X0, Y1 - Y0);

  // Apron in the home team's dark colour
  const apron = mixColor(home.secondary, 0x101015, 0.35);
  c.fillStyle = hex(apron);
  c.fillRect(-6, -6, 62, 60);

  // ----- Wood planks (run lengthwise, along y)
  const plankW = 0.62;
  const woodBase = [0xd59a5c, 0xcf9455, 0xdba467, 0xc98d50, 0xd8a062, 0xe0aa6d];
  for (let x = 0; x < COURT.W; x += plankW) {
    let y = -0.0 - rnd() * 6;
    while (y < Y1) {
      const len = 3 + rnd() * 8;
      const base = woodBase[Math.floor(rnd() * woodBase.length)];
      const tint = lighten(base, (rnd() - 0.5) * 0.12);
      c.fillStyle = hex(tint);
      const ys = Math.max(0, y);
      c.fillRect(x, ys, plankW, Math.min(y + len, Y1) - ys);
      // grain
      c.lineWidth = 0.025;
      for (let gi = 0; gi < 3; gi++) {
        c.strokeStyle = `rgba(110,60,25,${0.07 + rnd() * 0.08})`;
        c.beginPath();
        const gx = x + 0.1 + rnd() * (plankW - 0.2);
        c.moveTo(gx, ys);
        for (let gy = ys; gy < Math.min(y + len, Y1); gy += 0.8) c.lineTo(gx + Math.sin(gy * 1.3 + gi) * 0.05, gy);
        c.stroke();
      }
      // occasional knot
      if (rnd() < 0.05) {
        c.fillStyle = 'rgba(120,70,30,0.18)';
        c.beginPath();
        c.ellipse(x + plankW / 2, ys + len / 2, 0.12, 0.35, 0, 0, Math.PI * 2);
        c.fill();
      }
      // seam
      c.fillStyle = 'rgba(90,50,20,0.35)';
      c.fillRect(x, Math.max(0, y + len) - 0.02, plankW, 0.04);
      y += len;
    }
    c.fillStyle = 'rgba(80,45,18,0.28)';
    c.fillRect(x, 0, 0.03, Y1);
  }

  // Two-tone stain inside the arc
  c.save();
  c.beginPath();
  arcPath(c);
  c.closePath();
  c.fillStyle = 'rgba(120,60,20,0.08)';
  c.fill();
  c.restore();

  // ----- Key paint
  c.fillStyle = hex(home.paint);
  c.globalAlpha = 0.92;
  c.fillRect(COURT.KEY.x0, 0, COURT.KEY.x1 - COURT.KEY.x0, COURT.KEY.y1);
  c.globalAlpha = 1;
  // subtle sheen across the paint
  const g = c.createLinearGradient(COURT.KEY.x0, 0, COURT.KEY.x1, COURT.KEY.y1);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.10)');
  c.fillStyle = g;
  c.fillRect(COURT.KEY.x0, 0, COURT.KEY.x1 - COURT.KEY.x0, COURT.KEY.y1);

  // ----- Center court logo (half visible at the bottom of the screen)
  c.save();
  c.beginPath();
  c.arc(25, COURT.L, COURT.CENTER_R, 0, Math.PI * 2);
  c.fillStyle = hex(home.primary);
  c.fill();
  c.beginPath();
  c.arc(25, COURT.L, COURT.CENTER_R - 1.1, 0, Math.PI * 2);
  c.fillStyle = hex(lighten(home.primary, -0.25));
  c.fill();
  c.restore();

  // ----- Floor wordmark between the arc and half court
  drawFloorText(c, home.name.toUpperCase(), 25, 39.6, 7.5, 'rgba(255,255,255,0.16)', 900);

  // ----- Lines
  c.strokeStyle = '#f7f3ea';
  c.lineWidth = 0.19;
  c.lineCap = 'butt';
  c.strokeRect(0, 0, COURT.W, COURT.L);
  c.beginPath(); c.moveTo(0, COURT.L); c.lineTo(COURT.W, COURT.L); c.stroke();
  c.beginPath(); arcPath(c); c.stroke();
  c.strokeRect(COURT.KEY.x0, 0, COURT.KEY.x1 - COURT.KEY.x0, COURT.KEY.y1);
  // Free throw circle: solid top, dashed bottom
  c.beginPath(); c.arc(25, COURT.KEY.y1, COURT.FT_R, 0, Math.PI); c.stroke();
  c.setLineDash([0.9, 0.75]);
  c.beginPath(); c.arc(25, COURT.KEY.y1, COURT.FT_R, Math.PI, Math.PI * 2); c.stroke();
  c.setLineDash([]);
  // Restricted area
  c.beginPath(); c.arc(25, COURT.HOOP.y, COURT.RESTRICTED_R, 0, Math.PI); c.stroke();
  c.beginPath(); c.moveTo(21, COURT.HOOP.y); c.lineTo(21, 4); c.moveTo(29, COURT.HOOP.y); c.lineTo(29, 4); c.stroke();
  // Lane hashes
  for (const hy of [7, 8, 11, 14, 17]) {
    c.beginPath();
    c.moveTo(COURT.KEY.x0 - 0.6, hy); c.lineTo(COURT.KEY.x0, hy);
    c.moveTo(COURT.KEY.x1, hy); c.lineTo(COURT.KEY.x1 + 0.6, hy);
    c.stroke();
  }
  // Center circle
  c.beginPath(); c.arc(25, COURT.L, COURT.CENTER_R, Math.PI, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(25, COURT.L, 2, Math.PI, Math.PI * 2); c.stroke();
  // Hash marks on the sidelines
  c.beginPath(); c.moveTo(0, 28); c.lineTo(3, 28); c.moveTo(50, 28); c.lineTo(47, 28); c.stroke();

  // Sideline apron strips
  c.fillStyle = hex(lighten(apron, 0.12));
  c.fillRect(-6, -6, 62, 0.25);

  // ----- Warp into perspective
  const out = document.createElement('canvas');
  out.width = VIEW.W;
  out.height = VIEW.H;
  const o = out.getContext('2d')!;
  const bg = o.createLinearGradient(0, 0, 0, VIEW.H);
  bg.addColorStop(0, '#07080c');
  bg.addColorStop(1, '#11131a');
  o.fillStyle = bg;
  o.fillRect(0, 0, VIEW.W, VIEW.H);
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';
  const top = Math.max(0, Math.floor(screenYOfGround(Y0)));
  for (let sy = top; sy < VIEW.H; sy++) {
    const w = unproject(VIEW.W / 2, sy + 0.5);
    if (w.y < Y0 || w.y > Y1) continue;
    const srcRow = (w.y - Y0) * PY;
    const a = project(X0, w.y);
    const b = project(X1, w.y);
    o.drawImage(flat, 0, Math.min(flat.height - 1, Math.floor(srcRow)), flat.width, 1, a.x, sy, b.x - a.x, 1.02);
  }

  // ----- Lighting: soft arena light pools and a vignette
  o.globalCompositeOperation = 'lighter';
  const pools: [number, number, number, number][] = [
    [25, 12, 520, 0.10],
    [25, 32, 640, 0.07],
    [8, 26, 380, 0.04],
    [42, 26, 380, 0.04],
  ];
  for (const [wx, wy, r, a] of pools) {
    const p = project(wx, wy);
    const rg = o.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    rg.addColorStop(0, `rgba(255,236,200,${a})`);
    rg.addColorStop(1, 'rgba(255,236,200,0)');
    o.fillStyle = rg;
    o.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  // Glossy streak reflections of the ceiling lights
  for (const wx of [12, 25, 38]) {
    const p = project(wx, 26);
    const lg = o.createLinearGradient(p.x - 40, 0, p.x + 40, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,250,235,0.045)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    o.fillStyle = lg;
    const t = project(wx, 2);
    o.beginPath();
    o.moveTo(t.x - 18, t.y); o.lineTo(t.x + 18, t.y); o.lineTo(p.x + 60, VIEW.H); o.lineTo(p.x - 60, VIEW.H);
    o.fill();
  }
  o.globalCompositeOperation = 'source-over';
  const vg = o.createRadialGradient(VIEW.W / 2, VIEW.H * 0.55, VIEW.H * 0.35, VIEW.W / 2, VIEW.H * 0.55, VIEW.W * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  o.fillStyle = vg;
  o.fillRect(0, 0, VIEW.W, VIEW.H);
  return out;
}

function arcPath(c: CanvasRenderingContext2D) {
  const H = COURT.HOOP;
  const a0 = Math.atan2(COURT.CORNER_Y - H.y, COURT.W - COURT.CORNER_X - H.x);
  const a1 = Math.atan2(COURT.CORNER_Y - H.y, COURT.CORNER_X - H.x);
  c.moveTo(COURT.W - COURT.CORNER_X, 0);
  c.lineTo(COURT.W - COURT.CORNER_X, COURT.CORNER_Y);
  c.arc(H.x, H.y, COURT.THREE_R, a0, a1);
  c.lineTo(COURT.CORNER_X, 0);
}

/** Text laid flat on the floor in world units (rendered upright from the camera's view). */
function drawFloorText(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight: number) {
  c.save();
  c.translate(x, y);
  // The perspective warp later compresses y; pre-stretch so letters look upright.
  c.scale(1, PX / PY * 0.95);
  c.font = `italic ${weight} ${size}px Teko, Impact, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(text, 0, 0);
  c.restore();
}
