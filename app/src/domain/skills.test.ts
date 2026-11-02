import { describe, expect, it } from 'vitest';
import { getSkillState, stageOptions, treeForExercise } from './skills';
import type { Logs, Template } from './types';

const tpl: Template = {
  id: 'tpl_skill',
  name: 'SKILL',
  color: '#fff',
  exercises: [{ id: 'e_planche', name: 'Planche Work', unit: 'stage' }],
};

const withSets = (sets: { v: string; seconds: number }[]): Logs => ({
  '2026-11-01': { templateId: 'tpl_skill', exLogs: { e_planche: { sets } } },
});

describe('getSkillState', () => {
  it('records the best hold per stage label', () => {
    const s = getSkillState(withSets([{ v: 'Frog Stand', seconds: 12 }, { v: 'Frog Stand', seconds: 31 }]), [tpl]);
    expect(s.best.frog_stand).toBe(31);
    expect(s.unlocked.frog_stand).toBe(true);
  });

  it('does not unlock a node whose prerequisite is locked', () => {
    const s = getSkillState(withSets([{ v: 'Tuck Planche', seconds: 60 }]), [tpl]);
    expect(s.unlocked.frog_stand).toBe(false);
    expect(s.unlocked.tuck_planche).toBe(false);
  });

  it('ignores non-stage exercises', () => {
    const kgTpl = { ...tpl, exercises: [{ id: 'e_planche', name: 'Bench', unit: 'kg' }] };
    expect(getSkillState(withSets([{ v: 'Frog Stand', seconds: 60 }]), [kgTpl]).best).toEqual({});
  });
});

describe('stage options', () => {
  it('picks the tree from the exercise name', () => {
    expect(treeForExercise({ id: 'x', name: 'Front Lever', unit: 'stage' }).id).toBe('front_lever');
    expect(treeForExercise({ id: 'x', name: 'Wall HSPU', unit: 'stage' }).id).toBe('handstand');
    expect(treeForExercise({ id: 'x', name: 'Anything', unit: 'stage' }).id).toBe('planche');
  });

  it('locks stages whose prerequisites are not met', () => {
    const opts = stageOptions(tpl.exercises[0]!, getSkillState({}, [tpl]));
    expect(opts[0]!.locked).toBe(false);
    expect(opts[1]!.locked).toBe(true);
  });
});
