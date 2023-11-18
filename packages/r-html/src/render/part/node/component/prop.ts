import { equalValues } from '@/render/helper';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TAttr } from '@/template/tNode';

export class PropPart implements Part {
  #props: any;
  #attrName: TAttr['name'];
  #markerTuples: Array<MarkerTuple> = [];
  #values: any[] = [];

  constructor(props: any, { name, value }: TAttr) {
    this.#props = props;
    this.#attrName = name;
    this.#markerTuples = getMarkers(value ?? '');
  }

  commit(values: any[]) {
    const newValues = this.#markerTuples.map(([_, index]) => values[index]);
    if (equalValues(this.#values, newValues)) return;

    const value = newValues[newValues.length - 1];
    Reflect.set(this.#props, this.#attrName, value);
    this.#values = newValues;
  }
}
