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

export function verdictHtml(d) {
  if (d.cost < 0.05) return `<span class="verdict ok">${icon("check")}Matches model</span>`;
  if (d.tier === "toss_up") return `<span class="verdict meh">${icon("scale")}Close call</span>`;
  return `<span class="verdict bad">${icon("alert")}${ERR[d.err] || "Differs"}</span>`;
}
