import { isFunction } from '@/helpers/is-type';
import { createSubject, Unsubscribe } from '@/helpers/subject';
import { Part } from '@/render/part';
import type { ComponentPartClass } from '@/render/part/node/component';
import { getCurrentInstance } from '@/render/part/node/component/hooks';
import type { FC } from '@/render/part/node/component/observableComponent';
import { TNode } from '@/template/tNode';

const originComponentCache = new WeakMap<FC, FC>();
const hmrComponentCache = new WeakMap<FC, FC>();
const hmrObservableCache = new WeakMap<Part, Array<any>>();
const hmrObservablePrevCache = new WeakMap<Part, Array<any>>();
const hmrSubject = createSubject<FC>();

let active = false;

function handler(event: any) {
  let { originComponent, newComponent }: any = event?.detail ?? {};

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

export const mixinHmrComponent = (ComponentClass: ComponentPartClass) => {
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

export function addHmrObservable(proxy: any) {
  if (!active) return;
  const hmrInstance = getCurrentInstance();
  if (!hmrInstance) return;

  const observableList = hmrObservableCache.get(hmrInstance) ?? [];
  if (!observableList.includes(proxy)) {
    observableList.push(proxy);
    hmrObservableCache.set(hmrInstance, observableList);
  }
}

export function hotReloadObservable(component: Part) {
  if (!active) return;

  const prevObservableList = hmrObservablePrevCache.get(component);
  const observableList = hmrObservableCache.get(component);

  if (prevObservableList && observableList) {
    observableList.forEach((observable, index) => {
      const prevObservable = prevObservableList[index];
      if (!prevObservable) return;

      Object.assign(observable, prevObservable);
    });
  }
}
