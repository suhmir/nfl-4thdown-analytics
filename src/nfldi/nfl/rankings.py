"""Coach decision rankings.

Scope: fourth-down go/kick decisions only. This ranks one part of coaching,
not coaching overall.

**Decision Score** (stakes-weighted accuracy), computed over competitive
decisions (best option's win chance between 2% and 98%):

    score = sum(stake_i * right_i) / sum(stake_i)

where ``stake_i = |go_boost_i|`` is how many percentage points of win chance
separated going from the best kick, and ``right_i`` is 1 when the coach chose
the side (go vs kick) the model preferred. A coach who gets every call right
scores 100%; a call with 0.1 pp at stake barely counts, a call with 10 pp at
stake counts 100 times more. Choosing between punt and field goal is not
part of the score (it is rare and small; it stays in WP cost).

**Uncertainty**: each coach's games are resampled with replacement (2,000
draws, fixed seed); every draw re-scores and re-ranks all coaches. We report
the score's 90% interval and the 5th-95th percentile of rank. The **tier**
compares the score interval with the league-wide score: entirely above it is
"Above average", entirely below "Below average", otherwise "Average range".
This is sampling uncertainty only; model uncertainty comes on top.

**Results vs. expectation** (outcome, never part of the score): for each
decision, ``100 * (win chance after the play - win chance the model expected
for the option chosen)``, using nflverse's spread-adjusted WP (the scale
nfl4th's values sit on). Positive means things went better than expected.
It reflects execution and luck, not the decision.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

N_BOOT = 2000
SEED = 20251
MIN_GAMES = 6
MIN_DECISIONS = 20     # judged decisions needed to be ranked at a given tolerance
CRITICAL_STAKE = 1.0  # pp: choosing wrong side costs at least this much
TOLERANCES = [0.0, 1.0, 2.5, 5.0]  # "ignore gaps smaller than" options (pp)
DEFAULT_TOLERANCE = 1.0
STYLE_EDGE = 2.5      # pp: a "clear" go (or kick) chance for the style metrics
MIN_CHANCES = 8       # clear go chances needed for an aggressiveness rank


def add_ranking_fields(d: pd.DataFrame) -> pd.DataFrame:
    d = d.copy()
    d["stake"] = d["go_boost"].abs()
    d["right_call"] = d["agrees_go_kick"]
    d["critical"] = d["competitive"] & (d["stake"] >= CRITICAL_STAKE)
    d["late_close"] = (d["qtr"] >= 4) & (d["score_differential"].abs() <= 8)
    return d


def _score(stake: np.ndarray, captured: np.ndarray) -> float:
    s = stake.sum()
    return float(captured.sum() / s) if s > 0 else np.nan


def coach_rankings(d: pd.DataFrame, tolerance: float = 0.0) -> tuple[list[dict], float]:
    """Return (rows, league_score). ``d`` must already have add_metrics +
    add_ranking_fields applied; only competitive decisions are used, and
    decisions whose go-vs-kick stake is below ``tolerance`` pp are treated as
    coin flips and left out of the score (they cannot help or hurt)."""
    all_games = d[d["competitive"]].groupby("coach")["game_id"].nunique()
    c = d[d["competitive"] & (d["stake"] >= tolerance)].copy()
    c["captured"] = c["stake"] * c["right_call"]
    league = _score(c["stake"].to_numpy(), c["captured"].to_numpy())

    per_game = c.groupby(["coach", "game_id"])[["stake", "captured"]].sum()
    coaches = sorted(c["coach"].unique())
    games = {k: per_game.loc[k] for k in coaches}
    rng = np.random.default_rng(SEED)
    draws = np.full((N_BOOT, len(coaches)), np.nan)
    for j, k in enumerate(coaches):
        g = games[k]
        st, cp = g["stake"].to_numpy(), g["captured"].to_numpy()
        idx = rng.integers(0, len(g), size=(N_BOOT, len(g)))
        draws[:, j] = cp[idx].sum(1) / np.maximum(st[idx].sum(1), 1e-12)

    n_dec = c.groupby("coach").size()
    ranked = np.array([all_games[k] >= MIN_GAMES and n_dec[k] >= MIN_DECISIONS for k in coaches])
    # Ranks among ranked coaches only, per draw (1 = best).
    rk = np.full_like(draws, np.nan)
    sub = draws[:, ranked]
    order = (-sub).argsort(axis=1).argsort(axis=1) + 1
    rk[:, ranked] = order

    rows = []
    for j, k in enumerate(coaches):
        x = c[c["coach"] == k]
        score = _score(x["stake"].to_numpy(), x["captured"].to_numpy())
        lo, hi = np.percentile(draws[:, j], [5, 95])
        # The game bootstrap collapses to zero width for a perfect (or
        # perfectly wrong) record. Never report less uncertainty than a
        # Wilson interval at the stake-weighted effective sample size.
        w = x["stake"].to_numpy()
        n_eff = (w.sum() ** 2) / max((w ** 2).sum(), 1e-12)
        wl, wh = _wilson_p(score, n_eff)
        lo, hi = min(lo, wl), max(hi, wh)
        crit = x[x["critical"]]
        lc = x[x["late_close"] & x["critical"]]
        rve = x["result_vs_exp"]
        tier = "Above average" if lo > league else "Below average" if hi < league else "Average range"
        rows.append({
            "coach": k,
            "teams": sorted(x["posteam"].unique().tolist()),
            "games": int(all_games[k]),
            "decisions": int(len(x)),
            "ranked": bool(ranked[j]),
            "score": score, "score_lo": float(lo), "score_hi": float(hi),
            "tier": tier if ranked[j] else "Not ranked",
            "judged": int(len(x)),
            "critical": int(len(crit)), "critical_right": int(crit["right_call"].sum()),
            "critical_go_rec": int(crit["model_go"].sum()), "critical_go_went": int((crit["model_go"] & crit["went"]).sum()),
            "late_close": int(len(lc)), "late_close_right": int(lc["right_call"].sum()),
            "stake_total": float(x["stake"].sum()),
            "wp_cost": float(x["wp_cost"].sum()),
            "wp_cost_per_game": float(x["wp_cost"].sum() / all_games[k]),
            "result_vs_exp": float(rve.sum()),
            "result_vs_exp_per_game": float(rve.sum() / all_games[k]),
            # decision-vs-outcome grid (critical decisions)
            "right_worked": int((crit["right_call"] & crit["worked"]).sum()),
            "right_failed": int((crit["right_call"] & ~crit["worked"]).sum()),
            "wrong_worked": int((~crit["right_call"] & crit["worked"]).sum()),
            "wrong_failed": int((~crit["right_call"] & ~crit["worked"]).sum()),
        })
        if ranked[j]:
            r = rk[:, j]
            rows[-1].update(rank_median=float(np.median(r)), rank_lo=int(np.percentile(r, 5)), rank_hi=int(np.percentile(r, 95)))
    ranked_rows = sorted([r for r in rows if r["ranked"]], key=lambda r: -r["score"])
    for i, r in enumerate(ranked_rows, 1):
        r["rank"] = i
    return ranked_rows + [r for r in rows if not r["ranked"]], league


def _wilson_p(p: float, n: float, z: float = 1.645) -> tuple[float, float]:
    """Wilson interval for a proportion p observed on (effective) n trials."""
    if n <= 0 or np.isnan(p):
        return (np.nan, np.nan)
    den = 1 + z * z / n
    mid = (p + z * z / (2 * n)) / den
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (float(mid - half), float(mid + half))


def _wilson(k: int, n: int, z: float = 1.645) -> tuple[float, float]:
    if n == 0:
        return (np.nan, np.nan)
    p = k / n
    den = 1 + z * z / n
    mid = (p + z * z / (2 * n)) / den
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (float(mid - half), float(mid + half))


def coach_style(d: pd.DataFrame) -> tuple[list[dict], dict]:
    """Aggressiveness profile per coach (competitive decisions).

    * ``go_chances``: the model favoured going by >= STYLE_EDGE pp.
      ``took`` = how many of those they went for. The share is the
      aggressiveness ranking; style tier compares its 90% Wilson interval with
      the league rate.
    * ``kick_spots``: the model favoured kicking by >= STYLE_EDGE pp;
      ``went_anyway`` = how often they went for it there.
    * misses by severity (slight / clear / big) and direction, with pts lost.
    """
    c = d[d["competitive"]]
    chance = c[c["model_go"] & (c["stake"] >= STYLE_EDGE)]
    kick = c[~c["model_go"] & (c["stake"] >= STYLE_EDGE)]
    league_take = float(chance["went"].mean())
    league_over = float(kick["went"].mean())
    rows = []
    for k, x in c.groupby("coach"):
        ch, kk = x[x.index.isin(chance.index)], x[x.index.isin(kick.index)]
        took, n = int(ch["went"].sum()), len(ch)
        lo, hi = _wilson(took, n)
        style = ("Not enough chances" if n < MIN_CHANCES else
                 "More aggressive than most" if lo > league_take else
                 "More conservative than most" if hi < league_take else "Typical")
        games = x["game_id"].nunique()
        row = {"coach": k, "teams": sorted(x["posteam"].unique().tolist()), "games": int(games),
               "go_chances": n, "took": took, "take_rate": took / n if n else None,
               "take_lo": lo, "take_hi": hi, "style": style,
               "kick_spots": len(kk), "went_anyway": int(kk["went"].sum()),
               "go_rate": float(x["went"].mean()), "model_go_rate": float(x["model_go"].mean())}
        for dirn in ("conservative", "aggressive"):
            for sev in ("slight", "clear", "big"):
                m = x[(x["direction"] == dirn) & (x["severity"] == sev)]
                row[f"{dirn}_{sev}"] = int(len(m))
                row[f"{dirn}_{sev}_pts"] = float(m["wp_cost"].sum())
        row["coin_flips"] = int((x["severity"] == "coin_flip").sum())
        row["pts_lost_per_game_beyond_coinflip"] = float(
            x.loc[x["severity"].isin(["slight", "clear", "big"]), "wp_cost"].sum() / games)
        rows.append(row)
    ok = sorted([r for r in rows if r["go_chances"] >= MIN_CHANCES], key=lambda r: (-r["take_rate"], -r["go_chances"]))
    for i, r in enumerate(ok, 1):
        r["aggr_rank"] = i
    rows = ok + sorted([r for r in rows if r["go_chances"] < MIN_CHANCES], key=lambda r: r["coach"])
    return rows, {"league_take_rate": league_take, "league_went_anyway_rate": league_over, "edge": STYLE_EDGE}
