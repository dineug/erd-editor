import { isNull, isUndefined } from '@/helpers/is-type';
import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { Part } from '@/render/part';

export class PrimitivePart implements Part {
  #helper: HostHelper;
  #textNode: HostNode;
  #value: any = null;

  constructor(
    startNode: HostNode,
    endNode: HostNode,
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.#textNode = helper.createText('');
    helper.insertAfterNode(this.#textNode, startNode);
  }

  commit(value: any) {
    if (this.#value === value) return;

    this.#helper.setText(
      this.#textNode,
      isNull(value) || isUndefined(value) ? '' : String(value)
    );

    this.#value = value;
  }
}
