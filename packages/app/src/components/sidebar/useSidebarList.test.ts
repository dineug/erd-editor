import { createStore } from 'jotai';
import { DateTime } from 'luxon';
import { act } from 'react';
import { describe, expect, it } from 'vite-plus/test';

import { renderHook } from '@/__test-utils__/renderHook';
import {
  type SidebarListEntity,
  useSidebarList,
} from '@/components/sidebar/useSidebarList';

const ZONE = 'UTC';
const now = DateTime.fromISO('2026-09-25T12:00:00', { zone: ZONE });
const daysAgo = (days: number) => now.minus({ days }).toMillis();

const entities: SidebarListEntity[] = [
  { id: 'old', name: 'Orders', updateAt: daysAgo(3) },
  { id: 'new', name: 'Users', updateAt: daysAgo(0) },
  { id: 'mid', name: 'Payments', updateAt: daysAgo(1) },
];

function render(selectedId: string | null) {
  const props = { selectedId };
  const view = renderHook(
    () => useSidebarList(entities, now, props.selectedId),
    createStore()
  );
  return {
    result: view.result,
    select: (id: string | null) => {
      props.selectedId = id;
      view.rerender();
    },
  };
}

describe('useSidebarList', () => {
  it('groups by date, newest first', () => {
    const { result } = render(null);

    expect(
      result.current.groups.map(({ label, entities }) => [
        label,
        entities.map(({ id }) => id),
      ])
    ).toEqual([
      ['Today', ['new']],
      ['Yesterday', ['mid']],
      ['Previous 7 Days', ['old']],
    ]);
    expect(result.current.noResults).toBe(false);
  });

  it('filters by the query and says so when nothing is left', () => {
    const { result } = render(null);

    act(() => result.current.setQuery('pay'));
    expect(result.current.groups.flatMap(group => group.entities)).toEqual([
      entities[2],
    ]);
    expect(result.current.noResults).toBe(false);

    act(() => result.current.setQuery('nothing'));
    expect(result.current.groups).toEqual([]);
    expect(result.current.noResults).toBe(true);

    act(() => result.current.setQuery('   '));
    expect(result.current.groups).toHaveLength(3);
    expect(result.current.noResults).toBe(false);
  });

  it('puts the Tab stop on the first item, else the open one', () => {
    const { result, select } = render(null);
    expect(result.current.tabStopId).toBe('new');

    select('old');
    expect(result.current.tabStopId).toBe('old');

    select('gone');
    expect(result.current.tabStopId).toBe('new');
  });

  it('keeps the Tab stop on the last focused item while it is listed', () => {
    const { result } = render('old');

    act(() => result.current.setFocusedId('mid'));
    expect(result.current.tabStopId).toBe('mid');

    act(() => result.current.setQuery('orders'));
    expect(result.current.tabStopId).toBe('old');

    act(() => result.current.setQuery('users'));
    expect(result.current.tabStopId).toBe('new');

    act(() => result.current.setQuery('nothing'));
    expect(result.current.tabStopId).toBeNull();
  });
});
