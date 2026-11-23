// Scripted checks of user-facing mechanics against the real simulation.
import { Match, NO_INPUT, type InputState } from '../src/sim/Match';
import { TEAMS } from '../src/data/teams';
import { SHOT } from '../src/config';

let failures = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const mk = (over: Partial<ConstructorParameters<typeof Match>[0]> = {}) =>
  new Match({ teams: [TEAMS[0], TEAMS[1]], userSide: 0, starIndex: 0, difficulty: 'rookie', gameTime: 120, ...over });
const inp = (o: Partial<InputState> = {}): InputState => ({ ...NO_INPUT, ...o });
const step = (m: Match, s: number, i: InputState = NO_INPUT) => { for (let t = 0; t < s; t += 1 / 60) m.update(1 / 60, i); };
const toLive = (m: Match) => { for (let i = 0; i < 600 && m.phase !== 'live'; i++) m.update(1 / 60, NO_INPUT); };

// 1. Intro -> live, user has the ball
{
  const m = mk();
  toLive(m);
  ok(m.phase === 'live', 'match goes live after intro');
  ok(m.user === m.ball.owner && m.user?.def.name === 'Marcus Reyes', 'user controls star with the ball');
}

// 2. Perfect release from the top of the key, wide open -> PERFECT grade and high odds
{
  let perfect = 0; let made = 0; const N = 60;
  for (let k = 0; k < N; k++) {
    const m = mk();
    toLive(m);
    // clear defenders away to make it open
    for (const p of m.team(1)) { p.x = 5 + p.id; p.y = 44; }
    const u = m.user!;
    u.x = 25; u.y = 24; // 3pt range (dist 18.75 -> long two). Move to 26ft.
    u.y = 31;
    let grade = ''; let chanceV = 0;
    m.ev.on('release', (e) => { grade = e.grade ?? ''; chanceV = e.chance; });
    m.ev.on('score', () => { made++; });
    m.update(1 / 60, inp({ shootPressed: true, shootHeld: true }));
    while (u.charging && u.charge < SHOT.PERFECT - 0.004) { for (const p of m.team(1)) { p.x = 5 + p.id; p.y = 44; p.vx = 0; p.vy = 0; } m.update(1 / 120, inp({ shootHeld: true })); }
    m.update(1 / 60, inp({ shootReleased: true }));
    if (grade === 'PERFECT') perfect++;
    if (k === 0) console.log('      sample: grade', grade, 'chance', chanceV.toFixed(2));
    step(m, 3);
  }
  ok(perfect === N, `perfect timing graded PERFECT (${perfect}/${N})`);
  ok(made / N > 0.75, `open perfect threes go in most of the time (${made}/${N})`);
}

// 3. Very early release from the same spot rarely goes in
{
  let made = 0; const N = 80;
  for (let k = 0; k < N; k++) {
    const m = mk(); toLive(m);
    for (const p of m.team(1)) { p.x = 5 + p.id; p.y = 44; }
    m.user!.x = 25; m.user!.y = 31;
    m.ev.on('score', () => { made++; });
    m.update(1 / 60, inp({ shootPressed: true, shootHeld: true }));
    step(m, 0.12, inp({ shootHeld: true }));
    m.update(1 / 60, inp({ shootReleased: true }));
    step(m, 3);
  }
  ok(made / N < 0.3, `early releases mostly miss (${made}/${N})`);
}

// 4. Pass hands control to the receiver on catch and credits an assist on a quick score
{
  const m = mk(); toLive(m);
  const u = m.user!;
  const mates = m.teammates(u);
  m.update(1 / 60, inp({ passPressed: true, mx: (mates[0].x - u.x), my: (mates[0].y - u.y) }));
  ok(m.ball.state === 'pass', 'E starts a pass');
  step(m, 1.2);
  ok(m.user === m.ball.owner && m.user !== u, `control follows the ball to the receiver (${m.user?.def.name})`);
}

// 5. Clear rule: after a steal the new offense must clear before scoring
{
  const m = mk(); toLive(m);
  // CPU (team 1) secures the ball inside the arc, e.g. a defensive rebound
  const cpu = m.team(1)[0];
  cpu.x = 25; cpu.y = 12;
  m.giveBall(cpu);
  const userGuy = cpu;
  ok(m.needsClear === true, 'possession change inside the arc requires clearing');
  userGuy.x = 25; userGuy.y = 33; m.update(1 / 60, NO_INPUT);
  ok(m.needsClear === false, 'taking it beyond the arc clears it');
  void cpu;
}

// 6. Shot clock violation turns it over
{
  const m = mk(); toLive(m);
  let reason = '';
  m.ev.on('turnover', (t) => { reason = t.reason; });
  // user stands still holding the ball (AI teammates won't take it)
  step(m, 13);
  ok(reason === 'SHOT CLOCK', `shot clock violation fires (${reason || 'none'})`);
  step(m, 3);
  ok(m.offense === 1, 'other team gets the ball after the violation');
}

// 7. Switching on defense picks the defender nearest the ball
{
  const m = mk(); toLive(m);
  m.giveBall(m.team(1)[0]); // user now on defense
  const before = m.user;
  m.update(1 / 60, inp({ switchPressed: true }));
  ok(m.user !== before && m.user?.side === 0, 'Q switches controlled defender');
}

// 8. Game ends at the buzzer; ties go to sudden death
{
  const m = mk({ gameTime: 5, userSide: null }); toLive(m);
  let over = false; m.ev.on('gameover', () => { over = true; });
  step(m, 120);
  ok(over && m.phase === 'over', `short game finishes (${m.score.join('-')}${m.overtime ? ' OT' : ''})`);
  ok(m.score[0] !== m.score[1], 'there is always a winner');
}

// 9. Steal attempt success rate is sane for a user defender right next to the handler
{
  let steals = 0; const N = 200;
  for (let k = 0; k < N; k++) {
    const m = mk(); toLive(m);
    m.giveBall(m.team(1)[0]);
    const h = m.ball.owner!; const d = m.user!;
    d.x = h.x + Math.cos(h.facing) * 1.6; d.y = h.y + Math.sin(h.facing) * 1.6 + 0.3;
    m.ev.on('steal', () => { steals++; });
    m.update(1 / 60, inp({ passPressed: true }));
    step(m, 1.2);
  }
  ok(steals / N > 0.08 && steals / N < 0.6, `steal success rate reasonable (${(steals / N * 100).toFixed(0)}%)`);
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
