import { insertAfterNode, insertBeforeNode } from '@/render/helper';
import { mixinHmrComponent } from '@/render/hmr';
import { Part } from '@/render/part';
import { ObservableComponentPart } from '@/render/part/node/component/observableComponent';
import { TNode } from '@/template/tNode';

export interface ComponentPartClass {
  new (node: Comment, tNode: TNode, parts: Part[]): Part;
}

const Component = class implements Part {
  #startNode = document.createComment('');
  #endNode = document.createComment('');
  #part: Part;

  constructor(node: Comment, tNode: TNode, parts: Part[]) {
    this.#part = new ObservableComponentPart(
      this.#startNode,
      this.#endNode,
      tNode,
      parts
    );

    insertBeforeNode(this.#startNode, node);
    insertAfterNode(this.#endNode, node);
    node.remove();
  }

  commit(values: any[]) {
    this.#part.commit(values);
  }

  destroy() {
    this.#part.destroy?.();
    this.#startNode.remove();
    this.#endNode.remove();
  }
};

export const ComponentPart: ComponentPartClass = mixinHmrComponent(Component);
