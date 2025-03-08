import { observable } from '@/observable';
import { Ref } from '@/render/directives/attribute';
import { onBeforeMount, onUnmounted } from '@/render/part/node/component/hooks';
import { Context as Ctx } from '@/render/part/node/component/observableComponent';

import {
  Context,
  contextSubscribeEvent,
  contextUnsubscribeEvent,
} from './createContext';

export function useContext<T>(
  ctx: Ctx<HTMLElement> | Ctx<{}>,
  context: Context<T>
) {
  const ref: Ref<T> = observable({ value: context.value }, { shallow: true });

  const observer = (value: T) => {
    ref.value = value;
  };

  const getTarget = () =>
    ctx instanceof HTMLElement ? ctx : (ctx.parentElement ?? ctx.host);

  const subscribe = () => {
    const target = getTarget();

    target.dispatchEvent(
      contextSubscribeEvent({
        context,
        observer,
      })
    );
  };

  subscribe();
  onBeforeMount(subscribe);

  onUnmounted(() => {
    const target = getTarget();

    target.dispatchEvent(
      contextUnsubscribeEvent({
        context,
        observer,
      })
    );
  });

  return ref;
}
