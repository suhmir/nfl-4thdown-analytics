import { state, loadManifest, seasonData } from "./data.js";
import { icon, initTooltip, teamName, TEAMS, esc } from "./util.js";
import * as V from "./views.js";

const NAV = [
  ["overview", "Overview", "#/", "overview"],
  ["games", "Games", "#/games", "games"],
  ["decisions", "Decisions", "#/decisions", "decisions"],
  ["teams", "Teams", "#/teams", "teams"],
  ["coaches", "Coaches", "#/coaches", "coaches"],
  ["lab", "What-if Lab", "#/lab", "lab"],
  ["methodology", "Method", "#/methodology", "method"],
];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

function parseRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { section: parts[0] || "overview", arg: parts[1], params: new URLSearchParams(query) };
}

// Detail routes carry their season in the id ("2025_12_PIT_CHI..."): follow it.
function seasonFromArg(section, arg) {
  if (["game", "decision", "lab"].includes(section) && arg && /^\d{4}_/.test(arg)) return Number(arg.slice(0, 4));
  return null;
}

const CRUMB = { overview: "Overview", games: "Games", game: "Game", decision: "Decision", decisions: "Decisions", teams: "Teams", team: "Team", coaches: "Coaches", coach: "Coach", lab: "What-if Lab", methodology: "Methodology" };
const PARENT = { game: ["Games", "#/games"], decision: ["Decisions", "#/decisions"], team: ["Teams", "#/teams"], coach: ["Coaches", "#/coaches"] };

async function render() {
  const { section, arg, params } = parseRoute();
  const s = seasonFromArg(section, arg);
  if (s && s !== state.season && state.manifest.seasons.some((x) => x.season === s)) setSeason(s, false);

  const navKey = { game: "games", decision: "decisions", team: "teams", coach: "coaches" }[section] || section;
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.key === navKey));
  const label = section === "team" ? teamName(arg) : section === "coach" ? arg : CRUMB[section] || "";
  const parent = PARENT[section];
  document.getElementById("crumbs").innerHTML =
    `<a href="#/">${state.season}</a>` + (parent ? `<span class="sep">/</span><a href="${parent[1]}">${parent[0]}</a>` : "") +
    (section !== "overview" ? `<span class="sep">/</span><span class="here">${esc(label)}</span>` : `<span class="sep">/</span><span class="here">Overview</span>`);

  const app = document.getElementById("app");
  app.innerHTML = '<div class="loader">LOADING</div>';
  let html;
  try {
    const routes = {
      overview: () => V.overview(), games: () => V.games(params), game: () => V.game(arg), decision: () => V.decision(arg),
      decisions: () => V.decisionsList(params), teams: () => V.teams(params), team: () => V.team(arg),
      coaches: () => V.coaches(params), coach: () => V.coach(arg), lab: () => V.lab(arg, params), methodology: () => V.methodology(),
    };
    html = await (routes[section] || (() => V.notFound("Page")))();
  } catch (e) {
    console.error(e);
    html = `<div class="empty-state"><h2>Something went wrong</h2><p class="mono">${esc(e.message)}</p></div>`;
  }
  app.innerHTML = `<div class="page-inner">${html}</div>`;
  app.style.animation = "none"; void app.offsetWidth; app.style.animation = "";
  if (section === "lab") V.bindLab(arg, params);
  bindParamSelects(section, arg);
  window.scrollTo({ top: 0 });
}

function bindParamSelects(section, arg) {
  document.querySelectorAll("#app select[data-param]").forEach((sel) => sel.addEventListener("change", () => {
    const { params } = parseRoute();
    const k = sel.dataset.param;
    sel.value ? params.set(k, sel.value) : params.delete(k);
    params.delete("page");
    if (sel.dataset.reset) sel.dataset.reset.split(",").forEach((r) => params.delete(r));
    const base = sel.dataset.route || `#/${section}${arg ? "/" + encodeURIComponent(arg) : ""}`;
    location.hash = `${base}?${params}`;
  }));
}

function setSeason(season, rerender = true) {
  state.season = season;
  store.set("nfldi.season", String(season));
  document.querySelectorAll("#season-seg button").forEach((b) => b.classList.toggle("on", Number(b.dataset.season) === season));
  const meta = state.manifest.seasons.find((x) => x.season === season);
  document.getElementById("foot").innerHTML =
    `Season <span class="mono">${season}</span> · ${meta.status === "final" ? "final" : `live through wk <span class="mono">${meta.through_week}</span>`}<br>` +
    `Data built <span class="mono">${state.manifest.built_at.slice(0, 16).replace("T", " ")}</span> UTC<br>Model: nfl4th · data: nflverse`;
  if (rerender) {
    const { section } = parseRoute();
    // detail pages belong to one season; go to that season's list instead
    const up = { game: "#/games", decision: "#/decisions", lab: "#/lab" }[section];
    if (up) location.hash = up; else render();
  }
}

function setView(v, rerender = true) {
  state.view = v;
  store.set("nfldi.view", v);
  document.querySelectorAll("#view-seg button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  if (rerender) render();
}

function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  store.set("nfldi.theme", t);
  document.getElementById("theme").innerHTML = icon(t === "dark" ? "sun" : "moon");
}

function initSearch() {
  const input = document.getElementById("search"), box = document.getElementById("search-results");
  let items = [], sel = 0;
  const go = (href) => { location.hash = href; input.value = ""; box.classList.remove("open"); input.blur(); };
  input.addEventListener("input", async () => {
    const q = input.value.trim().toLowerCase();
    if (!q) return box.classList.remove("open");
    const { summary } = await seasonData();
    const coaches = summary.views.all.coaches.map((c) => c.coach);
    items = [
      ...Object.entries(TEAMS).filter(([a, n]) => a.toLowerCase().startsWith(q) || n.toLowerCase().includes(q)).map(([a, n]) => ({ label: n, kind: a, href: `#/team/${a}` })),
      ...coaches.filter((c) => c.toLowerCase().includes(q)).map((c) => ({ label: c, kind: "coach", href: `#/coach/${encodeURIComponent(c)}` })),
    ].slice(0, 10);
    sel = 0;
    box.innerHTML = items.map((it, i) => `<a href="${it.href}" class="${i === sel ? "sel" : ""}"><span>${esc(it.label)}</span><span class="kind">${esc(it.kind)}</span></a>`).join("") || '<div class="dim" style="padding:10px">No matches</div>';
    box.classList.add("open");
  });
  input.addEventListener("keydown", (e) => {
    if (!box.classList.contains("open") || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
      box.querySelectorAll("a").forEach((a, i) => a.classList.toggle("sel", i === sel));
    } else if (e.key === "Enter") { e.preventDefault(); go(items[sel].href); } else if (e.key === "Escape") box.classList.remove("open");
  });
  box.addEventListener("click", (e) => { const a = e.target.closest("a"); if (a) { e.preventDefault(); go(a.getAttribute("href")); } });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) box.classList.remove("open"); });
  document.addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== input && !e.target.closest("input,select,textarea")) { e.preventDefault(); input.focus(); } });
}

async function boot() {
  setTheme(store.get("nfldi.theme") || "dark");
  document.getElementById("theme").addEventListener("click", () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  initTooltip();
  document.getElementById("nav").innerHTML = NAV.map(([k, label, href, ic]) => `<a href="${href}" data-key="${k}">${icon(ic)}<span>${label}</span></a>`).join("");
  const m = await loadManifest();
  const seasons = [...m.seasons].sort((a, b) => b.season - a.season);
  document.getElementById("season-seg").innerHTML = seasons.map((s) =>
    `<button data-season="${s.season}">${s.status === "final" ? "" : '<span class="live-dot"></span>'}${s.season}${s.status === "final" ? "" : ` · Wk ${s.through_week}`}</button>`).join("");
  document.querySelectorAll("#season-seg button").forEach((b) => b.addEventListener("click", () => setSeason(Number(b.dataset.season))));
  document.querySelectorAll("#view-seg button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  const saved = Number(store.get("nfldi.season"));
  setSeason(seasons.some((s) => s.season === saved) ? saved : seasons.find((s) => s.status === "final")?.season ?? seasons[0].season, false);
  setView(store.get("nfldi.view") === "competitive" ? "competitive" : "all", false);
  initSearch();
  window.addEventListener("hashchange", render);
  render();
}

boot();
