import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { Part } from '@/render/part';

export class NodePart implements Part {
  #helper: HostHelper;
  #endNode: HostNode;
  #value: HostNode | null = null;

  constructor(
    startNode: HostNode,
    endNode: HostNode,
    helper: HostHelper = domHelper
  ) {
    this.#endNode = endNode;
    this.#helper = helper;
  }

  commit(value: any) {
    if (this.#value === value) return;

    this.#value && this.#helper.removeNode(this.#value);
    this.#helper.insertBeforeNode(value, this.#endNode);

    this.#value = value;
  }
}
