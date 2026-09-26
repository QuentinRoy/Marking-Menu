import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';

// SQLite's online backup copies a consistent snapshot, even while the server
// is writing, which copying the file would not.
export async function backupDatabase(
  databasePath: string,
  directory: string,
  now = new Date(),
): Promise<string> {
  await mkdir(directory, { recursive: true });
  const stamp = now.toISOString().replaceAll(':', '-');
  const destination = path.join(
    directory,
    `${path.basename(databasePath, '.sqlite')}-${stamp}.sqlite`,
  );
  const database = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    await database.backup(destination);
  } finally {
    database.close();
  }

  return destination;
}
