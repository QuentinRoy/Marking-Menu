## Agent skills

### Issue tracker

Issues tracked in GitHub Issues (QuentinRoy/Marking-Menu) via `gh`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Prose

Use /prose when writing code comments, commit messages, pull requests, READMEs, documentation, or changesets. Keep prose clear, precise, and as concise as possible.

### Changesets

Use /changeset when writing a changeset.

## Code

### Comments

Use comments to explain why code is written a certain way, not what it does. Only comment when the code itself isn't clear enough.

### Type assertions

Enforce invariants in code: narrow at runtime and throw (`instanceof` with a `TypeError`), or reshape the types so the invariant holds by construction (two nullables always set together become one nullable object). Keep an `as` only when it is the cleanest option, with a comment saying why.

### Tests

Acquire setup and teardown with `using` inside the test that needs it: a factory returns an object with `[Symbol.dispose]()`, and objects that already have one (such as the controller) are acquired directly. This replaces `beforeEach`/`afterEach`.

## Finishing

Before handing off, run `yarn format`, `yarn lint`, `yarn typecheck`, and `yarn test`. A pull request that implements an issue says `Fixes #N` in its body. Leave merging to the maintainer.
