# Existing marking-menu stroke datasets

Research for [#525](https://github.com/QuentinRoy/Marking-Menu/issues/525), part of [Map: support reliable 12-item menus](https://github.com/QuentinRoy/Marking-Menu/issues/518). Vocabulary (level, breadth, depth, gap, stroke, mark) follows [`CONTEXT.md`](../../CONTEXT.md). Recognizers are surveyed separately in [#520](https://github.com/QuentinRoy/Marking-Menu/issues/520).

## Answer

No published dataset of human marking-menu strokes was found. The marking-menu studies that measured breadth 12 or depth 2+ report aggregate times and error rates; none of the papers or author pages found links to raw strokes. The closest public stroke data (the $-family gesture logs, a touch swipe-typing corpus, touch-biometrics swipes) either lacks the menu layout and intended item or isn't directional marks at all.

The touch corpus in [#521](https://github.com/QuentinRoy/Marking-Menu/issues/521) has to be new. Two public datasets can supplement it as secondary checks but can't replace it.

| Dataset                                                                                                                | Verdict               | Why                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Marking-menu studies (Kurtenbach & Buxton, Zhao & Balakrishnan, Lepinski et al., Henderson et al., Bailly & Lecolinet) | Unusable              | No stroke data published; described in papers only.                                                                                         |
| $1 unistroke logs                                                                                                      | Supplement (weak)     | Real timestamped strokes, but stylus, no menu, and only a few gestures (`caret`, `v`, `check`, `zig-zag`) are straight multi-segment marks. |
| $N MMG logs                                                                                                            | Supplement (weak)     | Includes finger input, but same problem: symbols, not marks at known angles.                                                                |
| How We Swipe (shape-writing)                                                                                           | Supplement (optional) | Large touch corpus with timestamps and a known layout, but strokes pass through keys, not straight marks at menu angles.                    |
| Touchalytics and similar touch biometrics                                                                              | Unusable              | Single scroll swipes with no intended target.                                                                                               |

## Verification limits

From this environment only GitHub (including `raw.githubusercontent.com`) was reachable. `depts.washington.edu`, `osf.io`, `zenodo.org`, `dl.acm.org`, `arxiv.org` and the authors' sites were blocked by the egress proxy, so their pages could not be opened directly. Claims about those pages come from web-search results that quote them and are marked "(search result)". The $1 and MMG file formats were confirmed by downloading copies of the logs mirrored on GitHub. Direct searches of Zenodo and OSF were impossible; web searches restricted to those sites returned nothing on marking menus.

## Marking-menu studies

None of these found a published dataset. All are "described in paper only".

- **Kurtenbach & Buxton, "The limits of expert performance using hierarchic marking menus", CHI '93** ([ACM](https://dl.acm.org/doi/10.1145/169059.169426), [PDF at Autodesk Research](https://www.research.autodesk.com/app/uploads/2023/03/the-limits-of-expert.pdf_recyw5wL6ekPqcE4Q.pdf)). The only classic study found that tested breadth 12 at depth 2+: it asked whether experts could select from a menu of 3 levels with 12 items each, and concluded that under a 10% error rate breadth 4 allows depth 4 and breadth 8 allows depth 2. Pen computer (Momenta) among the devices. No data link on the ACM page or [Buxton's page](https://www.billbuxton.com/MMExpert.html) (search result).
- **Kurtenbach & Buxton, "User learning and performance with marking menus", CHI '94** ([ACM](https://dl.acm.org/doi/10.1145/191666.191759)). Field study of novice-to-expert transition; no data link found.
- **Zhao & Balakrishnan, "Simple vs. compound mark hierarchical marking menus", UIST '04** ([ACM](https://dl.acm.org/doi/10.1145/1029632.1029639), [PDF](https://www.dgp.toronto.edu/~ravin/papers/uist2004_simplemm.pdf)). Compared multi-stroke simple marks against compound marks over breadth and depth; compound marks degrade at large item counts (search result). No data link found.
- **Lepinski, Grossman & Fitzmaurice, "The design and evaluation of multitouch marking menus", CHI '10** ([ACM via Scholar](https://scholar.google.com/scholar_lookup?doi=10.1145/1753326.1753663), [Semantic Scholar](https://www.semanticscholar.org/paper/The-design-and-evaluation-of-multitouch-marking-Lepinski-Grossman/32d5f434e64c8c92166dc2148decf975304f9d86)). Touch, but multi-finger chords rather than single-finger compound marks; no data link found.
- **Henderson, Malacria, Nancel & Lank, "Investigating the necessity of delay in marking menu invocation", CHI '20** ([ACM](https://dl.acm.org/doi/10.1145/3313831.3376296), [HAL](https://hal.science/hal-02463247/)). Three experiments on delay and mark mode, the novice pause this library keeps. No data or OSF link appears in the search results for the paper, its HAL record, or its ACM page.
- **Bailly & Lecolinet** (Wave menus, Flower menus, Wavelet menus; e.g. [Wave Menus, INTERACT '07](https://link.springer.com/chapter/10.1007/978-3-540-74796-3_45), [Wavelet menus, AVI '10](https://dl.acm.org/doi/10.1145/1842993.1843025)). Search for their data returned only the papers.
- **M3 Gesture Menu** (Zheng et al., CHI '18; [ResearchGate](https://www.researchgate.net/publication/322887094_M3_Gesture_Menu_Design_and_Experimental_Analyses_of_Marking_Menus_for_Touchscreen_Mobile_Interaction)). Touch, but grid-based gesture shapes, not directional marks; no data link found.

GitHub search for `marking menu` returns implementations (Maya, GNOME Fly-Pie, this library) and student assignments, not study data ([search: "marking menu"](https://github.com/search?q=marking+menu&type=repositories)). A code search for `"marking menu"` in CSV files returned only paper-metadata tables.

## $-family gesture logs

The ACE Lab page lists XML gesture logs for $1 (unistroke) and $N, $P, $P+ and $Q (multistroke), all under the New BSD License ([$-family index](https://depts.washington.edu/acelab/proj/dollar/index.html), [$P](https://depts.washington.edu/acelab/proj/dollar/pdollar.html); search result).

### $1 unistroke logs

- **Source**: Wobbrock, Wilson & Li, UIST '07 ([PDF](https://faculty.washington.edu/wobbrock/pubs/uist-07.01.pdf)). Download from the [$1 page](https://depts.washington.edu/acelab/proj/dollar/index.html); New BSD (search result).
- **Device**: stylus on a Pocket PC ([PDF](https://faculty.washington.edu/wobbrock/pubs/uist-07.01.pdf), search result).
- **Participants and size**: 16 gesture types drawn at three speeds (search result); 10 participants and 4,800 strokes per the paper (not opened). The mirrored logs are laid out as `s<subject>/<speed>/<name><nn>.xml`.
- **Format** (verified on a [GitHub mirror](https://raw.githubusercontent.com/Namita-Namita/HCIRA_Project1_Part3/master/xml_logs/s05/slow/v02.xml)): one XML file per stroke; `<Gesture Name Subject Speed Number NumPts Millseconds …>` then `<Point X Y T>` with millisecond timestamps.
- **Marks**: `caret`, `v`, `check` and `zig-zag` are straight multi-segment strokes; the others (circle, star, braces, pigtail…) are not marks. The angles aren't fixed by a menu, so there is no breadth, no item angles, and the intended direction of each segment is only implied by the gesture name.
- **Novice pauses**: none; participants drew known symbols with no menu.
- **Verdict**: supplement, weakly. Useful only to sanity-check that the recognizer doesn't misread human corners (e.g. the `caret` apex) as extra segments. Wrong input type (stylus) for a touch-only benchmark.

### $N Mixed Multistroke Gestures (MMG)

- **Source**: Anthony & Wobbrock, GI '10 and GI '12 ([$N-Protractor PDF](https://lisa-anthony.com/wp-content/uploads/2012/04/anthony-and-wobbrock-gi2012.pdf)). 16 symbols of 1–3 strokes, 20 participants, stylus **or finger** on a Tablet PC, three speeds (search result).
- **Format** (verified on a [GitHub copy](https://raw.githubusercontent.com/tracyhammond/coursesketch/master/mmg_example.xml)): `<Gesture Name Subject InputType Speed NumPts>` with `<Stroke index>` elements of `<Point X Y T Pressure>`. `InputType` distinguishes stylus and finger.
- **Verdict**: supplement, weakly. The finger subset is the only touch data among the $-family logs checked, but the symbols (arrowhead, asterisk, letters…) are not menu marks and several are multi-stroke, which this library never receives.

### $P+ low-vision touch gestures

Vatavu, Gheran & Schipor, CHI '17 ([ACM](https://dl.acm.org/doi/10.1145/3025453.3025941), [PDF](https://mintviz.usv.ro/publications/CHI2017_1.pdf)): touch gestures by people with and without low vision, released with $P+ (search result). Same shape vocabulary problem; unusable for layout-specific testing.

## Touch strokes from other tasks

### How We Swipe (shape-writing)

- **Source**: Leiva, Kim, Cui, Bi & Oulasvirta, MobileHCI '21 ([ACM](https://dl.acm.org/doi/10.1145/3447526.3472059), [preprint](https://orbilu.uni.lu/bitstream/10993/47546/1/main.pdf)). Data on [OSF: How-We-Swipe Shape-writing Dataset](https://osf.io/sj67f/) (search result; not opened, so the licence is unconfirmed). Collection app: [luileito/swipetest](https://github.com/luileito/swipetest) (README read; it describes the app and logging, not the data licence).
- **Device and size**: web keyboard on participants' own touch devices; 1,338 users, 11,318 unique English words; trajectory-level data with timestamps and the keyboard layout (search result).
- **Why not a replacement**: a swipe passes through key centres on a grid; it is not a sequence of straight marks at menu angles, and its "target" is a word, not one item per level.
- **Verdict**: supplement, optional. It is the only large public touch corpus found with timestamps, many users, and ground truth. It could calibrate generic touch noise (jitter, sampling rate, corner rounding at turns) for the generated-stroke corpus, but not the gap limit.

### Touchalytics and touch biometrics

[Touchalytics](http://www.mariofrank.net/touchalytics/) (Frank et al., IEEE TIFS 2013): raw touch CSV (time, x, y, pressure, area) from 41 users scrolling on Android phones (search result). Similar corpora exist, such as [BB-MAS](https://arxiv.org/pdf/1912.02736). Single, mostly vertical or horizontal swipes with no intended target: unusable.

## Already in this repository

`src/recognizer/__tests__/__fixtures__/strokes/` holds 13 recorded strokes (CSV: `type,x,y,timeStamp,device`), named by their segment angles, all multiples of 45°, recorded with a mouse (checked on `origin/main`, commit `a06da94`). They cover breadth 8 only, so they don't help decide the 12-item limit either.

## What a replacement would have needed

None of the datasets found has all of:

1. Touch input, single finger, one continuous stroke.
2. Menu layout per stroke: breadth and item angles per level, depth.
3. The intended item at each level.
4. Breadth 12 or more at depth 2 or more.
5. Timestamps, so novice pauses and the recognizer's timing rules can be replayed.

That list is also the minimum schema for the new corpus in #521.
