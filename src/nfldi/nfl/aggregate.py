"""Team, coach and situation summaries.

Uncertainty: team/coach totals get a percentile bootstrap interval obtained by
resampling that unit's *games* with replacement (decisions within a game are
not independent). This captures sampling variability in which situations a
team happened to face; it does not include model uncertainty (see
``metrics``). Intervals are 90% (5th-95th percentile).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

N_BOOT = 2000
SEED = 20261123  # fixed so published intervals are reproducible


def _boot_interval(game_values: np.ndarray, rng: np.random.Generator, stat: str) -> tuple[float, float]:
    k = len(game_values)
    if k < 2:
        return (np.nan, np.nan)
    draws = game_values[rng.integers(0, k, size=(N_BOOT, k))]
    vals = draws.sum(axis=1) if stat == "sum" else draws.sum(axis=1) / k
    return tuple(np.percentile(vals, [5, 95]))


def _rate(num: pd.Series, den: pd.Series) -> pd.Series:
    return (num / den.where(den > 0)).astype(float)


def summarize(d: pd.DataFrame, by: list[str]) -> pd.DataFrame:
    """Per-unit decision summary. ``by`` e.g. ``["posteam"]`` or ``["coach", "posteam"]``."""
    g = d.groupby(by)
    out = pd.DataFrame({
        "games": g["game_id"].nunique(),
        "decisions": g.size(),
        "clear": g["clear"].sum(),
        "go": g["went"].sum(),
        "model_go": g["model_go"].sum(),
        "agree": g["agrees"].sum(),
        "go_when_go_rec": g.apply(lambda x: (x["went"] & x["model_go"]).sum(), include_groups=False),
        "go_when_kick_rec": g.apply(lambda x: (x["went"] & ~x["model_go"]).sum(), include_groups=False),
        "clear_go": g.apply(lambda x: (x["tier"] == "clear_go").sum(), include_groups=False),
        "clear_go_went": g.apply(lambda x: ((x["tier"] == "clear_go") & x["went"]).sum(), include_groups=False),
        "clear_kick": g.apply(lambda x: (x["tier"] == "clear_kick").sum(), include_groups=False),
        "clear_kick_went": g.apply(lambda x: ((x["tier"] == "clear_kick") & x["went"]).sum(), include_groups=False),
        "wp_cost": g["wp_cost"].sum(),
        "cost_conservative": g.apply(lambda x: x.loc[x["error_type"] == "too_conservative", "wp_cost"].sum(), include_groups=False),
        "cost_aggressive": g.apply(lambda x: x.loc[x["error_type"] == "too_aggressive", "wp_cost"].sum(), include_groups=False),
        "cost_wrong_kick": g.apply(lambda x: x.loc[x["error_type"] == "wrong_kick", "wp_cost"].sum(), include_groups=False),
    })
    out["go_rate"] = _rate(out["go"], out["decisions"])
    out["model_go_rate"] = _rate(out["model_go"], out["decisions"])
    out["agree_rate"] = _rate(out["agree"], out["decisions"])
    out["go_rate_when_go_rec"] = _rate(out["go_when_go_rec"], out["model_go"])
    out["go_rate_when_kick_rec"] = _rate(out["go_when_kick_rec"], out["decisions"] - out["model_go"])
    out["clear_go_rate"] = _rate(out["clear_go_went"], out["clear_go"])
    out["wp_cost_per_game"] = out["wp_cost"] / out["games"]
    out["wp_cost_per_decision"] = out["wp_cost"] / out["decisions"]

    rng = np.random.default_rng(SEED)
    lo, hi, plo, phi = [], [], [], []
    for key, grp in g:
        per_game = grp.groupby("game_id")["wp_cost"].sum().to_numpy()
        a, b = _boot_interval(per_game, rng, "sum")
        c, e = _boot_interval(per_game, rng, "mean")
        lo.append(a); hi.append(b); plo.append(c); phi.append(e)
    out["wp_cost_lo"], out["wp_cost_hi"] = lo, hi
    out["wp_cost_per_game_lo"], out["wp_cost_per_game_hi"] = plo, phi
    return out.reset_index()


def league_summary(d: pd.DataFrame) -> dict:
    return {
        "decisions": int(len(d)),
        "games": int(d["game_id"].nunique()),
        "go": int(d["went"].sum()),
        "go_rate": float(d["went"].mean()),
        "model_go_rate": float(d["model_go"].mean()),
        "agree_rate": float(d["agrees"].mean()),
        "clear": int(d["clear"].sum()),
        "clear_agree_rate": float(d.loc[d["clear"], "agrees_go_kick"].mean()),
        "clear_go": int((d["tier"] == "clear_go").sum()),
        "clear_go_rate": float(d.loc[d["tier"] == "clear_go", "went"].mean()),
        "toss_up": int((d["tier"] == "toss_up").sum()),
        "wp_cost": float(d["wp_cost"].sum()),
        "wp_cost_per_game_team": float(d["wp_cost"].sum() / (2 * d["game_id"].nunique())),
        "cost_by_error": {k: float(v) for k, v in d.groupby("error_type")["wp_cost"].sum().items() if k},
        "count_by_error": {k: int(v) for k, v in d["error_type"].value_counts().items() if k},
        "share_cost_from_clear": float(d.loc[d["clear"], "wp_cost"].sum() / max(d["wp_cost"].sum(), 1e-9)),
    }


YARDLINE_BINS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 100]
YARDLINE_LABELS = ["Opp 1-10", "Opp 11-20", "Opp 21-30", "Opp 31-40", "Opp 41-50",
                   "Own 40-49", "Own 30-39", "Own 20-29", "Own 1-19"]
YTG_BINS = [0, 1, 2, 3, 5, 7, 10, 99]
YTG_LABELS = ["1", "2", "3", "4-5", "6-7", "8-10", "11+"]
SCORE_BINS = [-99, -17, -9, -4, 0, 3, 8, 16, 99]
SCORE_LABELS = ["Down 17+", "Down 9-16", "Down 4-8", "Down 1-3 / tied", "Up 1-3", "Up 4-8", "Up 9-16", "Up 17+"]


def add_situation_bins(d: pd.DataFrame) -> pd.DataFrame:
    d = d.copy()
    d["field_zone"] = pd.cut(d["yardline_100"], YARDLINE_BINS, labels=YARDLINE_LABELS, right=True)
    d["ytg_bin"] = pd.cut(d["ydstogo"], YTG_BINS, labels=YTG_LABELS, right=True)
    d["score_bin"] = pd.cut(d["score_differential"], SCORE_BINS, labels=SCORE_LABELS, right=True)
    d["phase"] = np.select(
        [d["qtr"] >= 5, (d["qtr"] == 4) & (d["quarter_seconds_remaining"] <= 300),
         d["qtr"] == 4, d["qtr"].isin([2]) & (d["quarter_seconds_remaining"] <= 120)],
        ["Overtime", "Q4 final 5 min", "Q4 other", "End of 1st half"], default="Q1-Q3 other",
    )
    return d


def situation_grid(d: pd.DataFrame, row: str, col: str) -> list[dict]:
    g = d.groupby([row, col], observed=True)
    out = pd.DataFrame({
        "n": g.size(),
        "go_rate": g["went"].mean(),
        "model_go_rate": g["model_go"].mean(),
        "wp_cost": g["wp_cost"].sum(),
        "mean_cost": g["wp_cost"].mean(),
    }).reset_index()
    out["gap"] = out["go_rate"] - out["model_go_rate"]
    return out.rename(columns={row: "row", col: "col"}).astype({"row": str, "col": str}).to_dict("records")


def situation_table(d: pd.DataFrame, by: str) -> list[dict]:
    g = d.groupby(by, observed=True)
    out = pd.DataFrame({
        "n": g.size(), "go_rate": g["went"].mean(), "model_go_rate": g["model_go"].mean(),
        "agree_rate": g["agrees"].mean(), "wp_cost": g["wp_cost"].sum(), "mean_cost": g["wp_cost"].mean(),
    }).reset_index().rename(columns={by: "key"})
    out["key"] = out["key"].astype(str)
    return out.to_dict("records")


def weekly_trend(d: pd.DataFrame) -> list[dict]:
    g = d.groupby("week")
    return pd.DataFrame({
        "n": g.size(), "go_rate": g["went"].mean(), "model_go_rate": g["model_go"].mean(),
        "clear_go_rate": g.apply(lambda x: x.loc[x["tier"] == "clear_go", "went"].mean(), include_groups=False),
        "wp_cost": g["wp_cost"].sum(),
    }).reset_index().to_dict("records")
