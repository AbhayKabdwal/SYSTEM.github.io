import { SKILL_TREES } from './defaults';
import type { Exercise, Logs, SkillNode, SkillTree, Template } from './types';

export interface SkillState {
  /** Best hold/rep count per skill node id. */
  best: Record<string, number>;
  unlocked: Record<string, boolean>;
}

/** "Tuck Planche" -> "tuck_planche": stage sets store the node label, nodes are keyed by id. */
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

export function getSkillState(logs: Logs, templates: Template[], trees: SkillTree[] = SKILL_TREES): SkillState {
  const best: Record<string, number> = {};
  for (const log of Object.values(logs)) {
    const tpl = templates.find((t) => t.id === log.templateId);
    for (const ex of tpl?.exercises ?? []) {
      if (ex.unit !== 'stage') continue;
      for (const set of log.exLogs?.[ex.id]?.sets ?? []) {
        const key = slug(String(set.v ?? ''));
        if (!key) continue;
        best[key] = Math.max(best[key] ?? 0, Number(set.seconds ?? 0));
      }
    }
  }
  const unlocked: Record<string, boolean> = {};
  for (const tree of trees) {
    for (const node of tree.nodes) {
      const depsMet = (node.deps ?? []).every((d) => unlocked[d]);
      unlocked[node.id] = depsMet && (best[node.id] ?? 0) >= node.req;
    }
  }
  return { best, unlocked };
}

export function treeForExercise(ex: Exercise, trees: SkillTree[] = SKILL_TREES): SkillTree {
  const name = ex.name.toLowerCase();
  const byId = (id: string) => trees.find((t) => t.id === id)!;
  if (name.includes('lever')) return byId('front_lever');
  if (name.includes('handstand') || name.includes('hspu')) return byId('handstand');
  if (name.includes('muscle')) return byId('muscle_up');
  if (name.includes('pistol')) return byId('pistol');
  if (name.includes('l-sit') || name.includes('v-sit')) return byId('lsit');
  return byId('planche');
}

export function stageOptions(ex: Exercise, state: SkillState): (SkillNode & { locked: boolean })[] {
  return treeForExercise(ex).nodes.map((n) => ({
    ...n,
    locked: !(n.deps ?? []).every((d) => state.unlocked[d]),
  }));
}

/** Rep-based trees vs hold-time trees, for display. */
export function treeUnit(tree: SkillTree): 'reps' | 'sec' {
  return ['muscle_up', 'pistol', 'handstand'].includes(tree.id) ? 'reps' : 'sec';
}
