import { observable } from '@dineug/lit-observable';

export function useRenderTrigger() {
  const state = observable({ count: 0 });

  const render = () => state.count++;
  const trigger = () => state.count;

  return {
    render,
    trigger,
  };
}
