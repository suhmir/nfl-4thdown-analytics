import type Phaser from 'phaser';
import { DIFFICULTY, RULES, type Difficulty } from '../config';
import { hex, lighten } from '../core/math';
import { playerOverall, teamOverall, TEAMS, type TeamDef } from '../data/teams';
import { Sound } from '../audio/AudioManager';
import type { GameScene } from '../scenes/GameScene';
import type { Match, MatchConfig, MatchEvents } from '../sim/Match';
import type { Player } from '../sim/Player';
import { bridge } from './bridge';
import { BALL_ICON, teamLogo } from './logos';

type Screen = 'title' | 'setup' | 'settings' | 'controls' | 'game' | 'paused' | 'results';

const PREFS_KEY = 'hardwood-heat:prefs';

interface Prefs { home: number; away: number; star: number; difficulty: Difficulty; time: number; shake: boolean; hints: boolean }

function loadPrefs(): Prefs {
  const d: Prefs = { home: 0, away: 1, star: 0, difficulty: 'pro', time: RULES.DEFAULT_GAME_TIME, shake: true, hints: true };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...d, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch { /* ignore */ }
  return d;
}

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

const SPEAKER_ON = `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const PAUSE_ICON = `<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>`;

export class UI {
  private root: HTMLElement;
  private game: Phaser.Game;
  private screen: Screen = 'title';
  private prefs = loadPrefs();
  private lastFrame: Record<string, string> = {};
  private bannerTimer = 0;
  private resultsTimer = 0;
  private returnTo: Screen = 'title';
  private currentCfg: MatchConfig | null = null;

  constructor(root: HTMLElement, game: Phaser.Game) {
    this.root = root;
    this.game = game;
    bridge.settings.shake = this.prefs.shake;
    bridge.settings.hints = this.prefs.hints;
    this.root.innerHTML = this.template();
    this.bind();
    bridge.hooks = {
      onFrame: (m, demo) => this.onFrame(m, demo),
      onEvent: (n, p, m, demo) => this.onEvent(n, p, m, demo),
      onMatchStart: (m, demo) => this.onMatchStart(m, demo),
    };
    this.show('title');
    this.updateMuteButtons();
  }

  private get scene(): GameScene | null {
    return (this.game.scene.getScene('Game') as unknown as GameScene | null) ?? null;
  }

  private savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs)); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- markup

  private template(): string {
    return `
    <div class="vignette"></div>

    <section class="screen title-screen" data-screen="title">
      <div class="title-left">
        <div class="logo-lockup">
          <div class="logo-ball">${BALL_ICON}</div>
          <h1 class="game-logo"><span>HARDWOOD</span><span class="heat">HEAT</span></h1>
          <div class="tagline">3-ON-3 ARCADE BASKETBALL</div>
        </div>
        <nav class="menu" aria-label="Main menu">
          <button class="menu-btn primary" data-act="play"><span>Play Game</span><i>Quick Play · 3v3</i></button>
          <button class="menu-btn" data-act="teams"><span>Teams</span><i>Rosters & ratings</i></button>
          <button class="menu-btn" data-act="settings"><span>Settings</span><i>Sound & display</i></button>
          <button class="menu-btn" data-act="controls"><span>Controls</span><i>How to play</i></button>
        </nav>
        <div class="title-foot">Press <kbd>Enter</kbd> to play · <kbd>M</kbd> mute</div>
      </div>
    </section>

    <section class="screen setup-screen" data-screen="setup">
      <header class="screen-head">
        <button class="back-btn" data-act="back" aria-label="Back">‹</button>
        <h2>Quick Play</h2>
        <div class="head-sub">Pick your squad, your star, and the competition</div>
      </header>
      <div class="matchup">
        <div class="team-pick" data-side="home"></div>
        <div class="vs">VS</div>
        <div class="team-pick" data-side="away"></div>
      </div>
      <div class="options">
        <div class="opt">
          <label>Difficulty</label>
          <div class="seg" data-opt="difficulty">
            ${(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => `<button data-val="${d}">${DIFFICULTY[d].label}</button>`).join('')}
          </div>
        </div>
        <div class="opt">
          <label>Game Clock</label>
          <div class="seg" data-opt="time">
            <button data-val="60">1:00</button><button data-val="120">2:00</button><button data-val="180">3:00</button>
          </div>
        </div>
        <button class="tipoff" data-act="start">Tip Off ▸</button>
      </div>
    </section>

    <section class="screen panel-screen" data-screen="settings">
      <header class="screen-head">
        <button class="back-btn" data-act="back" aria-label="Back">‹</button>
        <h2>Settings</h2>
      </header>
      <div class="panel">
        <div class="row"><label for="vol">Master volume</label><input id="vol" type="range" min="0" max="100" step="1"></div>
        <div class="row"><label>Sound</label><button class="toggle" data-toggle="sound"></button></div>
        <div class="row"><label>Screen shake & flashes</label><button class="toggle" data-toggle="shake"></button></div>
        <div class="row"><label>Control hints during play</label><button class="toggle" data-toggle="hints"></button></div>
      </div>
    </section>

    <section class="screen panel-screen" data-screen="controls">
      <header class="screen-head">
        <button class="back-btn" data-act="back" aria-label="Back">‹</button>
        <h2>Controls</h2>
      </header>
      <div class="controls-grid">
        <div class="ctrl-card">
          <h3>Offense</h3>
          <ul>
            <li><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows</span>Move &amp; dribble</li>
            <li><span class="keys"><kbd>Shift</kbd></span>Sprint (uses stamina)</li>
            <li><span class="keys"><kbd>Space</kbd> hold → release</span>Jump shot. Let go in the <b class="g">green</b> zone</li>
            <li><span class="keys"><kbd>Space</kbd> near rim</span>Layup — sprint in for a dunk</li>
            <li><span class="keys"><kbd>E</kbd></span>Pass toward your movement / mouse</li>
            <li><span class="keys"><kbd>E</kbd> off-ball</span>Call for the ball</li>
          </ul>
        </div>
        <div class="ctrl-card">
          <h3>Defense</h3>
          <ul>
            <li><span class="keys"><kbd>Space</kbd></span>Jump to contest or block</li>
            <li><span class="keys"><kbd>E</kbd></span>Swipe for a steal</li>
            <li><span class="keys"><kbd>Q</kbd></span>Switch to player nearest the ball</li>
            <li><span class="keys"><kbd>Esc</kbd> / <kbd>P</kbd></span>Pause</li>
            <li><span class="keys"><kbd>M</kbd></span>Mute</li>
          </ul>
        </div>
        <div class="ctrl-card wide">
          <h3>Half-court rules</h3>
          <ul class="rules">
            <li>Baskets are worth <b>2</b>, or <b>3</b> from beyond the arc.</li>
            <li>After a defensive rebound or steal you must <b>clear the ball</b> beyond the arc before scoring.</li>
            <li><b>${RULES.SHOT_CLOCK}-second</b> shot clock — it resets when the ball hits the rim.</li>
            <li>Shot odds depend on rating, distance, defender pressure, movement, stamina and release timing.</li>
            <li>Tied at the buzzer? <b>Next bucket wins.</b></li>
          </ul>
        </div>
      </div>
    </section>

    <section class="hud" data-screen="game">
      <div class="scorebug">
        <div class="sb-team" data-side="0"><div class="sb-logo"></div><div class="sb-abbr"></div><div class="sb-score">0</div><div class="sb-poss"></div></div>
        <div class="sb-team" data-side="1"><div class="sb-logo"></div><div class="sb-abbr"></div><div class="sb-score">0</div><div class="sb-poss"></div></div>
        <div class="sb-clock"><span class="sb-period">1ST</span><span class="sb-time">2:00</span></div>
        <div class="sb-shot"><span>SHOT</span><b class="sb-shotclock">12</b></div>
      </div>
      <div class="hud-buttons">
        <button class="icon-btn" data-act="mute" aria-label="Toggle sound"></button>
        <button class="icon-btn" data-act="pause" aria-label="Pause">${PAUSE_ICON}</button>
      </div>
      <div class="banner" aria-live="polite"><div class="banner-text"></div><div class="banner-sub"></div></div>
      <div class="clear-flag">CLEAR THE BALL</div>
      <div class="player-card">
        <div class="pc-num"></div>
        <div class="pc-body">
          <div class="pc-name"></div>
          <div class="pc-meta"></div>
          <div class="pc-stamina"><i></i></div>
        </div>
      </div>
      <div class="hints"></div>
    </section>

    <section class="screen overlay pause-screen" data-screen="paused">
      <div class="modal">
        <h2>Paused</h2>
        <button class="menu-btn primary" data-act="resume"><span>Resume</span></button>
        <button class="menu-btn" data-act="restart"><span>Restart Match</span></button>
        <button class="menu-btn" data-act="controls"><span>Controls</span></button>
        <button class="menu-btn" data-act="settings"><span>Settings</span></button>
        <button class="menu-btn" data-act="quit"><span>Quit to Menu</span></button>
      </div>
    </section>

    <section class="screen overlay results-screen" data-screen="results">
      <div class="results"></div>
    </section>
    `;
  }

  // ---------------------------------------------------------------- behaviour

  private bind() {
    this.root.addEventListener('click', (e) => {
      Sound.unlock();
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act) { this.action(act); return; }
      const seg = btn.closest('.seg') as HTMLElement | null;
      if (seg && btn.dataset.val) {
        const opt = seg.dataset.opt;
        if (opt === 'difficulty') this.prefs.difficulty = btn.dataset.val as Difficulty;
        if (opt === 'time') this.prefs.time = Number(btn.dataset.val);
        Sound.ui('move');
        this.savePrefs();
        this.renderSetupOptions();
        return;
      }
      const tog = btn.dataset.toggle;
      if (tog) {
        if (tog === 'sound') Sound.setMuted(!Sound.muted);
        if (tog === 'shake') { this.prefs.shake = !this.prefs.shake; bridge.settings.shake = this.prefs.shake; }
        if (tog === 'hints') { this.prefs.hints = !this.prefs.hints; bridge.settings.hints = this.prefs.hints; }
        this.savePrefs();
        Sound.ui('move');
        this.renderSettings();
        this.updateMuteButtons();
      }
    });

    const vol = $<HTMLInputElement>(this.root, '#vol');
    vol.addEventListener('input', () => { Sound.unlock(); Sound.setVolume(Number(vol.value) / 100); });

    window.addEventListener('keydown', (e) => {
      Sound.unlock();
      const k = e.key.toLowerCase();
      if (k === 'm') { Sound.toggleMute(); this.updateMuteButtons(); this.renderSettings(); return; }
      if (this.screen === 'game' && (k === 'escape' || k === 'p')) { e.preventDefault(); this.action('pause'); return; }
      if (this.screen === 'paused' && (k === 'escape' || k === 'p')) { e.preventDefault(); this.action('resume'); return; }
      if (k === 'escape' && ['setup', 'settings', 'controls'].includes(this.screen)) { this.action('back'); return; }
      if (k === 'enter' && this.screen === 'title' && document.activeElement === document.body) { this.action('play'); return; }
      if (this.screen === 'setup' && document.activeElement === document.body) {
        if (k === 'enter') this.action('start');
      }
    }, true);
  }

  private action(act: string) {
    switch (act) {
      case 'play':
      case 'teams':
        Sound.ui('select');
        this.renderSetup();
        this.show('setup');
        break;
      case 'settings':
        Sound.ui('select');
        this.returnTo = this.screen === 'paused' ? 'paused' : 'title';
        this.renderSettings();
        this.show('settings');
        break;
      case 'controls':
        Sound.ui('select');
        this.returnTo = this.screen === 'paused' ? 'paused' : 'title';
        this.show('controls');
        break;
      case 'back':
        Sound.ui('back');
        this.show(this.screen === 'setup' ? 'title' : this.returnTo);
        if (this.returnTo === 'paused') this.returnTo = 'title';
        break;
      case 'start':
        Sound.ui('select');
        this.startMatch();
        break;
      case 'pause':
        if (this.screen !== 'game') return;
        this.scene?.setPaused(true);
        Sound.ui('back');
        this.show('paused');
        break;
      case 'resume':
        this.scene?.setPaused(false);
        Sound.ui('select');
        this.show('game');
        break;
      case 'restart':
      case 'rematch':
        Sound.ui('select');
        if (this.currentCfg) this.launch(this.currentCfg);
        break;
      case 'quit':
      case 'menu':
        Sound.ui('back');
        this.currentCfg = null;
        this.scene?.scene.restart({ demo: true });
        this.show('title');
        break;
      case 'mute':
        Sound.toggleMute();
        this.updateMuteButtons();
        break;
      case 'home-prev': this.cycle('home', -1); break;
      case 'home-next': this.cycle('home', 1); break;
      case 'away-prev': this.cycle('away', -1); break;
      case 'away-next': this.cycle('away', 1); break;
      default:
        if (act.startsWith('star-')) {
          this.prefs.star = Number(act.slice(5));
          Sound.ui('move');
          this.savePrefs();
          this.renderSetup();
        }
    }
  }

  private show(s: Screen) {
    this.screen = s;
    this.root.querySelectorAll<HTMLElement>('[data-screen]').forEach((el) => {
      const on = el.dataset.screen === s || (el.dataset.screen === 'game' && (s === 'paused' || s === 'results'));
      el.classList.toggle('active', on);
    });
    this.root.classList.toggle('in-game', s === 'game' || s === 'paused' || s === 'results');
    this.root.classList.toggle('menu-mode', !(s === 'game' || s === 'paused' || s === 'results'));
    const first = this.root.querySelector<HTMLElement>(`[data-screen="${s}"].active .menu-btn, [data-screen="${s}"].active .tipoff`);
    if (first && s !== 'game') first.focus({ preventScroll: true });
    else (document.activeElement as HTMLElement | null)?.blur?.();
  }

  private cycle(side: 'home' | 'away', dir: number) {
    const n = TEAMS.length;
    let v = (this.prefs[side] + dir + n) % n;
    const other = side === 'home' ? this.prefs.away : this.prefs.home;
    if (v === other) v = (v + dir + n) % n;
    this.prefs[side] = v;
    if (side === 'home') this.prefs.star = 0;
    Sound.ui('move');
    this.savePrefs();
    this.renderSetup();
  }

  private renderSetup() {
    if (this.prefs.home === this.prefs.away) this.prefs.away = (this.prefs.home + 1) % TEAMS.length;
    for (const side of ['home', 'away'] as const) {
      const t = TEAMS[this.prefs[side]];
      const el = $(this.root, `.team-pick[data-side="${side}"]`);
      el.style.setProperty('--tc', hex(t.primary));
      el.style.setProperty('--tc2', hex(t.secondary));
      el.innerHTML = `
        <div class="tp-label">${side === 'home' ? 'YOU' : 'CPU'}</div>
        <div class="tp-top">
          <button class="arrow" data-act="${side}-prev" aria-label="Previous team">‹</button>
          <div class="tp-badge">${teamLogo(t, 132)}</div>
          <button class="arrow" data-act="${side}-next" aria-label="Next team">›</button>
        </div>
        <div class="tp-city">${t.city}</div>
        <div class="tp-name">${t.name}</div>
        <div class="tp-ovr"><span>OVR</span><b>${teamOverall(t)}</b></div>
        <div class="roster">
          ${t.players.map((p, i) => `
            <button class="roster-row ${side === 'home' && i === this.prefs.star ? 'star' : ''}" ${side === 'home' ? `data-act="star-${i}"` : 'tabindex="-1"'}>
              <span class="rr-num">${p.number}</span>
              <span class="rr-name">${p.name}<i>${posName(p.pos)} · ${feet(p.height)}</i></span>
              <span class="rr-tags">${tags(p)}</span>
              <span class="rr-ovr">${playerOverall(p)}</span>
            </button>`).join('')}
        </div>
        ${side === 'home' ? '<div class="tp-hint">Click a player to make them your ★ star — they start with the ball.</div>' : '<div class="tp-hint">&nbsp;</div>'}
      `;
    }
    this.renderSetupOptions();
  }

  private renderSetupOptions() {
    this.root.querySelectorAll<HTMLElement>('.seg[data-opt="difficulty"] button').forEach((b) => b.classList.toggle('on', b.dataset.val === this.prefs.difficulty));
    this.root.querySelectorAll<HTMLElement>('.seg[data-opt="time"] button').forEach((b) => b.classList.toggle('on', Number(b.dataset.val) === this.prefs.time));
  }

  private renderSettings() {
    $<HTMLInputElement>(this.root, '#vol').value = String(Math.round(Sound.volume * 100));
    const set = (k: string, on: boolean) => {
      const b = $(this.root, `[data-toggle="${k}"]`);
      b.classList.toggle('on', on);
      b.textContent = on ? 'ON' : 'OFF';
      b.setAttribute('aria-pressed', String(on));
    };
    set('sound', !Sound.muted);
    set('shake', this.prefs.shake);
    set('hints', this.prefs.hints);
  }

  private updateMuteButtons() {
    this.root.querySelectorAll<HTMLElement>('[data-act="mute"]').forEach((b) => { b.innerHTML = Sound.muted ? SPEAKER_OFF : SPEAKER_ON; });
  }

  private startMatch() {
    const cfg: MatchConfig = {
      teams: [TEAMS[this.prefs.home], TEAMS[this.prefs.away]],
      userSide: 0,
      starIndex: this.prefs.star,
      difficulty: this.prefs.difficulty,
      gameTime: this.prefs.time,
    };
    this.launch(cfg);
  }

  private launch(cfg: MatchConfig) {
    this.currentCfg = cfg;
    window.clearTimeout(this.resultsTimer);
    this.scene?.scene.restart({ cfg, demo: false });
    this.show('game');
  }

  // ---------------------------------------------------------------- HUD

  private onMatchStart(m: Match, demo: boolean) {
    this.lastFrame = {};
    if (demo) return;
    for (const side of [0, 1] as const) {
      const t = m.cfg.teams[side];
      const el = $(this.root, `.sb-team[data-side="${side}"]`);
      el.style.setProperty('--tc', hex(t.primary));
      el.style.setProperty('--tc2', hex(lighten(t.primary, -0.35)));
      $(el, '.sb-logo').innerHTML = teamLogo(t, 40);
      $(el, '.sb-abbr').textContent = t.abbr;
      $(el, '.sb-score').textContent = '0';
    }
    this.banner('TIP OFF', `${m.cfg.teams[0].name} vs ${m.cfg.teams[1].name}`, 'neutral', 2200);
  }

  private set(key: string, value: string, apply: (v: string) => void) {
    if (this.lastFrame[key] === value) return;
    this.lastFrame[key] = value;
    apply(value);
  }

  private onFrame(m: Match, demo: boolean) {
    if (demo || this.screen === 'title') return;
    const r = this.root;
    for (const side of [0, 1] as const) {
      this.set(`score${side}`, String(m.score[side]), (v) => {
        const el = $(r, `.sb-team[data-side="${side}"] .sb-score`);
        el.textContent = v;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      });
      this.set(`poss${side}`, String(m.offense === side), (v) => $(r, `.sb-team[data-side="${side}"]`).classList.toggle('has-ball', v === 'true'));
    }
    const clock = m.overtime ? 'OT' : fmtClock(m.gameClock);
    this.set('clock', clock, (v) => { $(r, '.sb-time').textContent = v; });
    this.set('period', m.overtime ? 'SUDDEN' : m.gameClock <= 10 ? 'FINAL' : 'GAME', (v) => { $(r, '.sb-period').textContent = v; });
    this.set('clockLow', String(m.gameClock <= 10 && !m.overtime), (v) => $(r, '.sb-clock').classList.toggle('low', v === 'true'));
    const sc = m.phase === 'live' && m.ball.state === 'loose' && m.ball.touchedRim ? '--' : String(Math.ceil(m.shotClock));
    this.set('shot', sc, (v) => { $(r, '.sb-shotclock').textContent = v; $(r, '.sb-shot').classList.toggle('low', v !== '--' && Number(v) <= 3); });

    const showClear = m.needsClear && m.offense === m.cfg.userSide && m.phase === 'live';
    this.set('clear', String(showClear), (v) => $(r, '.clear-flag').classList.toggle('on', v === 'true'));

    const u = m.user;
    if (u) {
      this.set('pcid', String(u.id), () => {
        const card = $(r, '.player-card');
        card.style.setProperty('--tc', hex(u.team.primary));
        $(card, '.pc-num').textContent = String(u.def.number);
        $(card, '.pc-name').textContent = u.def.name;
      });
      const s = u.stats;
      this.set('pcmeta', `${s.pts} PTS · ${s.reb} REB · ${s.ast} AST`, (v) => { $(r, '.pc-meta').textContent = v; });
      this.set('stam', String(Math.round(u.stamina * 50)), () => {
        const bar = $(r, '.pc-stamina i');
        bar.style.width = `${Math.round(u.stamina * 100)}%`;
        bar.classList.toggle('low', u.stamina < 0.25);
      });
      const hasBall = m.ball.owner === u && m.ball.state === 'held';
      const mode = !bridge.settings.hints ? 'off' : hasBall ? 'ball' : u.side === m.offense && m.ball.state !== 'loose' ? 'offball' : u.side !== m.offense ? 'defense' : 'loose';
      this.set('hints', mode, (v) => { $(r, '.hints').innerHTML = hintsFor(v); });
    }
  }

  private onEvent<K extends keyof MatchEvents>(name: K, payload: MatchEvents[K], m: Match, demo: boolean) {
    if (demo) return;
    switch (name) {
      case 'banner': {
        const b = payload as MatchEvents['banner'];
        this.banner(b.text, b.sub ?? '', b.tone ?? 'neutral', 1500);
        break;
      }
      case 'score': {
        const s = payload as MatchEvents['score'];
        const t = m.cfg.teams[s.side];
        const who = s.p ? s.p.def.name.split(' ').slice(-1)[0].toUpperCase() : t.name.toUpperCase();
        const sub = s.assist ? `Assist: ${s.assist.def.name}` : `${t.city} ${t.name}`;
        this.banner(`${who} ${s.kind === 'dunk' ? 'SLAMS IT' : s.pts === 3 ? 'FROM DOWNTOWN' : 'SCORES'}`, sub, s.side === 0 ? 'home' : 'away', 1500);
        break;
      }
      case 'gameover':
        window.clearTimeout(this.resultsTimer);
        this.resultsTimer = window.setTimeout(() => { this.renderResults(m); this.show('results'); }, 2200);
        break;
      default:
        break;
    }
  }

  private banner(text: string, sub: string, tone: string, ms: number) {
    const el = $(this.root, '.banner');
    $(el, '.banner-text').textContent = text;
    $(el, '.banner-sub').textContent = sub;
    el.dataset.tone = tone;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => el.classList.remove('show'), ms);
  }

  private renderResults(m: Match) {
    const [a, b] = m.cfg.teams;
    const win = m.score[0] > m.score[1] ? 0 : 1;
    const wt = m.cfg.teams[win];
    const userWon = m.cfg.userSide === win;
    const mvp = [...m.players].sort((x, y) => impact(y) - impact(x))[0];
    const tbl = (side: 0 | 1, t: TeamDef) => {
      const ps = m.players.filter((p) => p.side === side);
      const tot = ps.reduce((acc, p) => { for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += p.stats[k]; return acc; }, { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 });
      return `
      <div class="box" style="--tc:${hex(t.primary)}">
        <div class="box-head">${teamLogo(t, 34)}<span>${t.city} ${t.name}</span><b>${m.score[side]}</b></div>
        <table>
          <thead><tr><th>Player</th><th>PTS</th><th>FG</th><th>3PT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th></tr></thead>
          <tbody>
            ${ps.map((p) => `<tr class="${p === mvp ? 'mvp' : ''}"><td><span class="num">${p.def.number}</span>${p.def.name}${p === mvp ? ' <em>MVP</em>' : ''}</td><td><b>${p.stats.pts}</b></td><td>${p.stats.fgm}-${p.stats.fga}</td><td>${p.stats.tpm}-${p.stats.tpa}</td><td>${p.stats.reb}</td><td>${p.stats.ast}</td><td>${p.stats.stl}</td><td>${p.stats.blk}</td></tr>`).join('')}
            <tr class="tot"><td>Team</td><td><b>${tot.pts}</b></td><td>${tot.fgm}-${tot.fga}</td><td>${tot.tpm}-${tot.tpa}</td><td>${tot.reb}</td><td>${tot.ast}</td><td>${tot.stl}</td><td>${tot.blk}</td></tr>
          </tbody>
        </table>
      </div>`;
    };
    $(this.root, '.results').innerHTML = `
      <div class="res-top" style="--tc:${hex(wt.primary)}">
        <div class="res-final">FINAL${m.overtime ? ' / OT' : ''}</div>
        <div class="res-score">
          <div class="rs-team ${win === 0 ? 'w' : ''}">${teamLogo(a, 84)}<span>${a.abbr}</span></div>
          <div class="rs-num">${m.score[0]}<i>–</i>${m.score[1]}</div>
          <div class="rs-team ${win === 1 ? 'w' : ''}">${teamLogo(b, 84)}<span>${b.abbr}</span></div>
        </div>
        <div class="res-winner">${userWon ? 'VICTORY' : m.cfg.userSide === null ? '' : 'DEFEAT'} — <b>${wt.city} ${wt.name}</b> win</div>
        <div class="res-mvp">Player of the game: <b>${mvp.def.name}</b> · ${mvp.stats.pts} pts, ${mvp.stats.reb} reb, ${mvp.stats.ast} ast</div>
      </div>
      <div class="boxes">${tbl(0, a)}${tbl(1, b)}</div>
      <div class="res-actions">
        <button class="menu-btn primary" data-act="rematch"><span>Rematch</span></button>
        <button class="menu-btn" data-act="menu"><span>Main Menu</span></button>
      </div>`;
  }
}

function impact(p: Player): number {
  const s = p.stats;
  return s.pts + s.reb * 0.8 + s.ast + s.stl * 1.5 + s.blk * 1.5 - s.tov * 0.5;
}

function fmtClock(t: number): string {
  if (t < 10) return t.toFixed(1);
  const s = Math.ceil(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function feet(h: number): string {
  const ft = Math.floor(h);
  const inch = Math.round((h - ft) * 12);
  return `${ft}'${inch}"`;
}

function posName(p: 'G' | 'W' | 'B'): string {
  return p === 'G' ? 'Guard' : p === 'W' ? 'Wing' : 'Big';
}

function tags(p: { ratings: { three: number; dunk: number; handling: number; block: number; steal: number; shooting: number } }): string {
  const r = p.ratings;
  const out: string[] = [];
  if (r.three >= 84) out.push('Sniper');
  else if (r.shooting >= 82) out.push('Shooter');
  if (r.dunk >= 85) out.push('Dunker');
  if (r.handling >= 88) out.push('Handles');
  if (r.block >= 85) out.push('Rim Guard');
  if (r.steal >= 80) out.push('Pickpocket');
  return out.slice(0, 2).map((t) => `<em>${t}</em>`).join('');
}

function hintsFor(mode: string): string {
  const H = (keys: string, label: string) => `<div class="hint"><span>${keys}</span>${label}</div>`;
  switch (mode) {
    case 'ball':
      return H('<kbd>Space</kbd>', 'Hold &amp; release to shoot') + H('<kbd>E</kbd>', 'Pass') + H('<kbd>Shift</kbd>', 'Sprint');
    case 'offball':
      return H('<kbd>E</kbd>', 'Call for ball') + H('<kbd>Shift</kbd>', 'Sprint') + H('<kbd>Q</kbd>', 'Switch');
    case 'defense':
      return H('<kbd>Space</kbd>', 'Contest / block') + H('<kbd>E</kbd>', 'Steal') + H('<kbd>Q</kbd>', 'Switch');
    case 'loose':
      return H('<kbd>Q</kbd>', 'Switch to nearest') + H('<kbd>Space</kbd>', 'Jump for it');
    default:
      return '';
  }
}
