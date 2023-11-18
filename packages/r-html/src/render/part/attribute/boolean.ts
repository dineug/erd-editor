import { equalValues, isTruthy } from '@/render/helper';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TAttr } from '@/template/tNode';

export class BooleanPart implements Part {
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
    const newValues = this.#markerTuples.map(([_, index]) => values[index]);
    if (equalValues(this.#values, newValues)) return;

    const value = newValues[newValues.length - 1];
    isTruthy(value)
      ? this.#node.setAttribute(this.#attrName, '')
      : this.#node.removeAttribute(this.#attrName);
    this.#values = newValues;
  }
}
