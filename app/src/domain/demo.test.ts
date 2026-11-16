import { describe, expect, it } from 'vitest';
import { buildDemo } from './demo';
import { computeLedger } from './ledger';
import { DEFAULT_TEMPLATES } from './defaults';

const today = '2026-11-16';
const ledgerFor = (p: Parameters<typeof buildDemo>[0]) => {
  const { player, logs } = buildDemo(p, today);
  return computeLedger(logs, DEFAULT_TEMPLATES, player, today);
};

describe('test hunters', () => {
  it('max reaches level 100 and S-Rank through the normal rules', () => {
    const l = ledgerFor('max');
    expect(l.level).toBe(100);
    expect(l.rank).toBe('S');
    expect(l.jobReady).toBe(true);
    expect(l.levelNext).toBeNull();
  });

  it('job preset stops one level short of the Job Change', () => {
    expect(ledgerFor('job').level).toBe(39);
  });

  it('trial preset has the first rank-up trial waiting', () => {
    const l = ledgerFor('fresh_trial');
    expect(l.level).toBe(10);
    expect(l.trialReady).toBe(true);
    expect(l.rank).toBe('E');
  });
});
