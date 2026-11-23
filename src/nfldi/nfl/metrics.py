"""Decision metrics. Units and sign conventions are fixed here and nowhere else.

* ``go_wp``, ``punt_wp``, ``fg_wp``, ``chosen_wp``, ``best_wp``: win
  probability for the offense, as a probability in [0, 1]. A missing value
  means nfl4th does not consider that option available in this situation.
* ``wp_cost``: ``100 * (best_wp - chosen_wp)``, in **percentage points**.
  Always >= 0; exactly 0 when the team chose the model's best option.
* ``go_boost``: nfl4th's own number, ``100 * (go_wp - max(punt_wp, fg_wp))``,
  percentage points, **signed**: positive means the model prefers going.
* ``go_boost_lo`` / ``go_boost_hi``: 10th / 90th percentile of go_boost across
  nfl4th's bootstrap draws (an 80% interval). Only nfl4th's own conversion and
  first-down WP models are resampled; punt/FG models and nflfastR's WP model
  are held fixed, so the interval understates total uncertainty.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

OPTION_COLS = {"go": "go_wp", "punt": "punt_wp", "fg": "fg_wp"}

# A decision is "competitive" when the best available option leaves the game
# genuinely in doubt. Used for a sensitivity cut, not to drop data.
COMPETITIVE_RANGE = (0.02, 0.98)


def add_metrics(decisions: pd.DataFrame) -> pd.DataFrame:
    d = decisions.copy()
    wps = d[list(OPTION_COLS.values())]
    d["n_options"] = wps.notna().sum(axis=1)
    d["best_wp"] = wps.max(axis=1)
    d["best"] = wps.idxmax(axis=1).map({v: k for k, v in OPTION_COLS.items()})
    d["wp_cost"] = 100 * (d["best_wp"] - d["chosen_wp"])
    d["agrees"] = d["choice"] == d["best"]

    d["model_go"] = d["go_boost"] > 0
    d["went"] = d["choice"] == "go"
    d["agrees_go_kick"] = d["model_go"] == d["went"]
    d["clear"] = (d["go_boost_lo"] > 0) | (d["go_boost_hi"] < 0)
    d["tier"] = np.where(d["clear"], np.where(d["model_go"], "clear_go", "clear_kick"), "toss_up")

    # Which way did a disagreement lean? (go/kick axis only)
    d["error_type"] = np.select(
        [d["model_go"] & ~d["went"], ~d["model_go"] & d["went"], ~d["agrees"]],
        ["too_conservative", "too_aggressive", "wrong_kick"],
        default="",
    )
    lo, hi = COMPETITIVE_RANGE
    d["competitive"] = d["best_wp"].between(lo, hi)

    # Outcome, kept strictly separate from decision quality.
    # result_vs_exp (pp): win chance after the play minus the win chance the
    # model expected for the chosen option, on nflverse's spread-adjusted WP
    # scale (the scale nfl4th's values sit on). Positive = better than expected.
    if {"vegas_wp", "vegas_wpa"} <= set(d.columns):
        d["result_vs_exp"] = 100 * (d["vegas_wp"] + d["vegas_wpa"] - d["chosen_wp"])
        d["worked"] = d["result_vs_exp"] >= 0
    d["posteam_won"] = np.where(
        d["result"] == 0, np.nan,
        ((d["result"] > 0) == (d["posteam"] == d["home_team"])).astype(float),
    )
    return d


def go_boost_identity_error(d: pd.DataFrame) -> pd.Series:
    """|nfl4th go_boost - recomputed go_boost| in pp; ~0 if units are understood."""
    kick = d[["punt_wp", "fg_wp"]].max(axis=1)
    return (100 * (d["go_wp"] - kick) - d["go_boost"]).abs()
