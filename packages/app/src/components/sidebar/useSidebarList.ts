import type { DateTime } from 'luxon';
import { useMemo, useRef, useState } from 'react';

import { filterSchemasByName, groupSchemasByDate } from '@/utils/schemaList';

/** A row of a sidebar list: the list sorts and groups by updateAt. */
export type SidebarListEntity = {
  id: string;
  name: string;
  updateAt: number;
};

/**
 * The search query, date groups and roving Tab stop of a sidebar list, for
 * entities from any source; selectedId is the open one, if listed.
 */
export function useSidebarList<T extends SidebarListEntity>(
  entities: T[],
  now: DateTime,
  selectedId: string | null
) {
  const [query, setQuery] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () => groupSchemasByDate(filterSchemasByName(entities, query), now),
    [entities, query, now]
  );
  const noResults = query.trim() !== '' && groups.length === 0;

  // One item takes Tab at a time and the arrows move between the rest: the
  // last one focused while it is listed, else the open one, else the first.
  const tabStopId = useMemo(() => {
    const ids = groups.flatMap(group => group.entities.map(({ id }) => id));
    if (focusedId && ids.includes(focusedId)) return focusedId;
    if (selectedId && ids.includes(selectedId)) return selectedId;
    return ids[0] ?? null;
  }, [groups, focusedId, selectedId]);

  return {
    query,
    setQuery,
    groups,
    noResults,
    tabStopId,
    setFocusedId,
    listRef,
  };
}
