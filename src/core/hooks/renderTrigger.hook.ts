import { observable, beforeUpdate, firstUpdated } from '@dineug/lit-observable';

export function useRenderTrigger() {
  const state = observable({ count: 0 });

  const renderTrigger = () => state.count++;

  beforeUpdate(() => state.count);
  firstUpdated(() => state.count);

  return {
    renderTrigger,
  };
}
