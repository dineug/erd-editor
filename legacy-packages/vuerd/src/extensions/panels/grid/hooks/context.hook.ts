import { beforeMount } from '@vuerd/lit-observable';

import { getGridContext } from '@/extensions/panels/grid/components/GridEditorProvider';
import { GridContext } from '@/extensions/panels/grid/core/gridContext';

export function useContext(ctx: HTMLElement) {
  const ref: { value: GridContext | null } = { value: null };

  beforeMount(() => (ref.value = getGridContext(ctx)));

  return ref as { value: GridContext };
}
