import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { mixinHmrComponent } from '@/render/hmr';
import { Part } from '@/render/part';
import { ObservableComponentPart } from '@/render/part/node/component/observableComponent';
import { TNode } from '@/template/tNode';

export interface ComponentPartClass<T extends HostNode = HostNode> {
  new (node: T, tNode: TNode, parts: Part[], helper?: HostHelper): Part;
}

const Component = class implements Part {
  #helper: HostHelper;
  #startNode: HostNode;
  #endNode: HostNode;
  #part: Part;

  constructor(
    node: HostNode,
    tNode: TNode,
    parts: Part[],
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.#startNode = helper.createMarker('');
    this.#endNode = helper.createMarker('');
    this.#part = new ObservableComponentPart(
      this.#startNode,
      this.#endNode,
      tNode,
      parts,
      helper
    );

    helper.insertBeforeNode(this.#startNode, node);
    helper.insertAfterNode(this.#endNode, node);
    helper.removeNode(node);
  }

  commit(values: any[]) {
    this.#part.commit(values);
  }

  destroy() {
    this.#part.destroy?.();
    this.#helper.removeNode(this.#startNode);
    this.#helper.removeNode(this.#endNode);
  }
};

export const ComponentPart: ComponentPartClass = mixinHmrComponent(Component);
