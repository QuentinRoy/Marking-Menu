# Evidence and algorithms for marking-menu label layout

## Executive conclusion

A good marking-menu layout must make every label–item association unambiguous and prevent label and connector interference. Among valid layouts, compactness is the primary objective: every connector should reach its plate close to the gesture origin, because the solver controls placement but not the plate dimensions. Labels should also be well distributed around the available space, but never by weakening their association with their items. Distribution, small anchor displacement, and balanced connector lengths are measurable secondary diagnostics, but the literature does not establish their exact ordering for marking menus. They should be tested by comparing equally compact layouts rather than baked in as unsupported solver weights.

The production algorithm should be the smallest one that clears the hard constraints and produces a satisfactory layout. The focused blind review selected a shared-radius layout followed by deterministic greedy compaction. Greedy compaction clearly improved on shared radius, while adaptive candidate search did not clearly improve on greedy compaction. Keep adaptive search only as an offline quality reference. Global optimality inside a sampled candidate set has no value by itself.

Evidence is uneven. Marking-menu studies directly test directional organization and menu breadth, while external-label studies test association and visual structure in maps or illustrations. Applying the latter to marking menus is a design inference that should be validated in our renderer and, eventually, with users.

## Evidence

| Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Source                                                                                                                                                               | Confidence / relevance                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden marking-menu performance deteriorated as menu size grew, but easily reconstructed divisions mattered: 8 and especially clock-like 12 slices performed better than adjacent 7/11-slice conditions. Four hidden slices matched visible menus; five matched on errors but was slower.                                                                                                                                                                               | [Kurtenbach, Sellen & Buxton, 1993, author PDF](https://damassets.autodesk.net/content/dam/autodesk/research/publications-assets/pdf/an-empirical-evaluation-of.pdf) | **High, direct.** Controlled marking-menu study, but labels were ordered numbers rather than commands. Supports geometric regularity and familiar subdivision, not a blanket endorsement of 12-item menus.                                                                 |
| In hierarchical expert use, both breadth and depth increased time. Error stayed below 10% through breadth 8/depth 2 and breadth 4/depth 4; wider and deeper combinations became error-prone. Cardinal-axis choices were faster and more accurate than off-axis choices.                                                                                                                                                                                                 | [Kurtenbach & Buxton, 1993, author PDF](https://www.billbuxton.com/MMExpert.pdf)                                                                                     | **High, direct.** Expert-simulation task with deliberately memorable compass/clock labels. Supports keeping important directions stable and wide menus shallow.                                                                                                            |
| Orientation-only marking does not scale indefinitely: later work reports accuracy dropping beyond eight directions and gains capacity by adding position as a second signal, rather than by adding ever-narrower angular slices.                                                                                                                                                                                                                                        | [Zhao, Agrawala & Hinckley, 2006, author PDF](https://www.dgp.toronto.edu/~sszhao/paper/zonepoly.pdf)                                                                | **High, direct to gesture vocabulary; indirect to plate layout.** Warns against letting label packing legitimize overly dense angular menus.                                                                                                                               |
| The canonical boundary-labeling model treats disjoint labels, correct site-to-label connection, and no leader–leader/site/label intersections as legality conditions; it then optimizes leader length or bend count.                                                                                                                                                                                                                                                    | [Bekos et al., 2007, author PDF](https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/bksw-blmea-07.pdf)                                                       | **High for external labeling; inferred for marking menus.** Strong basis for hard collision/association constraints, but not empirical proof of their relative priority here.                                                                                              |
| A 31-person assignment study found two-bend OPO leaders slower and less accurate than simpler alternatives in dense/sparse cases. Regular one-bend leaders were subjectively preferred to visually unstructured straight-leader layouts, although straight leaders still performed well on the assignment task. The authors caution that minimum total leader length does not capture all relevant quality criteria.                                                    | [Barth et al., 2015, full paper](https://arxiv.org/pdf/1509.00379)                                                                                                   | **Medium–high.** Direct readability and preference evidence, but stimuli were one-sided boundary labels with 15/30 sites, not radial menus. Supports simple, traceable leaders and regular organization; it does **not** prove that bends improve marking-menu connectors. |
| Interviews with an atlas layout artist and two editors, plus analysis of 202 hand-made illustrations, emphasized non-overlap and a simple label contour. Uniform spacing, a staircase rule preventing consecutive labels from hiding behind each other, radial-order/leader-slope monotonicity, short leaders, and minimum separation were identified as quality criteria. Only 0.4% of observed labels violated the staircase property and 6.2% violated monotonicity. | [Niedermann, Nöllenburg & Rutter, 2017, full paper](https://arxiv.org/pdf/1702.01799)                                                                                | **Medium–high for professional external labeling.** Especially relevant because it studies labels arranged around a contour. Applying its spacing criteria to a marking menu remains an inference.                                                                         |

## Implications for our solver

### Hard constraints, in priority order

1. **Treat interaction geometry as fixed input.** Item angles, wedge boundaries, cyclic order, and the gesture-to-command mapping are not solver variables. This is an interface precondition rather than a quality metric. The [marking-menu learning](https://damassets.autodesk.net/content/dam/autodesk/research/publications-assets/pdf/an-empirical-evaluation-of.pdf) and [expert-performance](https://www.billbuxton.com/MMExpert.pdf) results explain why preserving that directional vocabulary matters.
2. **Guarantee unambiguous association.** Each connector starts on its own item direction and terminates exactly on its own plate. Every plate intersects its own connector, no plate intersects another item's connector, and cyclic plate order matches cyclic item order. These are binary tests. They adapt the legality and radial-order conditions in [boundary labeling](https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/bksw-blmea-07.pdf) and [radial contour labeling](https://arxiv.org/pdf/1702.01799).
3. **Eliminate geometric interference.** Plates do not overlap one another or the interaction ring, and connectors do not cross plates, other connectors, or protected wedge content. Check the configured positive clearances, not merely zero-area nonintersection. Non-overlap and nonintersection are standard legality conditions in [boundary-labeling models](https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/bksw-blmea-07.pdf); positive clearance is our stricter design inference.
4. **Respect the resolved label boxes.** The solver receives final measured dimensions and may not silently wrap, truncate, or resize labels. Fonts and styles must therefore be settled before the one-time solve; an application that changes labels or styling recreates the menu.
5. **Be deterministic.** Repeating the solve with identical inputs returns bit-for-bit equivalent geometry. This protects reproducibility and testability, not live animation.
6. **Fail explicitly.** If no configuration satisfies the model, report infeasibility or an oversized result rather than returning a partly repaired layout. Layout cannot compensate for excessive angular breadth or unbounded labels.

### Ranking criteria for valid layouts, in priority order

1. **Minimize connector-contact extent.** Let `c_i` be the point where item `i`'s straight connector first meets its own plate, and let `ρ_i` be that point's distance from the gesture origin. The layout's contact extent is `C = max_i ρ_i`: the smallest origin-centred circle that reaches every plate at the point that visually establishes the association. Minimize `C`. Unlike the distance to an arbitrary nearest plate corner, this cannot call a displaced plate “compact” merely because an irrelevant corner happens to be near the origin. This choice is our recommendation rather than a result established in the literature; compare it with nearest-edge extent in rendered tests.
2. **Minimize remaining association distance and visual spread.** Among layouts at the same minimum contact extent (or within a deliberately tiny presentation tolerance), minimize the mean contact radius, then total connector length. The maximum connector length is already equivalent to `C - ringRadius` when all connectors start on the interaction ring.
3. **Minimize departure from ideal direction-aware anchors.** Measure each plate's tangential displacement from its unsolved `clampS`/`softHigh` anchor. Compare the maximum first, then the sum. This is a design inference intended to keep visual placement congruent with the learned gesture.
4. **Distribute labels well without weakening association.** Once compactness and association displacement are fixed, maximize the smallest whitespace between cyclically adjacent plates, then minimize the variation in those gaps. Also report the angular gaps between neighbouring plate centres and the offset of the layout's visual centroid from the origin. These are measurable interpretations of "well distributed," not yet validated universal objectives.
5. **Use a canonical final tie-break.** Resolve numerically equivalent candidates by stable angular/item order.

Apply the first two criteria lexicographically. For the less-established aesthetic diagnostics, first find the compactness optimum `C*`, retain layouts within a small presentation tolerance of `C*`, and compare them visually rather than inventing universal weights. Still report both geometric near-edge extent—the smallest circle that merely touches every plate somewhere—and full outer extent—the radius needed to contain every plate completely. They describe the rendered footprint, but the first can be gamed by an irrelevant corner and the second is dominated by uncontrolled plate dimensions, so neither is the preferred primary objective.

Algorithm selection has a separate cost. Record shipped non-test lines, geometric predicates and duplicated checks, tunable constants, solver states, and failure paths. Do not fold these into a weighted layout score. First reject invalid output, then compare appearance, then choose the smallest implementation that meets the quality bar. For this library, roughly 200–300 lines for the production geometry module is a reasonable target; designs above about 400 lines need strong visual evidence.

## Algorithm families

This section separates facts established by the cited work from recommendations for this menu. The cited problems are close relatives, not proofs that their visual objectives transfer unchanged to marking menus.

### 1. Shared radius plus greedy compaction — recommended production ladder

Place every plate on its item ray at one shared contact radius. Starting at the ring-clearance floor, increase that radius in one-pixel steps until the complete layout passes the plate and connector checks. This scan is deterministic and was already measured well below the creation-time budget. Because the menu is laid out once, replacing the scan with more elaborate interval arithmetic is not justified unless production measurements show a problem.

If shared radius wastes visible space, use it as the valid seed for deterministic greedy compaction. At decreasing step sizes, try moving each plate inward and then sideways within its association sector. Accept a move only when the complete layout remains valid and its ordered quality measures improve. Moving one plate at a time does not make placement independent: every attempted move is checked against all other current plates and connectors.

This method can stop in a local optimum and does not prove the best possible layout. Those are acceptable limits because the result is satisfactory. The prototype's greedy layer is about 50 lines beyond the shared geometry. In the focused blind review, greedy beat shared radius in four of five cases for both association and overall appearance. Compared with global search, association favored greedy once and tied four times; overall appearance favored each algorithm once and tied three times.

### 2. Candidate positions plus exact constraint search — offline quality reference

**Established precedent.** Cartographic label placement has long been formulated as choosing one position from a finite candidate set. Christensen, Marks, and Shieber explicitly divide their method into candidate generation, position evaluation, and global position selection; their point-feature problem and most interesting variants are NP-hard ([1995 paper](https://www.eecs.harvard.edu/~shieber/Biblio/Papers/tog-final.pdf)). A set of fixed rectangular candidates can be represented by a conflict graph, where intersecting candidates are adjacent; van Kreveld et al. use branch-and-cut to solve the resulting independent-set formulation optimally ([2000 paper](https://ics-archive.science.uu.nl/research/techreps/repo/CS-2000/2000-22.pdf)). Modern CP-SAT directly supplies exactly-one Boolean constraints and integer objectives ([OR-Tools model interface](https://github.com/google/or-tools/blob/stable/ortools/sat/cp_model.h)); it distinguishes a proved `OPTIMAL` result, a merely `FEASIBLE` result, and proved `INFEASIBLE` ([official status documentation](https://developers.google.com/optimization/cp/cp_solver)).

**Proposed marking-menu model.** For item `i`, generate a finite ordered set `Q_i`. These sets describe the choices available to the global solver; they do not split the layout into independent per-item problems. Candidate `q ∈ Q_i` fixes:

- the axis-aligned plate box `B_iq` with its measured width and height;
- the connector contact `c_iq = ρ_iq u_i` on the fixed item ray `u_i`;
- the connector segment from the ring to `c_iq`;
- tangential displacement `τ_iq`, nearest-edge extent, outer extent, and other unary diagnostics.

Discard unary-invalid candidates that cover the interaction ring or protected content, fail to meet their own ray, attach on a disallowed part of the plate, or violate a configured clearance. Precompute a conflict between `(i,q)` and `(j,s)` whenever the two selected geometries would cause a plate–plate, connector–plate, connector–connector, or cyclic-order violation. Adjacent-whitespace and symmetry scores also depend on combinations of selected candidates rather than on one plate alone. Inflate geometry by the required clearances during this preprocessing.

Let Boolean `y_iq` mean that candidate `q` is selected. The solver chooses the full vector `(q_1, …, q_n)` at once. The exact finite model is:

```text
for every item i:              Σ(q ∈ Q_i) y_iq = 1
for every conflicting pair:   y_iq + y_js ≤ 1
for every item i:              C ≥ Σ(q ∈ Q_i) ρ_iq y_iq
```

The later max/min objectives remain linear over candidates. For example, with precomputed normalized displacement `a_iq = |τ_iq| / h_i` and precomputed whitespace `δ_iqjs` between a candidate and the next item's candidate:

```text
for every item i:              T ≥ Σ(q ∈ Q_i) a_iq y_iq
for every adjacent i,j,q,s:    G ≤ δ_iqjs + M(2 - y_iq - y_js)
```

Minimizing `T` gives the worst normalized tangential displacement; maximizing `G` gives the minimum selected neighbour whitespace. Candidate-pair variables can similarly express the sum or variation of selected gaps. Distances should be scaled to exact integers before solving, and the rendered floating-point geometry should still be independently validated.

Solve separate models in this order, fixing each preceding optimum before continuing:

1. minimize `C`, the maximum connector-contact radius;
2. minimize `Σ_i ρ_i`, equivalently total connector length up to the fixed ring-radius constant;
3. minimize `max_i |τ_i| / h_i`, then `Σ_i |τ_i| / h_i`, as scale-normalized association displacement;
4. maximize the minimum whitespace between cyclic neighbours;
5. minimize variation of those neighbour gaps, with a symmetry-error objective inserted before this stage for inputs that are themselves symmetric;
6. select the lexicographically first vector of candidate indices.

Steps 3–5 are proposed hypotheses, not literature-derived priorities. A second experimental policy should permit `C ≤ C* + ε`, where `ε` is expressed as a small fraction of typical plate height, and then optimize association displacement before distribution. Comparing that policy with strict lexicographic compactness will reveal whether a tiny radius concession produces visibly better layouts.

Generate candidates symmetrically: every sample must have its reflected/rotated counterpart when the input does. Start with centre-edge contact and a small set of ports along the origin-facing plate edges, combined with radial contact values from the ring-clearance floor to a conservative ceiling. Refine around the best candidate and around collision-event radii until halving the sampling step no longer changes the chosen layout or its primary metrics materially. These sampling and refinement rules are recommendations; they are what turn finite-set optimality into a useful approximation of the continuous problem.

**Guarantees and cost.** If all geometric predicates are correct and the solver reports `OPTIMAL`, the result satisfies every encoded hard constraint and is globally optimal for the current candidate sets. It is not a proof of the continuous optimum. Candidate preprocessing is quadratic in the total number of candidates in the direct implementation, and exact selection is exponential in the worst case; the cited map-label problem is NP-hard. At the intended 12-plus-item breadth, the practical question is how many candidates can be afforded while still proving an optimum at creation time—this must be benchmarked rather than assumed.

For the prototype, use conflict bitsets, eliminate candidates dominated on both cost and compatibility, propagate singleton/empty item domains, branch on the item with the fewest remaining compatible candidates, and seed the search with the existing collision-free layout. These are engineering recommendations to test, not complexity guarantees. A fixed candidate enumeration, single-threaded search, exact integer scoring, and the final canonical tie-break are determinism controls. If production needs a search limit, make it a deterministic node/propagation budget rather than a wall-clock deadline; return only a geometrically validated incumbent, and fall back to the existing exact no-slide layout if none exists. Only claim finite-set optimality when the search actually proves it.

**Expected visual behaviour.** This model should keep every connector visibly tied to its fixed wedge, push only crowded items farther or sideways, and distribute spare space only after compactness and association are settled. Its main visual risk is quantization: plates may jump by the sampling interval or miss a good continuous arrangement. Adaptive refinement and optional polishing address that risk.

### 3. Exact finite solve followed by constrained continuous polish — optional reference

Stadler, Steiner, and Beiglböck use a related two-stage pattern: a discrete image-based step finds a collision-free initial placement, then a continuous force-directed step improves closeness and visual distribution ([2005 paper](https://www.geometrie.tuwien.ac.at/ig/papers/tr147.pdf)). Their application and constraints differ, but it is direct evidence that discrete feasibility and continuous aesthetic improvement can coexist in one label-layout workflow.

For this menu, start from the optimal candidate assignment, freeze every discrete choice—contact edge, cyclic order, and which separating side makes each non-overlap constraint true—and optimize only the continuous radial and tangential coordinates inside that cell. Minimize the same lexicographic objectives, accepting a move only when it improves the current stage without worsening earlier stages. Finish with the independent geometric validator and fall back to the exact candidate solution if validation fails.

This polish can remove grid artefacts and recover a locally optimal continuous placement. It cannot certify the global continuous optimum, and it must not be allowed to trade hard validity for a lower penalty. Its cost is roughly the cost of a small nonlinear solve in `2n` variables once the disjunctions are frozen; actual time and sensitivity to initial conditions need measurement.

### 4. Global mixed-integer nonlinear optimization — useful as an offline oracle

A continuous formulation can use `(x_i,y_i)` plate centres and contact radii `ρ_i`, plus binary variables selecting the contacted plate edge and one separating relation for every potentially colliding pair. Plate non-overlap is a four-way disjunction; contact-on-edge, plate–ring clearance, and connector–plate avoidance add piecewise or nonlinear constraints. SCIP supports mixed-integer nonlinear programs using LP-based spatial branch-and-cut ([official problem-class documentation](https://scipopt.org/doc/html/WHATPROBLEMS.php)) and enforces general nonlinear constraints with separation, domain propagation, and spatial branching ([official nonlinear-handler documentation](https://www.scipopt.org/doc-7.0.0/html/group__CONSHDLRS.php)).

In principle this approach can provide global bounds and prove optimality or infeasibility to numerical tolerances. In practice, the model is substantially harder to implement correctly than the finite conflict model: non-overlap and connector avoidance are disjunctive, Euclidean clearances are nonconvex in the required “stay outside” direction, and big-`M` constants or nonlinear relaxations affect numerical strength. The recommendation is therefore to build this only for a reduced corpus as a continuous best-known oracle against which candidate compactness regret can be measured, not as the first shipping solver.

### 5. Constrained local nonlinear optimization — useful only inside a known feasible cell

Interior-point and SQP-style solvers are effective for smooth constrained nonlinear programs. Ipopt, for example, implements a primal-dual interior-point filter line-search method for twice continuously differentiable objectives and constraints ([Wächter & Biegler, 2006](https://cepac.cheme.cmu.edu/pasi2011/library/biegler/ipopt.pdf)). Its optimality conditions and restoration mechanisms concern stationary/local behaviour, not a certificate of the global optimum of this nonconvex, disjunctive layout problem.

A monolithic local solve from the current radial layout would be concise and could yield smooth-looking coordinates, but different initial states or smooth penalty approximations can land in different local minima. Hard rectangle and connector conflicts also create nonsmooth changes of active constraint. It is therefore a poor source of the primary answer. Use it for the polish stage above, run from several symmetric starts if necessary, and validate the exact geometry afterward.

### 6. Force/energy relaxation — valuable baseline or candidate generator, not final authority

Force-based label algorithms use attraction toward an associated feature and repulsion between labels or obstacles. Ebner, Klau, and Weiskircher add distance-related repulsion specifically to obtain better distribution, but also show configurations where a pure force method cannot escape a bad local minimum or even resolve a simple conflict; they combine it with simulated annealing ([2004 paper](https://www.ac.tuwien.ac.at/files/pub/ekr-lnmitsm-04.pdf)). Their experiments concern slider-model map labels and label-number maximization, so the positive visual observations do not transfer automatically to our all-labels marking-menu problem.

An adapted energy would combine anchor springs toward `τ_i = 0`, inward radial pressure, strong plate/connector repulsion, and neighbour-gap repulsion. Each iteration needs `O(n²)` pair checks in the simple implementation. It is easy to tune interactively and likely to generate organic spacing, but it does not guarantee clearance, primary-objective optimality, or symmetry; large penalty weights also reintroduce the unsupported weighted-sum problem. Fixing the initial state, update order, iteration count, and random seed makes a run repeatable but does not make it correct. Keep it as a comparison baseline or use its result to add promising candidates to the exact model.

### 7. Simulated annealing — strong heuristic baseline, unnecessary as the sole solver here

Simulated annealing occasionally accepts worsening moves to escape local minima, following the optimization analogy introduced by Kirkpatrick, Gelatt, and Vecchi ([1983 paper](https://doi.org/10.1126/science.220.4598.671)). In a substantial candidate-position label-placement comparison, Christensen, Marks, and Shieber found their annealing method gave the best quality among the practical algorithms tested, at higher computation cost, and became more useful as placement preferences made the search landscape rougher ([1995 paper](https://www.eecs.harvard.edu/~shieber/Biblio/Papers/tog-final.pdf)).

Applied here, a move can replace one item's candidate or perturb one continuous radial/tangential coordinate. Annealing can explore disconnected feasible arrangements better than local relaxation and is simple to extend with aesthetic terms. A finite run supplies no proof of feasibility or optimality; stochastic tie-breaking is also at odds with determinism unless the seed and schedule are fixed. Given the moderate target breadth and the availability of exact finite search on at least part of the corpus, use annealing to benchmark solution quality/time, seed candidate refinement, or find incumbent solutions for a global solver—not as the only production algorithm.

### 8. Boundary, contour, and orbital dynamic programs — instructive, but their geometry is not ours

The closest exact layout research is radial contour labeling. Niedermann, Nöllenburg, and Rutter allow non-uniform label shapes, finite candidate ports or sliding ports, hard constraints, unary label costs, and pairwise costs between consecutive labels. Their dynamic program returns a minimum-cost planar staircase labeling under its model, with `O(n^8)` asymptotic time before engineering heuristics ([2017 paper](https://arxiv.org/abs/1702.01799)). This is strong evidence for separating hard constraints from flexible costs and for giving consecutive labels an explicit joint cost.

The mismatch is decisive for direct reuse: their label ports lie on a _given convex contour_, their leader/site geometry supplies a recursive planar decomposition, and their staircase condition is part of feasibility. Our contour radius is the quantity to minimize, rectangular plates need not lie on a common prescribed contour, and connectors are fixed to item rays. Adapting that dynamic program would amount to changing the layout design, not merely choosing a better implementation.

Orbital boundary labeling is even closer topologically: it places labels on a circular annulus and minimizes total leader length, with polynomial algorithms for some combinations of fixed order, candidate ports, leader type, and label uniformity, while other variants are NP-hard ([Bonerath et al., 2024](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.GD.2024.22)). But its labels are disjoint circular arcs in an orbit, not horizontal rectangular plates freely positioned outside a marking-menu ring. It becomes relevant only if the product design changes to true arc labels on one common orbit.

A simple cyclic dynamic program over our own candidates would cost `O(nm²)` for `n` items and `m` candidates per item if the score and compatibility depended only on consecutive items. It is not generally sufficient: a long plate or connector can conflict with a non-neighbour. Use that cheaper route only after proving a locality property for the allowed geometry; otherwise the exact conflict model is safer.

## Recommended prototype sequence

1. **Strengthen the existing no-slide exact solver as the baseline.** Report its contact extent and all hard-validity checks. It is fast and supplies a useful upper bound even when its visual distribution is rigid.
2. **Implement the candidate conflict model.** Begin with few centred/edge-port candidates and exact sequential objectives. Render every optimum and expose which constraint made each item move. Record explored nodes and whether optimality was proved.
3. **Add adaptive refinement.** Refine only the selected candidates and their conflict neighbourhoods; compare successive resolutions and retain the best validated geometry.
4. **Add continuous cell-constrained polish.** Keep it optional and compare before/after to learn whether quantization is actually visible.
5. **Build a reduced global-MINLP oracle only if candidate regret remains unknown.** It is evaluation infrastructure, not a prerequisite for the product solver.
6. **Keep force relaxation and simulated annealing as baselines.** Run them on the same candidate sets and objectives so the comparison tests the search method rather than a different definition of “nice.”
7. **Stress the planned breadth explicitly.** Benchmark realistic and adversarial menus at 8, 12, 16, and the intended maximum. Establish when the exact search completes, when it returns only an incumbent, and when the no-slide fallback is used.

## Evaluating an algorithm

Run every candidate solver over the same versioned corpus of measured label boxes and angles. Separate current menus (4–8 items and legal manual-angle configurations), planned 12-plus-item menus, and deliberately adversarial or invalid stress cases.

### Required pass/fail checks

- all plate–plate, plate–ring, plate–connector, and connector–connector clearances pass;
- every connector terminates on its own plate and only its own plate;
- cyclic order is preserved;
- all coordinates are finite;
- repeating the solve produces identical geometry.

Any failure disqualifies the result; failures are not averaged into a score.

### Primary measurements

| Measurement                     | Definition                                                                                         | Purpose                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Connector-contact extent        | `C = max_i distance(origin, connectorContact_i)`                                                   | Primary compactness and worst association distance: the smallest origin-centred circle that reaches every plate at its own connector contact.   |
| Contact-extent regret           | `(Calgorithm - Cbest-known) / Cbest-known`                                                         | Compares a practical solver with the smallest contact extent found or bounded by exact/offline search.                                          |
| Geometric near-edge extent      | `N = max_plate(min_point∈plate distance(origin, point))`                                           | Reports the smallest circle that touches every plate somewhere; compare with `C` to expose layouts that are close only at an irrelevant corner. |
| Full outer extent               | `O = max_plate(max_corner∈plate distance(origin, corner))`                                         | Reports the rendered footprint; retain as a diagnostic because plate dimensions are not controlled by the solver.                               |
| Maximum connector length        | Longest distance from the ring to a plate contact, equal to `C - ringRadius` for radial connectors | Restates the primary result in visual-association units.                                                                                        |
| Mean contact distance           | Mean distance from the ring to each plate's connector contact                                      | Detects globally loose layouts hidden by the same maximum extent.                                                                               |
| Total connector length          | Sum of ring-to-plate connector lengths                                                             | Secondary measure of visual spread and ink.                                                                                                     |
| Maximum tangential displacement | Largest sideways distance from the ideal anchor                                                    | Detects labels whose placement no longer reads naturally from their direction.                                                                  |
| Minimum adjacent whitespace     | Smallest geometric gap between cyclically adjacent plates                                          | Detects local bunching after association constraints are satisfied.                                                                             |
| Adjacent-gap variation          | Range or standard deviation of those cyclic gaps                                                   | Detects uneven distribution around the menu.                                                                                                    |
| Visual-centroid offset          | Distance from the area-weighted plate centroid to the origin                                       | Detects a lopsided overall arrangement; interpret cautiously for intentionally uneven item angles.                                              |

### Exploratory diagnostics

- range and standard deviation of connector lengths;
- range and standard deviation of contact and geometric near-edge distances;
- angular gaps between neighbouring plate centres;
- reflection/rotation error on symmetric fixtures;
- creation-time measurement and solve cost.

Report per-case results plus median, 95th percentile, and worst case. Averages alone hide the single menu whose label is pushed far away. For candidate solvers, also report candidate count, conflict count, solver status, optimality gap where available, and whether doubling candidate resolution changes the result. For aesthetics that remain uncertain, render blind A/B pairs at equal or near-equal `C`; record preference and label-finding time. That is how distribution, connector balance, and anchor displacement graduate from hypotheses into ranked criteria.

Compare algorithms in three layers:

1. **Correctness:** the pass/fail checks above and explicit infeasibility behaviour.
2. **Optimization:** contact-extent regret against the best exact candidate solve or continuous oracle, then the later lexicographic stages and solve time.
3. **Appearance and use:** blind preference, time to identify a requested label, and association errors among layouts matched on `C`.

Plot a small Pareto set for `C`, tangential displacement, and minimum neighbour whitespace rather than collapsing the uncertain criteria into one score. Include ablations that remove each secondary objective; a distribution term earns a permanent place only if it improves preference or task performance without damaging association.

## Open questions for prototypes or user study

- At equal or near-equal connector-contact extent, which distribution measures actually predict preference and label-finding performance?
- How much tangential displacement can occur before label–direction association or expert recall suffers?
- Does connector-contact extent predict perceived compactness better than geometric near-edge or full outer extent?
- Does connector contact at the plate edge center outperform nearest-edge or ray-intersection contact near corners?
- How fine must adaptive candidate sampling become before contact extent and visual choices converge?
- At 8, 12, 16, and the intended maximum item count with real command names, do the external-label findings about structure and leader traceability reproduce?
- What maximum label width or wrapping policy gives the best compactness/readability trade-off?

## Bibliography

- Barth, L., Gemsa, A., Niedermann, B., & Nöllenburg, M. (2015). [On the Readability of Boundary Labeling](https://arxiv.org/pdf/1509.00379).
- Bekos, M. A., Kaufmann, M., Symvonis, A., & Wolff, A. (2007). [Boundary Labeling: Models and Efficient Algorithms for Rectangular Maps](https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/bksw-blmea-07.pdf).
- Bonerath, A., Nöllenburg, M., Terziadis, S., Wallinger, M., & Wulms, J. (2024). [Boundary Labeling in a Circular Orbit](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.GD.2024.22).
- Christensen, J., Marks, J., & Shieber, S. M. (1995). [An Empirical Study of Algorithms for Point-Feature Label Placement](https://www.eecs.harvard.edu/~shieber/Biblio/Papers/tog-final.pdf).
- Ebner, D., Klau, G. W., & Weiskircher, R. (2004). [Label Number Maximization in the Slider Model](https://www.ac.tuwien.ac.at/files/pub/ekr-lnmitsm-04.pdf).
- Kirkpatrick, S., Gelatt, C. D., Jr., & Vecchi, M. P. (1983). [Optimization by Simulated Annealing](https://doi.org/10.1126/science.220.4598.671).
- Kurtenbach, G., & Buxton, W. (1993). [The Limits of Expert Performance Using Hierarchic Marking Menus](https://www.billbuxton.com/MMExpert.pdf).
- Kurtenbach, G., Sellen, A., & Buxton, W. (1993). [An Empirical Evaluation of Some Articulatory and Cognitive Aspects of Marking Menus](https://damassets.autodesk.net/content/dam/autodesk/research/publications-assets/pdf/an-empirical-evaluation-of.pdf).
- Niedermann, B., Nöllenburg, M., & Rutter, I. (2017). [Radial Contour Labeling with Straight Leaders](https://arxiv.org/pdf/1702.01799).
- Stadler, G., Steiner, T., & Beiglböck, J. (2005). [A Practical Map Labeling Algorithm Utilizing Image Processing and Force-Directed Methods](https://www.geometrie.tuwien.ac.at/ig/papers/tr147.pdf).
- van Kreveld, M., Strijk, T., & Wolff, A. (2000). [Algorithms for Maximum Independent Set Applied to Map Labelling](https://ics-archive.science.uu.nl/research/techreps/repo/CS-2000/2000-22.pdf).
- Wächter, A., & Biegler, L. T. (2006). [On the Implementation of an Interior-Point Filter Line-Search Algorithm for Large-Scale Nonlinear Programming](https://cepac.cheme.cmu.edu/pasi2011/library/biegler/ipopt.pdf).
- Zhao, S., Agrawala, M., & Hinckley, K. (2006). [Zone and Polygon Menus](https://www.dgp.toronto.edu/~sszhao/paper/zonepoly.pdf).
