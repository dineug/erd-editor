import {
  BEFORE_FIRST_UPDATE,
  BEFORE_MOUNT,
  BEFORE_UPDATE,
  FIRST_UPDATED,
  MOUNTED,
  TAttrType,
  UNMOUNTED,
  UPDATED,
} from '@/constants';
import { isFunction } from '@/helpers/is-type';
import { observable, observer, Unsubscribe } from '@/observable';
import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper, setProps } from '@/render/helper';
import { hotReloadObservable } from '@/render/hmr';
import { createTemplate, Part } from '@/render/part';
import { DirectivePart } from '@/render/part/attribute/directive';
import { EventPart } from '@/render/part/attribute/event';
import { SpreadPart } from '@/render/part/attribute/spread';
import {
  clearAllLifecycleHooks,
  lifecycleHooks,
  setCurrentInstance,
} from '@/render/part/node/component/hooks';
import { PropPart } from '@/render/part/node/component/prop';
import {
  createPart,
  getPartType,
  isPart,
} from '@/render/part/node/text/helper';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TAttr, TNode } from '@/template/tNode';

export type Props<T = {}> = T;
export type Context<T = {}> = T & {
  host: HTMLElement;
  parentElement: HTMLElement | null;
  dispatchEvent(event: Event): boolean;
};
export type Template = () => any;
export type FunctionalComponent<P = {}, C = {}> = (
  props: Props<P>,
  ctx: Context<C>
) => Template;
export type FC<P = {}, C = {}> = FunctionalComponent<P, C>;

export class ObservableComponentPart implements Part {
  #helper: HostHelper;
  #startNode: HostNode;
  #endNode: HostNode;
  #markerTuple: MarkerTuple;
  #tNode: TNode;
  #directiveAttrs: TAttr[] = [];
  #parts: Part[] = [];
  #part: Part | null = null;
  #props = observable<any>({}, { shallow: true });
  #Component: Function | null = null;
  #unsubscribe: Unsubscribe | null = null;
  #eventBus: HostNode;

  constructor(
    startNode: HostNode,
    endNode: HostNode,
    tNode: TNode,
    parts: Part[],
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.#eventBus = helper.createEventBus();
    this.#startNode = startNode;
    this.#endNode = endNode;
    this.#tNode = tNode;
    this.#markerTuple = getMarkers(tNode.value)[0];

    tNode.staticAttrs &&
      tNode.staticAttrs.forEach(attr => setProps(this.#props, attr));

    tNode.attrs?.forEach(attr => {
      attr.type === TAttrType.directive
        ? this.#directiveAttrs.push(attr)
        : attr.type === TAttrType.spread
          ? parts.push(new SpreadPart(this.#props, attr))
          : attr.type === TAttrType.event
            ? parts.push(new EventPart(this.#eventBus, attr, helper))
            : parts.push(new PropPart(this.#props, attr));
    });
  }

  createContext(): Context {
    return this.#helper.createComponentContext(this.#startNode, this.#eventBus);
  }

  commit(values: any[]) {
    const [, index] = this.#markerTuple;
    const functionalComponent = values[index];
    if (
      !isFunction(functionalComponent) ||
      this.#Component === functionalComponent
    ) {
      this.#parts.forEach(part => part.commit(values));
      return;
    }

    const ctx = this.createContext();

    this.clear();
    setCurrentInstance(this);
    const render = functionalComponent.call(ctx, this.#props, ctx);
    setCurrentInstance(null);

    hotReloadObservable(this);

    if (this.#directiveAttrs.length) {
      this.#parts.push(
        ...this.#directiveAttrs.map(attr => new DirectivePart(ctx, attr))
      );
    }

    // TODO: slot
    /*
    if (this.#tNode.children) {
      const [fragment, parts] = createTemplate(this.#tNode);
      Reflect.set(this.#props, 'children', fragment);
      this.#parts.push(...parts);
    }
    */

    lifecycleHooks(this, BEFORE_MOUNT);

    let isMounted = false;
    this.#unsubscribe = observer(() => {
      const result = render();
      const type = getPartType(result);

      if (!isPart(type, this.#part)) {
        this.partClear();
        this.#part = createPart(
          type,
          this.#startNode,
          this.#endNode,
          this.#helper
        );
      }

      lifecycleHooks(this, isMounted ? BEFORE_UPDATE : BEFORE_FIRST_UPDATE);

      this.#part?.commit(result);

      if (isMounted) {
        lifecycleHooks(this, UPDATED);
      } else {
        lifecycleHooks(this, FIRST_UPDATED);
        isMounted = true;
      }
    });

    this.#parts.forEach(part => part.commit(values));
    lifecycleHooks(this, MOUNTED);
    this.#Component = functionalComponent;
  }

  partClear() {
    this.#part?.destroy?.();
    this.#helper.removeRange(this.#startNode, this.#endNode);
  }

  clear() {
    this.#helper.removeRange(this.#startNode, this.#endNode);
    lifecycleHooks(this, UNMOUNTED);
    this.#parts.forEach(part => part.destroy?.());
    this.#unsubscribe?.();
    this.#parts = [];
    this.#unsubscribe = null;
    clearAllLifecycleHooks(this);
  }

  destroy() {
    this.clear();
    this.partClear();
  }
}
