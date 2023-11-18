import { isNull } from '@/helpers/is-type';
import {
  insertAfterNode,
  insertBeforeNode,
  rangeNodes,
  removeNode,
} from '@/render/helper';
import { Part } from '@/render/part';
import {
  createPart,
  getPartType,
  isPart,
} from '@/render/part/node/text/helper';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TNode } from '@/template/tNode';

export class TextPart implements Part {
  #startNode = document.createComment('');
  #endNode = document.createComment('');
  #markerTuple: MarkerTuple;
  #value: any = null;
  #part: Part | null = null;

  constructor(node: Text, { value }: TNode) {
    this.#markerTuple = getMarkers(value)[0];
    insertBeforeNode(this.#startNode, node);
    insertAfterNode(this.#endNode, node);
    node.remove();
  }

  commit(values: any[]) {
    const [, index] = this.#markerTuple;
    const newValue = values[index];
    if (this.#value === newValue) return;

    const type = getPartType(newValue);
    if (!isPart(type, this.#part)) {
      isNull(this.#part) || this.clear();
      this.#part = createPart(type, this.#startNode, this.#endNode);
    }

    this.#part?.commit(newValue);
    this.#value = newValue;
  }

  clear() {
    this.#part?.destroy?.();
    rangeNodes(this.#startNode, this.#endNode).forEach(removeNode);
  }

  destroy() {
    this.clear();
    this.#startNode.remove();
    this.#endNode.remove();
  }
}
