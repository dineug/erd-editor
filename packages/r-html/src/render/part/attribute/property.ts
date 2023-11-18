import { equalValues } from '@/render/helper';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TAttr } from '@/template/tNode';

export class PropertyPart implements Part {
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
    Reflect.set(this.#node, this.#attrName, value, this.#node);
    this.#values = newValues;
  }
}
