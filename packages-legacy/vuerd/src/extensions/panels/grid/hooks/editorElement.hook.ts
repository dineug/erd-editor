import { beforeMount, closestElement } from '@vuerd/lit-observable';

export function useEditorElement(ctx: HTMLElement) {
  const ref: { value: HTMLElement | null } = { value: null };

  beforeMount(() => {
    const el = closestElement('.vuerd-editor', ctx) as HTMLElement | null;
    if (!el) return;

    ref.value = el;
  });

  return ref as { value: HTMLElement };
}
