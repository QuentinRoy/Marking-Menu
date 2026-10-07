# Touch stroke collector

This workspace records the `touch-v1` stroke corpus on a tablet. It lives on a temporary collection branch, never on `main`. Tag the revision you record with, since the corpus manifest cites it.

A laptop runs a [Lightmill](https://github.com/QuentinRoy/lightmill-js) log server and serves the page. The tablet opens the page over plain HTTP on the same network. Every trial goes to SQLite on the laptop, and a run that stops (a reload, a crash, a laptop restart) picks up after the last saved trial.

## Record a session

On the laptop, from this directory:

```sh
yarn serve
```

This builds the page and starts the server on port 8080. It prints the address to open on the tablet. The database is `data/touch-v1.sqlite`. The first start creates a session key beside it. Keep the same database and key on the laptop so the tablet can resume after a server restart. Use the same browser on the tablet throughout collection.

If a database from an older Lightmill release already exists, back it up and migrate it before starting the server:

```sh
yarn migrate
```

Migration backs up the existing database and its session key first. The server refuses an outdated database rather than changing it during startup.

On the tablet, enter the session number and the device model, then start. If a session is unfinished, the page offers to resume it instead.

Record sessions 1 through 4 across at least two different days. Sessions 1 through 3 are for tuning; keep session 4 held out until the final benchmark. Each session has one shuffled block for every breadth and depth: 12 blocks, with three unrecorded warm-ups per block. The four sessions produce 1,040 recorded strokes: ten per direction at depth 1 and 80 per cell at depths 2 and 3. Keep every recorded attempt, including rejected and unsure strokes. Only accidental touches shorter than 12 CSS pixels are logged as discarded.

Keep the tablet in portrait, flat on a table, and draw with your dominant index finger. The page shows the target above the drawing area. Draw one continuous mark without pausing for a menu, then use the fitted overlay to label the attempt. Nothing recognizes the mark during collection.

After each session, back up the database:

```sh
yarn backup
```

The copy lands in `data/backups/`, alongside a copy of the session key. It's safe to run while the server is running. Keep both files if you move or restore the database.

## Export the corpus

Commit and tag the collector revision used for recording with a `touch-collector-*` tag. The export refuses a dirty collector tree or a revision without that tag. Name the held-out sessions:

```sh
yarn export --held-out 4
```

This writes `manifest.json`, `trials.csv`, and `events.csv` to `data/corpus/`, one row per trial and one per pointer event. It exports completed sessions only and lists any it skips.

Copy the exported files to `corpus/touch-v1/` on the branch where the corpus will be published. Keep that directory unchanged after it is merged. The manifest identifies the collector revision and archival tag used to record the strokes.

## Develop

Run `yarn serve:only` for the server and `yarn dev` for the page with hot reload. The development server forwards `/api` to port 8080.

## Lightmill setup notes

- The collector uses Lightmill 5 for logging and Lightmill 4 for the React timeline. These versions support Node 26 and React 19.2.
- `server/serve.ts` mounts the Lightmill API and the page on one origin. The same-site cookie works over local HTTP.
- The server stores participant sessions in SQLite and signs the tablet cookie with `data/touch-v1.sqlite.session-key`. A participant session can resume its own run after a server restart. A different browser cannot take over that run.
- Lightmill requires a host password. The collector creates one only in server memory and does not offer host login; backup and export use the database directly. Record on a network you trust.
- A stalled log keeps the run in memory while the page is open. Try saving again before reloading; download the unsaved logs if it cannot recover.
