import { describe, expect, it } from 'vitest';
import { MemoryAnalysisQuota, utcDayKey } from '../src/services/analysis-quota';

describe('MemoryAnalysisQuota', () => {
  it('allows analyses up to the daily limit', async () => {
    const quota = new MemoryAnalysisQuota(2);
    await expect(quota.consume('user-1')).resolves.toBe(true);
    await expect(quota.consume('user-1')).resolves.toBe(true);
    await expect(quota.consume('user-1')).resolves.toBe(false);
  });

  it('keeps separate counters per user', async () => {
    const quota = new MemoryAnalysisQuota(1);
    await expect(quota.consume('user-1')).resolves.toBe(true);
    await expect(quota.consume('user-2')).resolves.toBe(true);
    await expect(quota.consume('user-1')).resolves.toBe(false);
  });

  it('resets the counter on the next UTC day', async () => {
    let now = new Date('2026-11-27T23:00:00.000Z');
    const quota = new MemoryAnalysisQuota(1, () => now);
    await expect(quota.consume('user-1')).resolves.toBe(true);
    await expect(quota.consume('user-1')).resolves.toBe(false);
    now = new Date('2026-11-28T00:00:01.000Z');
    await expect(quota.consume('user-1')).resolves.toBe(true);
  });

  it('treats a zero limit as disabled', async () => {
    const quota = new MemoryAnalysisQuota(0);
    await expect(quota.consume('user-1')).resolves.toBe(true);
  });

  it('uses the UTC day as the quota key', () => {
    expect(utcDayKey(new Date('2026-11-27T23:59:59.000Z'))).toBe('2026-11-27');
  });
});
