# Issue #267 layout experiment

## Scope

This record covers the experimental phase and algorithm decision for [the issue #267 plan](../plans/issue-267-label-layout.md). It does not implement the production layout algorithm. The experiment is a throwaway comparison harness at [`demo/playground/prototype-label-solver/comparison.html`](../../demo/playground/prototype-label-solver/comparison.html).

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

The following numbers are one browser run on the development machine. Timing is diagnostic rather than a stable benchmark.

| Strategy                   | Valid | Median C | Worst C | Median max shift | Median outer extent | Median nodes | Worst nodes | Median time | 95th time | Worst time |
| -------------------------- | ----: | -------: | ------: | ---------------: | ------------------: | -----------: | ----------: | ----------: | --------: | ---------: |
| Shared radius              | 19/19 |    262.0 | 1,088.0 |              0.0 |               429.4 |          171 |         997 |      1.0 ms |   18.7 ms |    21.8 ms |
| Tolerant relaxation        | 19/19 |    143.0 |   462.9 |             52.0 |               336.7 |          776 |       3,759 |      6.9 ms |   59.7 ms |    61.5 ms |
| Global candidates (12 px)  | 19/19 |    132.4 |   356.0 |             44.9 |               369.5 |        1,200 |       3,000 |    156.3 ms |  785.0 ms |   925.3 ms |
| Adaptive global candidates | 19/19 |    127.5 |   350.7 |             47.8 |               366.4 |        1,500 |       8,519 |    169.6 ms |  351.0 ms |   373.1 ms |
| Adaptive + 4 px tolerance  | 19/19 |    129.5 |   346.0 |             37.8 |               347.2 |        6,374 |      17,519 |    188.7 ms |  397.6 ms |   398.8 ms |

All five strategies were repeatable and valid on the final run. Before candidate generation was constrained, all three original strategies that allow tangential movement changed the cyclic plate order on the same seeded 20-item case. Restricting every plate center to the angular sector halfway between its neighboring fixed directions eliminated those failures. This supports treating association as a feasible-domain constraint rather than expecting a distribution objective to repair it afterward.

On the default eight-item case, contact extent changed from 123.0 for shared radius to 122.0 for relaxation, 102.6 for finite candidates, and 96.6 for adaptive candidates. The corresponding full-plate outer extents were 204.9, 205.1, 231.0, and 226.7. Candidate search therefore achieved a much smaller contact circle while producing a larger full footprint. The two notions of compactness measure different visual effects. The 4 px policy then used 1 px more contact extent than strict adaptive search, while reducing maximum tangential displacement from 38.4 to 33.4 px and outer extent from 226.7 to 221.2 px.

The batch initially used larger synchronous search budgets and could freeze the browser at 20 items. The harness now bounds work by item count and yields between fixtures. This is evidence that unrestricted global enumeration is not a suitable implementation strategy even though layout runs only once at creation.

## Blind review

The five-case randomized blind review produced this result:

| Criterion    | Strict adaptive | 4 px tolerance | No difference |
| ------------ | --------------: | -------------: | ------------: |
| Association  |               0 |              0 |             5 |
| Distribution |               3 |              0 |             2 |

Neither policy changed perceived label association. Strict adaptive search looked better distributed in three cases and tied in the other two. The 4 px policy did not win a case, so its additional presentation search did not produce a visible benefit.

## Decision

Use strict adaptive global candidate search for the production design. Keep these parts of the prototype contract:

- Treat association sectors, ring clearance, plate separation, connector clearance, cyclic order, finite output, and repeatability as hard constraints.
- Solve the complete plate assignment jointly. Plate positions are not independent.
- Minimize the maximum connector-contact radius first, then total connector-contact radius, tangential displacement, and distribution measures.
- Use adaptive candidate refinement with a deterministic work limit.
- Seed the search with the valid shared-radius layout and return only a validated incumbent when the work limit is reached.
- Report an oversized layout explicitly instead of returning invalid geometry.

Do not add the 4 px tolerance stage or continuous polishing. Shared radius remains the correctness fallback, not the normal result. The relaxation and fixed-grid variants remain rejected alternatives.

## Main-thread cost

Strict adaptive search took 169.6 ms at the median, 351.0 ms at the 95th percentile, and 373.1 ms in the slowest recorded corpus case. These are prototype timings, not a production benchmark, but they are long enough to freeze the main thread visibly.

Plan for the renderer to measure the final label plates on the main thread, then send the numeric plate dimensions, fixed directions, ring geometry, and clearances to a Web Worker. The worker returns plate positions and connector contacts. This keeps the bounded global search away from input handling and drawing. The static layout contract makes this split practical because the result is computed once when the menu is created and does not change afterward.

Benchmark the selected solver alone in a production-shaped build. Keep the worker unless representative worst-case generation falls well below 50 ms. Worker communication does not replace the deterministic work limit or the shared-radius fallback.

The remaining work belongs in `src`: implement the selected geometry module, add production tests, connect main-thread measurement to the worker, integrate the result with the renderer, and close #267 after that implementation is merged.
