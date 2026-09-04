import { isFunction } from '@/helpers/is-type';
import type { HostNode } from '@/render/adapter';
import {
  domHelper,
  equalValues,
  HostHelper,
  isEventTuple,
} from '@/render/helper';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TAttr } from '@/template/tNode';

export class EventPart implements Part {
  #helper: HostHelper;
  #node: HostNode;
  #attrName: TAttr['name'];
  #markerTuples: Array<MarkerTuple> = [];
  #values: any[] = [];

  constructor(
    node: HostNode,
    { name, value }: TAttr,
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.#node = node;
    this.#attrName = name;
    this.#markerTuples = getMarkers(value ?? '');
  }

  commit(values: any[]) {
    const newValues = this.#markerTuples
      .map(([_, index]) => values[index])
      .filter(value => isFunction(value) || isEventTuple(value));
    if (equalValues(this.#values, newValues)) return;

    this.clear();
    newValues.forEach(handle => {
      const [listener, options] = toListenerTuple(handle);
      this.#helper.addEventListener(
        this.#node,
        this.#attrName,
        listener,
        options
      );
    });

    this.#values = newValues;
  }

  clear() {
    this.#values.forEach(handle => {
      const [listener, options] = toListenerTuple(handle);
      this.#helper.removeEventListener(
        this.#node,
        this.#attrName,
        listener,
        options
      );
    });
  }

  destroy() {
    this.clear();
  }
}

function toListenerTuple(handle: any): [Function, any] {
  return isFunction(handle) ? [handle, undefined] : handle;
}
