"""Hand-checked metric calculations and sign conventions."""
import numpy as np
import pandas as pd
import pytest

from nfldi.nfl.decisions import build_decisions
from nfldi.nfl.metrics import add_metrics, go_boost_identity_error

G = "2025_01_AAA_BBB"


def one(frame, make_play, make_values, play_kw, vals_args, **vkw):
    pbp = frame([make_play(play_id=20, **play_kw)])
    dec, _ = build_decisions(pbp, frame([make_values(G, 20, *vals_args, **vkw)]))
    return add_metrics(dec).iloc[0]


def test_punt_when_go_is_best(frame, make_play, make_values):
    # go 52.0%, punt 49.5%  ->  cost 2.5 pp, too conservative, go_boost +2.5
    d = one(frame, make_play, make_values, dict(desc="P punts 40 yards"), (.52, .495, np.nan))
    assert d.best == "go" and d.choice == "punt"
    assert d.wp_cost == pytest.approx(2.5)
    assert d.go_boost == pytest.approx(2.5)
    assert d.error_type == "too_conservative"
    assert not d.agrees


def test_agreeing_decision_costs_zero(frame, make_play, make_values):
    d = one(frame, make_play, make_values, dict(desc="K 45 yard field goal is GOOD", play_type="field_goal"),
            (.30, .28, .33))
    assert d.best == "fg" and d.wp_cost == 0 and d.agrees and d.error_type == ""


def test_wrong_kick_has_cost_but_go_kick_agreement(frame, make_play, make_values):
    # Kicking was right (go < both kicks) but FG beat punt by 1.0 pp.
    d = one(frame, make_play, make_values, dict(desc="P punts 30 yards"), (.40, .42, .43))
    assert d.error_type == "wrong_kick" and d.wp_cost == pytest.approx(1.0)
    assert d.agrees_go_kick


def test_tiers_from_interval(frame, make_play, make_values):
    clear = one(frame, make_play, make_values, dict(desc="P punts"), (.52, .50, np.nan), lo=0.5, hi=3.5)
    toss = one(frame, make_play, make_values, dict(desc="P punts"), (.52, .50, np.nan), lo=-0.5, hi=3.5)
    assert clear.tier == "clear_go" and toss.tier == "toss_up"


def test_cost_never_negative_and_identity(frame, make_play, make_values):
    rng = np.random.default_rng(0)
    rows, vals = [], []
    for i in range(200):
        go, punt, fg = rng.uniform(0, 1, 3)
        fg = np.nan if i % 3 == 0 else fg
        choice = ["P punts", "K 40 yard field goal", "pass incomplete"][i % 3 if i % 3 else 0]
        rows.append(make_play(play_id=i * 10, drive=i, desc=choice, pass_=int("pass" in choice)))
        vals.append(make_values(G, i * 10, go, punt, fg))
    d = add_metrics(build_decisions(frame(rows), frame(vals))[0])
    assert (d.wp_cost >= 0).all()
    assert go_boost_identity_error(d).max() < 1e-9


def test_posteam_won_perspective(frame, make_play, make_values):
    home = one(frame, make_play, make_values, dict(desc="P punts", result=7.0), (.5, .5, np.nan))
    away = one(frame, make_play, make_values, dict(desc="P punts", result=7.0, posteam="BBB"), (.5, .5, np.nan))
    assert home.posteam_won == 1 and away.posteam_won == 0
