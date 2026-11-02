import Dexie, { type Table } from 'dexie';
import type { DailyLog, DateStr } from '../domain';

export interface MetaRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface LogRow {
  date: DateStr;
  log: DailyLog;
}

/** Progress photos never leave the device: not synced, not shared. */
export interface PhotoRow {
  id: string;
  blob: Blob;
  createdAt: string;
}

export class SystemDB extends Dexie {
  meta!: Table<MetaRow, string>;
  logs!: Table<LogRow, DateStr>;
  photos!: Table<PhotoRow, string>;

  constructor(name = 'system') {
    super(name);
    this.version(1).stores({ meta: 'key', logs: 'date', photos: 'id' });
  }
}

export const db = new SystemDB();
