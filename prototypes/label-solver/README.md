# Label layout prototype

This directory contains the throwaway experiments used to select a label layout algorithm for marking menus.

Open [`comparison.html`](comparison.html) directly in a browser. Its focused review first compares shared radius with greedy compaction, then greedy compaction with adaptive global search. No build or development server is required.

[`index.html`](index.html) preserves the earlier solver exploration as primary evidence. It is not the selected design.

The prototype does not contain production code. The review selected shared radius followed by greedy compaction: greedy clearly improved on shared radius, while adaptive global search did not clearly improve on greedy. The full result and remaining work are recorded in [`docs/research/issue-267-layout-experiment.md`](../../docs/research/issue-267-layout-experiment.md).
