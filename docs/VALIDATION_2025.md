# Validation report — 2025

Snapshot: `6b7f629136def217…` (pbp), `455ce01ad3328dae…` (nfl4th)

## 1. go_boost identity

max |100·(go_wp − max(punt_wp, fg_wp)) − go_boost| = **0.00e+00 pp** over 4026 decisions.

## 2. Go/kick classification vs nfl4th's rule

Snaps with known intent: 4159; nfl4th rule gives NA on 0.
Agreement on the rest: **100.00%** (0 disagreements).

## 3. Coverage and exclusions

4th-down snaps with nfl4th values: 99.3%

| status     | exclusion_reason               |   snaps |
|:-----------|:-------------------------------|--------:|
| decision   | eligible                       |    4026 |
| excluded   | presnap_penalty_intent_unknown |     127 |
| superseded | superseded_by_later_snap       |     104 |
| excluded   | no_model_values                |      28 |
| excluded   | kneel_or_spike                 |       4 |
| excluded   | chosen_option_not_modeled      |       1 |

## 4. Manual review sample

WP values are the offense's win probability (%). Cost in percentage points.

| # | category | game | situation | go / punt / FG | chose → best | cost | tier | description |
|---|---|---|---|---|---|---|---|---|
| 1 | Largest cost | 2025_12_PIT_CHI | PIT Q4 2:01, 4&9 at 77 to go, score -3 | 16.3 / 8.8 / 2.7 | punt → go | 7.44 | clear_go | (2:01) 3-C.Waitman punts 33 yards to CHI 44, Center-46-C.Kuntz, downed by PIT-44-C.Bruener. |
| 2 | Largest cost | 2025_17_PIT_CLE | CLE Q4 2:24, 4&1 at 81 to go, score +4 | 72.8 / 61.3 / 37.3 | punt → go | 11.48 | clear_go | (2:24) 13-C.Bojorquez punts 61 yards to PIT 20, Center-50-R.Sunahara, fair catch by 13-S.Miller. |
| 3 | Largest cost | 2025_18_CLE_CIN | CLE Q4 2:50, 4&1 at 82 to go, score +5 | 76.6 / 63.1 / 41.2 | punt → go | 13.52 | clear_go | (2:50) 13-C.Bojorquez punts 46 yards to CIN 36, Center-50-R.Sunahara. 12-K.Williams to CIN 39 for 3 yards (28- |
| 4 | Fake punt | 2025_18_IND_HOU | IND Q1 4:20, 4&5 at 71 to go, score +1 | 24.2 / 25.1 / 19.0 | go → punt | 0.90 | clear_kick | (4:20) (Punt formation) 8-R.Sanchez pass short right to 81-M.Alie-Cox to IND 45 for 16 yards (31-D.Clark). |
| 5 | Fake punt | 2025_17_NE_NYJ | NYJ Q3 14:09, 4&2 at 57 to go, score -32 | 0.1 / 0.1 / 0.0 | go → go | 0.00 | toss_up | (14:09) (Punt formation) 14-A.McNamara pass short middle to 27-M.Moore to NYJ 46 for 3 yards (41-B.Schooler). |
| 6 | Penalty re-snap | 2025_11_KC_DEN | KC Q2 0:02, 4&6 at 59 to go, score +0 | 62.4 / 62.3 / 62.4 | go → go | 0.00 | toss_up | (:02) (Shotgun) 15-P.Mahomes sacked at KC 32 for -9 yards (29-J.McMillian). |
| 7 | Penalty re-snap | 2025_12_BUF_HOU | BUF Q4 0:24, 4&6 at 22 to go, score -4 | 28.7 / — / 0.0 | go → go | 0.00 | clear_go | (:24) (Shotgun) 17-J.Allen pass short left intended for 5-J.Palmer INTERCEPTED by 2-C.Bullock at HOU 9. 2-C.Bu |
| 8 | Nullified attempt | 2025_05_DEN_PHI | PHI Q4 0:21, 4&7 at 71 to go, score -4 | 2.3 / 0.4 / 0.0 | go → go | 0.00 | clear_go | (:21) (Shotgun) 1-J.Hurts pass incomplete deep right to 88-D.Goedert. PENALTY on DEN-34-J.Skinner, Defensive P |
| 9 | Nullified attempt | 2025_04_LAC_NYG | LAC Q2 0:38, 4&2 at 41 to go, score -10 | 36.6 / 32.3 / 33.2 | go → go | 0.00 | clear_go | (:38) (Shotgun) 75-B.Bozeman to NYG 45 for -4 yards. FUMBLES, recovered by LAC-10-J.Herbert at NYG 45. 10-J.He |
| 10 | Aborted snap | 2025_06_NE_NO | NE Q2 5:54, 4&7 at 39 to go, score +1 | 68.8 / 66.5 / 68.8 | go → go | 0.00 | toss_up | (5:54) (Shotgun) 10-D.Maye Aborted. 65-G.Bradbury FUMBLES at NO 45, recovered by NE-10-D.Maye at NE 47. |
| 11 | Clear go, went | 2025_09_IND_PIT | IND Q1 0:30, 4&1 at 75 to go, score +7 | 80.3 / 78.9 / 72.5 | go → go | 0.00 | clear_go | (:30) (Punt formation) Direct snap to 25-R.Thomas. 25-R.Thomas up the middle to IND 28 for 3 yards (41-P.Wilso |
| 12 | Clear go, went | 2025_08_TB_NO | NO Q4 4:57, 4&11 at 24 to go, score -20 | 0.2 / — / 0.1 | go → go | 0.00 | clear_go | (4:57) (Shotgun) 6-T.Shough pass incomplete short left to 88-J.Stoll. |
| 13 | Clear go, kicked | 2025_04_BAL_KC | KC Q2 10:03, 4&5 at 5 to go, score -4 | 37.6 / — / 34.8 | fg → go | 2.73 | clear_go | (10:03) 7-H.Butker 23 yard field goal is GOOD, Center-41-J.Winchester, Holder-14-M.Araiza. |
| 14 | Clear go, kicked | 2025_10_CLE_NYJ | CLE Q4 3:00, 4&4 at 11 to go, score -10 | 9.3 / — / 7.0 | fg → go | 2.36 | clear_go | (3:00) 25-A.Szmyt 29 yard field goal is GOOD, Center-50-R.Sunahara, Holder-13-C.Bojorquez. |
| 15 | Toss-up | 2025_18_MIA_NE | MIA Q2 0:32, 4&4 at 34 to go, score -7 | 9.7 / 7.3 / 9.8 | fg → fg | 0.00 | toss_up | (:32) 47-R.Patterson 52 yard field goal is GOOD, Center-49-J.Cardona, Holder-16-J.Bailey. |
| 16 | Toss-up | 2025_18_CLE_CIN | CIN Q3 2:02, 4&10 at 44 to go, score -5 | 46.0 / 45.8 / 43.9 | punt → go | 0.21 | toss_up | (2:02) 8-R.Rehkow punts 35 yards to CLE 9, Center-46-W.Wagner, fair catch by 84-G.Larvadain. |
| 17 | Too aggressive | 2025_12_NYG_DET | NYG Q4 2:59, 4&6 at 6 to go, score +3 | 70.9 / — / 71.3 | go → fg | 0.36 | toss_up | (2:59) (Shotgun) 19-J.Winston pass incomplete short middle to 84-T.Johnson (23-R.Ya-Sin). |
| 18 | Too aggressive | 2025_13_MIN_SEA | MIN Q4 3:15, 4&13 at 40 to go, score -26 | 0.0 / 0.0 / 0.0 | go → punt | 0.00 | clear_kick | (3:15) (Shotgun) 12-M.Brosmer sacked at SEA 47 for -7 yards (sack split by 42-D.Thomas and 7-U.Nwosu). |
| 19 | Wrong kick | 2025_18_IND_HOU | HOU Q2 4:07, 4&10 at 41 to go, score +10 | 90.9 / 91.2 / 92.0 | punt → fg | 0.85 | clear_kick | (4:07) 6-T.Townsend punts 33 yards to IND 8, Center-40-A.Brinkman, fair catch by 2-J.Downs. |
| 20 | Wrong kick | 2025_01_TB_ATL | ATL Q1 6:34, 4&8 at 41 to go, score +7 | 60.6 / 59.8 / 61.4 | punt → fg | 1.62 | toss_up | (6:34) 13-B.Pinion punts 33 yards to TB 8, Center-49-L.McCullough, fair catch by 19-K.Johnson. |
| 21 | Overtime | 2025_02_NYG_DAL | NYG Q5 4:59, 4&17 at 79 to go, score +0 | 14.8 / 35.6 / 4.5 | punt → punt | 0.00 | clear_kick | (4:59) 12-J.Gillan punts 41 yards to DAL 38, Center-59-C.Kreiter, fair catch by 1-J.Tolbert. |
| 22 | End of half | 2025_18_IND_HOU | HOU Q2 0:03, 4&4 at 11 to go, score +3 | 80.6 / — / 84.2 | fg → fg | 0.00 | clear_kick | (:03) 15-K.Fairbairn 29 yard field goal is GOOD, Center-40-A.Brinkman, Holder-6-T.Townsend. |
