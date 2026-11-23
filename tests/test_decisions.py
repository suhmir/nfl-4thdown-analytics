"""Sequence building, joins and exclusions."""
import pandas as pd
import pytest

from nfldi.nfl.decisions import build_decisions

G = "2025_01_AAA_BBB"


def test_delay_of_game_then_punt_is_one_decision(frame, make_play, make_values):
    pbp = frame([
        make_play(play_id=10, down=3, play_type="pass", pass_=1, desc="3rd down pass"),
        make_play(play_id=20, play_type="no_play", desc="(Punt formation) PENALTY on AAA, Delay of Game - No Play."),
        make_play(play_id=30, desc="J.Punter punts 45 yards"),
    ])
    vals = frame([make_values(G, 20, .40, .45, None), make_values(G, 30, .38, .44, None)])
    dec, snaps = build_decisions(pbp, vals)
    assert len(dec) == 1
    assert dec.iloc[0].play_id == 30 and dec.iloc[0].prior_snaps == 1
    assert snaps.set_index("play_id").loc[20, "status"] == "superseded"


def test_false_start_then_go_uses_the_go_snap(frame, make_play, make_values):
    pbp = frame([
        make_play(play_id=20, play_type="no_play", desc="(Shotgun) PENALTY on AAA, False Start - No Play."),
        make_play(play_id=30, play_type="run", rush=1, desc="R.Back up the middle for 6 yards"),
    ])
    vals = frame([make_values(G, 20, .50, .45, None), make_values(G, 30, .48, .45, None)])
    dec, snaps = build_decisions(pbp, vals)
    assert dec.choice.tolist() == ["go"] and dec.play_id.tolist() == [30]


def test_separate_fourth_downs_on_one_drive_are_separate_decisions(frame, make_play, make_values):
    # 4th-down go converted by defensive penalty, drive continues, later 4th-down FG.
    pbp = frame([
        make_play(play_id=20, play_type="no_play", pass_=1, desc="(Shotgun) pass incomplete. PENALTY on BBB, Holding - No Play."),
        make_play(play_id=30, down=1, play_type="run", rush=1, desc="1st down run"),
        make_play(play_id=40, play_type="field_goal", desc="K.Kicker 30 yard field goal is GOOD"),
    ])
    vals = frame([make_values(G, 20, .55, .45, None), make_values(G, 40, .5, None, .6)])
    dec, _ = build_decisions(pbp, vals)
    assert dec.play_id.tolist() == [20, 40]


def test_change_of_possession_breaks_sequence(frame, make_play, make_values):
    pbp = frame([
        make_play(play_id=20, play_type="pass", pass_=1, desc="pass incomplete", posteam="AAA", drive=1),
        make_play(play_id=30, play_type="field_goal", desc="K 40 yard field goal is GOOD", posteam="BBB", drive=2),
    ])
    vals = frame([make_values(G, 20, .5, .45, None), make_values(G, 30, .5, None, .6)])
    dec, _ = build_decisions(pbp, vals)
    assert len(dec) == 2 and dec.coach.tolist() == ["Home Coach", "Away Coach"]


def test_missing_values_reason_pending_vs_not_modeled(frame, make_play, make_values):
    other = "2025_01_CCC_DDD"
    pbp = frame([
        make_play(play_id=20, desc="P punts 40 yards"),
        make_play(game=other, play_id=20, desc="P punts 40 yards"),
    ])
    vals = frame([make_values(G, 99, .5, .5, None)])  # G has values (other play), other game has none
    _, snaps = build_decisions(pbp, vals)
    reasons = dict(zip(snaps.game_id, snaps.exclusion_reason))
    assert reasons[G] == "no_model_values"
    assert reasons[other] == "model_values_pending"


def test_chosen_option_not_modeled_is_excluded(frame, make_play, make_values):
    pbp = frame([make_play(play_id=20, desc="P punts 19 yards", yardline_100=29.0)])
    vals = frame([make_values(G, 20, .9999, None, .9998)])
    dec, snaps = build_decisions(pbp, vals)
    assert dec.empty and snaps.iloc[0].exclusion_reason == "chosen_option_not_modeled"
