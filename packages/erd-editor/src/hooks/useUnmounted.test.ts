import { FC, html } from '@dineug/r-html';
import { Subscription } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import { useUnmounted } from '@/hooks/useUnmounted';

type AddUnsubscribe = ReturnType<typeof useUnmounted>['addUnsubscribe'];

type ProbeProps = {
  setup: (addUnsubscribe: AddUnsubscribe) => void;
};

const Probe: FC<ProbeProps> = (props, ctx) => {
  const { addUnsubscribe } = useUnmounted();
  props.setup(addUnsubscribe);

  return () => html`<div class="probe"></div>`;
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('useUnmounted', () => {
  it('does not run registered teardowns while the component is mounted', async () => {
    const unsubscribe = vi.fn();
    mounted = await mountAndFlush(
      html`<${Probe} setup=${(add: AddUnsubscribe) => add(unsubscribe)} />`
    );

    expect(mounted.container.querySelector('.probe')).toBeTruthy();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('calls function teardowns on unmount', async () => {
    const unsubscribe = vi.fn();
    mounted = await mountAndFlush(
      html`<${Probe} setup=${(add: AddUnsubscribe) => add(unsubscribe)} />`
    );

    mounted.unmount();
    mounted = null;

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes rxjs Subscriptions on unmount', async () => {
    const subscription = new Subscription();
    const teardown = vi.fn();
    subscription.add(teardown);

    mounted = await mountAndFlush(
      html`<${Probe} setup=${(add: AddUnsubscribe) => add(subscription)} />`
    );
    expect(subscription.closed).toBe(false);

    mounted.unmount();
    mounted = null;

    expect(subscription.closed).toBe(true);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('accepts several teardowns in a single call and mixes both kinds', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const subscription = new Subscription();

    mounted = await mountAndFlush(
      html`<${Probe}
        setup=${(add: AddUnsubscribe) => add(first, subscription, second)}
      />`
    );

    mounted.unmount();
    mounted = null;

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(subscription.closed).toBe(true);
  });

  it('deduplicates the same teardown registered twice', async () => {
    const unsubscribe = vi.fn();

    mounted = await mountAndFlush(
      html`<${Probe}
        setup=${(add: AddUnsubscribe) => {
          add(unsubscribe);
          add(unsubscribe);
          add(unsubscribe);
        }}
      />`
    );

    mounted.unmount();
    mounted = null;

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('runs the teardowns in registration order', async () => {
    const order: string[] = [];

    mounted = await mountAndFlush(
      html`<${Probe}
        setup=${(add: AddUnsubscribe) => {
          add(() => order.push('first'));
          add(() => order.push('second'));
        }}
      />`
    );

    mounted.unmount();
    mounted = null;

    expect(order).toEqual(['first', 'second']);
  });
});
