import { Match, NO_INPUT } from '../src/sim/Match';
import { TEAMS } from '../src/data/teams';
const rows: { c: number; three: boolean; q: number; d: number; made?: boolean; res?: string }[] = [];
for (let g = 0; g < 10; g++) {
  const m = new Match({ teams: [TEAMS[g % 6], TEAMS[(g + 2) % 6]], userSide: null, starIndex: 0, difficulty: 'pro', gameTime: 120 });
  let cur: any = null;
  m.ev.on('release', (e) => { cur = { c: e.chance, three: e.three, q: e.q, d: e.p.distToHoop() }; rows.push(cur); setTimeout; });
  m.ev.on('score', () => { if (cur) cur.made = true; });
  let t = 0;
  while (m.phase !== 'over' && t < 600) {
    m.update(1 / 60, NO_INPUT); t += 1 / 60;
    if (cur && m.ball.shot && cur.res === undefined) cur.res = m.ball.shot.result;
  }
}
const avg = (a: number[]) => (a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)).toFixed(3);
const bins: Record<string, typeof rows> = {};
for (const r of rows) { const k = r.d < 6 ? 'rim' : r.three ? 'three' : 'mid'; (bins[k] ??= []).push(r); }
for (const [k, rs] of Object.entries(bins)) console.log(k, rs.length, 'expected', avg(rs.map(r => r.c)), 'actual', avg(rs.map(r => r.made ? 1 : 0)), 'q', avg(rs.map(r => r.q)), 'dist', avg(rs.map(r=>r.d)));
const res: Record<string, number> = {}; for (const r of rows) res[r.res ?? '?'] = (res[r.res ?? '?'] ?? 0) + 1; console.log(res);
