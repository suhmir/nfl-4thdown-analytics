// Headless AI-vs-AI simulation to sanity-check rules, scoring rates and stuck states.
import { Match, NO_INPUT } from '../src/sim/Match';
import { TEAMS } from '../src/data/teams';

const games = Number(process.argv[2] ?? 20);
let totals = { pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, stl: 0, blk: 0, tov: 0, reb: 0, ast: 0, ot: 0 };
const ev: Record<string, number> = {};
let unfinished = 0;
for (let g = 0; g < games; g++) {
  const m = new Match({ teams: [TEAMS[g % 6], TEAMS[(g + 1) % 6]], userSide: null, starIndex: 0, difficulty: 'pro', gameTime: 120 });
  for (const k of ['score','steal','block','turnover','rebound','pass','miss'] as const) m.ev.on(k, () => { ev[k] = (ev[k] ?? 0) + 1; });
  m.ev.on('turnover', (t: any) => { ev['to:' + t.reason] = (ev['to:' + t.reason] ?? 0) + 1; });
  m.ev.on('banner', (b: any) => { ev['banner:' + b.text] = (ev['banner:' + b.text] ?? 0) + 1; });
  let t = 0; let stuck = 0; let lastScoreT = 0; const lastScore = [0, 0];
  while (m.phase !== 'over' && t < 900) {
    m.update(1 / 60, NO_INPUT);
    t += 1 / 60;
    if (m.score[0] !== lastScore[0] || m.score[1] !== lastScore[1]) { lastScore[0] = m.score[0]; lastScore[1] = m.score[1]; lastScoreT = t; }
    if (t - lastScoreT > 60) { stuck++; lastScoreT = t; console.log('no score for 60s', m.phase, m.ball.state, m.ball.x.toFixed(1), m.ball.y.toFixed(1), m.ball.z.toFixed(1)); }
    for (const p of m.players) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('NaN player');
    if (!Number.isFinite(m.ball.x)) throw new Error('NaN ball');
  }
  if (m.phase !== 'over') unfinished++;
  if (m.overtime) totals.ot++;
  for (const p of m.players) { totals.pts += p.stats.pts; totals.fga += p.stats.fga; totals.fgm += p.stats.fgm; totals.tpa += p.stats.tpa; totals.tpm += p.stats.tpm; totals.stl += p.stats.stl; totals.blk += p.stats.blk; totals.tov += p.stats.tov; totals.reb += p.stats.reb; totals.ast += p.stats.ast; }
  console.log(`G${g}: ${m.cfg.teams[0].abbr} ${m.score[0]} - ${m.score[1]} ${m.cfg.teams[1].abbr} ${m.overtime ? '(OT)' : ''} t=${t.toFixed(0)}s phase=${m.phase}`);
}
const per = (v: number) => (v / games).toFixed(1);
console.log('per game:', Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, per(v)])));
console.log('FG%', (totals.fgm / totals.fga * 100).toFixed(1), '3P%', (totals.tpm / Math.max(1, totals.tpa) * 100).toFixed(1));
console.log('events/game', Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, per(v)])));
if (unfinished) { console.log(`FAIL: ${unfinished} game(s) never finished`); process.exit(1); }
console.log('SIM OK: every game finished with a winner and no invalid state');
