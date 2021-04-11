import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { beforeMount, closestElement } from '@dineug/lit-observable';
import { VisualizationElement } from '@/extensions/panels/visualization/components/Visualization';

export function useAPI(ctx: HTMLElement) {
  const ref: { value: ERDEditorContext | null } = { value: null };

  beforeMount(() => {
    const el = closestElement(
      'vuerd-visualization',
      ctx
    ) as VisualizationElement | null;
    if (!el) return;

    ref.value = el.api;
  });

  return ref as { value: ERDEditorContext };
}
