import {
  mounted,
  unmounted,
  queryAll,
  closestElement,
} from '@dineug/lit-observable';
import tippy, { createSingleton, CreateSingletonInstance } from 'tippy.js';
import { flat, isArray } from '@/core/helper';

export function useTooltip(selectors: string[], ctx: HTMLElement) {
  const elementsRefs = selectors.map(selector =>
    queryAll<Array<HTMLElement>>(selector)
  );
  let singleton: CreateSingletonInstance | null = null;

  const createTooltip = () => {
    const root = closestElement('.vuerd-editor', ctx);
    const elements = [
      ...flat<HTMLElement>(
        elementsRefs.map(ref => ref.value).filter(elements => isArray(elements))
      ),
    ];

    singleton = createSingleton(
      tippy(elements, {
        appendTo: root ?? 'parent',
        trigger: 'manual',
      }),
      {
        appendTo: root ?? 'parent',
        zIndex: 100003000,
        delay: [500, 100],
        moveTransition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      }
    );
  };

  const destroyTooltip = () => {
    if (singleton) {
      singleton.destroy();
      singleton = null;
    }
  };

  const resetTooltip = () => {
    destroyTooltip();
    createTooltip();
  };

  mounted(createTooltip);
  unmounted(destroyTooltip);

  return {
    resetTooltip,
  };
}
