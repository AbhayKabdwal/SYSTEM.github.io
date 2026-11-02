import { describe, expect, it } from 'vitest';
import { achievements } from './achievements';
import { logsFrom } from './testUtils';

describe('achievements', () => {
  it('always offers the current rank', () => {
    expect(achievements({}, [], '2026-11-02').map((a) => a.kind)).toEqual(['rank']);
  });

  it('picks the highest streak and milestone reached', () => {
    const spec = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`2026-10-${String(25 + i).padStart(2, '0')}`, 'x' as const]));
    const keys = achievements(logsFrom({ ...spec, '2026-11-01': 'x', '2026-11-02': 'x' }), [], '2026-11-02').map((a) => a.key);
    expect(keys).toContain('streak:7');
    expect(keys).toContain('cleared:10');
    expect(keys).toContain('quest:2026-11-02');
  });
});
