import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  addHmrObservable,
  hmr,
  hotReloadObservable,
  mixinHmrComponent,
} from '@/render/hmr';
import { Part } from '@/render/part';
import { setCurrentInstance } from '@/render/part/node/component/hooks';
import { TNode } from '@/template/tNode';

class BaseComponentPart implements Part {
  static created: BaseComponentPart[] = [];

  commits: any[][] = [];
  destroyCount = 0;

  constructor(
    public node: Comment,
    public tNode: TNode,
    public parts: Part[]
  ) {
    BaseComponentPart.created.push(this);
  }

  commit(values: any[]) {
    this.commits.push(values);
  }

  destroy() {
    this.destroyCount++;
  }
}

const HmrComponentPart = mixinHmrComponent(BaseComponentPart);

const createInstance = () =>
  new HmrComponentPart(
    document.createComment(''),
    {} as TNode,
    []
  ) as unknown as BaseComponentPart & { commit(values: any[]): void };

const emit = (originComponent: any, newComponent: any) => {
  window.dispatchEvent(
    new CustomEvent('hmr:r-html', {
      detail: { originComponent, newComponent },
    })
  );
};

const disposers: Array<() => void> = [];
const instances: Array<{ destroy(): void }> = [];

const activate = () => {
  const dispose = hmr();
  disposers.push(dispose);
  return dispose;
};

const track = <T extends { destroy(): void }>(instance: T) => {
  instances.push(instance);
  return instance;
};

afterEach(() => {
  while (instances.length) instances.pop()?.destroy();
  while (disposers.length) disposers.pop()?.();
  setCurrentInstance(null);
  BaseComponentPart.created = [];
});

describe('render/hmr', () => {
  describe('mixinHmrComponent without hmr() active', () => {
    it('forwards commit values untouched and still constructs the base', () => {
      const instance = track(createInstance() as any) as any;
      const Origin = () => null;

      instance.commit([Origin, 1]);

      expect(instance.commits).toEqual([[Origin, 1]]);
      expect(BaseComponentPart.created.length).toBe(1);
    });

    it('does not swap components for events dispatched while inactive', () => {
      const Origin = () => null;
      const Next = () => null;
      const instance = track(createInstance() as any) as any;

      emit(Origin, Next);
      instance.commit([Origin]);

      expect(instance.commits).toEqual([[Origin]]);
    });
  });

  describe('hmr()', () => {
    it('swaps a component for its hot replacement on commit', () => {
      activate();
      const Origin = () => null;
      const Next = () => null;
      const instance = track(createInstance() as any) as any;

      emit(Origin, Next);
      instance.commit([Origin, 'other']);

      expect(instance.commits.at(-1)).toEqual([Next, 'other']);
    });

    it('leaves values that are not registered components alone', () => {
      activate();
      const Unknown = () => null;
      const instance = track(createInstance() as any) as any;

      instance.commit([Unknown, 1, 'a', null]);

      expect(instance.commits.at(-1)).toEqual([Unknown, 1, 'a', null]);
    });

    it('re-commits mounted instances that hold the replaced component', () => {
      activate();
      const Origin = () => null;
      const Next = () => null;
      const instance = track(createInstance() as any) as any;

      instance.commit([Origin]);
      expect(instance.commits.length).toBe(1);

      emit(Origin, Next);

      expect(instance.commits.length).toBe(2);
      expect(instance.commits.at(-1)).toEqual([Next]);
    });

    it('does not re-commit instances that never received the component', () => {
      activate();
      const Origin = () => null;
      const Next = () => null;
      const Other = () => null;
      const instance = track(createInstance() as any) as any;

      instance.commit([Other]);
      emit(Origin, Next);

      expect(instance.commits.length).toBe(1);
    });

    it('keeps the original component as the identity across repeated reloads', () => {
      activate();
      const V1 = () => null;
      const V2 = () => null;
      const V3 = () => null;
      const instance = track(createInstance() as any) as any;

      instance.commit([V1]);
      emit(V1, V2);
      emit(V2, V3);

      expect(instance.commits.at(-1)).toEqual([V3]);

      instance.commit([V1]);
      expect(instance.commits.at(-1)).toEqual([V3]);
    });

    it('ignores events whose detail is missing or not a pair of functions', () => {
      activate();
      const Origin = () => null;
      const instance = track(createInstance() as any) as any;

      window.dispatchEvent(new CustomEvent('hmr:r-html'));
      emit(undefined, undefined);
      emit(Origin, 'not-a-function');
      emit('not-a-function', Origin);

      instance.commit([Origin]);

      expect(instance.commits).toEqual([[Origin]]);
    });

    it('stops swapping and stops listening once the dispose is called', () => {
      const dispose = activate();
      const Origin = () => null;
      const Next = () => null;
      const instance = track(createInstance() as any) as any;

      dispose();
      emit(Origin, Next);
      instance.commit([Origin]);

      expect(instance.commits).toEqual([[Origin]]);
    });

    it('removes the window listener on dispose', () => {
      const removeEventListener = vi.spyOn(window, 'removeEventListener');

      const dispose = hmr();
      dispose();

      expect(removeEventListener).toHaveBeenCalledWith(
        'hmr:r-html',
        expect.any(Function)
      );
      removeEventListener.mockRestore();
    });
  });

  describe('destroy', () => {
    it('unsubscribes from the hmr subject and delegates to the base', () => {
      activate();
      const Origin = () => null;
      const Next = () => null;
      const instance = createInstance() as any;

      instance.commit([Origin]);
      instance.destroy();

      emit(Origin, Next);

      expect(instance.commits.length).toBe(1);
      expect(instance.destroyCount).toBe(1);
    });

    it('is safe to call when the base class has no destroy', () => {
      class NoDestroy {
        commits: any[][] = [];
        constructor(
          public node: Comment,
          public tNode: TNode,
          public parts: Part[]
        ) {}
        commit(values: any[]) {
          this.commits.push(values);
        }
      }
      const C = mixinHmrComponent(NoDestroy as any);
      const instance = new C(document.createComment(''), {} as TNode, []);

      expect(() => instance.destroy?.()).not.toThrow();
    });
  });

  describe('addHmrObservable / hotReloadObservable', () => {
    it('does nothing while hmr is inactive', () => {
      const instance = track(createInstance() as any) as any;
      const state = { count: 1 };

      setCurrentInstance(instance);
      expect(() => addHmrObservable(state)).not.toThrow();
      expect(() => hotReloadObservable(instance)).not.toThrow();
      expect(state).toEqual({ count: 1 });
    });

    it('does nothing when there is no current instance', () => {
      activate();
      setCurrentInstance(null);

      expect(() => addHmrObservable({ count: 1 })).not.toThrow();
    });

    it('registers observables for the current instance without mutating them', () => {
      activate();
      const instance = track(createInstance() as any) as any;
      const state = { count: 1 };

      setCurrentInstance(instance);
      addHmrObservable(state);
      addHmrObservable(state);
      addHmrObservable({ other: true });

      expect(state).toEqual({ count: 1 });
      expect(() => hotReloadObservable(instance)).not.toThrow();
    });

    it('leaves the first mount alone — there is nothing to carry over yet', () => {
      activate();
      const instance = track(createInstance() as any) as any;
      const state = { count: 0 };

      setCurrentInstance(instance);
      addHmrObservable(state);
      hotReloadObservable(instance);

      expect(state.count).toBe(0);
    });

    it('copies the live state onto the observables the reloaded body created', () => {
      activate();
      const instance = track(createInstance() as any) as any;

      const first = { count: 0 };
      setCurrentInstance(instance);
      addHmrObservable(first);
      hotReloadObservable(instance);

      first.count = 42;

      // The edited module re-runs the body, which builds a fresh observable.
      const second = { count: 0 };
      setCurrentInstance(instance);
      addHmrObservable(second);
      hotReloadObservable(instance);

      expect(second.count).toBe(42);
    });

    it('pairs observables by creation order', () => {
      activate();
      const instance = track(createInstance() as any) as any;

      setCurrentInstance(instance);
      addHmrObservable({ a: 1 });
      addHmrObservable({ b: 2 });
      hotReloadObservable(instance);

      const a = { a: 0 };
      const b = { b: 0 };
      setCurrentInstance(instance);
      addHmrObservable(a);
      addHmrObservable(b);
      hotReloadObservable(instance);

      expect(a).toEqual({ a: 1 });
      expect(b).toEqual({ b: 2 });
    });

    it('leaves an observable the previous body never had at its defaults', () => {
      activate();
      const instance = track(createInstance() as any) as any;

      setCurrentInstance(instance);
      addHmrObservable({ a: 1 });
      hotReloadObservable(instance);

      const added = { fresh: 'default' };
      setCurrentInstance(instance);
      addHmrObservable({ a: 0 });
      addHmrObservable(added);
      hotReloadObservable(instance);

      expect(added).toEqual({ fresh: 'default' });
    });

    it('carries state through repeated reloads without accumulating', () => {
      activate();
      const instance = track(createInstance() as any) as any;

      const reload = (state: any) => {
        setCurrentInstance(instance);
        addHmrObservable(state);
        hotReloadObservable(instance);
        return state;
      };

      reload({ count: 0 }).count = 7;
      const second = reload({ count: 0 });
      expect(second.count).toBe(7);

      second.count = 9;
      // If the pending list were never drained, this third body's observable
      // would pair against the *first* one and read 7.
      expect(reload({ count: 0 }).count).toBe(9);
    });

    it('is a no-op for a component that never registered observables', () => {
      activate();
      const instance = track(createInstance() as any) as any;

      expect(() => hotReloadObservable(instance)).not.toThrow();
    });
  });
});
