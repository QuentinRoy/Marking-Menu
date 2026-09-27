import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { LogServer, SQLiteDataStore } from '@lightmill/log-server';
import express from 'express';
import { experimentName } from '../model.ts';

export type CollectorServer = AsyncDisposable & {
  readonly url: string;
  close(): Promise<void>;
};

export async function startServer({
  databasePath,
  port,
  host,
  staticDirectory,
}: {
  databasePath: string;
  port: number;
  host?: string;
  staticDirectory?: string;
}): Promise<CollectorServer> {
  const store = new SQLiteDataStore(databasePath);
  // Migrations are idempotent, so this also creates a missing database.
  await store.migrateDatabase();
  const experiments = await store.getExperiments({ experimentName });
  if (experiments.length === 0) {
    await store.addExperiment({ experimentName });
  }

  const app = express();
  app.use(
    '/api',
    LogServer({
      dataStore: store,
      // Sessions live in memory and die with the server anyway. The collector
      // recreates its host session after a restart.
      sessionKeys: [randomBytes(32).toString('hex')],
      // The tablet reaches the laptop over plain HTTP, where express-session
      // won't send the secure cookie that cross-origin mode requires. Serving
      // the page from the same origin turns that off.
      allowCrossOrigin: false,
      baseUrl: '/api',
    }).middleware,
  );
  if (staticDirectory !== undefined) {
    app.use(express.static(staticDirectory));
  }

  const server = await new Promise<ReturnType<typeof app.listen>>(
    (resolve, reject) => {
      const listening = app.listen(port, host ?? '0.0.0.0', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(listening);
        }
      });
    },
  );
  const address = server.address();
  // eslint-disable-next-line unicorn/no-null -- What `address()` returns.
  if (address === null || typeof address === 'string') {
    throw new TypeError('The server is not listening on a TCP port.');
  }

  const close = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
      server.closeAllConnections();
    });
    await store.close();
  };

  return {
    url: `http://localhost:${(address satisfies AddressInfo).port}`,
    close,
    [Symbol.asyncDispose]: close,
  };
}
