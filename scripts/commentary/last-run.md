# Commentary pipeline: last run

- Run: 2026-10-20T23:36:35+00:00 (offline, drafts.json)
- Clip: `bicycle-kick-2018` (Ronaldo's overhead kick, Juventus v Real Madrid), clockStart 3780 s (minute 63:00), score at start 0-1
- Quiet windows (no speech): 9.5-10.0 s, 19.0-20.6 s
- Speech time estimate: words / 2.6 per second, 0.3 s gap between lines
- Result: 51 aired as drafted, 0 replaced by a template, 0 dropped
- **needs native check**: every `pcm` (Nigerian Pidgin) and `yo` (Yoruba) line is AI-drafted and must be read by a native speaker (Korede) before the pitch.

## Editor

Event scores: ev_001 possession=1, ev_002 pass=1, ev_003 pass=2, ev_004 shot=6, ev_005 pass=1, ev_006 pass=4, ev_007 carry=3, ev_008 cross=6, ev_009 overhead_kick=9, ev_010 goal=10, ev_011 crowd=2, ev_012 crowd=7, ev_013 end=0

- ev_001 (possession) is covered by the opening line
- ev_008 (cross, t=18.5) falls in the goal's quiet window: merged into the goal recap
- ev_009 (overhead_kick, t=19.6) falls in the goal's quiet window: merged into the goal recap
- ev_011 (crowd, t=20.2) falls in the goal's quiet window: merged into the goal recap

| moment | kind | earliest (s) | score | details |
|---|---|---|---|---|
| opening | opening | 0.3 | 100 | essentials, full, analyst |
| goal:ev_010 | goal | 20.6 | 10 | essentials, full, analyst |
| recap:ev_010 | recap | 20.6 | 9 | essentials, full, analyst |
| why:ev_010 | why | 20.6 | 6 | analyst |
| call:ev_002 | call | 2.5 | 1 | full, analyst |
| call:ev_003 | call | 6 | 2 | full, analyst |
| call:ev_004 | call | 10.0 | 6 | full, analyst |
| call:ev_005 | call | 11 | 1 | full, analyst |
| call:ev_006 | call | 14.5 | 4 | full, analyst |
| call:ev_007 | call | 16 | 3 | full, analyst |
| call:ev_012 | call | 25 | 7 | essentials, full, analyst |

Budgets: essentials: 3 lines / 11.0 s; full: 6 lines / 24.0 s; analyst: 7 lines / 32.0 s; favourites: up to 2 extra lines each, in the gaps.

## en / essentials

3 lines for everyone, 7.3 s of speech; 4 favourite-player lines.


| t | until | status | line | favourite | evidence | verifier |
|---|---|---|---|---|---|---|
| 0.30 | 4.1 | aired | Real Madrid lead one nil, attacking toward your right ear. |  | `ev_001` Real Madrid have the ball in midfield, leading 1-0. | evidence ids exist (ev_001); names traceable; score 1-0 matches; timing ok (t=0.3 s >= evidence, clear of quiet windows) |
| 14.50 | 16.8 | aired | Your player, Carvajal, has the ball. | Dani Carvajal | `ev_006` The ball reaches Dani Carvajal on the right. | evidence ids exist (ev_006); names traceable; timing ok (t=14.5 s >= evidence, clear of quiet windows) |
| 20.60 | 22.1 | aired | Ronaldo! Overhead kick! Goal! |  | `ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_009, ev_010); names traceable; timing ok (t=20.6 s >= evidence, clear of quiet windows) |
| 22.44 | 24.4 | aired | Juventus nil, Real Madrid two. |  | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; score 0-2 matches; timing ok (t=22.44 s >= evidence, clear of quiet windows) |
| 24.67 | 26.6 | aired | Your player, Ronaldo, scored that! | Cristiano Ronaldo | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; timing ok (t=24.67 s >= evidence, clear of quiet windows) |
| 24.67 | 27.0 | aired | Your player Carvajal floated that cross. | Dani Carvajal | `ev_008` Carvajal floats a cross in from the right. | evidence ids exist (ev_008); names traceable; timing ok (t=24.67 s >= evidence, clear of quiet windows) |
| 26.90 | 29.6 | aired | Even the Juventus fans applaud your player. | Cristiano Ronaldo | `ev_012` The Juventus home fans applaud Ronaldo. | evidence ids exist (ev_012); names traceable; timing ok (t=26.9 s >= evidence, clear of quiet windows) |

## en / full

6 lines for everyone, 20.0 s of speech; 2 favourite-player lines.


| t | until | status | line | favourite | evidence | verifier |
|---|---|---|---|---|---|---|
| 0.30 | 6.1 | aired | Champions League quarter-final in Turin. Real Madrid lead one nil, attacking toward your right ear. |  | `ev_001` Real Madrid have the ball in midfield, leading 1-0. | evidence ids exist (ev_001); names traceable; score 1-0 matches; timing ok (t=0.3 s >= evidence, clear of quiet windows) |
| 10.00 | 11.9 | aired | Lucas Vázquez shoots. Buffon saves! |  | `ev_004` Lucas Vázquez shoots from close range, and Gianluigi Buffon saves. | evidence ids exist (ev_004); names traceable; timing ok (t=10.0 s >= evidence, clear of quiet windows) |
| 14.50 | 16.8 | aired | Dani Carvajal, out on the right. |  | `ev_006` The ball reaches Dani Carvajal on the right. | evidence ids exist (ev_006); names traceable; timing ok (t=14.5 s >= evidence, clear of quiet windows) |
| 20.60 | 22.5 | aired | Cristiano Ronaldo! Overhead kick! Goal! |  | `ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_009, ev_010); names traceable; timing ok (t=20.6 s >= evidence, clear of quiet windows) |
| 22.83 | 27.8 | aired | Carvajal floated it in. Ronaldo, back to goal. Juventus nil, Real Madrid two. |  | `ev_008` Carvajal floats a cross in from the right.<br>`ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_008, ev_009, ev_010); names traceable; score 0-2 matches; timing ok (t=22.83 s >= evidence, clear of quiet windows) |
| 28.13 | 31.2 | aired | Listen: even the Juventus home fans applaud Ronaldo. |  | `ev_012` The Juventus home fans applaud Ronaldo. | evidence ids exist (ev_012); names traceable; timing ok (t=28.13 s >= evidence, clear of quiet windows) |
| 31.51 | 33.4 | aired | Your player, Ronaldo, scored that! | Cristiano Ronaldo | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; timing ok (t=31.51 s >= evidence, clear of quiet windows) |
| 31.51 | 33.8 | aired | Your player Carvajal floated that cross. | Dani Carvajal | `ev_008` Carvajal floats a cross in from the right. | evidence ids exist (ev_008); names traceable; timing ok (t=31.51 s >= evidence, clear of quiet windows) |

## en / analyst

7 lines for everyone, 24.6 s of speech; 2 favourite-player lines.


| t | until | status | line | favourite | evidence | verifier |
|---|---|---|---|---|---|---|
| 0.30 | 6.8 | aired | Champions League quarter-final, first leg, in Turin. Real Madrid lead one nil, attacking toward your right ear. |  | `ev_001` Real Madrid have the ball in midfield, leading 1-0. | evidence ids exist (ev_001); names traceable; score 1-0 matches; timing ok (t=0.3 s >= evidence, clear of quiet windows) |
| 10.00 | 13.1 | aired | Lucas Vázquez shoots from close range. Buffon saves. |  | `ev_004` Lucas Vázquez shoots from close range, and Gianluigi Buffon saves. | evidence ids exist (ev_004); names traceable; timing ok (t=10.0 s >= evidence, clear of quiet windows) |
| 14.50 | 18.0 | aired | Real keep it. Dani Carvajal, out on the right. |  | `ev_005` The ball runs loose, and Real Madrid keep it out on the right.<br>`ev_006` The ball reaches Dani Carvajal on the right. | evidence ids exist (ev_005, ev_006); names traceable; timing ok (t=14.5 s >= evidence, clear of quiet windows) |
| 20.60 | 22.5 | aired | Cristiano Ronaldo! Overhead kick! Goal! |  | `ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_009, ev_010); names traceable; timing ok (t=20.6 s >= evidence, clear of quiet windows) |
| 22.83 | 27.4 | aired | Carvajal's floated cross, a rare overhead kick. Juventus nil, Real Madrid two. |  | `ev_008` Carvajal floats a cross in from the right.<br>`ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_008, ev_009, ev_010); names traceable; score 0-2 matches; timing ok (t=22.83 s >= evidence, clear of quiet windows) |
| 27.75 | 30.1 | aired | Juventus fans applauding an opponent: rare. |  | `ev_012` The Juventus home fans applaud Ronaldo. | evidence ids exist (ev_012); names traceable; timing ok (t=27.75 s >= evidence, clear of quiet windows) |
| 30.36 | 32.3 | aired | Your player, Ronaldo, scored that! | Cristiano Ronaldo | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; timing ok (t=30.36 s >= evidence, clear of quiet windows) |
| 30.36 | 32.7 | aired | Your player Carvajal floated that cross. | Dani Carvajal | `ev_008` Carvajal floats a cross in from the right. | evidence ids exist (ev_008); names traceable; timing ok (t=30.36 s >= evidence, clear of quiet windows) |
| 32.97 | 35.7 | aired | Two nil away, in the first leg. |  | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; score 2-0 matches; timing ok (t=32.97 s >= evidence, clear of quiet windows) |

## pcm / essentials (needs native check)

3 lines for everyone, 9.2 s of speech; 4 favourite-player lines.


| t | until | status | line | favourite | evidence | verifier |
|---|---|---|---|---|---|---|
| 0.30 | 4.1 | aired | Real Madrid lead one nil, dem dey attack your right. |  | `ev_001` Real Madrid have the ball in midfield, leading 1-0. | evidence ids exist (ev_001); names traceable; score 1-0 matches; timing ok (t=0.3 s >= evidence, clear of quiet windows) |
| 14.50 | 16.8 | aired | Your player Carvajal don get ball! | Dani Carvajal | `ev_006` The ball reaches Dani Carvajal on the right. | evidence ids exist (ev_006); names traceable; timing ok (t=14.5 s >= evidence, clear of quiet windows) |
| 20.60 | 22.9 | aired | Ronaldo don do overhead kick! Goal! |  | `ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_009, ev_010); names traceable; timing ok (t=20.6 s >= evidence, clear of quiet windows) |
| 23.21 | 26.3 | aired | E don be Juventus nil, Real Madrid two. |  | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; score 0-2 matches; timing ok (t=23.21 s >= evidence, clear of quiet windows) |
| 26.59 | 28.9 | aired | Na your player Ronaldo score am! | Cristiano Ronaldo | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; timing ok (t=26.59 s >= evidence, clear of quiet windows) |
| 26.59 | 28.9 | aired | Na your player Carvajal cross am! | Dani Carvajal | `ev_008` Carvajal floats a cross in from the right. | evidence ids exist (ev_008); names traceable; timing ok (t=26.59 s >= evidence, clear of quiet windows) |
| 29.20 | 32.3 | aired | Even Juventus fans dey clap for your player! | Cristiano Ronaldo | `ev_012` The Juventus home fans applaud Ronaldo. | evidence ids exist (ev_012); names traceable; timing ok (t=29.2 s >= evidence, clear of quiet windows) |

## pcm / full (needs native check)

6 lines for everyone, 21.2 s of speech; 2 favourite-player lines.


| t | until | status | line | favourite | evidence | verifier |
|---|---|---|---|---|---|---|
| 0.30 | 6.5 | aired | Champions League quarter-final for Turin. Real Madrid lead one nil, dem dey attack your right ear. |  | `ev_001` Real Madrid have the ball in midfield, leading 1-0. | evidence ids exist (ev_001); names traceable; score 1-0 matches; timing ok (t=0.3 s >= evidence, clear of quiet windows) |
| 10.00 | 12.3 | aired | Lucas Vázquez shoot, Buffon save am! |  | `ev_004` Lucas Vázquez shoots from close range, and Gianluigi Buffon saves. | evidence ids exist (ev_004); names traceable; timing ok (t=10.0 s >= evidence, clear of quiet windows) |
| 14.50 | 17.6 | aired | Ball don reach Dani Carvajal for right side. |  | `ev_006` The ball reaches Dani Carvajal on the right. | evidence ids exist (ev_006); names traceable; timing ok (t=14.5 s >= evidence, clear of quiet windows) |
| 20.60 | 22.9 | aired | Ronaldo don do overhead kick! Goal! |  | `ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_009, ev_010); names traceable; timing ok (t=20.6 s >= evidence, clear of quiet windows) |
| 23.21 | 27.8 | aired | Carvajal cross am, Ronaldo hit am overhead. Juventus nil, Real Madrid two. |  | `ev_008` Carvajal floats a cross in from the right.<br>`ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_008, ev_009, ev_010); names traceable; score 0-2 matches; timing ok (t=23.21 s >= evidence, clear of quiet windows) |
| 28.13 | 30.8 | aired | Even Juventus fans dey clap for Ronaldo! |  | `ev_012` The Juventus home fans applaud Ronaldo. | evidence ids exist (ev_012); names traceable; timing ok (t=28.13 s >= evidence, clear of quiet windows) |
| 31.13 | 33.4 | aired | Na your player Ronaldo score am! | Cristiano Ronaldo | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; timing ok (t=31.13 s >= evidence, clear of quiet windows) |
| 31.13 | 33.4 | aired | Na your player Carvajal cross am! | Dani Carvajal | `ev_008` Carvajal floats a cross in from the right. | evidence ids exist (ev_008); names traceable; timing ok (t=31.13 s >= evidence, clear of quiet windows) |

## pcm / analyst (needs native check)

7 lines for everyone, 25.4 s of speech; 2 favourite-player lines.


| t | until | status | line | favourite | evidence | verifier |
|---|---|---|---|---|---|---|
| 0.30 | 7.6 | aired | Na Champions League quarter-final, first leg, for Turin. Real Madrid lead one nil, dem dey attack your right ear. |  | `ev_001` Real Madrid have the ball in midfield, leading 1-0. | evidence ids exist (ev_001); names traceable; score 1-0 matches; timing ok (t=0.3 s >= evidence, clear of quiet windows) |
| 10.00 | 13.1 | aired | Lucas Vázquez shoot from close, Buffon save am! |  | `ev_004` Lucas Vázquez shoots from close range, and Gianluigi Buffon saves. | evidence ids exist (ev_004); names traceable; timing ok (t=10.0 s >= evidence, clear of quiet windows) |
| 14.50 | 18.3 | aired | Real Madrid still hold ball. Dani Carvajal dey for right. |  | `ev_005` The ball runs loose, and Real Madrid keep it out on the right.<br>`ev_006` The ball reaches Dani Carvajal on the right. | evidence ids exist (ev_005, ev_006); names traceable; timing ok (t=14.5 s >= evidence, clear of quiet windows) |
| 20.60 | 22.9 | aired | Ronaldo don do overhead kick! Goal! |  | `ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_009, ev_010); names traceable; timing ok (t=20.6 s >= evidence, clear of quiet windows) |
| 23.21 | 26.7 | aired | Carvajal cross, Ronaldo overhead! Juventus nil, Real Madrid two. |  | `ev_008` Carvajal floats a cross in from the right.<br>`ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_008, ev_009, ev_010); names traceable; score 0-2 matches; timing ok (t=23.21 s >= evidence, clear of quiet windows) |
| 26.98 | 30.1 | aired | Juventus fans dey clap for opponent. E rare! |  | `ev_012` The Juventus home fans applaud Ronaldo. | evidence ids exist (ev_012); names traceable; timing ok (t=26.98 s >= evidence, clear of quiet windows) |
| 30.36 | 32.7 | aired | Na your player Ronaldo score am! | Cristiano Ronaldo | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; timing ok (t=30.36 s >= evidence, clear of quiet windows) |
| 30.36 | 32.7 | aired | Na your player Carvajal cross am! | Dani Carvajal | `ev_008` Carvajal floats a cross in from the right. | evidence ids exist (ev_008); names traceable; timing ok (t=30.36 s >= evidence, clear of quiet windows) |
| 32.97 | 35.3 | aired | Two nil for away, first leg. |  | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; score 2-0 matches; timing ok (t=32.97 s >= evidence, clear of quiet windows) |

## yo / essentials (needs native check)

3 lines for everyone, 9.6 s of speech; 0 favourite-player lines.


| t | until | status | line | favourite | evidence | verifier |
|---|---|---|---|---|---|---|
| 0.30 | 5.3 | aired | Real Madrid léwájú, ọ̀kan sí òdo. Wọ́n ń kọlu sí apá ọ̀tún rẹ. |  | `ev_001` Real Madrid have the ball in midfield, leading 1-0. | evidence ids exist (ev_001); names traceable; score 1-0 matches; timing ok (t=0.3 s >= evidence, clear of quiet windows) |
| 20.60 | 23.3 | aired | Ronaldo! Ó gbá a lókè orí! Góòlù! |  | `ev_009` Cristiano Ronaldo leaps with his back to goal and hits an overhead kick.<br>`ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_009, ev_010); names traceable; timing ok (t=20.6 s >= evidence, clear of quiet windows) |
| 23.60 | 25.5 | aired | Juventus òdo, Real Madrid méjì. |  | `ev_010` Goal. Past Gianluigi Buffon. Juventus 0, Real Madrid 2. | evidence ids exist (ev_010); names traceable; score 0-2 matches; timing ok (t=23.6 s >= evidence, clear of quiet windows) |

## For Korede: Pidgin and Yoruba lines to check

- [ ] `pcm/essentials` 0.3 s: Real Madrid lead one nil, dem dey attack your right.
- [ ] `pcm/essentials` 14.5 s (favourite: Dani Carvajal): Your player Carvajal don get ball!
- [ ] `pcm/essentials` 20.6 s: Ronaldo don do overhead kick! Goal!
- [ ] `pcm/essentials` 23.2 s: E don be Juventus nil, Real Madrid two.
- [ ] `pcm/essentials` 26.6 s (favourite: Cristiano Ronaldo): Na your player Ronaldo score am!
- [ ] `pcm/essentials` 26.6 s (favourite: Dani Carvajal): Na your player Carvajal cross am!
- [ ] `pcm/essentials` 29.2 s (favourite: Cristiano Ronaldo): Even Juventus fans dey clap for your player!
- [ ] `pcm/full` 0.3 s: Champions League quarter-final for Turin. Real Madrid lead one nil, dem dey attack your right ear.
- [ ] `pcm/full` 10.0 s: Lucas Vázquez shoot, Buffon save am!
- [ ] `pcm/full` 14.5 s: Ball don reach Dani Carvajal for right side.
- [ ] `pcm/full` 20.6 s: Ronaldo don do overhead kick! Goal!
- [ ] `pcm/full` 23.2 s: Carvajal cross am, Ronaldo hit am overhead. Juventus nil, Real Madrid two.
- [ ] `pcm/full` 28.1 s: Even Juventus fans dey clap for Ronaldo!
- [ ] `pcm/full` 31.1 s (favourite: Cristiano Ronaldo): Na your player Ronaldo score am!
- [ ] `pcm/full` 31.1 s (favourite: Dani Carvajal): Na your player Carvajal cross am!
- [ ] `pcm/analyst` 0.3 s: Na Champions League quarter-final, first leg, for Turin. Real Madrid lead one nil, dem dey attack your right ear.
- [ ] `pcm/analyst` 10.0 s: Lucas Vázquez shoot from close, Buffon save am!
- [ ] `pcm/analyst` 14.5 s: Real Madrid still hold ball. Dani Carvajal dey for right.
- [ ] `pcm/analyst` 20.6 s: Ronaldo don do overhead kick! Goal!
- [ ] `pcm/analyst` 23.2 s: Carvajal cross, Ronaldo overhead! Juventus nil, Real Madrid two.
- [ ] `pcm/analyst` 27.0 s: Juventus fans dey clap for opponent. E rare!
- [ ] `pcm/analyst` 30.4 s (favourite: Cristiano Ronaldo): Na your player Ronaldo score am!
- [ ] `pcm/analyst` 30.4 s (favourite: Dani Carvajal): Na your player Carvajal cross am!
- [ ] `pcm/analyst` 33.0 s: Two nil for away, first leg.
- [ ] `yo/essentials` 0.3 s: Real Madrid léwájú, ọ̀kan sí òdo. Wọ́n ń kọlu sí apá ọ̀tún rẹ.
- [ ] `yo/essentials` 20.6 s: Ronaldo! Ó gbá a lókè orí! Góòlù!
- [ ] `yo/essentials` 23.6 s: Juventus òdo, Real Madrid méjì.

