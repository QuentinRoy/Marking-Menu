# Issue #267 layout experiment

## Scope

This record covers the experimental phase and algorithm decision for [the issue #267 plan](../plans/issue-267-label-layout.md). It does not implement the production layout algorithm. The experiment is a throwaway comparison harness at [`prototypes/label-solver/comparison.html`](../../prototypes/label-solver/comparison.html) on the `prototype/label-solver` branch.

The menu is static. Layout is computed once when the menu is created. Relayout, mutable labels, and adding items to an existing menu are outside the contract. The corpus includes menus from 4 to 20 items because the intended capacity will grow to at least 12, but its eventual upper bound is not fixed.

## Evaluation order

A result is rejected before it is scored when any hard constraint fails:

1. Each connector keeps its item's fixed direction, reaches that item's plate, and points away from the ring.
2. Plates preserve their cyclic item order. A compact result must not make a label appear to belong to a neighboring direction.
3. Plates remain outside the ring clearance.
4. Plates do not overlap.
5. Connectors do not cross or interfere with another plate.
6. The result contains one finite placement per input item and is repeatable for identical input.

The primary compactness metric is the radius `C` of the smallest circle that reaches every plate at its own connector contact. In the prototype this is the maximum connector contact radius. It deliberately does not require the circle to contain each plate in full. The smallest circle that merely touches every plate at any point is also reported as near-edge extent, so the two interpretations can be compared rather than conflated.

Valid results are then compared lexicographically by:

1. maximum contact radius `C`;
2. total contact radius, equivalent to total connector length for a fixed ring;
3. maximum tangential displacement;
4. total tangential displacement;
5. minimum neighboring whitespace;
6. variation in neighboring whitespace.

The full-plate outer extent is reported separately. It catches layouts that pull the nearest plate edges inward by pushing long labels sideways and outward. It should not silently replace `C`, but the current evidence shows that it cannot be ignored.

Association and distribution are also shown as separate blind choices. There is intentionally no synthetic “beauty score.” If compactness conflicts with obvious label-to-direction association, association wins. Distribution matters only after that.

## Harness

The page measures rendered label plates and gives every solver the same complete menu input. Five strategies are displayed at the same scale:

- **Shared radius** places every plate without tangential movement and increases a common contact radius until the complete layout is valid. It is the conservative baseline.
- **Tolerant relaxation** starts from the baseline and greedily tries deterministic radial and tangential moves at decreasing step sizes.
- **Global candidates (12 px)** builds a finite placement domain for every item and searches for one mutually compatible placement per item.
- **Adaptive global candidates** repeats bounded candidate search around its current incumbent at 12, 4, and 1 px resolutions.
- **Adaptive + 4 px tolerance** finds the strict adaptive result, permits up to 4 px more contact extent, then minimizes maximum and total tangential displacement before distribution and remaining contact distance.

The candidate solvers optimize a complete assignment. Their per-item candidates are search domains, not independent placements. Search uses the most constrained remaining item first and prunes with a lower bound on maximum and total contact radius. A deterministic node budget keeps the browser responsive; a `feasible` result is an incumbent, not a proof of finite-set optimality.

Validation is implemented separately from solver collision checks. Every solver is also run twice on the same measured input, excluding elapsed time from the comparison, to detect nondeterministic output.

The deterministic corpus contains 19 cases:

- fixed even menus at 4, 8, 12, 16, and 20 items;
- asymmetric and alternating label widths;
- clustered manual directions around the zero-degree boundary;
- symmetric labels;
- an oversized-label case;
- two seeded fixtures at each of 4, 8, 12, 16, and 20 items, varying width, height, and angle gaps.

The page can export the measured inputs, layouts, validation failures, metrics, work counts, timings, and blind choices as JSON.

The primary screen is now a focused blind review of the two finalists: strict adaptive search and adaptive search with the 4 px presentation tolerance. Their left and right positions are randomized for each case. Solver names, measurements, and the result remain hidden until the reviewer records two separate choices in priority order:

1. label association;
2. distribution, unlocked only after association has been judged.

Choices lock after both answers to prevent the reveal from changing the judgment. The review covers the familiar eight-item menu, alternating and asymmetric twelve-item menus, clustered manual angles, and the twenty-item stress case. It reports a running tally and exports each choice together with the hidden assignment and both layouts' measurements. The five-strategy comparison and full corpus remain available in a collapsed workbench.

The tolerant solver now receives the exact strict result shown beside it and refines from that placement. Its reported work and time include both strict search and the added presentation-policy search. This removes duplicate strict solves from the comparison path and makes the relationship between the two finalists explicit. The tolerant policy still does more work by design; the blind review tests whether that added work produces a useful visual difference.

## Current run

The following numbers are one browser run on the development machine. Timing is diagnostic rather than a guarantee for other hardware.

| Strategy                   | Valid | Median C | Worst C | Median max shift | Median outer extent | Median nodes | Worst nodes | Median time | 95th time | Worst time |
| -------------------------- | ----: | -------: | ------: | ---------------: | ------------------: | -----------: | ----------: | ----------: | --------: | ---------: |
| Shared radius              | 19/19 |    262.0 | 1,088.0 |              0.0 |               429.4 |          171 |         997 |      0.7 ms |    4.7 ms |     6.1 ms |
| Tolerant relaxation        | 19/19 |    143.0 |   462.9 |             52.0 |               336.7 |          776 |       3,759 |      5.6 ms |   39.1 ms |    49.7 ms |
| Global candidates (12 px)  | 19/19 |    132.4 |   356.0 |             44.9 |               369.5 |        1,200 |       3,000 |     12.3 ms |   47.4 ms |    69.0 ms |
| Adaptive global candidates | 19/19 |    127.5 |   350.7 |             47.8 |               366.4 |          765 |       6,000 |     11.2 ms |   23.1 ms |    38.2 ms |
| Adaptive + 4 px tolerance  | 19/19 |    129.5 |   346.0 |             37.8 |               347.2 |        4,686 |      12,000 |     32.5 ms |   46.3 ms |    58.2 ms |

All five strategies were repeatable and valid on the final run. Before candidate generation was constrained, all three original strategies that allow tangential movement changed the cyclic plate order on the same seeded 20-item case. Restricting every plate center to the angular sector halfway between its neighboring fixed directions eliminated those failures. This supports treating association as a feasible-domain constraint rather than expecting a distribution objective to repair it afterward.

On the default eight-item case, contact extent changed from 123.0 for shared radius to 122.0 for relaxation, 102.6 for finite candidates, and 96.6 for adaptive candidates. The corresponding full-plate outer extents were 204.9, 205.1, 231.0, and 226.7. Candidate search therefore achieved a much smaller contact circle while producing a larger full footprint. The two notions of compactness measure different visual effects. The 4 px policy then used 1 px more contact extent than strict adaptive search, while reducing maximum tangential displacement from 38.4 to 33.4 px and outer extent from 226.7 to 221.2 px.

The batch initially used larger synchronous search budgets and could freeze the browser at 20 items. The optimized prototype keeps the same candidate lattice and scoring, but caches fixed geometry, rejects impossible item pairs through bounding envelopes, computes ray-to-plate intervals once, memoizes exact candidate conflicts, and uses smaller deterministic work limits by item count. The strict solver's aggregate quality did not change: all 19 cases remained valid and repeatable, with the same median and worst contact extent, tangential shift, and outer extent. Unrestricted global enumeration remains unsuitable even though layout runs only once at creation.

## Blind review

Two randomized passes over the five representative cases produced these results:

| Pass     | Criterion    | Strict adaptive | 4 px tolerance | No difference |
| -------- | ------------ | --------------: | -------------: | ------------: |
| First    | Association  |               0 |              0 |             5 |
| First    | Distribution |               3 |              0 |             2 |
| Second   | Association  |               1 |              0 |             4 |
| Second   | Distribution |               2 |              1 |             2 |
| Combined | Association  |               1 |              0 |             9 |
| Combined | Distribution |               5 |              1 |             4 |

The tolerance policy never improved perceived association. Its single distribution win in the second pass was not consistent across the cases or the two passes. Strict adaptive search won five distribution judgments, lost one, and tied four. This is enough evidence to end the prototype selection: the tolerance stage does more work and permits a larger contact extent without providing a dependable visual improvement.

## Decision reopened

The first decision considered validity, measured layout quality, visual preference between two global-search variants, and runtime. It did not treat implementation size as a selection cost. Pull request #288 made that omission concrete: it adds 886 lines for the solver and 275 lines for a separate runtime validator. The complete pull request adds 1,640 lines to a library with about 5,930 existing non-test lines under `src`.

The visual evidence also cannot justify that cost. The blind review compared strict adaptive search with a four-pixel tolerance variant. It established which global-search policy to prefer, but it never compared global search with the shared-radius or greedy strategies. Better geometric scores alone do not establish that a person can see or benefit from the difference.

Implementation simplicity is now a selection gate, not another layout score:

1. Reject any algorithm that violates association, clearance, separation, finiteness, or repeatability.
2. Compare the remaining layouts for association and overall appearance.
3. Choose the smallest algorithm that produces satisfactory results.
4. Accept a larger algorithm only when blind review shows a clear, recurring improvement on realistic supported menus. A win limited to a stress case is not enough.

Measure implementation cost using shipped non-test lines, the number of geometric predicates and duplicated checks, tunable constants, solver states, and failure paths. Lines of code are a warning signal rather than a beauty score. For this library, a production geometry module around 200–300 lines is a reasonable target. A design above roughly 400 lines needs unusually strong visual evidence. A design near 1,000 lines is rejected by default.

The provisional production candidate was the shared-radius solver followed by deterministic greedy compaction. It starts from a valid complete layout, tries inward and sideways moves at decreasing step sizes, and accepts a move only when the complete layout remains valid and improves. Plate positions remain coupled because every move is checked against all other plates. The approach gives up a proof of global optimality, which is not a user requirement.

Adaptive global search remains in the prototype as an offline quality reference. It should ship only if it clearly and repeatedly beats greedy compaction in the new blind review.

## Revised blind review

The focused review now runs two comparisons over the same five cases:

1. Shared radius versus greedy compaction asks whether the small heuristic earns its extra code.
2. Greedy compaction versus adaptive global search asks whether the large search earns its extra code.

The cases cover four items, eight items, two realistic twelve-item shapes, and a sixteen-item stress case. Each comparison records label association first, then overall readability, compactness, and distribution. Solver names, measurements, and implementation cost stay hidden until both answers are recorded.

Association decides first. When association ties, overall appearance decides. The larger algorithm must win clearly and repeatedly; a tie goes to the smaller algorithm.

The completed review produced these results:

| Comparison               | Criterion      | Smaller algorithm | Larger algorithm | No difference |
| ------------------------ | -------------- | ----------------: | ---------------: | ------------: |
| Shared radius vs. greedy | Association    |                 0 |                4 |             1 |
| Shared radius vs. greedy | Overall layout |                 0 |                4 |             1 |
| Greedy vs. global        | Association    |                 1 |                0 |             4 |
| Greedy vs. global        | Overall layout |                 1 |                1 |             3 |

All 20 rendered layouts passed the independent validator. Greedy compaction clearly improved both association and overall appearance over shared radius in four of five cases. The four-item case was identical.

Adaptive global search did not clearly improve on greedy compaction. Association tied in four cases and favored greedy in the sixteen-item stress case. Overall appearance tied in three cases, favored global search in the eight-item case, and favored greedy in the sixteen-item case. Applying association first produced one win for each algorithm and three ties.

## Final simplicity decision

Use shared radius followed by deterministic greedy compaction in production. Greedy earns its small implementation cost over shared radius. Adaptive global search does not earn its much larger candidate lattice, branch-and-bound search, work limits, solver states, diagnostics, and runtime validator.

Keep the following behavior:

- Start from a valid shared-radius layout found by a one-pixel scan.
- Try deterministic inward and sideways moves at decreasing step sizes.
- Keep every plate inside its association sector.
- Accept a move only when the complete layout remains valid and its ordered quality measures improve.
- Return the valid shared-radius layout when greedy compaction cannot improve it.
- Report an oversized result instead of returning invalid geometry.
- Keep independent exhaustive validation in tests rather than duplicating the geometry in shipped code.

Do not ship adaptive global search, candidate refinement, global-optimality statuses, search diagnostics, or the rejected four-pixel tolerance policy. The global solver remains useful only as a prototype reference.

## Global-search reference

The global solver retained as the offline reference works in five steps:

1. Build a finite set of positions for each plate. Positions vary the distance from the center and allow limited sideways movement inside the plate's association sector.
2. Search for one complete set of compatible positions. Plate positions are chosen together because moving one plate changes which positions remain possible for the others.
3. Choose the plate with the fewest remaining positions first. After choosing a position, remove every conflicting position from the other plates. Stop that search branch as soon as a plate has no position left.
4. Compare valid layouts by maximum connector-contact radius, then total contact radius, sideways movement, and distribution. Stop exploring a partial layout when its best possible score cannot beat the current result.
5. Repeat around the best result with 12, 4, and 1 px position spacing. Start every search with the valid shared-radius layout and return the best independently validated result found within the deterministic work limit.

The optimized prototype avoids repeating most of the expensive geometry work. It computes fixed directions, association sectors, connector starts, plate bounds, and connector bounds once. Broad bounding envelopes identify pairs of items that can never conflict. Exact ray-to-plate intersections are also computed once, and exact candidate-pair results are saved after the first check. Smaller measured work limits for each item-count range reduce search without changing the corpus quality results.

## Main-thread cost

Before optimization, strict adaptive search took 169.6 ms at the median, 351.0 ms at the 95th percentile, and 373.1 ms in the slowest corpus case. The optimized full-corpus run took 11.2 ms at the median, 23.1 ms at the 95th percentile, and 38.2 ms in the slowest case.

The isolated benchmark solves fresh copies of all 19 inputs five times and excludes rendering. Two consecutive 95-run passes measured 12.1 ms median, 38.8 ms at the 95th percentile, and 42.2 ms worst, then 11.4 ms median, 27.1 ms at the 95th percentile, and 39.4 ms worst. All 190 results were valid and repeatable. Label measurement took roughly 0.4 to 1.2 ms in these runs and is reported separately.

The measurements show that all three relevant strategies can run synchronously during one-time menu creation. Do not add a Web Worker or an asynchronous menu lifecycle based on the current evidence. The production acceptance gate remains a solver-only 95th percentile at or below roughly 50 ms on representative hardware, including the intended maximum item count.

If production-shaped profiling misses that gate, move the numeric search to a worker. That choice also requires a menu-ready event, a `start` operation so callers can construct and prepare a menu before opening it, and visible feedback when a menu opens before its layout is ready. These changes form one fallback design; do not add part of it while layout remains synchronous.

The revised blind review is complete. Implement only shared radius and greedy compaction in `src`, target roughly 200–300 lines for the production geometry, add production tests, integrate one-time main-thread measurement and solving with the renderer, run the production benchmark, and close #267 after that implementation is merged.
