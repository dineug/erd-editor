import { isNull, isUndefined } from '@/helpers/is-type';
import { insertAfterNode } from '@/render/helper';
import { Part } from '@/render/part';

export class PrimitivePart implements Part {
  #textNode = document.createTextNode('');
  #value: any = null;

  constructor(startNode: Comment, endNode: Comment) {
    insertAfterNode(this.#textNode, startNode);
  }

  commit(value: any) {
    if (this.#value === value) return;

    this.#textNode.data =
      isNull(value) || isUndefined(value) ? '' : String(value);

    this.#value = value;
  }
}
