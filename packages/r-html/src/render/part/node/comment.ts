import { isNull, isPrimitive, isString, isUndefined } from '@/helpers/is-type';
import type { HostNode } from '@/render/adapter';
import { domHelper, equalValues, HostHelper } from '@/render/helper';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TNode } from '@/template/tNode';

export class CommentPart implements Part {
  #helper: HostHelper;
  #node: HostNode;
  #value: TNode['value'];
  #markerTuples: Array<MarkerTuple> = [];
  #values: any[] = [];

  constructor(
    node: HostNode,
    { value }: TNode,
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.#node = node;
    this.#value = value;
    isString(value) && (this.#markerTuples = getMarkers(value));
  }

  commit(values: any[]) {
    const targetValues = this.#markerTuples.map(([_, index]) => values[index]);
    if (equalValues(this.#values, targetValues)) return;
    this.#values = targetValues;

    const value = this.#values.reduce<string>(
      (acc, cur, i) =>
        acc.replace(
          new RegExp(this.#markerTuples[i][0]),
          isPrimitive(cur) && !isNull(cur) && !isUndefined(cur)
            ? String(cur)
            : ''
        ),
      this.#value ?? ''
    );

    this.#helper.setText(this.#node, value);
  }
}
