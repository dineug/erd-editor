import type { FilePayload } from './AppPage';

export type BackupEntry = {
  name: string;
  updateAt: number;
  value?: string;
};

/**
 * A backup file in the shape the app exports, which is the one way to seed
 * schemas last edited at a chosen time: an import keeps the times it is given.
 */
export function backupFile(
  entries: BackupEntry[],
  fileName = 'backup.json'
): FilePayload {
  const backup = {
    format: 'erd-editor-app-backup',
    version: 1,
    exportedAt: Date.now(),
    schemas: entries.map(({ name, updateAt, value = '' }) => ({
      name,
      value,
      createAt: updateAt,
      updateAt,
    })),
  };

  return {
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  };
}

/** Local noon some calendar days before now, well clear of either midnight. */
export function daysAgo(days: number, now: Date) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
    12
  ).getTime();
}

/**
 * The sidebar group of a schema last edited that many calendar days ago, worked
 * out here with Date rather than the app's luxon, so the two check each other.
 */
export function dateGroupLabel(days: number, now: Date) {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'Previous 7 Days';
  if (days <= 30) return 'Previous 30 Days';

  const date = new Date(daysAgo(days, now));
  return date.getFullYear() === now.getFullYear()
    ? date.toLocaleString('en', { month: 'long' })
    : String(date.getFullYear());
}
