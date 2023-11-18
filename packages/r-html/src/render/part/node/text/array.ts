import {
  insertAfterNode,
  insertBeforeNode,
  rangeNodes,
  removeNode,
} from '@/render/helper';
import { Part } from '@/render/part';
import {
  Action,
  difference,
  partsToDiffItems,
  valuesToDiffItems,
} from '@/render/part/node/text/arrayDiff';
import {
  createPart,
  getPartType,
  PartType,
} from '@/render/part/node/text/helper';

export class ArrayPart implements Part {
  #startNode: Comment;
  #endNode: Comment;
  #parts: ItemPart[] = [];

  constructor(startNode: Comment, endNode: Comment) {
    this.#startNode = startNode;
    this.#endNode = endNode;
  }

  commit(values: any[]) {
    const diff = difference(
      partsToDiffItems(this.#parts),
      valuesToDiffItems(values)
    );
    const arrayLike: any = { length: values.length };

    diff.update.forEach(({ action, from, to }) => {
      switch (action) {
        case Action.create:
          const node = document.createComment('');

          to === 0
            ? insertAfterNode(node, this.#startNode)
            : this.#parts.length
            ? insertAfterNode(
                node,
                arrayLike[to - 1]
                  ? arrayLike[to - 1].endNode
                  : this.#parts[to - 1].endNode
              )
            : insertBeforeNode(node, this.#endNode);

          arrayLike[to] = new ItemPart(node, values[to]);
          break;
        case Action.move:
          arrayLike[to] = this.#parts[from];
          if (to === from) return;

          to === 0
            ? this.#parts[from].insert('after', this.#startNode)
            : this.#parts[from].insert(
                'after',
                arrayLike[to - 1]
                  ? arrayLike[to - 1].endNode
                  : this.#parts[to - 1].endNode
              );
          break;
      }
    });
    diff.delete.forEach(({ from }) => this.#parts[from].destroy());

    this.#parts = Array.from(arrayLike);
    this.#parts.forEach((part, index) => part.commit(values[index]));
  }

  destroy() {
    this.#parts.forEach(part => part.destroy());
  }
}

export class ItemPart implements Part {
  #part: Part;
  startNode = document.createComment('');
  endNode = document.createComment('');
  type: PartType;
  value: any;

  constructor(node: Node, value: any) {
    insertBeforeNode(this.startNode, node);
    insertAfterNode(this.endNode, node);
    removeNode(node);
    this.value = value;
    this.type = getPartType(value);
    this.#part = createPart(this.type, this.startNode, this.endNode);
  }

  commit(value: any) {
    this.#part.commit(value);
    this.value = value;
  }

  insert(position: 'before' | 'after', refChild: Node) {
    const nodes = [
      this.startNode,
      ...rangeNodes(this.startNode, this.endNode),
      this.endNode,
    ];

    position === 'before'
      ? nodes.forEach(node => insertBeforeNode(node, refChild))
      : nodes.reverse().forEach(node => insertAfterNode(node, refChild));
  }

  destroy() {
    this.#part.destroy?.();
    rangeNodes(this.startNode, this.endNode).forEach(removeNode);
    this.startNode.remove();
    this.endNode.remove();
  }
}
