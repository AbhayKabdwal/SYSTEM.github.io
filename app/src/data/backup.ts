import { z } from 'zod';
import type { DailyLog, Logs, Player, QuestTask, Template } from '../domain';

// Lenient where v1 was loose (numbers typed into inputs were stored as strings),
// strict about structure so a wrong file can't wipe data.
const numLike = z.union([z.number(), z.string()]);
const weights = z.record(z.string(), z.number()).optional();

const questTask = z.object({
  id: z.string().min(1),
  label: z.string(),
  target: z.coerce.number().positive(),
  unit: z.string(),
  muscles: weights,
});

const exercise = z.object({ id: z.string().min(1), name: z.string(), unit: z.string(), muscles: weights });

const template = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().default('#00c8ff'),
  exercises: z.array(exercise).default([]),
});

const set = z.object({ v: numLike.optional(), reps: numLike.optional(), seconds: numLike.optional() }).passthrough();

const log = z
  .object({
    questProgress: z.record(z.string(), numLike).optional(),
    recovery: z.object({ water: z.coerce.number().default(0), creatine: z.boolean().default(false) }).optional(),
    dailyQuest: z.object({ name: z.string(), tasks: z.array(questTask) }).optional(),
    penaltyAttempt: z.boolean().optional(),
    penaltyCleared: z.boolean().optional(),
    savedAt: z.string().optional(),
    photos: z.array(z.string().nullable()).optional(),
    photoIds: z.array(z.string().nullable()).optional(),
    templateId: z.string().optional(),
    exLogs: z.record(z.string(), z.object({ sets: z.array(set).optional() })).optional(),
    trainingSavedAt: z.string().optional(),
  })
  .passthrough();

const player = z
  .object({
    name: z.string().min(1).max(40),
    totalWorkouts: z.number().optional(),
    createdAt: z.string().optional(),
    waterTarget: z.number().optional(),
  })
  .passthrough();

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const backup = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string().optional(),
  player: player.nullable().optional(),
  templates: z.array(template).optional(),
  questPool: z.array(questTask).optional(),
  logs: z.record(dateKey, log).optional(),
  /** v2: photo id → JPEG data URL. Only present when the user opted to include photos. */
  photos: z.record(z.string(), z.string().startsWith('data:image/')).optional(),
});

export interface ParsedBackup {
  player: Player | null;
  templates?: Template[];
  questPool?: QuestTask[];
  logs: Logs;
  /** Photos to store: id → data URL. v1 inline photos are given fresh ids here. */
  photos: Record<string, string>;
}

export class BackupError extends Error {}

export function parseBackup(json: unknown, newId: () => string): ParsedBackup {
  const res = backup.safeParse(json);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new BackupError(`Not a SYSTEM backup (${issue?.path.join('.') || 'root'}: ${issue?.message})`);
  }
  const b = res.data;
  const photos: Record<string, string> = { ...(b.photos ?? {}) };
  const logs: Logs = {};
  for (const [date, raw] of Object.entries(b.logs ?? {})) {
    const { photos: inline, ...rest } = raw;
    const l = rest as DailyLog;
    if (inline?.some(Boolean)) {
      l.photoIds = inline.map((p) => {
        if (!p?.startsWith('data:image/')) return null;
        const id = newId();
        photos[id] = p;
        return id;
      });
    }
    logs[date] = l;
  }
  return {
    player: (b.player as Player | null | undefined) ?? null,
    templates: b.templates as Template[] | undefined,
    questPool: b.questPool as QuestTask[] | undefined,
    logs,
    photos,
  };
}

const stamp = (l: DailyLog) => l.trainingSavedAt && l.savedAt ? (l.trainingSavedAt > l.savedAt ? l.trainingSavedAt : l.savedAt) : l.trainingSavedAt ?? l.savedAt ?? '';

/** Per date, keep whichever side was saved most recently. Ties keep `ours`. */
export function mergeLogs(ours: Logs, theirs: Logs): Logs {
  const out: Logs = { ...ours };
  for (const [date, l] of Object.entries(theirs)) {
    const mine = out[date];
    if (!mine || stamp(l) > stamp(mine)) out[date] = l;
  }
  return out;
}

export interface BackupInput {
  player: Player | null;
  templates: Template[];
  questPool: QuestTask[];
  logs: Logs;
  photos?: Record<string, string>;
}

export function buildBackup(data: BackupInput) {
  return {
    version: 2 as const,
    exportedAt: new Date().toISOString(),
    player: data.player,
    templates: data.templates,
    questPool: data.questPool,
    logs: data.logs,
    ...(data.photos && Object.keys(data.photos).length ? { photos: data.photos } : {}),
  };
}
