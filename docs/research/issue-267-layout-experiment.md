# Issue #267 layout experiment

## Scope

This record covers the experimental phase of [the issue #267 plan](../plans/issue-267-label-layout.md). It does not select or implement the production layout algorithm. The experiment is a throwaway comparison harness at [`demo/playground/prototype-label-solver/comparison.html`](../../demo/playground/prototype-label-solver/comparison.html).

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

## Current run

The following numbers are one browser run on the development machine. Timing is diagnostic rather than a stable benchmark.

| Strategy                   | Valid | Median C | Worst C | Median max shift | Median outer extent | Median nodes | Worst nodes | Median time | 95th time | Worst time |
| -------------------------- | ----: | -------: | ------: | ---------------: | ------------------: | -----------: | ----------: | ----------: | --------: | ---------: |
| Shared radius              | 19/19 |    262.0 | 1,088.0 |              0.0 |               429.4 |          171 |         997 |      2.0 ms |   31.8 ms |    32.4 ms |
| Tolerant relaxation        | 19/19 |    143.0 |   462.9 |             52.0 |               336.7 |          776 |       3,759 |     10.0 ms |   81.0 ms |    92.8 ms |
| Global candidates (12 px)  | 19/19 |    132.4 |   356.0 |             44.9 |               369.5 |        1,200 |       3,000 |    169.5 ms |  850.5 ms | 1,008.3 ms |
| Adaptive global candidates | 19/19 |    127.5 |   350.7 |             47.8 |               366.4 |        1,500 |       8,519 |    188.6 ms |  387.7 ms |   419.7 ms |
| Adaptive + 4 px tolerance  | 19/19 |    129.5 |   346.0 |             37.8 |               347.2 |        6,374 |      17,519 |    221.3 ms |  458.1 ms |   484.4 ms |

All five strategies were repeatable and valid on the final run. Before candidate generation was constrained, all three original strategies that allow tangential movement changed the cyclic plate order on the same seeded 20-item case. Restricting every plate center to the angular sector halfway between its neighboring fixed directions eliminated those failures. This supports treating association as a feasible-domain constraint rather than expecting a distribution objective to repair it afterward.

On the default eight-item case, contact extent changed from 123.0 for shared radius to 122.0 for relaxation, 102.6 for finite candidates, and 96.6 for adaptive candidates. The corresponding full-plate outer extents were 204.9, 205.1, 231.0, and 226.7. Candidate search therefore achieved a much smaller contact circle while producing a larger full footprint. The two notions of compactness measure different visual effects. The 4 px policy then used 1 px more contact extent than strict adaptive search, while reducing maximum tangential displacement from 38.4 to 33.4 px and outer extent from 226.7 to 221.2 px.

The batch initially used larger synchronous search budgets and could freeze the browser at 20 items. The harness now bounds work by item count and yields between fixtures. This is evidence that unrestricted global enumeration is not a suitable implementation strategy even though layout runs only once at creation.

## Current conclusion

No strategy is ready to select for production.

- Shared radius is robust and very fast, but often much larger than necessary.
- Relaxation is inexpensive and improves total connector length, but it does little for the worst contact radius on the familiar case and has a much worse corpus tail than candidate search.
- Finite candidate search substantially improves `C`, but its cost grows quickly and adaptive refinement still finds a measurably smaller contact extent.
- Strict adaptive candidates currently produce the best median `C`, but most searches stop at their deterministic budget and they can sacrifice full outer extent and tangential restraint.
- The 4 px tolerance policy spends 2 px at the median, reduces median maximum tangential displacement by 10 px, and reduces median outer extent by 19.2 px compared with strict adaptive search. Its median time increases by 32.7 ms. This is the preferred policy to take into blind visual comparison.

Continuous polishing is deferred. The current results have not established that grid artifacts, rather than the objective and candidate domain, are the limiting problem.

## Next experiment

Before algorithm selection:

1. Use the blind controls on the familiar, alternating, asymmetric, clustered, and upper-stress cases. Record association and distribution choices separately.
2. Compare strict adaptive search directly with the 4 px tolerance policy. Confirm that the measured reduction in displacement and outer extent improves perceived association and distribution.
3. Repeat timings over several runs after the solver ladder is final. Select the tolerant policy only if its visual results are preferred consistently enough to justify its additional work.

Only after that decision should work move into `src`, gain production tests, integrate with the menu renderer, and close #267.
