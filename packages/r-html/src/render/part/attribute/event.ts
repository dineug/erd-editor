import { isFunction } from '@/helpers/is-type';
import { equalValues, isEventTuple } from '@/render/helper';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TAttr } from '@/template/tNode';

export class EventPart implements Part {
  #node: Element;
  #attrName: TAttr['name'];
  #markerTuples: Array<MarkerTuple> = [];
  #values: any[] = [];

  constructor(node: Element, { name, value }: TAttr) {
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
    newValues.forEach((handle: any) =>
      isFunction(handle)
        ? this.#node.addEventListener(this.#attrName, handle)
        : this.#node.addEventListener(this.#attrName, handle[0], handle[1])
    );

    this.#values = newValues;
  }

  clear() {
    this.#values.forEach(handle =>
      isFunction(handle)
        ? this.#node.removeEventListener(this.#attrName, handle)
        : this.#node.removeEventListener(this.#attrName, handle[0], handle[1])
    );
  }

  destroy() {
    this.clear();
  }
}
