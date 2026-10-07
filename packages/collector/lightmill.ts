import { Client, type Logger as LightmillLogger } from '@lightmill/log-client';
import {
  experimentName,
  resumableLogTypes,
  runName,
  type CollectorLog,
} from './model.js';

const defaultApiRoot = '/api';

export function createClient(apiRoot = defaultApiRoot) {
  return new Client<CollectorLog>({ apiRoot });
}

export type Logger = LightmillLogger<CollectorLog>;

export type ResumableSession = {
  sessionNumber: number;
  // The Lightmill log number to resume after.
  after: { number: number };
  // Timeline tasks already completed.
  completedTasks: number;
};

export async function findResumableSessions(
  client: ReturnType<typeof createClient>,
): Promise<ResumableSession[]> {
  const runs = await client.getResumableRuns({
    experimentName,
    resumableLogTypes,
  });
  return runs.flatMap(({ run, toResumeAfter }) => {
    const match = /^session-(?<number>\d+)$/v.exec(run.name ?? '');
    if (!match) {
      return [];
    }

    return [
      {
        sessionNumber: Number(match.groups?.number),
        after: { number: toResumeAfter.number },
        completedTasks: toResumeAfter.log?.taskNumber ?? 0,
      },
    ];
  });
}

export async function startSession(
  client: ReturnType<typeof createClient>,
  sessionNumber: number,
  device: string,
): Promise<Logger> {
  const logger = await client.startRun({
    experimentName,
    runName: runName(sessionNumber),
  });
  await logger.addLog({
    type: 'session',
    taskNumber: 0,
    sessionNumber,
    device,
    userAgent: navigator.userAgent,
    devicePixelRatio: globalThis.devicePixelRatio,
  });
  return logger;
}

export async function resumeSession(
  client: ReturnType<typeof createClient>,
  session: ResumableSession,
): Promise<Logger> {
  return client.startRun({
    experimentName,
    runName: runName(session.sessionNumber),
    after: session.after,
  });
}
