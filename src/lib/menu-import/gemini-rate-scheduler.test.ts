import { describe, expect, it } from 'vitest';
import { createGeminiRateScheduler } from './gemini-rate-scheduler';
import { liveEvaluationCheckpointKey } from './live-evaluation-checkpoint';

describe('Gemini rate-aware scheduling', () => {
  it('limits concurrent starts and enforces the configured interval', async () => {
    let now = 0; const waits: number[] = []; let active = 0; let peak = 0;
    const scheduler = createGeminiRateScheduler({ concurrency: 1, minIntervalMs: 25, now: () => now, sleep: async (milliseconds) => { waits.push(milliseconds); now += milliseconds; } });
    const task = async () => { active += 1; peak = Math.max(peak, active); await Promise.resolve(); active -= 1; return now; };
    const result = await Promise.all([scheduler.schedule(task), scheduler.schedule(task), scheduler.schedule(task)]);
    expect(result).toHaveLength(3); expect(peak).toBe(1); expect(waits).toEqual([25, 25]);
  });

  it('isolates checkpoints by PDF, analyzer, model, prompt, and page', () => {
    const base = { pdfHash: 'pdf-a', analyzerVersion: 'menu-import-v4-visual', model: 'gemini-3.7-flash', promptVersion: 'visual-v1', page: 2 };
    expect(liveEvaluationCheckpointKey(base)).toBe(liveEvaluationCheckpointKey(base));
    expect(liveEvaluationCheckpointKey(base)).not.toBe(liveEvaluationCheckpointKey({ ...base, analyzerVersion: 'menu-import-v3-visual' }));
    expect(liveEvaluationCheckpointKey(base)).not.toBe(liveEvaluationCheckpointKey({ ...base, page: 3 }));
    expect(liveEvaluationCheckpointKey(base)).not.toBe(liveEvaluationCheckpointKey({ ...base, model: 'gemini-3.6-flash' }));
  });
});
