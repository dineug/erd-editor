import { DateTime } from 'luxon';
import { describe, expect, it } from 'vite-plus/test';

import {
  compareSchemaEntities,
  filterSchemasByName,
  formatRelativeTime,
  groupSchemasByDate,
  sortSchemaEntities,
  toDateGroupLabel,
} from '@/utils/schemaList';

const SEOUL = 'Asia/Seoul';
const NEW_YORK = 'America/New_York';
const BERLIN = 'Europe/Berlin';

const at = (iso: string, zone = SEOUL) => DateTime.fromISO(iso, { zone });
const ms = (iso: string, zone = SEOUL) => at(iso, zone).toMillis();
const entity = (name: string, updateAt: number) => ({ name, updateAt });

describe('compareSchemaEntities', () => {
  it('puts the newest edit first', () => {
    expect(
      sortSchemaEntities([entity('a', 1), entity('b', 3), entity('c', 2)])
    ).toEqual([entity('b', 3), entity('c', 2), entity('a', 1)]);
  });

  it('breaks a tie by name, ignoring case', () => {
    expect(
      sortSchemaEntities([
        entity('beta', 5),
        entity('Alpha', 5),
        entity('alpha', 5),
      ])
    ).toEqual([entity('Alpha', 5), entity('alpha', 5), entity('beta', 5)]);
    expect(compareSchemaEntities(entity('b', 5), entity('a', 5))).toBe(1);
  });

  it('leaves the input array alone', () => {
    const input = [entity('a', 1), entity('b', 2)];

    sortSchemaEntities(input);

    expect(input).toEqual([entity('a', 1), entity('b', 2)]);
  });
});

describe('filterSchemasByName', () => {
  const list = [entity('Orders', 1), entity('users', 2), entity('Blog', 3)];

  it('matches any part of the name, ignoring case', () => {
    expect(filterSchemasByName(list, 'ER')).toEqual([
      entity('Orders', 1),
      entity('users', 2),
    ]);
  });

  it('ignores surrounding whitespace', () => {
    expect(filterSchemasByName(list, '  blog ')).toEqual([entity('Blog', 3)]);
  });

  it('returns everything for an empty query', () => {
    expect(filterSchemasByName(list, '')).toBe(list);
    expect(filterSchemasByName(list, '   ')).toBe(list);
  });

  it('returns nothing when no name matches', () => {
    expect(filterSchemasByName(list, 'invoice')).toEqual([]);
  });
});

describe('toDateGroupLabel', () => {
  const now = at('2026-09-19T12:00');
  const label = (iso: string) => toDateGroupLabel(ms(iso), now);

  it('splits Today from Yesterday at local midnight', () => {
    expect(label('2026-09-19T00:00')).toBe('Today');
    expect(label('2026-09-18T23:59:59.999')).toBe('Yesterday');
    expect(label('2026-09-18T00:00')).toBe('Yesterday');
    expect(label('2026-09-17T23:59:59.999')).toBe('Previous 7 Days');
  });

  it('keeps 7 days ago in Previous 7 Days and moves 8 to Previous 30 Days', () => {
    expect(label('2026-09-12T00:00')).toBe('Previous 7 Days');
    expect(label('2026-09-11T23:59:59.999')).toBe('Previous 30 Days');
  });

  it('keeps 30 days ago in Previous 30 Days and names the month from 31', () => {
    expect(label('2026-08-20T00:00')).toBe('Previous 30 Days');
    expect(label('2026-08-19T23:59:59.999')).toBe('August');
    expect(label('2026-01-01T00:00')).toBe('January');
  });

  it('names the year for anything before this one', () => {
    expect(label('2025-12-31T23:59')).toBe('2025');
    expect(label('2019-06-01T00:00')).toBe('2019');
  });

  it('counts days across a month boundary', () => {
    const firstOfMarch = at('2026-03-01T09:00');

    expect(toDateGroupLabel(ms('2026-02-28T23:00'), firstOfMarch)).toBe(
      'Yesterday'
    );
    expect(toDateGroupLabel(ms('2026-01-30T00:00'), firstOfMarch)).toBe(
      'Previous 30 Days'
    );
    expect(toDateGroupLabel(ms('2026-01-29T23:59'), firstOfMarch)).toBe(
      'January'
    );
  });

  it('prefers a day count over the year across new year', () => {
    const newYear = at('2026-01-01T00:05');

    expect(toDateGroupLabel(ms('2026-01-01T00:00'), newYear)).toBe('Today');
    expect(toDateGroupLabel(ms('2025-12-31T23:59'), newYear)).toBe('Yesterday');
    expect(toDateGroupLabel(ms('2025-12-25T00:00'), newYear)).toBe(
      'Previous 7 Days'
    );
    expect(toDateGroupLabel(ms('2025-12-02T00:00'), newYear)).toBe(
      'Previous 30 Days'
    );
    expect(toDateGroupLabel(ms('2025-12-01T23:59'), newYear)).toBe('2025');
  });

  it('puts a time ahead of now in Today', () => {
    expect(label('2026-09-19T12:00:30')).toBe('Today');
    expect(label('2026-09-25T08:00')).toBe('Today');
  });

  it('counts calendar days over a 23-hour spring-forward day', () => {
    // New York skips 02:00 to 03:00 on 2026-03-08.
    const now = at('2026-03-09T00:30', NEW_YORK);

    expect(toDateGroupLabel(ms('2026-03-08T23:59', NEW_YORK), now)).toBe(
      'Yesterday'
    );
    expect(toDateGroupLabel(ms('2026-03-08T00:00', NEW_YORK), now)).toBe(
      'Yesterday'
    );
    expect(toDateGroupLabel(ms('2026-03-07T23:59', NEW_YORK), now)).toBe(
      'Previous 7 Days'
    );
    expect(toDateGroupLabel(ms('2026-03-02T00:00', NEW_YORK), now)).toBe(
      'Previous 7 Days'
    );
    expect(toDateGroupLabel(ms('2026-03-01T23:59', NEW_YORK), now)).toBe(
      'Previous 30 Days'
    );
  });

  it('counts calendar days over a 25-hour fall-back day', () => {
    // Berlin repeats 02:00 to 03:00 on 2026-10-25.
    const now = at('2026-10-26T00:30', BERLIN);

    expect(toDateGroupLabel(ms('2026-10-25T00:30', BERLIN), now)).toBe(
      'Yesterday'
    );
    expect(toDateGroupLabel(ms('2026-10-24T23:59', BERLIN), now)).toBe(
      'Previous 7 Days'
    );
    expect(toDateGroupLabel(ms('2026-09-26T00:00', BERLIN), now)).toBe(
      'Previous 30 Days'
    );
    expect(toDateGroupLabel(ms('2026-09-25T23:59', BERLIN), now)).toBe(
      'September'
    );
  });

  it('reads the day in the zone of now, not of the machine', () => {
    // 2026-09-18T20:00Z is the 19th in Seoul and still the 18th in New York.
    const timestamp = DateTime.fromISO('2026-09-18T20:00Z').toMillis();

    expect(toDateGroupLabel(timestamp, at('2026-09-19T12:00', SEOUL))).toBe(
      'Today'
    );
    expect(toDateGroupLabel(timestamp, at('2026-09-19T12:00', NEW_YORK))).toBe(
      'Yesterday'
    );
  });

  it('names the month in English whatever the locale of now', () => {
    const korean = at('2026-09-19T12:00').setLocale('ko');

    expect(toDateGroupLabel(ms('2026-05-10T00:00'), korean)).toBe('May');
  });
});

describe('groupSchemasByDate', () => {
  const now = at('2026-09-19T12:00');

  it('groups newest first, in date order, and leaves empty groups out', () => {
    const list = [
      entity('old', ms('2024-03-01T00:00')),
      entity('july', ms('2026-07-04T00:00')),
      entity('today-late', ms('2026-09-19T11:00')),
      entity('last-week', ms('2026-09-14T00:00')),
      entity('august', ms('2026-08-01T00:00')),
      entity('today-early', ms('2026-09-19T01:00')),
      entity('older', ms('2025-01-01T00:00')),
    ];

    expect(groupSchemasByDate(list, now)).toEqual([
      {
        label: 'Today',
        entities: [list[2], list[5]],
      },
      { label: 'Previous 7 Days', entities: [list[3]] },
      { label: 'August', entities: [list[4]] },
      { label: 'July', entities: [list[1]] },
      { label: '2025', entities: [list[6]] },
      { label: '2024', entities: [list[0]] },
    ]);
  });

  it('orders a group by name when edit times tie', () => {
    const time = ms('2026-09-18T10:00');

    expect(
      groupSchemasByDate([entity('b', time), entity('a', time)], now)
    ).toEqual([
      { label: 'Yesterday', entities: [entity('a', time), entity('b', time)] },
    ]);
  });

  it('returns no groups for an empty list', () => {
    expect(groupSchemasByDate([], now)).toEqual([]);
  });

  it('keeps the other fields of each entity', () => {
    const item = { id: 'x', name: 'x', updateAt: ms('2026-09-19T10:00') };

    expect(groupSchemasByDate([item], now)[0].entities[0]).toBe(item);
  });
});

describe('formatRelativeTime', () => {
  const now = at('2026-09-19T12:00');

  it('says just now for anything under a minute, or ahead of now', () => {
    expect(formatRelativeTime(ms('2026-09-19T11:59:30'), now)).toBe('just now');
    expect(formatRelativeTime(ms('2026-09-19T12:05'), now)).toBe('just now');
  });

  it('counts down to the largest whole unit in English', () => {
    expect(formatRelativeTime(ms('2026-09-19T11:57'), now)).toBe(
      '3 minutes ago'
    );
    expect(formatRelativeTime(ms('2026-09-19T09:30'), now)).toBe('2 hours ago');
    expect(formatRelativeTime(ms('2026-09-16T12:00'), now)).toBe('3 days ago');
    expect(formatRelativeTime(ms('2025-09-01T12:00'), now)).toBe('1 year ago');
  });

  it('stays in English whatever the locale of now', () => {
    expect(
      formatRelativeTime(ms('2026-09-19T11:57'), now.setLocale('ko'))
    ).toBe('3 minutes ago');
  });

  it('returns an empty string for a timestamp that is not a date', () => {
    expect(formatRelativeTime(Number.NaN, now)).toBe('');
  });
});
