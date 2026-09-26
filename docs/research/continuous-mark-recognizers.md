# Recognizers for continuous multi-level marks (issue #520)

Research for [#520](https://github.com/QuentinRoy/Marking-Menu/issues/520), part of the map [#518](https://github.com/QuentinRoy/Marking-Menu/issues/518). Vocabulary (level, breadth, depth, gap, stroke, mark) follows [`CONTEXT.md`](../../CONTEXT.md).

## Question

Which published or practical methods recognize one continuous stroke of straight marks across several levels, and which could resolve 12 or more items per level on touch?

## Short answer

- **No published study evaluates a recognizer, other than Kurtenbach's articulation-point method, on continuous compound marks.** Every breadth and depth limit in the literature combines human error with that recognizer's error. No study measures breadth 12 compound marks on touch. The maintainer's corpus will be the only direct evidence.
- **The human limit, not the recognizer, probably caps depth 2 at breadth 12.** Pen users drawing 12 × 12 menus as *separate* strokes, which removes segmentation entirely, reached only about 79% accuracy. At breadth 12 and depth 1 they reached about 95% ([Zhao, Agrawala & Hinckley 2006](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Zone-Polygon-Menus-CHI-2006.pdf), Fig. 6). A better recognizer can win back segmentation errors but not angle errors, so a depth-dependent gap rule is what the evidence predicts.
- **Worth prototyping, ranked:**
  1. **Model-constrained segmentation.** A dynamic program picks the cut points and the path through the menu tree together, scoring each segment against the menu's actual item angles. It needs no corner threshold and no training data. Its best-to-second-best margin can turn likely wrong selections into no selection.
  2. **The current articulation-point recognizer, re-tuned.** It is the baseline that every other candidate must beat, and its threshold can be made per level.
  3. **Template matching against synthetic per-leaf templates** (in the style of $1 or Protractor, with rotation and non-uniform scaling disabled). It is cheap and a useful second baseline, but it handles uneven segment lengths poorly.
  4. **Generic corner finders** (ShortStraw, speed minima) feeding the existing walk. Only worth trying if the benchmark shows that missed or spurious corners, rather than angles, cause most errors.
- **Not recommended:** trained classifiers (Rubine, trained DTW, HMMs, neural networks). The number of classes is the number of leaves (breadth^depth), and a one-participant corpus cannot train them.

## How to read the sources

Egress from this environment blocked most publisher and university hosts, including billbuxton.com, dl.acm.org and the Autodesk copy of Kurtenbach's thesis. The table at the end marks each source **full text** (read here) or **excerpt** (abstract or search-engine excerpts only). Claims resting on excerpts are marked "(excerpt)" where they appear.

## What the human-performance studies show

| Study | Device | Menu | Accuracy | Notes |
| --- | --- | --- | --- | --- |
| Kurtenbach, Sellen & Buxton ([1993](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/08/marking-menus-93.pdf)) | Wacom stylus, mouse, trackball | Single level, 4–12 items, hidden menu with ink trail | 9.4% mean error across sizes (Table 1) | 12 items was significantly *more* accurate than 11; subjects cited the clock face. Stylus and mouse did not differ; trackball was worse. |
| Kurtenbach & Buxton ([1993](https://dl.acm.org/doi/10.1145/169059.169426)) (excerpt) | not verified | Compound marks, breadth 4, 8, 12, depth 1–4 | Under 10% error holds for breadth 4 up to depth 4 and breadth 8 up to depth 2 | Errors come mostly from off-axis items ([abstract](https://www.billbuxton.com/MMExpert.html), excerpt). Zhao et al. restate the breadth 8, depth 2 limit ([2006](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Zone-Polygon-Menus-CHI-2006.pdf), p. 1077). |
| Zhao, Agrawala & Hinckley ([2006](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Zone-Polygon-Menus-CHI-2006.pdf)) | Tablet PC stylus | Orientation multi-stroke, 12 and 12 × 12 | Mean 87.1% over both; about 95% at 12 and about 79% at 12 × 12, read from Fig. 6 | Separate strokes, so there is no segmentation step. Pilots at breadth 16 were too slow and inaccurate to test (p. 1081). They summarize earlier work as "at depth-1 users can draw 12 orientations with acceptable accuracy, but at depth-2 users can only draw the 8 basic compass directions accurately" (p. 1080). |
| Zhao & Balakrishnan ([2004](https://dl.acm.org/doi/10.1145/1029632.1029639)) (excerpt) | Pen | Simple (multi-stroke) against compound marks, breadth up to 8 | Multi-stroke 8 × 8 × 8 at 93% | Figure as restated by [Zhao et al. 2006](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Zone-Polygon-Menus-CHI-2006.pdf), p. 1077. |
| Bragdon, Nelson, Li & Hinckley ([2011](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Mobile-Touch-Gestures-CHI-2011.pdf)) | Phone touchscreen | 12 marks of one or two axis-aligned segments | 92.5% (bezel-initiated) and 93.5% (hard button), mode errors included | The recognizer used only the start point, end point and bounding box. Free-form paths with Android's template recognizer scored 81–84%. |
| Zheng, Bi, Li, Li & Zhai ([2018](https://research.google/pubs/m3-gesture-menu-design-and-experimental-analyses-of-marking-menus-for-touchscreen-mobile-interaction/)) (excerpt) | Phone touchscreen | M3: grid layout, shape-matched marks | "faster and less error-prone by a factor of two than traditional marking menus" | Changes the mark, so it is out of scope. It shows that shape matching beats direction matching on touch. |

Touch specifics: finger strokes are larger and faster than pen strokes and differ in corner shape, while articulation time and indicative angle are similar ([Tu, Ren & Zhai 2012](https://research.google/pubs/pub38083/), excerpt). Stroke length varied by up to a factor of two between subjects ([Kurtenbach et al. 1993](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/08/marking-menus-93.pdf), p. 22).

## A geometric ambiguity no recognizer removes

When two consecutive levels use the same direction, the mark is straight: "the S-S mark in a two-level menu cannot be distinguished from the S mark in a one-level menu, and the S-S-N mark in a three-level menu cannot be distinguished from the S-N-N mark" ([Zhao & Balakrishnan 2004](https://dl.acm.org/doi/10.1145/1029632.1029639), excerpt). Any recognizer resolves these cases only through a length convention. The current one halves the longest segment ([`divideLongestSegment`](../../src/recognizer/recognize-mm-stroke.ts)). At breadth 12, adjacent directions differ by 30°, so near-collinear turns become common and harder to tell from wobble.

## Candidates

### A. Articulation points and a walk (Kurtenbach; the current recognizer)

**Segmentation.** Kurtenbach's patent ([US 5,689,667](https://patentimages.storage.googleapis.com/8f/9b/ba/6020c2b318e785/US5689667.pdf), appendix; full text) gives the original algorithm:

- Pauses of at least half a second are articulation points. More pauses than the menu's depth makes the mark a scribble, with no selection.
- Otherwise it takes direction changes greater than 22.5°, "1/2 of 45 degrees which is the angular differences between adjacent wedges", and uses the first (maximum depth − 1) of them.
- A single-level menu uses only the start and end points.

**Classification.** Each segment picks the nearest wedge at its level.

**In this library.** The corner threshold is the smallest gap anywhere in the model, divided by 2 and by a 0.75 sensitivity: 20° for 30° gaps ([`cutStroke`](../../src/recognizer/recognize-mm-stroke.ts)). The corner search window is 0.3 × stroke length ÷ max depth ([`articulation-points.ts`](../../src/recognizer/articulation-points.ts)), which assumes segments of roughly equal length. Short segments are dropped. If the walk ends on a non-leaf, the longest segment is halved and the walk retried. The threshold is global, so a 12-item root forces 20° on every level below it.

**Reported accuracy.** Only through the human studies above. The repository's generated corpus measures 90.4% at 8 items and 61.2% at 9 items for one level ([`generated-stroke-corpus.test.ts`](../../src/recognizer/__tests__/generated-stroke-corpus.test.ts)), but that is synthetic wobble tuned against this same recognizer.

**Training data.** None.

**Failure modes.**
- A spurious corner (wobble past the threshold) adds a segment. The walk then either passes the leaf (no selection) or lands on the wrong child (wrong selection).
- A missed corner (a real turn under the threshold, such as a 30° turn drawn shallow) merges two segments. Halving then produces a collinear path, which is a **wrong selection**.
- Nothing reports confidence, so a wrong selection is never downgraded to no selection.

**Complexity.** Already implemented. Cheap variants: a per-level threshold computed from each level's own gap, a threshold from measured touch wobble, and weighing the pause.

### B. Generic corner finders feeding the same walk

- **ShortStraw** ([Wolin, Eoff & Hammond 2008](https://diglib.eg.org/items/9fc7bbef-5b6f-430e-b586-2a00883a362f), excerpt) resamples the stroke, measures the "straw" (the chord across a small window) at each point, and keeps local minima well below the median as corners. Its authors report all-or-nothing corner accuracy "more than twice that of the current best benchmark" on polylines. It is evaluated on sketched shapes, not menu marks.
- **Speed and curvature** ([Sezgin, Stahovich & Davis 2001](https://www.semanticscholar.org/paper/Sketch-based-interfaces:-early-processing-for-Sezgin-Stahovich/0afd88db86946b4b13304c14375ec0c48e262c03), excerpt) combine curvature maxima with pen-speed minima. Timestamps would help at shallow turns, where curvature alone is weak.

**Training data.** None, but each has thresholds to tune.

**Failure modes.** The same as A. They know nothing of the menu, so they still decide "corner or not" before the menu can say which cut makes a valid path.

**Complexity.** Low: roughly 100 lines each, reusing `walkModel`. Speed-based cuts need timestamps in the recognizer input, which today receives only points.

### C. Model-constrained segmentation (recommended first)

**Idea.** Choose the cut points and the menu path together, so the menu's own angles decide which bends are corners. This is the classic dynamic program for fitting a curve with line segments ([Bellman 1961](https://dl.acm.org/doi/10.1145/366573.366611)), with the tree as a constraint: each segment must point near a child of the node reached so far.

**Sketch.**
- Resample the stroke to n points, as $1 does with n = 64 ([Wobbrock, Wilson & Li 2007](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/10/uist-07.1.pdf), p. 3).
- `best(node, i)` is the lowest cost of reaching `node` with the stroke cut at point i. From there, each child c and later point j add `cost(i, j, c.angle)`: angle error of the chord, plus deviation of the points from the chord, plus a penalty for very short or very uneven segments.
- The answer is the lowest-cost leaf at j = n, or the lowest-cost menu when recognizing a prefix at dwell.
- Cost: about nodes × n² / 2 segment evaluations. For 12 + 144 nodes and n = 64 that is about 320,000 constant-time evaluations with prefix sums. Pruning children far from the chord's angle cuts this sharply.
- A cheaper variant runs the same program over candidate corners that a low-threshold finder (A or B) over-generates, with n under about 10.

**Why it fits 12 items.** It needs no global threshold to separate a 30° turn from a 20° wobble. A turn counts only if cutting there yields a better-fitting valid path. The same-direction ambiguity becomes an explicit length prior instead of a halving heuristic.

**Failure mode.** Every stroke gets a best path, so an explicit rejection rule is needed. Rejecting when the best path's cost is not clearly below the second best (or above a noise bound) converts likely wrong selections into no selection. That margin is also what a confidence-aware input framework expects ([Schwarz, Hudson, Mankoff & Wilson 2010](https://www.microsoft.com/en-us/research/publication/framework-robust-flexible-handling-inputs-uncertainty/), excerpt).

**Evidence.** No published evaluation on marking menus: this is a synthesis. The closest precedent is word-gesture keyboards, which match a continuous stroke against ideal polylines generated from a layout for a 10,000–20,000 word vocabulary ([Kristensson & Zhai 2004](https://dl.acm.org/doi/10.1145/1029632.1029640), excerpt). M3's gains from shape matching on touch point the same way ([Zheng et al. 2018](https://research.google/pubs/m3-gesture-menu-design-and-experimental-analyses-of-marking-menus-for-touchscreen-mobile-interaction/), excerpt).

**Training data.** None to run. The corpus can fit one or two noise parameters, such as angular spread per depth, which turn costs into likelihoods and give the gap rule a predictive model.

**Complexity.** Moderate: roughly 200–300 lines. It produces the same outputs the engine needs today: the cut points as articulation points for `StrokeCut`, the segments, and leaf or menu outcomes.

### D. Template matching against synthetic per-leaf templates

**Idea.** Generate one ideal polyline per leaf path, with equal-length segments at the item angles, and pick the nearest template after resampling. $1 reached 97% accuracy with one template and 99% with three or more on 16 gesture types (10 subjects, Pocket PC stylus), similar to DTW and better than Rubine's 7.17% error ([Wobbrock et al. 2007](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/10/uist-07.1.pdf), pp. 1, 7).

**Needed changes.** Out of the box, $1 is rotation-invariant and scales to a square. It "cannot distinguish gestures whose identities depend on specific orientations, aspect ratios", and lines "are abused by non-uniform scaling". The authors suggest skipping the rotation and scaling uniformly (p. 5). Protractor has an orientation-sensitive mode, but it aligns to the nearest of eight orientations ([Li 2010](https://research.google/pubs/pub36269/), excerpt), which is too coarse for 30° gaps.

**Failure modes.** A nearest template always exists, so it too needs a distance or margin cutoff. Uneven segment lengths shift every resampled point and inflate distances for correct paths. That leads to wrong selections unless several length ratios per leaf are generated. At that point, elastic matching against the ideal polyline is candidate C.

**Training data.** None, since templates come from the model.

**Complexity.** Low: about 100 lines. Breadth 12 at depth 3 gives 1,728 templates, which is fine at release but wasteful during a drag.

### E. Trained classifiers

Rubine's linear classifier uses 13 features ([Rubine 1991](https://history.siggraph.org/learning/specifying-gestures-by-example-by-rubine/), excerpt) and needs several examples per class; it cannot train on one ([Wobbrock et al. 2007](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/10/uist-07.1.pdf), p. 7). The same holds for HMMs and neural networks, which "must be trained with numerous examples" (ibid., p. 2). With one class per leaf, 12 × 12 means 144 classes, so one informal participant cannot supply the data. **Not recommended.**

## Out of scope, for comparison

- **Multi-stroke (simple) marks** avoid segmentation. They still reached only about 79% at 12 × 12 on pen ([Zhao et al. 2006](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Zone-Polygon-Menus-CHI-2006.pdf), Fig. 6).
- **Zone and Polygon menus** reached 97.7% and 98.2% over the breadth 12 conditions, and Zone reached 96% at breadth 32 (ibid., pp. 1082–1083). Both add position to orientation.
- **Flower menus** add curved marks to the eight directions to increase breadth ([Bailly, Lecolinet & Nigay 2008](https://www.researchgate.net/publication/220944937_Flower_menus_A_new_type_of_Marking_menu_with_large_menu_breadth_within_groups_and_efficient_expert_mode_memorization), excerpt).
- **M3** replaces directions with shapes on a grid ([Zheng et al. 2018](https://research.google/pubs/m3-gesture-menu-design-and-experimental-analyses-of-marking-menus-for-touchscreen-mobile-interaction/), excerpt).

## Facts later tickets depend on

- **Gap rule.** The literature predicts that 30° works at depth 1 but not at depth 2 or deeper, even with perfect segmentation (see the multi-stroke 12 × 12 figure). A depth-dependent minimum gap matches that. The benchmark should confirm it on touch rather than assume it.
- **Corpus content.** Record timestamps (for pauses and speed-based cuts) and the intended leaf path. Cover all 12 directions, collinear turns (0°) and adjacent turns (±30°), since those are the hard cases for every candidate.
- **Benchmark metrics.** Report wrong selections and no selections separately, and per depth. Candidates C and D trade one for the other through a margin cutoff, so the reliability bar must say whether a no selection is less bad than a wrong one.
- **Hybrid use.** A novice dwell recognizes the stroke so far as a *menu* ([`machine.ts`](../../src/engine/machine.ts), `'expert -dwell> recognizing'`), and release recognizes a *leaf*. Kurtenbach instead treated half-second pauses as articulation points. Any new recognizer must support both leaf and menu outcomes on a partial stroke, and return cut points for `StrokeCut`.
- **Input.** The recognizer receives points only. Speed-based candidates need the engine to pass timestamps.

## Sources

| Source | Access |
| --- | --- |
| Kurtenbach, G. [US Patent 5,689,667](https://patentimages.storage.googleapis.com/8f/9b/ba/6020c2b318e785/US5689667.pdf), *Methods and system of controlling menus with radial and linear portions*, 1997 (appendix pseudocode) | full text |
| Kurtenbach, Sellen & Buxton, [Some articulatory and cognitive aspects of marking menus](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/08/marking-menus-93.pdf), HCI 8(1), 1993 | full text |
| Kurtenbach & Buxton, [The limits of expert performance using hierarchic marking menus](https://dl.acm.org/doi/10.1145/169059.169426), INTERCHI 1993 ([author copy](https://www.billbuxton.com/MMExpert.pdf), blocked here) | excerpt |
| Kurtenbach, [The design and evaluation of marking menus](https://www.research.autodesk.com/app/uploads/2023/03/the-design-and-evaluation.pdf_recHpUp1v9dc1n2CJ.pdf), PhD thesis, 1993 | blocked; not read |
| Zhao & Balakrishnan, [Simple vs. compound mark hierarchical marking menus](https://dl.acm.org/doi/10.1145/1029632.1029639), UIST 2004 | excerpt |
| Zhao, Agrawala & Hinckley, [Zone and Polygon menus](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Zone-Polygon-Menus-CHI-2006.pdf), CHI 2006 | full text |
| Bragdon, Nelson, Li & Hinckley, [Experimental analysis of touch-screen gesture designs in mobile environments](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Mobile-Touch-Gestures-CHI-2011.pdf), CHI 2011 | full text |
| Zheng, Bi, Li, Li & Zhai, [M3 Gesture Menu](https://research.google/pubs/m3-gesture-menu-design-and-experimental-analyses-of-marking-menus-for-touchscreen-mobile-interaction/), CHI 2018 | excerpt |
| Tu, Ren & Zhai, [A comparative evaluation of finger and pen stroke gestures](https://research.google/pubs/pub38083/), CHI 2012 | excerpt |
| Wobbrock, Wilson & Li, [Gestures without libraries, toolkits or training: a $1 recognizer](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/10/uist-07.1.pdf), UIST 2007 | full text |
| Li, [Protractor](https://research.google/pubs/pub36269/), CHI 2010 | excerpt |
| Wolin, Eoff & Hammond, [ShortStraw](https://diglib.eg.org/items/9fc7bbef-5b6f-430e-b586-2a00883a362f), SBIM 2008 | excerpt |
| Sezgin, Stahovich & Davis, [Sketch based interfaces: early processing for sketch understanding](https://www.semanticscholar.org/paper/Sketch-based-interfaces:-early-processing-for-Sezgin-Stahovich/0afd88db86946b4b13304c14375ec0c48e262c03), PUI 2001 | excerpt |
| Bellman, [On the approximation of curves by line segments using dynamic programming](https://dl.acm.org/doi/10.1145/366573.366611), CACM 4(6), 1961 | excerpt |
| Kristensson & Zhai, [SHARK2](https://dl.acm.org/doi/10.1145/1029632.1029640), UIST 2004 | excerpt |
| Schwarz, Hudson, Mankoff & Wilson, [A framework for robust and flexible handling of inputs with uncertainty](https://www.microsoft.com/en-us/research/publication/framework-robust-flexible-handling-inputs-uncertainty/), UIST 2010 | excerpt |
| Rubine, [Specifying gestures by example](https://history.siggraph.org/learning/specifying-gestures-by-example-by-rubine/), SIGGRAPH 1991 | excerpt |
| Bailly, Lecolinet & Nigay, [Flower menus](https://www.researchgate.net/publication/220944937_Flower_menus_A_new_type_of_Marking_menu_with_large_menu_breadth_within_groups_and_efficient_expert_mode_memorization), AVI 2008 | excerpt |
