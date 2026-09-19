import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { selectedSchemaIdAtom, useSchemaEntity } from '@/atoms/modules/sidebar';

const SCHEMA_PARAM = 'schema';

type Snapshot = {
  paramId: string | null;
  selectedId: string | null;
};

/**
 * Keeps the open schema and the schema query parameter in step. Whichever of
 * the two moved since the last pass wins, the URL when both did, so back and
 * forward switch schemas. Opening one pushes an entry; clearing it replaces.
 */
export function useSchemaSearchParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useAtom(selectedSchemaIdAtom);
  const schemaEntity = useSchemaEntity();
  const paramId = searchParams.get(SCHEMA_PARAM);
  const lastRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    const last = lastRef.current;
    lastRef.current = { paramId, selectedId };
    if (paramId === selectedId) return;

    if (!last || paramId !== last.paramId) {
      setSelectedId(paramId);
    } else if (selectedId !== last.selectedId) {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          selectedId
            ? next.set(SCHEMA_PARAM, selectedId)
            : next.delete(SCHEMA_PARAM);
          return next;
        },
        { replace: selectedId === null }
      );
    }
  }, [paramId, selectedId, setSelectedId, setSearchParams]);

  // An id that is not stored, or sits in the trash, fails to load; dropping it
  // clears the parameter too, without an entry of its own.
  const isMissing = selectedId !== null && schemaEntity.state === 'hasError';

  useEffect(() => {
    if (isMissing) setSelectedId(null);
  }, [isMissing, setSelectedId]);
}
