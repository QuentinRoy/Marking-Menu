# Label layout algorithm plan

This plan covers the experiments, algorithm selection, production implementation, and evidence needed to close [issue #267](https://github.com/QuentinRoy/Marking-Menu/issues/267). The supporting criteria and algorithm research are in [Evidence and algorithms for marking-menu label layout](../research/marking-menu-label-layout-criteria.md).

## Goal

Choose and implement a deterministic algorithm that lays out a static marking menu once, when the menu is created. The result must preserve the fixed item directions, make every label-to-item association clear, satisfy all geometric constraints, remain compact, and look well distributed when compactness leaves room for a choice.

The layout must work for the current menu sizes and be tested at 12, 16, and the intended maximum item count. Supporting 12-item gesture recognition remains separate work under [issue #274](https://github.com/QuentinRoy/Marking-Menu/issues/274).

## Final prototype decision

Use shared radius followed by deterministic greedy compaction. A production attempt showed that adaptive global search required 886 solver lines and a 275-line runtime validator. A focused blind review then compared the complexity ladder directly.

Greedy compaction beat shared radius for association and overall appearance in four of five cases, with one tie. Adaptive global search did not clearly beat greedy: association favored greedy once and tied four times; overall appearance favored each algorithm once and tied three times. The larger algorithm therefore does not earn its implementation cost. Keep adaptive global search only as prototype evidence.

After preserving the same candidate lattice and quality scores, the optimized prototype measured 11.2 ms at the median, 23.1 ms at the 95th percentile, and 38.2 ms in the slowest full-corpus case. Two consecutive isolated 95-run passes kept the 95th percentile below 39 ms and the worst result below 43 ms. Start with synchronous one-time layout during creation. Require a solver-only 95th percentile at or below roughly 50 ms on representative hardware, including the intended maximum item count.

Use a Web Worker only if the production-shaped benchmark misses that gate. An asynchronous solver also requires a menu-ready event, a `start` operation so callers can prepare the menu before opening it, and visible feedback when a menu opens before layout is ready. Treat those API and interface changes as one fallback design, not as independent additions.

## Corrected issue contract

Issue #267 reflects these decisions:

- Compute layout once during menu creation.
- Do not observe size changes or relayout an existing menu.
- Recreate the menu when its items, labels, fonts, or styles change.
- Measure the final rendered label boxes before solving.
- Treat item angles, cyclic order, wedge geometry, and gesture mapping as fixed inputs.
- Require identical geometric inputs to produce identical output.
- Allow different fonts or zoom levels to produce different layouts when they produce different measured boxes.
- Report an oversized result or solver limit explicitly. Do not return invalid geometry.

## Reshape the prototype

Keep the existing prototype's renderer, label measurement, presets, and useful geometric predicates. Freeze its connector-safe shared-radius solver and tolerant relaxation as comparison baselines. Stop adding repairs directly to the relaxation algorithm.

Turn the prototype into an experiment harness around one pure solver interface:

```ts
type LayoutInput = {
  plates: readonly {
    angle: number;
    width: number;
    height: number;
  }[];
  ringRadius: number;
  clearances: {
    plateHorizontal: number;
    plateVertical: number;
    plateToRing: number;
    plateToConnector: number;
  };
};

type LayoutResult = {
  status: 'optimal' | 'feasible' | 'fallback' | 'oversized';
  plates: readonly {
    x: number;
    y: number;
    connectorContact: readonly [number, number];
  }[];
  diagnostics: LayoutDiagnostics;
};
```

The exact prototype types may differ, but every algorithm must receive the same measured input and return the same geometric information. The prototype may have several adapters behind this seam. Production will expose only the selected layout function, not a solver-selection option.

Add shared experiment infrastructure:

- An independent validator that does not reuse a solver's feasibility bookkeeping.
- One metric calculator used for every result.
- Side-by-side rendering at the same scale. Do not overlay every algorithm by default.
- A deterministic batch runner over a versioned corpus.
- A blind comparison mode that hides the algorithm names until a choice is recorded.
- A result view with the full input, output, constraint failures, quality metrics, search work, and solver status.
- Copyable or downloadable batch results for the final decision record. The prototype itself does not need persistence.

The prototype is experimental code. Do not add production abstractions or a production test suite to it. Automated tests belong to the selected production module after the experiment answers its question.

## Build the corpus

Run all algorithms against the same measured boxes. Include fixed cases for:

- Evenly spaced menus with 4, 8, 12, 16, and the intended maximum number of items.
- Realistic short and long command labels.
- Uniform widths, alternating widths, one extreme width, and strongly asymmetric widths.
- Symmetric menus whose results should preserve reflection or rotational symmetry.
- Manual and tightly clustered item angles.
- Items on both sides of the zero-degree boundary.
- Existing presets that expose plate, ring, and connector conflicts.
- Deliberately oversized layouts.

Add seeded generated cases that vary item count, angle gaps, plate widths, and plate heights inside supported ranges. Keep the seed and generated inputs in the batch report so any failure can be reproduced.

## Compare a small algorithm ladder

Implement and compare these algorithms in order:

1. The connector-safe shared-radius solver. This is the fast correctness and size baseline.
2. The existing tolerant relaxation. This is a heuristic visual baseline, not the expected production choice.
3. Finite candidate positions with exact global branch-and-bound. This is the main candidate.
4. The same global solver with adaptive candidate refinement.
5. Optional continuous polishing inside the chosen feasible arrangement, only if candidate spacing creates visible grid artifacts.

Do not start with global nonlinear optimization, force simulation, or simulated annealing. Add another family only when the first comparison leaves a specific question unanswered.

### Global candidate solver

Generate a finite set of plate positions for each item. Each candidate fixes the plate box, connector contact on the item's ray, connector segment, contact radius, and tangential displacement.

Candidate sets are search domains, not independent layouts. Precompute every unary invalid candidate and every pairwise plate, connector, clearance, or cyclic-order conflict. Select the complete vector of plate candidates jointly.

Start with symmetric samples of origin-facing edge contacts and radial positions. Use exact integer scores and a fixed candidate order. Seed the search with the connector-safe shared-radius result. Use conflict bitsets, remove dominated candidates, propagate empty and singleton domains, and branch on the item with the fewest compatible candidates.

Solve the objectives one at a time, fixing each previous result:

1. Minimize the maximum connector-contact radius.
2. Minimize total connector-contact radius.
3. Minimize maximum, then total, tangential displacement from the ideal anchor.
4. Maximize the minimum whitespace between cyclic neighbors.
5. Minimize variation between neighbor gaps, with symmetry error considered first for symmetric input.
6. Choose the canonical candidate vector as the final tie-break.

Also test a presentation policy that allows the primary radius to remain within a small tolerance of its optimum before optimizing anchor displacement and distribution. This comparison will show whether conceding a few pixels gives a visibly better result.

### Adaptive refinement

Refine candidates around the chosen positions and nearby conflict events. Repeat until halving the sampling interval no longer changes the selected layout or its primary measurements by a meaningful amount.

An optimal search result proves optimality only within the current candidate sets. Record the sampling resolution and whether refinement converged; do not describe it as a continuous global optimum.

### Optional continuous polish

If candidate quantization remains visible, freeze the chosen contact edges, cyclic order, and pairwise separation sides. Optimize radial and tangential coordinates only inside that feasible arrangement. Accept changes only when they preserve every earlier objective and pass the independent validator. Fall back to the exact candidate result if validation fails.

## Evaluate each result

Apply evaluation in three layers.

### Correctness

Disqualify a result when:

- plates overlap each other or the protected ring;
- a connector crosses another plate or connector;
- a connector does not terminate on its own plate;
- a plate intersects another item's connector;
- cyclic order changes;
- required clearances fail;
- any coordinate is not finite; or
- repeated solves with the same input differ.

Constraint failures are pass or fail. Do not average them into a quality score.

### Optimization and cost

Record, per case and in aggregate:

- maximum connector-contact radius;
- regret against the best result found for that case;
- mean and total connector length;
- maximum and total tangential displacement;
- minimum neighbor whitespace and neighbor-gap variation;
- symmetry error for symmetric fixtures;
- geometric near-edge extent and full outer extent;
- candidate count, conflict count, and explored search nodes;
- whether the result is proven optimal, a validated incumbent, or a fallback;
- creation time at the median, 95th percentile, and worst case; and
- whether doubling candidate resolution materially changes the result.

Use a deterministic search-work budget in production if a limit is needed. Do not stop based on wall-clock time because that can change the selected layout between runs. Return only a validated incumbent, seeded by the shared-radius baseline, when the budget ends.

### Appearance and use

Compare valid layouts in blind pairs at equal or nearly equal connector-contact extent. Record which layout makes associations clearer and which looks better distributed. Include a small label-finding task when possible and record time and association errors.

Do not invent one weighted beauty score. A secondary objective earns a permanent place only when it improves preference or label finding without weakening association.

## Production algorithm

Implement this sequence:

1. Find a valid shared-radius layout with a one-pixel scan.
2. At decreasing step sizes, try moving each plate inward, clockwise, and counterclockwise inside its association sector.
3. Accept a move only when the complete layout remains valid and its ordered quality measures improve.
4. Return the shared-radius layout when no greedy move improves it.
5. Report an oversized result instead of returning invalid geometry.

Do not ship candidate generation, branch-and-bound search, adaptive refinement, global-optimality statuses, search diagnostics, the four-pixel tolerance policy, or continuous polishing.

Count implementation cost as shipped non-test lines, geometric predicates and duplicated checks, tunable constants, solver states, and failure paths. Target roughly 200–300 lines for the production geometry module. Treat designs above about 400 lines as exceptions that need strong visual evidence, not as the default price of layout.

Use roughly 50 ms at the 95th percentile as the production solver budget. Measure the selected solver alone in a production-shaped build on representative hardware and at the intended maximum item count. Record worst-case timings as diagnostics, but keep deterministic work limits rather than wall-clock cutoffs so repeated inputs keep producing the same layout.

## Implement the selected module

Move only the winning geometry into a deep module such as `src/layout/label-layout.ts`. Its interface accepts fixed angles, measured plate dimensions, ring geometry, and clearances, then returns plate positions and connector contacts. It must not read the document, measure elements, or know how the result is rendered.

The menu renderer will act as a small synchronous adapter:

1. Create the label elements.
2. Measure every final plate once.
3. Call the layout module once.
4. Apply the returned plate positions and connector geometry.
5. Leave the layout unchanged until the menu is removed.

If the production benchmark misses the performance gate, replace steps 3 and 4 with worker communication and add the ready, `start`, and not-ready interface described above.

Document that callers must create the menu after the intended fonts and styles are available. A caller that changes them must recreate the menu.

Test the production module through its public interface with:

- the fixed corpus;
- seeded property tests over supported dimensions and angles;
- explicit hard-constraint assertions for every result;
- determinism tests;
- cases where greedy compaction must remain a no-op and cases where it must improve the shared-radius layout;
- renderer integration tests using measured elements; and
- selected browser screenshots for realistic menus.

## Close issue #267

Close #267 only after all of the following are complete:

- The issue describes the one-time static layout contract.
- The `prototype/label-solver` branch remains available as the primary experimental evidence.
- A decision record contains the corpus, measurements, visual comparisons, and rejected alternatives.
- The chosen algorithm, guarantees, move schedule, fallback, oversized-layout behavior, and performance gate are documented.
- The production module and renderer integration are merged with automated tests.
- The production-shaped benchmark passes, or the worker and its complete asynchronous lifecycle are implemented.
- The implementation pull request links to and closes #267.

The final work leaves three artifacts: the throwaway prototype branch, a durable experiment and decision record, and the production layout module.
