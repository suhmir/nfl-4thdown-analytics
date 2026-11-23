# Validation report — 2026

Snapshot: `2b94455bb8eb3ae0…` (pbp), `455ce01ad3328dae…` (nfl4th)

## 1. go_boost identity

max |100·(go_wp − max(punt_wp, fg_wp)) − go_boost| = **0.00e+00 pp** over 2172 decisions.

## 2. Go/kick classification vs nfl4th's rule

Snaps with known intent: 2421; nfl4th rule gives NA on 0.
Agreement on the rest: **100.00%** (0 disagreements).

## 3. Coverage and exclusions

4th-down snaps with nfl4th values: 92.8%

| status     | exclusion_reason               |   snaps |
|:-----------|:-------------------------------|--------:|
| decision   | eligible                       |    2172 |
| excluded   | model_values_pending           |     151 |
| excluded   | presnap_penalty_intent_unknown |      78 |
| superseded | superseded_by_later_snap       |      77 |
| excluded   | no_model_values                |      21 |
| excluded   | kneel_or_spike                 |       1 |

## 4. Manual review sample

WP values are the offense's win probability (%). Cost in percentage points.

| # | category | game | situation | go / punt / FG | chose → best | cost | tier | description |
|---|---|---|---|---|---|---|---|---|
| 1 | Largest cost | 2026_01_NO_DET | DET Q4 0:37, 4&1 at 56 to go, score +0 | 68.9 / 58.5 / 19.7 | punt → go | 10.39 | clear_go | (:37) 3-J.Fox punts 56 yards to end zone, Center-49-H.Hatten, Touchback. |
| 2 | Largest cost | 2026_06_HOU_JAX | JAX Q4 2:00, 4&4 at 42 to go, score -3 | 32.6 / 14.7 / 21.6 | fg → go | 10.94 | clear_go | (2:00) 39-C.Little 60 yard field goal is GOOD, Center-55-J.Bobenmoyer, Holder-9-L.Cooke. |
| 3 | Largest cost | 2026_05_PHI_JAX | JAX Q4 1:46, 4&2 at 69 to go, score +2 | 79.4 / 68.4 / 40.2 | punt → go | 10.99 | clear_go | (1:46) 9-L.Cooke punts 41 yards to PHI 28, Center-52-D.Hamilton. 85-B.Covey to PHI 38 for 10 yards (35-J.Mcleo |
| 4 | Fake punt | 2026_09_DET_MIA | DET Q2 14:55, 4&7 at 70 to go, score +0 | 66.5 / 67.6 / 60.0 | go → punt | 1.15 | clear_kick | (14:55) (Punt formation) 3-J.Fox pass short left to 17-T.Martin to DET 41 for 11 yards (4-J.Marshall). |
| 5 | Fake punt | 2026_07_LA_LV | LV Q3 12:07, 4&5 at 70 to go, score -22 | 1.8 / 1.2 / 0.7 | go → go | 0.00 | clear_go | (12:07) (Punt formation) 6-A.Cole pass short middle to 34-C.Heyward to LV 43 for 13 yards (56-S.Dolac; 36-M.Pu |
| 6 | Penalty re-snap | 2026_05_DEN_LAC | LAC Q4 13:16, 4&18 at 90 to go, score +7 | 57.0 / 66.3 / 50.9 | punt → punt | 0.00 | clear_kick | (13:16) 16-J.Scott punts 43 yards to DEN 47, Center-47-J.Harris. 19-M.Mims to LAC 27 for 26 yards (28-K.Vidal; |
| 7 | Penalty re-snap | 2026_04_NYJ_CHI | NYJ Q1 7:35, 4&6 at 95 to go, score +0 | 33.9 / 35.5 / 28.3 | punt → punt | 0.00 | clear_kick | (7:35) 14-A.McNamara punts 60 yards to CHI 35, Center-42-T.Hennessy. 14-K.Raymond to CHI 43 for 8 yards (37-Q. |
| 8 | Nullified attempt | 2026_01_TB_CIN | TB Q3 5:46, 4&1 at 33 to go, score -17 | 5.1 / 3.0 / 3.8 | go → go | 0.00 | clear_go | (5:46) 6-B.Mayfield pass short right to 1-K.Gainwell pushed ob at CIN 28 for 5 yards (0-D.Turner). PENALTY on  |
| 9 | Nullified attempt | 2026_03_CIN_PIT | PIT Q3 6:48, 4&6 at 59 to go, score -3 | 28.0 / 28.7 / 20.7 | punt → punt | 0.00 | toss_up | (6:48) 19-C.Johnston punts 53 yards to CIN 6, Center-46-C.Kuntz, downed by PIT-26-B.Echols. PENALTY on CIN-52- |
| 10 | Aborted snap | 2026_07_DAL_PHI | PHI Q1 3:18, 4&1 at 56 to go, score -3 | 29.6 / 27.4 / 22.4 | go → go | 0.00 | clear_go | (3:18) 16-T.McKee FUMBLES (Aborted) at PHI 44, RECOVERED by DAL-92-Q.Williams at PHI 43. PENALTY on DAL-92-Q.W |
| 11 | Clear go, went | 2026_08_ATL_TB | ATL Q4 15:00, 4&1 at 30 to go, score -16 | 6.0 / — / 4.1 | go → go | 0.00 | clear_go | (15:00) 9-M.Penix up the middle to TB 28 for 2 yards (56-R.Nunez-Roches). |
| 12 | Clear go, went | 2026_09_TB_CHI | TB Q1 1:02, 4&2 at 12 to go, score -14 | 11.5 / — / 9.7 | go → go | 0.00 | clear_go | (1:02) (Shotgun) 6-B.Mayfield pass short left to 88-C.Otton to CHI 10 for 2 yards (31-D.Thieneman). |
| 13 | Clear go, kicked | 2026_03_LA_DEN | DEN Q3 14:08, 4&4 at 62 to go, score -16 | 11.2 / 10.5 / 7.2 | punt → go | 0.69 | clear_go | (14:08) 16-J.Crawshaw punts 62 yards to LA 0, Center-48-M.Fraboni. 19-X.Smith pushed ob at LA 10 for 10 yards  |
| 14 | Clear go, kicked | 2026_10_NE_DET | DET Q3 13:51, 4&2 at 65 to go, score +18 | 94.0 / 93.6 / 90.2 | punt → go | 0.36 | clear_go | (13:51) 3-J.Fox punts 47 yards to NE 18, Center-49-H.Hatten, fair catch by 25-M.Jones. |
| 15 | Toss-up | 2026_04_ARI_NYG | NYG Q3 2:34, 4&8 at 16 to go, score -5 | 29.5 / — / 29.8 | fg → fg | 0.00 | toss_up | (2:34) 34-D.Zvada 34 yard field goal is GOOD, NULLIFIED by Penalty, Center-58-B.Mann, Holder-15-J.Stout. PENAL |
| 16 | Toss-up | 2026_07_DEN_ARI | ARI Q4 6:25, 4&17 at 23 to go, score -17 | 0.7 / — / 0.5 | fg → go | 0.12 | toss_up | (6:25) 38-C.Ryland 41 yard field goal is GOOD, Center-59-C.Kreiter, Holder-12-B.Gillikin. |
| 17 | Too aggressive | 2026_01_ATL_PIT | PIT Q2 1:06, 4&13 at 44 to go, score +6 | 79.3 / 80.9 / 79.8 | go → punt | 1.62 | clear_kick | (1:06) (Field Goal formation) 19-C.Johnston pass incomplete short left [28-M.Ford]. |
| 18 | Too aggressive | 2026_03_PHI_CHI | CHI Q4 2:00, 4&1 at 34 to go, score +20 | 100.0 / 100.0 / 100.0 | go → punt | 0.00 | toss_up | (2:00) 65-L.Newman reported in as eligible. 4-D.Swift left tackle to PHI 19 for 15 yards (2-T.Woolen). |
| 19 | Wrong kick | 2026_01_MIA_LV | MIA Q1 10:38, 4&9 at 44 to go, score +0 | 39.2 / 38.8 / 39.4 | punt → fg | 0.63 | toss_up | (10:38) 48-B.Pinion punts 37 yards to LV 7, Center-46-T.Addington, fair catch by 23-D.Laube. |
| 20 | Wrong kick | 2026_09_HOU_LAC | LAC Q1 0:47, 4&7 at 41 to go, score -7 | 19.0 / 18.2 / 19.1 | punt → fg | 0.91 | toss_up | (:47) 16-J.Scott punts 33 yards to HOU 8, Center-47-J.Harris, fair catch by 1-T.Dell. |
| 21 | Overtime | 2026_06_PIT_TB | TB Q5 1:06, 4&8 at 48 to go, score -7 | 7.4 / 0.2 / 0.0 | go → go | 0.00 | clear_go | (1:06) (Shotgun) 10-J.Daniels sacked at TB 41 for -11 yards (5-J.Ramsey). |
| 22 | End of half | 2026_05_HOU_TEN | TEN Q2 0:16, 4&9 at 53 to go, score -9 | 9.7 / 9.9 / 7.8 | punt → punt | 0.00 | toss_up | (:16) 3-T.Townsend punts 42 yards to HOU 11, Center-46-M.Cox, fair catch by 13-J.Noel. |
