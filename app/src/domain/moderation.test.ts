import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_SQUEEZED, BLOCK_SUBSTR, BLOCK_WORDS, nameProblem, RESERVED_HANDLES } from './moderation';

const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261116000000_moderation.sql'), 'utf8');
const sqlArray = (name: string) => {
  const m = sql.match(new RegExp(`${name} text\\[\\] := array\\[([\\s\\S]*?)\\];`));
  return [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

describe('name moderation', () => {
  it('uses exactly the same lists as the database', () => {
    expect(sqlArray('block_substr')).toEqual(BLOCK_SUBSTR);
    expect(sqlArray('block_squeezed')).toEqual(BLOCK_SQUEEZED);
    expect(sqlArray('block_words')).toEqual(BLOCK_WORDS);
    expect(sqlArray('reserved_handles')).toEqual(RESERVED_HANDLES);
  });

  it('blocks offensive words, including disguised ones', () => {
    for (const bad of ['fuckboy', 'f_u_c_k', 'sh1tlord', 'fuuuuck_you', 'B!TCH', 'big_dick', 'Nazi Hunter', 'chutiya99', 'pu55y', 'kkk']) {
      expect(nameProblem(bad), bad).not.toBeNull();
    }
  });

  it('reserves staff-like handles', () => {
    expect(nameProblem('admin', 'handle')).toMatch(/reserved/);
    expect(nameProblem('support_1', 'handle')).toMatch(/reserved/);
    expect(nameProblem('admin', 'name')).toBeNull();
  });

  it('lets ordinary names through', () => {
    for (const ok of ['Nazia', 'Dickson', 'Assassin', 'classic_hunter', 'Sussex', 'peacock', 'Cocktail Ninja', 'title_holder', 'Niger', 'Hancock', 'Abhay Kabdwal', 'shadow_monarch']) {
      expect(nameProblem(ok), ok).toBeNull();
    }
  });

  it('checks bios word by word, not as one string', () => {
    expect(nameProblem('I train every day', 'text')).toBeNull();
    expect(nameProblem('total ass', 'text')).not.toBeNull();
  });
});
