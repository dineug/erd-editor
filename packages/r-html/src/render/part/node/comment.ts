import { isNull, isPrimitive, isString, isUndefined } from '@/helpers/is-type';
import { equalValues } from '@/render/helper';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TNode } from '@/template/tNode';

export class CommentPart implements Part {
  #node: Comment;
  #value: TNode['value'];
  #markerTuples: Array<MarkerTuple> = [];
  #values: any[] = [];

  constructor(node: Comment, { value }: TNode) {
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

    this.#node.data = value;
  }
}
