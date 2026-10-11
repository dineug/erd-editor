import { DateTime } from 'luxon';

import { sourceI18n } from '@/i18n/source';
import type { I18n } from '@/i18n/translate';

type ListEntity = {
  name: string;
  updateAt: number;
};

export type SchemaGroup<T extends ListEntity> = {
  label: string;
  entities: T[];
};

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
 * carries, a month named in the reader's language. A time ahead of now, from a
 * skewed clock or a tick not yet taken, still reads as Today.
 */
export function toDateGroupLabel(
  timestamp: number,
  now: DateTime,
  i18n: I18n = sourceI18n
): string {
  const date = DateTime.fromMillis(timestamp, {
    zone: now.zone,
    locale: i18n.locale,
  });
  const days = Math.round(
    now.startOf('day').diff(date.startOf('day'), 'days').days
  );

  if (days <= 0) return i18n.t('time.today');
  if (days === 1) return i18n.t('time.yesterday');
  if (days <= 7) return i18n.t('time.previous7Days');
  if (days <= 30) return i18n.t('time.previous30Days');
  return date.year === now.year ? date.toFormat('LLLL') : String(date.year);
}

/** Sorts newest first and splits the list into date groups, leaving out empty ones. */
export function groupSchemasByDate<T extends ListEntity>(
  entities: T[],
  now: DateTime,
  i18n: I18n = sourceI18n
): Array<SchemaGroup<T>> {
  const groups = new Map<string, T[]>();

  for (const entity of sortSchemaEntities(entities)) {
    const label = toDateGroupLabel(entity.updateAt, now, i18n);
    const group = groups.get(label);
    group ? group.push(entity) : groups.set(label, [entity]);
  }

  return Array.from(groups, ([label, entities]) => ({ label, entities }));
}

/** How long ago a timestamp was, in the reader's language; anything under a minute is just now. */
export function formatRelativeTime(
  timestamp: number,
  now: DateTime,
  i18n: I18n = sourceI18n
): string {
  if (now.toMillis() - timestamp < MINUTE) return i18n.t('time.justNow');

  return (
    DateTime.fromMillis(timestamp, { zone: now.zone }).toRelative({
      base: now,
      locale: i18n.locale,
    }) ?? ''
  );
}
