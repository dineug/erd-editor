import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  createEngineContext,
  type EngineContext,
  type InjectEngineContext,
} from '@/engine/context';
import { createReplicationStore } from '@/engine/replication-store';

describe('createEngineContext', () => {
  it('keeps the injected members and adds a fresh clock', () => {
    const toWidth = (text: string) => text.length * 10;

    const ctx = createEngineContext({ toWidth });

    expect(ctx.toWidth).toBe(toWidth);
    expect(ctx.toWidth('abc')).toBe(30);
    expect(ctx.clock).toBeInstanceOf(Clock);
    expect(ctx.clock.getVersion()).toBe(0);
  });

  it('creates an independent clock per context', () => {
    const toWidth = (text: string) => text.length;

    const a = createEngineContext({ toWidth });
    const b = createEngineContext({ toWidth });

    a.clock.merge(12);

    expect(a.clock).not.toBe(b.clock);
    expect(a.clock.getVersion()).toBe(12);
    expect(b.clock.getVersion()).toBe(0);
  });

  it('does not mutate the injected object', () => {
    const inject = { toWidth: (text: string) => text.length };

    const ctx = createEngineContext(inject);

    expect(ctx).not.toBe(inject);
    expect(Reflect.has(inject, 'clock')).toBe(false);
  });

  it('ignores a clock smuggled in through the injected context', () => {
    const smuggled = new Clock();
    smuggled.merge(99);

    const ctx = createEngineContext({
      toWidth: (text: string) => text.length,
      clock: smuggled,
    } as any);

    expect(ctx.clock).not.toBe(smuggled);
    expect(ctx.clock.getVersion()).toBe(0);
  });

  it('drops a remote flag smuggled in through the injected context', () => {
    const ctx = createEngineContext({
      toWidth: (text: string) => text.length,
      remote: true,
    } as any);

    expect(ctx).not.toHaveProperty('remote');
  });

  it('takes no remote flag, which a replica sets on its own context alone', () => {
    expectTypeOf<keyof EngineContext>().toEqualTypeOf<
      'toWidth' | 'routes' | 'clock'
    >();
    expectTypeOf<keyof InjectEngineContext>().toEqualTypeOf<
      'toWidth' | 'routes'
    >();
    expectTypeOf(createEngineContext)
      .parameter(0)
      .toEqualTypeOf<InjectEngineContext>();
    expectTypeOf(createReplicationStore)
      .parameter(0)
      .toEqualTypeOf<InjectEngineContext>();
    expect(
      createEngineContext({ toWidth: text => text.length })
    ).not.toHaveProperty('remote');
  });
});
