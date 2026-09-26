# Touch stroke collector

This workspace records the `touch-v1` stroke corpus on a tablet. It lives on a temporary collection branch, never on `main`. Tag the revision you record with, since the corpus manifest cites it.

A laptop runs a [Lightmill](https://github.com/QuentinRoy/lightmill-js) log server and serves the page. The tablet opens the page over plain HTTP on the same network. Every trial goes to SQLite on the laptop, and a run that stops (a reload, a crash, a laptop restart) picks up after the last saved trial.

## Record a session

On the laptop, from this directory:

```sh
yarn serve
```

This builds the page and starts the server on port 8080. It prints the address to open on the tablet. The database is `data/touch-v1.sqlite`.

On the tablet, enter the session number and the device model, then start. If a session is unfinished, the page offers to resume it instead.

After each session, back up the database:

```sh
yarn backup
```

The copy lands in `data/backups/`. It's safe to run while the server is running.

## Export the corpus

Commit the collector first: the export refuses a dirty tree, because the manifest cites the current revision. Name the held-out sessions:

```sh
yarn export --held-out 4
```

This writes `manifest.json`, `trials.csv`, and `events.csv` to `data/corpus/`, one row per trial and one per pointer event. It exports completed sessions only and lists any it skips.

## Develop

Run `yarn serve:only` for the server and `yarn dev` for the page with hot reload. The development server forwards `/api` to port 8080.

## Lightmill setup notes

- `@lightmill/log-server` pulls a package from the JSR registry, which `.yarnrc.yml` configures.
- Its `better-sqlite3` 11 does not build on Node 26, so the root `package.json` resolves it to version 13.
- Its `log-server` command does not start, so `server/serve.ts` runs `LogServer` directly.
- The page and API share one origin and send plain cookies, since browsers drop secure cookies over HTTP.
- The page opens a host session rather than a participant one. The server keeps sessions in memory, and only a host session can resume a run the server no longer remembers creating. Anyone on the network can reach the server, so record on a network you trust.
- `@lightmill/react-experiment` declares React 18 as a peer, so yarn warns about React 19. The tests in `__tests__/run.test.tsx` show it works.
