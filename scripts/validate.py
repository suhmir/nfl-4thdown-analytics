"""Validation report for a season: writes docs/VALIDATION_<season>.md.

Checks:
1. go_boost identity (units understood).
2. Our go/kick classification vs nfl4th's own rule from load_4th_pbp().
3. Join coverage between play-by-play and nfl4th values.
4. A fixed, stratified sample of real decisions for manual review.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from nfldi.nfl import decisions as D, metrics as M, sources as S

ROOT = Path(__file__).resolve().parents[1]


def nfl4th_go_rule(snaps: pd.DataFrame) -> pd.Series:
    """Port of nfl4th load_4th_pbp()'s `go` column (R/wrapper.R)."""
    desc = snaps["desc"].fillna("")
    go = (((snaps["rush"] == 1) | (snaps["pass"] == 1))
          & ~snaps["play_type_nfl"].isin(["PUNT", "FIELD_GOAL"])).astype(float)
    go[(snaps["aborted_play"] == 1) & desc.str.contains("Punt formation")] = 0.0
    ambiguous = (desc.str.contains(r"\(Run formation\)|\(Pass formation\)|\(Shotgun\)")
                 & desc.str.contains(r"False Start|Neutral Zone Infraction"))
    go[ambiguous] = np.nan
    return go


def main(season: int) -> None:
    pbp, vals = S.load_pbp(season), S.load_nfl4th()
    dec, snaps = D.build_decisions(pbp, vals)
    d = M.add_metrics(dec)
    lines = [f"# Validation report — {season}", "",
             f"Snapshot: `{S.snapshot_info()[f'pbp_{season}']['sha256'][:16]}…` (pbp), "
             f"`{S.snapshot_info()['nfl4th_pre_computed']['sha256'][:16]}…` (nfl4th)", ""]

    err = M.go_boost_identity_error(d)
    lines += ["## 1. go_boost identity", "",
              f"max |100·(go_wp − max(punt_wp, fg_wp)) − go_boost| = **{err.max():.2e} pp** over {len(d)} decisions.", ""]

    n4 = nfl4th_go_rule(snaps)
    known = snaps["intent"].isin(D.CHOICES)
    ours = (snaps["intent"] == "go").astype(float)
    cmp = pd.DataFrame({"ours": ours[known], "nfl4th": n4[known], "desc": snaps.loc[known, "desc"],
                        "play_type": snaps.loc[known, "play_type"]})
    both = cmp.dropna()
    agree = (both.ours == both.nfl4th).mean()
    dis = both[both.ours != both.nfl4th]
    lines += ["## 2. Go/kick classification vs nfl4th's rule", "",
              f"Snaps with known intent: {known.sum()}; nfl4th rule gives NA on {cmp.nfl4th.isna().sum()}.",
              f"Agreement on the rest: **{agree:.2%}** ({len(dis)} disagreements).", ""]
    if len(dis):
        lines += ["| ours | nfl4th | play_type | description |", "|---|---|---|---|"]
        for _, r in dis.head(25).iterrows():
            lines.append(f"| {'go' if r.ours else 'kick'} | {'go' if r.nfl4th else 'kick'} | {r.play_type} | {r.desc[:140]} |")
        lines.append("")

    cov = snaps["go_wp"].notna().mean()
    lines += ["## 3. Coverage and exclusions", "", f"4th-down snaps with nfl4th values: {cov:.1%}", "",
              D.exclusion_summary(snaps).to_markdown(index=False), ""]

    # Stratified manual-review sample (fixed seed).
    rng = 7
    picks = []
    def take(label, frame, n=2):
        if len(frame):
            picks.extend((label, r) for _, r in frame.sample(min(n, len(frame)), random_state=rng).iterrows())
    take("Largest cost", d.nlargest(3, "wp_cost"), 3)
    take("Fake punt", d[d.flag_fake_punt])
    take("Penalty re-snap", d[d.prior_snaps > 0])
    take("Nullified attempt", d[d.flag_no_play])
    take("Aborted snap", d[d.flag_aborted], 1)
    take("Clear go, went", d[(d.tier == "clear_go") & d.went])
    take("Clear go, kicked", d[(d.tier == "clear_go") & ~d.went])
    take("Toss-up", d[d.tier == "toss_up"])
    take("Too aggressive", d[d.error_type == "too_aggressive"])
    take("Wrong kick", d[d.error_type == "wrong_kick"])
    take("Overtime", d[d.qtr >= 5], 1)
    take("End of half", d[(d.qtr == 2) & (d.quarter_seconds_remaining < 30)], 1)

    lines += ["## 4. Manual review sample", "",
              "WP values are the offense's win probability (%). Cost in percentage points.", "",
              "| # | category | game | situation | go / punt / FG | chose → best | cost | tier | description |",
              "|---|---|---|---|---|---|---|---|---|"]
    fmt = lambda x: "—" if pd.isna(x) else f"{100*x:.1f}"
    for i, (label, r) in enumerate(picks, 1):
        clock = f"Q{int(r.qtr)} {int(r.quarter_seconds_remaining)//60}:{int(r.quarter_seconds_remaining)%60:02d}"
        sit = f"{r.posteam} {clock}, 4&{int(r.ydstogo)} at {int(r.yardline_100)} to go, score {int(r.score_differential):+d}"
        lines.append(f"| {i} | {label} | {r.game_id} | {sit} | {fmt(r.go_wp)} / {fmt(r.punt_wp)} / {fmt(r.fg_wp)} "
                     f"| {r.choice} → {r.best} | {r.wp_cost:.2f} | {r.tier} | {r.desc[:110]} |")
    out = ROOT / "docs" / f"VALIDATION_{season}.md"
    out.write_text("\n".join(lines) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 2025)
