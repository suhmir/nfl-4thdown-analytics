import numpy as np
import pandas as pd
import pytest

from nfldi.nfl import aggregate as A


def synthetic(n_games=10, per_game=4, cost=1.0):
    rows = []
    for g in range(n_games):
        for k in range(per_game):
            rows.append(dict(game_id=f"g{g}", posteam="AAA", coach="C", went=k == 0, model_go=k < 2,
                             agrees=k != 1, clear=True, tier="clear_go" if k < 2 else "clear_kick",
                             wp_cost=cost if k == 1 else 0.0,
                             error_type="too_conservative" if k == 1 else ""))
    return pd.DataFrame(rows)


def test_summary_counts_and_rates():
    s = A.summarize(synthetic(), ["posteam"]).iloc[0]
    assert s.decisions == 40 and s.games == 10
    assert s.go_rate == pytest.approx(0.25)
    assert s.model_go_rate == pytest.approx(0.5)
    assert s.go_rate_when_go_rec == pytest.approx(0.5)
    assert s.go_rate_when_kick_rec == pytest.approx(0.0)
    assert s.wp_cost == pytest.approx(10.0) and s.cost_conservative == pytest.approx(10.0)


def test_bootstrap_degenerate_when_games_identical():
    s = A.summarize(synthetic(), ["posteam"]).iloc[0]
    assert s.wp_cost_lo == pytest.approx(10.0) and s.wp_cost_hi == pytest.approx(10.0)


def test_bootstrap_interval_contains_point_and_is_reproducible():
    d = synthetic()
    d.loc[d.wp_cost > 0, "wp_cost"] = np.arange(1, 11, dtype=float)
    a = A.summarize(d, ["posteam"]).iloc[0]
    b = A.summarize(d, ["posteam"]).iloc[0]
    assert a.wp_cost_lo < a.wp_cost < a.wp_cost_hi
    assert (a.wp_cost_lo, a.wp_cost_hi) == (b.wp_cost_lo, b.wp_cost_hi)
