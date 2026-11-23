"""Snap-level intent classification against real description patterns."""
from nfldi.nfl.decisions import classify_snaps


def classify(frame, make_play, **kw):
    return classify_snaps(frame([make_play(**kw)])).iloc[0]


def test_ordinary_punt(frame, make_play):
    s = classify(frame, make_play, desc="(7:36) 6-J.Gillan punts 39 yards to PHI 19.", play_type="punt")
    assert s.intent == "punt"


def test_field_goal(frame, make_play):
    s = classify(frame, make_play, desc="4-J.Elliott 40 yard field goal is GOOD", play_type="field_goal")
    assert s.intent == "fg"


def test_go_pass(frame, make_play):
    s = classify(frame, make_play, desc="(Shotgun) J.Hurts pass short left", play_type="pass", pass_=1)
    assert s.intent == "go" and not s.flag_fake_punt


def test_fake_punt_is_go_and_flagged(frame, make_play):
    s = classify(frame, make_play, play_type="run", rush=1,
                 desc="(Punt formation) Direct snap to 21-A.Davis. 21-A.Davis up the middle for 4 yards")
    assert s.intent == "go" and s.flag_fake_punt


def test_penalty_nullified_punt_keeps_punt_intent(frame, make_play):
    s = classify(frame, make_play, play_type="no_play",
                 desc="6-J.Gillan punts 39 yards to PHI 19. PENALTY on PHI, Defensive Offside - No Play.")
    assert s.intent == "punt"


def test_nullified_go_attempt_is_go(frame, make_play):
    s = classify(frame, make_play, play_type="no_play", pass_=1,
                 desc="(Shotgun) 6-B.Mayfield pass incomplete. PENALTY on BUF, Illegal Contact - No Play.")
    assert s.intent == "go" and s.flag_no_play


def test_presnap_penalty_in_punt_formation_is_punt(frame, make_play):
    s = classify(frame, make_play, play_type="no_play",
                 desc="(Punt formation) PENALTY on NYJ, Delay of Game, 5 yards - No Play.")
    assert s.intent == "punt"


def test_presnap_penalty_in_shotgun_is_unknown(frame, make_play):
    # Could be a genuine attempt or a hard count to draw the defense offside.
    s = classify(frame, make_play, play_type="no_play",
                 desc="(Shotgun) PENALTY on CLE-79, False Start, 5 yards - No Play.")
    assert s.intent == "unknown" and s.snap_reason == "presnap_penalty_intent_unknown"


def test_kneel_excluded(frame, make_play):
    s = classify(frame, make_play, play_type="qb_kneel", qb_kneel=1.0, desc="P.Mahomes kneels")
    assert s.intent == "excluded" and s.snap_reason == "kneel_or_spike"


def test_aborted_snap_in_punt_formation_is_punt(frame, make_play):
    s = classify(frame, make_play, play_type="run", aborted_play=1.0,
                 desc="(Punt formation) Aborted. 46-L.Rhodes FUMBLES at DEN 20")
    # rush flag is 0 here: nflfastR codes many aborted snaps without rush/pass.
    assert s.intent == "punt"


def test_aborted_punt_snap_with_scoop_and_run_is_still_punt(frame, make_play):
    # Real 2025 play: nfl4th codes this as a kick; intent was to punt.
    s = classify(frame, make_play, play_type="run", rush=1, aborted_play=1.0,
                 desc="(Punt formation) 27-M.Moore FUMBLES (Aborted) at NYJ 24, recovered by NYJ-32-I.Davis. "
                      "32-I.Davis pushed ob at NYJ 44 for 20 yards")
    assert s.intent == "punt" and not s.flag_fake_punt
