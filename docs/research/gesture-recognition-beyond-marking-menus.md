# Gesture recognition methods beyond marking menus (issue #528)

Research for [#528](https://github.com/QuentinRoy/Marking-Menu/issues/528), part of the map [#518](https://github.com/QuentinRoy/Marking-Menu/issues/518). It follows the marking-menu survey of [#520](https://github.com/QuentinRoy/Marking-Menu/issues/520) ([findings](https://github.com/QuentinRoy/Marking-Menu/blob/research/continuous-mark-recognizers/docs/research/continuous-mark-recognizers.md)) and does not repeat it. Vocabulary (level, breadth, depth, gap, stroke, mark, wrong selection, no selection, floor) follows the project glossary, `CONTEXT.md`.

## Question

Beyond the marking-menu literature, which gesture and sketch recognition methods fit continuous straight-segment marks on touch, recognized against a known menu tree with no per-user training?

Constraints from the ticket:

1. **Partial strokes.** Return a menu outcome for the stroke so far (novice dwell).
2. **Cut points.** Return the articulation points and segments for `StrokeCut`.
3. **Rejection.** Turn ambiguous strokes into no selection; a wrong selection is worse.
4. **Runtime.** About 16 ms per recognition.

## Short answer

Ranked shortlist to prototype against the touch corpus:

| Rank | Method | Fixes | Origin |
| --- | --- | --- | --- |
| 1 | **Tree-constrained segmental decoding** with probabilistic scores and a posterior cutoff | both | Level-building DTW for connected words (speech), template fragmentation by dynamic programming (sketch), Gaussian channel scores (SHARK²) |
| 2 | **Hook trimming and least-squares segment angles** | direction | Sketch beautification (PaleoSketch), corner-finder line tests (ShortStraw) |
| 3 | **Over-generated candidate corners** (curvature maxima, straws, speed minima) as the cut positions rank 1 may choose from | segmentation (and runtime) | Corner finding (ShortStraw, iStraw, SpeedSeg, ClassySeg's candidate set) |
| 4 | **Incremental template recognition** against synthetic leaf templates, with turning-angle distance and an end-point bias | both, weakly | Kristensson & Denby 2011 |

Supporting technique, not a recognizer: **set the rejection cutoff on synthetic negatives and positives** (Jackknife), then check it on the tuning sessions.

Not recommended: trained segmenters and decoders (ClassySeg, neural gesture-keyboard decoders), point-cloud matchers ($P), and the SHARK² location channel and language model.

The key point: speech recognition solved "cut a continuous signal into a sequence of known units, constrained by a grammar" in 1981 with dynamic programming, and sketch recognition reused the same idea for "fit this stroke to an ordered template of lines" in 2004. A menu tree is such a grammar. Neither field evaluated it on marking menus, so the benchmark on the touch corpus is the only evidence that will count.

## How to read the sources

The table at the end marks each source **full text** (read here) or **excerpt** (abstract, search excerpt, or a restatement by another paper). Claims resting on an excerpt say so.

## 1. Tree-constrained segmental decoding (recommended first)

This is candidate C of the #520 survey, now with its closest precedents found and read, and with the rejection and partial-stroke parts specified.

### Precedents

- **Level-building DTW** (Myers & Rabiner 1981, full text). Aligns a test signal to the best sequence of reference words, choosing word boundaries and word identities together, one "level" per word. The paper includes syntax constraints given as a finite state machine *with no loops*, which is what a menu tree is: each level's allowed units are the children of the node reached. Ney (1984, excerpt) gives a one-pass variant whose cost per word does not depend on the number of words in the string.
- **Template fragmentation by dynamic programming** (Hse, Shilman & Newton 2004, full text). Given a stroke and an ordered template of primitives (for example `LLLL` for a square), a DP finds the breakpoints with minimum fit error. It is "free of empirical thresholds". They cite Bellman (1961) and Perez for DP line fitting with a given number of segments. On their test symbols it reached 100% fragmentation accuracy for line-only symbols. Their DP knows the primitive *types* but not their *directions*; a menu tree adds the directions, which constrains the fit further.
- **Probabilistic scoring without training data** (Kristensson & Zhai 2004, SHARK², full text). The distance to the intended template is modeled as a zero-mean Gaussian, and σ is set by hand when no training corpus exists. Candidates beyond 2σ are pruned, the rest are normalized into a posterior and combined by Bayes' rule, giving a ranked, confidence-scored N-best list. Their templates are ideal polylines generated from the keyboard layout, the same way a menu tree generates ideal marks.

### Sketch for this library

- Resample the stroke (or use rank 3's candidate corners as the only allowed cut positions).
- State: `(node, i)`, the menu node reached with the stroke cut at point `i`.
- Transition: for each child `c` of `node` and each later cut `j`, add `cost(i, j, c.angle)`:
  - angle error between the least-squares line of points `i..j` and `c.angle`, scaled by a σ per depth;
  - residual of the points around that line (straightness);
  - a length prior, for very short segments and for the same-direction ambiguity (S-S versus S), replacing `divideLongestSegment`.
- Decoding:
  - **Leaf at release:** the best leaf state at the last point.
  - **Menu at dwell (constraint 1):** the best menu state at the last point. The dwell means the user finished a segment and waits for the next level, so the stroke ends on a cut, which the same table already holds.
  - **Cut points (constraint 2):** backtracking the best path gives the cut indices, hence `articulationPoints` and `segments`.
- **Rejection (constraint 3):** run the same DP with log-sum-exp instead of min (the forward algorithm) to get the total likelihood over all paths. The best path's posterior is its likelihood over that total. Reject when the posterior is below a cutoff, or when the best-to-second-best margin is small. This is SHARK²'s normalization, applied to paths instead of words.

### Runtime (constraint 4)

Estimate, not measured. Breadth 12 at depth 3 has 1,884 non-root nodes. Resampled to 32 points there are 496 cut pairs, so about 930,000 segment scores for the full DP, each constant-time once line fits per `(i, j)` are precomputed (they do not depend on the node). Two cuts reduce this by orders of magnitude:

- keep only children within about two gaps of each segment's angle (SHARK²'s 2σ pruning), so 3–5 children instead of 12;
- allow cuts only at rank 3's candidates (about 10 positions), so 55 pairs instead of 496.

Either one should put breadth 12, depth 3 well under 16 ms in JavaScript. The prototype must measure it.

### What it fixes

- **Segmentation.** No global corner threshold: a 30° bend becomes a cut only if the resulting path fits better. This targets both failure modes of the current recognizer, missed shallow corners (merged segments, then halving) and spurious corners from wobble.
- **Direction.** Cut positions are chosen to fit the menu angles, and each segment's angle comes from a line fit over all its points instead of the chord between two articulation points, so a misplaced corner no longer tilts both neighboring segments. It cannot fix a segment the user actually drew at the wrong angle; the #520 survey shows those errors dominate at depth 2 and breadth 12 even without segmentation.

### Parameters

σ per depth, the straightness weight, the length prior, and the rejection cutoff. None needs per-user training; all can be fit on the corpus tuning sessions.

## 2. Hook trimming and least-squares segment angles

- **Hooks.** Stroke ends often carry short "tails" that hurt recognition. PaleoSketch (Paulson & Hammond 2008, full text) finds the highest-curvature point in the first and last 20% of the stroke and cuts the tail there when the curvature is above a threshold, skipping short strokes. Herold & Stahovich (2011, full text) also note that stroke ends need special handling because of hooks. On touch, a finger landing or lifting while moving is a likely source.
- **Segment angle from a line fit.** PaleoSketch's line test fits a least-squares line to the stroke; ShortStraw's line test compares chord length with path length (threshold 0.95) (Wolin, Eoff & Hammond 2008, full text). Today the library takes each segment's angle from the chord between articulation points, so any error in corner placement or a hook at either end changes the angle directly.

**Fixes:** direction errors. **Constraints:** it only changes how segments are measured, so partial strokes and `StrokeCut` are unaffected; cost is linear in points. It adds no rejection. It plugs into the current recognizer as a cheap first experiment and into rank 1 as its segment score.

## 3. Over-generated candidate corners

The corner-finding literature is useful here less as a corner *decider* (candidate B in #520) than as a *candidate generator* for rank 1.

- **Curvature maxima as candidates.** In ClassySeg's pen dataset, only 0.20% of true segment points were not curvature maxima; 19.91% of maxima were true segment points (Herold & Stahovich 2011, full text). Taking every candidate as a corner gave 99.8% recall but 0% all-or-nothing accuracy, so the candidates are complete but must be chosen among. Rank 1 does that choosing with the menu as the judge.
- **ShortStraw** (full text). Resample to an interspacing of the bounding-box diagonal / 40, compute the "straw" (chord across ±3 points), take local minima below 0.95 × median straw, then add corners where a segment fails the line test and remove the middle of collinear triples. On 244 polylines from 6 users it reached 0.741 all-or-nothing accuracy against 0.278 (Sezgin) and 0.297 (Kim and Kim). It runs in O(n) apart from the median, with an O(n²) worst case. Its test shapes had right, obtuse and acute angles; 30° turns (150° interior angles) are shallower than most, so its threshold is a candidate cutoff to loosen, not to trust.
- **iStraw** (Xiong & LaViola 2010, excerpt; described by Herold & Stahovich 2011) adds timing and curvature information to ShortStraw. On the ClassySeg dataset: ShortStraw-style SSD 27.8%, iStraw 69.9%, SpeedSeg 78.2% (88.6% user-tuned) all-or-nothing accuracy (Herold & Stahovich 2011, Table 1, full text).
- **Speed.** SpeedSeg places candidates at speed minima and at curvature maxima where speed is low (Herold & Stahovich 2011; SpeedSeg paper, excerpt). Speed minima should mark deliberate turns at shallow angles, where curvature alone is weak. This needs timestamps in the recognizer input, which today takes points only.

**Fixes:** segmentation, by feeding rank 1 a small, near-complete set of cut positions; and runtime. **Constraints:** cheap, returns positions only. Alone, feeding the current walk, it keeps the threshold problem #520 described.

## 4. Incremental template recognition with an end-point bias

Kristensson & Denby (2011, full text; authors' Java source) recognize a partial stroke against a template set:

- Each template is stored as progressively longer prefixes. The likelihood of a partial input is its best match over a template's prefixes, times an end-point bias term that favors templates the input matches *completely*, so a stroke that fully matches a short template is not read as the prefix of a longer one.
- Distances combine mean Euclidean distance and mean turning angle between corresponding segments against a fixed axis, each treated as Gaussian. Turning angle alone beat Euclidean distance (94.0% against 91.9% on complete strokes); combining both gave 94.3%. With the end-point bias, incremental recognition matched the baseline on complete strokes (94.5%); without it, it dropped to 92.1%.
- Bayes' rule with a prior gives a posterior over templates at every new point; the paper smooths it with a five-sample moving average.
- Two parameters (κ and a variance) were tuned on 8 participants and tested on 8 others (pen, Tablet PC).

For a menu, templates would be synthetic leaf and menu polylines. A menu template's end-point bias is exactly the dwell case: the stroke fully matches a menu's path. The turning-angle feature is orientation-sensitive, unlike $1's default rotation invariance.

**Fixes:** both, weakly. It uses all points, not just corners, but it matches point i to point i, so the uneven segment lengths #520 raised for candidate D still distort it unless several length ratios per leaf are generated. **Constraints:** partial strokes natively; rejection from the posterior; no cut points, which must be inferred from which template prefix matched; runtime grows with templates × prefixes × points (about 1,884 templates at breadth 12, depth 3). Worth prototyping as an independent second opinion to rank 1, not as a replacement.

## Rejection threshold from synthetic data

Jackknife (Taranta et al. 2017; authors' README full text, paper excerpt) is a DTW recognizer for one or two samples per class. For continuous input it picks the rejection threshold that maximizes F1 on synthetic distributions: negatives spliced from pieces of templates, positives made by stochastic resampling of the gesture path. For a menu, spliced negatives are strokes that turn mid-segment or at the wrong place. The corpus tuning sessions should set the final cutoff against the reliability bar (at most 0.5% wrong selections); synthetic data only gives a starting point.

## Not recommended

- **Trained segmenters.** ClassySeg trains a classifier over candidate corners (Herold & Stahovich 2011). It needs labeled corners; a menu tree already says which cuts make sense.
- **Trained gesture-keyboard decoders** (neural and statistical). SHARK² itself notes that, for templates generated from a layout, "there is not a natural corpus" to train on (Kristensson & Zhai 2004, p. 45). The same holds per leaf here.
- **Point clouds ($P).** $P makes "stroke direction become irrelevant" (Vatavu, Anthony & Wobbrock 2012, full text). A mark's meaning is its direction: an N mark and an S mark are the same point cloud.
- **SHARK²'s location channel and language model.** Expert marks can start anywhere, so absolute position carries no item information; menus have no word-sequence model. An item-frequency prior, as Kristensson & Denby allow, is possible later but would bias toward frequent items at the cost of rare ones.
- **Plain elastic matching.** SHARK² found elasticity "undesirable" when templates are crowded and got fewer errors with a rigid, proportional matcher (p. 46). At breadth 12, leaf templates are crowded.

## What the prototypes should report

- Wrong selections and no selections separately, per depth and breadth, on accepted strokes, against the current recognizer as baseline.
- Error causes: missed cut, spurious cut, misplaced cut, or angle off by more than half a gap, so each method's gain can be attributed to segmentation or direction.
- Runtime at the worst supported menu (breadth 16, depth 3), measured in the browser.
- For ranks 1 and 4, the wrong-selection rate as a function of the rejection cutoff, since the floor depends on that trade-off.

## Sources

| Source | Access |
| --- | --- |
| Myers & Rabiner, [A level building dynamic time warping algorithm for connected word recognition](https://web.ece.ucsb.edu/Faculty/Rabiner/ece259/Reprints/180_level%20building.pdf), IEEE Trans. ASSP 29(2), 1981 | full text |
| Ney, [The use of a one-stage dynamic programming algorithm for connected word recognition](https://www.semanticscholar.org/paper/The-use-of-a-one-stage-dynamic-programming-for-word-Ney/1e4193d03eb3c5a695a3d8b3506f80704f9dfc19), IEEE Trans. ASSP 32(2), 1984 | excerpt |
| Hse, Shilman & Newton, [Robust sketched symbol fragmentation using templates](https://ptolemy.berkeley.edu/projects/embedded/research/hhreco/iui.pdf), IUI 2004 | full text |
| Kristensson & Zhai, [SHARK²: a large vocabulary shorthand writing system for pen-based computers](http://pokristensson.com/pubs/KristenssonZhaiUIST2004.pdf), UIST 2004 | full text |
| Kristensson & Denby, [Continuous recognition and visualization of pen strokes and touch-screen gestures](http://pokristensson.com/pubs/KristenssonDenbySBIM2011.pdf), SBIM 2011, and [source code](http://pokristensson.com/increc.html) | full text |
| Wolin, Eoff & Hammond, [ShortStraw: a simple and effective corner finder for polylines](http://www.cs.ucf.edu/courses/cap6105/readings/Wolin_Eoff_Hammond_SBIM08.pdf), SBIM 2008 | full text |
| Xiong & LaViola, [A ShortStraw-based algorithm for corner finding in sketch-based interfaces](https://www.sciencedirect.com/science/article/abs/pii/S0097849310001044), Computers & Graphics 34(5), 2010 | excerpt |
| Herold & Stahovich, [SpeedSeg: a technique for segmenting pen strokes using pen speed](https://www.sciencedirect.com/science/article/abs/pii/S0097849310001895), Computers & Graphics 35(2), 2011 | excerpt |
| Herold & Stahovich, [ClassySeg: a machine learning approach to automatic stroke segmentation](http://cs.ucf.edu/courses/cap6105/readings/p109-herold.pdf), SBIM 2011 | full text |
| Paulson & Hammond, [PaleoSketch: accurate primitive sketch recognition and beautification](http://www.cs.ucf.edu/courses/cap6105/fall2015/readings/paulson.pdf), IUI 2008 | full text |
| Taranta, Samiei, Maghoumi, Khaloo, Pittman & LaViola, [Jackknife: a reliable recognizer with few samples and many modalities](https://dl.acm.org/doi/10.1145/3025453.3026002), CHI 2017, and [authors' repository README](https://github.com/ISUE/Jackknife) | excerpt (paper); full text (README) |
| Vatavu, Anthony & Wobbrock, [Gestures as point clouds: a $P recognizer for user interface prototypes](https://faculty.washington.edu/wobbrock/pubs/icmi-12.pdf), ICMI 2012 | full text |
