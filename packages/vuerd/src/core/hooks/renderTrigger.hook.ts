import {
  observable,
  beforeFirstUpdate,
  beforeUpdate,
} from '@vuerd/lit-observable';

export function useRenderTrigger() {
  const state = observable({ count: 0 });

  const renderTrigger = () => state.count++;

  beforeFirstUpdate(() => state.count);
  beforeUpdate(() => state.count);

  return {
    renderTrigger,
  };
}
