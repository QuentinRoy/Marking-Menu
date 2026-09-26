import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { paths } from './paths.ts';
import { startServer } from './server.ts';

const { values } = parseArgs({
  options: {
    database: { type: 'string', default: paths.database },
    port: { type: 'string', default: '8080' },
  },
});

await mkdir(path.dirname(values.database), { recursive: true });
const server = await startServer({
  databasePath: values.database,
  port: Number(values.port),
  staticDirectory: paths.build,
});

const { port } = new URL(server.url);
const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((entry) => entry?.family === 'IPv4' && !entry.internal)
  .map((entry) => `http://${entry?.address}:${port}`);
console.log(`Logging to ${values.database}`);
console.log(
  `Open on the tablet: ${addresses.length > 0 ? addresses.join(', ') : server.url}`,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close();
  });
}
