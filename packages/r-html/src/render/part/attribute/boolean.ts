import type { HostNode } from '@/render/adapter';
import { domHelper, equalValues, HostHelper, isTruthy } from '@/render/helper';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TAttr } from '@/template/tNode';

export class BooleanPart implements Part {
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
    const newValues = this.#markerTuples.map(([_, index]) => values[index]);
    if (equalValues(this.#values, newValues)) return;

    const value = newValues[newValues.length - 1];
    isTruthy(value)
      ? this.#helper.setAttribute(this.#node, this.#attrName, '', false)
      : this.#helper.removeAttribute(this.#node, this.#attrName);
    this.#values = newValues;
  }
}
