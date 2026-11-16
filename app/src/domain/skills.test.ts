import { describe, expect, it } from 'vitest';
import { getSkillState, stageOptions, treeForExercise } from './skills';
import { SKILL_TREES } from './defaults';
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

describe('every tree can progress', () => {
  const tpls: Template[] = [
    {
      id: 'tpl_skills',
      name: 'SKILLS',
      color: '#fff',
      exercises: SKILL_TREES.map((t) => ({ id: `e_${t.id}`, name: { planche: 'Planche Progression', front_lever: 'Front Lever Progression', muscle_up: 'Muscle-up Progression', handstand: 'Handstand / HSPU Progression', pistol: 'Pistol Progression', lsit: 'L-Sit / V-Sit Progression' }[t.id]!, unit: 'stage' })),
    },
  ];

  it('unlocks each stage of each tree when its target is met, by label', () => {
    for (const tree of SKILL_TREES) {
      const sets = tree.nodes.map((n) => ({ v: n.label, seconds: n.req }));
      const logs: Logs = { '2026-11-01': { templateId: 'tpl_skills', exLogs: { [`e_${tree.id}`]: { sets } } } };
      const s = getSkillState(logs, tpls);
      for (const n of tree.nodes) expect(s.unlocked[n.id], `${tree.name}: ${n.label}`).toBe(true);
    }
  });

  it('credits shared labels to the right tree', () => {
    const logs: Logs = { '2026-11-01': { templateId: 'tpl_skills', exLogs: { e_front_lever: { sets: [{ v: 'Advanced Tuck', seconds: 25 }] } } } };
    const s = getSkillState(logs, tpls);
    expect(s.best.adv_tuck_lever).toBe(25);
    expect(s.best.advanced_tuck).toBeUndefined();
  });
});

