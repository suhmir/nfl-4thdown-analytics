// Data access: fetch-once caches over the static JSON in /data.
const cache = new Map();

async function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(path);
}

export const state = {
  manifest: null,
  season: null,
  view: "all", // "all" | "competitive"
};

export async function loadManifest() {
  state.manifest = await getJSON("data/manifest.json");
  return state.manifest;
}

export async function seasonData(season = state.season) {
  const [summary, decisions] = await Promise.all([
    getJSON(`data/${season}/summary.json`),
    getJSON(`data/${season}/decisions.json`),
  ]);
  if (!summary._index) {
    summary._index = new Map(decisions.map((d) => [d.id, d]));
    summary._byGame = new Map();
    for (const d of decisions) {
      if (!summary._byGame.has(d.game_id)) summary._byGame.set(d.game_id, []);
      summary._byGame.get(d.game_id).push(d);
    }
    summary._games = new Map(summary.games.map((g) => [g.game_id, g]));
  }
  return { summary, decisions };
}

/** Decisions respecting the global "competitive only" toggle. */
export function scoped(decisions) {
  return state.view === "competitive" ? decisions.filter((d) => d.comp) : decisions;
}

export const view = (summary) => summary.views[state.view];

// Win-probability series are bundled one file per week: {game_id: [[play_id, qtr, t, home_wp], ...]}
export async function gameWP(season, gameId) {
  const week = Number(gameId.split("_")[1]);
  const all = await getJSON(`data/${season}/wp/week_${String(week).padStart(2, "0")}.json`);
  return { game_id: gameId, wp: all[gameId] || [] };
}

// Set by app.js. Views navigate through router.nav(route) and read router.route.
export const router = { route: "#/", nav: (r) => { location.hash = r; } };

export function seasonMeta(season = state.season) {
  return state.manifest.seasons.find((s) => s.season === Number(season));
}
