import { isNull } from '@/helpers/is-type';
import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { Part } from '@/render/part';
import {
  createPart,
  getPartType,
  isPart,
} from '@/render/part/node/text/helper';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TNode } from '@/template/tNode';

export class TextPart implements Part {
  #helper: HostHelper;
  #startNode: HostNode;
  #endNode: HostNode;
  #markerTuple: MarkerTuple;
  #value: any = null;
  #part: Part | null = null;

  constructor(
    node: HostNode,
    { value }: TNode,
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.#startNode = helper.createMarker('');
    this.#endNode = helper.createMarker('');
    this.#markerTuple = getMarkers(value)[0];
    helper.insertBeforeNode(this.#startNode, node);
    helper.insertAfterNode(this.#endNode, node);
    helper.removeNode(node);
  }

  commit(values: any[]) {
    const [, index] = this.#markerTuple;
    const newValue = values[index];
    if (this.#value === newValue) return;

    const type = getPartType(newValue);
    if (!isPart(type, this.#part)) {
      isNull(this.#part) || this.clear();
      this.#part = createPart(
        type,
        this.#startNode,
        this.#endNode,
        this.#helper
      );
    }

    this.#part?.commit(newValue);
    this.#value = newValue;
  }

  clear() {
    this.#part?.destroy?.();
    this.#helper.removeRange(this.#startNode, this.#endNode);
  }

  destroy() {
    this.clear();
    this.#helper.removeNode(this.#startNode);
    this.#helper.removeNode(this.#endNode);
  }
}
