import { beforeMount } from '@dineug/lit-observable';
import { GridContext } from '@/extensions/panels/grid/GridContext';
import { getGridContext } from '@/extensions/panels/grid/components/GridProvider';

export function useContext(ctx: HTMLElement) {
  const ref: { value: GridContext | null } = { value: null };

  beforeMount(() => (ref.value = getGridContext(ctx)));

  return ref as { value: GridContext };
}
