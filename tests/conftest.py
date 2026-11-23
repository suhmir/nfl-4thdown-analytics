import numpy as np
import pandas as pd
import pytest


def play(game="2025_01_AAA_BBB", play_id=1, down=4, desc="", play_type="punt", posteam="AAA",
         drive=1, rush=0, pass_=0, **kw):
    base = dict(
        game_id=game, play_id=float(play_id), season=2025, season_type="REG", week=1,
        game_date="2025-09-07", home_team="AAA", away_team="BBB", posteam=posteam,
        defteam="BBB" if posteam == "AAA" else "AAA", home_coach="Home Coach", away_coach="Away Coach",
        fixed_drive=float(drive), qtr=2, quarter_seconds_remaining=600.0, half_seconds_remaining=600.0,
        game_seconds_remaining=2400.0, down=down, ydstogo=4.0, yardline_100=60.0, goal_to_go=0,
        score_differential=0.0, posteam_score=0.0, defteam_score=0.0,
        posteam_timeouts_remaining=3.0, defteam_timeouts_remaining=3.0,
        desc=desc, play_type=play_type, play_type_nfl="", rush=float(rush), **{"pass": float(pass_)},
        qb_kneel=0.0, qb_spike=0.0, aborted_play=0.0, penalty=0.0, penalty_team=None, penalty_type=None,
        fourth_down_converted=np.nan, fourth_down_failed=np.nan, field_goal_result=None,
        punt_blocked=0.0, touchdown=0.0, wp=0.5, wpa=0.0, result=3.0, spread_line=0.0, roof="outdoors",
    )
    base.update(kw)
    return base


@pytest.fixture
def make_play():
    return play


def values(game, play_id, go, punt, fg, lo=None, hi=None):
    punt = np.nan if punt is None else punt
    fg = np.nan if fg is None else fg
    kick = np.nanmax([punt, fg])
    gb = 100 * (go - kick)
    return dict(game_id=game, play_id=float(play_id), go_boost=gb, go_wp=go, punt_wp=punt, fg_wp=fg,
                boot_pct=100.0, boot_go_pct=100.0 if gb > 0 else 0.0,
                go_boost_lo=gb - 1 if lo is None else lo, go_boost_hi=gb + 1 if hi is None else hi)


@pytest.fixture
def make_values():
    return values


@pytest.fixture
def frame():
    return lambda rows: pd.DataFrame(rows)
