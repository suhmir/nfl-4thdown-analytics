// Hand-written SVG charts. Conventions (see dataviz guidance):
// thin marks, recessive grid, one y-axis, hover tooltips via data-tip,
// option colours only for go/punt/fg, diverging red↔blue for "vs model" gaps.
import { esc, pct, pp, signed, tip, OPT_SHORT, qlabel, clock, teamName } from "./util.js";

const f1 = (x) => Math.round(x * 10) / 10;
const fitW = (w) => Math.max(340, Math.min(w, (typeof window !== "undefined" ? window.innerWidth : w) - 70));

/** Horizontal dot + interval ranking. rows: {label, sub, value, lo, hi, href, tip, warn} */
export function rankChart(rows, { unit = "pp", width = 640, rowH = 24, labelW = 70, digits = 1 } = {}) {
  width = fitW(width);
  if (!rows.length) return '<div class="empty-state">No data</div>';
  const max = Math.max(...rows.map((r) => r.hi ?? r.value)) * 1.05 || 1;
  const min = Math.min(0, ...rows.map((r) => r.lo ?? r.value));
  const top = 22, h = top + rows.length * rowH + 4, x0 = labelW, x1 = width - 58;
  const sx = (v) => x0 + ((v - min) / (max - min)) * (x1 - x0);
  const ticks = niceTicks(min, max, 5);
  let s = `<svg class="chart" viewBox="0 0 ${width} ${h}" role="img">`;
  for (const t of ticks) {
    s += `<line class="gridline" x1="${f1(sx(t))}" x2="${f1(sx(t))}" y1="${top - 6}" y2="${h}"/>`;
    s += `<text x="${f1(sx(t))}" y="11" text-anchor="middle">${t}</text>`;
  }
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    const tt = r.tip || tip(r.label, [["Value", `${r.value.toFixed(digits)} ${unit}`]]);
    s += `<a href="${r.href || "#"}"><g data-tip="${tt}">`;
    s += `<rect class="hit" x="0" y="${y - rowH / 2}" width="${width}" height="${rowH}"/>`;
    s += `<text class="lbl-strong" x="${x0 - 10}" y="${y + 4}" text-anchor="end">${esc(r.label)}${r.warn ? " ⚠" : ""}</text>`;
    if (r.lo != null && r.hi != null) {
      s += `<line x1="${f1(sx(r.lo))}" x2="${f1(sx(r.hi))}" y1="${y}" y2="${y}" stroke="var(--accent)" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round"/>`;
    }
    s += `<circle cx="${f1(sx(r.value))}" cy="${y}" r="4.5" fill="var(--accent)" stroke="var(--panel-solid)" stroke-width="2"/>`;
    s += `<text x="${x1 + 8}" y="${y + 4}">${r.value.toFixed(digits)}</text>`;
    s += `</g></a>`;
  });
  return s + "</svg>";
}

/** Dumbbell: actual vs model rate per row. rows: {label, a, b, href, tip} */
export function dumbbell(rows, { width = 640, rowH = 24, labelW = 70 } = {}) {
  width = fitW(width);
  const top = 22, h = top + rows.length * rowH + 4, x0 = labelW, x1 = width - 16;
  const sx = (v) => x0 + v * (x1 - x0);
  let s = `<svg class="chart" viewBox="0 0 ${width} ${h}" role="img">`;
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    s += `<line class="gridline" x1="${sx(t)}" x2="${sx(t)}" y1="${top - 6}" y2="${h}"/><text x="${sx(t)}" y="11" text-anchor="middle">${t * 100}%</text>`;
  }
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    s += `<a href="${r.href || "#"}"><g data-tip="${r.tip}">`;
    s += `<rect class="hit" x="0" y="${y - rowH / 2}" width="${width}" height="${rowH}"/>`;
    s += `<text class="lbl-strong" x="${x0 - 10}" y="${y + 4}" text-anchor="end">${esc(r.label)}</text>`;
    s += `<line x1="${f1(sx(r.a))}" x2="${f1(sx(r.b))}" y1="${y}" y2="${y}" stroke="var(--line-strong)" stroke-width="2"/>`;
    s += `<circle cx="${f1(sx(r.b))}" cy="${y}" r="5" fill="var(--go)" stroke="var(--panel-solid)" stroke-width="2"/>`;
    s += `<circle cx="${f1(sx(r.a))}" cy="${y}" r="5" fill="var(--text)" stroke="var(--panel-solid)" stroke-width="2"/>`;
    s += `</g></a>`;
  });
  return s + "</svg>";
}

/** Multi-series line chart over x. series: {name, color, dash, values:[{x,y}]} */
export function lineChart(series, { width = 640, height = 230, xLabel = (x) => x, yFmt = (v) => `${Math.round(v * 100)}%`, yMax = null, tipFn } = {}) {
  width = fitW(width);
  const pad = { l: 40, r: 74, t: 12, b: 26 };
  const xs = [...new Set(series.flatMap((s) => s.values.map((v) => v.x)))].sort((a, b) => a - b);
  const ymax = yMax ?? Math.max(...series.flatMap((s) => s.values.map((v) => v.y))) * 1.1;
  const sx = (x) => pad.l + (xs.length === 1 ? 0.5 : xs.indexOf(x) / (xs.length - 1)) * (width - pad.l - pad.r);
  const sy = (y) => height - pad.b - (y / ymax) * (height - pad.t - pad.b);
  let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">`;
  for (const t of niceTicks(0, ymax, 4)) {
    s += `<line class="gridline" x1="${pad.l}" x2="${width - pad.r}" y1="${f1(sy(t))}" y2="${f1(sy(t))}"/><text x="${pad.l - 8}" y="${f1(sy(t)) + 4}" text-anchor="end">${yFmt(t)}</text>`;
  }
  const every = Math.ceil(xs.length / 12);
  xs.forEach((x, i) => { if (i % every === 0 || i === xs.length - 1) s += `<text x="${f1(sx(x))}" y="${height - 6}" text-anchor="middle">${xLabel(x)}</text>`; });
  for (const se of series) {
    const pts = se.values.filter((v) => v.y != null);
    s += `<path d="${pts.map((v, i) => `${i ? "L" : "M"}${f1(sx(v.x))},${f1(sy(v.y))}`).join("")}" fill="none" stroke="${se.color}" stroke-width="2" ${se.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts[pts.length - 1];
    if (last) s += `<text class="lbl" x="${f1(sx(last.x)) + 8}" y="${f1(sy(last.y)) + 4}" style="fill:${se.color}">${esc(se.name)}</text>`;
  }
  // crosshair hit columns
  const colW = (width - pad.l - pad.r) / Math.max(1, xs.length - 1);
  xs.forEach((x) => {
    const rows = series.map((se) => [se.name, (v => v == null ? "—" : yFmt(v))(se.values.find((v) => v.x === x)?.y)]);
    const tt = tipFn ? tipFn(x) : tip(xLabel(x), rows);
    s += `<g data-tip="${tt}" class="xcol"><rect class="hit" x="${f1(sx(x) - colW / 2)}" y="${pad.t}" width="${f1(colW)}" height="${height - pad.t - pad.b}"/>`;
    for (const se of series) {
      const v = se.values.find((p) => p.x === x);
      if (v && v.y != null) s += `<circle cx="${f1(sx(x))}" cy="${f1(sy(v.y))}" r="3" fill="${se.color}" opacity="0.9"/>`;
    }
    s += `</g>`;
  });
  return s + "</svg>";
}

/** Diverging colour for a gap in [-1, 1] (actual − model go rate). */
export function divColor(gap, maxAbs = 0.6) {
  const t = Math.min(1, Math.abs(gap) / maxAbs);
  const pole = gap < 0 ? "var(--div-neg)" : "var(--div-pos)";
  return `color-mix(in oklab, ${pole} ${Math.round(t * 100)}%, var(--neutral-mid))`;
}

/** HTML heatmap. cells: [{row, col, n, gap, go_rate, model_go_rate, mean_cost}] */
export function heatmap(cells, rows, cols, { minN = 12, onCell = null, rowTitle = "", colTitle = "" } = {}) {
  const key = (r, c) => `${r}|${c}`;
  const m = new Map(cells.map((c) => [key(c.row, c.col), c]));
  let s = `<div class="heat" style="grid-template-columns: 92px repeat(${cols.length}, minmax(34px, 1fr))">`;
  s += `<div class="hdr rh" style="font-size:10px">${esc(rowTitle)}</div>` + cols.map((c) => `<div class="hdr">${esc(c)}</div>`).join("");
  for (const r of rows) {
    s += `<div class="hdr rh">${esc(r)}</div>`;
    for (const c of cols) {
      const cell = m.get(key(r, c));
      if (!cell) { s += `<div class="cell empty">·</div>`; continue; }
      const low = cell.n < minN;
      const tt = tip(`${r} · 4th & ${c}`, [
        ["Decisions", cell.n], ["Teams went for it", pct(cell.go_rate)], ["Model said go", pct(cell.model_go_rate)],
        ["Gap", `${signed(100 * cell.gap)} pts`], ["Avg cost / decision", pp(cell.mean_cost, 2)],
        ...(low ? [["Note", `n < ${minN}: low confidence`]] : []),
      ]);
      const href = onCell ? onCell(cell) : null;
      const tag = href ? "a" : "div";
      s += `<${tag} class="cell" ${href ? `href="${href}"` : ""} data-tip="${tt}" style="background:${divColor(cell.gap)};${low ? "opacity:.38" : ""}">${Math.round(100 * cell.gap)}</${tag}>`;
    }
  }
  s += `</div>`;
  s += `<div class="scale"><span>Teams kick more than model</span><span class="ramp" style="background:linear-gradient(90deg,var(--div-neg),var(--neutral-mid),var(--div-pos))"></span><span>Teams go more than model</span><span class="dim">· cell = actual − model go rate (pts) · ${esc(colTitle)} · faded: n &lt; ${minN}</span></div>`;
  return s;
}

/** Game win-probability chart with decision markers. */
export function wpChart(wp, decisions, game, { width = 900, height = 260 } = {}) {
  const pad = { l: 44, r: 14, t: 14, b: 28 };
  const maxT = Math.max(3600, ...wp.map((p) => p[2]));
  const sx = (t) => pad.l + (t / maxT) * (width - pad.l - pad.r);
  const sy = (w) => pad.t + (1 - w) * (height - pad.t - pad.b);
  const byPlay = new Map(wp.map((p) => [p[0], p]));
  let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Win probability chart">`;
  s += `<defs><linearGradient id="wpfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    s += `<line class="${v === 0.5 ? "zero" : "gridline"}" x1="${pad.l}" x2="${width - pad.r}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${pad.l - 8}" y="${sy(v) + 4}" text-anchor="end">${v * 100}%</text>`;
  }
  const qs = [0, 900, 1800, 2700, 3600]; if (maxT > 3600) qs.push(maxT);
  for (let i = 0; i < qs.length - 1; i++) {
    s += `<line class="gridline" x1="${sx(qs[i])}" x2="${sx(qs[i])}" y1="${pad.t}" y2="${height - pad.b}"/>`;
    s += `<text x="${(sx(qs[i]) + sx(qs[i + 1])) / 2}" y="${height - 8}" text-anchor="middle">${i < 4 ? `Q${i + 1}` : "OT"}</text>`;
  }
  const line = wp.map((p, i) => `${i ? "L" : "M"}${f1(sx(p[2]))},${f1(sy(p[3]))}`).join("");
  s += `<path d="${line} L${f1(sx(wp[wp.length - 1][2]))},${sy(0)} L${f1(sx(wp[0][2]))},${sy(0)} Z" fill="url(#wpfill)"/>`;
  s += `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<text class="lbl" x="${pad.l + 6}" y="${pad.t + 12}">${esc(game.home)} win prob.</text>`;
  for (const d of decisions) {
    const p = byPlay.get(d.play_id);
    const homeWp = p ? p[3] : (d.pos === game.home ? d.chosen_wp : 1 - d.chosen_wp);
    const x = f1(sx(d.t)), y = f1(sy(homeWp));
    const bad = d.cost >= 1;
    const tt = tip(`${d.pos} · ${qlabel(d.qtr)} ${clock(d.clock)} · 4th & ${d.ytg}`, [
      ["Chose", OPT_SHORT[d.choice]], ["Model best", OPT_SHORT[d.best]], ["WP cost", pp(d.cost, 2)],
    ]);
    s += `<a href="#/decision/${d.id}"><g data-tip="${tt}">`;
    s += `<circle class="hit" cx="${x}" cy="${y}" r="12"/>`;
    if (bad) s += `<circle cx="${x}" cy="${y}" r="9.5" fill="none" stroke="var(--serious)" stroke-width="2"/>`;
    s += `<circle cx="${x}" cy="${y}" r="5.5" fill="var(--${d.choice})" stroke="var(--panel-solid)" stroke-width="2"/>`;
    s += `</g></a>`;
  }
  return s + "</svg>";
}

/** Field strip: offense moving left→right. */
export function fieldGraphic(d, { width = 760, height = 96 } = {}) {
  const ez = 10, sx = (yd) => (yd / 120) * width; // yd 0..120 incl. end zones
  const ball = ez + (100 - d.yl);
  const ltg = Math.min(ez + 100, ball + (d.gtg ? d.yl : d.ytg));
  let s = `<svg class="chart field" viewBox="0 0 ${width} ${height}" role="img" aria-label="Field position">`;
  s += `<defs><linearGradient id="turf" x1="0" x2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".05"/><stop offset=".5" stop-color="var(--accent)" stop-opacity=".1"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".05"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  s += `<rect x="0" y="18" width="${width}" height="${height - 36}" rx="10" fill="url(#turf)" stroke="var(--line-strong)"/>`;
  s += `<rect x="0" y="18" width="${sx(ez)}" height="${height - 36}" rx="10" fill="var(--accent)" fill-opacity=".08"/>`;
  s += `<rect x="${sx(110)}" y="18" width="${sx(ez)}" height="${height - 36}" rx="10" fill="var(--accent-2)" fill-opacity=".12"/>`;
  for (let yd = 10; yd <= 110; yd += 5) {
    s += `<line x1="${sx(yd)}" x2="${sx(yd)}" y1="18" y2="${height - 18}" stroke="var(--line${yd % 10 === 0 ? "-strong" : ""})"/>`;
    if (yd % 10 === 0 && yd > 10 && yd < 110) {
      const n = yd - 10 <= 50 ? yd - 10 : 110 - yd;
      s += `<text x="${sx(yd)}" y="${height - 4}" text-anchor="middle">${n}</text>`;
    }
  }
  s += `<text x="${sx(5)}" y="${height / 2 + 4}" text-anchor="middle" class="lbl">${esc(d.pos)}</text>`;
  s += `<text x="${sx(115)}" y="${height / 2 + 4}" text-anchor="middle" class="lbl">${esc(d.def)}</text>`;
  s += `<rect x="${sx(ball)}" y="20" width="${Math.max(2, sx(ltg) - sx(ball))}" height="${height - 40}" fill="var(--warn)" fill-opacity=".14"/>`;
  s += `<line x1="${sx(ltg)}" x2="${sx(ltg)}" y1="14" y2="${height - 14}" stroke="var(--warn)" stroke-width="2.5"/>`;
  s += `<text x="${sx(ltg)}" y="11" text-anchor="middle" style="fill:var(--warn)">${d.gtg ? "GOAL" : "LINE TO GAIN"}</text>`;
  s += `<line x1="${sx(ball)}" x2="${sx(ball)}" y1="18" y2="${height - 18}" stroke="var(--accent)" stroke-width="2.5" filter="url(#glow)"/>`;
  s += `<ellipse cx="${sx(ball)}" cy="${height / 2}" rx="8" ry="5" fill="var(--accent)" filter="url(#glow)"/>`;
  return s + "</svg>";
}

/** go_boost point estimate with nfl4th's 80% bootstrap interval. */
export function intervalBar(d, { width = 520, height = 84 } = {}) {
  const lo = d.gb_lo, hi = d.gb_hi, v = d.gb;
  const ext = Math.max(2, Math.abs(lo), Math.abs(hi), Math.abs(v)) * 1.15;
  const pad = 20, sx = (x) => pad + ((x + ext) / (2 * ext)) * (width - 2 * pad);
  const y = 40;
  let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Go vs kick interval">`;
  s += `<rect x="${pad}" y="${y - 10}" width="${sx(0) - pad}" height="20" fill="var(--div-neg)" fill-opacity=".07" rx="4"/>`;
  s += `<rect x="${sx(0)}" y="${y - 10}" width="${width - pad - sx(0)}" height="20" fill="var(--div-pos)" fill-opacity=".07" rx="4"/>`;
  s += `<line class="zero" x1="${sx(0)}" x2="${sx(0)}" y1="${y - 18}" y2="${y + 18}"/>`;
  s += `<text x="${pad}" y="11" class="lbl">← Kick better</text><text x="${width - pad}" y="12" text-anchor="end" class="lbl">Go better →</text>`;
  if (lo != null && hi != null) s += `<rect x="${f1(sx(lo))}" y="${y - 4}" width="${f1(Math.max(2, sx(hi) - sx(lo)))}" height="8" rx="4" fill="var(--accent)" fill-opacity=".35" data-tip="${tip("80% bootstrap interval", [["Low", `${signed(lo, 2)} pp`], ["High", `${signed(hi, 2)} pp`]])}"/>`;
  s += `<circle cx="${f1(sx(v))}" cy="${y}" r="6.5" fill="var(--accent)" stroke="var(--panel-solid)" stroke-width="2"/>`;
  s += `<text x="${f1(Math.min(width - pad - 30, Math.max(pad + 30, sx(v))))}" y="${y - 14}" text-anchor="middle" class="lbl-strong">${signed(v, 2)} pp</text>`;
  for (const t of niceTicks(-ext, ext, 5)) s += `<text x="${f1(sx(t))}" y="${height - 2}" text-anchor="middle" opacity=".6">${t}</text>`;
  return s + "</svg>";
}

export function niceTicks(min, max, n) {
  const span = max - min || 1;
  const step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}
