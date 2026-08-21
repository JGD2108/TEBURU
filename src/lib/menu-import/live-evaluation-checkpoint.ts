import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type LiveEvaluationCheckpoint = {
  key: string;
  pdfHash: string;
  analyzerVersion: string;
  model: string;
  promptVersion: string;
  page: number;
  completedAt: string;
  canonicalResult: unknown;
  lineage: unknown[];
};

export function liveEvaluationCheckpointKey(input: Pick<LiveEvaluationCheckpoint, 'pdfHash' | 'analyzerVersion' | 'model' | 'promptVersion' | 'page'>) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export async function readLiveEvaluationCheckpoints(path: string): Promise<LiveEvaluationCheckpoint[]> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
    return Array.isArray(value) ? value.filter((entry): entry is LiveEvaluationCheckpoint => Boolean(entry && typeof entry === 'object' && typeof (entry as LiveEvaluationCheckpoint).key === 'string')) : [];
  } catch { return []; }
}

export async function writeLiveEvaluationCheckpoint(path: string, checkpoint: LiveEvaluationCheckpoint) {
  await mkdir(dirname(path), { recursive: true });
  const existing = await readLiveEvaluationCheckpoints(path);
  const next = [...existing.filter((entry) => entry.key !== checkpoint.key), checkpoint].sort((left, right) => left.page - right.page);
  await writeFile(path, JSON.stringify(next), 'utf8');
}
