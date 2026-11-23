import { state, seasonData, scoped, view, gameWP, seasonMeta, router } from "./data.js";
import {
  esc, pct, pp, signed, num, clock, qlabel, fieldPos, downDist, scoreText, weekLabel, weekShort,
  teamName, icon, tip, verdictHtml, smallSample, OPT, OPT_SHORT, TIER, ERR, SMALL_N, TEAMS,
} from "./util.js";
import { rankChart, dumbbell, lineChart, heatmap, wpChart, fieldGraphic, intervalBar } from "./charts.js";

const FIELD_ZONES = ["Own 1-19", "Own 20-29", "Own 30-39", "Own 40-49", "Opp 41-50", "Opp 31-40", "Opp 21-30", "Opp 11-20", "Opp 1-10"];
const YTG = ["1", "2", "3", "4-5", "6-7", "8-10", "11+"];

const negpp = (x) => (x >= 0.05 ? `−${x.toFixed(1)}` : "0.0");
const tbadge = (t) => `<span class="tbadge">${esc(t)}</span>`;
const optTag = (c) => `<span class="opt ${c}">${OPT_SHORT[c]}</span>`;
const tierTag = (t) => `<span class="tier ${t}">${TIER[t]}</span>`;
const warnTag = () => `<span class="small-n" data-tip="${tip("Small sample", [["Threshold", `< ${SMALL_N.decisions} decisions or < ${SMALL_N.games} games`]])}">${icon("alert", 'width="12" height="12"')}small n</span>`;
const scopeNote = () => state.view === "competitive"
  ? `<span class="chip"><span class="sw" style="background:var(--accent)"></span>Competitive only (best option WP 2–98%)</span>` : "";

function head(eyebrow, title, lede = "", right = "") {
  return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1 class="title">${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</div><div>${right}</div></div>`;
}

function stat(k, v, d = "", extra = "") {
  return `<div class="panel stat hud"><div class="k">${k}</div><div class="v">${v}</div>${extra}<div class="d">${d}</div></div>`;
}

function situation(d) {
  return `${downDist(d)} · ${fieldPos(d.yl, d.pos, d.def)} · ${qlabel(d.qtr)} ${clock(d.clock)} · ${scoreText(d.sd)}`;
}

function decisionRow(d, { showTeam = true } = {}) {
  return `<a class="tl-item" href="#/decision/${d.id}">
    <div class="when">${qlabel(d.qtr)} ${clock(d.clock)}</div>
    <div>${showTeam ? tbadge(d.pos) : optTag(d.choice)}</div>
    <div class="sit"><div>${downDist(d)} at ${fieldPos(d.yl, d.pos, d.def)} · ${scoreText(d.sd)}${showTeam ? ` · chose ${optTag(d.choice)}` : ""}</div><div class="d">${esc(d.desc)}</div></div>
    <div class="q">${verdictHtml(d)}</div>
    <div class="cst mono" data-tip="${tip("Estimated WP cost", [["vs model's best", pp(d.cost, 2)]])}">${d.cost >= 0.005 ? `−${d.cost.toFixed(2)}` : "0.00"}<span class="dim"> pp</span></div>
  </a>`;
}

function compactRow(d) {
  return `<a class="tl-item" href="#/decision/${d.id}" style="grid-template-columns:44px minmax(0,1fr) auto;gap:10px;padding:9px 12px">
    <div>${tbadge(d.pos)}</div>
    <div class="sit"><div>${downDist(d)} · ${qlabel(d.qtr)} ${clock(d.clock)}</div><div class="d">${weekLabel(d.week, d.stype)} · chose ${OPT_SHORT[d.choice]} · model ${OPT_SHORT[d.best]}</div></div>
    <div class="mono" style="font-size:12.5px;${d.cost >= 1 ? "color:var(--serious)" : ""}">−${d.cost.toFixed(1)}</div></a>`;
}

// ===================================================================
// Overview
// ===================================================================
export async function overview() {
  const { summary } = await seasonData();
  const v = view(summary);
  const L = v.league;
  const meta = seasonMeta();
  const live = meta.status !== "final";
  const consShare = (L.cost_by_error.too_conservative || 0) / L.wp_cost;

  const cells = v.grid_field_ytg.filter((c) => c.n >= 30).sort((a, b) => a.gap - b.gap);
  const worst = cells[0];
  const q4 = v.by_phase.find((p) => p.key === "Q4 final 5 min");

  const teams = [...v.teams].sort((a, b) => b.wp_cost_per_game - a.wp_cost_per_game);
  const rank = rankChart(teams.map((t) => ({
    label: t.team, value: t.wp_cost_per_game, lo: t.wp_cost_per_game_lo, hi: t.wp_cost_per_game_hi, href: `#/team/${t.team}`, warn: smallSample(t),
    tip: tip(teamName(t.team), [["WP cost / game", pp(t.wp_cost_per_game, 2)], ["90% interval", `${t.wp_cost_per_game_lo.toFixed(2)} – ${t.wp_cost_per_game_hi.toFixed(2)}`], ["Decisions", t.decisions], ["Games", t.games], ["Went for it", pct(t.go_rate)], ["Model said go", pct(t.model_go_rate)]]),
  })), { unit: "pp/game", digits: 2, rowH: 21 });

  const top = summary.top_costly.map((id) => summary._index.get(id)).filter((d) => d && (state.view === "all" || d.comp)).slice(0, 8);
  const weekly = v.weekly;
  const trend = lineChart([
    { name: "Model: go", color: "var(--go)", values: weekly.map((w) => ({ x: w.week, y: w.model_go_rate })) },
    { name: "Actual: go", color: "var(--text)", values: weekly.map((w) => ({ x: w.week, y: w.go_rate })) },
  ], { xLabel: weekShort, yMax: 0.8, tipFn: (x) => { const w = weekly.find((r) => r.week === x); return tip(weekLabel(x, x > 18 ? "POST" : "REG"), [["Decisions", w.n], ["Model said go", pct(w.model_go_rate)], ["Went for it", pct(w.go_rate)], ["Followed clear-go calls", pct(w.clear_go_rate)], ["WP cost (league)", pp(w.wp_cost, 1)]]); } });

  return `
  ${head(`${meta.season} season · ${live ? `Live through week ${meta.through_week}` : "Final"}`,
    `How much win probability do NFL coaches <span class="grad">leave on the table</span> on fourth down?`,
    `Every fourth-down decision in the ${meta.season} season, scored against nfl4th's model using only what was known before the snap. Decision quality is judged separately from how the play turned out.`, scopeNote())}

  <div class="grid g-4">
    ${stat("Decisions analyzed", num(L.decisions), `${num(L.games)} games${live ? ` · ${meta.pending_games} pending model values` : ""}`)}
    ${stat("Went for it", pct(L.go_rate), `Model recommended going in <b>${pct(L.model_go_rate)}</b>`,
      `<div class="bar" data-tip="${tip("Go rate", [["Actual", pct(L.go_rate)], ["Model recommended", pct(L.model_go_rate)]])}"><i style="width:${100 * L.go_rate}%;background:var(--text)"></i><b style="left:${100 * L.model_go_rate}%;background:var(--go)"></b></div>`)}
    ${stat("Followed clear “go” calls", pct(L.clear_go_rate), `${num(L.clear_go)} situations where the model's 80% interval favoured going`)}
    ${stat("WP forgone per team-game", `${L.wp_cost_per_game_team.toFixed(2)}<small>pp</small>`, `${num(L.wp_cost, 0)} pp across the league (model estimate)`)}
  </div>

  <div class="insights" style="margin-top:16px">
    <div class="panel insight"><div class="ic">${icon("scale")}</div><div><h3>Caution costs more than aggression</h3><p>${pct(consShare, 0)} of the estimated win probability forgone came from kicking when the model favoured going (${num(L.count_by_error.too_conservative || 0)} decisions), versus ${num(L.count_by_error.too_aggressive || 0)} decisions where teams went for it against the model.</p></div></div>
    ${worst ? `<div class="panel insight"><div class="ic">${icon("bolt")}</div><div><h3>Most-missed spot: 4th &amp; ${esc(worst.col)}, ${esc(worst.row)}</h3><p>Teams went for it ${pct(worst.go_rate, 0)} of the time; the model favoured going ${pct(worst.model_go_rate, 0)} of the time (n = ${worst.n}).</p></div></div>` : ""}
    ${q4 ? `<div class="panel insight"><div class="ic">${icon("clock")}</div><div><h3>${q4.model_go_rate - q4.go_rate < L.model_go_rate - L.go_rate ? "Late-game urgency narrows the gap" : "The gap persists late in games"}</h3><p>In the final 5 minutes of the 4th quarter teams went for it ${pct(q4.go_rate, 0)} vs. the model's ${pct(q4.model_go_rate, 0)}, compared with ${pct(L.go_rate, 0)} vs. ${pct(L.model_go_rate, 0)} overall. Average estimated cost per decision there: ${pp(q4.mean_cost, 2)} (${q4.mean_cost > L.wp_cost / L.decisions ? "above" : "below"} the ${pp(L.wp_cost / L.decisions, 2)} season average; n = ${q4.n}).</p></div></div>` : ""}
  </div>

  <div class="grid g-main" style="margin-top:16px">
    <div class="panel">
      <div class="panel-head"><div><h2 class="sec">Win probability left on the table, per game</h2><div class="sec-sub">Model-estimated WP forgone per game · line = 90% bootstrap interval over games · ⚠ small sample</div></div><a class="panel-link" href="#/teams">Team reports →</a></div>
      ${rank}
    </div>
    <div class="panel">
      <div class="panel-head"><div><h2 class="sec">Costliest decisions</h2><div class="sec-sub">Largest gap between chosen and best option</div></div><a class="panel-link" href="#/decisions?sort=cost">All decisions →</a></div>
      <div class="tl">${top.map((d) => `<a class="tl-item" href="#/decision/${d.id}" style="grid-template-columns:54px minmax(0,1fr) auto">
        <div>${tbadge(d.pos)}</div>
        <div class="sit"><div>${downDist(d)} · ${qlabel(d.qtr)} ${clock(d.clock)} · ${scoreText(d.sd)}</div><div class="d">Chose ${OPT_SHORT[d.choice]} · model: ${OPT_SHORT[d.best]} · ${weekLabel(d.week, d.stype)} vs ${esc(d.def)}</div></div>
        <div class="mono" style="color:var(--serious)">−${d.cost.toFixed(1)}<span class="dim"> pp</span></div></a>`).join("")}</div>
    </div>
  </div>

  <div class="grid g-main" style="margin-top:16px">
    <div class="panel">
      <div class="panel-head"><div><h2 class="sec">Where teams diverge from the model</h2><div class="sec-sub">Field position × yards to go · click a cell to see those decisions</div></div></div>
      ${heatmap(v.grid_field_ytg, FIELD_ZONES, YTG, { rowTitle: "FIELD ↓ / YTG →", colTitle: "columns = yards to go", onCell: (c) => `#/decisions?zone=${encodeURIComponent(c.row)}&ytg=${encodeURIComponent(c.col)}` })}
    </div>
    <div class="panel">
      <div class="panel-head"><div><h2 class="sec">Go rate by week</h2><div class="sec-sub">Share of decisions: actual vs. model-recommended</div></div></div>
      ${trend}
      <div class="legend" style="margin-top:8px"><span><i style="background:var(--text)"></i>Actual go rate</span><span><i style="background:var(--go)"></i>Model-recommended go rate</span></div>
      <div class="callout" style="margin-top:14px">The model recommends going far more often than teams do, but many of those calls are close. On <b>clear</b> calls (the model's interval excludes zero), teams agreed with the model's go/kick call ${pct(L.clear_agree_rate, 0)} of the time.</div>
    </div>
  </div>`;
}

// ===================================================================
// Games
// ===================================================================
export async function games(params) {
  const { summary } = await seasonData();
  const weeks = [...new Set(summary.games.map((g) => g.week))].sort((a, b) => a - b);
  const team = params.get("team") || "";
  const week = Number(params.get("week")) || (team ? null : weeks[weeks.length - 1]);
  let list = summary.games;
  if (team) list = list.filter((g) => g.home === team || g.away === team);
  if (week) list = list.filter((g) => g.week === week);
  const teams = Object.keys(TEAMS);
  const qs = (o) => "#/games?" + new URLSearchParams(Object.entries({ week, team, ...o }).filter(([, v]) => v)).toString();

  return `${head("Game explorer", "Every game, every fourth down", "Pick a week or a team, then open a game to see its win-probability flow and each decision point.", scopeNote())}
  <div class="filters">
    <div class="week-chips">${(team ? [`<button class="${!week ? "on" : ""}" data-go="${qs({ week: "" })}">All</button>`] : []).join("")}${weeks.map((w) => `<button class="${w === week ? "on" : ""}" data-go="${qs({ week: w })}" title="${weekLabel(w, w > 18 ? "POST" : "REG")}">${weekShort(w)}</button>`).join("")}</div>
    <select class="select" data-param="team" data-reset="week">
      <option value="">All teams</option>${teams.map((t) => `<option ${t === team ? "selected" : ""} value="${t}">${t} · ${teamName(t)}</option>`).join("")}
    </select>
  </div>
  <div class="games">${list.map((g) => gameCard(g)).join("") || '<div class="empty-state">No games</div>'}</div>`;
}

function gameCard(g) {
  const hw = g.home_score > g.away_score, aw = g.away_score > g.home_score;
  return `<a class="panel game-card" href="#/game/${g.game_id}">
    <div class="dim" style="font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">${weekLabel(g.week, g.stype)} · ${esc(g.date)}</div>
    <div class="row"><div class="tm">${tbadge(g.away)}${esc(teamName(g.away))}</div><div class="sc ${hw ? "lose" : ""}">${g.away_score}</div></div>
    <div class="row"><div class="tm">${tbadge(g.home)}${esc(teamName(g.home))}</div><div class="sc ${aw ? "lose" : ""}">${g.home_score}</div></div>
    <div class="foot">${g.pending ? `<span class="chip" style="color:var(--warn)">Model values pending</span>` : `<span>${g.n_dec} decisions</span><span class="cost-pill" data-tip="${tip("WP forgone (model est.)", [[g.away, pp(g.cost_away, 2)], [g.home, pp(g.cost_home, 2)]])}">${g.away} ${negpp(g.cost_away)} · ${g.home} ${negpp(g.cost_home)} pp</span>`}</div>
  </a>`;
}

export async function game(id) {
  const { summary } = await seasonData();
  const g = summary._games.get(id);
  if (!g) return notFound("Game");
  const decs = (summary._byGame.get(id) || []).filter((d) => state.view === "all" || d.comp);
  let chart = '<div class="empty-state">No win-probability data</div>';
  try {
    const wp = (await gameWP(state.season, id)).wp;
    if (wp.length) chart = wpChart(wp, decs, g);
  } catch { /* ignore */ }
  const costs = { [g.home]: 0, [g.away]: 0 };
  decs.forEach((d) => { costs[d.pos] += d.cost; });
  const side = (t, right) => `<div class="sb-team ${right ? "right" : ""}">${right ? "" : tbadge(t)}<div><div class="big">${esc(t)}</div><div class="coach">${esc(teamName(t))} · ${esc(t === g.home ? g.home_coach : g.away_coach)}</div><div class="coach mono">${decs.filter((d) => d.pos === t).length} decisions · ${negpp(costs[t])} pp</div></div>${right ? tbadge(t) : ""}</div>`;

  return `${head(`${weekLabel(g.week, g.stype)} · ${esc(g.date)}`, `${esc(teamName(g.away))} at ${esc(teamName(g.home))}`, "", scopeNote())}
  <div class="panel hud scoreboard">${side(g.away, false)}<div class="sb-score">${g.away_score} – ${g.home_score}<small>Final</small></div>${side(g.home, true)}</div>
  <div class="panel" style="margin-top:16px">
    <div class="panel-head"><div><h2 class="sec">Win probability &amp; fourth-down decisions</h2><div class="sec-sub">nflfastR home win probability · markers are decisions (click to open)</div></div>
      <div class="legend"><span><i class="dot" style="background:var(--go)"></i>Go</span><span><i class="dot" style="background:var(--punt)"></i>Punt</span><span><i class="dot" style="background:var(--fg)"></i>Field goal</span><span><i class="dot" style="background:transparent;border:2px solid var(--serious)"></i>Cost ≥ 1 pp</span></div></div>
    ${chart}
  </div>
  <div class="panel" style="margin-top:16px">
    <div class="panel-head"><h2 class="sec">Decision timeline</h2>${g.pending ? '<span class="chip" style="color:var(--warn)">Model values pending for this game</span>' : ""}</div>
    <div class="tl">${decs.map((d) => decisionRow(d)).join("") || '<div class="empty-state">No eligible decisions</div>'}</div>
  </div>`;
}

// ===================================================================
// Decision detail
// ===================================================================
function optionCards(d, { selected = null, clickable = false } = {}) {
  return `<div class="option-cards">${["go", "punt", "fg"].map((o) => {
    const wp = d[`${o}_wp`];
    const na = wp == null;
    const tags = [
      o === d.best ? '<span class="tag best">Model best</span>' : "",
      o === d.choice ? '<span class="tag chosen">Chosen</span>' : "",
      selected && o === selected && o !== d.choice ? '<span class="tag alt">What-if</span>' : "",
    ].join("");
    const delta = na ? "" : o === d.best ? "best option" : `${signed(100 * (wp - d.best_wp), 2)} pp vs best`;
    return `<${clickable && !na ? `button data-alt="${o}"` : "div"} class="option-card ${o} ${o === d.best ? "best" : ""} ${na ? "na" : ""} ${selected === o ? "sel" : ""} ${clickable && !na ? "clickable" : ""}">
      <span class="opt ${o}">${OPT[o]}</span>
      <div class="pct">${na ? "n/a" : pct(wp)}</div>
      <div class="dim" style="font-size:12px">${na ? "Not modeled as available here" : `Win probability · ${delta}`}</div>
      <div class="meter"><i style="width:${na ? 0 : 100 * wp}%"></i></div>
      <div class="lbls">${tags}</div>
    </${clickable && !na ? "button" : "div"}>`;
  }).join("")}</div>`;
}

function explanation(d) {
  const opts = ["go", "punt", "fg"].filter((o) => d[`${o}_wp`] != null).sort((a, b) => d[`${b}_wp`] - d[`${a}_wp`]);
  const margin = opts.length > 1 ? 100 * (d[`${opts[0]}_wp`] - d[`${opts[1]}_wp`]) : null;
  const clear = d.tier !== "toss_up";
  const chosen = d.choice === d.best
    ? `${esc(d.pos)} chose <b>${OPT[d.choice].toLowerCase()}</b>, matching the model.`
    : `${esc(d.pos)} chose <b>${OPT[d.choice].toLowerCase()}</b>; under the model that is <b>${pp(d.cost, 2)}</b> of win probability below the best option.`;
  return `<p style="margin:0 0 10px">The model's best option is <b>${OPT[d.best].toLowerCase()}</b>${margin != null ? `, ahead of ${OPT[opts[1]].toLowerCase()} by ${pp(margin, 2)}` : ""}. ${chosen}</p>
  <p style="margin:0 0 10px">On the go-vs-kick question, nfl4th's 80% bootstrap interval runs from <b>${signed(d.gb_lo, 2)}</b> to <b>${signed(d.gb_hi, 2)} pp</b> and ${d.boot_go_pct != null ? `${Math.round(d.boot_go_pct)}% of draws favoured going` : ""}. ${clear ? "The interval excludes zero, so this is treated as a <b>clear</b> call." : "The interval spans zero, so this is a <b>close call</b>: reasonable coaches could disagree, and the cost should be read loosely."}</p>
  <p style="margin:0" class="dim">The model accounts for down, distance, field position, score, clock, timeouts, the pre-game spread and total (a proxy for team strength) and roof type. It does not know the specific kicker, injuries, the play call, or weather beyond roof type. The interval only covers nfl4th's own conversion and first-down models, so true uncertainty is wider.</p>`;
}

export async function decision(id) {
  const { summary } = await seasonData();
  const d = summary._index.get(id);
  if (!d) return notFound("Decision");
  const g = summary._games.get(d.game_id);
  const sameGame = summary._byGame.get(d.game_id) || [];
  const i = sameGame.findIndex((x) => x.id === id);
  const prev = sameGame[i - 1], next = sameGame[i + 1];
  const o = d.out;
  const outcome = d.choice === "go"
    ? (o.conv == null ? "Result unclear" : o.conv ? "Converted" : "Failed to convert") + (o.td ? " · touchdown" : "")
    : d.choice === "fg" ? `Field goal ${o.fg ? o.fg.replace("_", " ") : "result unknown"}` : "Punted";

  return `${head(`${weekLabel(d.week, d.stype)} · <a href="#/game/${d.game_id}">${esc(d.away)} at ${esc(d.home)}</a>`,
    `${esc(teamName(d.pos))} · ${downDist(d)}, ${qlabel(d.qtr)} ${clock(d.clock)}`, "",
    `<div style="display:flex;gap:8px;flex-wrap:wrap">${prev ? `<a class="btn" href="#/decision/${prev.id}">← Prev</a>` : ""}${next ? `<a class="btn" href="#/decision/${next.id}">Next →</a>` : ""}<a class="btn primary" href="#/lab/${d.id}">${icon("lab")}What-if lab</a></div>`)}

  <div class="grid g-main">
    <div class="panel hud">
      <div class="panel-head"><h2 class="sec">Situation</h2><div style="display:flex;gap:8px;align-items:center">${tierTag(d.tier)}${verdictHtml(d)}</div></div>
      ${fieldGraphic(d)}
      <dl class="kv" style="margin-top:14px">
        <div><dt>Ball on</dt><dd>${fieldPos(d.yl, d.pos, d.def)}</dd></div>
        <div><dt>To go</dt><dd>${d.gtg ? `Goal (${d.yl})` : d.ytg}</dd></div>
        <div><dt>Score</dt><dd>${esc(d.pos)} ${d.ps} – ${d.ds} ${esc(d.def)}</dd></div>
        <div><dt>Clock</dt><dd>${qlabel(d.qtr)} ${clock(d.clock)}</dd></div>
        <div><dt>Timeouts</dt><dd>${d.to_pos ?? "—"} / ${d.to_def ?? "—"}</dd></div>
        <div><dt>Pre-game line</dt><dd>${d.spread == null ? "—" : d.spread > 0 ? `${esc(d.pos)} −${d.spread}` : d.spread < 0 ? `${esc(d.pos)} +${-d.spread}` : "Pick"}</dd></div>
        <div><dt>Coach</dt><dd style="font-family:var(--font)"><a href="#/coach/${encodeURIComponent(d.coach)}">${esc(d.coach)}</a></dd></div>
        <div><dt>Roof</dt><dd>${esc(d.roof || "—")}</dd></div>
      </dl>
      ${d.prior ? `<div class="callout warn" style="margin-top:14px">This decision followed ${d.prior} earlier snap${d.prior > 1 ? "s" : ""} on the same 4th down (e.g. a pre-snap penalty). It is valued at the final snap's situation.</div>` : ""}
      ${d.flags.includes("fake_punt") || d.flags.includes("fake_fg") ? `<div class="callout" style="margin-top:14px">Fake ${d.flags.includes("fake_punt") ? "punt" : "field goal"}: counted as a decision to <b>go for it</b>.</div>` : ""}
    </div>
    <div class="panel">
      <div class="panel-head"><h2 class="sec">Decision quality</h2><span class="dim" style="font-size:12px">judged before the snap</span></div>
      <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px">
        <div class="delta-big ${d.cost >= 0.05 ? "neg" : "pos"}">${d.cost >= 0.05 ? `−${d.cost.toFixed(2)}` : "0.00"}</div><div class="muted">pp win probability vs. the model's best option</div>
      </div>
      <div style="display:flex;gap:16px;margin:10px 0 4px;flex-wrap:wrap"><span class="muted">Chose ${optTag(d.choice)}</span><span class="muted">Model ${optTag(d.best)}</span></div>
      <div style="margin-top:12px">${d.gb_lo != null ? intervalBar(d) : ""}</div>
      <div class="sec-sub" style="margin-top:4px">Go − best kick (pp) · bar = nfl4th 80% bootstrap interval</div>
    </div>
  </div>

  <div class="panel" style="margin-top:16px">
    <div class="panel-head"><div><h2 class="sec">Options as the model saw them</h2><div class="sec-sub">Estimated win probability for ${esc(d.pos)} under each choice</div></div></div>
    ${optionCards(d)}
    <div style="margin-top:16px;font-size:14px;color:var(--text-2)">${explanation(d)}</div>
  </div>

  <div class="grid g-2" style="margin-top:16px">
    <div class="panel">
      <div class="panel-head"><div><h2 class="sec">What happened</h2><div class="sec-sub">Shown for context only. Not used to grade the decision.</div></div></div>
      <dl class="kv"><div><dt>Result</dt><dd style="font-family:var(--font)">${outcome}</dd></div>
      <div><dt>WP added</dt><dd>${o.wpa == null ? "—" : `${signed(100 * o.wpa, 1)} pp`}</dd></div>
      <div><dt>Game result</dt><dd style="font-family:var(--font)">${o.won == null ? "Tie" : o.won ? `${esc(d.pos)} won` : `${esc(d.pos)} lost`}</dd></div></dl>
      <div class="desc-box" style="margin-top:14px">${esc(d.desc)}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2 class="sec">Reading this fairly</h2></div>
      <ul style="margin:0;padding-left:18px;color:var(--text-2);font-size:13.5px;display:grid;gap:6px">
        <li>A good decision can fail and a poor one can work. The grade uses only pre-snap information.</li>
        <li>“Cost” is a model estimate of win probability given up, not a claim that the decision changed the result.</li>
        <li>Coaches may know things the model does not: injuries, matchups, weather, their own kicker.</li>
        <li>Values: <a class="panel-link" href="https://github.com/nflverse/nfl4th" target="_blank" rel="noopener">nfl4th</a> (Ben Baldwin) on <a class="panel-link" href="https://github.com/nflverse/nflverse-data" target="_blank" rel="noopener">nflverse</a> play-by-play. <a class="panel-link" href="#/methodology">Methodology →</a></li>
      </ul>
    </div>
  </div>`;
}

// ===================================================================
// Decisions explorer
// ===================================================================
export async function decisionsList(params) {
  const { decisions } = await seasonData();
  const f = Object.fromEntries(params.entries());
  const page = Number(f.page || 1), per = 40;
  const zoneOf = (yl) => (yl <= 10 ? "Opp 1-10" : yl <= 20 ? "Opp 11-20" : yl <= 30 ? "Opp 21-30" : yl <= 40 ? "Opp 31-40" : yl <= 50 ? "Opp 41-50"
    : yl <= 60 ? "Own 40-49" : yl <= 70 ? "Own 30-39" : yl <= 80 ? "Own 20-29" : "Own 1-19");
  const ytgOf = (y) => (y <= 1 ? "1" : y <= 2 ? "2" : y <= 3 ? "3" : y <= 5 ? "4-5" : y <= 7 ? "6-7" : y <= 10 ? "8-10" : "11+");
  let rows = scoped(decisions).filter((d) =>
    (!f.team || d.pos === f.team) && (!f.choice || d.choice === f.choice) && (!f.best || d.best === f.best) &&
    (!f.tier || d.tier === f.tier) && (!f.err || (f.err === "agree" ? !d.err : d.err === f.err)) &&
    (!f.qtr || (f.qtr === "5" ? d.qtr >= 5 : d.qtr === Number(f.qtr))) &&
    (!f.zone || zoneOf(d.yl) === f.zone) && (!f.ytg || ytgOf(d.ytg) === f.ytg));
  const sort = f.sort || "cost";
  const sorters = { cost: (a, b) => b.cost - a.cost, time: (a, b) => a.week - b.week || a.game_id.localeCompare(b.game_id) || a.play_id - b.play_id, gb: (a, b) => b.gb - a.gb };
  rows = rows.sort(sorters[sort] || sorters.cost);
  const total = rows.length, pages = Math.max(1, Math.ceil(total / per));
  const shown = rows.slice((page - 1) * per, page * per);
  const set = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); if (k !== "page") p.delete("page"); return "#/decisions?" + p; };
  const sel = (k, opts, label) => `<select class="select" data-param="${k}"><option value="">${label}</option>${opts.map(([v, t]) => `<option value="${v}" ${f[k] === v ? "selected" : ""}>${t}</option>`).join("")}</select>`;
  const teams = [...new Set(decisions.map((d) => d.pos))].sort();
  const went = total ? rows.filter((d) => d.choice === "go").length / total : null;
  const modelGo = total ? rows.filter((d) => d.gb > 0).length / total : null;
  const cost = rows.reduce((s, d) => s + d.cost, 0);

  return `${head("Decision explorer", "Search every fourth-down call", "Filter by team, situation, model verdict or confidence tier. Click any row for the full breakdown.", scopeNote())}
  <div class="filters">
    ${sel("team", teams.map((t) => [t, `${t} · ${teamName(t)}`]), "All teams")}
    ${sel("choice", [["go", "Went for it"], ["punt", "Punted"], ["fg", "Field goal"]], "Any choice")}
    ${sel("best", [["go", "Model: go"], ["punt", "Model: punt"], ["fg", "Model: FG"]], "Any model call")}
    ${sel("tier", [["clear_go", "Clear go"], ["clear_kick", "Clear kick"], ["toss_up", "Toss-up"]], "Any tier")}
    ${sel("err", [["agree", "Matches model"], ["too_conservative", "Too conservative"], ["too_aggressive", "Too aggressive"], ["wrong_kick", "Wrong kick"]], "Any verdict")}
    ${sel("qtr", [["1", "Q1"], ["2", "Q2"], ["3", "Q3"], ["4", "Q4"], ["5", "OT"]], "Any quarter")}
    ${sel("zone", FIELD_ZONES.map((z) => [z, z]), "Any field zone")}
    ${sel("ytg", YTG.map((y) => [y, `4th & ${y}`]), "Any distance")}
    ${sel("sort", [["cost", "Sort: largest cost"], ["gb", "Sort: strongest go signal"], ["time", "Sort: chronological"]], "Sort: largest cost")}
    ${params.toString() ? `<a class="btn" href="#/decisions">Clear</a>` : ""}
  </div>
  <div class="grid g-4" style="margin-bottom:16px">
    ${stat("Matching decisions", num(total))}${stat("Went for it", pct(went), `Model recommended going: ${pct(modelGo)}`)}
    ${stat("Total WP forgone", `${num(cost, 1)}<small>pp</small>`)}${stat("Avg per decision", `${total ? (cost / total).toFixed(2) : "—"}<small>pp</small>`)}
  </div>
  <div class="panel"><div class="table-wrap"><table class="data">
    <thead><tr><th>Game</th><th>Team</th><th>Situation</th><th>Chose</th><th>Model</th><th>Tier</th><th class="r">Go − kick</th><th class="r">Cost</th></tr></thead>
    <tbody>${shown.map((d) => `<tr class="rowlink" data-go="#/decision/${d.id}">
      <td class="dim mono" style="font-size:12px">${weekShort(d.week)} · ${esc(d.away)}@${esc(d.home)}</td><td class="team">${esc(d.pos)}</td>
      <td>${situation(d)}</td><td>${optTag(d.choice)}</td><td>${optTag(d.best)}</td><td>${tierTag(d.tier)}</td>
      <td class="r mono">${signed(d.gb, 2)}</td><td class="r mono" style="${d.cost >= 1 ? "color:var(--serious)" : ""}">${d.cost.toFixed(2)}</td></tr>`).join("") || `<tr><td colspan="8" class="empty-state">No decisions match.</td></tr>`}</tbody>
  </table></div>
  <div class="pager"><span>Page ${page} of ${pages} · ${num(total)} decisions</span><span style="display:flex;gap:8px">${page > 1 ? `<a class="btn" href="${set("page", page - 1)}">← Prev</a>` : ""}${page < pages ? `<a class="btn" href="${set("page", page + 1)}">Next →</a>` : ""}</span></div></div>`;
}

// ===================================================================
// Teams & coaches
// ===================================================================
const COLS = [
  ["name", "Team", null], ["decisions", "Decisions", "r"], ["go_rate", "Went for it", "r"], ["model_go_rate", "Model: go", "r"],
  ["clear_go_rate", "Followed clear go", "r"], ["agree_rate", "Agreed w/ model", "r"], ["wp_cost_per_game", "WP cost / game", "r"], ["wp_cost", "Total WP cost", "r"],
];

function unitTable(rows, kind, params) {
  const sort = params.get("sort") || "wp_cost_per_game";
  const dir = params.get("dir") === "asc" ? 1 : -1;
  const key = (r) => (sort === "name" ? r.name : r[sort] ?? -1);
  rows = [...rows].sort((a, b) => (key(a) > key(b) ? dir : key(a) < key(b) ? -dir : 0));
  const maxCost = Math.max(...rows.map((r) => r.wp_cost_per_game_hi || r.wp_cost_per_game));
  const th = ([k, label, cls]) => {
    const next = sort === k && dir === -1 ? "asc" : "desc";
    return `<th class="${cls || ""} ${sort === k ? "sorted" : ""}" data-go="#/${kind}?sort=${k}&dir=${next}">${label}<span class="arrow">${sort === k ? (dir === -1 ? "▼" : "▲") : "↕"}</span></th>`;
  };
  return `<div class="table-wrap"><table class="data"><thead><tr>${COLS.map((c) => th(kind === "coaches" && c[0] === "name" ? ["name", "Coach", null] : c)).join("")}</tr></thead><tbody>
  ${rows.map((r) => `<tr class="rowlink" data-go="${r.href}">
    <td><div class="team-cell">${r.badge}<div><div style="font-weight:600;white-space:nowrap">${esc(r.name)}</div><div class="dim" style="font-size:12px">${esc(r.sub)} ${smallSample(r) ? warnTag() : ""}</div></div></div></td>
    <td class="r mono">${r.decisions}<span class="dim"> / ${r.games}g</span></td>
    <td class="r mono">${pct(r.go_rate)}</td><td class="r mono dim">${pct(r.model_go_rate)}</td>
    <td class="r mono">${pct(r.clear_go_rate, 0)}<span class="dim"> (${r.clear_go})</span></td>
    <td class="r mono">${pct(r.agree_rate, 0)}</td>
    <td class="r"><div style="display:flex;align-items:center;gap:10px;justify-content:flex-end" data-tip="${tip(r.name, [["WP cost / game", pp(r.wp_cost_per_game, 2)], ["90% interval", `${r.wp_cost_per_game_lo?.toFixed(2)} – ${r.wp_cost_per_game_hi?.toFixed(2)}`]])}">
      <span class="mono">${r.wp_cost_per_game.toFixed(2)}</span>
      <div class="minibar" style="width:110px"><i style="left:${(100 * (r.wp_cost_per_game_lo || 0)) / maxCost}%;width:${(100 * ((r.wp_cost_per_game_hi || 0) - (r.wp_cost_per_game_lo || 0))) / maxCost}%;background:var(--accent);opacity:.35"></i><i style="left:calc(${(100 * r.wp_cost_per_game) / maxCost}% - 2px);width:4px;background:var(--accent)"></i></div></div></td>
    <td class="r mono">${r.wp_cost.toFixed(1)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

export async function teams(params) {
  const { summary } = await seasonData();
  const v = view(summary);
  const rows = v.teams.map((t) => ({ ...t, name: teamName(t.team), sub: "", badge: tbadge(t.team), href: `#/team/${t.team}` }));
  const byGap = [...v.teams].sort((a, b) => (a.go_rate - a.model_go_rate) - (b.go_rate - b.model_go_rate));
  return `${head("Team intelligence", "Team decision reports", "How often each team went for it compared with the model, how often they followed clear calls, and how much win probability the model estimates they gave up. Lines and bars show 90% intervals; ⚠ marks small samples.", scopeNote())}
  <div class="grid">
    <div class="panel"><div class="panel-head"><div><h2 class="sec">All teams</h2><div class="sec-sub">Click a column to sort · click a row for the full report</div></div></div>${unitTable(rows, "teams", params)}</div>
    <div class="panel"><div class="panel-head"><div><h2 class="sec">Aggressiveness vs. model</h2><div class="sec-sub">Go rate: actual vs. model-recommended, most conservative first</div></div></div>
      <div class="legend" style="margin-bottom:8px"><span><i class="dot" style="background:var(--text)"></i>Actual</span><span><i class="dot" style="background:var(--go)"></i>Model recommended</span></div>
      ${dumbbell(byGap.map((t) => ({ label: t.team, a: t.go_rate, b: t.model_go_rate, href: `#/team/${t.team}`, tip: tip(teamName(t.team), [["Went for it", pct(t.go_rate)], ["Model said go", pct(t.model_go_rate)], ["Gap", `${signed(100 * (t.go_rate - t.model_go_rate), 1)} pts`], ["Decisions", t.decisions]]) })), { rowH: 20, labelW: 50, width: 1100 })}
    </div>
  </div>`;
}

export async function coaches(params) {
  const { summary } = await seasonData();
  const v = view(summary);
  const rows = v.coaches.map((c) => ({ ...c, name: c.coach, sub: c.teams.join(", "), badge: tbadge(c.teams[c.teams.length - 1]), href: `#/coach/${encodeURIComponent(c.coach)}` }));
  return `${head("Coaching intelligence", "Head coach decision reports", "Decisions are attributed to the offense's head coach for that game (from nflverse). Coordinators may make some calls; the data cannot tell. Coaches with few games carry wide uncertainty.", scopeNote())}
  <div class="panel">${unitTable(rows, "coaches", params)}</div>`;
}

function unitReport(unit, decs, label, sub) {
  const byErr = (e) => decs.filter((d) => d.err === e).reduce((s, d) => s + d.cost, 0);
  const total = unit.wp_cost || 1e-9;
  const parts = [["too_conservative", "Kicked when model said go", "var(--div-neg)"], ["too_aggressive", "Went when model said kick", "var(--div-pos)"], ["wrong_kick", "Chose the weaker kick", "var(--text-3)"]];
  const byGame = new Map();
  for (const d of decs) { const k = d.game_id; if (!byGame.has(k)) byGame.set(k, { g: k, week: d.week, opp: d.def, cost: 0, n: 0 }); const r = byGame.get(k); r.cost += d.cost; r.n++; }
  const games = [...byGame.values()].sort((a, b) => a.week - b.week);
  const maxG = Math.max(1, ...games.map((g) => g.cost));
  const W = 640, H = 160, bw = Math.min(28, (W - 40) / Math.max(1, games.length) - 4);
  const bars = `<svg class="chart" viewBox="0 0 ${W} ${H + 22}">${games.map((g, i) => {
    const x = 30 + i * ((W - 40) / Math.max(1, games.length)), h = (g.cost / maxG) * H;
    return `<a href="#/game/${g.g}"><g data-tip="${tip(`${weekLabel(g.week, g.week > 18 ? "POST" : "REG")} vs ${g.opp}`, [["Decisions", g.n], ["WP cost", pp(g.cost, 2)]])}"><rect class="hit" x="${x}" y="0" width="${bw + 4}" height="${H + 20}"/><rect x="${x + 2}" y="${H - h}" width="${bw}" height="${Math.max(1, h)}" rx="4" fill="var(--accent)" fill-opacity=".8"/><text x="${x + 2 + bw / 2}" y="${H + 16}" text-anchor="middle">${weekShort(g.week)}</text></g></a>`;
  }).join("")}<line class="zero" x1="28" x2="${W}" y1="${H}" y2="${H}"/></svg>`;
  const worst = [...decs].sort((a, b) => b.cost - a.cost).slice(0, 8);
  const best = decs.filter((d) => d.choice === "go" && d.tier === "clear_go").sort((a, b) => b.gb - a.gb).slice(0, 5);

  return `${head(sub, esc(label), "", `${smallSample(unit) ? warnTag() : ""} ${scopeNote()}`)}
  <div class="grid g-4">
    ${stat("Decisions", num(unit.decisions), `${unit.games} games · ${unit.clear} clear calls`)}
    ${stat("Went for it", pct(unit.go_rate), `Model recommended going: <b>${pct(unit.model_go_rate)}</b>`, `<div class="bar"><i style="width:${100 * unit.go_rate}%;background:var(--text)"></i><b style="left:${100 * unit.model_go_rate}%;background:var(--go)"></b></div>`)}
    ${stat("Followed clear go calls", pct(unit.clear_go_rate, 0), `${unit.clear_go_went} of ${unit.clear_go}`)}
    ${stat("WP cost / game", `${unit.wp_cost_per_game.toFixed(2)}<small>pp</small>`, `90% interval ${unit.wp_cost_per_game_lo?.toFixed(2)} – ${unit.wp_cost_per_game_hi?.toFixed(2)} · total ${unit.wp_cost.toFixed(1)} pp`)}
  </div>
  <div class="grid g-main" style="margin-top:16px">
    <div class="panel"><div class="panel-head"><div><h2 class="sec">WP cost by game</h2><div class="sec-sub">Model-estimated win probability forgone per game (pp) · click a bar to open the game</div></div></div>${bars}</div>
    <div class="panel"><div class="panel-head"><div><h2 class="sec">Where the cost came from</h2><div class="sec-sub">Share of total WP cost by type of disagreement</div></div></div>
      <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;gap:2px;margin:6px 0 16px">${parts.map(([k, , c]) => `<i style="flex:${byErr(k) / total};background:${c}" data-tip="${tip(ERR[k], [["WP cost", pp(byErr(k), 2)]])}"></i>`).join("")}</div>
      ${parts.map(([k, l, c]) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font-size:13.5px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${c};margin-right:8px"></i>${l}</span><span class="mono">${byErr(k).toFixed(2)} pp · ${decs.filter((d) => d.err === k).length}</span></div>`).join("")}
      <div class="dim" style="font-size:12.5px;margin-top:10px">Went for it when the model said kick: ${pct(unit.go_rate_when_kick_rec)} · Went when model said go: ${pct(unit.go_rate_when_go_rec)}</div>
    </div>
  </div>
  <div class="grid g-2" style="margin-top:16px">
    <div class="panel"><div class="panel-head"><h2 class="sec">Costliest decisions</h2><a class="panel-link" href="#/decisions?team=${decs[0]?.pos || ""}">All →</a></div><div class="tl">${worst.map((d) => decisionRow(d)).join("")}</div></div>
    <div class="panel"><div class="panel-head"><h2 class="sec">Strongest go calls they made</h2></div><div class="tl">${best.map((d) => decisionRow(d)).join("") || '<div class="empty-state">None</div>'}</div></div>
  </div>`;
}

export async function team(abbr) {
  const { summary, decisions } = await seasonData();
  const v = view(summary);
  const t = v.teams.find((x) => x.team === abbr);
  if (!t) return notFound("Team");
  const coachesFor = [...new Set(decisions.filter((d) => d.pos === abbr).map((d) => d.coach))];
  return unitReport(t, scoped(decisions).filter((d) => d.pos === abbr), teamName(abbr),
    `Team report · ${state.season} · ${coachesFor.map((c) => `<a href="#/coach/${encodeURIComponent(c)}">${esc(c)}</a>`).join(", ")}`);
}

export async function coach(name) {
  const { summary, decisions } = await seasonData();
  const v = view(summary);
  const c = v.coaches.find((x) => x.coach === name);
  if (!c) return notFound("Coach");
  return unitReport(c, scoped(decisions).filter((d) => d.coach === name), name,
    `Coach report · ${state.season} · ${c.teams.map((t) => `<a href="#/team/${t}">${t}</a>`).join(", ")}`);
}

// ===================================================================
// What-if lab
// ===================================================================
export async function lab(id, params) {
  const { summary, decisions } = await seasonData();
  const pool = scoped(decisions).filter((d) => d.comp);
  const mode = params.get("list") || "costly";
  const tm = params.get("team") || "";
  let list = pool.filter((d) => !tm || d.pos === tm);
  list = mode === "close" ? list.filter((d) => d.tier === "toss_up" && d.qtr >= 4).sort((a, b) => Math.abs(a.gb) - Math.abs(b.gb))
    : mode === "bold" ? list.filter((d) => d.choice === "go" && d.qtr >= 4).sort((a, b) => b.gb - a.gb)
    : list.sort((a, b) => b.cost - a.cost);
  list = list.slice(0, 60);
  const d = (id && summary._index.get(id)) || list[0];
  if (!d) return notFound("Decision");
  const alt = params.get("alt") || ["go", "punt", "fg"].find((o) => o !== d.choice && d[`${o}_wp`] != null);
  const altWp = d[`${alt}_wp`];
  const delta = altWp == null ? null : 100 * (altWp - d.chosen_wp);
  const sim = decisions.filter((x) => x.id !== d.id && Math.abs(x.ytg - d.ytg) <= 1 && Math.abs(x.yl - d.yl) <= 5 && x.qtr === d.qtr && Math.sign(x.sd) === Math.sign(d.sd) && x.comp);
  const simGo = sim.length ? sim.filter((x) => x.choice === "go").length / sim.length : null;
  const simModel = sim.length ? sim.filter((x) => x.gb > 0).length / sim.length : null;
  const q = (o) => "#/lab/" + d.id + "?" + new URLSearchParams({ list: mode, ...(tm ? { team: tm } : {}), ...o });
  const lq = (o) => "#/lab?" + new URLSearchParams({ list: mode, ...(tm ? { team: tm } : {}), ...o });
  const teamsList = [...new Set(decisions.map((x) => x.pos))].sort();

  return `${head("What-if laboratory", "Replay the call. Change the decision.", "Choose a historical fourth down, then switch to a different option to compare the model's estimates. These are expected values before the snap. Nobody can know how the other option would actually have played out.", scopeNote())}
  <div class="lab-grid">
    <div class="panel">
      <div class="seg" style="margin-bottom:10px;width:100%">${[["costly", "Costliest"], ["close", "Toss-ups"], ["bold", "Bold goes"]].map(([k, l]) => `<button class="${mode === k ? "on" : ""}" style="flex:1;justify-content:center" data-go="${lq({ list: k })}">${l}</button>`).join("")}</div>
      <select class="select" style="width:100%;margin-bottom:10px" data-param="team" data-route="#/lab"><option value="">All teams</option>${teamsList.map((t) => `<option ${t === tm ? "selected" : ""}>${t}</option>`).join("")}</select>
      <div class="picker-list">${list.map((x) => `<button class="${x.id === d.id ? "on" : ""}" data-go="${"#/lab/" + x.id + "?" + new URLSearchParams({ list: mode, ...(tm ? { team: tm } : {}) })}">
        <span class="t">${esc(x.pos)} · ${downDist(x)} · ${qlabel(x.qtr)} ${clock(x.clock)}</span><span class="mono" style="font-size:12px;color:${x.cost >= 1 ? "var(--serious)" : "var(--text-3)"}">−${x.cost.toFixed(1)}</span>
        <span class="s">${weekLabel(x.week, x.stype)} vs ${esc(x.def)} · ${scoreText(x.sd)} · chose ${OPT_SHORT[x.choice]}</span></button>`).join("")}</div>
    </div>
    <div style="display:grid;gap:16px;min-width:0">
      <div class="panel hud">
        <div class="panel-head"><div><h2 class="sec">${esc(teamName(d.pos))} · ${situation(d)}</h2><div class="sec-sub">${weekLabel(d.week, d.stype)} · ${esc(d.away)} at ${esc(d.home)} · <a class="panel-link" href="#/decision/${d.id}">full analysis →</a></div></div>${tierTag(d.tier)}</div>
        ${fieldGraphic(d)}
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2 class="sec">Pick an alternative</h2><div class="sec-sub">Actual choice: ${optTag(d.choice)}. Click another option to compare.</div></div></div>
        <div id="lab-options">${optionCards(d, { selected: alt, clickable: true })}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center;margin-top:20px">
          <div class="delta-big ${delta == null ? "" : delta > 0.05 ? "pos" : delta < -0.05 ? "neg" : ""}">${delta == null ? "—" : `${signed(delta, 2)}`}<span style="font-size:16px" class="muted"> pp</span></div>
          <div class="muted">${alt === d.choice ? "This is what the team actually did." : `Switching from <b>${OPT[d.choice].toLowerCase()}</b> to <b>${OPT[alt].toLowerCase()}</b> changes the model's estimated win probability from <b class="mono">${pct(d.chosen_wp)}</b> to <b class="mono">${pct(altWp)}</b>.`}
          ${(d.choice === "go") !== (alt === "go") && alt !== d.choice ? `<br><span class="dim">nfl4th's 80% interval for go-vs-kick: ${signed(d.gb_lo, 2)} to ${signed(d.gb_hi, 2)} pp${d.tier === "toss_up" ? ", which spans zero, so treat this as a close call." : "."}</span>` : ""}</div>
        </div>
      </div>
      <div class="grid g-2">
        <div class="panel"><div class="panel-head"><div><h2 class="sec">League in similar spots</h2><div class="sec-sub">Same quarter, same score state, ±1 yd to go, ±5 yd field position, competitive only</div></div></div>
          ${sim.length ? `<div class="grid g-2"><div class="stat" style="padding:0"><div class="k">Went for it</div><div class="v">${pct(simGo, 0)}</div><div class="d">n = ${sim.length}</div></div><div class="stat" style="padding:0"><div class="k">Model said go</div><div class="v" style="color:var(--go)">${pct(simModel, 0)}</div><div class="d">same set</div></div></div>
          ${sim.length < 15 ? `<div class="small-n" style="margin-top:8px">${icon("alert", 'width="12" height="12"')}Only ${sim.length} comparable decisions: treat these rates as anecdotal</div>` : ""}
          <div class="tl" style="margin-top:12px">${sim.slice(0, 4).map((x) => compactRow(x)).join("")}</div>` : '<div class="empty-state">No comparable decisions this season.</div>'}
        </div>
        <div class="panel"><div class="panel-head"><h2 class="sec">What this lab can and can't say</h2></div>
          <ul style="margin:0;padding-left:18px;color:var(--text-2);font-size:13.5px;display:grid;gap:6px">
            <li>Each number is an <b>expected</b> win probability before the snap, not a forecast of one play.</li>
            <li>Going for it is a gamble: the value combines converting and failing, weighted by the estimated conversion probability.</li>
            <li>Outcome distributions and simulation are on the roadmap. They need the per-branch probabilities from the full nfl4th R export.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>`;
}

export function bindLab(id, params) {
  document.querySelectorAll("#lab-options [data-alt]").forEach((b) => b.addEventListener("click", () => {
    const p = new URLSearchParams(params); p.set("alt", b.dataset.alt);
    const cur = router.route.match(/^#\/lab\/([^?]+)/);
    router.nav(`#/lab/${cur ? cur[1] : id || ""}?${p}`);
  }));
}

// ===================================================================
// Methodology
// ===================================================================
export async function methodology() {
  const { summary } = await seasonData();
  const m = state.manifest;
  const ex = summary.exclusions;
  const totalSnaps = ex.reduce((s, r) => s + r.snaps, 0);
  const reasons = {
    eligible: "Eligible decision", superseded_by_later_snap: "Earlier snap in a re-snapped 4th down", presnap_penalty_intent_unknown: "Pre-snap penalty, intent unknown",
    model_values_pending: "nfl4th values not yet published", no_model_values: "No nfl4th values (mostly final seconds of a half)", kneel_or_spike: "Kneel or spike",
    chosen_option_not_modeled: "Chosen option not modeled", sequence_ends_in_kneel: "Sequence ends in kneel",
  };
  const snaps = Object.values(m.snapshots);
  return `<div class="doc">${head("Methodology", "How every number is produced", "This tool should be auditable. Here is where the data comes from, what counts as a decision, what each metric means, and what the model cannot see.")}
  <h2>Data sources</h2>
  <table class="data"><thead><tr><th>Snapshot</th><th>Retrieved (UTC)</th><th>SHA-256</th></tr></thead><tbody>
  ${snaps.map((s) => `<tr><td><a class="panel-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></td><td class="mono">${esc(s.retrieved_at)}</td><td class="mono" style="font-size:11.5px">${esc(s.sha256.slice(0, 24))}…</td></tr>`).join("")}
  </tbody></table>
  <p><b>Play-by-play:</b> nflverse <code>play_by_play_{season}.parquet</code>, which includes nflfastR's win probability. <b>Decision values:</b> nfl4th's published precomputed table (<code>pre_computed_go_boost.rds</code>): win probability for going, punting and kicking, plus a 201-draw bootstrap summary. Both files are overwritten upstream, so every build records the exact bytes it used.</p>

  <h2>Eligible decision population — ${summary.season}</h2>
  <div class="funnel">${ex.map((r) => `<div class="f-row"><span>${reasons[r.exclusion_reason] || esc(r.exclusion_reason)}</span><span class="f-bar"><i style="width:${(100 * r.snaps) / totalSnaps}%;background:${r.status === "decision" ? "var(--accent)" : "var(--text-3)"}"></i></span><span class="mono" style="text-align:right">${num(r.snaps)}</span></div>`).join("")}</div>
  <h3>Rules</h3>
  <ul>
    <li>Every snap with <code>down == 4</code> is classified by <b>intent</b>: punt or field goal if the play is one, or if the formation was a punt/FG formation on a nullified or aborted snap; <b>go</b> if a run or pass was attempted, <b>including fake punts and fake field goals</b>.</li>
    <li>A pre-snap penalty in a non-kicking formation (e.g. a false start from shotgun) has unknown intent: the offense may have been trying to draw the defense offside.</li>
    <li>Consecutive fourth-down snaps by the same offense on the same drive form <b>one decision</b>, valued at the last snap whose intent is known. A delay of game followed by a punt therefore counts once.</li>
    <li>This classification matches nfl4th's own go/kick coding on 100% of comparable snaps in both seasons (see <code>docs/VALIDATION_*.md</code>). The validation pass found one bug in this project's own rule (an aborted punt snap where a player picked up the ball and ran). It is fixed and covered by a test.</li>
  </ul>

  <h2>Metrics and sign conventions</h2>
  <table class="data"><tbody>
    <tr><td><code>go_wp</code>, <code>punt_wp</code>, <code>fg_wp</code></td><td>Offense win probability under each choice, a probability shown as %. Blank when nfl4th treats the option as unavailable.</td></tr>
    <tr><td><b>WP cost</b></td><td><code>100 × (best_wp − chosen_wp)</code> in <b>percentage points</b>. Always ≥ 0; 0 means the team picked the model's best option.</td></tr>
    <tr><td><b>Go − kick</b> (<code>go_boost</code>)</td><td>nfl4th's signed <code>100 × (go_wp − max(punt_wp, fg_wp))</code>, in pp. Positive means the model prefers going. Reproduced exactly (max error 0.0 pp).</td></tr>
    <tr><td><b>Tier</b></td><td><i>Clear go / clear kick</i> when nfl4th's 80% bootstrap interval for go−kick excludes zero; otherwise <i>toss-up</i>.</td></tr>
    <tr><td><b>Verdict</b></td><td><i>Too conservative</i>: kicked when go − kick &gt; 0. <i>Too aggressive</i>: went when go − kick ≤ 0. <i>Wrong kick</i>: kicked correctly but chose the weaker kick.</td></tr>
    <tr><td><b>Competitive</b></td><td>Best option's WP between 2% and 98%. A sensitivity toggle (top bar), not a filter applied by default.</td></tr>
    <tr><td><b>Team / coach intervals</b></td><td>90% percentile bootstrap, resampling that unit's games (2,000 draws, fixed seed). This covers sampling variability only, not model uncertainty.</td></tr>
  </tbody></table>
  <p>Season totals of WP cost are sums of per-decision estimates. Dividing by 100 gives a loose “expected wins” reading, but win-probability changes within one game are not independent, so treat totals as an index, not a win count.</p>

  <h2>What the model does and does not account for</h2>
  <ul>
    <li><b>Included</b> (from nfl4th source): down, distance, field position, score, time, timeouts, the pre-game spread and total line (a team-strength proxy), era, roof type for field goals, and late/desperation situations.</li>
    <li><b>Field goals</b>: make probability is a league-wide lookup by distance, roof and era. nfl4th's table already discounts long attempts because only teams that trust their kicker try them, but no individual kicker is modeled.</li>
    <li><b>Not included</b>: the specific kicker's range, injuries, personnel, play-call quality, weather beyond roof type, or anything the coach knows privately.</li>
    <li>nfl4th's bootstrap only refits its own conversion and first-down win-probability models. The punt and FG tables and nflfastR's WP model are held fixed, so the true uncertainty is wider than shown.</li>
    <li>The models were fit on historical seasons that include the ones analysed here, so this is an in-sample evaluation of the model.</li>
    <li>Decisions are attributed to the head coach listed by nflverse; coordinators may make some calls.</li>
    <li>Nothing here claims that a decision caused a loss. Cost is the model's expected difference, not an outcome.</li>
  </ul>

  <h2>Reproducing a result</h2>
  <p><code>nfldi refresh --season 2026</code> takes a new snapshot; <code>nfldi build --season 2025 --season 2026:live</code> rebuilds this site's data; <code>python scripts/validate.py 2025</code> regenerates the validation report; <code>pytest</code> runs the calculation tests. Built ${esc(m.built_at)}.</p>
  <h2>Credits</h2>
  <p>Data: <a class="panel-link" href="https://github.com/nflverse" target="_blank" rel="noopener">nflverse</a>. Fourth-down model: <a class="panel-link" href="https://github.com/nflverse/nfl4th" target="_blank" rel="noopener">nfl4th</a> by Ben Baldwin (MIT). This project is independent and not affiliated with the NFL or any team.</p>
  </div>`;
}

export function notFound(what) {
  return `<div class="empty-state"><h2>${what} not found</h2><p>It may belong to another season, or the filter excludes it. <a class="panel-link" href="#/">Back to overview</a></p></div>`;
}
