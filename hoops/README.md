# Hardwood Heat

A 3-on-3 half-court arcade basketball game that runs in the browser. Built with Phaser 3, TypeScript and Vite. All teams, players and branding are fictional, and every sound is synthesized at runtime, so the game has no asset files.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks, then writes a static build to `dist/` (open with `npm run preview`) |
| `npm run typecheck` | TypeScript only |
| `npm test` | Mechanics checks plus a 10-game AI-vs-AI simulation (headless, no browser) |

## Controls

| | Offense | Defense |
| --- | --- | --- |
| `WASD` / arrows | Move and dribble | Move |
| `Shift` | Sprint (uses stamina) | Sprint |
| `Space` | Hold, then release in the green zone to shoot. Near the rim it's a layup; sprint in for a dunk | Jump to contest or block |
| `E` | Pass toward your movement direction or the mouse | Swipe for a steal |
| `Q` | Switch to the player nearest the ball | Same |
| `Esc` / `P`, `M` | Pause, mute | |

## Rules

- Baskets inside the arc are worth 2 and baskets beyond it are worth 3. The clock is 1, 2 or 3 minutes, and a game tied at the buzzer goes to sudden death (next basket wins).
- The shot clock is 12 seconds and resets when the ball hits the rim.
- After a defensive rebound or a steal, the ball must be cleared beyond the arc before a basket counts.
- Whether a shot goes in depends on the shooter's rating, distance, how close and well-placed the defender is, how fast the shooter is moving, stamina, and release timing. A perfect release on an open look almost always drops.

## How it's built

```
src/
  config.ts            tuning: court geometry, physics, shot meter, difficulty levels
  core/projection.ts   perspective broadcast camera (world feet -> screen)
  sim/                 game simulation with no rendering (runs in node)
    Match.ts           rules, clocks, possession, shooting, passing, steals, blocks, stats
    Player.ts, Ball.ts movement, jumps, stamina, ball physics (floor, rim, backboard)
    shooting.ts        make-probability model
  ai/brain.ts          offense (drive / shoot / pass decisions, spacing, cuts), man defense, help, rebounding
  render/              court texture, arena and crowd, animated hoop and net, character rig, effects
  scenes/GameScene.ts  wires the sim to rendering, input and audio
  audio/               Web Audio synthesized sound effects and crowd ambience
  ui/                  HTML/CSS menus, team select, HUD, pause and results screens
scripts/               headless tests (usertest = mechanics, simtest = full games)
```

Notes on the design:

- **The simulation is independent of rendering.** `Match` only knows about world coordinates. Because of that, the headless tests run real games in node, and the same `Match` drives the attract-mode demo behind the main menu.
- **The court is drawn once, in perspective.** It is painted flat in world space (planks, wood grain, lines, paint), then warped row by row into the camera view. This is exact, because each world row maps to one screen row. Lighting and gloss are added on top.
- **Players are drawn as a 3D-posed rig.** Joints are posed in each player's local frame (run cycle, defensive stance, dribble, jumper, layup, dunk, contest, reach), projected to the screen, depth-sorted, and drawn with an outline. Animation therefore works from any facing direction, and the floor reflections use the same pose mirrored below the floor.
- **The simulation runs on real elapsed time in fixed 1/60 s slices.** A low frame rate drops frames instead of slowing the game down.

## Extending

Teams and ratings are in `src/data/teams.ts`. Difficulty levels are in `DIFFICULTY` in `src/config.ts`. The sim already records per-player box-score stats. `Match` takes a plain config object, so a season or franchise layer can create matches and read back `match.players[i].stats` without touching gameplay code.
