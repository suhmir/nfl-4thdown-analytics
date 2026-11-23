"""Build the static JSON consumed by the web app (``web/data``)."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import aggregate as A
from . import decisions as D
from . import metrics as M
from . import rankings as R
from . import sources as S

WEB_DATA = Path(__file__).resolve().parents[3] / "web" / "data"


def _clean(o):
    """Make numpy/pandas values JSON-safe; NaN -> null; round floats."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (np.bool_, bool)):
        return bool(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (float, np.floating)):
        return None if math.isnan(o) else round(float(o), 5)
    if o is pd.NA or o is pd.NaT:
        return None
    return o


def _write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_clean(obj), separators=(",", ":")))


def _elapsed(gp: pd.DataFrame) -> pd.Series:
    """Seconds since kickoff. Regulation quarters are 900 s; overtime periods
    are stacked after 3600 s using each period's own clock (10 min regular
    season, 15 min postseason)."""
    qsr = gp["quarter_seconds_remaining"].fillna(0)
    ot_len = np.where(gp["season_type"] == "POST", 900, 600)
    reg = (gp["qtr"] - 1) * 900 + (900 - qsr)
    ot = 3600 + (gp["qtr"] - 5) * ot_len + (ot_len - qsr)
    return pd.Series(np.where(gp["qtr"] <= 4, reg, ot), index=gp.index).clip(lower=0)


def _decision_record(r) -> dict:
    flags = [n for n, c in (("fake_punt", "flag_fake_punt"), ("fake_fg", "flag_fake_fg"),
                            ("aborted", "flag_aborted"), ("penalty_no_play", "flag_no_play")) if r[c]]
    home = r["posteam"] == r["home_team"]
    spread = r["spread_line"] if home else -r["spread_line"]
    return {
        "id": r["decision_id"], "game_id": r["game_id"], "play_id": int(r["play_id"]),
        "week": int(r["week"]), "stype": r["season_type"], "date": r["game_date"],
        "home": r["home_team"], "away": r["away_team"], "pos": r["posteam"], "def": r["defteam"],
        "coach": r["coach"], "qtr": int(r["qtr"]), "clock": r["quarter_seconds_remaining"],
        "t": float(_elapsed(pd.DataFrame([r])).iloc[0]),
        "gsr": r["game_seconds_remaining"], "ytg": int(r["ydstogo"]), "yl": int(r["yardline_100"]),
        "gtg": bool(r["goal_to_go"] == 1), "sd": r["score_differential"],
        "ps": r["posteam_score"], "ds": r["defteam_score"],
        "to_pos": r["posteam_timeouts_remaining"], "to_def": r["defteam_timeouts_remaining"],
        "spread": spread, "roof": r["roof"],
        "choice": r["choice"], "best": r["best"],
        "go_wp": r["go_wp"], "punt_wp": r["punt_wp"], "fg_wp": r["fg_wp"],
        "chosen_wp": r["chosen_wp"], "best_wp": r["best_wp"], "cost": r["wp_cost"],
        "gb": r["go_boost"], "gb_lo": r["go_boost_lo"], "gb_hi": r["go_boost_hi"],
        "boot_pct": r["boot_pct"], "boot_go_pct": r["boot_go_pct"],
        "tier": r["tier"], "err": r["error_type"], "comp": bool(r["competitive"]),
        "stake": r["stake"], "right": bool(r["right_call"]), "critical": bool(r["critical"]),
        "sev": r["severity"], "dir": r["direction"],
        "flags": flags, "prior": int(r["prior_snaps"]), "desc": r["desc"],
        "out": {
            "conv": None if pd.isna(r["fourth_down_converted"]) or r["choice"] != "go" else int(r["fourth_down_converted"]),
            "fg": r["field_goal_result"] if isinstance(r["field_goal_result"], str) else None,
            "td": bool(r["touchdown"] == 1), "wpa": r["wpa"], "won": r["posteam_won"],
            "rve": r["result_vs_exp"], "worked": bool(r["worked"]),
            "pos_final": int(r["home_score"] if home else r["away_score"]),
            "def_final": int(r["away_score"] if home else r["home_score"]),
        },
    }


def _view(d: pd.DataFrame) -> dict:
    d = A.add_situation_bins(d)
    teams = A.summarize(d, ["posteam"]).rename(columns={"posteam": "team"})
    coaches = A.summarize(d, ["coach"])
    coach_teams = d.groupby("coach")["posteam"].agg(lambda s: sorted(set(s)))
    coaches["teams"] = coaches["coach"].map(coach_teams)
    return {
        "league": A.league_summary(d),
        "teams": teams.to_dict("records"),
        "coaches": coaches.to_dict("records"),
        "grid_field_ytg": A.situation_grid(d, "field_zone", "ytg_bin"),
        "by_score": A.situation_table(d, "score_bin"),
        "by_phase": A.situation_table(d, "phase"),
        "by_ytg": A.situation_table(d, "ytg_bin"),
        "weekly": A.weekly_trend(d),
    }


def _rankings(d: pd.DataFrame) -> dict:
    c = d[d["competitive"]]
    by_tol = {}
    for t in R.TOLERANCES:
        rows, league = R.coach_rankings(d, t)
        judged = c[c["stake"] >= t]
        by_tol[f"{t:g}"] = {
            "coaches": rows, "league_score": league,
            "judged": int(len(judged)),
            "judged_per_coach": float(judged.groupby("coach").size().median()),
        }
    style, style_meta = R.coach_style(d)
    sev = c[c["severity"].isin(["slight", "clear", "big"])]
    return {
        "tolerances": [f"{t:g}" for t in R.TOLERANCES],
        "default": f"{R.DEFAULT_TOLERANCE:g}",
        "by_tol": by_tol,
        "style": style, "style_meta": style_meta,
        "severity_summary": [
            {"severity": k, "direction": dn, "n": int(len(g)), "pts": float(g["wp_cost"].sum())}
            for (k, dn), g in sev.groupby(["severity", "direction"])
        ],
        "coin_flips": int((c["severity"] == "coin_flip").sum()),
        "matches": int((c["severity"] == "match").sum()),
        "competitive": int(len(c)),
        "critical": int(c["critical"].sum()),
        "min_games": R.MIN_GAMES, "min_decisions": R.MIN_DECISIONS, "min_chances": R.MIN_CHANCES,
        "critical_stake": R.CRITICAL_STAKE, "n_boot": R.N_BOOT, "coin_flip": M.COIN_FLIP,
    }


def build_season(season: int, nfl4th: pd.DataFrame, final: bool) -> dict:
    pbp = S.load_pbp(season)
    decisions, snaps = D.build_decisions(pbp, nfl4th)
    d = R.add_ranking_fields(M.add_metrics(decisions))
    out_dir = WEB_DATA / str(season)
    import shutil
    shutil.rmtree(out_dir, ignore_errors=True)

    # Games list (including games whose model values are pending).
    games = pbp.groupby("game_id").agg(
        week=("week", "first"), stype=("season_type", "first"), date=("game_date", "first"),
        home=("home_team", "first"), away=("away_team", "first"),
        home_score=("home_score", "max"), away_score=("away_score", "max"),
        home_coach=("home_coach", "first"), away_coach=("away_coach", "first"),
    ).reset_index()
    pending = set(snaps.loc[snaps["exclusion_reason"] == "model_values_pending", "game_id"])
    per_game = d.groupby(["game_id", "posteam"])["wp_cost"].sum().unstack(fill_value=0.0)
    counts = d.groupby("game_id").size()
    games["pending"] = games["game_id"].isin(pending)
    games["n_dec"] = games["game_id"].map(counts).fillna(0).astype(int)
    games["cost_home"] = [per_game.at[g, h] if g in per_game.index and h in per_game.columns else 0.0
                          for g, h in zip(games["game_id"], games["home"])]
    games["cost_away"] = [per_game.at[g, a] if g in per_game.index and a in per_game.columns else 0.0
                          for g, a in zip(games["game_id"], games["away"])]
    games = games.sort_values(["week", "date", "game_id"])

    # Win-probability series for the game explorer, one file per week
    # (keeps the published file count small).
    wp_rows = pbp[pbp["home_wp"].notna()].sort_values(["game_id", "play_id"])
    for week, wk in wp_rows.groupby("week"):
        _write(out_dir / "wp" / f"week_{int(week):02d}.json", {
            gid: [[int(p), int(q), round(float(t), 1), round(float(w), 4)]
                  for p, q, t, w in zip(gp["play_id"], gp["qtr"], _elapsed(gp), gp["home_wp"])]
            for gid, gp in wk.groupby("game_id")
        })

    records = [_decision_record(r) for _, r in d.iterrows()]
    _write(out_dir / "decisions.json", records)

    excl = D.exclusion_summary(snaps)
    summary = {
        "season": season,
        "status": "final" if final else "in_progress",
        "through_week": int(pbp["week"].max()),
        "last_game_date": str(pbp["game_date"].max()),
        "snaps_4th": int(len(snaps)),
        "pending_games": sorted(pending),
        "exclusions": excl.to_dict("records"),
        "games": games.to_dict("records"),
        "views": {"all": _view(d), "competitive": _view(d[d["competitive"]])},
        "top_costly": d.nlargest(25, "wp_cost")["decision_id"].tolist(),
        "rankings": _rankings(d),
    }
    _write(out_dir / "summary.json", summary)
    return {"season": season, "status": summary["status"], "through_week": summary["through_week"],
            "decisions": len(d), "games": int(games.shape[0]), "pending_games": len(pending)}


def build(seasons: dict[int, bool]) -> None:
    nfl4th = S.load_nfl4th()
    built = [build_season(s, nfl4th, final) for s, final in seasons.items()]
    _write(WEB_DATA / "manifest.json", {
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seasons": built,
        "snapshots": S.snapshot_info(),
        "model": {
            "name": "nfl4th (precomputed values)",
            "source": "https://github.com/nflverse/nfl4th",
            "package_version_inspected": "1.0.7.9002",
            "interval": "80% (10th-90th pct of 201 bootstrap draws), nfl4th-fitted models only",
            "team_interval": "90% bootstrap over games (2000 draws, fixed seed)",
        },
    })
