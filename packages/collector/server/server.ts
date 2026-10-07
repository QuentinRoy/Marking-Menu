import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { createLogServer, SQLiteDataStore } from '@lightmill/log-server';
import express from 'express';
import { experimentName } from '../model.ts';

export type CollectorServer = AsyncDisposable & {
  readonly url: string;
  close(): Promise<void>;
};

async function sessionKey(databasePath: string): Promise<string> {
  const keyPath = `${databasePath}.session-key`;
  if (!existsSync(keyPath)) {
    await writeFile(keyPath, randomBytes(32).toString('hex'), {
      flag: 'wx',
      mode: 0o600,
    });
  }

  const keyText = await readFile(keyPath, 'utf8');
  const key = keyText.trim();
  if (key.length < 32) {
    throw new Error(`Invalid session key in ${keyPath}.`);
  }

  return key;
}

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
  if (!existsSync(databasePath)) {
    await SQLiteDataStore.migrateDatabase(databasePath);
  }

  const store = await SQLiteDataStore.open(databasePath);
  const experiments = await store.getExperiments({ experimentName });
  if (experiments.length === 0) {
    await store.withTransaction(async (transaction) => {
      await transaction.addExperiment({ experimentName });
    });
  }

  const app = express();
  app.use(
    '/api',
    createLogServer({
      dataStore: store,
      sessionStore: store.getSessionStore(),
      sessionKeys: [await sessionKey(databasePath)],
      // Host access is unused by the collector, but Lightmill requires a
      // password so another device cannot open a host session.
      hostPassword: randomBytes(32).toString('hex'),
      sessionMaxAge: 30 * 24 * 60 * 60 * 1000,
      cookieSite: 'same-site',
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
