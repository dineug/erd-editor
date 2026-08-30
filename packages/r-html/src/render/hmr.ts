import { isFunction } from '@/helpers/is-type';
import { createSubject, Unsubscribe } from '@/helpers/subject';
import { Part } from '@/render/part';
import type { ComponentPartClass } from '@/render/part/node/component';
import { getCurrentInstance } from '@/render/part/node/component/hooks';
import type { FC } from '@/render/part/node/component/observableComponent';
import { TNode } from '@/template/tNode';

const originComponentCache = new WeakMap<FC, FC>();
const hmrComponentCache = new WeakMap<FC, FC>();
/** The observables the currently mounted body created, in creation order. */
const hmrObservableCache = new WeakMap<Part, Array<any>>();
/** The observables the body being evaluated right now is creating. */
const hmrObservablePendingCache = new WeakMap<Part, Array<any>>();
const hmrSubject = createSubject<FC>();

let active = false;

function handler(event: any) {
  let originComponent: any = event?.detail?.originComponent;
  const newComponent: any = event?.detail?.newComponent;

  if (isFunction(originComponent) && isFunction(newComponent)) {
    if (originComponentCache.has(originComponent)) {
      originComponent = originComponentCache.get(originComponent);
    }
    originComponentCache.set(newComponent, originComponent);

    hmrComponentCache.set(originComponent, newComponent);
    hmrSubject.next(originComponent);
  }
}

export function hmr() {
  active = true;
  window.addEventListener('hmr:r-html', handler);

  return () => {
    active = false;
    window.removeEventListener('hmr:r-html', handler);
  };
}

const hasHmrComponent = (value: any): boolean =>
  isFunction(value) && hmrComponentCache.has(value);

const hotReplaceComponent = (values: any[]): any[] =>
  active
    ? values.map(value =>
        hasHmrComponent(value) ? hmrComponentCache.get(value) : value
      )
    : values;

/**
 * The return type is annotated rather than inferred: the anonymous class below
 * carries #private fields, which TypeScript refuses to name in a declaration
 * file, and vite-plugin-dts answers by skipping the whole module.
 */
export const mixinHmrComponent = (
  ComponentClass: ComponentPartClass
): ComponentPartClass => {
  const C = class extends ComponentClass {
    #prevValues: any[] = [];
    #hmrUnsubscribe: Unsubscribe | null = null;

    constructor(node: Comment, tNode: TNode, parts: Part[]) {
      super(node, tNode, parts);
      this.hmr();
    }

    commit(values: any[]) {
      const newValues = hotReplaceComponent(values);
      super.commit(newValues);
      this.#prevValues = values;
    }

    hmr() {
      this.#hmrUnsubscribe = hmrSubject.subscribe(
        value =>
          this.#prevValues.includes(value) && this.commit(this.#prevValues)
      );
    }

    destroy() {
      this.#hmrUnsubscribe?.();
      super.destroy?.();
    }
  };

  return C;
};

/**
 * Called from observable() for every proxy a component body creates, which
 * only happens while that body is being evaluated — getCurrentInstance() is
 * null everywhere else, including in the event handlers the body closes over.
 */
export function addHmrObservable(proxy: any) {
  if (!active) return;
  const hmrInstance = getCurrentInstance();
  if (!hmrInstance) return;

  const pending = hmrObservablePendingCache.get(hmrInstance) ?? [];
  if (!pending.includes(proxy)) {
    pending.push(proxy);
    hmrObservablePendingCache.set(hmrInstance, pending);
  }
}

/**
 * Carries state across a hot swap by copying the old observables onto the new
 * ones in creation order. Pairing by index is the same contract as hooks:
 * reorder or conditionally create them between saves and the state misses.
 */
export function hotReloadObservable(component: Part) {
  if (!active) return;

  const pending = hmrObservablePendingCache.get(component);
  if (!pending) return;
  hmrObservablePendingCache.delete(component);

  const previous = hmrObservableCache.get(component);
  hmrObservableCache.set(component, pending);
  if (!previous) return;

  pending.forEach((proxy, index) => {
    const prevProxy = previous[index];
    if (!prevProxy) return;

    Object.assign(proxy, prevProxy);
  });
}
