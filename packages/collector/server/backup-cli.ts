import { parseArgs } from 'node:util';
import { backupDatabase } from './backup.ts';
import { paths } from './paths.ts';

const { values } = parseArgs({
  options: {
    database: { type: 'string', default: paths.database },
    output: { type: 'string', default: paths.backups },
  },
});

console.log(
  `Backed up to ${await backupDatabase(values.database, values.output)}`,
);
