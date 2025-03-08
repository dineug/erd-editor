import { createSubject, Unsubscribe } from '@/helpers/subject';
import { Context as Ctx } from '@/render/part/node/component/observableComponent';

import {
  Context,
  ContextEventDetail,
  contextSubscribeEvent,
  contextUnsubscribeEvent,
} from './createContext';

export function useProvider<T>(
  ctx: Ctx<HTMLElement> | Ctx<{}>,
  context: Context<T>,
  value: T
) {
  const target =
    ctx instanceof HTMLElement ? ctx : (ctx.parentElement ?? ctx.host);
  const subject = createSubject<T>();
  const unsubscribeMap = new Map<(value: T) => void, Unsubscribe>();

  const handleContextSubscribe = (event: Event) => {
    const e = event as CustomEvent<ContextEventDetail<T>>;

    if (e.detail?.context?.key === context.key) {
      e.stopPropagation();
      e.detail.observer(value);
      unsubscribeMap.set(
        e.detail.observer,
        subject.subscribe(e.detail.observer)
      );
    }
  };

  const handleContextUnsubscribe = (event: Event) => {
    const e = event as CustomEvent<ContextEventDetail<T>>;

    if (e.detail?.context?.key === context.key) {
      e.stopPropagation();
      const unsubscribe = unsubscribeMap.get(e.detail.observer);
      unsubscribe?.();
      unsubscribeMap.delete(e.detail.observer);
    }
  };

  target.addEventListener(contextSubscribeEvent.type, handleContextSubscribe);
  target.addEventListener(
    contextUnsubscribeEvent.type,
    handleContextUnsubscribe
  );

  const set = (value: T) => {
    subject.next(value);
  };

  const destroy = () => {
    target.removeEventListener(
      contextSubscribeEvent.type,
      handleContextSubscribe
    );
    target.removeEventListener(
      contextUnsubscribeEvent.type,
      handleContextUnsubscribe
    );
    for (const unsubscribe of unsubscribeMap.values()) {
      unsubscribe();
    }
    unsubscribeMap.clear();
  };

  return {
    set,
    destroy,
  };
}
