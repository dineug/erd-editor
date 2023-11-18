import { insertBeforeNode, removeNode } from '@/render/helper';
import { Part } from '@/render/part';

export class NodePart implements Part {
  #endNode: Comment;
  #value: Node | null = null;

  constructor(startNode: Comment, endNode: Comment) {
    this.#endNode = endNode;
  }

  commit(value: any) {
    if (this.#value === value) return;

    this.#value && removeNode(this.#value);
    insertBeforeNode(value, this.#endNode);

    this.#value = value;
  }
}
