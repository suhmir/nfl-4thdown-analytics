"""Fourth-down decision detection and classification.

Two layers:

1. **Snap classification** (``classify_snaps``): every 4th-down snap gets an
   ``intent`` of ``go`` / ``punt`` / ``fg`` / ``unknown`` / ``excluded``, plus
   flags describing anything unusual (fake kicks, aborted snaps, penalties).
   Intent comes from what the offense lined up to do, not from the result:
   a fake punt is a decision to go for it.

2. **Decision sequences** (``build_decisions``): a delay-of-game followed by a
   punt is two snaps but one decision. Consecutive 4th-down snaps by the same
   offense on the same drive form one sequence; the decision is the *last*
   snap in the sequence whose intent is known, valued at that snap's state.

Every snap that does not become a decision keeps an ``exclusion_reason`` so the
population can be audited (see ``exclusion_summary``).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

PUNT_DESC = r"\bpunts\b|punt is blocked"
FG_DESC = r"\d+ yard field goal"
PUNT_FORMATION = r"\(Punt formation\)"
FG_FORMATION = r"\(Field Goal formation\)"

CHOICES = ("go", "punt", "fg")

SNAP_COLUMNS = [
    "game_id", "play_id", "season", "season_type", "week", "game_date",
    "home_team", "away_team", "posteam", "defteam", "home_coach", "away_coach",
    "fixed_drive", "qtr", "quarter_seconds_remaining", "half_seconds_remaining",
    "game_seconds_remaining", "down", "ydstogo", "yardline_100", "goal_to_go",
    "score_differential", "posteam_score", "defteam_score",
    "posteam_timeouts_remaining", "defteam_timeouts_remaining",
    "desc", "play_type", "play_type_nfl", "rush", "pass", "qb_kneel", "qb_spike",
    "aborted_play", "penalty", "penalty_team", "penalty_type",
    "fourth_down_converted", "fourth_down_failed", "field_goal_result",
    "punt_blocked", "touchdown", "wp", "wpa", "result", "spread_line", "roof",
]


def _flag(series: pd.Series) -> pd.Series:
    return series.fillna(0).astype(float) == 1


def classify_snaps(pbp: pd.DataFrame) -> pd.DataFrame:
    """Return one row per 4th-down snap with ``intent``, flag columns and reason."""
    snaps = pbp.loc[pbp["down"] == 4, [c for c in SNAP_COLUMNS if c in pbp.columns]].copy()
    desc = snaps["desc"].fillna("")
    ptype = snaps["play_type"].fillna("")

    punt_form = desc.str.contains(PUNT_FORMATION, case=False, regex=True)
    fg_form = desc.str.contains(FG_FORMATION, case=False, regex=True)
    is_punt = (ptype == "punt") | desc.str.contains(PUNT_DESC, case=False, regex=True)
    is_fg = (ptype == "field_goal") | desc.str.contains(FG_DESC, case=False, regex=True)
    is_scrimmage = _flag(snaps["rush"]) | _flag(snaps["pass"])
    kneel_spike = _flag(snaps["qb_kneel"]) | _flag(snaps["qb_spike"]) | ptype.isin(["qb_kneel", "qb_spike"])
    aborted = _flag(snaps["aborted_play"])
    no_play = ptype == "no_play"

    intent = np.select(
        [
            kneel_spike,
            is_punt,
            is_fg,
            # An aborted snap shows intent through the formation, even if a
            # player then scooped the ball and ran (rush == 1).
            aborted & punt_form,
            aborted & fg_form,
            is_scrimmage,
            aborted,
            no_play & punt_form,
            no_play & fg_form,
        ],
        ["excluded", "punt", "fg", "punt", "fg", "go", "go", "punt", "fg"],
        default="unknown",
    )
    snaps["intent"] = intent
    snaps["flag_fake_punt"] = (intent == "go") & punt_form
    snaps["flag_fake_fg"] = (intent == "go") & fg_form
    snaps["flag_aborted"] = aborted
    snaps["flag_no_play"] = no_play
    snaps["snap_reason"] = np.select(
        [kneel_spike, (intent == "unknown") & no_play, intent == "unknown"],
        ["kneel_or_spike", "presnap_penalty_intent_unknown", "unclassified"],
        default="",
    )
    return snaps


def assign_sequences(snaps: pd.DataFrame, pbp: pd.DataFrame) -> pd.Series:
    """Sequence id per 4th-down snap.

    A new sequence starts unless the previous play with a down (timeouts and
    other administrative rows have none) was also a 4th down by the same
    offense on the same drive.
    """
    plays = pbp.loc[pbp["down"].notna(), ["game_id", "play_id", "down", "posteam", "fixed_drive"]]
    plays = plays.sort_values(["game_id", "play_id"])
    prev = plays.groupby("game_id")[["down", "posteam", "fixed_drive"]].shift(1)
    continues = (
        (plays["down"] == 4)
        & (prev["down"] == 4)
        & (prev["posteam"] == plays["posteam"])
        & (prev["fixed_drive"] == plays["fixed_drive"])
    )
    new_seq = (plays["down"] == 4) & ~continues
    seq = new_seq.cumsum()
    seq_map = pd.Series(seq.values, index=pd.MultiIndex.from_frame(plays[["game_id", "play_id"]]))
    return pd.Series(
        seq_map.reindex(pd.MultiIndex.from_frame(snaps[["game_id", "play_id"]])).values,
        index=snaps.index,
        name="seq_id",
    )


def build_decisions(pbp: pd.DataFrame, nfl4th: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return ``(decisions, snaps)``.

    ``decisions`` has one row per eligible decision with nfl4th values joined.
    ``snaps`` has every 4th-down snap with its ``status`` (``decision``,
    ``superseded`` or ``excluded``) and ``exclusion_reason``.
    """
    snaps = classify_snaps(pbp)
    snaps["seq_id"] = assign_sequences(snaps, pbp)
    snaps = snaps.sort_values(["game_id", "play_id"])
    snaps["seq_len"] = snaps.groupby("seq_id")["play_id"].transform("size")

    snaps = snaps.merge(nfl4th, on=["game_id", "play_id"], how="left")
    games_with_values = set(nfl4th["game_id"])

    known = snaps["intent"].isin(CHOICES)
    last_known = snaps[known].groupby("seq_id")["play_id"].transform("max")
    snaps["is_decision_snap"] = False
    snaps.loc[last_known.index, "is_decision_snap"] = snaps.loc[last_known.index, "play_id"] == last_known

    # A sequence that ends in a kneel/spike is not a 4th-down decision at all.
    ends_in_kneel = snaps.groupby("seq_id")["snap_reason"].transform("last") == "kneel_or_spike"

    chosen_col = snaps["intent"].map({"go": "go_wp", "punt": "punt_wp", "fg": "fg_wp"})
    chosen_wp = pd.Series(np.nan, index=snaps.index)
    for choice, col in (("go", "go_wp"), ("punt", "punt_wp"), ("fg", "fg_wp")):
        m = snaps["intent"] == choice
        chosen_wp[m] = snaps.loc[m, col]
    snaps["chosen_wp"] = chosen_wp

    reason = pd.Series("", index=snaps.index)
    reason[snaps["snap_reason"] != ""] = snaps["snap_reason"]
    reason[(reason == "") & ~snaps["is_decision_snap"] & known] = "superseded_by_later_snap"
    reason[(reason == "") & ends_in_kneel] = "sequence_ends_in_kneel"
    no_vals = snaps["go_wp"].isna()
    pending = ~snaps["game_id"].isin(games_with_values)
    reason[(reason == "") & no_vals & pending] = "model_values_pending"
    reason[(reason == "") & no_vals] = "no_model_values"
    reason[(reason == "") & snaps["chosen_wp"].isna() & chosen_col.notna()] = "chosen_option_not_modeled"
    snaps["exclusion_reason"] = reason
    snaps["status"] = np.where(reason == "", "decision",
                               np.where(reason == "superseded_by_later_snap", "superseded", "excluded"))

    decisions = snaps[snaps["status"] == "decision"].copy()
    decisions = decisions.rename(columns={"intent": "choice"})
    decisions["coach"] = np.where(decisions["posteam"] == decisions["home_team"],
                                  decisions["home_coach"], decisions["away_coach"])
    decisions["decision_id"] = decisions["game_id"] + "_" + decisions["play_id"].astype(int).astype(str)
    # The sequence's earlier snaps (e.g. a delay of game) are context for the UI.
    decisions["prior_snaps"] = decisions["seq_len"] - 1
    return decisions.reset_index(drop=True), snaps


def exclusion_summary(snaps: pd.DataFrame) -> pd.DataFrame:
    """Counts of 4th-down snaps by status and reason."""
    out = (snaps.assign(exclusion_reason=snaps["exclusion_reason"].replace("", "eligible"))
           .groupby(["status", "exclusion_reason"]).size().rename("snaps").reset_index())
    return out.sort_values("snaps", ascending=False).reset_index(drop=True)
