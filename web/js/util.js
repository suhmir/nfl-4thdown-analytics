// Formatting, team metadata, icons, tooltip. No analytics happen in the
// browser beyond simple filtering/sorting — every number shown comes from the
// Python pipeline's JSON.

export const TEAMS = {
  ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens", BUF: "Buffalo Bills",
  CAR: "Carolina Panthers", CHI: "Chicago Bears", CIN: "Cincinnati Bengals", CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys", DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
  HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars", KC: "Kansas City Chiefs",
  LA: "Los Angeles Rams", LAC: "Los Angeles Chargers", LV: "Las Vegas Raiders", MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings", NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
  NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers", SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers", TB: "Tampa Bay Buccaneers", TEN: "Tennessee Titans", WAS: "Washington Commanders",
};
export const teamName = (t) => TEAMS[t] || t;

export const OPT = { go: "Go for it", punt: "Punt", fg: "Field goal" };
export const OPT_SHORT = { go: "GO", punt: "PUNT", fg: "FG" };
export const TIER = { clear_go: "Clear go", clear_kick: "Clear kick", toss_up: "Toss-up" };
export const ERR = { too_conservative: "Too conservative", too_aggressive: "Too aggressive", wrong_kick: "Wrong kick" };

// Minimum samples before a unit is shown without a small-sample warning.
export const SMALL_N = { decisions: 40, games: 6 };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pct = (x, d = 1) => (x == null || Number.isNaN(x) ? "—" : `${(100 * x).toFixed(d)}%`);
export const pp = (x, d = 1) => (x == null || Number.isNaN(x) ? "—" : `${x.toFixed(d)} pp`);
export const signed = (x, d = 1) => (x == null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(d)}`);
export const num = (x, d = 0) => (x == null ? "—" : Number(x).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }));

export function clock(qsr) {
  const s = Math.max(0, Math.round(qsr));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export const qlabel = (q) => (q >= 5 ? (q === 5 ? "OT" : `OT${q - 4}`) : `Q${q}`);
export function fieldPos(yl, pos, def) {
  if (yl === 50) return "50";
  return yl > 50 ? `${pos} ${100 - yl}` : `${def} ${yl}`;
}
export function downDist(d) {
  return `4th & ${d.gtg ? "Goal" : d.ytg}`;
}
export function scoreText(sd) {
  if (sd === 0) return "Tied";
  return sd > 0 ? `Up ${sd}` : `Down ${-sd}`;
}
export function weekLabel(w, stype) {
  if (stype === "POST") return { 19: "Wild Card", 20: "Divisional", 21: "Conf. Champ.", 22: "Super Bowl" }[w] || `Post ${w}`;
  return `Week ${w}`;
}
export const weekShort = (w) => (w <= 18 ? String(w) : { 19: "WC", 20: "DIV", 21: "CONF", 22: "SB" }[w] || w);

export const smallSample = (row) => row.decisions < SMALL_N.decisions || row.games < SMALL_N.games;

// ---------- Icons (inline SVG, stroke-based) ----------
const P = {
  overview: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  games: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 4v16M3 12h18"/>',
  decisions: '<path d="M4 6h16M4 12h10M4 18h6"/><circle cx="18" cy="16" r="3"/><path d="m20.5 18.5 2 2"/>',
  teams: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/>',
  coaches: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  lab: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  method: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h5M8 8h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.2"/><circle cx="16" cy="16" r="1.2"/><circle cx="12" cy="12" r="1.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
  guide: '<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5c-3-.5-6 0-8 1.5z"/><path d="M12 6v14.5"/>',
  logo: '<path d="M4 18 12 4l8 14"/><path d="M8 12h8"/><circle cx="12" cy="18" r="1.6"/>',
};
export const icon = (name, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ""}</svg>`;

// ---------- Tooltip: any element with data-tip (HTML string) ----------
let tipEl;
export function initTooltip() {
  tipEl = document.createElement("div");
  tipEl.className = "tooltip";
  tipEl.setAttribute("role", "tooltip");
  document.body.appendChild(tipEl);
  const move = (e) => {
    const pad = 14, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > innerHeight - 8) y = e.clientY - h - pad;
    tipEl.style.left = `${x}px`; tipEl.style.top = `${y}px`;
  };
  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) return tipEl.classList.remove("show");
    tipEl.innerHTML = t.getAttribute("data-tip");
    tipEl.classList.add("show");
    move(e);
  });
  document.addEventListener("mousemove", (e) => { if (tipEl.classList.contains("show")) move(e); });
  document.addEventListener("scroll", () => tipEl.classList.remove("show"), true);
}
export const tip = (title, rows = []) =>
  esc(`<div class="tt-h">${title}</div>` + rows.map(([k, v]) => `<div class="tt-r"><span>${k}</span><b>${v}</b></div>`).join(""));

// Severity scale for disagreements with the model (pts of win chance given up).
export const SEV = {
  match: { label: "Matches model", cls: "ok", icon: "check", rank: 0 },
  coin_flip: { label: "Coin flip", cls: "meh", icon: "scale", rank: 1 },
  slight: { label: "Slightly", cls: "warn", icon: "alert", rank: 2 },
  clear: { label: "", cls: "bad", icon: "alert", rank: 3 },
  big: { label: "Very", cls: "crit", icon: "alert", rank: 4 },
};
const DIRWORD = { conservative: "conservative", aggressive: "aggressive", kick_choice: "weaker kick" };
export const SEV_BANDS = [
  { key: "coin_flip", from: 0, to: 1, name: "Coin flip", text: "Under 1 pt, or the model itself isn't sure. Either choice is fine." },
  { key: "slight", from: 1, to: 2.5, name: "Slight", text: "1 to 2.5 pts. A real but modest edge; reasonable coaches can differ." },
  { key: "clear", from: 2.5, to: 5, name: "Clear", text: "2.5 to 5 pts. A meaningful edge the coach passed up." },
  { key: "big", from: 5, to: 12, name: "Big", text: "5+ pts. A major edge left on the table." },
];

export function sevLabel(d) {
  const s = SEV[d.sev] || SEV.match;
  if (d.sev === "match" || d.sev === "coin_flip") return s.label;
  const w = DIRWORD[d.dir] || "different";
  const base = d.sev === "clear" ? w : `${s.label} ${w}`;
  return d.dir === "kick_choice" ? `${d.sev === "big" ? "Much " : d.sev === "slight" ? "Slightly " : ""}weaker kick` : base[0].toUpperCase() + base.slice(1);
}

export function verdictHtml(d) {
  const s = SEV[d.sev] || SEV.match;
  return `<span class="verdict ${s.cls}">${icon(s.icon)}${sevLabel(d)}</span>`;
}
// ---------- Plain-language layer ----------
// One definition per term, shown through the "?" help icons and on the guide page.
export const GLOSSARY = {
  winChance: ["Win chance", "The model's estimate of how often a team in this exact situation goes on to win. 70% means teams in this spot win about 7 times out of 10."],
  pts: ["Points (pts)", "Changes in win chance are measured in percentage points. Going from 60% to 65% is +5 pts. “pp” means the same thing."],
  cost: ["Win chance given up", "How much lower the team's win chance was with the option it chose, compared with the model's best option. 0 means it picked the best option."],
  goKick: ["Go vs. kick", "How much better going for it was than the best kick (punt or field goal), in pts of win chance. Positive = the model preferred going."],
  clear: ["Clear call vs. toss-up", "The model's numbers come with a range of uncertainty. If the whole range points one way, it's a clear call. If it could go either way, it's a toss-up, and coaches aren't marked down much for those."],
  critical: ["Critical decision", "A fourth down in a game that was still competitive, where picking the wrong side (go vs. kick) would cost at least 1 pt of win chance."],
  score: ["Decision Score", "Of all the win chance at stake in a coach's go-or-kick decisions, the share where they picked the side the model preferred. Bigger decisions count more. 100% = always agreed with the model."],
  rve: ["Results vs. expected", "Did the play turn out better or worse than the model expected for the option chosen? This reflects players' execution and luck, not the decision itself."],
  range: ["Range", "Where the true value plausibly lies (90% of the time). If two coaches' ranges overlap a lot, the data can't say who is better."],
  rankRange: ["Likely rank", "If we replayed the season's games many times with different luck, this is the span of ranks the coach usually landed in."],
  tier: ["Tier", "Above average / below average only when the coach's whole range sits above or below the league average. Everyone else is in the average range."],
  goRate: ["Went for it", "The share of fourth downs where the team ran a play instead of punting or kicking a field goal."],
  model: ["The model (nfl4th)", "A widely used public fourth-down model by analyst Ben Baldwin, built from years of NFL play-by-play. It estimates win chance for each option using the score, clock, field position, distance, timeouts and the betting line."],
  severity: ["Gap size", "How much win chance the choice gave up versus the model's best option: coin flip (under 1 pt), slight (1–2.5), clear (2.5–5) or big (5+). Coin flips are never counted against a coach."],
  aggressiveness: ["Aggressiveness", "How often a coach goes for it when the model clearly favors going (by 2.5+ pts). Higher = takes more of the good gambles."],
  forgiveness: ["Ignore gaps under…", "Decisions where going vs. kicking differ by less than this are treated as coin flips and left out of the Decision Score."],
  competitive: ["Competitive only", "Hides decisions in blowouts (where the best option's win chance was under 2% or over 98%), since those barely matter."],
};

export function help(key) {
  const g = GLOSSARY[key];
  if (!g) return "";
  return `<span class="help" tabindex="0" role="note" aria-label="${esc(g[0])}: ${esc(g[1])}" data-tip="${tip(g[0]) + esc(`<div style="color:var(--text-2);max-width:260px">${esc(g[1])}</div>`)}">?</span>`;
}

const optVerb = { go: "went for it", punt: "punted", fg: "kicked a field goal" };
const optNoun = { go: "going for it", punt: "punting", fg: "a field goal" };

/** One plain-English sentence or two describing a decision. */
export function plainEnglish(d) {
  const where = d.yl > 50 ? `from its own ${100 - d.yl}-yard line` : d.yl === 50 ? "from midfield" : `at the opponent's ${d.yl}`;
  const lead = d.sd === 0 ? "with the game tied" : d.sd > 0 ? `leading by ${d.sd}` : `trailing by ${-d.sd}`;
  const when = d.qtr >= 5 ? "in overtime" : `with ${clock(d.clock)} left in the ${["", "1st", "2nd", "3rd", "4th"][d.qtr]} quarter`;
  const s1 = `${teamName(d.pos)} faced 4th & ${d.gtg ? "goal" : d.ytg} ${where}, ${lead} ${when}, and ${optVerb[d.choice]}.`;
  const best = `${(100 * d.best_wp).toFixed(0)}%`;
  const chosen = `${(100 * d.chosen_wp).toFixed(0)}%`;
  let s2;
  if (d.cost < 0.05) s2 = `That was the model's top option, giving them about a ${chosen} chance to win.`;
  else if (d.tier === "toss_up") s2 = `The model slightly preferred ${optNoun[d.best]} (${best} vs. ${chosen} win chance), but it's a close call either way.`;
  else s2 = `The model clearly preferred ${optNoun[d.best]}: about a ${best} chance to win, versus ${chosen} for what they did. That's ${d.cost.toFixed(1)} pts of win chance left on the table.`;
  return `${s1} ${s2}`;
}

/** Call quality vs. result for one decision. */
export function callResult(d) {
  const call = d.right || d.sev === "match" ? "right" : d.sev === "coin_flip" ? "close" : "wrong";
  const worked = d.out.worked;
  const lesson = {
    "right|true": ["Right call, and it worked", "The decision was sound and the play delivered."],
    "right|false": ["Right call, bad result", "The decision was sound; the play just didn't work. Good process, unlucky outcome."],
    "wrong|true": ["Risky call that paid off", "The model preferred the other option, but this one worked out. A good result doesn't make it a good decision."],
    "wrong|false": ["Wrong call, and it hurt", "The model preferred the other option, and this one didn't work out either."],
    "close|true": ["Close call, and it worked", "Either option was reasonable here, and this one turned out well."],
    "close|false": ["Close call, didn't work out", "Either option was reasonable here; this one didn't pay off."],
  }[`${call}|${worked}`];
  return { call, worked, title: lesson[0], text: lesson[1] };
}
