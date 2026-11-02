import { describe, expect, it } from 'vitest';
import { achievements } from './achievements';
import { computeLedger } from './ledger';
import { logsFrom } from './testUtils';
import { addDays } from './dates';

const list = (logs: ReturnType<typeof logsFrom>, today: string) => achievements(computeLedger(logs, [], { name: 'A' }, today), logs, [], today);

describe('achievements', () => {
  it('always offers the current rank', () => {
    expect(list({}, '2026-11-02').map((a) => a.kind)).toEqual(['rank']);
  });

  it('picks the highest streak and milestone reached', () => {
    const spec = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [addDays('2026-10-24', i), 'x' as const]));
    const keys = list(logsFrom({ ...spec, '2026-11-01': 'x', '2026-11-02': 'x' }), '2026-11-02').map((a) => a.key);
    expect(keys).toContain('streak:7');
    expect(keys).toContain('cleared:10');
    expect(keys).toContain('quest:2026-11-02');
  });
});
