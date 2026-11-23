"""Coach ranking: score formula, tiers, eligibility, outcome sign."""
import numpy as np
import pandas as pd
import pytest

from nfldi.nfl import rankings as R


def rows_for(coach, n_games, right, stake=2.0, per_game=3, team="AAA"):
    out = []
    for g in range(n_games):
        for k in range(per_game):
            out.append(dict(coach=coach, posteam=team, game_id=f"{coach}{g}", competitive=True, stake=stake,
                            right_call=right if isinstance(right, bool) else right[(g * per_game + k) % len(right)],
                            critical=stake >= 1, late_close=False, model_go=True, went=True, wp_cost=0.0,
                            result_vs_exp=1.0, worked=True))
    return out


def test_score_is_stakes_weighted():
    d = pd.DataFrame([
        dict(coach="A", posteam="AAA", game_id=f"g{i}", competitive=True, stake=s, right_call=r, critical=True,
             late_close=False, model_go=True, went=True, wp_cost=0.0, result_vs_exp=0.0, worked=True)
        for i, (s, r) in enumerate([(10.0, True), (1.0, False)] * 4)
    ])
    rows, league = R.coach_rankings(d)
    assert rows[0]["score"] == pytest.approx(10 / 11)
    assert league == pytest.approx(10 / 11)


def test_tiers_separate_clear_cases_and_small_samples_unranked():
    d = pd.DataFrame(
        rows_for("Good", 17, True) + rows_for("Bad", 17, False)
        + rows_for("Mid", 17, [True, False]) + rows_for("Interim", 3, True)
    )
    rows, _ = R.coach_rankings(d)
    by = {r["coach"]: r for r in rows}
    assert by["Good"]["tier"] == "Above average" and by["Good"]["rank"] == 1
    assert by["Bad"]["tier"] == "Below average" and by["Bad"]["rank"] == 3
    assert by["Interim"]["tier"] == "Not ranked" and "rank" not in by["Interim"]
    assert by["Good"]["rank_lo"] == 1 and by["Bad"]["rank_hi"] == 3


def test_non_competitive_decisions_ignored():
    d = pd.DataFrame(rows_for("A", 8, True))
    garbage = pd.DataFrame(rows_for("A", 8, False)).assign(competitive=False, game_id=lambda x: x.game_id + "x")
    rows, _ = R.coach_rankings(pd.concat([d, garbage]))
    assert rows[0]["score"] == 1.0


def test_result_vs_expectation_sign(frame, make_play, make_values):
    from nfldi.nfl.decisions import build_decisions
    from nfldi.nfl.metrics import add_metrics
    g = "2025_01_AAA_BBB"
    # Went for it with 55% expected; converted, win chance rose to 63%.
    pbp = frame([make_play(play_id=20, play_type="pass", pass_=1, desc="pass complete", vegas_wp=0.50, vegas_wpa=0.13)])
    d = add_metrics(build_decisions(pbp, frame([make_values(g, 20, .55, .50, None)]))[0]).iloc[0]
    assert d.result_vs_exp == pytest.approx(8.0) and d.worked
