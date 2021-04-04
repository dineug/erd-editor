import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { beforeMount, closestElement } from '@dineug/lit-observable';
import { GridElement } from '@/extensions/panels/grid/components/Grid';

export function useAPI(ctx: HTMLElement) {
  const ref: { value: ERDEditorContext | null } = { value: null };

  beforeMount(() => {
    const el = closestElement('vuerd-grid', ctx) as GridElement | null;
    if (!el) return;

    ref.value = el.api;
  });

  return ref as { value: ERDEditorContext };
}
