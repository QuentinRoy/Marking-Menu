# Safe pull-request-label baseline updates

Research for [Research safe pull-request-label baseline updates](https://github.com/QuentinRoy/Marking-Menu/issues/316), 2026-09-11.

## Recommendation

Use a separate, privileged **coordinator** workflow triggered by
`pull_request_target` with `types: [labeled]`. It must run only when both of
these conditions hold:

```yaml
github.event.label.name == 'update screenshots' &&
github.event.pull_request.head.repo.full_name == github.repository
```

This makes an explicit `update screenshots` label a maintainer-facing command
for **same-repository** pull requests only. The coordinator definition comes
from the default branch, so a PR cannot change the code that grants its write
token. It may then check out the exact head SHA, rebuild the fixture, and run
only `chromium-visual` with `--update-snapshots=changed` in the existing
`mcr.microsoft.com/playwright:v1.63.0-noble` container.

Do not use this workflow to check out, build, test, or push a fork PR. Fork
`pull_request` workflows have a read-only token (and no secrets), so they
cannot normally push to a contributor branch; that is intentional. Forks and
Dependabot PRs should retain ordinary compare-only PR CI. The coordinator can
leave a fixed comment explaining that a maintainer must apply the update from a
trusted same-repository branch instead.

The existing word-cloud label workflow is a useful interaction model (label,
regenerate in the pinned image, comment, then consume the label), but it needs
the same-repository gate and a narrower staging rule here. In particular,
`git add -A` must not be used in a write-token workflow that executes PR code.

## Required workflow shape

1. Add a new default-branch workflow using `pull_request_target` and the
   `labeled` activity type. `labeled` is not a default activity type, so name
   it explicitly. Use a per-PR concurrency group.
2. Make the update job's gate the label **and** the same-repository predicate
   above. It should receive only `contents: write`, `pull-requests: write`,
   and `issues: write`; declaring these makes every other permission `none`.
   Keep the normal PR verification workflow at `contents: read`.
3. In that gated job, check out
   `${{ github.event.pull_request.head.sha }}`, configure the bot identity,
   build the fixture, then run:

   ```sh
   yarn e2e:test --project=chromium-visual --update-snapshots=changed
   ```

   (The implementation ticket should expose the equivalent existing package
   script if one is preferred.) Do not execute any fork checkout under this
   trigger.
4. Stage only the exact, repository-defined visual-baseline path—for example,
   `e2e/tests/visual.spec.ts-snapshots/`. Before committing, inspect
   `git diff --cached --name-only` and fail unless every staged path is below
   that root and has the expected image extension. Commit from that index only;
   never use `git add -A` or a broad status-derived path list. An empty index
   is a successful no-change outcome.
5. Push the resulting commit only to the eligible same-repository head branch.
   Post a fixed-format success/no-change/failure comment to the PR. Remove
   `update screenshots` only after the update, allowlisted staging, commit
   (when needed), and push have succeeded; retain it on failure for diagnosis
   and a deliberate retry. Do not interpolate PR title, body, or branch name
   into shell source—pass fixed values and event fields as quoted action inputs
   or environment values.
6. Pin every action to a reviewed full commit SHA, as the repository's current
   workflows do. Prefer direct Git and GitHub REST API calls (or already
   approved, SHA-pinned actions) over adding an unpinned automation action.

## Why this is safe and reproducible

`pull_request_target` intentionally runs from the base repository's default
branch and can hold elevated credentials. GitHub explicitly warns that checking
out or executing untrusted PR code under it is a "pwn request" risk. The
same-repository predicate is therefore a required trust boundary, not merely a
convenience check. It also means a workflow change in a PR cannot take effect
until the workflow has first landed on the default branch.

GitHub reduces `GITHUB_TOKEN` write permissions to read-only for fork PRs
(unless an administrator deliberately enables write tokens), and Dependabot
runs receive those fork restrictions too. Supporting automatic writes to forks
would require a separate reviewer-mediated artifact/apply design; it is out of
scope for this label command.

Playwright says screenshots vary across platforms and rendering environments,
and asks projects to commit and review golden files. The repository's pinned
Linux image is therefore the sole baseline producer as well as the verifier.
Playwright documents both `--update-snapshots` and project selection; its image
documentation recommends a version-pinned tag and says the image and project
Playwright versions must match. Keep the existing v1.63.0 package/image pairing
in lockstep.

## Sources

- [GitHub: events that trigger workflows — `pull_request` and `pull_request_target`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target)
- [GitHub: securely using `pull_request_target`](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
- [GitHub: secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub: workflow `permissions` and fork-token restrictions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#changing-the-permissions-in-a-forked-repository)
- [GitHub: use `GITHUB_TOKEN` with least privilege](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token#modifying-the-permissions-for-the-github_token)
- [GitHub: triggering a workflow from a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run#triggering-a-workflow-from-a-workflow)
- [Playwright: visual comparisons](https://playwright.dev/docs/test-snapshots)
- [Playwright: command-line options](https://playwright.dev/docs/test-cli)
- [Playwright: Docker image tags and version matching](https://playwright.dev/docs/docker#image-tags)
