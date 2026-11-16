import { SKILL_TREES } from './defaults';
import type { Exercise, Logs, SkillNode, SkillTree, Template } from './types';

export interface SkillState {
  /** Best hold/rep count per skill node id. */
  best: Record<string, number>;
  unlocked: Record<string, boolean>;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Stage sets store the stage's label ("Wall Handstand"). Resolve it inside the
 * exercise's own tree, so labels shared between trees ("Advanced Tuck" exists in
 * both Planche and Front Lever) credit the right one. An id is accepted too, for
 * older logs that stored those.
 */
function nodeFor(tree: SkillTree, value: unknown): SkillNode | undefined {
  const v = norm(String(value ?? ''));
  if (!v) return undefined;
  return tree.nodes.find((n) => norm(n.label) === v || norm(n.id) === v);
}

export function getSkillState(logs: Logs, templates: Template[], trees: SkillTree[] = SKILL_TREES): SkillState {
  const best: Record<string, number> = {};
  for (const log of Object.values(logs)) {
    const tpl = templates.find((t) => t.id === log.templateId);
    for (const ex of tpl?.exercises ?? []) {
      if (ex.unit !== 'stage') continue;
      const tree = treeForExercise(ex, trees);
      for (const set of log.exLogs?.[ex.id]?.sets ?? []) {
        const node = nodeFor(tree, set.v);
        if (!node) continue;
        best[node.id] = Math.max(best[node.id] ?? 0, Number(set.seconds ?? 0) || 0);
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
