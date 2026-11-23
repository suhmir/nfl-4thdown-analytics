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
CRITICAL_STAKE = 1.0  # pp: choosing wrong side costs at least this much


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


def coach_rankings(d: pd.DataFrame) -> tuple[list[dict], float]:
    """Return (rows, league_score). ``d`` must already have add_metrics +
    add_ranking_fields applied; only competitive decisions are used."""
    c = d[d["competitive"]].copy()
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

    ranked = np.array([len(games[k]) >= MIN_GAMES for k in coaches])
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
        crit = x[x["critical"]]
        lc = x[x["late_close"] & x["critical"]]
        rve = x["result_vs_exp"]
        tier = "Above average" if lo > league else "Below average" if hi < league else "Average range"
        rows.append({
            "coach": k,
            "teams": sorted(x["posteam"].unique().tolist()),
            "games": int(x["game_id"].nunique()),
            "decisions": int(len(x)),
            "ranked": bool(ranked[j]),
            "score": score, "score_lo": float(lo), "score_hi": float(hi),
            "tier": tier if ranked[j] else "Not ranked",
            "critical": int(len(crit)), "critical_right": int(crit["right_call"].sum()),
            "critical_go_rec": int(crit["model_go"].sum()), "critical_go_went": int((crit["model_go"] & crit["went"]).sum()),
            "late_close": int(len(lc)), "late_close_right": int(lc["right_call"].sum()),
            "stake_total": float(x["stake"].sum()),
            "wp_cost": float(x["wp_cost"].sum()),
            "wp_cost_per_game": float(x["wp_cost"].sum() / x["game_id"].nunique()),
            "result_vs_exp": float(rve.sum()),
            "result_vs_exp_per_game": float(rve.sum() / x["game_id"].nunique()),
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
