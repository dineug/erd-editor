import { DateTime } from 'luxon';
import { describe, expect, it } from 'vite-plus/test';

import {
  formatTrashDeletion,
  isTrashExpired,
  TRASH_RETENTION_DAYS,
  trashDaysLeft,
} from '@/utils/trash';

const SEOUL = 'Asia/Seoul';
const NEW_YORK = 'America/New_York';

const at = (iso: string, zone = SEOUL) => DateTime.fromISO(iso, { zone });
const ms = (iso: string, zone = SEOUL) => at(iso, zone).toMillis();
const hoursBetween = (from: number, to: DateTime) =>
  to.diff(DateTime.fromMillis(from), 'hours').hours;

describe('isTrashExpired', () => {
  it('keeps a schema 30 days, to the millisecond it was trashed', () => {
    const deletedAt = ms('2026-08-01T15:30');

    expect(TRASH_RETENTION_DAYS).toBe(30);
    expect(isTrashExpired(deletedAt, at('2026-08-01T15:30'))).toBe(false);
    expect(isTrashExpired(deletedAt, at('2026-08-31T15:29:59.999'))).toBe(
      false
    );
    expect(isTrashExpired(deletedAt, at('2026-08-31T15:30'))).toBe(true);
    expect(isTrashExpired(deletedAt, at('2026-08-31T15:30:00.001'))).toBe(true);
    expect(isTrashExpired(deletedAt, at('2026-09-20T09:00'))).toBe(true);
  });

  it('counts calendar days over the spring DST change, 719 hours', () => {
    const deletedAt = ms('2026-02-20T12:00', NEW_YORK);
    const due = at('2026-03-22T12:00', NEW_YORK);

    expect(hoursBetween(deletedAt, due)).toBe(719);
    expect(isTrashExpired(deletedAt, due.minus({ milliseconds: 1 }))).toBe(
      false
    );
    expect(isTrashExpired(deletedAt, due)).toBe(true);
  });

  it('counts calendar days over the autumn DST change, 721 hours', () => {
    const deletedAt = ms('2026-10-15T12:00', NEW_YORK);
    const due = at('2026-11-14T12:00', NEW_YORK);

    expect(hoursBetween(deletedAt, due)).toBe(721);
    expect(isTrashExpired(deletedAt, due.minus({ hours: 1 }))).toBe(false);
    expect(isTrashExpired(deletedAt, due)).toBe(true);
  });

  it('reads the calendar in the zone now carries', () => {
    const deletedAt = ms('2026-02-20T12:00', NEW_YORK);
    const due = at('2026-03-22T12:00', NEW_YORK);

    // The same instant, 719 hours on, is an hour short of 30 days in Seoul.
    expect(isTrashExpired(deletedAt, due.setZone(SEOUL))).toBe(false);
  });

  it('waits the whole 30 days for a time ahead of now, from a skewed clock', () => {
    const deletedAt = ms('2026-09-21T12:00');

    expect(isTrashExpired(deletedAt, at('2026-09-20T12:00'))).toBe(false);
    expect(isTrashExpired(deletedAt, at('2026-10-21T11:59'))).toBe(false);
    expect(isTrashExpired(deletedAt, at('2026-10-21T12:00'))).toBe(true);
  });

  it('never expires a schema outside the trash, or a time that is none', () => {
    const now = at('2026-09-20T12:00');

    expect(isTrashExpired(undefined, now)).toBe(false);
    expect(isTrashExpired(null, now)).toBe(false);
    expect(isTrashExpired(Number.NaN, now)).toBe(false);
  });
});

describe('trashDaysLeft', () => {
  const now = at('2026-09-20T12:00');
  const left = (iso: string, base = now) => trashDaysLeft(ms(iso), base);

  it('counts down from 30 in calendar days', () => {
    expect(left('2026-09-20T11:59')).toBe(30);
    expect(left('2026-09-17T12:00')).toBe(27);
    expect(left('2026-08-22T12:00')).toBe(1);
  });

  it('turns over at midnight, not a whole day before the deletion', () => {
    // Due at 23:30 on the 20th: tomorrow until midnight, then today.
    const deletedAt = '2026-08-21T23:30';

    expect(left(deletedAt, at('2026-09-19T23:59'))).toBe(1);
    expect(left(deletedAt, at('2026-09-20T00:00'))).toBe(0);
  });

  it('stays at 0 on the day it is due and after, until the purge comes', () => {
    expect(left('2026-08-21T18:00')).toBe(0);
    expect(left('2026-08-21T06:00')).toBe(0);
    expect(left('2026-07-01T12:00')).toBe(0);
  });

  it('counts whole days over a DST change', () => {
    expect(
      trashDaysLeft(
        ms('2026-02-20T12:00', NEW_YORK),
        at('2026-03-07T12:00', NEW_YORK)
      )
    ).toBe(15);
  });

  it('adds the days a time ahead of now is ahead by', () => {
    expect(left('2026-09-21T12:00')).toBe(31);
  });
});

describe('formatTrashDeletion', () => {
  const now = at('2026-09-20T12:00');
  const label = (iso: string) => formatTrashDeletion(ms(iso), now);

  it('says in how many days', () => {
    expect(label('2026-09-20T12:00')).toBe('deletes in 30 days');
    expect(label('2026-09-17T12:00')).toBe('deletes in 27 days');
    expect(label('2026-08-23T12:00')).toBe('deletes in 2 days');
  });

  it('says tomorrow and today rather than in 1 or 0 days', () => {
    expect(label('2026-08-22T12:00')).toBe('deletes tomorrow');
    expect(label('2026-08-21T18:00')).toBe('deletes today');
    expect(label('2026-08-01T12:00')).toBe('deletes today');
  });
});
