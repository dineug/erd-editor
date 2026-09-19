import { DateTime } from 'luxon';

/** How long a schema sits in the trash before it is deleted for good. */
export const TRASH_RETENTION_DAYS = 30;

/**
 * When a schema moved to the trash at deletedAt is due to go: 30 calendar days
 * on in the zone now carries, so a DST change in between moves it by no hour.
 */
function toDeletionTime(deletedAt: number, now: DateTime) {
  return DateTime.fromMillis(deletedAt, { zone: now.zone }).plus({
    days: TRASH_RETENTION_DAYS,
  });
}

/**
 * Whether a trashed schema is due for deletion. A schema outside the trash
 * never is, and one trashed ahead of now, by a skewed clock, waits its 30 days.
 */
export function isTrashExpired(
  deletedAt: number | null | undefined,
  now: DateTime
): boolean {
  if (typeof deletedAt !== 'number') return false;
  return toDeletionTime(deletedAt, now).toMillis() <= now.toMillis();
}

/**
 * Calendar days from now's day to the day a trashed schema goes, 0 once that
 * is today or past, as it is for one the next purge has yet to reach.
 */
export function trashDaysLeft(deletedAt: number, now: DateTime): number {
  const days = toDeletionTime(deletedAt, now)
    .startOf('day')
    .diff(now.startOf('day'), 'days').days;
  return Math.max(0, Math.round(days));
}

/** When a trashed schema goes, in English: deletes today, tomorrow or in 27 days. */
export function formatTrashDeletion(deletedAt: number, now: DateTime): string {
  const days = trashDaysLeft(deletedAt, now);

  if (days === 0) return 'deletes today';
  if (days === 1) return 'deletes tomorrow';
  return `deletes in ${days} days`;
}
