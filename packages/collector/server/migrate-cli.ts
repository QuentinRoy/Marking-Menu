import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SQLiteDataStore } from '@lightmill/log-server';
import { backupDatabase } from './backup.ts';
import { paths } from './paths.ts';

const { values } = parseArgs({
  options: {
    database: { type: 'string', default: paths.database },
  },
});

await mkdir(path.dirname(values.database), { recursive: true });
if (existsSync(values.database)) {
  const backup = await backupDatabase(
    values.database,
    path.join(path.dirname(values.database), 'backups'),
  );
  console.log(`Backed up to ${backup}`);
}

await SQLiteDataStore.migrateDatabase(values.database);
console.log(`Database ready at ${values.database}`);
