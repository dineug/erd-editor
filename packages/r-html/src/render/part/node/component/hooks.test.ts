import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BEFORE_FIRST_UPDATE,
  BEFORE_MOUNT,
  BEFORE_UPDATE,
  FIRST_UPDATED,
  LIFECYCLE_NAMES,
  MOUNTED,
  UNMOUNTED,
  UPDATED,
} from '@/constants';
import {
  clearAllLifecycleHooks,
  getCurrentInstance,
  lifecycleHooks,
  onBeforeFirstUpdate,
  onBeforeMount,
  onBeforeUpdate,
  onFirstUpdated,
  onMounted,
  onUnmounted,
  onUpdated,
  setCurrentInstance,
} from '@/render/part/node/component/hooks';

afterEach(() => {
  setCurrentInstance(null);
  vi.restoreAllMocks();
});

describe('component hooks', () => {
  it('tracks the current instance', () => {
    expect(getCurrentInstance()).toBeNull();

    const instance = {};
    setCurrentInstance(instance);
    expect(getCurrentInstance()).toBe(instance);

    setCurrentInstance(null);
    expect(getCurrentInstance()).toBeNull();
  });

  it('registers every lifecycle callback on the current instance', () => {
    const instance: any = {};
    setCurrentInstance(instance);

    const beforeMount = () => {};
    const mounted = () => {};
    const unmounted = () => {};
    const beforeFirstUpdate = () => {};
    const beforeUpdate = () => {};
    const firstUpdated = () => {};
    const updated = () => {};

    onBeforeMount(beforeMount);
    onMounted(mounted);
    onUnmounted(unmounted);
    onBeforeFirstUpdate(beforeFirstUpdate);
    onBeforeUpdate(beforeUpdate);
    onFirstUpdated(firstUpdated);
    onUpdated(updated);

    expect(instance[BEFORE_MOUNT]).toEqual([beforeMount]);
    expect(instance[MOUNTED]).toEqual([mounted]);
    expect(instance[UNMOUNTED]).toEqual([unmounted]);
    expect(instance[BEFORE_FIRST_UPDATE]).toEqual([beforeFirstUpdate]);
    expect(instance[BEFORE_UPDATE]).toEqual([beforeUpdate]);
    expect(instance[FIRST_UPDATED]).toEqual([firstUpdated]);
    expect(instance[UPDATED]).toEqual([updated]);
  });

  it('appends to an already created hook list', () => {
    const instance: any = {};
    setCurrentInstance(instance);

    const a = () => {};
    const b = () => {};
    onMounted(a);
    onMounted(b);

    expect(instance[MOUNTED]).toEqual([a, b]);
  });

  it('ignores registration when there is no current instance', () => {
    setCurrentInstance(null);
    expect(() => onMounted(() => {})).not.toThrow();
  });

  it('runs every registered hook in registration order', () => {
    const instance: any = {};
    setCurrentInstance(instance);
    const calls: string[] = [];
    onMounted(() => calls.push('a'));
    onMounted(() => calls.push('b'));
    setCurrentInstance(null);

    lifecycleHooks(instance, MOUNTED);

    expect(calls).toEqual(['a', 'b']);
  });

  it('does nothing when the hook slot is not an array', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => lifecycleHooks({}, MOUNTED)).not.toThrow();
    expect(() => lifecycleHooks({ [MOUNTED]: null }, MOUNTED)).not.toThrow();
    expect(() =>
      lifecycleHooks({ [MOUNTED]: 'nope' } as any, MOUNTED)
    ).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('swallows hook errors and keeps running the rest', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const instance: any = {};
    setCurrentInstance(instance);
    const calls: string[] = [];
    onUpdated(() => {
      throw new Error('boom');
    });
    onUpdated(() => calls.push('after'));
    setCurrentInstance(null);

    lifecycleHooks(instance, UPDATED);

    expect(calls).toEqual(['after']);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clears every lifecycle slot', () => {
    const instance: any = {};
    setCurrentInstance(instance);
    onBeforeMount(() => {});
    onMounted(() => {});
    onUnmounted(() => {});
    onBeforeFirstUpdate(() => {});
    onBeforeUpdate(() => {});
    onFirstUpdated(() => {});
    onUpdated(() => {});
    setCurrentInstance(null);

    clearAllLifecycleHooks(instance);

    LIFECYCLE_NAMES.forEach(name => {
      expect(instance[name]).toBeNull();
    });
    expect(() => lifecycleHooks(instance, MOUNTED)).not.toThrow();
  });
});
