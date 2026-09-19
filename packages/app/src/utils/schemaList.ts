import { DateTime } from 'luxon';

type ListEntity = {
  name: string;
  updateAt: number;
};

export type SchemaGroup<T extends ListEntity> = {
  label: string;
  entities: T[];
};

const LOCALE = 'en';
const MINUTE = 60_000;

/** Newest edit first; equal times fall back to the name, ignoring case. */
export function compareSchemaEntities(a: ListEntity, b: ListEntity) {
  if (a.updateAt !== b.updateAt) return b.updateAt - a.updateAt;

  const nameA = a.name.toLowerCase();
  const nameB = b.name.toLowerCase();
  return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
}

export function sortSchemaEntities<T extends ListEntity>(entities: T[]): T[] {
  return [...entities].sort(compareSchemaEntities);
}

export function filterSchemasByName<T extends ListEntity>(
  entities: T[],
  query: string
): T[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return entities;

  return entities.filter(entity => entity.name.toLowerCase().includes(keyword));
}

/**
 * The group a timestamp falls in, counted in calendar days of the zone now
 * carries. A time ahead of now, from a skewed clock or a tick not yet taken,
 * still reads as Today.
 */
export function toDateGroupLabel(timestamp: number, now: DateTime): string {
  const date = DateTime.fromMillis(timestamp, {
    zone: now.zone,
    locale: LOCALE,
  });
  const days = Math.round(
    now.startOf('day').diff(date.startOf('day'), 'days').days
  );

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'Previous 7 Days';
  if (days <= 30) return 'Previous 30 Days';
  return date.year === now.year ? date.toFormat('LLLL') : String(date.year);
}

/** Sorts newest first and splits the list into date groups, leaving out empty ones. */
export function groupSchemasByDate<T extends ListEntity>(
  entities: T[],
  now: DateTime
): Array<SchemaGroup<T>> {
  const groups = new Map<string, T[]>();

  for (const entity of sortSchemaEntities(entities)) {
    const label = toDateGroupLabel(entity.updateAt, now);
    const group = groups.get(label);
    group ? group.push(entity) : groups.set(label, [entity]);
  }

  return Array.from(groups, ([label, entities]) => ({ label, entities }));
}

/** How long ago a timestamp was, in English; anything under a minute is just now. */
export function formatRelativeTime(timestamp: number, now: DateTime): string {
  if (now.toMillis() - timestamp < MINUTE) return 'just now';

  return (
    DateTime.fromMillis(timestamp, { zone: now.zone }).toRelative({
      base: now,
      locale: LOCALE,
    }) ?? ''
  );
}
